use crate::db::common::{parse_cte_statement_type, CteParserConfig};
use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ColumnInfo, ConnectionConfig, ConstraintInfo, ExtendedColumnInfo, ForeignKeyInfo,
    IndexInfo, PreviewResult, QueryResult, StatementPreview, StatementType, TableInfo,
    TableProperties, TableRelationship, TableSchema, TestConnectionResult,
};
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
                    if let Some((h, port_str)) = server.split_once(',') {
                        host = h.to_string();
                        if let Ok(p) = port_str.parse::<u16>() {
                            port = p;
                        }
                    } else {
                        host = server.to_string();
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
    config.port(port);
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

        let (schema_name, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (parts[0], parts[1])
        } else {
            ("dbo", table_name)
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
                CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
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

                let col_name = name.unwrap_or("").to_string();
                let is_primary = is_pk.unwrap_or(0) == 1;

                if is_primary {
                    primary_keys.push(col_name.clone());
                }

                let type_str = format_mssql_type(
                    data_type.unwrap_or(""),
                    max_length,
                    precision,
                    scale,
                );

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

        let (schema_name, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (parts[0], parts[1])
        } else {
            ("dbo", table_name)
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

        let (schema_name, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (parts[0], parts[1])
        } else {
            ("dbo", table_name)
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

        let (schema_name, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (parts[0], parts[1])
        } else {
            ("dbo", table_name)
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

        let (schema_name, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (parts[0], parts[1])
        } else {
            ("dbo", table_name)
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
