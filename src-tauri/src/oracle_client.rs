use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::env;
use tauri::Emitter;

/// Oracle client status information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleClientStatus {
    pub is_installed: bool,
    pub install_path: Option<String>,
    pub version: Option<String>,
    pub error_message: Option<String>,
}

/// Oracle client download progress
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleDownloadProgress {
    pub stage: String,
    pub progress: f32,
    pub message: String,
}

/// Get the app-local Oracle client directory
pub fn get_oracle_client_dir() -> PathBuf {
    let app_data = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    app_data.join("dbfordevs").join("oracle-client")
}

/// Check if Oracle client is available (either system-wide or app-local)
pub fn check_oracle_client() -> OracleClientStatus {
    // First, try to set lib dir to our app-local path
    let local_path = get_oracle_client_dir();
    if local_path.exists() {
        // Check if the required DLL exists
        let dll_path = if cfg!(windows) {
            local_path.join("oci.dll")
        } else if cfg!(target_os = "macos") {
            local_path.join("libclntsh.dylib")
        } else {
            local_path.join("libclntsh.so")
        };

        if dll_path.exists() {
            return OracleClientStatus {
                is_installed: true,
                install_path: Some(local_path.to_string_lossy().to_string()),
                version: detect_oracle_version(&local_path),
                error_message: None,
            };
        }
    }

    // Check system PATH for Oracle client
    if let Some(system_path) = find_oracle_in_path() {
        return OracleClientStatus {
            is_installed: true,
            install_path: Some(system_path.to_string_lossy().to_string()),
            version: detect_oracle_version(&system_path),
            error_message: None,
        };
    }

    // Check common installation locations
    let common_paths = get_common_oracle_paths();
    for path in common_paths {
        if path.exists() {
            let dll_path = if cfg!(windows) {
                path.join("oci.dll")
            } else if cfg!(target_os = "macos") {
                path.join("libclntsh.dylib")
            } else {
                path.join("libclntsh.so")
            };

            if dll_path.exists() {
                return OracleClientStatus {
                    is_installed: true,
                    install_path: Some(path.to_string_lossy().to_string()),
                    version: detect_oracle_version(&path),
                    error_message: None,
                };
            }
        }
    }

    OracleClientStatus {
        is_installed: false,
        install_path: None,
        version: None,
        error_message: Some("Oracle Instant Client is not installed. It is required to connect to Oracle databases.".to_string()),
    }
}

/// Find Oracle client in system PATH
fn find_oracle_in_path() -> Option<PathBuf> {
    if let Ok(path_var) = env::var("PATH") {
        let separator = if cfg!(windows) { ';' } else { ':' };
        for path in path_var.split(separator) {
            let path = PathBuf::from(path);
            let dll_path = if cfg!(windows) {
                path.join("oci.dll")
            } else if cfg!(target_os = "macos") {
                path.join("libclntsh.dylib")
            } else {
                path.join("libclntsh.so")
            };

            if dll_path.exists() {
                return Some(path);
            }
        }
    }
    None
}

/// Get common Oracle installation paths based on OS
fn get_common_oracle_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if cfg!(windows) {
        // Common Windows locations
        paths.push(PathBuf::from(r"C:\oracle\instantclient_21_12"));
        paths.push(PathBuf::from(r"C:\oracle\instantclient_21_11"));
        paths.push(PathBuf::from(r"C:\oracle\instantclient_19_20"));
        paths.push(PathBuf::from(r"C:\oracle\instantclient_19_19"));
        paths.push(PathBuf::from(r"C:\instantclient_21_12"));
        paths.push(PathBuf::from(r"C:\instantclient_21_11"));

        // Check Program Files
        if let Ok(program_files) = env::var("ProgramFiles") {
            paths.push(PathBuf::from(&program_files).join("Oracle").join("instantclient"));
        }
    } else if cfg!(target_os = "macos") {
        paths.push(PathBuf::from("/usr/local/oracle/instantclient"));
        paths.push(PathBuf::from("/opt/oracle/instantclient"));
        if let Ok(home) = env::var("HOME") {
            paths.push(PathBuf::from(&home).join("oracle").join("instantclient"));
        }
    } else {
        // Linux
        paths.push(PathBuf::from("/usr/lib/oracle/21/client64/lib"));
        paths.push(PathBuf::from("/usr/lib/oracle/19/client64/lib"));
        paths.push(PathBuf::from("/opt/oracle/instantclient"));
        if let Ok(home) = env::var("HOME") {
            paths.push(PathBuf::from(&home).join("oracle").join("instantclient"));
        }
    }

    paths
}

/// Try to detect Oracle version from the installation path
fn detect_oracle_version(path: &PathBuf) -> Option<String> {
    // Try to extract version from path name
    let path_str = path.to_string_lossy().to_lowercase();

    // Look for patterns like "instantclient_21_12" or "21/client64"
    if let Some(idx) = path_str.find("instantclient_") {
        let version_part = &path_str[idx + 14..];
        let version: String = version_part
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '_')
            .collect();
        if !version.is_empty() {
            return Some(version.replace('_', "."));
        }
    }

    // Check for version file
    let version_file = path.join("BASIC_README");
    if version_file.exists() {
        if let Ok(content) = std::fs::read_to_string(&version_file) {
            // Try to extract version from README
            for line in content.lines() {
                if line.contains("Version") || line.contains("version") {
                    return Some(line.to_string());
                }
            }
        }
    }

    None
}

/// Get the download URL for Oracle Instant Client based on OS
pub fn get_oracle_download_info() -> OracleDownloadInfo {
    let (url, filename, size) = if cfg!(windows) {
        (
            "https://download.oracle.com/otn_software/nt/instantclient/2112000/instantclient-basiclite-windows.x64-21.12.0.0.0dbru.zip",
            "instantclient-basiclite-windows.x64-21.12.0.0.0dbru.zip",
            "30 MB"
        )
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            (
                "https://download.oracle.com/otn_software/mac/instantclient/198000/instantclient-basiclite-macos.arm64-19.8.0.0.0dbru.dmg",
                "instantclient-basiclite-macos.arm64-19.8.0.0.0dbru.dmg",
                "30 MB"
            )
        } else {
            (
                "https://download.oracle.com/otn_software/mac/instantclient/198000/instantclient-basiclite-macos.x64-19.8.0.0.0dbru.dmg",
                "instantclient-basiclite-macos.x64-19.8.0.0.0dbru.dmg",
                "30 MB"
            )
        }
    } else {
        (
            "https://download.oracle.com/otn_software/linux/instantclient/2112000/instantclient-basiclite-linux.x64-21.12.0.0.0dbru.zip",
            "instantclient-basiclite-linux.x64-21.12.0.0.0dbru.zip",
            "30 MB"
        )
    };

    OracleDownloadInfo {
        url: url.to_string(),
        filename: filename.to_string(),
        size: size.to_string(),
        install_path: get_oracle_client_dir().to_string_lossy().to_string(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleDownloadInfo {
    pub url: String,
    pub filename: String,
    pub size: String,
    pub install_path: String,
}

/// Download and install Oracle Instant Client
pub async fn download_and_install_oracle_client(
    window: tauri::Window,
) -> AppResult<OracleClientStatus> {
    use futures_util::StreamExt;

    let download_info = get_oracle_download_info();
    let install_dir = get_oracle_client_dir();

    // Create install directory
    std::fs::create_dir_all(&install_dir)
        .map_err(|e| AppError::ConfigError(format!("Failed to create install directory: {}", e)))?;

    let download_path = install_dir.join(&download_info.filename);

    // Emit progress: Starting download
    let _ = window.emit("oracle-setup-progress", OracleDownloadProgress {
        stage: "downloading".to_string(),
        progress: 0.0,
        message: "Starting download...".to_string(),
    });

    // Download the file
    let client = reqwest::Client::new();
    let response = client.get(&download_info.url)
        .send()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Failed to download Oracle client: {}", e)))?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = std::fs::File::create(&download_path)
        .map_err(|e| AppError::ConfigError(format!("Failed to create download file: {}", e)))?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk
            .map_err(|e| AppError::ConnectionError(format!("Download error: {}", e)))?;

        use std::io::Write;
        file.write_all(&chunk)
            .map_err(|e| AppError::ConfigError(format!("Failed to write file: {}", e)))?;

        downloaded += chunk.len() as u64;
        let progress = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        let _ = window.emit("oracle-setup-progress", OracleDownloadProgress {
            stage: "downloading".to_string(),
            progress,
            message: format!("Downloading... {:.1}%", progress),
        });
    }

    drop(file);

    // Emit progress: Extracting
    let _ = window.emit("oracle-setup-progress", OracleDownloadProgress {
        stage: "extracting".to_string(),
        progress: 0.0,
        message: "Extracting files...".to_string(),
    });

    // Extract the archive
    if download_info.filename.ends_with(".zip") {
        extract_zip(&download_path, &install_dir)?;
    } else if download_info.filename.ends_with(".dmg") {
        // macOS DMG handling would be more complex
        return Err(AppError::ConfigError(
            "macOS DMG extraction not yet implemented. Please download and install manually.".to_string()
        ));
    }

    // Clean up download file
    let _ = std::fs::remove_file(&download_path);

    // Move files from subdirectory to install_dir if needed
    flatten_install_directory(&install_dir)?;

    // Emit progress: Complete
    let _ = window.emit("oracle-setup-progress", OracleDownloadProgress {
        stage: "complete".to_string(),
        progress: 100.0,
        message: "Oracle Instant Client installed successfully!".to_string(),
    });

    // Return updated status
    Ok(check_oracle_client())
}

/// Extract a ZIP file
fn extract_zip(zip_path: &PathBuf, dest_dir: &PathBuf) -> AppResult<()> {
    let file = std::fs::File::open(zip_path)
        .map_err(|e| AppError::ConfigError(format!("Failed to open zip file: {}", e)))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::ConfigError(format!("Failed to read zip archive: {}", e)))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| AppError::ConfigError(format!("Failed to read zip entry: {}", e)))?;

        let outpath = dest_dir.join(file.mangled_name());

        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| AppError::ConfigError(format!("Failed to create directory: {}", e)))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| AppError::ConfigError(format!("Failed to create parent directory: {}", e)))?;
                }
            }
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| AppError::ConfigError(format!("Failed to create file: {}", e)))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| AppError::ConfigError(format!("Failed to extract file: {}", e)))?;
        }

        // Set permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = file.unix_mode() {
                std::fs::set_permissions(&outpath, std::fs::Permissions::from_mode(mode)).ok();
            }
        }
    }

    Ok(())
}

/// Flatten the install directory - move files from instantclient_XX_XX subdirectory to parent
fn flatten_install_directory(install_dir: &PathBuf) -> AppResult<()> {
    // Look for instantclient_* subdirectory
    if let Ok(entries) = std::fs::read_dir(install_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                if name.starts_with("instantclient_") {
                    // Move all files from subdirectory to install_dir
                    if let Ok(sub_entries) = std::fs::read_dir(&path) {
                        for sub_entry in sub_entries.flatten() {
                            let sub_path = sub_entry.path();
                            let dest = install_dir.join(sub_path.file_name().unwrap());
                            std::fs::rename(&sub_path, &dest).ok();
                        }
                    }
                    // Remove the now-empty subdirectory
                    std::fs::remove_dir_all(&path).ok();
                    break;
                }
            }
        }
    }
    Ok(())
}

/// Configure Oracle client library path for the current process
pub fn configure_oracle_lib_path() -> AppResult<()> {
    let status = check_oracle_client();

    if let Some(install_path) = status.install_path {
        // On Windows, use SetDllDirectoryW to add to DLL search path
        #[cfg(windows)]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;

            // Windows API declaration
            #[link(name = "kernel32")]
            extern "system" {
                fn SetDllDirectoryW(lpPathName: *const u16) -> i32;
                fn AddDllDirectory(lpPathName: *const u16) -> *mut std::ffi::c_void;
                fn SetDefaultDllDirectories(DirectoryFlags: u32) -> i32;
            }

            // LOAD_LIBRARY_SEARCH_DEFAULT_DIRS | LOAD_LIBRARY_SEARCH_USER_DIRS
            const LOAD_LIBRARY_SEARCH_DEFAULT_DIRS: u32 = 0x00001000;
            const LOAD_LIBRARY_SEARCH_USER_DIRS: u32 = 0x00000400;

            let path_wide: Vec<u16> = OsStr::new(&install_path)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            unsafe {
                // Try SetDllDirectoryW first (simpler, works in most cases)
                let result = SetDllDirectoryW(path_wide.as_ptr());
                if result == 0 {
                    // If that fails, try the newer AddDllDirectory API
                    SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS | LOAD_LIBRARY_SEARCH_USER_DIRS);
                    AddDllDirectory(path_wide.as_ptr());
                }
            }
        }

        // Add to PATH for the current process (cross-platform fallback)
        if let Ok(current_path) = env::var("PATH") {
            let separator = if cfg!(windows) { ";" } else { ":" };
            let new_path = format!("{}{}{}", install_path, separator, current_path);
            env::set_var("PATH", new_path);
        }

        // Set ORACLE_HOME if not set
        if env::var("ORACLE_HOME").is_err() {
            env::set_var("ORACLE_HOME", &install_path);
        }

        // On Unix, also set LD_LIBRARY_PATH
        #[cfg(unix)]
        {
            if let Ok(current_ld_path) = env::var("LD_LIBRARY_PATH") {
                env::set_var("LD_LIBRARY_PATH", format!("{}:{}", install_path, current_ld_path));
            } else {
                env::set_var("LD_LIBRARY_PATH", &install_path);
            }
        }

        Ok(())
    } else {
        Err(AppError::ConfigError("Oracle client not found".to_string()))
    }
}

/// Check if an error message indicates missing Oracle client
pub fn is_oracle_client_error(error_msg: &str) -> bool {
    error_msg.contains("DPI-1047") ||
    error_msg.contains("Cannot locate") ||
    error_msg.contains("Oracle Client library") ||
    error_msg.contains("OCI") && error_msg.contains("not found")
}
