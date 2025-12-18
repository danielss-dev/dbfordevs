use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{ConnectionConfig, ConnectionInfo, TestConnectionResult};
use crate::storage;

/// Test a database connection with the provided configuration
#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> Result<TestConnectionResult, AppError> {
    let driver = get_driver(&config);
    driver.test_connection(&config).await
}

/// Save a connection configuration
#[tauri::command]
pub async fn save_connection(config: ConnectionConfig) -> AppResult<ConnectionInfo> {
    let id = config.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    
    // Create config with ID
    let mut config_with_id = config.clone();
    config_with_id.id = Some(id.clone());
    
    // Save to storage
    storage::save_connection(&config_with_id)?;
    
    Ok(ConnectionInfo {
        id,
        name: config.name,
        database_type: config.database_type,
        host: config.host,
        database: config.database,
        connected: false,
    })
}

/// Connect to a database
#[tauri::command]
#[allow(non_snake_case)]
pub async fn connect(connectionId: String) -> AppResult<bool> {
    let config = storage::get_connection(&connectionId)?
        .ok_or_else(|| AppError::ConfigError("Connection not found".to_string()))?;
    
    let mut manager = get_connection_manager().write().await;
    manager.connect(connectionId.clone(), &config).await?;
    
    Ok(true)
}

/// Disconnect from a database
#[tauri::command]
#[allow(non_snake_case)]
pub async fn disconnect(connectionId: String) -> AppResult<bool> {
    let mut manager = get_connection_manager().write().await;
    manager.disconnect(&connectionId).await?;
    Ok(true)
}

/// List all saved connections
#[tauri::command]
pub async fn list_connections() -> AppResult<Vec<ConnectionInfo>> {
    let connections = storage::load_connections()?;
    let manager = get_connection_manager().read().await;
    
    let connection_infos: Vec<ConnectionInfo> = connections
        .into_iter()
        .map(|config| {
            let id = config.id.clone().unwrap_or_default();
            ConnectionInfo {
                id: id.clone(),
                name: config.name,
                database_type: config.database_type,
                host: config.host,
                database: config.database,
                connected: manager.is_connected(&id),
            }
        })
        .collect();
    
    Ok(connection_infos)
}

/// Delete a saved connection
#[tauri::command]
#[allow(non_snake_case)]
pub async fn delete_connection(connectionId: String) -> AppResult<bool> {
    // Disconnect if connected
    let mut manager = get_connection_manager().write().await;
    if manager.is_connected(&connectionId) {
        manager.disconnect(&connectionId).await?;
    }

    // Remove from storage
    storage::delete_connection(&connectionId)?;

    Ok(true)
}

/// Get a connection configuration by ID
#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_connection(connectionId: String) -> AppResult<Option<ConnectionConfig>> {
    storage::get_connection(&connectionId)
}

