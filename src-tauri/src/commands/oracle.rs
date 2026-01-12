use crate::error::AppError;
use crate::oracle_client::{
    self, OracleClientStatus, OracleDownloadInfo,
};

/// Check if Oracle client is installed and return status
#[tauri::command]
pub fn check_oracle_client_status() -> OracleClientStatus {
    oracle_client::check_oracle_client()
}

/// Get Oracle client download information
#[tauri::command]
pub fn get_oracle_download_info() -> OracleDownloadInfo {
    oracle_client::get_oracle_download_info()
}

/// Download and install Oracle Instant Client
#[tauri::command]
pub async fn download_oracle_client(window: tauri::Window) -> Result<OracleClientStatus, AppError> {
    oracle_client::download_and_install_oracle_client(window).await
}
