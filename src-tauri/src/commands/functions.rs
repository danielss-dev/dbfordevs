use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{FunctionInfo, NewFunctionDefinition, QueryResult};
use crate::storage;

/// Get all functions for a connection
#[tauri::command]
pub async fn get_functions(connection_id: String) -> AppResult<Vec<FunctionInfo>> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_functions(pool_ref, &config).await
}

/// Get DDL for a function
#[tauri::command]
pub async fn get_function_ddl(connection_id: String, function_name: String) -> AppResult<String> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_function_ddl(pool_ref, &function_name).await
}

/// Create a new function
#[tauri::command]
pub async fn create_function(
    connection_id: String,
    function_definition: NewFunctionDefinition,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_function(pool_ref, &function_definition).await
}

/// Drop a function
#[tauri::command]
pub async fn drop_function(connection_id: String, function_name: String) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.drop_function(pool_ref, &function_name).await
}
