use crate::db::{DatabaseDriver, PoolRef};
use crate::error::{AppError, AppResult};
use crate::models::{
    ColumnInfo, ConnectionConfig, ConstraintInfo, ExtendedColumnInfo, ForeignKeyInfo,
    IndexInfo, QueryResult, TableInfo, TableProperties, TableRelationship, TableSchema,
    TestConnectionResult,
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

        // Execute multiple statements in a transaction
        let mut client = pool.get().await
            .map_err(|e| AppError::QueryError(format!("Failed to get connection from pool: {}", e)))?;

        // Begin transaction
        let begin_query = Query::new("BEGIN TRANSACTION");
        begin_query.execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to start transaction: {}", e)))?;

        let mut final_result = QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: None,
            execution_time_ms: 0,
        };

        for (i, stmt) in statements.iter().enumerate() {
            match Self::execute_single_query(&mut *client, stmt, start).await {
                Ok(result) => {
                    // Keep the last statement's result (similar to PostgreSQL behavior)
                    if i == statements.len() - 1 || !result.rows.is_empty() {
                        final_result = result;
                    }
                }
                Err(e) => {
                    // Rollback on error
                    let rollback_query = Query::new("ROLLBACK TRANSACTION");
                    let _ = rollback_query.execute(&mut *client).await;
                    return Err(e);
                }
            }
        }

        // Commit transaction
        let commit_query = Query::new("COMMIT TRANSACTION");
        commit_query.execute(&mut *client).await
            .map_err(|e| AppError::QueryError(format!("Failed to commit transaction: {}", e)))?;

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
