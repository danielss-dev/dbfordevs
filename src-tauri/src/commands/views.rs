use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{NewViewDefinition, QueryResult, ViewInfo};
use crate::storage;

/// Get all views for a connection
#[tauri::command]
pub async fn get_views(connection_id: String) -> AppResult<Vec<ViewInfo>> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_views(pool_ref, &config).await
}

/// Get view DDL/definition
#[tauri::command]
pub async fn get_view_ddl(connection_id: String, view_name: String) -> AppResult<String> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_view_ddl(pool_ref, &view_name).await
}

/// Create a new view
#[tauri::command]
pub async fn create_view(
    connection_id: String,
    view_definition: NewViewDefinition,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_view(pool_ref, &view_definition).await
}

/// Drop a view
#[tauri::command]
pub async fn drop_view(connection_id: String, view_name: String) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.drop_view(pool_ref, &view_name).await
}
