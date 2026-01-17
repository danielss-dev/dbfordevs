use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{NewTriggerDefinition, QueryResult, TriggerInfo};
use crate::storage;

/// Get all triggers for a connection
#[tauri::command]
pub async fn get_triggers(connection_id: String) -> AppResult<Vec<TriggerInfo>> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_triggers(pool_ref, &config).await
}

/// Get DDL for a trigger
#[tauri::command]
pub async fn get_trigger_ddl(
    connection_id: String,
    trigger_name: String,
    table_name: Option<String>,
) -> AppResult<String> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver
        .get_trigger_ddl(pool_ref, &trigger_name, table_name.as_deref())
        .await
}

/// Create a new trigger
#[tauri::command]
pub async fn create_trigger(
    connection_id: String,
    trigger_definition: NewTriggerDefinition,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_trigger(pool_ref, &trigger_definition).await
}

/// Drop a trigger
#[tauri::command]
pub async fn drop_trigger(
    connection_id: String,
    trigger_name: String,
    table_name: Option<String>,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver
        .drop_trigger(pool_ref, &trigger_name, table_name.as_deref())
        .await
}
