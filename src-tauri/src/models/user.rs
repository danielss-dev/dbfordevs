use serde::{Deserialize, Serialize};

/// Database user information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseUser {
    pub name: String,
    pub host: Option<String>, // MySQL specific (user@host)
    pub is_superuser: bool,
    pub can_login: bool,
    pub roles: Vec<String>,
}

/// Database role information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseRole {
    pub name: String,
    pub is_system_role: bool,
    pub members: Vec<String>,
}

/// Permission/privilege information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabasePermission {
    pub privilege: String,
    pub grantee: String,
    pub is_grantable: bool,
}

/// Available database-level privileges for a database type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailablePrivileges {
    pub database_privileges: Vec<String>,
}

/// Request to create a new user
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub host: Option<String>, // MySQL: default '%'
}

/// Request to change a user's password
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordRequest {
    pub username: String,
    pub host: Option<String>, // MySQL specific
    pub new_password: String,
}

/// Request to create a new role
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoleRequest {
    pub role_name: String,
}

/// Request to grant/revoke permissions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequest {
    pub grantee: String,
    pub host: Option<String>, // MySQL specific
    pub privilege: String,
    pub with_grant_option: bool,
}

/// Request to assign/remove role membership
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleMembershipRequest {
    pub role_name: String,
    pub member_name: String,
    pub member_host: Option<String>, // MySQL specific
}
