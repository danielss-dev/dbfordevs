use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{NewProcedureDefinition, ProcedureInfo, QueryResult};
use crate::storage;

/// Get all stored procedures for a connection
#[tauri::command]
pub async fn get_procedures(connection_id: String) -> AppResult<Vec<ProcedureInfo>> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_procedures(pool_ref, &config).await
}

/// Get DDL for a stored procedure
#[tauri::command]
pub async fn get_procedure_ddl(connection_id: String, procedure_name: String) -> AppResult<String> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_procedure_ddl(pool_ref, &procedure_name).await
}

/// Create a new stored procedure
#[tauri::command]
pub async fn create_procedure(
    connection_id: String,
    procedure_definition: NewProcedureDefinition,
) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_procedure(pool_ref, &procedure_definition).await
}

/// Drop a stored procedure
#[tauri::command]
pub async fn drop_procedure(connection_id: String, procedure_name: String) -> AppResult<QueryResult> {
    let manager = get_connection_manager().read().await;

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.drop_procedure(pool_ref, &procedure_name).await
}
