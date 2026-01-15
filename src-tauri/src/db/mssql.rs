use crate::db::common::{parse_cte_statement_type, quote_identifier, quote_identifier_single, CteParserConfig};
use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    AvailablePrivileges, ChangePasswordRequest, ColumnInfo, ConnectionConfig, ConstraintInfo,
    CreateIndexDefinition, CreateRoleRequest, CreateUserRequest, DatabasePermission, DatabaseRole,
    DatabaseType, DatabaseUser, ExplainResult, ExplainWarning, ExtendedColumnInfo, ForeignKeyInfo,
    IndexInfo, NewTableDefinition, NewViewDefinition, PermissionRequest, PlanNode, PreviewResult,
    QueryResult, RoleMembershipRequest, StandaloneIndexInfo, StatementPreview, StatementType,
    TableInfo, TableProperties, TableReferenceInfo, TableRelationship, TableSchema,
    TestConnectionResult, ViewInfo, WarningSeverity,
};
use std::collections::HashMap;
use async_trait::async_trait;
use deadpool::managed::{Manager, Pool, RecycleResult};
use std::future::Future;
use std::time::Instant;
use tiberius::{AuthMethod, Client, Config, Query, Row};
use tokio::net::TcpStream;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

/// MSSQL connection manager for deadpool
pub struct MssqlConnectionManager {
    connection_string: String,
}

impl MssqlConnectionManager {
    fn new(connection_string: String) -> Self {
        Self { connection_string }
    }
}

impl Manager for MssqlConnectionManager {
    type Type = Client<Compat<TcpStream>>;
    type Error = AppError;

    fn create(&self) -> impl Future<Output = Result<Self::Type, Self::Error>> + Send {
        let connection_string = self.connection_string.clone();
        async move {
            let config = parse_connection_string(&connection_string)?;
            let tcp = TcpStream::connect(config.get_addr())
                .await
                .map_err(|e| AppError::ConnectionError(format!("Failed to connect to MSSQL server: {}", e)))?;
            tcp.set_nodelay(true)
                .map_err(|e| AppError::ConnectionError(format!("Failed to set nodelay: {}", e)))?;

            let client = Client::connect(config, tcp.compat_write())
                .await
                .map_err(|e| AppError::ConnectionError(format!("MSSQL authentication failed: {}", e)))?;

            Ok(client)
        }
    }

    fn recycle(
        &self,
        client: &mut Self::Type,
        _: &deadpool::managed::Metrics,
    ) -> impl Future<Output = RecycleResult<Self::Error>> + Send {
        async move {
            // Check if the connection is still alive by executing a simple query
            // We try to query a simple value; if it fails, the connection is stale
            let query = Query::new("SELECT 1");
            match query.query(client).await {
                Ok(_) => Ok(()),
                Err(_) => Err(deadpool::managed::RecycleError::Backend(
                    AppError::ConnectionError("Connection is stale".to_string())
                )),
            }
        }
    }

    fn detach(&self, _obj: &mut Self::Type) {
        // Close the connection when it's removed from the pool
        // Note: We can't call client.close() here as it takes ownership
        // The connection will be properly closed when dropped
    }
}

/// MSSQL pool type using deadpool
pub type MssqlPool = Pool<MssqlConnectionManager>;

/// Create a new MSSQL pool with deadpool
pub async fn create_mssql_pool(connection_string: &str) -> AppResult<MssqlPool> {
    let manager = MssqlConnectionManager::new(connection_string.to_string());
    let pool = Pool::builder(manager)
        .max_size(5)
        .build()
        .map_err(|e| AppError::ConnectionError(format!("Failed to create MSSQL pool: {}", e)))?;

    // Validate the connection by getting a client from the pool
    // This ensures the connection actually works before returning success
    let mut client: deadpool::managed::Object<MssqlConnectionManager> = pool.get().await
        .map_err(|e| AppError::ConnectionError(format!("Failed to establish MSSQL connection: {}", e)))?;

    // Test the connection with a simple query
    let query = Query::new("SELECT 1");
    query.query(&mut *client).await
        .map_err(|e| AppError::ConnectionError(format!("MSSQL connection test failed: {}", e)))?;

    Ok(pool)
}

fn parse_connection_string(conn_str: &str) -> AppResult<Config> {
    let mut config = Config::new();

    // First pass: gather all values
    let mut host = String::from("localhost");
    let mut port: u16 = 1433;
    let mut instance_name: Option<String> = None;
    let mut database = String::new();
    let mut username = String::new();
    let mut password = String::new();
    let mut trust_cert = false;

    for part in conn_str.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }

        if let Some((key, value)) = part.split_once('=') {
            let key = key.trim().to_lowercase();
            let value = value.trim();

            match key.as_str() {
                "server" => {
                    let server = value.strip_prefix("tcp:").unwrap_or(value);
                    // First extract port if specified with comma (e.g., server,1433)
                    let (server_part, explicit_port) = if let Some((s, port_str)) = server.split_once(',') {
                        let p = port_str.parse::<u16>().ok();
                        (s, p)
                    } else {
                        (server, None)
                    };

                    // Then check for named instance (e.g., server\SQLEXPRESS)
                    if let Some((h, inst)) = server_part.split_once('\\') {
                        host = h.to_string();
                        instance_name = Some(inst.to_string());
                    } else {
                        host = server_part.to_string();
                    }

                    // Apply explicit port if specified
                    if let Some(p) = explicit_port {
                        port = p;
                    }
                }
                "database" | "initial catalog" => {
                    database = value.to_string();
                }
                "user id" | "uid" | "user" => {
                    username = value.to_string();
                }
                "password" | "pwd" => {
                    password = value.to_string();
                }
                "trustservercertificate" => {
                    trust_cert = value.eq_ignore_ascii_case("true");
                }
                _ => {}
            }
        }
    }

    config.host(&host);
    // If instance name is specified, use it (this queries SQL Browser for the port)
    // Otherwise use the explicit port
    if let Some(ref inst) = instance_name {
        config.instance_name(inst);
    } else {
        config.port(port);
    }
    if !database.is_empty() {
        config.database(&database);
    }
    if !username.is_empty() {
        config.authentication(AuthMethod::sql_server(&username, &password));
    }
    if trust_cert {
        config.trust_cert();
    }

    Ok(config)
}

pub struct MssqlDriver;

impl MssqlDriver {
    /// Safely split SQL into individual statements, handling quotes and comments
    fn split_sql_statements(sql: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut chars = sql.chars().peekable();
        let mut in_single_quote = false;
        let mut in_double_quote = false;
        let mut in_bracket = false;
        let mut in_line_comment = false;
        let mut in_block_comment = false;

        while let Some(c) = chars.next() {
            match c {
                '\'' if !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    if in_single_quote && chars.peek() == Some(&'\'') {
                        current.push(c);
                        current.push(chars.next().unwrap());
                    } else {
                        in_single_quote = !in_single_quote;
                        current.push(c);
                    }
                }
                '"' if !in_single_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    in_double_quote = !in_double_quote;
                    current.push(c);
                }
                '[' if !in_single_quote && !in_double_quote && !in_line_comment && !in_block_comment => {
                    in_bracket = true;
                    current.push(c);
                }
                ']' if in_bracket && !in_line_comment && !in_block_comment => {
                    in_bracket = false;
                    current.push(c);
                }
                '-' if !in_single_quote && !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    if let Some(&'-') = chars.peek() {
                        chars.next();
                        in_line_comment = true;
                    } else {
                        current.push(c);
                    }
                }
                '\n' if in_line_comment => {
                    in_line_comment = false;
                }
                '/' if !in_single_quote && !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    if let Some(&'*') = chars.peek() {
                        chars.next();
                        in_block_comment = true;
                    } else {
                        current.push(c);
                    }
                }
                '*' if in_block_comment => {
                    if let Some(&'/') = chars.peek() {
                        chars.next();
                        in_block_comment = false;
                    }
                }
                ';' if !in_single_quote && !in_double_quote && !in_bracket && !in_line_comment && !in_block_comment => {
                    let trimmed = current.trim().to_string();
                    if !trimmed.is_empty() {
                        statements.push(trimmed);
                    }
                    current.clear();
                }
                _ if !in_line_comment && !in_block_comment => {
                    current.push(c);
                }
                _ => {}
            }
        }

        let trimmed = current.trim().to_string();
        if !trimmed.is_empty() {
            statements.push(trimmed);
        }

        statements
    }

    /// Detect the type of SQL statement
    fn detect_statement_type(sql: &str) -> StatementType {
        let mut clean_sql = sql.trim().to_uppercase();

        // Skip comments
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") {
            if clean_sql.starts_with("--") {
                if let Some(newline_pos) = clean_sql.find('\n') {
                    clean_sql = clean_sql[newline_pos..].trim().to_string();
                } else {
                    return StatementType::Other;
                }
            } else if clean_sql.starts_with("/*") {
                if let Some(end_pos) = clean_sql.find("*/") {
                    clean_sql = clean_sql[end_pos + 2..].trim().to_string();
                } else {
                    return StatementType::Other;
                }
            }
        }

        if clean_sql.starts_with("CREATE") || clean_sql.starts_with("ALTER") || clean_sql.starts_with("DROP") {
            StatementType::Ddl
        } else if clean_sql.starts_with("INSERT") || clean_sql.starts_with("UPDATE") || clean_sql.starts_with("DELETE") {
            StatementType::Dml
        } else if clean_sql.starts_with("WITH") {
            parse_cte_statement_type(&clean_sql, &CteParserConfig::mssql())
        } else if clean_sql.starts_with("SELECT") {
            StatementType::Select
        } else {
            StatementType::Other
        }
    }

    /// Extract table name from SQL statement
    fn extract_table_name(sql: &str) -> Option<String> {
        let sql_upper = sql.trim().to_uppercase();
        let sql_trimmed = sql.trim();

        // Handle CREATE TABLE
        if sql_upper.starts_with("CREATE") {
            let rest = &sql_trimmed[6..].trim_start();
            let rest_upper = rest.to_uppercase();
            
            let after_create = if rest_upper.starts_with("TABLE") {
                &rest[5..].trim_start()
            } else {
                return None;
            };

            return Self::extract_identifier(after_create);
        }

        // Handle ALTER TABLE
        if sql_upper.starts_with("ALTER TABLE") {
            let rest = &sql_trimmed[11..].trim_start();
            return Self::extract_identifier(rest);
        }

        // Handle DROP TABLE
        if sql_upper.starts_with("DROP TABLE") {
            let rest = &sql_trimmed[10..].trim_start();
            let rest = if rest.to_uppercase().starts_with("IF EXISTS") {
                &rest[9..].trim_start()
            } else {
                rest
            };
            return Self::extract_identifier(rest);
        }

        // Handle INSERT INTO
        if sql_upper.starts_with("INSERT INTO") {
            let rest = &sql_trimmed[11..].trim_start();
            return Self::extract_identifier(rest);
        }

        // Handle UPDATE
        if sql_upper.starts_with("UPDATE") {
            let rest = &sql_trimmed[6..].trim_start();
            return Self::extract_identifier(rest);
        }

        // Handle DELETE FROM
        if sql_upper.starts_with("DELETE FROM") {
            let rest = &sql_trimmed[11..].trim_start();
            return Self::extract_identifier(rest);
        }

        None
    }

    /// Extract identifier (table name) from the start of a string
    fn extract_identifier(s: &str) -> Option<String> {
        let s = s.trim();
        if s.is_empty() {
            return None;
        }

        // Handle bracket quoted identifier (MSSQL style)
        if s.starts_with('[') {
            let mut identifier = String::new();
            let mut end_byte = 1;
            let mut chars = s.char_indices().skip(1).peekable();
            let mut found_closing = false;

            while let Some((pos, c)) = chars.next() {
                if c == ']' {
                    if let Some((_, next_c)) = chars.peek() {
                        if *next_c == ']' {
                            identifier.push(']');
                            chars.next(); // consume second bracket
                            continue;
                        }
                    }
                    // This is the closing bracket
                    end_byte = pos + 1;
                    found_closing = true;
                    break;
                }
                identifier.push(c);
            }

            if found_closing {
                let after = s[end_byte..].trim_start();
                if after.starts_with('.') {
                    if let Some(table) = Self::extract_identifier(after[1..].trim_start()) {
                        return Some(format!("{}.{}", identifier, table));
                    }
                }
            }
            
            return if identifier.is_empty() && !found_closing { None } else { Some(identifier) };
        }

        // Handle unquoted identifier
        let mut end_byte = 0;
        for (pos, c) in s.char_indices() {
            if c.is_alphanumeric() || c == '_' || c == '#' || c == '@' {
                end_byte = pos + c.len_utf8();
            } else {
                break;
            }
        }

        if end_byte == 0 {
            return None;
        }

        let identifier = s[..end_byte].to_string();
        let after = s[end_byte..].trim_start();
        if after.starts_with('.') {
            if let Some(table) = Self::extract_identifier(after[1..].trim_start()) {
                return Some(format!("{}.{}", identifier, table));
            }
        }

        Some(identifier)
    }

    /// Execute a single SQL statement
    async fn execute_single_query(client: &mut Client<Compat<TcpStream>>, sql: &str, start: Instant) -> AppResult<QueryResult> {
        let mut clean_sql = sql.trim();
        while clean_sql.starts_with("--") || clean_sql.starts_with("/*") {
            if clean_sql.starts_with("--") {
                if let Some(newline_pos) = clean_sql.find('\n') {
                    clean_sql = clean_sql[newline_pos..].trim();
                } else {
                    clean_sql = "";
                    break;
                }
            } else if clean_sql.starts_with("/*") {
                if let Some(end_pos) = clean_sql.find("*/") {
                    clean_sql = clean_sql[end_pos + 2..].trim();
                } else {
                    break;
                }
            }
        }

        let sql_upper = clean_sql.to_uppercase();
        let is_select = sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH");

        let query = Query::new(sql);
        let stream = query.query(client).await
            .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

        let results = stream.into_results().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        let mut columns = Vec::new();
        let mut rows_data: Vec<Vec<serde_json::Value>> = Vec::new();
        let mut affected_rows: Option<u64> = None;

        for result_set in results {
            if columns.is_empty() && !result_set.is_empty() {
                if let Some(first_row) = result_set.first() {
                    columns = first_row
                        .columns()
                        .iter()
                        .map(|col| ColumnInfo {
                            name: col.name().to_string(),
                            data_type: format!("{:?}", col.column_type()),
                            nullable: true,
                            is_primary_key: false,
                        })
                        .collect();
                }
            }

            for row in result_set {
                let mut row_values = Vec::new();
                for idx in 0..row.columns().len() {
                    row_values.push(mssql_value_to_json(&row, idx));
                }
                rows_data.push(row_values);
            }
            break;
        }

        if !is_select && rows_data.is_empty() {
            affected_rows = Some(0); // MSSQL doesn't easily report affected rows through tiberius
        }

        let duration = start.elapsed();

        Ok(QueryResult {
            columns,
            rows: rows_data,
            affected_rows,
            execution_time_ms: duration.as_millis() as u64,
        })
    }

    /// Add OUTPUT clause to a DML statement
    fn add_output_clause(stmt: &str) -> String {
        let stmt_trimmed = stmt.trim().trim_end_matches(';');
        let sql_upper = stmt_trimmed.to_uppercase();

        if sql_upper.starts_with("INSERT") {
            // INSERT INTO [table] (...) OUTPUT INSERTED.* VALUES (...)
            // Find VALUES keyword (with any whitespace before it)
            if let Some(pos) = Self::find_keyword_with_whitespace(&sql_upper, "VALUES") {
                let before = stmt_trimmed[..pos].trim_end();
                let after = &stmt_trimmed[pos..];
                return format!("{} OUTPUT INSERTED.* {}", before, after.trim_start());
            }
            // INSERT INTO ... SELECT ...
            if let Some(pos) = Self::find_keyword_with_whitespace(&sql_upper, "SELECT") {
                let before = stmt_trimmed[..pos].trim_end();
                let after = &stmt_trimmed[pos..];
                return format!("{} OUTPUT INSERTED.* {}", before, after.trim_start());
            }
            // INSERT INTO table DEFAULT VALUES
            if let Some(pos) = Self::find_keyword_with_whitespace(&sql_upper, "DEFAULT") {
                let before = stmt_trimmed[..pos].trim_end();
                let after = &stmt_trimmed[pos..];
                return format!("{} OUTPUT INSERTED.* {}", before, after.trim_start());
            }
        } else if sql_upper.starts_with("UPDATE") {
            // UPDATE [table] SET ... OUTPUT INSERTED.* WHERE ...
            if let Some(pos) = Self::find_keyword_with_whitespace(&sql_upper, "WHERE") {
                let before = stmt_trimmed[..pos].trim_end();
                let after = &stmt_trimmed[pos..];
                return format!("{} OUTPUT INSERTED.* {}", before, after.trim_start());
            }
            // No WHERE clause, append at end
            return format!("{} OUTPUT INSERTED.*", stmt_trimmed);
        } else if sql_upper.starts_with("DELETE") {
            // DELETE FROM [table] OUTPUT DELETED.* WHERE ...
            if let Some(pos) = Self::find_keyword_with_whitespace(&sql_upper, "WHERE") {
                let before = stmt_trimmed[..pos].trim_end();
                let after = &stmt_trimmed[pos..];
                return format!("{} OUTPUT DELETED.* {}", before, after.trim_start());
            }
            // No WHERE clause, append OUTPUT before end
            return format!("{} OUTPUT DELETED.*", stmt_trimmed);
        }

        // Fallback: return original statement
        stmt.to_string()
    }

    /// Find a SQL keyword that has whitespace before it (not part of another word)
    fn find_keyword_with_whitespace(sql_upper: &str, keyword: &str) -> Option<usize> {
        let mut search_start = 0;
        while let Some(pos) = sql_upper[search_start..].find(keyword) {
            let absolute_pos = search_start + pos;
            // Check that this is a standalone keyword (whitespace before, not alphanumeric after)
            let has_whitespace_before = absolute_pos == 0 
                || sql_upper.chars().nth(absolute_pos - 1).map(|c| c.is_whitespace()).unwrap_or(false);
            let keyword_end = absolute_pos + keyword.len();
            let has_word_boundary_after = keyword_end >= sql_upper.len()
                || !sql_upper.chars().nth(keyword_end).map(|c| c.is_alphanumeric() || c == '_').unwrap_or(false);
            
            if has_whitespace_before && has_word_boundary_after {
                return Some(absolute_pos);
            }
            search_start = absolute_pos + 1;
        }
        None
    }

    /// Parse table name into schema and table parts
    fn parse_table_name(table_name: &str) -> (String, String) {
        if let Some(dot_pos) = table_name.find('.') {
            let (s, t) = table_name.split_at(dot_pos);
            (s.to_string(), t.trim_start_matches('.').to_string())
        } else {
            ("dbo".to_string(), table_name.to_string())
        }
    }

    /// Build DDL string from query results with __type__ marker column
    /// Uses column indices for reliability with tiberius:
    /// cols_result: [0]=__type__, [1]=col_name, [2]=type_name, [3]=max_length, [4]=precision, [5]=scale, [6]=is_nullable, [7]=is_identity, [8]=col_default
    /// pk_result: [0]=__type__, [1]=pk_column_name
    fn build_ddl_from_results_with_marker(table_name: &str, cols_result: &[Row], pk_result: &[Row]) -> String {
        if cols_result.is_empty() {
            return String::new();
        }

        let (schema, table) = Self::parse_table_name(table_name);

        let mut columns: Vec<(String, String, Option<i16>, Option<u8>, Option<u8>, bool, bool, Option<String>)> = Vec::new();
        let mut pk_columns: Vec<String> = Vec::new();

        for row in cols_result {
            // Check that row has enough columns (schema query with marker returns 9 columns)
            let col_count = row.columns().len();
            if col_count < 3 {
                // Not a valid schema row, skip
                continue;
            }

            // Column indices shifted by 1 due to __type__ marker at position 0
            let col_name: String = row.try_get::<&str, _>(1).ok().flatten().unwrap_or("").to_string();
            let data_type: String = row.try_get::<&str, _>(2).ok().flatten().unwrap_or("").to_string();
            let max_length: Option<i16> = if col_count > 3 { row.try_get::<i16, _>(3).ok().flatten() } else { None };
            let precision: Option<u8> = if col_count > 4 { row.try_get::<u8, _>(4).ok().flatten() } else { None };
            let scale: Option<u8> = if col_count > 5 { row.try_get::<u8, _>(5).ok().flatten() } else { None };
            let is_nullable: bool = if col_count > 6 { row.try_get::<bool, _>(6).ok().flatten().unwrap_or(true) } else { true };
            let is_identity: bool = if col_count > 7 { row.try_get::<bool, _>(7).ok().flatten().unwrap_or(false) } else { false };
            let column_default: Option<String> = if col_count > 8 { row.try_get::<&str, _>(8).ok().flatten().map(|s| s.to_string()) } else { None };

            // Skip rows where we couldn't get essential data
            if col_name.is_empty() {
                continue;
            }

            columns.push((
                col_name,
                data_type,
                max_length,
                precision,
                scale,
                is_nullable,
                is_identity,
                column_default,
            ));
        }

        for row in pk_result {
            // Check that row has at least 2 columns (__type__ + pk_column)
            if row.columns().len() < 2 {
                continue;
            }
            // pk_column is at index 1 due to __type__ marker at index 0
            if let Some(col_name) = row.try_get::<&str, _>(1).ok().flatten() {
                pk_columns.push(col_name.to_string());
            }
        }

        // If no valid columns, return empty
        if columns.is_empty() {
            return String::new();
        }

        // Build DDL string
        let quoted_table = if schema != "dbo" {
            format!("[{}].[{}]", schema, table)
        } else {
            format!("[{}]", table)
        };

        let mut ddl = format!("CREATE TABLE {} (\n", quoted_table);

        for (i, (col_name, data_type, max_length, precision, scale, is_nullable, is_identity, column_default)) in columns.iter().enumerate() {
            let type_str = format_mssql_type(data_type, *max_length, *precision, *scale);

            ddl.push_str(&format!("    [{}] {}", col_name, type_str));

            if *is_identity {
                ddl.push_str(" IDENTITY(1,1)");
            }

            if !is_nullable {
                ddl.push_str(" NOT NULL");
            }

            if let Some(default) = column_default {
                ddl.push_str(&format!(" DEFAULT {}", default));
            }

            if i < columns.len() - 1 || !pk_columns.is_empty() {
                ddl.push(',');
            }
            ddl.push('\n');
        }

        // Add primary key constraint
        if !pk_columns.is_empty() {
            let pk_cols_quoted: Vec<String> = pk_columns.iter().map(|c| format!("[{}]", c)).collect();
            ddl.push_str(&format!("    PRIMARY KEY ({})\n", pk_cols_quoted.join(", ")));
        }

        ddl.push_str(");");

        ddl
    }
}

/// Convert a tiberius column value to JSON
fn mssql_value_to_json(row: &Row, idx: usize) -> serde_json::Value {
    // Try various types in order using try_get to avoid panics on type mismatch
    // Integer types first (most common for IDs)
    if let Ok(Some(val)) = row.try_get::<i32, _>(idx) {
        return serde_json::Value::Number(val.into());
    }
    if let Ok(Some(val)) = row.try_get::<i64, _>(idx) {
        return serde_json::Value::Number(val.into());
    }
    if let Ok(Some(val)) = row.try_get::<i16, _>(idx) {
        return serde_json::Value::Number(val.into());
    }
    // String types
    if let Ok(Some(val)) = row.try_get::<&str, _>(idx) {
        return serde_json::Value::String(val.to_string());
    }
    // Float types
    if let Ok(Some(val)) = row.try_get::<f32, _>(idx) {
        return serde_json::json!(val);
    }
    if let Ok(Some(val)) = row.try_get::<f64, _>(idx) {
        return serde_json::json!(val);
    }
    // Boolean
    if let Ok(Some(val)) = row.try_get::<bool, _>(idx) {
        return serde_json::Value::Bool(val);
    }
    // Binary data
    if let Ok(Some(val)) = row.try_get::<&[u8], _>(idx) {
        use base64::{Engine as _, engine::general_purpose};
        return serde_json::Value::String(general_purpose::STANDARD.encode(val));
    }
    // DateTime
    if let Ok(Some(val)) = row.try_get::<chrono::NaiveDateTime, _>(idx) {
        return serde_json::Value::String(val.to_string());
    }
    // Numeric/Decimal
    if let Ok(Some(val)) = row.try_get::<tiberius::numeric::Numeric, _>(idx) {
        return serde_json::Value::String(val.to_string());
    }
    // UUID
    if let Ok(Some(val)) = row.try_get::<uuid::Uuid, _>(idx) {
        return serde_json::Value::String(val.to_string());
    }
    // Return null if no type matched or value is NULL
    serde_json::Value::Null
}

#[async_trait]
impl DatabaseDriver for MssqlDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        let connection_string = self.build_connection_string(config);
        let config_parsed = parse_connection_string(&connection_string)?;

        match TcpStream::connect(config_parsed.get_addr())
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to connect to MSSQL server: {}", e)))
        {
            Ok(tcp) => {
                tcp.set_nodelay(true)
                    .map_err(|e| AppError::ConnectionError(format!("Failed to set nodelay: {}", e)))?;

                match Client::connect(config_parsed, tcp.compat_write())
                    .await
                    .map_err(|e| AppError::ConnectionError(format!("MSSQL authentication failed: {}", e)))
                {
                    Ok(mut client) => {
                        // Get server version
                        let version = {
                            let query = Query::new("SELECT @@VERSION");
                            match query.query(&mut client).await {
                                Ok(stream) => {
                                    match stream.into_row().await {
                                        Ok(Some(row)) => row.get::<&str, _>(0).map(|s| s.to_string()),
                                        _ => None,
                                    }
                                }
                                Err(_) => None,
                            }
                        };

                        let _ = client.close().await;

                        Ok(TestConnectionResult {
                            success: true,
                            message: "Connection successful".to_string(),
                            server_version: version,
                        })
                    }
                    Err(e) => Ok(TestConnectionResult {
                        success: false,
                        message: format!("Connection failed: {}", e),
                        server_version: None,
                    }),
                }
            }
            Err(e) => Ok(TestConnectionResult {
                success: false,
                message: format!("Connection failed: {}", e),
                server_version: None,
            }),
        }
    }

    async fn execute_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let start = Instant::now();

        // Split SQL into individual statements
        let statements = Self::split_sql_statements(sql);

        // If there's only one statement, execute it directly
        if statements.len() == 1 {
            let mut client = pool.get().await
                .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;
            return Self::execute_single_query(&mut *client, &statements[0], start).await;
        }

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        // Clean up any leftover transactions and disable implicit transactions
        {
            let cleanup_sql = "SET IMPLICIT_TRANSACTIONS OFF; WHILE @@TRANCOUNT > 0 ROLLBACK TRANSACTION";
            if let Ok(stream) = Query::new(cleanup_sql).query(&mut *client).await {
                let _ = stream.into_results().await;
            }
        }

        // SQL Server supports transactional DDL - unlike MySQL, you CAN roll back
        // CREATE, ALTER, DROP, and TRUNCATE statements within a transaction
        //
        // Build a single batch: SET XACT_ABORT ON; BEGIN TRAN; stmt1; stmt2; ...; COMMIT TRAN
        // This keeps transaction count balanced (0 -> 0) avoiding tiberius error 266
        // XACT_ABORT ON ensures automatic rollback on any error
        let mut batch_sql = String::from("SET XACT_ABORT ON;\nBEGIN TRANSACTION;\n");
        for stmt in &statements {
            batch_sql.push_str(stmt);
            batch_sql.push_str(";\n");
        }
        batch_sql.push_str("COMMIT TRANSACTION;");

        // Execute the entire batch
        let query = Query::new(&batch_sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

        let results = stream.into_results().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        // Find the last result set with data (similar to PostgreSQL behavior)
        let mut final_result = QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(0),
            execution_time_ms: 0,
        };

        for result_set in results.into_iter().rev() {
            if !result_set.is_empty() {
                if let Some(first_row) = result_set.first() {
                    final_result.columns = first_row
                        .columns()
                        .iter()
                        .map(|col| ColumnInfo {
                            name: col.name().to_string(),
                            data_type: format!("{:?}", col.column_type()),
                            nullable: true,
                            is_primary_key: false,
                        })
                        .collect();
                }

                final_result.rows = result_set
                    .iter()
                    .map(|row| {
                        (0..row.columns().len())
                            .map(|idx| mssql_value_to_json(row, idx))
                            .collect()
                    })
                    .collect();

                final_result.affected_rows = None; // Has result set, not affected rows
                break;
            }
        }

        final_result.execution_time_ms = start.elapsed().as_millis() as u64;
        Ok(final_result)
    }

    async fn get_tables(&self, pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        // Filter out system tables and system schemas for better UX
        let sql = r#"
            SELECT
                s.name AS schema_name,
                t.name AS table_name,
                0 AS is_view
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.is_ms_shipped = 0
              AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
              AND t.name NOT LIKE 'spt_%'
              AND t.name NOT LIKE 'MS%'
            UNION ALL
            SELECT
                s.name AS schema_name,
                v.name AS table_name,
                1 AS is_view
            FROM sys.views v
            INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
            WHERE v.is_ms_shipped = 0
              AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
            ORDER BY schema_name, table_name
        "#;

        let query = Query::new(sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get tables: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        let tables = results
            .iter()
            .map(|row| {
                let schema: Option<&str> = row.get(0);
                let name: Option<&str> = row.get(1);
                let is_view: Option<i32> = row.get(2);

                TableInfo {
                    name: name.unwrap_or("").to_string(),
                    schema: schema.map(|s| s.to_string()),
                    table_type: if is_view.unwrap_or(0) == 1 {
                        "VIEW".to_string()
                    } else {
                        "TABLE".to_string()
                    },
                    row_count: None,
                }
            })
            .collect();

        Ok(tables)
    }

    async fn get_table_schema(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableSchema> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // Parse table name which can be:
        // - "table" -> schema=dbo, table=table
        // - "schema.table" -> schema=schema, table=table
        // - "database.schema.table" -> schema=schema, table=table (ignore database)
        let (schema_name, table) = {
            let parts: Vec<&str> = table_name.split('.').collect();
            match parts.len() {
                1 => ("dbo", parts[0]),
                2 => (parts[0], parts[1]),
                3 | _ => (parts[1], parts[2]), // database.schema.table -> use schema.table
            }
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        let sql = format!(
            r#"
            SELECT
                c.name AS column_name,
                t.name AS data_type,
                c.max_length,
                c.precision,
                c.scale,
                c.is_nullable,
                CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key,
                c.is_identity
            FROM sys.columns c
            INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
            INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
            INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
            LEFT JOIN (
                SELECT ic.object_id, ic.column_id
                FROM sys.index_columns ic
                INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                WHERE i.is_primary_key = 1
            ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
            WHERE tbl.name = '{}' AND s.name = '{}'
            ORDER BY c.column_id
            "#,
            table, schema_name
        );

        let query = Query::new(&sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get table schema: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        let mut primary_keys = Vec::new();
        let columns: Vec<ColumnInfo> = results
            .iter()
            .map(|row| {
                let name: Option<&str> = row.get(0);
                let data_type: Option<&str> = row.get(1);
                let max_length: Option<i16> = row.get(2);
                let precision: Option<u8> = row.get(3);
                let scale: Option<u8> = row.get(4);
                let is_nullable: Option<bool> = row.get(5);
                let is_pk: Option<i32> = row.get(6);
                let is_identity: Option<bool> = row.get(7);

                let col_name = name.unwrap_or("").to_string();
                let is_primary = is_pk.unwrap_or(0) == 1;

                if is_primary {
                    primary_keys.push(col_name.clone());
                }

                let mut type_str = format_mssql_type(
                    data_type.unwrap_or(""),
                    max_length,
                    precision,
                    scale,
                );

                // Append IDENTITY to type string for auto-increment columns
                // This enables frontend auto-increment detection via dataType.includes("identity")
                if is_identity.unwrap_or(false) {
                    type_str.push_str(" IDENTITY");
                }

                ColumnInfo {
                    name: col_name,
                    data_type: type_str,
                    nullable: is_nullable.unwrap_or(true),
                    is_primary_key: is_primary,
                }
            })
            .collect();

        // Get foreign keys
        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        let fk_sql = format!(
            r#"
            SELECT
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
                OBJECT_SCHEMA_NAME(fkc.referenced_object_id) + '.' + OBJECT_NAME(fkc.referenced_object_id) AS ref_table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ref_column
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name = '{}' AND s.name = '{}'
            "#,
            table, schema_name
        );

        let query = Query::new(&fk_sql);
        let fk_results = match query.query(&mut *client).await {
            Ok(stream) => stream.into_first_result().await.unwrap_or_default(),
            Err(_) => Vec::new(),
        };

        let foreign_keys: Vec<ForeignKeyInfo> = fk_results
            .iter()
            .map(|row| {
                let column: Option<&str> = row.get(0);
                let ref_table: Option<&str> = row.get(1);
                let ref_column: Option<&str> = row.get(2);

                ForeignKeyInfo {
                    column: column.unwrap_or("").to_string(),
                    references_table: ref_table.unwrap_or("").to_string(),
                    references_column: ref_column.unwrap_or("").to_string(),
                }
            })
            .collect();

        Ok(TableSchema {
            table_name: table_name.to_string(),
            columns,
            primary_keys,
            foreign_keys,
        })
    }

    async fn get_all_table_schemas(&self, pool: PoolRef<'_>, config: &ConnectionConfig) -> AppResult<Vec<TableSchema>> {
        let tables = self.get_tables(pool.clone(), config).await?;
        let mut schemas = Vec::new();

        for table in tables {
            let full_name = if let Some(schema) = &table.schema {
                format!("{}.{}", schema, table.name)
            } else {
                table.name.clone()
            };

            match self.get_table_schema(pool.clone(), &full_name).await {
                Ok(schema) => schemas.push(schema),
                Err(_) => continue,
            }
        }

        Ok(schemas)
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        let host = config.host.as_deref().unwrap_or("localhost");
        let port = config.port.unwrap_or(1433);
        let username = config.username.as_deref().unwrap_or("sa");
        let password = config.password.as_deref().unwrap_or("");

        format!(
            "Server=tcp:{},{};Database={};User Id={};Password={};TrustServerCertificate=true",
            host, port, config.database, username, password
        )
    }

    async fn generate_table_ddl(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<String> {
        let schema = self.get_table_schema(pool, table_name).await?;

        // Parse table name which can be:
        // - "table" -> schema=dbo, table=table
        // - "schema.table" -> schema=schema, table=table
        // - "database.schema.table" -> schema=schema, table=table (ignore database)
        let (schema_name, table) = {
            let parts: Vec<&str> = table_name.split('.').collect();
            match parts.len() {
                1 => ("dbo", parts[0]),
                2 => (parts[0], parts[1]),
                3 | _ => (parts[1], parts[2]), // database.schema.table -> use schema.table
            }
        };

        let mut ddl = format!("CREATE TABLE [{}].[{}] (\n", schema_name, table);

        for (i, col) in schema.columns.iter().enumerate() {
            ddl.push_str(&format!("    [{}] {}", col.name, col.data_type));

            if !col.nullable {
                ddl.push_str(" NOT NULL");
            }

            if i < schema.columns.len() - 1 || !schema.primary_keys.is_empty() {
                ddl.push(',');
            }
            ddl.push('\n');
        }

        if !schema.primary_keys.is_empty() {
            let pk_cols: Vec<String> = schema.primary_keys.iter().map(|c| format!("[{}]", c)).collect();
            ddl.push_str(&format!(
                "    CONSTRAINT [PK_{}] PRIMARY KEY ({})\n",
                table,
                pk_cols.join(", ")
            ));
        }

        ddl.push_str(");\n");

        Ok(ddl)
    }

    async fn rename_table(&self, pool: PoolRef<'_>, old_name: &str, new_name: &str) -> AppResult<QueryResult> {
        let sql = format!("EXEC sp_rename '{}', '{}'", old_name, new_name);
        self.execute_query(pool, &sql).await
    }

    async fn get_indexes(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<IndexInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // Parse table name which can be:
        // - "table" -> schema=dbo, table=table
        // - "schema.table" -> schema=schema, table=table
        // - "database.schema.table" -> schema=schema, table=table (ignore database)
        let (schema_name, table) = {
            let parts: Vec<&str> = table_name.split('.').collect();
            match parts.len() {
                1 => ("dbo", parts[0]),
                2 => (parts[0], parts[1]),
                3 | _ => (parts[1], parts[2]), // database.schema.table -> use schema.table
            }
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        let sql = format!(
            r#"
            SELECT
                i.name AS index_name,
                i.is_unique,
                i.is_primary_key,
                STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            INNER JOIN sys.tables t ON i.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name = '{}' AND s.name = '{}' AND i.name IS NOT NULL
            GROUP BY i.name, i.is_unique, i.is_primary_key
            "#,
            table, schema_name
        );

        let query = Query::new(&sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get indexes: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        let indexes = results
            .iter()
            .map(|row| {
                let name: Option<&str> = row.get(0);
                let is_unique: Option<bool> = row.get(1);
                let is_pk: Option<bool> = row.get(2);
                let columns: Option<&str> = row.get(3);

                IndexInfo {
                    name: name.unwrap_or("").to_string(),
                    columns: columns
                        .unwrap_or("")
                        .split(", ")
                        .map(|s| s.to_string())
                        .collect(),
                    is_unique: is_unique.unwrap_or(false),
                    is_primary: is_pk.unwrap_or(false),
                }
            })
            .collect();

        Ok(indexes)
    }

    async fn get_constraints(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<ConstraintInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // Parse table name which can be:
        // - "table" -> schema=dbo, table=table
        // - "schema.table" -> schema=schema, table=table
        // - "database.schema.table" -> schema=schema, table=table (ignore database)
        let (schema_name, table) = {
            let parts: Vec<&str> = table_name.split('.').collect();
            match parts.len() {
                1 => ("dbo", parts[0]),
                2 => (parts[0], parts[1]),
                3 | _ => (parts[1], parts[2]), // database.schema.table -> use schema.table
            }
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        let sql = format!(
            r#"
            SELECT
                cc.name AS constraint_name,
                'CHECK' AS constraint_type,
                cc.definition AS definition
            FROM sys.check_constraints cc
            INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name = '{}' AND s.name = '{}'
            "#,
            table, schema_name
        );

        let query = Query::new(&sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get constraints: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        let constraints = results
            .iter()
            .map(|row| {
                let name: Option<&str> = row.get(0);
                let ctype: Option<&str> = row.get(1);
                let definition: Option<&str> = row.get(2);

                ConstraintInfo {
                    name: name.unwrap_or("").to_string(),
                    constraint_type: ctype.unwrap_or("").to_string(),
                    definition: definition.unwrap_or("").to_string(),
                }
            })
            .collect();

        Ok(constraints)
    }

    async fn get_table_properties(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableProperties> {
        let schema = self.get_table_schema(pool.clone(), table_name).await?;
        let indexes = self.get_indexes(pool.clone(), table_name).await?;
        let constraints = self.get_constraints(pool, table_name).await?;

        let (schema_name, _table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (Some(parts[0].to_string()), parts[1])
        } else {
            (Some("dbo".to_string()), table_name)
        };

        // Convert columns to extended format
        let extended_columns: Vec<ExtendedColumnInfo> = schema
            .columns
            .iter()
            .map(|c| ExtendedColumnInfo {
                name: c.name.clone(),
                data_type: c.data_type.clone(),
                nullable: c.nullable,
                is_primary_key: c.is_primary_key,
                default_value: None,
                comment: None,
            })
            .collect();

        Ok(TableProperties {
            table_name: table_name.to_string(),
            schema: schema_name,
            columns: extended_columns,
            primary_keys: schema.primary_keys,
            foreign_keys: schema.foreign_keys,
            indexes,
            constraints,
            row_count: None,
            table_comment: None,
        })
    }

    async fn get_table_relationships(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<TableRelationship>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // Parse table name which can be:
        // - "table" -> schema=dbo, table=table
        // - "schema.table" -> schema=schema, table=table
        // - "database.schema.table" -> schema=schema, table=table (ignore database)
        let (schema_name, table) = {
            let parts: Vec<&str> = table_name.split('.').collect();
            match parts.len() {
                1 => ("dbo", parts[0]),
                2 => (parts[0], parts[1]),
                3 | _ => (parts[1], parts[2]), // database.schema.table -> use schema.table
            }
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        let mut relationships = Vec::new();
        let sql = format!(
            r#"
            -- Outgoing relationships (this table references others)
            SELECT
                fk.name AS fk_name,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS source_column,
                OBJECT_SCHEMA_NAME(fkc.referenced_object_id) + '.' + OBJECT_NAME(fkc.referenced_object_id) AS target_table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS target_column,
                'outgoing' AS direction
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name = '{}' AND s.name = '{}'
            UNION ALL
            -- Incoming relationships (other tables reference this one)
            SELECT
                fk.name AS fk_name,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS source_column,
                OBJECT_SCHEMA_NAME(fkc.parent_object_id) + '.' + OBJECT_NAME(fkc.parent_object_id) AS target_table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS target_column,
                'incoming' AS direction
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables t ON fk.referenced_object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name = '{}' AND s.name = '{}'
            "#,
            table, schema_name, table, schema_name
        );

        let query = Query::new(&sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get relationships: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        for row in results {
            let fk_name: Option<&str> = row.get(0);
            let source_column: Option<&str> = row.get(1);
            let target_table_val: Option<&str> = row.get(2);
            let target_column: Option<&str> = row.get(3);
            let direction: Option<&str> = row.get(4);

            let is_outgoing = direction.unwrap_or("") == "outgoing";

            relationships.push(TableRelationship {
                source_table: if is_outgoing { table_name.to_string() } else { target_table_val.unwrap_or("").to_string() },
                source_column: source_column.unwrap_or("").to_string(),
                target_table: if is_outgoing { target_table_val.unwrap_or("").to_string() } else { table_name.to_string() },
                target_column: target_column.unwrap_or("").to_string(),
                constraint_name: fk_name.map(|s| s.to_string()),
            });
        }

        Ok(relationships)
    }

    async fn preview_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<PreviewResult> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let start = Instant::now();
        let statements = Self::split_sql_statements(sql);

        if statements.is_empty() {
            return Ok(PreviewResult {
                statements: vec![],
                execution_time_ms: 0,
                success: true,
                error: None,
                warning: None,
            });
        }

        // SQL Server supports transactional DDL - we can preview and roll back
        // CREATE, ALTER, DROP, and TRUNCATE statements (unlike MySQL)
        //
        // IMPORTANT: With tiberius, transaction control statements must be in the same batch.
        // We build ONE unified batch containing all statements with schema capture queries
        // interspersed for DDL statements. This ensures dependent statements work correctly
        // (e.g., ALTER TABLE after CREATE TABLE).
        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        // Clean up any leftover transactions and disable implicit transactions
        {
            let cleanup_sql = "SET IMPLICIT_TRANSACTIONS OFF; WHILE @@TRANCOUNT > 0 ROLLBACK TRANSACTION";
            if let Ok(stream) = Query::new(cleanup_sql).query(&mut *client).await {
                let _ = stream.into_results().await;
            }
        }

        // Analyze statements and build the unified batch
        let mut statement_info: Vec<(String, StatementType, Option<String>)> = Vec::new();
        for stmt in &statements {
            let stmt_type = Self::detect_statement_type(stmt);
            let table_name = Self::extract_table_name(stmt);
            statement_info.push((stmt.clone(), stmt_type, table_name));
        }

        // Build ONE unified batch with all statements
        // Each schema result set includes a __type__ marker column for reliable identification
        // Structure:
        // - BEGIN TRANSACTION
        // - For each DDL: schema_before queries, execute DDL, schema_after queries
        // - For each DML: execute with OUTPUT
        // - ROLLBACK TRANSACTION
        let mut batch_sql = String::from("SET XACT_ABORT OFF;\nBEGIN TRANSACTION;\n");

        for (idx, (stmt, stmt_type, table_name)) in statement_info.iter().enumerate() {
            match stmt_type {
                StatementType::Ddl => {
                    // Query schema before (returns empty if table doesn't exist)
                    if let Some(ref name) = table_name {
                        let (schema, table) = Self::parse_table_name(name);
                        let marker_before = format!("SCHEMA_BEFORE_{}", idx);
                        let marker_before_pk = format!("SCHEMA_BEFORE_PK_{}", idx);
                        
                        // Columns query with marker
                        batch_sql.push_str(&format!(
                            r#"SELECT '{}' AS __type__, c.name, t.name AS type_name, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity, OBJECT_DEFINITION(c.default_object_id) AS col_default
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
WHERE s.name = '{}' AND tbl.name = '{}'
ORDER BY c.column_id;
"#,
                            marker_before,
                            schema.replace("'", "''"),
                            table.replace("'", "''")
                        ));
                        
                        // PK query with marker
                        batch_sql.push_str(&format!(
                            r#"SELECT '{}' AS __type__, c.name AS pk_column
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables tbl ON i.object_id = tbl.object_id
INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
WHERE i.is_primary_key = 1 AND s.name = '{}' AND tbl.name = '{}'
ORDER BY ic.key_ordinal;
"#,
                            marker_before_pk,
                            schema.replace("'", "''"),
                            table.replace("'", "''")
                        ));
                    }

                    // Execute DDL
                    batch_sql.push_str(&format!("{};\n", stmt.trim().trim_end_matches(';')));

                    // Query schema after
                    if let Some(ref name) = table_name {
                        let (schema, table) = Self::parse_table_name(name);
                        let marker_after = format!("SCHEMA_AFTER_{}", idx);
                        let marker_after_pk = format!("SCHEMA_AFTER_PK_{}", idx);
                        
                        // Columns query with marker
                        batch_sql.push_str(&format!(
                            r#"SELECT '{}' AS __type__, c.name, t.name AS type_name, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity, OBJECT_DEFINITION(c.default_object_id) AS col_default
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
WHERE s.name = '{}' AND tbl.name = '{}'
ORDER BY c.column_id;
"#,
                            marker_after,
                            schema.replace("'", "''"),
                            table.replace("'", "''")
                        ));
                        
                        // PK query with marker
                        batch_sql.push_str(&format!(
                            r#"SELECT '{}' AS __type__, c.name AS pk_column
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables tbl ON i.object_id = tbl.object_id
INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
WHERE i.is_primary_key = 1 AND s.name = '{}' AND tbl.name = '{}'
ORDER BY ic.key_ordinal;
"#,
                            marker_after_pk,
                            schema.replace("'", "''"),
                            table.replace("'", "''")
                        ));
                    }
                }
                StatementType::Dml => {
                    // Execute DML with OUTPUT clause
                    let sql_with_output = if stmt.to_uppercase().contains(" OUTPUT ") {
                        stmt.trim().trim_end_matches(';').to_string()
                    } else {
                        Self::add_output_clause(stmt)
                    };
                    batch_sql.push_str(&format!("{};\n", sql_with_output));
                }
                StatementType::Select | StatementType::Other => {
                    // Just execute without capturing results
                    batch_sql.push_str(&format!("{};\n", stmt.trim().trim_end_matches(';')));
                }
            }
        }

        batch_sql.push_str("ROLLBACK TRANSACTION;");

        // Execute the unified batch
        let query = Query::new(&batch_sql);
        let stream = match query.query(&mut *client).await {
            Ok(s) => s,
            Err(e) => {
                return Ok(PreviewResult {
                    statements: vec![],
                    execution_time_ms: start.elapsed().as_millis() as u64,
                    success: false,
                    error: Some(format!("Preview execution failed: {}", e)),
                    warning: None,
                });
            }
        };

        let results = match stream.into_results().await {
            Ok(r) => r,
            Err(e) => {
                return Ok(PreviewResult {
                    statements: vec![],
                    execution_time_ms: start.elapsed().as_millis() as u64,
                    success: false,
                    error: Some(format!("Failed to fetch preview results: {}", e)),
                    warning: None,
                });
            }
        };

        // Parse results and build previews
        let mut previews: Vec<StatementPreview> = vec![StatementPreview {
            statement_type: StatementType::Other,
            sql: String::new(),
            schema_before: None,
            schema_after: None,
            affected_rows: None,
            affected_columns: None,
            row_count: 0,
            table_name: None,
        }; statement_info.len()];

        // Initialize previews with basic info
        for (idx, (stmt, stmt_type, table_name)) in statement_info.iter().enumerate() {
            previews[idx] = StatementPreview {
                statement_type: stmt_type.clone(),
                sql: stmt.clone(),
                schema_before: None,
                schema_after: None,
                affected_rows: None,
                affected_columns: None,
                row_count: 0,
                table_name: table_name.clone(),
            };
        }

        // Parse result sets using marker-based identification
        // Schema results have __type__ column, DML results don't
        // Store indices into results array for later lookup
        let mut schema_cols_idx: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        let mut schema_pks_idx: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        let mut dml_result_indices: Vec<usize> = Vec::new();

        for (result_idx, result) in results.iter().enumerate() {
            // Check if this result has __type__ column (schema result)
            let has_type_col = result.first()
                .map(|row| row.columns().first().map(|c| c.name() == "__type__").unwrap_or(false))
                .unwrap_or(false);

            if has_type_col && !result.is_empty() {
                // Get the marker from the first row's __type__ column
                if let Some(first_row) = result.first() {
                    if let Ok(Some(marker)) = first_row.try_get::<&str, _>(0) {
                        if marker.starts_with("SCHEMA_BEFORE_PK_") || marker.starts_with("SCHEMA_AFTER_PK_") {
                            schema_pks_idx.insert(marker.to_string(), result_idx);
                        } else if marker.starts_with("SCHEMA_BEFORE_") || marker.starts_with("SCHEMA_AFTER_") {
                            schema_cols_idx.insert(marker.to_string(), result_idx);
                        }
                    }
                }
            } else if !has_type_col && !result.is_empty() {
                // DML result (no __type__ column and has data)
                dml_result_indices.push(result_idx);
            }
        }

        // Build schema DDL from collected results
        for (idx, (_, stmt_type, table_name)) in statement_info.iter().enumerate() {
            if *stmt_type == StatementType::Ddl {
                if let Some(ref name) = table_name {
                    // Schema before
                    let before_marker = format!("SCHEMA_BEFORE_{}", idx);
                    let before_pk_marker = format!("SCHEMA_BEFORE_PK_{}", idx);
                    let cols_before = schema_cols_idx.get(&before_marker)
                        .map(|&i| results[i].as_slice())
                        .unwrap_or(&[]);
                    let pk_before = schema_pks_idx.get(&before_pk_marker)
                        .map(|&i| results[i].as_slice())
                        .unwrap_or(&[]);
                    let ddl_before = Self::build_ddl_from_results_with_marker(name, cols_before, pk_before);
                    if !ddl_before.is_empty() {
                        previews[idx].schema_before = Some(ddl_before);
                    }

                    // Schema after
                    let after_marker = format!("SCHEMA_AFTER_{}", idx);
                    let after_pk_marker = format!("SCHEMA_AFTER_PK_{}", idx);
                    let cols_after = schema_cols_idx.get(&after_marker)
                        .map(|&i| results[i].as_slice())
                        .unwrap_or(&[]);
                    let pk_after = schema_pks_idx.get(&after_pk_marker)
                        .map(|&i| results[i].as_slice())
                        .unwrap_or(&[]);
                    let ddl_after = Self::build_ddl_from_results_with_marker(name, cols_after, pk_after);
                    if !ddl_after.is_empty() {
                        previews[idx].schema_after = Some(ddl_after);
                    }
                }
            }
        }

        // Assign DML results to DML statements in order
        let mut dml_idx = 0;
        for (idx, (_, stmt_type, _)) in statement_info.iter().enumerate() {
            if *stmt_type == StatementType::Dml {
                if dml_idx < dml_result_indices.len() {
                    let dml_result = &results[dml_result_indices[dml_idx]];
                    dml_idx += 1;

                    let mut columns: Vec<ColumnInfo> = Vec::new();
                    let mut rows_data: Vec<Vec<serde_json::Value>> = Vec::new();

                    if !dml_result.is_empty() {
                        if let Some(first_row) = dml_result.first() {
                            columns = first_row
                                .columns()
                                .iter()
                                .map(|col| ColumnInfo {
                                    name: col.name().to_string(),
                                    data_type: format!("{:?}", col.column_type()),
                                    nullable: true,
                                    is_primary_key: false,
                                })
                                .collect();
                        }

                        for row in dml_result {
                            let mut row_values = Vec::new();
                            for col_idx in 0..row.columns().len() {
                                row_values.push(mssql_value_to_json(row, col_idx));
                            }
                            rows_data.push(row_values);
                        }
                    }

                    let row_count = rows_data.len() as u64;
                    previews[idx].affected_rows = Some(rows_data);
                    previews[idx].affected_columns = Some(columns);
                    previews[idx].row_count = row_count;
                }
            }
        }

        Ok(PreviewResult {
            statements: previews,
            execution_time_ms: start.elapsed().as_millis() as u64,
            success: true,
            error: None,
            warning: None,
        })
    }

    async fn explain_query(&self, pool: PoolRef<'_>, sql: &str, _analyze: bool) -> AppResult<ExplainResult> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL driver".to_string())),
        };

        // Get a connection from the pool
        let mut conn = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get MSSQL connection: {}", e)))?;

        // Use SET STATISTICS XML ON which executes the query AND returns the execution plan
        // This is more reliable than SHOWPLAN_XML with connection pooling
        // The plan is returned as an additional result set after query results
        let combined_sql = format!(
            "SET STATISTICS XML ON; {} SET STATISTICS XML OFF;",
            sql.trim().trim_end_matches(';')
        );

        let stream = Query::new(&combined_sql)
            .query(&mut *conn)
            .await
            .map_err(|e| AppError::QueryError(format!("EXPLAIN failed: {}", e)))?;

        let results = stream.into_results().await
            .map_err(|e| AppError::QueryError(format!("Failed to get plan results: {}", e)))?;

        // STATISTICS XML returns: 1) query results, 2) XML plan for each statement
        // Find the XML plan in the result sets (it's the one that looks like XML)
        let mut raw_output = String::new();
        for result_set in &results {
            for row in result_set {
                if let Ok(Some(text)) = row.try_get::<&str, _>(0) {
                    // Check if this looks like XML (the execution plan)
                    let trimmed = text.trim();
                    if trimmed.starts_with('<') && trimmed.contains("ShowPlanXML") {
                        raw_output = text.to_string();
                        break;
                    }
                }
            }
            if !raw_output.is_empty() {
                break;
            }
        }

        // Parse the XML plan into a tree structure
        let (plan_node, total_cost, warnings) = Self::parse_mssql_plan_xml(&raw_output);

        Ok(ExplainResult {
            plan: plan_node,
            planning_time: None,
            execution_time: None,
            total_cost,
            warnings,
            raw_output,
            database_type: "mssql".to_string(),
        })
    }

    fn generate_create_table_ddl(&self, table_def: &NewTableDefinition) -> AppResult<String> {
        let mut ddl = String::new();
        let db_type = DatabaseType::MSSQL;

        // MSSQL uses brackets for quoting - properly escape identifiers
        let table_name = if let Some(ref schema) = table_def.schema {
            format!(
                "{}.{}",
                quote_identifier_single(schema, &db_type),
                quote_identifier_single(&table_def.name, &db_type)
            )
        } else {
            quote_identifier_single(&table_def.name, &db_type)
        };

        ddl.push_str(&format!("CREATE TABLE {} (\n", table_name));

        // Column definitions
        let mut column_defs = Vec::new();
        for col in &table_def.columns {
            let mut col_def = format!("    {}", quote_identifier_single(&col.name, &db_type));

            // Regular type with optional length/precision
            let type_str = if let Some(length) = col.length {
                format!("{}({})", col.data_type, length)
            } else if let (Some(precision), Some(scale)) = (col.precision, col.scale) {
                format!("{}({},{})", col.data_type, precision, scale)
            } else if let Some(precision) = col.precision {
                format!("{}({})", col.data_type, precision)
            } else {
                col.data_type.clone()
            };
            col_def.push_str(&format!(" {}", type_str));

            // IDENTITY for auto-increment
            if col.is_auto_increment {
                col_def.push_str(" IDENTITY(1,1)");
            }

            // NOT NULL constraint
            if !col.nullable {
                col_def.push_str(" NOT NULL");
            } else {
                col_def.push_str(" NULL");
            }

            // DEFAULT value
            if let Some(ref default) = col.default_value {
                col_def.push_str(&format!(" DEFAULT {}", default));
            }

            // UNIQUE constraint (inline)
            if col.is_unique && !col.is_primary_key {
                col_def.push_str(" UNIQUE");
            }

            column_defs.push(col_def);
        }

        // Primary key constraint
        if !table_def.primary_key_columns.is_empty() {
            let pk_cols: Vec<String> = table_def.primary_key_columns.iter()
                .map(|c| quote_identifier_single(c, &db_type))
                .collect();
            column_defs.push(format!("    PRIMARY KEY ({})", pk_cols.join(", ")));
        }

        // Foreign key constraints
        for fk in &table_def.foreign_keys {
            let src_cols: Vec<String> = fk.columns.iter().map(|c| quote_identifier_single(c, &db_type)).collect();
            let ref_cols: Vec<String> = fk.references_columns.iter().map(|c| quote_identifier_single(c, &db_type)).collect();

            let mut fk_def = String::new();
            if let Some(ref name) = fk.name {
                fk_def.push_str(&format!("    CONSTRAINT {} ", quote_identifier_single(name, &db_type)));
            } else {
                fk_def.push_str("    ");
            }
            // Quote the references table (handle schema.table format)
            let ref_table = quote_identifier(&fk.references_table, &db_type);
            fk_def.push_str(&format!(
                "FOREIGN KEY ({}) REFERENCES {} ({})",
                src_cols.join(", "),
                ref_table,
                ref_cols.join(", ")
            ));

            if let Some(ref action) = fk.on_delete {
                fk_def.push_str(&format!(" ON DELETE {}", action.to_sql()));
            }
            if let Some(ref action) = fk.on_update {
                fk_def.push_str(&format!(" ON UPDATE {}", action.to_sql()));
            }

            column_defs.push(fk_def);
        }

        // Check constraints
        for check in &table_def.check_constraints {
            let check_def = if let Some(ref name) = check.name {
                format!("    CONSTRAINT {} CHECK ({})", quote_identifier_single(name, &db_type), check.expression)
            } else {
                format!("    CHECK ({})", check.expression)
            };
            column_defs.push(check_def);
        }

        ddl.push_str(&column_defs.join(",\n"));
        ddl.push_str("\n);\n");

        // Create indexes (separate statements)
        for idx in &table_def.indexes {
            let idx_cols: Vec<String> = idx.columns.iter().map(|c| quote_identifier_single(c, &db_type)).collect();
            let unique_str = if idx.is_unique { "UNIQUE " } else { "" };
            let idx_name = idx.name.clone().unwrap_or_else(|| {
                format!("idx_{}_{}", table_def.name, idx.columns.join("_"))
            });
            ddl.push_str(&format!(
                "\nCREATE {}INDEX {} ON {} ({});",
                unique_str,
                quote_identifier_single(&idx_name, &db_type),
                table_name,
                idx_cols.join(", ")
            ));
        }

        // Add table description via extended property
        if let Some(ref comment) = table_def.comment {
            let schema = table_def.schema.as_deref().unwrap_or("dbo");
            ddl.push_str(&format!(
                "\n\nEXEC sp_addextendedproperty @name=N'MS_Description', @value=N'{}', @level0type=N'SCHEMA', @level0name=N'{}', @level1type=N'TABLE', @level1name=N'{}';",
                comment.replace('\'', "''"),
                schema.replace('\'', "''"),
                table_def.name.replace('\'', "''")
            ));
        }

        // Add column descriptions via extended property
        for col in &table_def.columns {
            if let Some(ref comment) = col.comment {
                let schema = table_def.schema.as_deref().unwrap_or("dbo");
                ddl.push_str(&format!(
                    "\nEXEC sp_addextendedproperty @name=N'MS_Description', @value=N'{}', @level0type=N'SCHEMA', @level0name=N'{}', @level1type=N'TABLE', @level1name=N'{}', @level2type=N'COLUMN', @level2name=N'{}';",
                    comment.replace('\'', "''"),
                    schema.replace('\'', "''"),
                    table_def.name.replace('\'', "''"),
                    col.name.replace('\'', "''")
                ));
            }
        }

        Ok(ddl)
    }

    async fn get_referenceable_tables(&self, pool: PoolRef<'_>) -> AppResult<Vec<TableReferenceInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL driver".to_string())),
        };

        // Query to get all tables with their primary key columns
        let query = r#"
            SELECT
                s.name AS table_schema,
                t.name AS table_name,
                c.name AS column_name,
                ty.name AS data_type,
                c.is_nullable
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.indexes i ON t.object_id = i.object_id AND i.is_primary_key = 1
            LEFT JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            LEFT JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            LEFT JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            ORDER BY s.name, t.name, ic.key_ordinal
        "#;

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let stream = Query::new(query).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get referenceable tables: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        // Group by table
        let mut tables: HashMap<(String, String), Vec<ColumnInfo>> = HashMap::new();

        for row in results {
            let schema: &str = row.get(0).unwrap_or("");
            let table: &str = row.get(1).unwrap_or("");
            let key = (schema.to_string(), table.to_string());

            // Only add if there's a primary key column
            let col_name: Option<&str> = row.get(2);
            if let Some(col_name) = col_name {
                let data_type: &str = row.get(3).unwrap_or("unknown");
                let is_nullable: bool = row.get(4).unwrap_or(true);

                let pk_columns = tables.entry(key).or_insert_with(Vec::new);
                pk_columns.push(ColumnInfo {
                    name: col_name.to_string(),
                    data_type: data_type.to_string(),
                    nullable: is_nullable,
                    is_primary_key: true,
                });
            } else {
                // Table exists but has no primary key - still include it
                tables.entry(key).or_insert_with(Vec::new);
            }
        }

        let result: Vec<TableReferenceInfo> = tables
            .into_iter()
            .map(|((schema, table), pk_columns)| TableReferenceInfo {
                table_name: table,
                schema: Some(schema),
                primary_key_columns: pk_columns,
            })
            .collect();

        Ok(result)
    }

    // ============ User Management Methods ============

    async fn get_users(&self, pool: PoolRef<'_>) -> AppResult<Vec<DatabaseUser>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // Query server logins (which can actually log in and have passwords)
        // rather than database users (which are just mappings)
        let query = r#"
            SELECT
                sp.name,
                CASE WHEN sp.type = 'S' THEN 1 ELSE 0 END as is_sql_login,
                CASE WHEN IS_SRVROLEMEMBER('sysadmin', sp.name) = 1 THEN 1 ELSE 0 END as is_superuser,
                sp.is_disabled,
                STUFF((
                    SELECT ',' + r.name
                    FROM sys.server_role_members srm
                    JOIN sys.server_principals r ON srm.role_principal_id = r.principal_id
                    WHERE srm.member_principal_id = sp.principal_id
                    FOR XML PATH('')
                ), 1, 1, '') as roles
            FROM sys.server_principals sp
            WHERE sp.type IN ('S', 'U', 'G')
                AND sp.name NOT LIKE '##%'
                AND sp.name NOT LIKE 'NT %'
                AND sp.name NOT IN ('sa')
                AND sp.is_disabled = 0
            ORDER BY sp.name
        "#;

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let stream = Query::new(query).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get users: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch users: {}", e)))?;

        let users = results
            .iter()
            .map(|row| {
                let roles_str: Option<&str> = row.get(4);
                let roles: Vec<String> = roles_str
                    .map(|s| s.split(',').map(|r| r.to_string()).collect())
                    .unwrap_or_default();
                let is_disabled: bool = row.get::<bool, _>(3).unwrap_or(false);
                DatabaseUser {
                    name: row.get::<&str, _>(0).unwrap_or("").to_string(),
                    host: None,
                    is_superuser: row.get::<i32, _>(2).unwrap_or(0) == 1,
                    can_login: !is_disabled,
                    roles,
                }
            })
            .collect();

        Ok(users)
    }

    async fn create_user(&self, pool: PoolRef<'_>, request: &CreateUserRequest) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        if request.username.is_empty() {
            return Err(AppError::ValidationError("Username cannot be empty".to_string()));
        }

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        // Create login first (server level)
        let create_login = format!(
            "CREATE LOGIN [{}] WITH PASSWORD = N'{}'",
            request.username.replace(']', "]]"),
            request.password.replace('\'', "''")
        );

        Query::new(&create_login).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to create login: {}", e)))?;

        // Create user in current database
        let create_user = format!(
            "CREATE USER [{}] FOR LOGIN [{}]",
            request.username.replace(']', "]]"),
            request.username.replace(']', "]]")
        );

        Query::new(&create_user).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to create user: {}", e)))?;

        Ok(())
    }

    async fn delete_user(
        &self,
        pool: PoolRef<'_>,
        username: &str,
        _host: Option<&str>,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        // Drop user from database
        let drop_user = format!(
            "IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'{}') DROP USER [{}]",
            username.replace('\'', "''"),
            username.replace(']', "]]")
        );

        Query::new(&drop_user).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to drop user: {}", e)))?;

        // Drop login from server (only if no other users depend on it)
        let drop_login = format!(
            "IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'{}') DROP LOGIN [{}]",
            username.replace('\'', "''"),
            username.replace(']', "]]")
        );

        // Ignore errors on login drop since the user might still exist in other databases
        let _ = Query::new(&drop_login).execute(&mut *client).await;

        Ok(())
    }

    async fn change_password(
        &self,
        pool: PoolRef<'_>,
        request: &ChangePasswordRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(
            "ALTER LOGIN [{}] WITH PASSWORD = N'{}'",
            request.username.replace(']', "]]"),
            request.new_password.replace('\'', "''")
        );

        Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to change password: {}", e)))?;

        Ok(())
    }

    async fn get_roles(&self, pool: PoolRef<'_>) -> AppResult<Vec<DatabaseRole>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let query = r#"
            SELECT
                dp.name,
                dp.is_fixed_role as is_system_role,
                STUFF((
                    SELECT ',' + m.name
                    FROM sys.database_role_members drm
                    JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
                    WHERE drm.role_principal_id = dp.principal_id
                    FOR XML PATH('')
                ), 1, 1, '') as members
            FROM sys.database_principals dp
            WHERE dp.type = 'R'
                AND dp.name NOT IN ('public')
            ORDER BY dp.name
        "#;

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let stream = Query::new(query).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get roles: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch roles: {}", e)))?;

        let roles = results
            .iter()
            .map(|row| {
                let members_str: Option<&str> = row.get(2);
                let members: Vec<String> = members_str
                    .map(|s| s.split(',').map(|r| r.to_string()).collect())
                    .unwrap_or_default();
                DatabaseRole {
                    name: row.get::<&str, _>(0).unwrap_or("").to_string(),
                    is_system_role: row.get::<bool, _>(1).unwrap_or(false),
                    members,
                }
            })
            .collect();

        Ok(roles)
    }

    async fn create_role(&self, pool: PoolRef<'_>, request: &CreateRoleRequest) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        if request.role_name.is_empty() {
            return Err(AppError::ValidationError("Role name cannot be empty".to_string()));
        }

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(
            "CREATE ROLE [{}]",
            request.role_name.replace(']', "]]")
        );

        Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to create role: {}", e)))?;

        Ok(())
    }

    async fn delete_role(&self, pool: PoolRef<'_>, role_name: &str) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(
            "DROP ROLE [{}]",
            role_name.replace(']', "]]")
        );

        Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to delete role: {}", e)))?;

        Ok(())
    }

    async fn get_permissions(
        &self,
        pool: PoolRef<'_>,
        grantee: &str,
        _host: Option<&str>,
    ) -> AppResult<Vec<DatabasePermission>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let query = format!(
            r#"
            SELECT
                p.permission_name,
                dp.name as grantee,
                CASE WHEN p.state = 'W' THEN 1 ELSE 0 END as is_grantable
            FROM sys.database_permissions p
            JOIN sys.database_principals dp ON p.grantee_principal_id = dp.principal_id
            WHERE dp.name = N'{}'
                AND p.class = 0  -- Database level permissions
            "#,
            grantee.replace('\'', "''")
        );

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let stream = Query::new(&query).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get permissions: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch permissions: {}", e)))?;

        let permissions = results
            .iter()
            .map(|row| DatabasePermission {
                privilege: row.get::<&str, _>(0).unwrap_or("").to_string(),
                grantee: row.get::<&str, _>(1).unwrap_or("").to_string(),
                is_grantable: row.get::<i32, _>(2).unwrap_or(0) == 1,
            })
            .collect();

        Ok(permissions)
    }

    async fn get_available_privileges(&self, _pool: PoolRef<'_>) -> AppResult<AvailablePrivileges> {
        Ok(AvailablePrivileges {
            database_privileges: vec![
                "CONNECT".to_string(),
                "CREATE TABLE".to_string(),
                "CREATE VIEW".to_string(),
                "CREATE PROCEDURE".to_string(),
                "CREATE FUNCTION".to_string(),
                "EXECUTE".to_string(),
                "SELECT".to_string(),
                "INSERT".to_string(),
                "UPDATE".to_string(),
                "DELETE".to_string(),
            ],
        })
    }

    async fn grant_permission(
        &self,
        pool: PoolRef<'_>,
        request: &PermissionRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // Validate privilege against allowed list to prevent SQL injection
        let allowed_privileges = [
            "CONNECT", "CREATE TABLE", "CREATE VIEW", "CREATE PROCEDURE",
            "CREATE FUNCTION", "EXECUTE", "SELECT", "INSERT", "UPDATE", "DELETE",
        ];
        let privilege_upper = request.privilege.to_uppercase();
        if !allowed_privileges.contains(&privilege_upper.as_str()) {
            return Err(AppError::ValidationError(format!(
                "Invalid privilege '{}'. Allowed privileges: {}",
                request.privilege,
                allowed_privileges.join(", ")
            )));
        }

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let grant_option = if request.with_grant_option {
            " WITH GRANT OPTION"
        } else {
            ""
        };

        let sql = format!(
            "GRANT {} TO [{}]{}",
            privilege_upper,
            request.grantee.replace(']', "]]"),
            grant_option
        );

        Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to grant permission: {}", e)))?;

        Ok(())
    }

    async fn revoke_permission(
        &self,
        pool: PoolRef<'_>,
        request: &PermissionRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // Validate privilege against allowed list to prevent SQL injection
        let allowed_privileges = [
            "CONNECT", "CREATE TABLE", "CREATE VIEW", "CREATE PROCEDURE",
            "CREATE FUNCTION", "EXECUTE", "SELECT", "INSERT", "UPDATE", "DELETE",
        ];
        let privilege_upper = request.privilege.to_uppercase();
        if !allowed_privileges.contains(&privilege_upper.as_str()) {
            return Err(AppError::ValidationError(format!(
                "Invalid privilege '{}'. Allowed privileges: {}",
                request.privilege,
                allowed_privileges.join(", ")
            )));
        }

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(
            "REVOKE {} FROM [{}]",
            privilege_upper,
            request.grantee.replace(']', "]]")
        );

        Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to revoke permission: {}", e)))?;

        Ok(())
    }

    async fn grant_role(&self, pool: PoolRef<'_>, request: &RoleMembershipRequest) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(
            "ALTER ROLE [{}] ADD MEMBER [{}]",
            request.role_name.replace(']', "]]"),
            request.member_name.replace(']', "]]")
        );

        Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to grant role: {}", e)))?;

        Ok(())
    }

    async fn revoke_role(
        &self,
        pool: PoolRef<'_>,
        request: &RoleMembershipRequest,
    ) -> AppResult<()> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(
            "ALTER ROLE [{}] DROP MEMBER [{}]",
            request.role_name.replace(']', "]]"),
            request.member_name.replace(']', "]]")
        );

        Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to revoke role: {}", e)))?;

        Ok(())
    }

    // ============ View Management Methods ============

    async fn get_views(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<ViewInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // MSSQL defaults to "dbo" schema
        let schema = "dbo";

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(r#"
            SELECT
                v.name as name,
                SCHEMA_NAME(v.schema_id) as schema_name,
                OBJECT_DEFINITION(v.object_id) as definition,
                OBJECTPROPERTY(v.object_id, 'IsUpdatable') as is_updatable,
                v.with_check_option as check_option
            FROM sys.views v
            WHERE SCHEMA_NAME(v.schema_id) = '{}'
            ORDER BY v.name
        "#, schema.replace('\'', "''"));

        let stream = Query::new(&sql).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get views: {}", e)))?;

        let rows: Vec<Row> = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to get result: {}", e)))?;

        let views = rows
            .iter()
            .map(|row| {
                let name: &str = row.get(0).unwrap_or_default();
                let schema: Option<&str> = row.get(1);
                let definition: Option<&str> = row.get(2);
                let is_updatable: i32 = row.get(3).unwrap_or(0);
                let check_option: bool = row.get(4).unwrap_or(false);

                ViewInfo {
                    name: name.to_string(),
                    schema: schema.map(|s| s.to_string()),
                    definition: definition.map(|s| s.to_string()),
                    is_updatable: is_updatable == 1,
                    check_option: if check_option { Some("CASCADED".to_string()) } else { None },
                }
            })
            .collect();

        Ok(views)
    }

    async fn get_view_ddl(&self, pool: PoolRef<'_>, view_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        // Parse schema.view_name format
        let (schema, name) = if view_name.contains('.') {
            let parts: Vec<&str> = view_name.splitn(2, '.').collect();
            (parts[0].to_string(), parts[1].to_string())
        } else {
            ("dbo".to_string(), view_name.to_string())
        };

        let sql = format!(
            "SELECT OBJECT_DEFINITION(OBJECT_ID('[{}].[{}]'))",
            schema.replace('\'', "''"),
            name.replace('\'', "''")
        );

        let stream = Query::new(&sql).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get view DDL: {}", e)))?;

        let rows: Vec<Row> = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to get result: {}", e)))?;

        let ddl: Option<&str> = rows.first().and_then(|r| r.get(0));

        ddl.map(|s| format!("{};", s.trim()))
            .ok_or_else(|| AppError::QueryError(format!("View '{}' not found", view_name)))
    }

    async fn create_view(
        &self,
        pool: PoolRef<'_>,
        view_def: &NewViewDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let start = Instant::now();

        let schema_prefix = view_def
            .schema
            .as_ref()
            .map(|s| format!("[{}].", s.replace(']', "]]")))
            .unwrap_or_default();

        let check_option = view_def
            .check_option
            .as_ref()
            .filter(|c| *c != "NONE" && !c.is_empty())
            .map(|_| "\nWITH CHECK OPTION")
            .unwrap_or_default();

        // MSSQL uses ALTER VIEW instead of OR REPLACE
        let sql = if view_def.or_replace {
            // Try ALTER first, fall back to CREATE
            format!(
                "IF OBJECT_ID('{}[{}]', 'V') IS NOT NULL ALTER VIEW {}[{}] AS\n{}{} ELSE EXEC('CREATE VIEW {}[{}] AS {} {}')",
                schema_prefix,
                view_def.name.replace(']', "]]"),
                schema_prefix,
                view_def.name.replace(']', "]]"),
                view_def.definition.trim(),
                check_option,
                schema_prefix,
                view_def.name.replace(']', "]]"),
                view_def.definition.trim().replace('\'', "''"),
                if check_option.is_empty() { "" } else { "WITH CHECK OPTION" }
            )
        } else {
            format!(
                "CREATE VIEW {}[{}] AS\n{}{}",
                schema_prefix,
                view_def.name.replace(']', "]]"),
                view_def.definition.trim(),
                check_option
            )
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let result = Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to create view: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected().iter().sum()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_view(&self, pool: PoolRef<'_>, view_name: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let start = Instant::now();

        let sql = format!(
            "DROP VIEW IF EXISTS {}",
            quote_identifier(view_name, &DatabaseType::MSSQL)
        );

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let result = Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to drop view: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected().iter().sum()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    // ============ Index Management Methods ============

    async fn get_all_indexes(
        &self,
        pool: PoolRef<'_>,
        _config: &ConnectionConfig,
    ) -> AppResult<Vec<StandaloneIndexInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        // MSSQL defaults to "dbo" schema
        let schema = "dbo";

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let sql = format!(r#"
            SELECT
                i.name as index_name,
                SCHEMA_NAME(t.schema_id) as schema_name,
                t.name as table_name,
                STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) as columns,
                i.is_unique,
                i.is_primary_key as is_primary,
                i.type_desc as index_type
            FROM sys.indexes i
            JOIN sys.tables t ON t.object_id = i.object_id
            JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.name IS NOT NULL
              AND SCHEMA_NAME(t.schema_id) = '{}'
            GROUP BY i.name, SCHEMA_NAME(t.schema_id), t.name, i.is_unique, i.is_primary_key, i.type_desc
            ORDER BY SCHEMA_NAME(t.schema_id), t.name, i.name
        "#, schema.replace('\'', "''"));

        let stream = Query::new(&sql).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get indexes: {}", e)))?;

        let rows: Vec<Row> = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to get result: {}", e)))?;

        let indexes = rows
            .iter()
            .map(|row| {
                let name: &str = row.get(0).unwrap_or_default();
                let schema: Option<&str> = row.get(1);
                let table_name: &str = row.get(2).unwrap_or_default();
                let columns_str: &str = row.get(3).unwrap_or_default();
                let is_unique: bool = row.get(4).unwrap_or(false);
                let is_primary: bool = row.get(5).unwrap_or(false);
                let index_type: Option<&str> = row.get(6);

                let columns: Vec<String> = columns_str.split(',').map(|s| s.to_string()).collect();

                StandaloneIndexInfo {
                    name: name.to_string(),
                    schema: schema.map(|s| s.to_string()),
                    table_name: table_name.to_string(),
                    columns,
                    is_unique,
                    is_primary,
                    index_type: index_type.map(|s| s.to_string()),
                }
            })
            .collect();

        Ok(indexes)
    }

    async fn get_index_ddl(
        &self,
        pool: PoolRef<'_>,
        index_name: &str,
        table_name: Option<&str>,
    ) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        // Get index info to reconstruct DDL
        let sql = format!(r#"
            SELECT
                i.name as index_name,
                SCHEMA_NAME(t.schema_id) as schema_name,
                t.name as table_name,
                STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) as columns,
                i.is_unique,
                i.type_desc
            FROM sys.indexes i
            JOIN sys.tables t ON t.object_id = i.object_id
            JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.name = '{}'
            {}
            GROUP BY i.name, SCHEMA_NAME(t.schema_id), t.name, i.is_unique, i.type_desc
        "#,
            index_name.replace('\'', "''"),
            table_name.map(|t| format!("AND t.name = '{}'", t.replace('\'', "''"))).unwrap_or_default()
        );

        let stream = Query::new(&sql).query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get index DDL: {}", e)))?;

        let rows: Vec<Row> = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to get result: {}", e)))?;

        let row = rows.first()
            .ok_or_else(|| AppError::QueryError(format!("Index '{}' not found", index_name)))?;

        let idx_name: &str = row.get(0).unwrap_or_default();
        let schema: &str = row.get(1).unwrap_or("dbo");
        let tbl_name: &str = row.get(2).unwrap_or_default();
        let columns_str: &str = row.get(3).unwrap_or_default();
        let is_unique: bool = row.get(4).unwrap_or(false);

        let columns: Vec<String> = columns_str
            .split(',')
            .map(|c| format!("[{}]", c.replace(']', "]]")))
            .collect();

        let unique = if is_unique { "UNIQUE " } else { "" };

        let ddl = format!(
            "CREATE {}INDEX [{}] ON [{}].[{}]({})",
            unique,
            idx_name.replace(']', "]]"),
            schema.replace(']', "]]"),
            tbl_name.replace(']', "]]"),
            columns.join(", ")
        );

        Ok(format!("{};", ddl))
    }

    async fn create_index(
        &self,
        pool: PoolRef<'_>,
        index_def: &CreateIndexDefinition,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let start = Instant::now();

        let schema_prefix = index_def
            .schema
            .as_ref()
            .map(|s| format!("[{}].", s.replace(']', "]]")))
            .unwrap_or_default();

        let unique = if index_def.is_unique { "UNIQUE " } else { "" };

        // Generate index name if not provided
        let index_name = index_def.name.clone().unwrap_or_else(|| {
            format!(
                "IX_{}_{}",
                index_def.table_name,
                index_def.columns.join("_")
            )
        });

        let columns = index_def
            .columns
            .iter()
            .map(|c| format!("[{}]", c.replace(']', "]]")))
            .collect::<Vec<_>>()
            .join(", ");

        let where_clause = index_def
            .where_clause
            .as_ref()
            .filter(|w| !w.is_empty())
            .map(|w| format!(" WHERE {}", w))
            .unwrap_or_default();

        let sql = format!(
            "CREATE {}INDEX [{}] ON {}[{}]({}){}",
            unique,
            index_name.replace(']', "]]"),
            schema_prefix,
            index_def.table_name.replace(']', "]]"),
            columns,
            where_clause
        );

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let result = Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to create index: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected().iter().sum()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn drop_index(
        &self,
        pool: PoolRef<'_>,
        index_name: &str,
        table_name: Option<&str>,
    ) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let start = Instant::now();

        // MSSQL requires table name for DROP INDEX
        let table = table_name.ok_or_else(|| {
            AppError::QueryError("Table name is required for MSSQL DROP INDEX".to_string())
        })?;

        let sql = format!(
            "DROP INDEX [{}] ON [{}]",
            index_name.replace(']', "]]"),
            table.replace(']', "]]")
        );

        let mut client = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get connection: {}", e)))?;

        let result = Query::new(&sql).execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to drop index: {}", e)))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: Some(result.rows_affected().iter().sum()),
            execution_time_ms: start.elapsed().as_millis() as u64,
        })
    }
}

impl MssqlDriver {
    /// Get list of all databases on the SQL Server instance (similar to SSMS Object Explorer)
    pub async fn get_databases(&self, pool: PoolRef<'_>) -> AppResult<Vec<crate::models::DatabaseInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        // Query sys.databases - only show databases the user has access to
        // Uses HAS_DBACCESS() to filter based on user permissions
        let sql = r#"
            SELECT
                d.name,
                d.state_desc AS state,
                d.recovery_model_desc AS recovery_model,
                d.compatibility_level,
                CASE WHEN d.name = DB_NAME() THEN 1 ELSE 0 END AS is_current
            FROM sys.databases d
            WHERE HAS_DBACCESS(d.name) = 1
            ORDER BY
                CASE WHEN d.name = DB_NAME() THEN 0 ELSE 1 END,
                d.name
        "#;

        let query = Query::new(sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get databases: {}", e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        let databases = results
            .iter()
            .map(|row| {
                crate::models::DatabaseInfo {
                    name: row.get::<&str, _>(0).unwrap_or("").to_string(),
                    state: row.get::<&str, _>(1).unwrap_or("UNKNOWN").to_string(),
                    recovery_model: row.get::<&str, _>(2).unwrap_or("UNKNOWN").to_string(),
                    // compatibility_level is tinyint (u8) in SQL Server
                    compatibility_level: row.get::<u8, _>(3).map(|v| v as i32).unwrap_or(0),
                    is_current: row.get::<i32, _>(4).unwrap_or(0) == 1,
                }
            })
            .collect();

        Ok(databases)
    }

    /// Get tables from a specific database on the SQL Server instance
    /// This allows browsing tables in any database, not just the currently connected one
    pub async fn get_database_tables(&self, pool: PoolRef<'_>, database_name: &str) -> AppResult<Vec<TableInfo>> {
        let pool = match pool {
            PoolRef::Mssql(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for MSSQL".to_string())),
        };

        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        // Use three-part naming to query tables from a specific database
        // This avoids needing to switch database context
        let sql = format!(
            r#"
            SELECT
                s.name AS schema_name,
                t.name AS table_name,
                0 AS is_view
            FROM [{db}].sys.tables t
            INNER JOIN [{db}].sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.is_ms_shipped = 0
              AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
              AND t.name NOT LIKE 'spt_%'
              AND t.name NOT LIKE 'MS%'
            UNION ALL
            SELECT
                s.name AS schema_name,
                v.name AS table_name,
                1 AS is_view
            FROM [{db}].sys.views v
            INNER JOIN [{db}].sys.schemas s ON v.schema_id = s.schema_id
            WHERE v.is_ms_shipped = 0
              AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
            ORDER BY schema_name, table_name
            "#,
            db = database_name.replace(']', "]]") // Escape brackets in database name
        );

        let query = Query::new(&sql);
        let stream = query.query(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to get tables for database '{}': {}", database_name, e)))?;

        let results = stream.into_first_result().await
            .map_err(|e| AppError::QueryError(format!("Failed to fetch results: {}", e)))?;

        let tables = results
            .iter()
            .map(|row| {
                let schema: Option<&str> = row.get(0);
                let name: Option<&str> = row.get(1);
                let is_view: Option<i32> = row.get(2);

                TableInfo {
                    name: name.unwrap_or("").to_string(),
                    schema: schema.map(|s| s.to_string()),
                    table_type: if is_view.unwrap_or(0) == 1 {
                        "VIEW".to_string()
                    } else {
                        "TABLE".to_string()
                    },
                    row_count: None,
                }
            })
            .collect();

        Ok(tables)
    }

    /// Parse MSSQL SHOWPLAN_XML output into a PlanNode structure
    fn parse_mssql_plan_xml(xml: &str) -> (PlanNode, f64, Vec<ExplainWarning>) {
        let mut warnings = Vec::new();
        let mut total_cost = 0.0;

        // Extract total cost from StmtSimple
        if let Some(cost) = Self::extract_xml_attr(xml, "StatementSubTreeCost") {
            total_cost = cost.parse().unwrap_or(0.0);
        }

        // Find the root RelOp element - handle both with and without namespace prefix
        // MSSQL SHOWPLAN_XML may have namespace like xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan"
        let relop_start = xml.find("<RelOp ")
            .or_else(|| {
                // Handle namespace prefix like <prefix:RelOp by finding `:RelOp ` then searching backwards for `<`
                xml.find(":RelOp ").and_then(|colon_pos| {
                    xml[..colon_pos].rfind('<')
                })
            });

        let plan = if let Some(start) = relop_start {
            Self::parse_relop_element(xml, start, &mut warnings)
        } else {
            // Try to extract info from the XML even without RelOp elements
            // This handles simpler plans or different MSSQL versions
            let node_type = if xml.contains("Clustered Index") {
                "Clustered Index Operation"
            } else if xml.contains("Index Scan") || xml.contains("IndexScan") {
                "Index Scan"
            } else if xml.contains("Table Scan") || xml.contains("TableScan") {
                "Table Scan"
            } else if xml.contains("Hash Match") || xml.contains("HashMatch") {
                "Hash Join"
            } else if xml.contains("Nested Loops") || xml.contains("NestedLoops") {
                "Nested Loop"
            } else {
                "Query Plan"
            }.to_string();

            // Try to extract row estimates
            let estimate_rows = Self::extract_xml_attr(xml, "StatementEstRows")
                .or_else(|| Self::extract_xml_attr(xml, "EstimateRows"))
                .and_then(|s| s.parse::<f64>().ok())
                .map(|f| f as u64);

            PlanNode {
                node_type,
                relation_name: None,
                alias: None,
                startup_cost: None,
                total_cost: if total_cost > 0.0 { Some(total_cost) } else { None },
                plan_rows: estimate_rows,
                plan_width: None,
                actual_startup_time: None,
                actual_total_time: None,
                actual_rows: None,
                actual_loops: None,
                index_name: None,
                index_cond: None,
                filter: None,
                rows_removed_by_filter: None,
                sort_key: None,
                sort_method: None,
                join_type: None,
                hash_cond: None,
                buffers_shared_hit: None,
                buffers_shared_read: None,
                children: Vec::new(),
                warnings: Vec::new(),
                extra_info: HashMap::new(),
            }
        };

        (plan, total_cost, warnings)
    }

    /// Parse a RelOp element from XML starting at the given position
    fn parse_relop_element(xml: &str, start_pos: usize, warnings: &mut Vec<ExplainWarning>) -> PlanNode {
        let xml_from_start = &xml[start_pos..];

        // Find the end of the opening tag to get attributes
        let tag_end = xml_from_start.find('>').unwrap_or(0);
        let opening_tag = &xml_from_start[..tag_end];

        // Extract attributes from the RelOp element
        let physical_op = Self::extract_attr_from_tag(opening_tag, "PhysicalOp")
            .unwrap_or_else(|| "Unknown".to_string());
        let logical_op = Self::extract_attr_from_tag(opening_tag, "LogicalOp");
        let estimate_rows = Self::extract_attr_from_tag(opening_tag, "EstimateRows")
            .and_then(|s| s.parse::<f64>().ok())
            .map(|f| f as u64);
        let estimated_cost = Self::extract_attr_from_tag(opening_tag, "EstimatedTotalSubtreeCost")
            .and_then(|s| s.parse::<f64>().ok());
        let estimate_io = Self::extract_attr_from_tag(opening_tag, "EstimateIO")
            .and_then(|s| s.parse::<f64>().ok());
        let estimate_cpu = Self::extract_attr_from_tag(opening_tag, "EstimateCPU")
            .and_then(|s| s.parse::<f64>().ok());

        // Determine node type based on physical operation
        let node_type = match physical_op.as_str() {
            "Clustered Index Scan" => "Clustered Index Scan",
            "Clustered Index Seek" => "Clustered Index Seek",
            "Index Scan" => "Index Scan",
            "Index Seek" => "Index Seek",
            "Table Scan" => "Table Scan",
            "Hash Match" => "Hash Join",
            "Nested Loops" => "Nested Loop",
            "Merge Join" => "Merge Join",
            "Sort" => "Sort",
            "Stream Aggregate" => "Aggregate",
            "Hash Aggregate" => "Hash Aggregate",
            "Compute Scalar" => "Compute Scalar",
            "Filter" => "Filter",
            "Top" => "Top",
            "Parallelism" => "Parallelism",
            "Concatenation" => "Concatenation",
            "Constant Scan" => "Constant Scan",
            _ => &physical_op,
        }.to_string();

        // Check for table scans and add warnings
        if physical_op == "Table Scan" || physical_op == "Clustered Index Scan" {
            if let Some(rows) = estimate_rows {
                if rows > 1000 {
                    warnings.push(ExplainWarning {
                        severity: WarningSeverity::Warning,
                        message: format!("{} scanning ~{} rows", physical_op, rows),
                        node_type: Some(physical_op.clone()),
                        suggestion: Some("Consider adding an index or using Index Seek".to_string()),
                    });
                }
            }
        }

        // Extract table/index name from Object element
        let (relation_name, index_name) = Self::extract_object_info(xml_from_start);

        // Extract filter predicate if present
        let filter = Self::extract_predicate(xml_from_start, "Predicate");
        let index_cond = Self::extract_predicate(xml_from_start, "SeekPredicates");

        // Find child RelOp elements
        let children = Self::find_child_relops(xml_from_start, warnings);

        // Calculate startup cost (IO) and total cost (IO + CPU)
        let startup_cost = estimate_io;
        let total_cost_node = match (estimate_io, estimate_cpu) {
            (Some(io), Some(cpu)) => Some(io + cpu),
            _ => estimated_cost,
        };

        PlanNode {
            node_type,
            relation_name,
            alias: logical_op,
            startup_cost,
            total_cost: total_cost_node,
            plan_rows: estimate_rows,
            plan_width: None,
            actual_startup_time: None,
            actual_total_time: None,
            actual_rows: None,
            actual_loops: None,
            index_name,
            index_cond,
            filter,
            rows_removed_by_filter: None,
            sort_key: None,
            sort_method: None,
            join_type: None,
            hash_cond: None,
            buffers_shared_hit: None,
            buffers_shared_read: None,
            children,
            warnings: Vec::new(),
            extra_info: HashMap::new(),
        }
    }

    /// Find child RelOp elements within a parent element
    fn find_child_relops(xml: &str, warnings: &mut Vec<ExplainWarning>) -> Vec<PlanNode> {
        let mut children = Vec::new();

        // Find the content after the first RelOp's attributes (skip the current element)
        let Some(first_close) = xml.find('>') else {
            return children;
        };

        let inner = &xml[first_close + 1..];

        // Find all direct child RelOp elements
        let mut pos = 0;
        let mut depth = 0;

        while let Some(rel_pos) = inner[pos..].find("<RelOp ") {
            let abs_pos = pos + rel_pos;

            // Check if we're back at depth 0 (direct child)
            // Count opening/closing tags before this position
            let before = &inner[pos..abs_pos];
            for part in before.split("<RelOp") {
                if part.contains("</RelOp>") {
                    depth -= part.matches("</RelOp>").count() as i32;
                }
            }
            depth += before.matches("<RelOp").count() as i32;

            if depth == 0 {
                // This is a direct child, parse it
                let child = Self::parse_relop_element(inner, abs_pos, warnings);
                children.push(child);
            }

            pos = abs_pos + 7; // Move past "<RelOp "
        }

        children
    }

    /// Extract an attribute value from an XML string
    fn extract_xml_attr(xml: &str, attr_name: &str) -> Option<String> {
        let pattern = format!("{}=\"", attr_name);
        if let Some(start) = xml.find(&pattern) {
            let value_start = start + pattern.len();
            if let Some(end) = xml[value_start..].find('"') {
                return Some(xml[value_start..value_start + end].to_string());
            }
        }
        None
    }

    /// Extract an attribute from a tag string
    fn extract_attr_from_tag(tag: &str, attr_name: &str) -> Option<String> {
        let pattern = format!("{}=\"", attr_name);
        if let Some(start) = tag.find(&pattern) {
            let value_start = start + pattern.len();
            if let Some(end) = tag[value_start..].find('"') {
                return Some(tag[value_start..value_start + end].to_string());
            }
        }
        None
    }

    /// Extract table and index name from Object element
    fn extract_object_info(xml: &str) -> (Option<String>, Option<String>) {
        // Look for <Object ... Table="..." Index="..." />
        if let Some(obj_start) = xml.find("<Object ") {
            let obj_end = xml[obj_start..].find("/>").unwrap_or(200);
            let obj_tag = &xml[obj_start..obj_start + obj_end];

            let table = Self::extract_attr_from_tag(obj_tag, "Table")
                .map(|s| s.trim_matches('[').trim_matches(']').to_string());
            let index = Self::extract_attr_from_tag(obj_tag, "Index")
                .map(|s| s.trim_matches('[').trim_matches(']').to_string());

            return (table, index);
        }
        (None, None)
    }

    /// Extract predicate/filter expression
    fn extract_predicate(xml: &str, predicate_type: &str) -> Option<String> {
        let start_tag = format!("<{}", predicate_type);
        if let Some(start) = xml.find(&start_tag) {
            // Find ScalarOperator within the predicate
            let predicate_xml = &xml[start..];
            if let Some(scalar_start) = predicate_xml.find("ScalarString=\"") {
                let value_start = scalar_start + 14;
                if let Some(end) = predicate_xml[value_start..].find('"') {
                    let value = &predicate_xml[value_start..value_start + end];
                    // Decode XML entities
                    return Some(value
                        .replace("&gt;", ">")
                        .replace("&lt;", "<")
                        .replace("&amp;", "&")
                        .replace("&quot;", "\""));
                }
            }
        }
        None
    }
}

/// Format MSSQL type with length/precision/scale
fn format_mssql_type(type_name: &str, max_length: Option<i16>, precision: Option<u8>, scale: Option<u8>) -> String {
    match type_name.to_lowercase().as_str() {
        "varchar" | "nvarchar" | "char" | "nchar" => {
            if let Some(len) = max_length {
                if len == -1 {
                    format!("{}(MAX)", type_name)
                } else {
                    // nvarchar uses 2 bytes per character
                    let actual_len = if type_name.starts_with('n') {
                        len / 2
                    } else {
                        len
                    };
                    format!("{}({})", type_name, actual_len)
                }
            } else {
                type_name.to_string()
            }
        }
        "varbinary" | "binary" => {
            if let Some(len) = max_length {
                if len == -1 {
                    format!("{}(MAX)", type_name)
                } else {
                    format!("{}({})", type_name, len)
                }
            } else {
                type_name.to_string()
            }
        }
        "decimal" | "numeric" => {
            match (precision, scale) {
                (Some(p), Some(s)) => format!("{}({},{})", type_name, p, s),
                (Some(p), None) => format!("{}({})", type_name, p),
                _ => type_name.to_string(),
            }
        }
        "float" => {
            if let Some(p) = precision {
                format!("float({})", p)
            } else {
                type_name.to_string()
            }
        }
        _ => type_name.to_string(),
    }
}
