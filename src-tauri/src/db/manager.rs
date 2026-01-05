use crate::error::{AppError, AppResult};
use crate::models::{ConnectionConfig, DatabaseType, SslMode};
use crate::db::PoolRef;
use crate::ssh::get_ssh_tunnel_manager;
use once_cell::sync::OnceCell;
use sqlx::{postgres::PgPool, mysql::MySqlPool, sqlite::SqlitePool};
use std::collections::HashMap;
use tokio::sync::RwLock;

// Re-export MSSQL pool type from mssql module
pub use crate::db::mssql::MssqlPool;

/// Enum to hold different database pool types
pub enum ConnectionPool {
    Postgres(PgPool),
    MySql(MySqlPool),
    Sqlite(SqlitePool),
    Mssql(MssqlPool),
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

        // Determine effective host and port (may be modified by SSH tunnel)
        let (effective_host, effective_port) = if let Some(ssh_config) = &config.ssh_tunnel {
            if ssh_config.enabled {
                // Create SSH tunnel
                let remote_host = config.host.as_deref().unwrap_or("localhost");
                let remote_port = config.port.unwrap_or(get_default_port(&config.database_type));

                let tunnel_manager = get_ssh_tunnel_manager();
                let mut manager = tunnel_manager.write().await;
                let local_port = manager
                    .create_tunnel(&connection_id, ssh_config, remote_host, remote_port)
                    .await?;

                ("127.0.0.1".to_string(), local_port)
            } else {
                (
                    config.host.clone().unwrap_or_else(|| "localhost".to_string()),
                    config.port.unwrap_or(get_default_port(&config.database_type)),
                )
            }
        } else {
            (
                config.host.clone().unwrap_or_else(|| "localhost".to_string()),
                config.port.unwrap_or(get_default_port(&config.database_type)),
            )
        };

        // Create modified config with tunnel endpoint
        let tunnel_config = ConnectionConfig {
            host: Some(effective_host),
            port: Some(effective_port),
            ..config.clone()
        };

        let (pool, connection_string) = match config.database_type {
            DatabaseType::PostgreSQL => {
                let connection_string = build_postgres_connection_string(&tunnel_config)?;
                let pool = PgPool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to PostgreSQL: {}", e)))?;
                (ConnectionPool::Postgres(pool), connection_string)
            }
            DatabaseType::MySQL => {
                let connection_string = build_mysql_connection_string(&tunnel_config)?;
                let pool = MySqlPool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to MySQL: {}", e)))?;
                (ConnectionPool::MySql(pool), connection_string)
            }
            DatabaseType::SQLite => {
                let connection_string = build_sqlite_connection_string(&tunnel_config)?;
                let pool = SqlitePool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to SQLite: {}", e)))?;
                (ConnectionPool::Sqlite(pool), connection_string)
            }
            DatabaseType::MSSQL => {
                let connection_string = build_mssql_connection_string(&tunnel_config)?;
                let pool = super::mssql::create_mssql_pool(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to MSSQL: {}", e)))?;
                (ConnectionPool::Mssql(pool), connection_string)
            }
            // MariaDB uses MySQL protocol
            DatabaseType::MariaDB => {
                let connection_string = build_mysql_connection_string(&tunnel_config)?;
                let pool = MySqlPool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to MariaDB: {}", e)))?;
                (ConnectionPool::MySql(pool), connection_string)
            }
            // CockroachDB uses PostgreSQL protocol
            DatabaseType::CockroachDB => {
                let connection_string = build_cockroachdb_connection_string(&tunnel_config)?;
                let pool = PgPool::connect(&connection_string).await
                    .map_err(|e| AppError::ConnectionError(format!("Failed to connect to CockroachDB: {}", e)))?;
                (ConnectionPool::Postgres(pool), connection_string)
            }
        };

        self.connection_strings.insert(connection_id.clone(), connection_string);
        self.connections.insert(connection_id, pool);
        Ok(())
    }

    /// Disconnect from a database
    pub async fn disconnect(&mut self, connection_id: &str) -> AppResult<()> {
        // Close database pool
        if let Some(pool) = self.connections.remove(connection_id) {
            match pool {
                ConnectionPool::Postgres(p) => p.close().await,
                ConnectionPool::MySql(p) => p.close().await,
                ConnectionPool::Sqlite(p) => p.close().await,
                ConnectionPool::Mssql(p) => {
                    p.close();
                }
            }
        }
        self.connection_strings.remove(connection_id);

        // Close SSH tunnel if exists
        let tunnel_manager = get_ssh_tunnel_manager();
        let mut manager = tunnel_manager.write().await;
        manager.close_tunnel(connection_id);

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
            ConnectionPool::Mssql(p) => Ok(PoolRef::Mssql(p)),
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

    // Build SSL query parameters
    let mut params: Vec<String> = Vec::new();

    if let Some(ssl) = &config.ssl {
        params.push(format!("sslmode={}", ssl_mode_to_pg_string(&ssl.mode)));

        if let Some(ca_cert) = &ssl.ca_cert_path {
            params.push(format!("sslrootcert={}", ca_cert));
        }
        if let Some(client_cert) = &ssl.client_cert_path {
            params.push(format!("sslcert={}", client_cert));
        }
        if let Some(client_key) = &ssl.client_key_path {
            params.push(format!("sslkey={}", client_key));
        }
    } else if let Some(ssl_mode) = &config.ssl_mode {
        // Legacy support for old ssl_mode field
        params.push(format!("sslmode={}", ssl_mode));
    }

    if !params.is_empty() {
        url.push('?');
        url.push_str(&params.join("&"));
    }

    Ok(url)
}

/// Get the default port for a database type
fn get_default_port(db_type: &DatabaseType) -> u16 {
    match db_type {
        DatabaseType::PostgreSQL => 5432,
        DatabaseType::MySQL => 3306,
        DatabaseType::MariaDB => 3306,
        DatabaseType::MSSQL => 1433,
        DatabaseType::SQLite => 0, // Not used for SQLite
        DatabaseType::CockroachDB => 26257,
    }
}

/// Convert SslMode enum to PostgreSQL connection string value
fn ssl_mode_to_pg_string(mode: &SslMode) -> &'static str {
    match mode {
        SslMode::Disable => "disable",
        SslMode::Prefer => "prefer",
        SslMode::Require => "require",
        SslMode::VerifyCa => "verify-ca",
        SslMode::VerifyFull => "verify-full",
    }
}

fn build_mysql_connection_string(config: &ConnectionConfig) -> AppResult<String> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(3306);
    let username = config.username.as_deref().unwrap_or("root");
    let password = config.password.as_deref().unwrap_or("");

    // For MySQL, if no database is specified, we connect to the server without a default DB
    let database = if config.database.trim().is_empty() {
        "".to_string()
    } else {
        config.database.clone()
    };

    let mut url = format!("mysql://{}:{}@{}:{}/{}",
        username, password, host, port, database);

    // Build SSL query parameters for MySQL
    let mut params: Vec<String> = Vec::new();

    if let Some(ssl) = &config.ssl {
        params.push(format!("ssl-mode={}", ssl_mode_to_mysql_string(&ssl.mode)));

        if let Some(ca_cert) = &ssl.ca_cert_path {
            params.push(format!("ssl-ca={}", ca_cert));
        }
        if let Some(client_cert) = &ssl.client_cert_path {
            params.push(format!("ssl-cert={}", client_cert));
        }
        if let Some(client_key) = &ssl.client_key_path {
            params.push(format!("ssl-key={}", client_key));
        }
    }

    if !params.is_empty() {
        url.push('?');
        url.push_str(&params.join("&"));
    }

    Ok(url)
}

/// Convert SslMode enum to MySQL connection string value
fn ssl_mode_to_mysql_string(mode: &SslMode) -> &'static str {
    match mode {
        SslMode::Disable => "DISABLED",
        SslMode::Prefer => "PREFERRED",
        SslMode::Require => "REQUIRED",
        SslMode::VerifyCa => "VERIFY_CA",
        SslMode::VerifyFull => "VERIFY_IDENTITY",
    }
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

fn build_mssql_connection_string(config: &ConnectionConfig) -> AppResult<String> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(1433);
    let username = config.username.as_deref().unwrap_or("sa");
    let password = config.password.as_deref().unwrap_or("");

    // Tiberius uses ADO.NET style connection strings
    let mut parts = vec![
        format!("Server=tcp:{},{}", host, port),
        format!("Database={}", config.database),
        format!("User Id={}", username),
        format!("Password={}", password),
    ];

    // Handle SSL configuration for MSSQL
    if let Some(ssl) = &config.ssl {
        match ssl.mode {
            SslMode::Disable => {
                parts.push("Encrypt=false".to_string());
            }
            SslMode::Require => {
                parts.push("Encrypt=true".to_string());
                parts.push("TrustServerCertificate=true".to_string());
            }
            SslMode::VerifyCa | SslMode::VerifyFull => {
                parts.push("Encrypt=true".to_string());
                parts.push("TrustServerCertificate=false".to_string());
            }
            SslMode::Prefer => {
                parts.push("Encrypt=true".to_string());
                parts.push("TrustServerCertificate=true".to_string());
            }
        }
    } else {
        // Default to encrypted connection with trusted certificate
        // This is appropriate for development environments with self-signed certs
        parts.push("Encrypt=true".to_string());
        parts.push("TrustServerCertificate=true".to_string());
    }

    Ok(parts.join(";"))
}

fn build_cockroachdb_connection_string(config: &ConnectionConfig) -> AppResult<String> {
    let host = config.host.as_deref().unwrap_or("localhost");
    let port = config.port.unwrap_or(26257);
    let username = config.username.as_deref().unwrap_or("root");
    let password = config.password.as_deref().unwrap_or("");

    // CockroachDB uses PostgreSQL wire protocol
    let mut url = format!("postgresql://{}:{}@{}:{}/{}",
        username, password, host, port, config.database);

    // Build SSL query parameters (same as PostgreSQL)
    let mut params: Vec<String> = Vec::new();

    if let Some(ssl) = &config.ssl {
        params.push(format!("sslmode={}", ssl_mode_to_pg_string(&ssl.mode)));

        if let Some(ca_cert) = &ssl.ca_cert_path {
            params.push(format!("sslrootcert={}", ca_cert));
        }
        if let Some(client_cert) = &ssl.client_cert_path {
            params.push(format!("sslcert={}", client_cert));
        }
        if let Some(client_key) = &ssl.client_key_path {
            params.push(format!("sslkey={}", client_key));
        }
    } else if let Some(ssl_mode) = &config.ssl_mode {
        // Legacy support for old ssl_mode field
        params.push(format!("sslmode={}", ssl_mode));
    }

    if !params.is_empty() {
        url.push('?');
        url.push_str(&params.join("&"));
    }

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

