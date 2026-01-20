use crate::db::{get_connection_manager, get_driver};
use crate::error::{AppError, AppResult};
use crate::models::{CertificateInfo, ConnectionConfig, ConnectionInfo, DatabaseType, SslMode, SslTestResult, SslSupportInfo, TestConnectionResult};
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
pub async fn connect(connection_id: String) -> AppResult<bool> {
    let config = storage::get_connection(&connection_id)?
        .ok_or_else(|| AppError::ConfigError("Connection not found".to_string()))?;
    
    let mut manager = get_connection_manager().write().await;
    manager.connect(connection_id.clone(), &config).await?;
    
    Ok(true)
}

/// Disconnect from a database
#[tauri::command]
pub async fn disconnect(connection_id: String) -> AppResult<bool> {
    let mut manager = get_connection_manager().write().await;
    manager.disconnect(&connection_id).await?;
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
pub async fn delete_connection(connection_id: String) -> AppResult<bool> {
    // Disconnect if connected
    let mut manager = get_connection_manager().write().await;
    if manager.is_connected(&connection_id) {
        manager.disconnect(&connection_id).await?;
    }

    // Remove from storage
    storage::delete_connection(&connection_id)?;

    Ok(true)
}

/// Get a connection configuration by ID
#[tauri::command]
pub async fn get_connection(connection_id: String) -> AppResult<Option<ConnectionConfig>> {
    storage::get_connection(&connection_id)
}

/// Get SSL support information for all database types
#[tauri::command]
pub fn get_ssl_support_info() -> Vec<SslSupportInfo> {
    vec![
        SslSupportInfo {
            database_type: "postgresql".to_string(),
            supports_ssl: true,
            supports_ca_cert: true,
            supports_client_cert: true,
            notes: "Full SSL/TLS support with certificate verification".to_string(),
        },
        SslSupportInfo {
            database_type: "mysql".to_string(),
            supports_ssl: true,
            supports_ca_cert: true,
            supports_client_cert: true,
            notes: "Full SSL/TLS support with certificate verification".to_string(),
        },
        SslSupportInfo {
            database_type: "mariadb".to_string(),
            supports_ssl: true,
            supports_ca_cert: true,
            supports_client_cert: true,
            notes: "Full SSL/TLS support (same as MySQL)".to_string(),
        },
        SslSupportInfo {
            database_type: "mssql".to_string(),
            supports_ssl: true,
            supports_ca_cert: false,
            supports_client_cert: false,
            notes: "Encryption toggle only (Encrypt=true/false). Uses system trust store.".to_string(),
        },
        SslSupportInfo {
            database_type: "cockroachdb".to_string(),
            supports_ssl: true,
            supports_ca_cert: true,
            supports_client_cert: true,
            notes: "Full SSL/TLS support (PostgreSQL protocol)".to_string(),
        },
        SslSupportInfo {
            database_type: "sqlite".to_string(),
            supports_ssl: false,
            supports_ca_cert: false,
            supports_client_cert: false,
            notes: "Local file-based database. SSL not applicable.".to_string(),
        },
        SslSupportInfo {
            database_type: "oracle".to_string(),
            supports_ssl: false,
            supports_ca_cert: false,
            supports_client_cert: false,
            notes: "SSL configuration not yet implemented. Use Oracle Wallet for secure connections.".to_string(),
        },
        SslSupportInfo {
            database_type: "redis".to_string(),
            supports_ssl: true,
            supports_ca_cert: true,
            supports_client_cert: true,
            notes: "TLS support via rediss:// protocol. Requires Redis server with TLS enabled.".to_string(),
        },
        SslSupportInfo {
            database_type: "mongodb".to_string(),
            supports_ssl: true,
            supports_ca_cert: true,
            supports_client_cert: true,
            notes: "Full TLS support. Certificate paths are passed via connection parameters.".to_string(),
        },
        SslSupportInfo {
            database_type: "cassandra".to_string(),
            supports_ssl: false,
            supports_ca_cert: false,
            supports_client_cert: false,
            notes: "SSL requires native OpenSSL setup. Configure SSL at the Cassandra client level.".to_string(),
        },
    ]
}

/// Test SSL/TLS connection and return detailed security information
#[tauri::command]
pub async fn test_ssl_connection(config: ConnectionConfig) -> Result<SslTestResult, AppError> {
    let db_type = format!("{:?}", config.database_type).to_lowercase();

    // Check if this database type supports SSL
    let supports_ssl = matches!(
        config.database_type,
        DatabaseType::PostgreSQL | DatabaseType::MySQL | DatabaseType::MariaDB |
        DatabaseType::MSSQL | DatabaseType::CockroachDB | DatabaseType::Redis |
        DatabaseType::MongoDB
    );

    if !supports_ssl {
        return Ok(SslTestResult {
            success: false,
            message: format!("{} does not support SSL/TLS configuration in this application", db_type),
            ssl_enabled: false,
            ssl_mode: None,
            protocol_version: None,
            cipher_suite: None,
            certificate_info: None,
            server_version: None,
            supports_ssl: false,
            database_type: db_type,
        });
    }

    // Get the SSL mode from config
    let ssl_mode = config.ssl.as_ref().map(|s| format!("{:?}", s.mode).to_lowercase());
    let ssl_enabled = config.ssl.as_ref().map(|s| !matches!(s.mode, SslMode::Disable)).unwrap_or(false);

    // Test the actual connection
    let driver = get_driver(&config);
    let test_result = driver.test_connection(&config).await;

    match test_result {
        Ok(result) => {
            if result.success {
                // Connection successful - now try to get SSL info from the database
                let ssl_info = get_ssl_connection_info(&config).await;

                Ok(SslTestResult {
                    success: true,
                    message: if ssl_enabled {
                        format!("SSL connection successful! {}", result.message)
                    } else {
                        format!("Connection successful (SSL disabled). {}", result.message)
                    },
                    ssl_enabled,
                    ssl_mode,
                    protocol_version: ssl_info.protocol_version,
                    cipher_suite: ssl_info.cipher_suite,
                    certificate_info: ssl_info.certificate_info,
                    server_version: result.server_version,
                    supports_ssl: true,
                    database_type: db_type,
                })
            } else {
                Ok(SslTestResult {
                    success: false,
                    message: result.message,
                    ssl_enabled,
                    ssl_mode,
                    protocol_version: None,
                    cipher_suite: None,
                    certificate_info: None,
                    server_version: None,
                    supports_ssl: true,
                    database_type: db_type,
                })
            }
        }
        Err(e) => {
            // Check if this is an SSL-specific error
            let error_msg = e.to_string();
            let is_ssl_error = error_msg.to_lowercase().contains("ssl")
                || error_msg.to_lowercase().contains("tls")
                || error_msg.to_lowercase().contains("certificate")
                || error_msg.to_lowercase().contains("handshake");

            Ok(SslTestResult {
                success: false,
                message: if is_ssl_error {
                    format!("SSL/TLS Error: {}", error_msg)
                } else {
                    format!("Connection Error: {}", error_msg)
                },
                ssl_enabled,
                ssl_mode,
                protocol_version: None,
                cipher_suite: None,
                certificate_info: None,
                server_version: None,
                supports_ssl: true,
                database_type: db_type,
            })
        }
    }
}

/// Internal struct for SSL connection info
struct SslConnectionInfo {
    protocol_version: Option<String>,
    cipher_suite: Option<String>,
    certificate_info: Option<CertificateInfo>,
}

/// Get SSL connection information from the database
async fn get_ssl_connection_info(config: &ConnectionConfig) -> SslConnectionInfo {
    // Try to connect and query SSL info
    let mut manager = get_connection_manager().write().await;
    let temp_id = format!("ssl_test_{}", uuid::Uuid::new_v4());

    // Try to connect
    if manager.connect(temp_id.clone(), config).await.is_err() {
        return SslConnectionInfo {
            protocol_version: None,
            cipher_suite: None,
            certificate_info: None,
        };
    }

    let result = match &config.database_type {
        DatabaseType::PostgreSQL | DatabaseType::CockroachDB => {
            get_postgres_ssl_info(&manager, &temp_id).await
        }
        DatabaseType::MySQL | DatabaseType::MariaDB => {
            get_mysql_ssl_info(&manager, &temp_id).await
        }
        DatabaseType::MSSQL => {
            get_mssql_ssl_info(&manager, &temp_id).await
        }
        DatabaseType::Redis => {
            get_redis_ssl_info(&config).await
        }
        DatabaseType::MongoDB => {
            get_mongodb_ssl_info(&config).await
        }
        _ => SslConnectionInfo {
            protocol_version: None,
            cipher_suite: None,
            certificate_info: None,
        },
    };

    // Disconnect
    let _ = manager.disconnect(&temp_id).await;

    result
}

/// Get SSL info from PostgreSQL
async fn get_postgres_ssl_info(manager: &crate::db::ConnectionManager, connection_id: &str) -> SslConnectionInfo {
    use crate::db::PoolRef;
    use sqlx::Row;

    let pool_ref = match manager.get_pool_ref(connection_id) {
        Ok(p) => p,
        Err(_) => return SslConnectionInfo {
            protocol_version: None,
            cipher_suite: None,
            certificate_info: None,
        },
    };

    if let PoolRef::Postgres(pool) = pool_ref {
        // Query SSL status
        let ssl_query = "SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()";

        if let Ok(row) = sqlx::query(ssl_query).fetch_optional(pool).await {
            if let Some(row) = row {
                let ssl_enabled: Option<bool> = row.try_get("ssl").ok();
                let version: Option<String> = row.try_get("version").ok();

                // Get cipher info
                let cipher_query = "SELECT cipher, bits FROM pg_stat_ssl WHERE pid = pg_backend_pid()";
                let cipher_info = if let Ok(Some(cipher_row)) = sqlx::query(cipher_query).fetch_optional(pool).await {
                    let cipher: Option<String> = cipher_row.try_get("cipher").ok();
                    let bits: Option<i32> = cipher_row.try_get("bits").ok();
                    cipher.map(|c| {
                        if let Some(b) = bits {
                            format!("{} ({} bits)", c, b)
                        } else {
                            c
                        }
                    })
                } else {
                    None
                };

                if ssl_enabled == Some(true) {
                    return SslConnectionInfo {
                        protocol_version: version,
                        cipher_suite: cipher_info,
                        certificate_info: None,
                    };
                }
            }
        }
    }

    SslConnectionInfo {
        protocol_version: None,
        cipher_suite: None,
        certificate_info: None,
    }
}

/// Get SSL info from MySQL
async fn get_mysql_ssl_info(manager: &crate::db::ConnectionManager, connection_id: &str) -> SslConnectionInfo {
    use crate::db::PoolRef;
    use sqlx::Row;

    let pool_ref = match manager.get_pool_ref(connection_id) {
        Ok(p) => p,
        Err(_) => return SslConnectionInfo {
            protocol_version: None,
            cipher_suite: None,
            certificate_info: None,
        },
    };

    if let PoolRef::MySql(pool) = pool_ref {
        // Query SSL status using SHOW STATUS
        let status_query = "SHOW STATUS LIKE 'Ssl_%'";

        let mut protocol_version = None;
        let mut cipher_suite = None;

        if let Ok(rows) = sqlx::query(status_query).fetch_all(pool).await {
            for row in rows {
                let var_name: String = row.try_get(0).unwrap_or_default();
                let var_value: String = row.try_get(1).unwrap_or_default();

                match var_name.as_str() {
                    "Ssl_version" => {
                        if !var_value.is_empty() {
                            protocol_version = Some(var_value);
                        }
                    }
                    "Ssl_cipher" => {
                        if !var_value.is_empty() {
                            cipher_suite = Some(var_value);
                        }
                    }
                    _ => {}
                }
            }
        }

        return SslConnectionInfo {
            protocol_version,
            cipher_suite,
            certificate_info: None,
        };
    }

    SslConnectionInfo {
        protocol_version: None,
        cipher_suite: None,
        certificate_info: None,
    }
}

/// Get SSL info from MSSQL
/// Note: MSSQL encryption status is determined by the connection string (Encrypt=true/false)
/// so we just return basic info indicating the connection was established with configured settings
async fn get_mssql_ssl_info(_manager: &crate::db::ConnectionManager, _connection_id: &str) -> SslConnectionInfo {
    // For MSSQL, the encryption status is determined by the connection string configuration
    // The actual SSL/TLS details are not easily queryable without additional setup
    // We rely on the connection config to indicate whether encryption was requested
    SslConnectionInfo {
        protocol_version: Some("TLS (configured)".to_string()),
        cipher_suite: None,
        certificate_info: None,
    }
}

/// Get SSL info from Redis
/// Redis TLS is established at connection time via the rediss:// protocol
async fn get_redis_ssl_info(config: &ConnectionConfig) -> SslConnectionInfo {
    let ssl_enabled = config.ssl.as_ref().map(|s| !matches!(s.mode, SslMode::Disable)).unwrap_or(false);

    if ssl_enabled {
        SslConnectionInfo {
            protocol_version: Some("TLS (configured)".to_string()),
            cipher_suite: None,
            certificate_info: None,
        }
    } else {
        SslConnectionInfo {
            protocol_version: None,
            cipher_suite: None,
            certificate_info: None,
        }
    }
}

/// Get SSL info from MongoDB
/// MongoDB TLS is configured via connection string parameters
async fn get_mongodb_ssl_info(config: &ConnectionConfig) -> SslConnectionInfo {
    let ssl_enabled = config.ssl.as_ref().map(|s| !matches!(s.mode, SslMode::Disable)).unwrap_or(false);

    if ssl_enabled {
        SslConnectionInfo {
            protocol_version: Some("TLS (configured)".to_string()),
            cipher_suite: None,
            certificate_info: None,
        }
    } else {
        SslConnectionInfo {
            protocol_version: None,
            cipher_suite: None,
            certificate_info: None,
        }
    }
}


