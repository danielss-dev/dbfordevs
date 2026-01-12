use crate::db::common::{parse_cte_statement_type, CteParserConfig};
use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ColumnInfo, ConnectionConfig, ConstraintInfo, ExplainResult, ExtendedColumnInfo,
    ForeignKeyInfo, IndexInfo, NewTableDefinition, PlanNode, PreviewResult, QueryResult,
    StatementPreview, StatementType, TableInfo, TableProperties, TableReferenceInfo,
    TableRelationship, TableSchema, TestConnectionResult,
};
use async_trait::async_trait;
use deadpool::managed::{Manager, Pool, RecycleResult};
use oracle::{Connection, Connector};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::future::Future;
use std::time::Instant;

/// Oracle connection configuration
#[derive(Clone)]
pub struct OracleConnectionConfig {
    pub connect_string: String,
    pub username: String,
    pub password: String,
}

/// Oracle connection manager for deadpool
pub struct OracleConnectionManager {
    config: OracleConnectionConfig,
}

impl OracleConnectionManager {
    fn new(config: OracleConnectionConfig) -> Self {
        Self { config }
    }
}

/// Thread-safe wrapper for Oracle connection
pub struct OracleConnection {
    conn: Connection,
}

// Safety: Oracle's Connection is thread-safe when properly synchronized
// The oracle crate handles internal synchronization
unsafe impl Send for OracleConnection {}
unsafe impl Sync for OracleConnection {}

impl OracleConnection {
    fn new(conn: Connection) -> Self {
        Self { conn }
    }

    fn inner(&self) -> &Connection {
        &self.conn
    }
}

impl Manager for OracleConnectionManager {
    type Type = OracleConnection;
    type Error = AppError;

    fn create(&self) -> impl Future<Output = Result<Self::Type, Self::Error>> + Send {
        let config = self.config.clone();
        async move {
            // Oracle crate is synchronous, use spawn_blocking
            tokio::task::spawn_blocking(move || {
                let connector = Connector::new(&config.username, &config.password, &config.connect_string);
                let conn = connector.connect()
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to Oracle: {}", e)))?;
                Ok(OracleConnection::new(conn))
            })
            .await
            .map_err(|e| AppError::ConnectionError(format!("Task join error: {}", e)))?
        }
    }

    fn recycle(
        &self,
        conn: &mut Self::Type,
        _: &deadpool::managed::Metrics,
    ) -> impl Future<Output = RecycleResult<Self::Error>> + Send {
        // Check connection validity - oracle crate connections are sync
        let is_ok = conn.inner().ping().is_ok();
        async move {
            if is_ok {
                Ok(())
            } else {
                Err(deadpool::managed::RecycleError::Backend(
                    AppError::ConnectionError("Oracle connection is stale".to_string())
                ))
            }
        }
    }

    fn detach(&self, _obj: &mut Self::Type) {
        // Connection will be closed when dropped
    }
}

/// Oracle pool type using deadpool
pub type OraclePool = Pool<OracleConnectionManager>;

/// Create a new Oracle pool with deadpool
pub async fn create_oracle_pool(config: OracleConnectionConfig) -> AppResult<OraclePool> {
    let manager = OracleConnectionManager::new(config.clone());
    let pool = Pool::builder(manager)
        .max_size(5)
        .build()
        .map_err(|e| AppError::ConnectionError(format!("Failed to create Oracle pool: {}", e)))?;

    // Validate the connection by getting a client from the pool
    let conn: deadpool::managed::Object<OracleConnectionManager> = pool.get().await
        .map_err(|e| AppError::ConnectionError(format!("Failed to establish Oracle connection: {}", e)))?;

    // Test with a simple query
    tokio::task::spawn_blocking(move || -> AppResult<()> {
        conn.inner().query_row_as::<i32>("SELECT 1 FROM DUAL", &[])
            .map_err(|e| AppError::ConnectionError(format!("Oracle connection test failed: {}", e)))?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::ConnectionError(format!("Task join error: {}", e)))??;

    Ok(pool)
}

/// Build Oracle connection config from ConnectionConfig
pub fn build_oracle_config(config: &ConnectionConfig) -> OracleConnectionConfig {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(1521);
    let service = &config.database;

    // Easy Connect format: //host:port/service_name
    let connect_string = format!("//{}:{}/{}", host, port, service);

    OracleConnectionConfig {
        connect_string,
        username: config.username.clone().unwrap_or_else(|| "system".to_string()),
        password: config.password.clone().unwrap_or_default(),
    }
}

pub struct OracleDriver;

impl OracleDriver {
    /// Get Oracle-specific CTE parser config
    fn get_cte_config() -> CteParserConfig {
        CteParserConfig {
            string_quotes: vec!['\''],
            additional_dml_keywords: vec!["MERGE"],
            handle_dollar_quotes: false,
        }
    }

    /// Safely split SQL into individual statements
    fn split_sql_statements(sql: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut chars = sql.chars().peekable();
        let mut in_single_quote = false;
        let mut in_double_quote = false;
        let mut in_line_comment = false;
        let mut in_block_comment = false;

        while let Some(c) = chars.next() {
            match c {
                '\'' if !in_double_quote && !in_line_comment && !in_block_comment => {
                    if in_single_quote && chars.peek() == Some(&'\'') {
                        current.push(c);
                        current.push(chars.next().unwrap());
                    } else {
                        in_single_quote = !in_single_quote;
                        current.push(c);
                    }
                }
                '"' if !in_single_quote && !in_line_comment && !in_block_comment => {
                    in_double_quote = !in_double_quote;
                    current.push(c);
                }
                '-' if !in_single_quote && !in_double_quote && !in_block_comment => {
                    if chars.peek() == Some(&'-') {
                        in_line_comment = true;
                        current.push(c);
                        current.push(chars.next().unwrap());
                    } else {
                        current.push(c);
                    }
                }
                '\n' if in_line_comment => {
                    in_line_comment = false;
                    current.push(c);
                }
                '/' if !in_single_quote && !in_double_quote && !in_line_comment => {
                    if chars.peek() == Some(&'*') {
                        in_block_comment = true;
                        current.push(c);
                        current.push(chars.next().unwrap());
                    } else {
                        current.push(c);
                    }
                }
                '*' if in_block_comment => {
                    if chars.peek() == Some(&'/') {
                        in_block_comment = false;
                        current.push(c);
                        current.push(chars.next().unwrap());
                    } else {
                        current.push(c);
                    }
                }
                ';' if !in_single_quote && !in_double_quote && !in_line_comment && !in_block_comment => {
                    let trimmed = current.trim();
                    if !trimmed.is_empty() {
                        statements.push(trimmed.to_string());
                    }
                    current.clear();
                }
                _ => {
                    current.push(c);
                }
            }
        }

        let trimmed = current.trim();
        if !trimmed.is_empty() {
            statements.push(trimmed.to_string());
        }

        statements
    }

    /// Detect statement type from SQL
    fn detect_statement_type(sql: &str) -> StatementType {
        let clean_sql = sql.trim().to_uppercase();

        // Check for CTE first
        if clean_sql.starts_with("WITH ") {
            return parse_cte_statement_type(&clean_sql, &Self::get_cte_config());
        }

        // Standard statement detection
        if clean_sql.starts_with("SELECT") || clean_sql.starts_with("(SELECT") {
            StatementType::Select
        } else if clean_sql.starts_with("INSERT") ||
                  clean_sql.starts_with("UPDATE") ||
                  clean_sql.starts_with("DELETE") ||
                  clean_sql.starts_with("MERGE") {
            StatementType::Dml
        } else if clean_sql.starts_with("CREATE") ||
                  clean_sql.starts_with("ALTER") ||
                  clean_sql.starts_with("DROP") ||
                  clean_sql.starts_with("TRUNCATE") ||
                  clean_sql.starts_with("COMMENT") ||
                  clean_sql.starts_with("GRANT") ||
                  clean_sql.starts_with("REVOKE") {
            StatementType::Ddl
        } else {
            StatementType::Other
        }
    }

    /// Extract table name from SQL query
    fn extract_table_name(sql: &str) -> Option<String> {
        let upper = sql.to_uppercase();
        let sql_lower = sql.trim();

        // Handle INSERT
        if upper.starts_with("INSERT") {
            if let Some(into_pos) = upper.find("INTO") {
                let after_into = &sql_lower[into_pos + 4..].trim_start();
                return Self::extract_identifier(after_into);
            }
        }

        // Handle UPDATE
        if upper.starts_with("UPDATE") {
            let after_update = &sql_lower[6..].trim_start();
            return Self::extract_identifier(after_update);
        }

        // Handle DELETE
        if upper.starts_with("DELETE") {
            if let Some(from_pos) = upper.find("FROM") {
                let after_from = &sql_lower[from_pos + 4..].trim_start();
                return Self::extract_identifier(after_from);
            }
        }

        // Handle MERGE
        if upper.starts_with("MERGE") {
            if let Some(into_pos) = upper.find("INTO") {
                let after_into = &sql_lower[into_pos + 4..].trim_start();
                return Self::extract_identifier(after_into);
            }
        }

        None
    }

    /// Extract identifier (table name) handling quoted identifiers
    fn extract_identifier(s: &str) -> Option<String> {
        let s = s.trim();
        if s.is_empty() {
            return None;
        }

        // Handle quoted identifier
        if s.starts_with('"') {
            if let Some(end) = s[1..].find('"') {
                return Some(s[1..end + 1].to_string());
            }
        }

        // Handle schema.table notation
        let mut result = String::new();
        let mut chars = s.chars().peekable();

        while let Some(&c) = chars.peek() {
            if c.is_alphanumeric() || c == '_' || c == '.' || c == '$' || c == '#' {
                result.push(chars.next().unwrap());
            } else if c == '"' {
                // Quoted part
                chars.next();
                while let Some(&inner) = chars.peek() {
                    if inner == '"' {
                        chars.next();
                        break;
                    }
                    result.push(chars.next().unwrap());
                }
            } else {
                break;
            }
        }

        if result.is_empty() {
            None
        } else {
            Some(result)
        }
    }

    /// Convert Oracle column value to JSON
    fn oracle_value_to_json(row: &oracle::Row, idx: usize, type_name: &str) -> JsonValue {
        let type_upper = type_name.to_uppercase();

        // Numeric types - try integer first, then float
        if type_upper.contains("NUMBER") || type_upper.contains("INTEGER") || type_upper.contains("INT")
            || type_upper.contains("SMALLINT") || type_upper.contains("FLOAT") || type_upper.contains("BINARY_FLOAT")
            || type_upper.contains("BINARY_DOUBLE") {
            // Try integer first
            if let Ok(Some(v)) = row.get::<usize, Option<i64>>(idx) {
                return JsonValue::Number(v.into());
            }
            // Try float
            if let Ok(Some(v)) = row.get::<usize, Option<f64>>(idx) {
                if let Some(n) = serde_json::Number::from_f64(v) {
                    return JsonValue::Number(n);
                }
                return JsonValue::String(v.to_string());
            }
        }

        // Date/Time types
        if type_upper.contains("DATE") || type_upper.contains("TIMESTAMP") {
            if let Ok(Some(v)) = row.get::<usize, Option<chrono::NaiveDateTime>>(idx) {
                return JsonValue::String(v.format("%Y-%m-%d %H:%M:%S").to_string());
            }
        }

        // String types (VARCHAR2, CHAR, NVARCHAR2, NCHAR, CLOB, NCLOB)
        if let Ok(Some(v)) = row.get::<usize, Option<String>>(idx) {
            return JsonValue::String(v);
        }

        // Binary types (BLOB, RAW)
        if type_upper.contains("BLOB") || type_upper.contains("RAW") {
            if let Ok(Some(v)) = row.get::<usize, Option<Vec<u8>>>(idx) {
                return JsonValue::String(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &v));
            }
        }

        // Default: try as string
        if let Ok(Some(v)) = row.get::<usize, Option<String>>(idx) {
            JsonValue::String(v)
        } else {
            JsonValue::Null
        }
    }

    /// Format Oracle data type for display
    fn format_oracle_type(data_type: &str, length: Option<i32>, precision: Option<i32>, scale: Option<i32>) -> String {
        let type_upper = data_type.to_uppercase();

        match type_upper.as_str() {
            "NUMBER" => {
                if let (Some(p), Some(s)) = (precision, scale) {
                    if s == 0 {
                        format!("NUMBER({})", p)
                    } else {
                        format!("NUMBER({},{})", p, s)
                    }
                } else if let Some(p) = precision {
                    format!("NUMBER({})", p)
                } else {
                    "NUMBER".to_string()
                }
            }
            "VARCHAR2" | "NVARCHAR2" | "CHAR" | "NCHAR" | "RAW" => {
                if let Some(len) = length {
                    format!("{}({})", type_upper, len)
                } else {
                    type_upper
                }
            }
            _ => type_upper,
        }
    }

    /// System schemas to filter out
    fn system_schemas() -> Vec<&'static str> {
        vec![
            "SYS", "SYSTEM", "MDSYS", "CTXSYS", "XDB", "APEX_PUBLIC_USER",
            "APEX_040000", "APEX_040200", "APEX_050000", "APEX_050100",
            "APPQOSSYS", "AUDSYS", "DBSFWUSER", "DBSNMP", "DIP", "DVF",
            "DVSYS", "GGSYS", "GSMADMIN_INTERNAL", "GSMCATUSER", "GSMUSER",
            "LBACSYS", "MDDATA", "OJVMSYS", "OLAPSYS", "ORACLE_OCM",
            "ORDDATA", "ORDPLUGINS", "ORDSYS", "OUTLN", "REMOTE_SCHEDULER_AGENT",
            "SI_INFORMTN_SCHEMA", "SPATIAL_CSW_ADMIN_USR", "SPATIAL_WFS_ADMIN_USR",
            "WMSYS", "XS$NULL"
        ]
    }
}

#[async_trait]
impl DatabaseDriver for OracleDriver {
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult> {
        let oracle_config = build_oracle_config(config);

        let result = tokio::task::spawn_blocking(move || -> AppResult<TestConnectionResult> {
            let connector = Connector::new(&oracle_config.username, &oracle_config.password, &oracle_config.connect_string);
            match connector.connect() {
                Ok(conn) => {
                    // Get server version
                    let version = match conn.query_row_as::<String>(
                        "SELECT banner FROM v$version WHERE ROWNUM = 1",
                        &[]
                    ) {
                        Ok(v) => Some(v),
                        Err(_) => {
                            // Try alternative
                            conn.query_row_as::<String>(
                                "SELECT version FROM v$instance",
                                &[]
                            ).ok()
                        }
                    };

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
                })
            }
        })
        .await
        .map_err(|e| AppError::ConnectionError(format!("Task join error: {}", e)))??;

        Ok(result)
    }

    async fn execute_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<QueryResult> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let sql = sql.to_string();
        let start = Instant::now();

        tokio::task::spawn_blocking(move || {
            let statements = Self::split_sql_statements(&sql);
            let mut all_columns: Vec<ColumnInfo> = Vec::new();
            let mut all_rows: Vec<Vec<JsonValue>> = Vec::new();
            let mut total_affected: u64 = 0;

            for statement in statements {
                if statement.trim().is_empty() {
                    continue;
                }

                let stmt_type = Self::detect_statement_type(&statement);

                match stmt_type {
                    StatementType::Select => {
                        let mut stmt = conn.inner().statement(&statement).build()
                            .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

                        let rows = stmt.query(&[])
                            .map_err(|e| AppError::QueryError(format!("Query execution failed: {}", e)))?;

                        // Get column info
                        let col_info = rows.column_info();
                        all_columns = col_info.iter().map(|c| ColumnInfo {
                            name: c.name().to_string(),
                            data_type: format!("{:?}", c.oracle_type()),
                            nullable: true,
                            is_primary_key: false,
                        }).collect();

                        let col_types: Vec<String> = col_info.iter()
                            .map(|c| format!("{:?}", c.oracle_type()))
                            .collect();

                        // Fetch rows
                        for row_result in rows {
                            let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;
                            let mut row_data = Vec::new();

                            for (idx, col_type) in col_types.iter().enumerate() {
                                let value = Self::oracle_value_to_json(&row, idx, col_type);
                                row_data.push(value);
                            }

                            all_rows.push(row_data);
                        }
                    }
                    StatementType::Dml => {
                        let mut stmt = conn.inner().statement(&statement).build()
                            .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

                        stmt.execute(&[])
                            .map_err(|e| AppError::QueryError(format!("Statement execution failed: {}", e)))?;
                        let affected = stmt.row_count()
                            .map_err(|e| AppError::QueryError(format!("Failed to get row count: {}", e)))?;
                        total_affected += affected as u64;

                        // Commit the transaction
                        conn.inner().commit()
                            .map_err(|e| AppError::QueryError(format!("Commit failed: {}", e)))?;
                    }
                    StatementType::Ddl => {
                        let mut stmt = conn.inner().statement(&statement).build()
                            .map_err(|e| AppError::QueryError(format!("Failed to prepare DDL statement: {}", e)))?;

                        stmt.execute(&[])
                            .map_err(|e| AppError::QueryError(format!("DDL execution failed: {}", e)))?;

                        conn.inner().commit()
                            .map_err(|e| AppError::QueryError(format!("Commit failed: {}", e)))?;
                    }
                    StatementType::Other => {
                        // Try to execute anyway
                        let mut stmt = conn.inner().statement(&statement).build()
                            .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

                        match stmt.execute(&[]) {
                            Ok(_) => {
                                let affected = stmt.row_count().unwrap_or(0);
                                total_affected += affected as u64;
                                let _ = conn.inner().commit();
                            }
                            Err(e) => {
                                return Err(AppError::QueryError(format!("Execution failed: {}", e)));
                            }
                        }
                    }
                }
            }

            let execution_time_ms = start.elapsed().as_millis() as u64;

            Ok(QueryResult {
                columns: all_columns,
                rows: all_rows,
                affected_rows: if total_affected > 0 { Some(total_affected) } else { None },
                execution_time_ms,
            })
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn get_tables(&self, pool: PoolRef<'_>, _config: &ConnectionConfig) -> AppResult<Vec<TableInfo>> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let system_schemas = Self::system_schemas();
        let schema_filter = system_schemas.iter()
            .map(|s| format!("'{}'", s))
            .collect::<Vec<_>>()
            .join(", ");

        tokio::task::spawn_blocking(move || {
            let sql = format!(
                "SELECT owner, table_name, 'TABLE' as table_type
                 FROM all_tables
                 WHERE owner NOT IN ({})
                 UNION ALL
                 SELECT owner, view_name, 'VIEW' as table_type
                 FROM all_views
                 WHERE owner NOT IN ({})
                 ORDER BY 1, 2",
                schema_filter, schema_filter
            );

            let mut stmt = conn.inner().statement(&sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

            let rows = stmt.query(&[])
                .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

            let mut tables = Vec::new();
            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;
                let schema: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let name: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let table_type: String = row.get(2).map_err(|e| AppError::QueryError(e.to_string()))?;

                tables.push(TableInfo {
                    name: format!("{}.{}", schema, name),
                    schema: Some(schema),
                    table_type,
                    row_count: None,
                });
            }

            Ok(tables)
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn get_table_schema(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableSchema> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let table_name = table_name.to_string();

        tokio::task::spawn_blocking(move || {
            // Parse schema.table
            let (schema, table) = if table_name.contains('.') {
                let parts: Vec<&str> = table_name.splitn(2, '.').collect();
                (parts[0].to_uppercase(), parts[1].to_uppercase())
            } else {
                // Get current user as default schema
                let current_user: String = conn.inner().query_row_as("SELECT USER FROM DUAL", &[])
                    .map_err(|e| AppError::QueryError(format!("Failed to get current user: {}", e)))?;
                (current_user, table_name.to_uppercase())
            };

            // Get columns
            let cols_sql = "
                SELECT column_name, data_type, data_length, data_precision, data_scale, nullable
                FROM all_tab_columns
                WHERE owner = :1 AND table_name = :2
                ORDER BY column_id
            ";

            let mut stmt = conn.inner().statement(cols_sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

            let rows = stmt.query(&[&schema, &table])
                .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

            let mut columns = Vec::new();
            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;

                let col_name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let data_type: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let data_length: Option<i32> = row.get(2).ok();
                let data_precision: Option<i32> = row.get(3).ok();
                let data_scale: Option<i32> = row.get(4).ok();
                let nullable: String = row.get(5).map_err(|e| AppError::QueryError(e.to_string()))?;

                let formatted_type = Self::format_oracle_type(&data_type, data_length, data_precision, data_scale);

                columns.push(ColumnInfo {
                    name: col_name,
                    data_type: formatted_type,
                    nullable: nullable == "Y",
                    is_primary_key: false, // Will be set below
                });
            }

            // Get primary key columns
            let pk_sql = "
                SELECT cols.column_name
                FROM all_constraints cons
                JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name
                    AND cons.owner = cols.owner
                WHERE cons.constraint_type = 'P'
                    AND cons.owner = :1
                    AND cons.table_name = :2
                ORDER BY cols.position
            ";

            let mut stmt = conn.inner().statement(pk_sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare PK statement: {}", e)))?;

            let rows = stmt.query(&[&schema, &table])
                .map_err(|e| AppError::QueryError(format!("PK query failed: {}", e)))?;

            let mut pk_columns: Vec<String> = Vec::new();
            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch PK row: {}", e)))?;
                let col_name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                pk_columns.push(col_name);
            }

            // Mark primary key columns
            for col in &mut columns {
                if pk_columns.contains(&col.name) {
                    col.is_primary_key = true;
                }
            }

            // Get foreign key info
            let fk_sql = "
                SELECT a.column_name, c.table_name as ref_table, d.column_name as ref_column, c.owner as ref_schema
                FROM all_cons_columns a
                JOIN all_constraints b ON a.constraint_name = b.constraint_name AND a.owner = b.owner
                JOIN all_constraints c ON b.r_constraint_name = c.constraint_name AND b.r_owner = c.owner
                JOIN all_cons_columns d ON c.constraint_name = d.constraint_name AND c.owner = d.owner
                WHERE b.constraint_type = 'R'
                    AND a.owner = :1
                    AND a.table_name = :2
            ";

            let mut stmt = conn.inner().statement(fk_sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare FK statement: {}", e)))?;

            let rows = stmt.query(&[&schema, &table])
                .map_err(|e| AppError::QueryError(format!("FK query failed: {}", e)))?;

            let mut foreign_keys: Vec<ForeignKeyInfo> = Vec::new();
            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch FK row: {}", e)))?;
                let col_name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let ref_table: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let ref_column: String = row.get(2).map_err(|e| AppError::QueryError(e.to_string()))?;
                let ref_schema: String = row.get(3).map_err(|e| AppError::QueryError(e.to_string()))?;

                foreign_keys.push(ForeignKeyInfo {
                    column: col_name,
                    references_table: format!("{}.{}", ref_schema, ref_table),
                    references_column: ref_column,
                });
            }

            Ok(TableSchema {
                table_name: format!("{}.{}", schema, table),
                columns,
                primary_keys: pk_columns,
                foreign_keys,
            })
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn get_all_table_schemas(&self, pool: PoolRef<'_>, config: &ConnectionConfig) -> AppResult<Vec<TableSchema>> {
        let tables = self.get_tables(pool.clone(), config).await?;
        let mut schemas = Vec::new();

        for table in tables {
            match self.get_table_schema(pool.clone(), &table.name).await {
                Ok(schema) => schemas.push(schema),
                Err(e) => {
                    // Log error but continue with other tables
                    eprintln!("Failed to get schema for {}: {}", table.name, e);
                }
            }
        }

        Ok(schemas)
    }

    fn build_connection_string(&self, config: &ConnectionConfig) -> String {
        let oracle_config = build_oracle_config(config);
        oracle_config.connect_string
    }

    async fn generate_table_ddl(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<String> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let table_name = table_name.to_string();

        tokio::task::spawn_blocking(move || {
            // Parse schema.table
            let (schema, table) = if table_name.contains('.') {
                let parts: Vec<&str> = table_name.splitn(2, '.').collect();
                (parts[0].to_uppercase(), parts[1].to_uppercase())
            } else {
                let current_user: String = conn.inner().query_row_as("SELECT USER FROM DUAL", &[])
                    .map_err(|e| AppError::QueryError(format!("Failed to get current user: {}", e)))?;
                (current_user, table_name.to_uppercase())
            };

            // Try DBMS_METADATA first
            let ddl_sql = format!(
                "SELECT DBMS_METADATA.GET_DDL('TABLE', '{}', '{}') FROM DUAL",
                table, schema
            );

            match conn.inner().query_row_as::<String>(&ddl_sql, &[]) {
                Ok(ddl) => Ok(ddl),
                Err(_) => {
                    // Fallback: construct DDL manually
                    Self::construct_table_ddl(&conn, &schema, &table)
                }
            }
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn rename_table(&self, pool: PoolRef<'_>, old_name: &str, new_name: &str) -> AppResult<QueryResult> {
        let sql = format!("ALTER TABLE {} RENAME TO {}", old_name, new_name);
        self.execute_query(pool, &sql).await
    }

    async fn get_indexes(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<IndexInfo>> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let table_name = table_name.to_string();

        tokio::task::spawn_blocking(move || {
            let (schema, table) = if table_name.contains('.') {
                let parts: Vec<&str> = table_name.splitn(2, '.').collect();
                (parts[0].to_uppercase(), parts[1].to_uppercase())
            } else {
                let current_user: String = conn.inner().query_row_as("SELECT USER FROM DUAL", &[])
                    .map_err(|e| AppError::QueryError(format!("Failed to get current user: {}", e)))?;
                (current_user, table_name.to_uppercase())
            };

            let sql = "
                SELECT i.index_name, i.uniqueness, i.index_type,
                       LISTAGG(c.column_name, ', ') WITHIN GROUP (ORDER BY c.column_position) as columns
                FROM all_indexes i
                JOIN all_ind_columns c ON i.index_name = c.index_name AND i.owner = c.index_owner
                WHERE i.owner = :1 AND i.table_name = :2
                GROUP BY i.index_name, i.uniqueness, i.index_type
                ORDER BY i.index_name
            ";

            let mut stmt = conn.inner().statement(sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

            let rows = stmt.query(&[&schema, &table])
                .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

            let mut indexes = Vec::new();
            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;

                let name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let uniqueness: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let _index_type: String = row.get(2).map_err(|e| AppError::QueryError(e.to_string()))?;
                let columns: String = row.get(3).map_err(|e| AppError::QueryError(e.to_string()))?;

                indexes.push(IndexInfo {
                    name,
                    columns: columns.split(", ").map(|s| s.to_string()).collect(),
                    is_unique: uniqueness == "UNIQUE",
                    is_primary: false,
                });
            }

            Ok(indexes)
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn get_constraints(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<ConstraintInfo>> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let table_name = table_name.to_string();

        tokio::task::spawn_blocking(move || {
            let (schema, table) = if table_name.contains('.') {
                let parts: Vec<&str> = table_name.splitn(2, '.').collect();
                (parts[0].to_uppercase(), parts[1].to_uppercase())
            } else {
                let current_user: String = conn.inner().query_row_as("SELECT USER FROM DUAL", &[])
                    .map_err(|e| AppError::QueryError(format!("Failed to get current user: {}", e)))?;
                (current_user, table_name.to_uppercase())
            };

            let sql = "
                SELECT c.constraint_name, c.constraint_type, c.search_condition,
                       LISTAGG(cols.column_name, ', ') WITHIN GROUP (ORDER BY cols.position) as columns
                FROM all_constraints c
                LEFT JOIN all_cons_columns cols ON c.constraint_name = cols.constraint_name AND c.owner = cols.owner
                WHERE c.owner = :1 AND c.table_name = :2
                    AND c.constraint_type IN ('C', 'U')
                GROUP BY c.constraint_name, c.constraint_type, c.search_condition
                ORDER BY c.constraint_name
            ";

            let mut stmt = conn.inner().statement(sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

            let rows = stmt.query(&[&schema, &table])
                .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

            let mut constraints = Vec::new();
            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;

                let name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let constraint_type: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let search_condition: Option<String> = row.get(2).ok();
                let _columns: Option<String> = row.get(3).ok();

                let type_str = match constraint_type.as_str() {
                    "C" => "CHECK",
                    "U" => "UNIQUE",
                    _ => &constraint_type,
                };

                constraints.push(ConstraintInfo {
                    name,
                    constraint_type: type_str.to_string(),
                    definition: search_condition.unwrap_or_default(),
                });
            }

            Ok(constraints)
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn get_table_properties(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableProperties> {
        let pool_clone = pool.clone();
        let pool_clone2 = pool.clone();

        let schema = self.get_table_schema(pool, table_name).await?;
        let indexes = self.get_indexes(pool_clone, table_name).await?;
        let constraints = self.get_constraints(pool_clone2, table_name).await?;

        // Convert ColumnInfo to ExtendedColumnInfo
        let extended_columns: Vec<ExtendedColumnInfo> = schema.columns.iter().map(|col| {
            ExtendedColumnInfo {
                name: col.name.clone(),
                data_type: col.data_type.clone(),
                nullable: col.nullable,
                is_primary_key: col.is_primary_key,
                default_value: None,
                comment: None,
            }
        }).collect();

        // Parse schema name from table_name if present
        let (schema_name, _) = if schema.table_name.contains('.') {
            let parts: Vec<&str> = schema.table_name.splitn(2, '.').collect();
            (Some(parts[0].to_string()), parts[1].to_string())
        } else {
            (None, schema.table_name.clone())
        };

        Ok(TableProperties {
            table_name: schema.table_name,
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
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let table_name = table_name.to_string();

        tokio::task::spawn_blocking(move || {
            let (schema, table) = if table_name.contains('.') {
                let parts: Vec<&str> = table_name.splitn(2, '.').collect();
                (parts[0].to_uppercase(), parts[1].to_uppercase())
            } else {
                let current_user: String = conn.inner().query_row_as("SELECT USER FROM DUAL", &[])
                    .map_err(|e| AppError::QueryError(format!("Failed to get current user: {}", e)))?;
                (current_user, table_name.to_uppercase())
            };

            let mut relationships = Vec::new();

            // Outgoing relationships (this table references others)
            let out_sql = "
                SELECT c.constraint_name,
                       a.column_name as from_column,
                       r.owner || '.' || r.table_name as to_table,
                       ra.column_name as to_column
                FROM all_constraints c
                JOIN all_cons_columns a ON c.constraint_name = a.constraint_name AND c.owner = a.owner
                JOIN all_constraints r ON c.r_constraint_name = r.constraint_name AND c.r_owner = r.owner
                JOIN all_cons_columns ra ON r.constraint_name = ra.constraint_name AND r.owner = ra.owner
                WHERE c.constraint_type = 'R'
                    AND c.owner = :1
                    AND c.table_name = :2
            ";

            let mut stmt = conn.inner().statement(out_sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

            let rows = stmt.query(&[&schema, &table])
                .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;

                let constraint_name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let source_column: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let target_table: String = row.get(2).map_err(|e| AppError::QueryError(e.to_string()))?;
                let target_column: String = row.get(3).map_err(|e| AppError::QueryError(e.to_string()))?;

                relationships.push(TableRelationship {
                    source_table: format!("{}.{}", schema, table),
                    source_column,
                    target_table,
                    target_column,
                    constraint_name: Some(constraint_name),
                });
            }

            // Incoming relationships (other tables reference this one)
            let in_sql = "
                SELECT c.constraint_name,
                       c.owner || '.' || c.table_name as from_table,
                       a.column_name as from_column,
                       ra.column_name as to_column
                FROM all_constraints c
                JOIN all_cons_columns a ON c.constraint_name = a.constraint_name AND c.owner = a.owner
                JOIN all_constraints r ON c.r_constraint_name = r.constraint_name AND c.r_owner = r.owner
                JOIN all_cons_columns ra ON r.constraint_name = ra.constraint_name AND r.owner = ra.owner
                WHERE c.constraint_type = 'R'
                    AND r.owner = :1
                    AND r.table_name = :2
            ";

            let mut stmt = conn.inner().statement(in_sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

            let rows = stmt.query(&[&schema, &table])
                .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;

                let constraint_name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let source_table: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let source_column: String = row.get(2).map_err(|e| AppError::QueryError(e.to_string()))?;
                let target_column: String = row.get(3).map_err(|e| AppError::QueryError(e.to_string()))?;

                relationships.push(TableRelationship {
                    source_table,
                    source_column,
                    target_table: format!("{}.{}", schema, table),
                    target_column,
                    constraint_name: Some(constraint_name),
                });
            }

            Ok(relationships)
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn preview_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<PreviewResult> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let sql = sql.to_string();
        let start = Instant::now();

        tokio::task::spawn_blocking(move || {
            let statements = Self::split_sql_statements(&sql);
            let mut previews = Vec::new();

            // Start a savepoint for rollback
            conn.inner().execute("SAVEPOINT preview_point", &[])
                .map_err(|e| AppError::QueryError(format!("Failed to create savepoint: {}", e)))?;

            for statement in &statements {
                if statement.trim().is_empty() {
                    continue;
                }

                let stmt_type = Self::detect_statement_type(statement);
                let table_name = Self::extract_table_name(statement);

                let preview = match stmt_type {
                    StatementType::Select => {
                        StatementPreview {
                            sql: statement.clone(),
                            statement_type: stmt_type,
                            schema_before: None,
                            schema_after: None,
                            affected_rows: None,
                            affected_columns: None,
                            row_count: 0,
                            table_name: None,
                        }
                    }
                    StatementType::Dml => {
                        // Execute to get affected count, then rollback
                        let mut stmt = conn.inner().statement(statement).build()
                            .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

                        stmt.execute(&[])
                            .map_err(|e| AppError::QueryError(format!("Preview execution failed: {}", e)))?;
                        let affected = stmt.row_count().unwrap_or(0);

                        StatementPreview {
                            sql: statement.clone(),
                            statement_type: stmt_type,
                            schema_before: None,
                            schema_after: None,
                            affected_rows: None,
                            affected_columns: None,
                            row_count: affected as u64,
                            table_name,
                        }
                    }
                    StatementType::Ddl => {
                        StatementPreview {
                            sql: statement.clone(),
                            statement_type: stmt_type,
                            schema_before: None,
                            schema_after: None,
                            affected_rows: None,
                            affected_columns: None,
                            row_count: 0,
                            table_name,
                        }
                    }
                    StatementType::Other => {
                        StatementPreview {
                            sql: statement.clone(),
                            statement_type: stmt_type,
                            schema_before: None,
                            schema_after: None,
                            affected_rows: None,
                            affected_columns: None,
                            row_count: 0,
                            table_name,
                        }
                    }
                };

                previews.push(preview);
            }

            // Rollback to savepoint
            conn.inner().execute("ROLLBACK TO SAVEPOINT preview_point", &[])
                .map_err(|e| AppError::QueryError(format!("Failed to rollback: {}", e)))?;

            let execution_time_ms = start.elapsed().as_millis() as u64;

            Ok(PreviewResult {
                statements: previews,
                execution_time_ms,
                success: true,
                error: None,
                warning: None,
            })
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    async fn explain_query(&self, pool: PoolRef<'_>, sql: &str, _analyze: bool) -> AppResult<ExplainResult> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let sql = sql.to_string();

        tokio::task::spawn_blocking(move || {
            let start = Instant::now();

            // Generate unique statement ID
            let stmt_id = format!("EXPLAIN_{}", chrono::Utc::now().timestamp_millis());

            // Create explain plan
            let explain_sql = format!("EXPLAIN PLAN SET STATEMENT_ID = '{}' FOR {}", stmt_id, sql);
            conn.inner().execute(&explain_sql, &[])
                .map_err(|e| AppError::QueryError(format!("EXPLAIN PLAN failed: {}", e)))?;

            // Get the plan using DBMS_XPLAN
            let plan_sql = format!(
                "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', '{}', 'ALL'))",
                stmt_id
            );

            let mut stmt = conn.inner().statement(&plan_sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare plan query: {}", e)))?;

            let rows = stmt.query(&[])
                .map_err(|e| AppError::QueryError(format!("Plan query failed: {}", e)))?;

            let mut plan_text = Vec::new();
            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch plan row: {}", e)))?;
                let line: String = row.get(0).unwrap_or_default();
                plan_text.push(line);
            }

            // Clean up plan table entry
            let cleanup_sql = format!("DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = '{}'", stmt_id);
            let _ = conn.inner().execute(&cleanup_sql, &[]);

            let raw_output = plan_text.join("\n");
            let planning_time = start.elapsed().as_millis() as f64;

            // Parse plan into nodes (simplified)
            let plan_node = PlanNode {
                node_type: "Oracle Plan".to_string(),
                relation_name: None,
                alias: None,
                startup_cost: None,
                total_cost: None,
                plan_rows: None,
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
                children: vec![],
                warnings: vec![],
                extra_info: HashMap::new(),
            };

            Ok(ExplainResult {
                plan: plan_node,
                planning_time: Some(planning_time),
                execution_time: None,
                total_cost: 0.0,
                warnings: vec![],
                raw_output,
                database_type: "oracle".to_string(),
            })
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }

    fn generate_create_table_ddl(&self, table_def: &NewTableDefinition) -> AppResult<String> {
        let table_name = if let Some(ref schema) = table_def.schema {
            format!("{}.{}", schema, table_def.name)
        } else {
            table_def.name.clone()
        };

        let mut ddl = format!("CREATE TABLE {} (\n", table_name);
        let mut column_defs = Vec::new();

        for col in &table_def.columns {
            let mut col_def = format!("    {} {}", col.name, col.data_type.to_uppercase());

            // Add length/precision if specified
            if let Some(length) = col.length {
                col_def = format!("    {} {}({})", col.name, col.data_type.to_uppercase(), length);
            } else if let (Some(precision), Some(scale)) = (col.precision, col.scale) {
                col_def = format!("    {} {}({},{})", col.name, col.data_type.to_uppercase(), precision, scale);
            } else if let Some(precision) = col.precision {
                col_def = format!("    {} {}({})", col.name, col.data_type.to_uppercase(), precision);
            }

            if !col.nullable {
                col_def.push_str(" NOT NULL");
            }

            if let Some(default) = &col.default_value {
                if !default.is_empty() {
                    col_def.push_str(&format!(" DEFAULT {}", default));
                }
            }

            if col.is_unique {
                col_def.push_str(" UNIQUE");
            }

            column_defs.push(col_def);
        }

        // Add primary key constraint if any
        if !table_def.primary_key_columns.is_empty() {
            column_defs.push(format!(
                "    CONSTRAINT pk_{} PRIMARY KEY ({})",
                table_def.name.replace('.', "_"),
                table_def.primary_key_columns.join(", ")
            ));
        }

        // Add foreign key constraints
        for fk in &table_def.foreign_keys {
            let fk_name = fk.name.clone().unwrap_or_else(|| {
                format!("fk_{}_{}", table_def.name.replace('.', "_"), fk.columns.join("_"))
            });
            let on_delete = fk.on_delete.as_ref().map(|a| format!(" ON DELETE {}", a.to_sql())).unwrap_or_default();
            let on_update = fk.on_update.as_ref().map(|a| format!(" ON UPDATE {}", a.to_sql())).unwrap_or_default();

            column_defs.push(format!(
                "    CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {} ({}){}{}",
                fk_name,
                fk.columns.join(", "),
                fk.references_table,
                fk.references_columns.join(", "),
                on_delete,
                on_update
            ));
        }

        // Add check constraints
        for check in &table_def.check_constraints {
            let check_name = check.name.clone().unwrap_or_else(|| {
                format!("chk_{}_{}", table_def.name.replace('.', "_"), check.id)
            });
            column_defs.push(format!(
                "    CONSTRAINT {} CHECK ({})",
                check_name,
                check.expression
            ));
        }

        ddl.push_str(&column_defs.join(",\n"));
        ddl.push_str("\n)");

        Ok(ddl)
    }

    async fn get_referenceable_tables(&self, pool: PoolRef<'_>) -> AppResult<Vec<TableReferenceInfo>> {
        let pool = match pool {
            PoolRef::Oracle(p) => p,
            _ => return Err(AppError::QueryError("Invalid pool type for Oracle".to_string())),
        };

        let conn = pool.get().await
            .map_err(|e| AppError::ConnectionError(format!("Failed to get Oracle connection: {}", e)))?;

        let system_schemas = Self::system_schemas();
        let schema_filter = system_schemas.iter()
            .map(|s| format!("'{}'", s))
            .collect::<Vec<_>>()
            .join(", ");

        tokio::task::spawn_blocking(move || {
            let sql = format!(
                "SELECT DISTINCT t.owner || '.' || t.table_name as table_name,
                        t.owner as schema_name,
                        c.column_name as pk_column,
                        tc.data_type
                 FROM all_tables t
                 JOIN all_constraints cons ON t.owner = cons.owner AND t.table_name = cons.table_name
                 JOIN all_cons_columns c ON cons.constraint_name = c.constraint_name AND cons.owner = c.owner
                 JOIN all_tab_columns tc ON t.owner = tc.owner AND t.table_name = tc.table_name AND c.column_name = tc.column_name
                 WHERE cons.constraint_type = 'P'
                     AND t.owner NOT IN ({})
                 ORDER BY table_name, c.position",
                schema_filter
            );

            let mut stmt = conn.inner().statement(&sql).build()
                .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

            let rows = stmt.query(&[])
                .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

            let mut table_map: HashMap<String, TableReferenceInfo> = HashMap::new();

            for row_result in rows {
                let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;

                let full_table_name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
                let schema_name: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
                let pk_column: String = row.get(2).map_err(|e| AppError::QueryError(e.to_string()))?;
                let data_type: String = row.get(3).map_err(|e| AppError::QueryError(e.to_string()))?;

                let table_name = if full_table_name.contains('.') {
                    full_table_name.split('.').nth(1).unwrap_or(&full_table_name).to_string()
                } else {
                    full_table_name.clone()
                };

                table_map.entry(full_table_name)
                    .or_insert_with(|| TableReferenceInfo {
                        table_name,
                        schema: Some(schema_name),
                        primary_key_columns: Vec::new(),
                    })
                    .primary_key_columns.push(ColumnInfo {
                        name: pk_column,
                        data_type,
                        nullable: false,
                        is_primary_key: true,
                    });
            }

            Ok(table_map.into_values().collect())
        })
        .await
        .map_err(|e| AppError::QueryError(format!("Task join error: {}", e)))?
    }
}

impl OracleDriver {
    /// Construct table DDL manually when DBMS_METADATA is not available
    fn construct_table_ddl(conn: &OracleConnection, schema: &str, table: &str) -> AppResult<String> {
        let mut ddl = format!("CREATE TABLE {}.{} (\n", schema, table);

        // Get columns
        let cols_sql = "
            SELECT column_name, data_type, data_length, data_precision, data_scale, nullable, data_default
            FROM all_tab_columns
            WHERE owner = :1 AND table_name = :2
            ORDER BY column_id
        ";

        let mut stmt = conn.inner().statement(cols_sql).build()
            .map_err(|e| AppError::QueryError(format!("Failed to prepare statement: {}", e)))?;

        let rows = stmt.query(&[&schema, &table])
            .map_err(|e| AppError::QueryError(format!("Query failed: {}", e)))?;

        let mut col_defs = Vec::new();
        for row_result in rows {
            let row = row_result.map_err(|e| AppError::QueryError(format!("Failed to fetch row: {}", e)))?;

            let col_name: String = row.get(0).map_err(|e| AppError::QueryError(e.to_string()))?;
            let data_type: String = row.get(1).map_err(|e| AppError::QueryError(e.to_string()))?;
            let data_length: Option<i32> = row.get(2).ok();
            let data_precision: Option<i32> = row.get(3).ok();
            let data_scale: Option<i32> = row.get(4).ok();
            let nullable: String = row.get(5).map_err(|e| AppError::QueryError(e.to_string()))?;
            let default_value: Option<String> = row.get(6).ok();

            let formatted_type = Self::format_oracle_type(&data_type, data_length, data_precision, data_scale);

            let mut col_def = format!("    {} {}", col_name, formatted_type);

            if let Some(default) = default_value {
                let default = default.trim();
                if !default.is_empty() {
                    col_def.push_str(&format!(" DEFAULT {}", default));
                }
            }

            if nullable == "N" {
                col_def.push_str(" NOT NULL");
            }

            col_defs.push(col_def);
        }

        // Get primary key
        let pk_sql = "
            SELECT LISTAGG(cols.column_name, ', ') WITHIN GROUP (ORDER BY cols.position) as columns
            FROM all_constraints cons
            JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
            WHERE cons.constraint_type = 'P'
                AND cons.owner = :1
                AND cons.table_name = :2
        ";

        let mut stmt = conn.inner().statement(pk_sql).build()
            .map_err(|e| AppError::QueryError(format!("Failed to prepare PK statement: {}", e)))?;

        if let Ok(pk_columns) = stmt.query_row_as::<Option<String>>(&[&schema, &table]) {
            if let Some(pk_cols) = pk_columns {
                if !pk_cols.is_empty() {
                    col_defs.push(format!("    PRIMARY KEY ({})", pk_cols));
                }
            }
        }

        ddl.push_str(&col_defs.join(",\n"));
        ddl.push_str("\n)");

        Ok(ddl)
    }
}
