use crate::error::AppResult;
use crate::models::{
    AvailablePrivileges, ChangePasswordRequest, ConnectionConfig, ConstraintInfo,
    CreateIndexDefinition, CreateRoleRequest, CreateUserRequest, DatabasePermission, DatabaseRole,
    DatabaseUser, ExplainResult, IndexInfo, NewTableDefinition, NewViewDefinition,
    PermissionRequest, PreviewResult, QueryResult, RoleMembershipRequest, StandaloneIndexInfo,
    TableInfo, TableProperties, TableReferenceInfo, TableRelationship, TableSchema,
    TestConnectionResult, ViewInfo,
};
use async_trait::async_trait;
use sqlx::{PgPool, MySqlPool, SqlitePool};
use super::manager::{MssqlPool, OraclePool};

pub enum PoolRef<'a> {
    Postgres(&'a PgPool),
    MySql(&'a MySqlPool),
    Sqlite(&'a SqlitePool),
    Mssql(&'a MssqlPool),
    Oracle(&'a OraclePool),
}

impl Clone for PoolRef<'_> {
    fn clone(&self) -> Self {
        match self {
            PoolRef::Postgres(p) => PoolRef::Postgres(*p),
            PoolRef::MySql(p) => PoolRef::MySql(*p),
            PoolRef::Sqlite(p) => PoolRef::Sqlite(*p),
            PoolRef::Mssql(p) => PoolRef::Mssql(*p),
            PoolRef::Oracle(p) => PoolRef::Oracle(*p),
        }
    }
}

/// Trait defining the interface for database drivers
#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    /// Test the database connection
    async fn test_connection(&self, config: &ConnectionConfig) -> AppResult<TestConnectionResult>;

    /// Execute a SQL query and return results
    async fn execute_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<QueryResult>;

    /// Get list of tables in the database
    async fn get_tables(&self, pool: PoolRef<'_>, config: &ConnectionConfig) -> AppResult<Vec<TableInfo>>;

    /// Get schema for a specific table
    async fn get_table_schema(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableSchema>;

    /// Get schemas for all tables in the database
    async fn get_all_table_schemas(&self, pool: PoolRef<'_>, config: &ConnectionConfig) -> AppResult<Vec<TableSchema>>;

    /// Build a connection string from configuration
    fn build_connection_string(&self, config: &ConnectionConfig) -> String;

    /// Generate CREATE TABLE DDL for a table
    async fn generate_table_ddl(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<String>;

    /// Rename a table
    async fn rename_table(&self, pool: PoolRef<'_>, old_name: &str, new_name: &str) -> AppResult<QueryResult>;

    /// Get indexes for a table
    async fn get_indexes(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<IndexInfo>>;

    /// Get constraints for a table (CHECK, UNIQUE, EXCLUSION)
    async fn get_constraints(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<ConstraintInfo>>;

    /// Get full table properties including extended column info, indexes, and constraints
    async fn get_table_properties(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<TableProperties>;

    /// Get table relationships (foreign keys both inbound and outbound)
    async fn get_table_relationships(&self, pool: PoolRef<'_>, table_name: &str) -> AppResult<Vec<TableRelationship>>;

    /// Preview a query - execute in transaction, collect changes, rollback
    async fn preview_query(&self, pool: PoolRef<'_>, sql: &str) -> AppResult<PreviewResult>;

    /// Get execution plan for a SQL query
    async fn explain_query(&self, pool: PoolRef<'_>, sql: &str, analyze: bool) -> AppResult<ExplainResult>;

    /// Generate CREATE TABLE DDL from a table definition
    fn generate_create_table_ddl(&self, table_def: &NewTableDefinition) -> AppResult<String>;

    /// Get tables with their primary keys for foreign key reference picker
    async fn get_referenceable_tables(&self, pool: PoolRef<'_>) -> AppResult<Vec<TableReferenceInfo>>;

    // ============ User Management Methods ============

    /// Check if user management is supported for this database type
    fn supports_user_management(&self) -> bool {
        true
    }

    /// Get list of database users
    async fn get_users(&self, pool: PoolRef<'_>) -> AppResult<Vec<DatabaseUser>>;

    /// Create a new database user
    async fn create_user(&self, pool: PoolRef<'_>, request: &CreateUserRequest) -> AppResult<()>;

    /// Delete a database user
    async fn delete_user(
        &self,
        pool: PoolRef<'_>,
        username: &str,
        host: Option<&str>,
    ) -> AppResult<()>;

    /// Change a user's password
    async fn change_password(
        &self,
        pool: PoolRef<'_>,
        request: &ChangePasswordRequest,
    ) -> AppResult<()>;

    /// Get list of database roles
    async fn get_roles(&self, pool: PoolRef<'_>) -> AppResult<Vec<DatabaseRole>>;

    /// Create a new role
    async fn create_role(&self, pool: PoolRef<'_>, request: &CreateRoleRequest) -> AppResult<()>;

    /// Delete a role
    async fn delete_role(&self, pool: PoolRef<'_>, role_name: &str) -> AppResult<()>;

    /// Get permissions for a user or role
    async fn get_permissions(
        &self,
        pool: PoolRef<'_>,
        grantee: &str,
        host: Option<&str>,
    ) -> AppResult<Vec<DatabasePermission>>;

    /// Get available database-level privileges for this database type
    async fn get_available_privileges(&self, pool: PoolRef<'_>) -> AppResult<AvailablePrivileges>;

    /// Grant a database-level permission
    async fn grant_permission(
        &self,
        pool: PoolRef<'_>,
        request: &PermissionRequest,
    ) -> AppResult<()>;

    /// Revoke a database-level permission
    async fn revoke_permission(
        &self,
        pool: PoolRef<'_>,
        request: &PermissionRequest,
    ) -> AppResult<()>;

    /// Grant a role to a user
    async fn grant_role(&self, pool: PoolRef<'_>, request: &RoleMembershipRequest) -> AppResult<()>;

    /// Revoke a role from a user
    async fn revoke_role(&self, pool: PoolRef<'_>, request: &RoleMembershipRequest)
        -> AppResult<()>;

    // ============ View Management Methods ============

    /// Get list of views in the database
    async fn get_views(
        &self,
        pool: PoolRef<'_>,
        config: &ConnectionConfig,
    ) -> AppResult<Vec<ViewInfo>>;

    /// Get view DDL/definition
    async fn get_view_ddl(&self, pool: PoolRef<'_>, view_name: &str) -> AppResult<String>;

    /// Create a new view
    async fn create_view(
        &self,
        pool: PoolRef<'_>,
        view_def: &NewViewDefinition,
    ) -> AppResult<QueryResult>;

    /// Drop a view
    async fn drop_view(&self, pool: PoolRef<'_>, view_name: &str) -> AppResult<QueryResult>;

    // ============ Index Management Methods ============

    /// Get all indexes across all tables (standalone listing)
    async fn get_all_indexes(
        &self,
        pool: PoolRef<'_>,
        config: &ConnectionConfig,
    ) -> AppResult<Vec<StandaloneIndexInfo>>;

    /// Get index DDL
    async fn get_index_ddl(&self, pool: PoolRef<'_>, index_name: &str, table_name: Option<&str>) -> AppResult<String>;

    /// Create a new index
    async fn create_index(
        &self,
        pool: PoolRef<'_>,
        index_def: &CreateIndexDefinition,
    ) -> AppResult<QueryResult>;

    /// Drop an index
    async fn drop_index(
        &self,
        pool: PoolRef<'_>,
        index_name: &str,
        table_name: Option<&str>,
    ) -> AppResult<QueryResult>;
}

/// Factory function to get the appropriate driver for a database type
pub fn get_driver(config: &ConnectionConfig) -> Box<dyn DatabaseDriver> {
    use crate::models::DatabaseType;

    match config.database_type {
        DatabaseType::PostgreSQL => Box::new(super::PostgresDriver),
        DatabaseType::MySQL => Box::new(super::MySqlDriver),
        DatabaseType::SQLite => Box::new(super::SqliteDriver),
        DatabaseType::MSSQL => Box::new(super::MssqlDriver),
        DatabaseType::Oracle => Box::new(super::OracleDriver),
        // MariaDB is MySQL-compatible, reuse MySQL driver
        DatabaseType::MariaDB => Box::new(super::MySqlDriver),
        // CockroachDB is PostgreSQL-compatible, reuse PostgreSQL driver
        DatabaseType::CockroachDB => Box::new(super::PostgresDriver),
    }
}

