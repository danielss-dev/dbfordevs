use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{CreateIndexDefinition, QueryResult, StandaloneIndexInfo};
use crate::storage;

/// Get all indexes for a connection
#[tauri::command]
pub async fn get_all_indexes(connection_id: String) -> AppResult<Vec<StandaloneIndexInfo>> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_all_indexes(pool_ref, &config).await
}

/// Get index DDL
#[tauri::command]
pub async fn get_index_ddl(
    connection_id: String,
    index_name: String,
    table_name: Option<String>,
) -> AppResult<String> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver
        .get_index_ddl(pool_ref, &index_name, table_name.as_deref())
        .await
}

/// Create a new index
#[tauri::command]
pub async fn create_index(
    connection_id: String,
    index_definition: CreateIndexDefinition,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_index(pool_ref, &index_definition).await
}

/// Drop an index
#[tauri::command]
pub async fn drop_index(
    connection_id: String,
    index_name: String,
    table_name: Option<String>,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver
        .drop_index(pool_ref, &index_name, table_name.as_deref())
        .await
}
