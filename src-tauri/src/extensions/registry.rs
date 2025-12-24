//! Extension Registry
//!
//! Manages registered extensions and their lifecycle.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;

use extension_core::{ExtensionManifest, ExtensionStatus, InstalledExtension};

use super::ExtensionInfo;
use crate::error::{AppError, AppResult};

/// Registry of all installed and available extensions
pub struct ExtensionRegistry {
    /// Installed extensions by ID
    installed: RwLock<HashMap<String, InstalledExtension>>,
    /// Path to extensions directory
    extensions_dir: PathBuf,
}

impl ExtensionRegistry {
    /// Create a new extension registry
    pub fn new(extensions_dir: PathBuf) -> Self {
        Self {
            installed: RwLock::new(HashMap::new()),
            extensions_dir,
        }
    }

    /// Get the extensions directory
    pub fn extensions_dir(&self) -> &PathBuf {
        &self.extensions_dir
    }

    /// Register an extension
    pub fn register(&self, manifest: ExtensionManifest, install_path: String) -> AppResult<()> {
        let mut installed = self.installed.write().map_err(|_| {
            AppError::Internal("Failed to acquire write lock".to_string())
        })?;

        let ext = InstalledExtension {
            manifest: manifest.clone(),
            status: ExtensionStatus::Installed,
            install_path,
            installed_at: Some(chrono::Utc::now().to_rfc3339()),
            updated_at: None,
        };

        installed.insert(manifest.id.clone(), ext);
        Ok(())
    }

    /// Unregister an extension
    pub fn unregister(&self, extension_id: &str) -> AppResult<Option<InstalledExtension>> {
        let mut installed = self.installed.write().map_err(|_| {
            AppError::Internal("Failed to acquire write lock".to_string())
        })?;
        Ok(installed.remove(extension_id))
    }

    /// Get an installed extension by ID
    pub fn get(&self, extension_id: &str) -> AppResult<Option<InstalledExtension>> {
        let installed = self.installed.read().map_err(|_| {
            AppError::Internal("Failed to acquire read lock".to_string())
        })?;
        Ok(installed.get(extension_id).cloned())
    }

    /// List all installed extensions
    pub fn list_installed(&self) -> AppResult<Vec<ExtensionInfo>> {
        let installed = self.installed.read().map_err(|_| {
            AppError::Internal("Failed to acquire read lock".to_string())
        })?;
        Ok(installed.values().map(ExtensionInfo::from).collect())
    }

    /// Update extension status
    pub fn set_status(&self, extension_id: &str, status: ExtensionStatus) -> AppResult<()> {
        let mut installed = self.installed.write().map_err(|_| {
            AppError::Internal("Failed to acquire write lock".to_string())
        })?;

        if let Some(ext) = installed.get_mut(extension_id) {
            ext.status = status;
            ext.updated_at = Some(chrono::Utc::now().to_rfc3339());
        }

        Ok(())
    }

    /// Check if an extension is installed
    pub fn is_installed(&self, extension_id: &str) -> bool {
        self.installed
            .read()
            .map(|i| i.contains_key(extension_id))
            .unwrap_or(false)
    }

    /// Get all extension IDs
    pub fn get_extension_ids(&self) -> AppResult<Vec<String>> {
        let installed = self.installed.read().map_err(|_| {
            AppError::Internal("Failed to acquire read lock".to_string())
        })?;
        Ok(installed.keys().cloned().collect())
    }

    /// Load extensions from disk
    pub fn load_from_disk(&self) -> AppResult<usize> {
        use super::ManifestParser;
        
        let mut count = 0;
        
        if !self.extensions_dir.exists() {
            std::fs::create_dir_all(&self.extensions_dir).map_err(|e| {
                AppError::Internal(format!("Failed to create extensions directory: {}", e))
            })?;
            return Ok(0);
        }

        let entries = std::fs::read_dir(&self.extensions_dir).map_err(|e| {
            AppError::Internal(format!("Failed to read extensions directory: {}", e))
        })?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("extension.json");
                if manifest_path.exists() {
                    match ManifestParser::parse_file(&manifest_path) {
                        Ok(manifest) => {
                            let install_path = path.to_string_lossy().to_string();
                            if self.register(manifest, install_path).is_ok() {
                                count += 1;
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to parse manifest at {:?}: {}", manifest_path, e);
                        }
                    }
                }
            }
        }

        Ok(count)
    }
}

impl Default for ExtensionRegistry {
    fn default() -> Self {
        let extensions_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("dbfordevs")
            .join("extensions");
        Self::new(extensions_dir)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use extension_core::{ExtensionAuthor, ExtensionCategory};
    use tempfile::tempdir;

    fn create_test_manifest(id: &str) -> ExtensionManifest {
        ExtensionManifest {
            id: id.to_string(),
            version: "1.0.0".to_string(),
            display_name: format!("Test Extension {}", id),
            description: "A test extension".to_string(),
            author: ExtensionAuthor {
                name: "Test".to_string(),
                email: None,
                url: None,
            },
            categories: vec![ExtensionCategory::Other("Test".to_string())],
            is_official: false,
            capabilities: vec![],
            activation_events: vec![],
            repository: None,
            min_app_version: None,
            icon: None,
            homepage: None,
            license: None,
        }
    }

    #[test]
    fn test_register_and_get() {
        let dir = tempdir().unwrap();
        let registry = ExtensionRegistry::new(dir.path().to_path_buf());
        
        let manifest = create_test_manifest("test-ext");
        registry.register(manifest.clone(), "/path/to/ext".to_string()).unwrap();

        let ext = registry.get("test-ext").unwrap();
        assert!(ext.is_some());
        assert_eq!(ext.unwrap().manifest.id, "test-ext");
    }

    #[test]
    fn test_list_installed() {
        let dir = tempdir().unwrap();
        let registry = ExtensionRegistry::new(dir.path().to_path_buf());
        
        registry.register(create_test_manifest("ext1"), "/path/1".to_string()).unwrap();
        registry.register(create_test_manifest("ext2"), "/path/2".to_string()).unwrap();

        let list = registry.list_installed().unwrap();
        assert_eq!(list.len(), 2);
    }
}

