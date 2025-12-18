use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{QueryRequest, QueryResult, TableInfo, TableSchema};
use crate::storage;

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

/// Get list of tables in the connected database
#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_tables(connectionId: String) -> AppResult<Vec<TableInfo>> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connectionId) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connectionId)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connectionId)?;
    
    driver.get_tables(pool_ref).await
}

/// Get schema information for a specific table
#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_table_schema(
    connectionId: String,
    tableName: String,
) -> AppResult<TableSchema> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connectionId) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connectionId)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connectionId)?;
    
    driver.get_table_schema(pool_ref, &tableName).await
}

/// Insert a new row into a table
#[tauri::command]
#[allow(non_snake_case)]
pub async fn insert_row(
    connectionId: String,
    tableName: String,
    values: std::collections::HashMap<String, serde_json::Value>,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connectionId) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connectionId)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connectionId)?;
    
    // Build INSERT statement
    let columns: Vec<String> = values.keys().cloned().collect();
    
    // For now, execute as a simple query - in production, use parameterized queries
    let values_str: Vec<String> = values.values().map(|v| {
        match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace("'", "''")),
        }
    }).collect();
    
    let sql_with_values = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        tableName,
        columns.join(", "),
        values_str.join(", ")
    );
    
    driver.execute_query(pool_ref, &sql_with_values).await
}

/// Update a row in a table
#[tauri::command]
#[allow(non_snake_case)]
pub async fn update_row(
    connectionId: String,
    tableName: String,
    primaryKey: std::collections::HashMap<String, serde_json::Value>,
    values: std::collections::HashMap<String, serde_json::Value>,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connectionId) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connectionId)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connectionId)?;
    
    // Build UPDATE statement with WHERE clause from primary key
    let set_clauses: Vec<String> = values.iter().map(|(k, v)| {
        let value_str = match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace("'", "''")),
        };
        format!("{} = {}", k, value_str)
    }).collect();
    
    let where_clauses: Vec<String> = primaryKey.iter().map(|(k, v)| {
        let value_str = match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace("'", "''")),
        };
        format!("{} = {}", k, value_str)
    }).collect();
    
    let sql = format!(
        "UPDATE {} SET {} WHERE {}",
        tableName,
        set_clauses.join(", "),
        where_clauses.join(" AND ")
    );
    
    driver.execute_query(pool_ref, &sql).await
}

/// Delete a row from a table
#[tauri::command]
#[allow(non_snake_case)]
pub async fn delete_row(
    connectionId: String,
    tableName: String,
    primaryKey: std::collections::HashMap<String, serde_json::Value>,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connectionId) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connectionId)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connectionId)?;
    
    // Build DELETE statement with WHERE clause from primary key
    let where_clauses: Vec<String> = primaryKey.iter().map(|(k, v)| {
        let value_str = match v {
            serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "NULL".to_string(),
            _ => format!("'{}'", v.to_string().replace("'", "''")),
        };
        format!("{} = {}", k, value_str)
    }).collect();
    
    let sql = format!(
        "DELETE FROM {} WHERE {}",
        tableName,
        where_clauses.join(" AND ")
    );
    
    driver.execute_query(pool_ref, &sql).await
}

/// Drop a table from the database
#[tauri::command]
#[allow(non_snake_case)]
pub async fn drop_table(
    connectionId: String,
    tableName: String,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;
    
    // Verify connection exists
    if !manager.is_connected(&connectionId) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }
    
    let config = storage::get_connection(&connectionId)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;
    
    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connectionId)?;
    
    let sql = format!("DROP TABLE {}", tableName);
    
    driver.execute_query(pool_ref, &sql).await
}

