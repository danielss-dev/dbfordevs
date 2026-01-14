use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{
    AvailablePrivileges, ChangePasswordRequest, CreateRoleRequest, CreateUserRequest,
    DatabasePermission, DatabaseRole, DatabaseUser, PermissionRequest, RoleMembershipRequest,
};
use crate::storage;

#[tauri::command]
pub async fn supports_user_management(connection_id: String) -> AppResult<bool> {
    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection not found".to_string()))?;

    let driver = get_driver(&config);
    Ok(driver.supports_user_management())
}

#[tauri::command]
pub async fn get_users(connection_id: String) -> AppResult<Vec<DatabaseUser>> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_users(pool_ref).await
}

#[tauri::command]
pub async fn create_user(connection_id: String, request: CreateUserRequest) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_user(pool_ref, &request).await
}

#[tauri::command]
pub async fn delete_user(
    connection_id: String,
    username: String,
    host: Option<String>,
) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver
        .delete_user(pool_ref, &username, host.as_deref())
        .await
}

#[tauri::command]
pub async fn change_password(
    connection_id: String,
    request: ChangePasswordRequest,
) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.change_password(pool_ref, &request).await
}

#[tauri::command]
pub async fn get_roles(connection_id: String) -> AppResult<Vec<DatabaseRole>> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_roles(pool_ref).await
}

#[tauri::command]
pub async fn create_role(connection_id: String, request: CreateRoleRequest) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.create_role(pool_ref, &request).await
}

#[tauri::command]
pub async fn delete_role(connection_id: String, role_name: String) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.delete_role(pool_ref, &role_name).await
}

#[tauri::command]
pub async fn get_permissions(
    connection_id: String,
    grantee: String,
    host: Option<String>,
) -> AppResult<Vec<DatabasePermission>> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver
        .get_permissions(pool_ref, &grantee, host.as_deref())
        .await
}

#[tauri::command]
pub async fn get_available_privileges(connection_id: String) -> AppResult<AvailablePrivileges> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.get_available_privileges(pool_ref).await
}

#[tauri::command]
pub async fn grant_permission(
    connection_id: String,
    request: PermissionRequest,
) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.grant_permission(pool_ref, &request).await
}

#[tauri::command]
pub async fn revoke_permission(
    connection_id: String,
    request: PermissionRequest,
) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.revoke_permission(pool_ref, &request).await
}

#[tauri::command]
pub async fn grant_role(connection_id: String, request: RoleMembershipRequest) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.grant_role(pool_ref, &request).await
}

#[tauri::command]
pub async fn revoke_role(connection_id: String, request: RoleMembershipRequest) -> AppResult<()> {
    let manager = get_connection_manager().read().await;

    if !manager.is_connected(&connection_id) {
        return Err(AppError::ConnectionError(
            "Connection not found or not connected".to_string(),
        ));
    }

    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection config not found".to_string()))?;

    let driver = get_driver(&config);
    let pool_ref = manager.get_pool_ref(&connection_id)?;

    driver.revoke_role(pool_ref, &request).await
}
