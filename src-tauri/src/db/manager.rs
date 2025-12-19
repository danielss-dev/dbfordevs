use crate::error::{AppError, AppResult};
use crate::models::{ConnectionConfig, DatabaseType};
use crate::db::PoolRef;
use once_cell::sync::OnceCell;
use sqlx::{postgres::PgPool, mysql::MySqlPool, sqlite::SqlitePool};
use std::collections::HashMap;
use tokio::sync::RwLock;

/// Enum to hold different database pool types
pub enum ConnectionPool {
    Postgres(PgPool),
    MySql(MySqlPool),
    Sqlite(SqlitePool),
}

/// Manages active database connections
pub struct ConnectionManager {
    connections: HashMap<String, ConnectionPool>,
    connection_strings: HashMap<String, String>, // Store connection strings for reference
}

impl ConnectionManager {
    fn new() -> Self {
        Self {
            connections: HashMap::new(),
            connection_strings: HashMap::new(),
        }
    }

    /// Connect to a database and store the pool
    pub async fn connect(&mut self, connection_id: String, config: &ConnectionConfig) -> AppResult<()> {
        // Disconnect if already connected
        if self.connections.contains_key(&connection_id) {
            self.disconnect(&connection_id).await?;
        }

        let (pool, connection_string) = match config.database_type {
            DatabaseType::PostgreSQL => {
                let connection_string = build_postgres_connection_string(config)?;
                let pool = PgPool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to PostgreSQL: {}", e)))?;
                (ConnectionPool::Postgres(pool), connection_string)
            }
            DatabaseType::MySQL => {
                let connection_string = build_mysql_connection_string(config)?;
                let pool = MySqlPool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to MySQL: {}", e)))?;
                (ConnectionPool::MySql(pool), connection_string)
            }
            DatabaseType::SQLite => {
                let connection_string = build_sqlite_connection_string(config)?;
                let pool = SqlitePool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to SQLite: {}", e)))?;
                (ConnectionPool::Sqlite(pool), connection_string)
            }
            DatabaseType::MSSQL => {
                return Err(AppError::ConnectionError("MSSQL not yet implemented".to_string()));
            }
        };

        self.connection_strings.insert(connection_id.clone(), connection_string);
        self.connections.insert(connection_id, pool);
        Ok(())
    }

    /// Disconnect from a database
    pub async fn disconnect(&mut self, connection_id: &str) -> AppResult<()> {
        if let Some(pool) = self.connections.remove(connection_id) {
            match pool {
                ConnectionPool::Postgres(p) => p.close().await,
                ConnectionPool::MySql(p) => p.close().await,
                ConnectionPool::Sqlite(p) => p.close().await,
            }
        }
        self.connection_strings.remove(connection_id);
        Ok(())
    }

    /// Get connection string for reference
    #[allow(dead_code)]
    pub fn get_connection_string(&self, connection_id: &str) -> Option<&String> {
        self.connection_strings.get(connection_id)
    }

    /// Get a PoolRef for a connection
    pub fn get_pool_ref(&self, connection_id: &str) -> AppResult<PoolRef<'_>> {
        let pool = self.connections.get(connection_id)
            .ok_or_else(|| AppError::ConnectionError("Connection not found".to_string()))?;
        
        match pool {
            ConnectionPool::Postgres(p) => Ok(PoolRef::Postgres(p)),
            ConnectionPool::MySql(p) => Ok(PoolRef::MySql(p)),
            ConnectionPool::Sqlite(p) => Ok(PoolRef::Sqlite(p)),
        }
    }

    /// Get a connection pool
    #[allow(dead_code)]
    pub fn get_pool(&self, connection_id: &str) -> Option<&ConnectionPool> {
        self.connections.get(connection_id)
    }

    /// Check if a connection exists
    pub fn is_connected(&self, connection_id: &str) -> bool {
        self.connections.contains_key(connection_id)
    }

    /// List all active connection IDs
    #[allow(dead_code)]
    pub fn list_connections(&self) -> Vec<String> {
        self.connections.keys().cloned().collect()
    }
}

fn build_postgres_connection_string(config: &ConnectionConfig) -> AppResult<String> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(5432);
    let username = config.username.as_deref().unwrap_or("postgres");
    let password = config.password.as_deref().unwrap_or("");
    
    let mut url = format!("postgresql://{}:{}@{}:{}/{}", 
        username, password, host, port, config.database);
    
    if let Some(ssl_mode) = &config.ssl_mode {
        url.push_str(&format!("?sslmode={}", ssl_mode));
    }
    
    Ok(url)
}

fn build_mysql_connection_string(config: &ConnectionConfig) -> AppResult<String> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(3306);
    let username = config.username.as_deref().unwrap_or("root");
    let password = config.password.as_deref().unwrap_or("");
    
    let url = format!("mysql://{}:{}@{}:{}/{}", 
        username, password, host, port, config.database);
    
    Ok(url)
}

fn build_sqlite_connection_string(config: &ConnectionConfig) -> AppResult<String> {
    let path = config.file_path.as_deref()
        .or_else(|| config.database.as_str().split('/').last())
        .ok_or_else(|| AppError::ConfigError("SQLite file path is required".to_string()))?;
    
    // Ensure SQLite connection string format
    let url = if path.starts_with("sqlite://") || path.starts_with("sqlite:") {
        path.to_string()
    } else {
        format!("sqlite:{}", path)
    };
    
    Ok(url)
}

// Global connection manager instance
static CONNECTION_MANAGER: OnceCell<RwLock<ConnectionManager>> = OnceCell::new();

/// Get the global connection manager instance
pub fn get_connection_manager() -> &'static RwLock<ConnectionManager> {
    CONNECTION_MANAGER.get_or_init(|| {
        RwLock::new(ConnectionManager::new())
    })
}

