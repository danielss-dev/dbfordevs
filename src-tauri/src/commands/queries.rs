use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{
    DatabaseType, ExplainRequest, ExplainResult, PreviewRequest, PreviewResult,
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
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    // Build INSERT statement with properly quoted identifiers
    let quoted_table = quote_identifier(&table_name, &config.database_type);
    let columns: Vec<String> = values.keys()
        .map(|k| quote_single_identifier(k, &config.database_type))
        .collect();

    // For now, execute as a simple query - in production, use parameterized queries
    let values_str: Vec<String> = values.values().map(|v| {
        match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace('\'', "''")),
        }
    }).collect();

    let sql_with_values = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        quoted_table,
        columns.join(", "),
        values_str.join(", ")
    );

    driver.execute_query(pool_ref, &sql_with_values).await
}

/// Update a row in a table
#[tauri::command]
pub async fn update_row(
    connection_id: String,
    table_name: String,
    primary_key: std::collections::HashMap<String, serde_json::Value>,
    values: std::collections::HashMap<String, serde_json::Value>,
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

    // Build UPDATE statement with properly quoted identifiers
    let quoted_table = quote_identifier(&table_name, &config.database_type);

    let set_clauses: Vec<String> = values.iter().map(|(k, v)| {
        let quoted_col = quote_single_identifier(k, &config.database_type);
        let value_str = match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace('\'', "''")),
        };
        format!("{} = {}", quoted_col, value_str)
    }).collect();

    let where_clauses: Vec<String> = primary_key.iter().map(|(k, v)| {
        let quoted_col = quote_single_identifier(k, &config.database_type);
        let value_str = match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace('\'', "''")),
        };
        format!("{} = {}", quoted_col, value_str)
    }).collect();

    let sql = format!(
        "UPDATE {} SET {} WHERE {}",
        quoted_table,
        set_clauses.join(", "),
        where_clauses.join(" AND ")
    );

    driver.execute_query(pool_ref, &sql).await
}

/// Delete a row from a table
#[tauri::command]
pub async fn delete_row(
    connection_id: String,
    table_name: String,
    primary_key: std::collections::HashMap<String, serde_json::Value>,
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

    // Build DELETE statement with properly quoted identifiers
    let quoted_table = quote_identifier(&table_name, &config.database_type);

    let where_clauses: Vec<String> = primary_key.iter().map(|(k, v)| {
        let quoted_col = quote_single_identifier(k, &config.database_type);
        let value_str = match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace('\'', "''")),
        };
        format!("{} = {}", quoted_col, value_str)
    }).collect();

    let sql = format!(
        "DELETE FROM {} WHERE {}",
        quoted_table,
        where_clauses.join(" AND ")
    );

    driver.execute_query(pool_ref, &sql).await
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

