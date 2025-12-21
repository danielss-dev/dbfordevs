use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{QueryResult, TableProperties, TableRelationship};
use crate::storage;

/// Generate CREATE TABLE DDL for a table
#[tauri::command]
pub async fn generate_table_ddl(
    connection_id: String,
    table_name: String,
) -> AppResult<String> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.generate_table_ddl(pool_ref, &table_name).await
}

/// Rename a table
#[tauri::command]
pub async fn rename_table(
    connection_id: String,
    old_name: String,
    new_name: String,
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

    driver.rename_table(pool_ref, &old_name, &new_name).await
}

/// Get full table properties including extended column info, indexes, and constraints
#[tauri::command]
pub async fn get_table_properties(
    connection_id: String,
    table_name: String,
) -> AppResult<TableProperties> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_table_properties(pool_ref, &table_name).await
}

/// Get table relationships (foreign keys both inbound and outbound)
#[tauri::command]
pub async fn get_table_relationships(
    connection_id: String,
    table_name: String,
) -> AppResult<Vec<TableRelationship>> {
    let manager = get_connection_manager().read().await;

    // Verify connection exists
    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError("Connection not found or not connected".to_string()));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_table_relationships(pool_ref, &table_name).await
}
