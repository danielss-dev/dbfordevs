//! Extension Loader
//!
//! Handles the lifecycle of loading and unloading extensions.

use std::path::Path;
use std::sync::Arc;

use extension_core::{ExtensionManifest, ExtensionStatus};

use super::{ExtensionRegistry, ManifestParser};
use crate::error::{AppError, AppResult};

/// Extension loader handles installation and lifecycle
pub struct ExtensionLoader {
    registry: Arc<ExtensionRegistry>,
}

impl ExtensionLoader {
    /// Create a new extension loader
    pub fn new(registry: Arc<ExtensionRegistry>) -> Self {
        Self { registry }
    }

    /// Initialize the extension system
    pub fn initialize(&self) -> AppResult<()> {
        // Create extensions directory if needed
        let extensions_dir = self.registry.extensions_dir();
        if !extensions_dir.exists() {
            std::fs::create_dir_all(extensions_dir).map_err(|e| {
                AppError::Internal(format!("Failed to create extensions directory: {}", e))
            })?;
        }

        // Load installed extensions
        let count = self.registry.load_from_disk()?;
        println!("Loaded {} extensions from disk", count);

        // Activate enabled extensions
        for ext_id in self.registry.get_extension_ids()? {
            if let Ok(Some(ext)) = self.registry.get(&ext_id) {
                if ext.status == ExtensionStatus::Installed || ext.status == ExtensionStatus::Active {
                    self.activate(&ext_id)?;
                }
            }
        }

        Ok(())
    }

    /// Install an extension from a directory
    pub fn install_from_dir(&self, source_dir: &Path) -> AppResult<String> {
        let manifest_path = source_dir.join("extension.json");
        if !manifest_path.exists() {
            return Err(AppError::Internal(
                "No extension.json found in directory".to_string(),
            ));
        }

        let manifest = ManifestParser::parse_file(&manifest_path)?;
        
        // Validate manifest
        if let Err(errors) = ManifestParser::validate(&manifest) {
            return Err(AppError::Internal(format!(
                "Invalid manifest: {}",
                errors.join(", ")
            )));
        }

        // Check if already installed
        if self.registry.is_installed(&manifest.id) {
            return Err(AppError::Internal(format!(
                "Extension '{}' is already installed",
                manifest.id
            )));
        }

        // Copy to extensions directory
        let target_dir = self.registry.extensions_dir().join(&manifest.id);
        if target_dir.exists() {
            std::fs::remove_dir_all(&target_dir).map_err(|e| {
                AppError::Internal(format!("Failed to remove existing directory: {}", e))
            })?;
        }

        Self::copy_dir_recursive(source_dir, &target_dir)?;

        // Register the extension
        let ext_id = manifest.id.clone();
        self.registry
            .register(manifest, target_dir.to_string_lossy().to_string())?;

        Ok(ext_id)
    }

    /// Install an extension from manifest and files
    pub fn install(&self, manifest: ExtensionManifest, files: Vec<(String, Vec<u8>)>) -> AppResult<String> {
        // Validate manifest
        if let Err(errors) = ManifestParser::validate(&manifest) {
            return Err(AppError::Internal(format!(
                "Invalid manifest: {}",
                errors.join(", ")
            )));
        }

        // Check if already installed
        if self.registry.is_installed(&manifest.id) {
            return Err(AppError::Internal(format!(
                "Extension '{}' is already installed",
                manifest.id
            )));
        }

        // Create extension directory
        let target_dir = self.registry.extensions_dir().join(&manifest.id);
        std::fs::create_dir_all(&target_dir).map_err(|e| {
            AppError::Internal(format!("Failed to create extension directory: {}", e))
        })?;

        // Write files
        for (path, content) in files {
            let file_path = target_dir.join(&path);
            if let Some(parent) = file_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    AppError::Internal(format!("Failed to create directory: {}", e))
                })?;
            }
            std::fs::write(&file_path, content).map_err(|e| {
                AppError::Internal(format!("Failed to write file {}: {}", path, e))
            })?;
        }

        // Write manifest
        let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| {
            AppError::Internal(format!("Failed to serialize manifest: {}", e))
        })?;
        std::fs::write(target_dir.join("extension.json"), manifest_json).map_err(|e| {
            AppError::Internal(format!("Failed to write manifest: {}", e))
        })?;

        // Register the extension
        let ext_id = manifest.id.clone();
        self.registry
            .register(manifest, target_dir.to_string_lossy().to_string())?;

        Ok(ext_id)
    }

    /// Uninstall an extension
    pub fn uninstall(&self, extension_id: &str) -> AppResult<()> {
        // Deactivate first
        self.deactivate(extension_id)?;

        // Remove from registry
        let ext = self.registry.unregister(extension_id)?;
        
        if let Some(ext) = ext {
            // Remove files
            let path = Path::new(&ext.install_path);
            if path.exists() {
                std::fs::remove_dir_all(path).map_err(|e| {
                    AppError::Internal(format!("Failed to remove extension files: {}", e))
                })?;
            }
        }

        Ok(())
    }

    /// Activate an extension
    pub fn activate(&self, extension_id: &str) -> AppResult<()> {
        self.registry.set_status(extension_id, ExtensionStatus::Active)
    }

    /// Deactivate an extension
    pub fn deactivate(&self, extension_id: &str) -> AppResult<()> {
        self.registry.set_status(extension_id, ExtensionStatus::Disabled)
    }

    /// Copy directory recursively
    fn copy_dir_recursive(src: &Path, dst: &Path) -> AppResult<()> {
        std::fs::create_dir_all(dst).map_err(|e| {
            AppError::Internal(format!("Failed to create directory: {}", e))
        })?;

        for entry in std::fs::read_dir(src).map_err(|e| {
            AppError::Internal(format!("Failed to read directory: {}", e))
        })? {
            let entry = entry.map_err(|e| {
                AppError::Internal(format!("Failed to read entry: {}", e))
            })?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            if src_path.is_dir() {
                Self::copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                std::fs::copy(&src_path, &dst_path).map_err(|e| {
                    AppError::Internal(format!("Failed to copy file: {}", e))
                })?;
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use extension_core::ExtensionAuthor;
    use tempfile::tempdir;

    #[test]
    fn test_initialize_creates_directory() {
        let dir = tempdir().unwrap();
        let ext_dir = dir.path().join("extensions");
        
        let registry = Arc::new(ExtensionRegistry::new(ext_dir.clone()));
        let loader = ExtensionLoader::new(registry);
        
        assert!(loader.initialize().is_ok());
        assert!(ext_dir.exists());
    }
}

