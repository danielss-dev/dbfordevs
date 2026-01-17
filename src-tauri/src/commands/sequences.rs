use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{NewSequenceDefinition, QueryResult, SequenceInfo};
use crate::storage;

/// Get all sequences for a connection
#[tauri::command]
pub async fn get_sequences(connection_id: String) -> AppResult<Vec<SequenceInfo>> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_sequences(pool_ref, &config).await
}

/// Get DDL for a sequence
#[tauri::command]
pub async fn get_sequence_ddl(connection_id: String, sequence_name: String) -> AppResult<String> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_sequence_ddl(pool_ref, &sequence_name).await
}

/// Create a new sequence
#[tauri::command]
pub async fn create_sequence(
    connection_id: String,
    sequence_definition: NewSequenceDefinition,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_sequence(pool_ref, &sequence_definition).await
}

/// Drop a sequence
#[tauri::command]
pub async fn drop_sequence(connection_id: String, sequence_name: String) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.drop_sequence(pool_ref, &sequence_name).await
}
