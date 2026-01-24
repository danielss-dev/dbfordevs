//! Common test utilities and helpers for integration tests.

use dbfordevs::models::{ConnectionConfig, DatabaseType};

/// Create a PostgreSQL connection config for testing
pub fn postgres_config(host: &str, port: u16, database: &str, user: &str, password: &str) -> ConnectionConfig {
    ConnectionConfig {
        id: Some("test-pg".to_string()),
        name: "Test PostgreSQL".to_string(),
        database_type: DatabaseType::PostgreSQL,
        host: Some(host.to_string()),
        port: Some(port),
        database: database.to_string(),
        username: Some(user.to_string()),
        password: Some(password.to_string()),
        ssl_mode: None,
        file_path: None,
        connection_string: None,
        use_connection_string: None,
        ssl: None,
        ssh_tunnel: None,
        oracle_wallet: None,
    }
}

/// Create a MySQL connection config for testing
pub fn mysql_config(host: &str, port: u16, database: &str, user: &str, password: &str) -> ConnectionConfig {
    ConnectionConfig {
        id: Some("test-mysql".to_string()),
        name: "Test MySQL".to_string(),
        database_type: DatabaseType::MySQL,
        host: Some(host.to_string()),
        port: Some(port),
        database: database.to_string(),
        username: Some(user.to_string()),
        password: Some(password.to_string()),
        ssl_mode: None,
        file_path: None,
        connection_string: None,
        use_connection_string: None,
        ssl: None,
        ssh_tunnel: None,
        oracle_wallet: None,
    }
}

/// Create a SQLite connection config for testing
pub fn sqlite_config(file_path: &str) -> ConnectionConfig {
    ConnectionConfig {
        id: Some("test-sqlite".to_string()),
        name: "Test SQLite".to_string(),
        database_type: DatabaseType::SQLite,
        host: None,
        port: None,
        database: "main".to_string(),
        username: None,
        password: None,
        ssl_mode: None,
        file_path: Some(file_path.to_string()),
        connection_string: None,
        use_connection_string: None,
        ssl: None,
        ssh_tunnel: None,
        oracle_wallet: None,
    }
}
