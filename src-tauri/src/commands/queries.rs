use crate::db::{get_connection_manager, get_driver, mssql::MssqlDriver};
use crate::error::{AppError, AppResult};
use crate::models::{
    DatabaseInfo, DatabaseType, ExplainRequest, ExplainResult, PreviewRequest, PreviewResult,
    QueryRequest, QueryResult, TableInfo, TableSchema
};
use crate::storage;

/// Quotes a single SQL identifier part based on database type.
/// Handles identifiers with spaces, special characters, or reserved words.
fn quote_single_identifier(identifier: &str, db_type: &DatabaseType) -> String {
    match db_type {
        DatabaseType::MySQL | DatabaseType::MariaDB => {
            // MySQL uses backticks, escape any backticks in the identifier
            format!("`{}`", identifier.replace('`', "``"))
        }
        DatabaseType::MSSQL => {
            // MSSQL uses brackets, escape closing brackets
            format!("[{}]", identifier.replace(']', "]]"))
        }
        DatabaseType::PostgreSQL | DatabaseType::SQLite | DatabaseType::CockroachDB => {
            // PostgreSQL, SQLite, and CockroachDB use double quotes
            format!("\"{}\"", identifier.replace('"', "\"\""))
        }
        DatabaseType::Oracle => {
            // Oracle uses double quotes
            format!("\"{}\"", identifier.replace('"', "\"\""))
        }
        DatabaseType::Redis | DatabaseType::MongoDB | DatabaseType::Cassandra => {
            // NoSQL databases don't use SQL identifiers, but return as-is for completeness
            identifier.to_string()
        }
    }
}

/// Returns the placeholder syntax for a given database type and 1-based parameter index.
fn placeholder(db_type: &DatabaseType, index: usize) -> String {
    match db_type {
        DatabaseType::PostgreSQL | DatabaseType::CockroachDB => format!("${}", index),
        DatabaseType::MySQL | DatabaseType::MariaDB | DatabaseType::SQLite => "?".to_string(),
        DatabaseType::MSSQL => format!("@P{}", index),
        DatabaseType::Oracle => format!(":{}", index),
        _ => format!("${}", index),
    }
}

/// Returns a PostgreSQL type cast for a column data type, if needed.
fn postgres_cast_for_type(db_type: &DatabaseType, data_type: Option<&String>) -> Option<&'static str> {
    if !matches!(db_type, DatabaseType::PostgreSQL | DatabaseType::CockroachDB) {
        return None;
    }

    let data_type = data_type?;
    let normalized = data_type.to_lowercase();

    if normalized == "timestamp without time zone" || normalized == "timestamp" {
        Some("timestamp")
    } else if normalized == "timestamp with time zone" {
        Some("timestamptz")
    } else if normalized == "time without time zone" || normalized == "time" {
        Some("time")
    } else if normalized == "time with time zone" {
        Some("timetz")
    } else if normalized == "date" {
        Some("date")
    } else if normalized == "uuid" {
        Some("uuid")
    } else {
        None
    }
}

/// Formats a WHERE clause condition for parameterized queries.
/// For NULL values, returns ("col IS NULL", None) since NULL can't be parameterized in WHERE.
/// For non-NULL values, returns ("col = $N", Some(value)) and advances the index.
fn format_parameterized_where_condition(
    col: &str,
    value: &serde_json::Value,
    db_type: &DatabaseType,
    param_index: &mut usize,
) -> (String, Option<serde_json::Value>) {
    let quoted_col = quote_single_identifier(col, db_type);
    if value.is_null() {
        (format!("{} IS NULL", quoted_col), None)
    } else {
        let ph = placeholder(db_type, *param_index);
        *param_index += 1;
        (format!("{} = {}", quoted_col, ph), Some(value.clone()))
    }
}

/// Quotes a SQL identifier (table name, column name, etc.) based on database type.
/// Handles schema-qualified names like "public.table name" by quoting each part separately.
/// Example: "public.comments 2" becomes "\"public\".\"comments 2\"" for PostgreSQL.
fn quote_identifier(identifier: &str, db_type: &DatabaseType) -> String {
    identifier
        .split('.')
        .map(|part| quote_single_identifier(part, db_type))
        .collect::<Vec<_>>()
        .join(".")
}

/// Execute a SQL query against a connected database
#[tauri::command]
pub async fn execute_query(request: QueryRequest) -> Result<QueryResult, AppError> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&request.connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    // Get config to determine driver type
    let config = storage::get_connection(&request.connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&request.connection_id)?;
    
    // Apply limit/offset if provided
    let mut sql = request.sql.clone();
    if let Some(limit) = request.limit {
        if !sql.to_uppercase().contains("LIMIT") {
            sql.push_str(&format!(" LIMIT {}", limit));
            if let Some(offset) = request.offset {
                sql.push_str(&format!(" OFFSET {}", offset));
            }
        }
    }
    
    driver.execute_query(pool_ref, &sql).await
}

/// Preview a SQL query - executes in transaction, collects changes, then rolls back
#[tauri::command]
pub async fn preview_query(request: PreviewRequest) -> Result<PreviewResult, AppError> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&request.connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    // Get config to determine driver type
    let config = storage::get_connection(&request.connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&request.connection_id)?;

    driver.preview_query(pool_ref, &request.sql).await
}

/// Get list of tables in the connected database
#[tauri::command]
pub async fn get_tables(connection_id: String) -> AppResult<Vec<TableInfo>> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;
    
    driver.get_tables(pool_ref, &config).await
}

/// Get schema information for a specific table
#[tauri::command]
pub async fn get_table_schema(
    connection_id: String,
    table_name: String,
) -> AppResult<TableSchema> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;
    
    driver.get_table_schema(pool_ref, &table_name).await
}

/// Get schemas for all tables in the connected database
#[tauri::command]
pub async fn get_all_table_schemas(
    connection_id: String,
) -> AppResult<Vec<TableSchema>> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;
    
    driver.get_all_table_schemas(pool_ref, &config).await
}

/// Insert a new row into a table
#[tauri::command]
pub async fn insert_row(
    connection_id: String,
    table_name: String,
    values: std::collections::HashMap<String, serde_json::Value>,
) -> AppResult<QueryResult> {
    if values.is_empty() {
        return Err(AppError::ValidationError("No values provided for insert".to_string()));
    }

    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    let column_type_map: std::collections::HashMap<String, String> =
        if matches!(config.database_type, DatabaseType::PostgreSQL | DatabaseType::CockroachDB) {
            let schema = driver.get_table_schema(pool_ref.clone(), &table_name).await?;
            schema
                .columns
                .into_iter()
                .map(|col| (col.name, col.data_type))
                .collect()
        } else {
            std::collections::HashMap::new()
        };

    // Build parameterized INSERT statement
    let quoted_table = quote_identifier(&table_name, &config.database_type);

    let entries: Vec<_> = values.iter().collect();
    let columns: Vec<String> = entries.iter()
        .map(|(k, _)| quote_single_identifier(k, &config.database_type))
        .collect();

    let mut params: Vec<serde_json::Value> = Vec::with_capacity(entries.len());
    let placeholders: Vec<String> = entries.iter().enumerate()
        .map(|(i, (k, v))| {
            params.push((*v).clone());
            let mut ph = placeholder(&config.database_type, i + 1);
            if let Some(cast) = postgres_cast_for_type(&config.database_type, column_type_map.get(*k)) {
                ph = format!("{}::{}", ph, cast);
            }
            ph
        })
        .collect();

    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        quoted_table,
        columns.join(", "),
        placeholders.join(", ")
    );

    driver.execute_parameterized(pool_ref, &sql, params).await
}

/// Update a row in a table
#[tauri::command]
pub async fn update_row(
    connection_id: String,
    table_name: String,
    primary_key: std::collections::HashMap<String, serde_json::Value>,
    values: std::collections::HashMap<String, serde_json::Value>,
) -> AppResult<QueryResult> {
    if values.is_empty() {
        return Err(AppError::ValidationError("No values provided for update".to_string()));
    }
    if primary_key.is_empty() {
        return Err(AppError::ValidationError("No primary key provided for update".to_string()));
    }

    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    // Build parameterized UPDATE statement
    let quoted_table = quote_identifier(&table_name, &config.database_type);
    let mut params: Vec<serde_json::Value> = Vec::new();
    let mut param_index: usize = 1;

    // Build SET clauses with parameter placeholders
    let set_clauses: Vec<String> = values.iter().map(|(k, v)| {
        let quoted_col = quote_single_identifier(k, &config.database_type);
        let ph = placeholder(&config.database_type, param_index);
        param_index += 1;
        params.push(v.clone());
        format!("{} = {}", quoted_col, ph)
    }).collect();

    // Build WHERE clauses — NULL values use IS NULL (no param), others use placeholders
    let mut where_clauses: Vec<String> = Vec::new();
    for (k, v) in &primary_key {
        let (clause, param) = format_parameterized_where_condition(k, v, &config.database_type, &mut param_index);
        where_clauses.push(clause);
        if let Some(p) = param {
            params.push(p);
        }
    }

    let sql = format!(
        "UPDATE {} SET {} WHERE {}",
        quoted_table,
        set_clauses.join(", "),
        where_clauses.join(" AND ")
    );

    driver.execute_parameterized(pool_ref, &sql, params).await
}

/// Delete a row from a table
#[tauri::command]
pub async fn delete_row(
    connection_id: String,
    table_name: String,
    primary_key: std::collections::HashMap<String, serde_json::Value>,
) -> AppResult<QueryResult> {
    if primary_key.is_empty() {
        return Err(AppError::ValidationError("No primary key provided for delete".to_string()));
    }

    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    // Build parameterized DELETE statement
    let quoted_table = quote_identifier(&table_name, &config.database_type);
    let mut params: Vec<serde_json::Value> = Vec::new();
    let mut param_index: usize = 1;

    // Build WHERE clauses — NULL values use IS NULL (no param), others use placeholders
    let mut where_clauses: Vec<String> = Vec::new();
    for (k, v) in &primary_key {
        let (clause, param) = format_parameterized_where_condition(k, v, &config.database_type, &mut param_index);
        where_clauses.push(clause);
        if let Some(p) = param {
            params.push(p);
        }
    }

    let sql = format!(
        "DELETE FROM {} WHERE {}",
        quoted_table,
        where_clauses.join(" AND ")
    );

    driver.execute_parameterized(pool_ref, &sql, params).await
}

/// Drop a table from the database
#[tauri::command]
pub async fn drop_table(
    connection_id: String,
    table_name: String,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    // Build DROP TABLE with properly quoted identifier
    let quoted_table = quote_identifier(&table_name, &config.database_type);
    let sql = format!("DROP TABLE {}", quoted_table);

    driver.execute_query(pool_ref, &sql).await
}

/// Get execution plan for a SQL query
#[tauri::command]
pub async fn explain_query(request: ExplainRequest) -> Result<ExplainResult, AppError> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&request.connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    // Get config to determine driver type
    let config = storage::get_connection(&request.connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&request.connection_id)?;

    driver.explain_query(pool_ref, &request.sql, request.analyze).await
}

/// Get list of all databases on a MSSQL server (similar to SSMS Object Explorer)
#[tauri::command]
pub async fn get_mssql_databases(connection_id: String) -> AppResult<Vec<DatabaseInfo>> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    // This command is only for MSSQL
    if config.database_type != DatabaseType::MSSQL {
        return Err(AppError::QueryError("This command is only available for MSSQL connections".to_string()));
    }

    let pool_ref = manager.get_pool_ref(&connection_id)?;
    let driver = MssqlDriver;

    driver.get_databases(pool_ref).await
}

/// Get tables from a specific database on a MSSQL server
/// This allows browsing tables in any accessible database without switching context
#[tauri::command]
pub async fn get_mssql_database_tables(connection_id: String, database_name: String) -> AppResult<Vec<TableInfo>> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    // This command is only for MSSQL
    if config.database_type != DatabaseType::MSSQL {
        return Err(AppError::QueryError("This command is only available for MSSQL connections".to_string()));
    }

    let pool_ref = manager.get_pool_ref(&connection_id)?;
    let driver = MssqlDriver;

    driver.get_database_tables(pool_ref, &database_name).await
}

/// Create a new database on a MSSQL server
/// Only available for MSSQL connections without a specific database configured
#[tauri::command]
pub async fn create_mssql_database(connection_id: String, database_name: String) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    // This command is only for MSSQL
    if config.database_type != DatabaseType::MSSQL {
        return Err(AppError::QueryError("This command is only available for MSSQL connections".to_string()));
    }

    let pool_ref = manager.get_pool_ref(&connection_id)?;
    let driver = MssqlDriver;

    driver.create_database(pool_ref, &database_name).await
}

/// Drop a database from a MSSQL server
/// This will forcefully close all connections to the database before dropping
/// Only available for MSSQL connections without a specific database configured
#[tauri::command]
pub async fn drop_mssql_database(connection_id: String, database_name: String) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    // This command is only for MSSQL
    if config.database_type != DatabaseType::MSSQL {
        return Err(AppError::QueryError("This command is only available for MSSQL connections".to_string()));
    }

    let pool_ref = manager.get_pool_ref(&connection_id)?;
    let driver = MssqlDriver;

    driver.drop_database(pool_ref, &database_name).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_placeholder_postgres() {
        assert_eq!(placeholder(&DatabaseType::PostgreSQL, 1), "$1");
        assert_eq!(placeholder(&DatabaseType::PostgreSQL, 3), "$3");
    }

    #[test]
    fn test_placeholder_cockroachdb() {
        assert_eq!(placeholder(&DatabaseType::CockroachDB, 1), "$1");
    }

    #[test]
    fn test_placeholder_mysql() {
        assert_eq!(placeholder(&DatabaseType::MySQL, 1), "?");
        assert_eq!(placeholder(&DatabaseType::MySQL, 5), "?");
    }

    #[test]
    fn test_placeholder_mariadb() {
        assert_eq!(placeholder(&DatabaseType::MariaDB, 1), "?");
    }

    #[test]
    fn test_placeholder_sqlite() {
        assert_eq!(placeholder(&DatabaseType::SQLite, 1), "?");
    }

    #[test]
    fn test_placeholder_mssql() {
        assert_eq!(placeholder(&DatabaseType::MSSQL, 1), "@P1");
        assert_eq!(placeholder(&DatabaseType::MSSQL, 4), "@P4");
    }

    #[test]
    fn test_placeholder_oracle() {
        assert_eq!(placeholder(&DatabaseType::Oracle, 1), ":1");
        assert_eq!(placeholder(&DatabaseType::Oracle, 2), ":2");
    }

    #[test]
    fn test_format_parameterized_where_null() {
        let mut idx = 1;
        let (clause, param) = format_parameterized_where_condition(
            "col", &json!(null), &DatabaseType::PostgreSQL, &mut idx,
        );
        assert_eq!(clause, "\"col\" IS NULL");
        assert!(param.is_none());
        assert_eq!(idx, 1); // index not advanced for NULL
    }

    #[test]
    fn test_format_parameterized_where_value_pg() {
        let mut idx = 1;
        let (clause, param) = format_parameterized_where_condition(
            "id", &json!(42), &DatabaseType::PostgreSQL, &mut idx,
        );
        assert_eq!(clause, "\"id\" = $1");
        assert_eq!(param, Some(json!(42)));
        assert_eq!(idx, 2);
    }

    #[test]
    fn test_format_parameterized_where_value_mysql() {
        let mut idx = 3;
        let (clause, param) = format_parameterized_where_condition(
            "name", &json!("test"), &DatabaseType::MySQL, &mut idx,
        );
        assert_eq!(clause, "`name` = ?");
        assert_eq!(param, Some(json!("test")));
        assert_eq!(idx, 4);
    }

    #[test]
    fn test_format_parameterized_where_value_mssql() {
        let mut idx = 2;
        let (clause, param) = format_parameterized_where_condition(
            "id", &json!(1), &DatabaseType::MSSQL, &mut idx,
        );
        assert_eq!(clause, "[id] = @P2");
        assert_eq!(param, Some(json!(1)));
        assert_eq!(idx, 3);
    }

    #[test]
    fn test_format_parameterized_where_value_oracle() {
        let mut idx = 1;
        let (clause, param) = format_parameterized_where_condition(
            "id", &json!(99), &DatabaseType::Oracle, &mut idx,
        );
        assert_eq!(clause, "\"id\" = :1");
        assert_eq!(param, Some(json!(99)));
        assert_eq!(idx, 2);
    }
}
