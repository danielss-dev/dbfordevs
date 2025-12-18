use crate::error::{AppError, AppResult};
use crate::models::ConnectionConfig;
use dirs::data_dir;
use serde_json;
use std::fs;
use std::path::PathBuf;

const CONNECTIONS_FILE: &str = "connections.json";

/// Get the path to the connections storage file
fn get_connections_path() -> AppResult<PathBuf> {
    let data_dir = data_dir()
        .ok_or_else(|| AppError::ConfigError("Could not determine data directory".to_string()))?;
    
    let app_dir = data_dir.join("dbfordevs");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&app_dir)
        .map_err(|e| AppError::IoError(e))?;
    
    Ok(app_dir.join(CONNECTIONS_FILE))
}

/// Load all saved connections from storage
pub fn load_connections() -> AppResult<Vec<ConnectionConfig>> {
    let path = get_connections_path()?;
    
    if !path.exists() {
        return Ok(vec![]);
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| AppError::IoError(e))?;
    
    let connections: Vec<ConnectionConfig> = serde_json::from_str(&content)
        .map_err(|e| AppError::SerdeError(e))?;
    
    Ok(connections)
}

/// Save a connection to storage
pub fn save_connection(config: &ConnectionConfig) -> AppResult<()> {
    let mut connections = load_connections().unwrap_or_default();
    
    // Update existing or add new
    if let Some(id) = &config.id {
        if let Some(existing) = connections.iter_mut().find(|c| c.id.as_ref() == Some(id)) {
            *existing = config.clone();
        } else {
            connections.push(config.clone());
        }
    } else {
        connections.push(config.clone());
    }
    
    save_all_connections(&connections)
}

/// Delete a connection from storage
pub fn delete_connection(connection_id: &str) -> AppResult<()> {
    let mut connections = load_connections().unwrap_or_default();
    
    connections.retain(|c| c.id.as_ref() != Some(&connection_id.to_string()));
    
    save_all_connections(&connections)
}

/// Save all connections to storage
fn save_all_connections(connections: &[ConnectionConfig]) -> AppResult<()> {
    let path = get_connections_path()?;
    
    let content = serde_json::to_string_pretty(connections)
        .map_err(|e| AppError::SerdeError(e))?;
    
    fs::write(&path, content)
        .map_err(|e| AppError::IoError(e))?;
    
    Ok(())
}

/// Get a specific connection by ID
pub fn get_connection(connection_id: &str) -> AppResult<Option<ConnectionConfig>> {
    let connections = load_connections()?;
    
    Ok(connections.into_iter().find(|c| c.id.as_ref() == Some(&connection_id.to_string())))
}

