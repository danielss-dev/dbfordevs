use crate::error::AppResult;
use crate::models::{
    ConnectionConfig, ConstraintInfo, IndexInfo, QueryResult, TableInfo,
    TableProperties, TableRelationship, TableSchema, TestConnectionResult
};
use async_trait::async_trait;
use sqlx::{PgPool, MySqlPool, SqlitePool};

pub enum PoolRef<'a> {
    Postgres(&'a PgPool),
    MySql(&'a MySqlPool),
    Sqlite(&'a SqlitePool),
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
}

/// Factory function to get the appropriate driver for a database type
pub fn get_driver(config: &ConnectionConfig) -> Box<dyn DatabaseDriver> {
    use crate::models::DatabaseType;
    
    match config.database_type {
        DatabaseType::PostgreSQL => Box::new(super::PostgresDriver),
        DatabaseType::MySQL => Box::new(super::MySqlDriver),
        DatabaseType::SQLite => Box::new(super::SqliteDriver),
        DatabaseType::MSSQL => {
            // TODO: Implement MSSQL driver
            Box::new(super::PostgresDriver) // Placeholder
        }
    }
}

