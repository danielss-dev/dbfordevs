use crate::error::{AppError, AppResult};
use crate::models::SshTunnelConfig;
use once_cell::sync::OnceCell;
use russh::client::{self, Config, Handle, Handler};
use russh_keys::{known_hosts, load_secret_key};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex, RwLock};

/// SSH client handler with host key verification
struct SshHandler {
    host: String,
    port: u16,
}

#[async_trait::async_trait]
impl Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Get path to known_hosts file
        let known_hosts_path = match dirs::home_dir() {
            Some(home) => home.join(".ssh").join("known_hosts"),
            None => return Ok(false),
        };

        // Check server key against known_hosts
        match known_hosts::check_known_hosts_path(&self.host, self.port, server_public_key, &known_hosts_path) {
            Ok(true) => Ok(true),
            Ok(false) => {
                // Host not in known_hosts - reject for security
                eprintln!(
                    "SSH host {}:{} not found in known_hosts. Add it with: ssh-keyscan -H {} >> ~/.ssh/known_hosts",
                    self.host, self.port, self.host
                );
                Ok(false)
            }
            Err(russh_keys::Error::KeyChanged { line }) => {
                eprintln!(
                    "WARNING: SSH host key for {}:{} has changed! (known_hosts line {}). Possible MITM attack.",
                    self.host, self.port, line
                );
                Ok(false)
            }
            Err(e) => {
                eprintln!("Error checking known_hosts: {}", e);
                Ok(false)
            }
        }
    }
}

/// Represents an active SSH tunnel
pub struct SshTunnel {
    pub local_port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl SshTunnel {
    /// Close this tunnel
    pub fn close(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

/// Manages SSH tunnels for database connections
pub struct SshTunnelManager {
    tunnels: HashMap<String, SshTunnel>,
}

impl SshTunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: HashMap::new(),
        }
    }

    /// Creates an SSH tunnel and returns the local port to connect to
    pub async fn create_tunnel(
        &mut self,
        connection_id: &str,
        config: &SshTunnelConfig,
        remote_host: &str,
        remote_port: u16,
    ) -> AppResult<u16> {
        // Close existing tunnel if any
        if let Some(mut tunnel) = self.tunnels.remove(connection_id) {
            tunnel.close();
        }

        // Bind to a random available port
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to bind local port: {}", e)))?;

        let local_port = listener
            .local_addr()
            .map_err(|e| AppError::ConnectionError(format!("Failed to get local address: {}", e)))?
            .port();

        // Create SSH session
        let session = create_ssh_session(config).await?;
        let session = Arc::new(Mutex::new(session));

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = oneshot::channel();

        // Spawn tunnel forwarding task
        let remote_host = remote_host.to_string();
        tokio::spawn(async move {
            run_tunnel(listener, session, remote_host, remote_port, shutdown_rx).await;
        });

        // Store tunnel info
        self.tunnels.insert(
            connection_id.to_string(),
            SshTunnel {
                local_port,
                shutdown_tx: Some(shutdown_tx),
            },
        );

        Ok(local_port)
    }

    /// Closes an SSH tunnel
    pub fn close_tunnel(&mut self, connection_id: &str) {
        if let Some(mut tunnel) = self.tunnels.remove(connection_id) {
            tunnel.close();
        }
    }

    /// Check if a tunnel exists for a connection
    #[allow(dead_code)]
    pub fn has_tunnel(&self, connection_id: &str) -> bool {
        self.tunnels.contains_key(connection_id)
    }
}

/// Create an authenticated SSH session
async fn create_ssh_session(config: &SshTunnelConfig) -> AppResult<Handle<SshHandler>> {
    let ssh_config = Config::default();
    let ssh_config = Arc::new(ssh_config);

    let addr = format!("{}:{}", config.host, config.port);
    let addr: SocketAddr = addr
        .parse()
        .map_err(|e| AppError::ConnectionError(format!("Invalid SSH address: {}", e)))?;

    // Connect to SSH server
    let handler = SshHandler {
        host: config.host.clone(),
        port: config.port,
    };
    let mut session = client::connect(ssh_config, addr, handler)
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to connect to SSH server: {}", e)))?;

    // Authenticate
    let authenticated = match &config.auth_method {
        crate::models::SshAuthMethod::Password => {
            let password = config.password.as_deref().unwrap_or("");
            session
                .authenticate_password(&config.username, password)
                .await
                .map_err(|e| {
                    AppError::ConnectionError(format!("SSH password authentication failed: {}", e))
                })?
        }
        crate::models::SshAuthMethod::PrivateKey => {
            let key_path = config
                .private_key_path
                .as_ref()
                .ok_or_else(|| AppError::ConnectionError("Private key path not provided".to_string()))?;

            // Expand ~/ to home directory (not ~username format)
            let key_path = if key_path.starts_with("~/") {
                let home = dirs::home_dir()
                    .ok_or_else(|| AppError::ConnectionError("Could not determine home directory".to_string()))?;
                home.join(&key_path[2..])
            } else {
                std::path::PathBuf::from(key_path)
            };

            let passphrase = config.passphrase.as_deref();
            let key = load_secret_key(&key_path, passphrase)
                .map_err(|e| AppError::ConnectionError(format!("Failed to load SSH key: {}", e)))?;

            session
                .authenticate_publickey(&config.username, Arc::new(key))
                .await
                .map_err(|e| {
                    AppError::ConnectionError(format!("SSH key authentication failed: {}", e))
                })?
        }
    };

    if !authenticated {
        return Err(AppError::ConnectionError(
            "SSH authentication failed".to_string(),
        ));
    }

    Ok(session)
}

/// Run the tunnel forwarding loop
async fn run_tunnel(
    listener: TcpListener,
    session: Arc<Mutex<Handle<SshHandler>>>,
    remote_host: String,
    remote_port: u16,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    loop {
        tokio::select! {
            _ = &mut shutdown_rx => {
                // Shutdown signal received
                break;
            }
            result = listener.accept() => {
                match result {
                    Ok((local_stream, _)) => {
                        let session = session.clone();
                        let remote_host = remote_host.clone();
                        tokio::spawn(async move {
                            if let Err(e) = forward_connection(local_stream, session, &remote_host, remote_port).await {
                                eprintln!("SSH tunnel forwarding error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("Failed to accept connection: {}", e);
                    }
                }
            }
        }
    }
}

/// Forward a single connection through the SSH tunnel
async fn forward_connection(
    mut local_stream: TcpStream,
    session: Arc<Mutex<Handle<SshHandler>>>,
    remote_host: &str,
    remote_port: u16,
) -> AppResult<()> {
    // Open a channel to the remote host
    let channel = {
        let session = session.lock().await;
        session
            .channel_open_direct_tcpip(remote_host, remote_port as u32, "127.0.0.1", 0)
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to open SSH channel: {}", e)))?
    };

    let mut channel_stream = channel.into_stream();

    // Create buffers for bidirectional forwarding
    let mut local_buf = [0u8; 8192];
    let mut remote_buf = [0u8; 8192];

    loop {
        tokio::select! {
            // Read from local, write to remote
            result = local_stream.read(&mut local_buf) => {
                match result {
                    Ok(0) => break, // Connection closed
                    Ok(n) => {
                        if channel_stream.write_all(&local_buf[..n]).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            // Read from remote, write to local
            result = channel_stream.read(&mut remote_buf) => {
                match result {
                    Ok(0) => break, // Connection closed
                    Ok(n) => {
                        if local_stream.write_all(&remote_buf[..n]).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        }
    }

    Ok(())
}

// Global SSH tunnel manager instance
static SSH_TUNNEL_MANAGER: OnceCell<RwLock<SshTunnelManager>> = OnceCell::new();

/// Get the global SSH tunnel manager instance
pub fn get_ssh_tunnel_manager() -> &'static RwLock<SshTunnelManager> {
    SSH_TUNNEL_MANAGER.get_or_init(|| RwLock::new(SshTunnelManager::new()))
}
