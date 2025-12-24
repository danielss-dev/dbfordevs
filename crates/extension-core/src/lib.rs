//! Core traits and types for the dbfordevs extension system.
//!
//! This crate provides the foundational architecture for all extensions
//! in the dbfordevs ecosystem.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Common errors that can occur within the extension system.
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum ExtensionError {
    #[error("Initialization error: {0}")]
    InitializationError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Extension not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Manifest error: {0}")]
    ManifestError(String),
}

/// Metadata about an extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionMetadata {
    /// Unique identifier for the extension (e.g., "official-ai-assistant")
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Extension version (semantic versioning)
    pub version: String,
    /// Description of what the extension does
    pub description: String,
    /// Author information
    pub author: String,
    /// Category of the extension (e.g., "validator", "ai", "exporter")
    pub category: ExtensionCategory,
    /// Whether this is an official dbfordevs extension
    #[serde(default)]
    pub is_official: bool,
    /// Repository URL (for GitHub-based extensions)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    /// Minimum dbfordevs version required
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_app_version: Option<String>,
}

/// Categories for extensions to organize them in the Marketplace.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExtensionCategory {
    Validator,
    AI,
    Exporter,
    Theme,
    Connector,
    Other(String),
}

impl std::fmt::Display for ExtensionCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExtensionCategory::Validator => write!(f, "Validator"),
            ExtensionCategory::AI => write!(f, "AI"),
            ExtensionCategory::Exporter => write!(f, "Exporter"),
            ExtensionCategory::Theme => write!(f, "Theme"),
            ExtensionCategory::Connector => write!(f, "Connector"),
            ExtensionCategory::Other(s) => write!(f, "{}", s),
        }
    }
}

/// The base trait that all extensions must implement.
pub trait Extension: Send + Sync {
    /// Returns metadata about the extension.
    fn metadata(&self) -> ExtensionMetadata;

    /// Called when the extension is loaded.
    fn on_load(&self) -> Result<(), ExtensionError> {
        Ok(())
    }

    /// Called when the extension is unloaded.
    fn on_unload(&self) -> Result<(), ExtensionError> {
        Ok(())
    }

    /// Called when the extension is enabled.
    fn on_enable(&self) -> Result<(), ExtensionError> {
        Ok(())
    }

    /// Called when the extension is disabled.
    fn on_disable(&self) -> Result<(), ExtensionError> {
        Ok(())
    }
}

/// Represents the status of an extension in the system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExtensionStatus {
    /// Extension is installed but not active
    Installed,
    /// Extension is active and running
    Active,
    /// Extension is disabled by user
    Disabled,
    /// Extension encountered an error
    Error(String),
    /// Extension is being installed
    Installing,
    /// Extension is being updated
    Updating,
}

/// Author information for an extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionAuthor {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Contribution point for commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    /// Unique command identifier
    pub id: String,
    /// Display title for the command
    pub title: String,
    /// Optional keyboard shortcut
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,
    /// Optional icon name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Contribution point for panels.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelContribution {
    /// Unique panel identifier
    pub id: String,
    /// Display title for the panel
    pub title: String,
    /// Panel location (sidebar, bottom, right)
    pub location: PanelLocation,
    /// Optional icon name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Location where a panel can be placed.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PanelLocation {
    Sidebar,
    Bottom,
    Right,
}

/// Contribution point for settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingContribution {
    /// Unique setting identifier
    pub id: String,
    /// Display title for the setting
    pub title: String,
    /// Setting type
    pub setting_type: SettingType,
    /// Default value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    /// Description of the setting
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Types of settings that can be contributed.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SettingType {
    String,
    Number,
    Boolean,
    Select,
    Password,
}

/// Extension capabilities that can be contributed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ExtensionCapability {
    Command(CommandContribution),
    Panel(PanelContribution),
    Setting(SettingContribution),
}

/// Extension manifest structure - defines extension configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifest {
    /// Unique identifier for the extension
    pub id: String,
    /// Semantic version
    pub version: String,
    /// Display name
    pub display_name: String,
    /// Description
    pub description: String,
    /// Author information
    pub author: ExtensionAuthor,
    /// Categories
    pub categories: Vec<ExtensionCategory>,
    /// Whether this is an official extension
    #[serde(default)]
    pub is_official: bool,
    /// Capabilities contributed by this extension
    #[serde(default)]
    pub capabilities: Vec<ExtensionCapability>,
    /// Events that trigger extension activation
    #[serde(default)]
    pub activation_events: Vec<String>,
    /// Repository URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    /// Minimum dbfordevs version required
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_app_version: Option<String>,
    /// Extension icon path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Extension homepage
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    /// License
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
}

impl ExtensionManifest {
    /// Convert manifest to extension metadata.
    pub fn to_metadata(&self) -> ExtensionMetadata {
        ExtensionMetadata {
            id: self.id.clone(),
            name: self.display_name.clone(),
            version: self.version.clone(),
            description: self.description.clone(),
            author: self.author.name.clone(),
            category: self.categories.first().cloned().unwrap_or(ExtensionCategory::Other("Unknown".to_string())),
            is_official: self.is_official,
            repository: self.repository.clone(),
            min_app_version: self.min_app_version.clone(),
        }
    }
}

/// Information about an extension in the marketplace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceExtension {
    pub metadata: ExtensionMetadata,
    pub status: ExtensionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloads: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<f32>,
}

/// Installed extension information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledExtension {
    pub manifest: ExtensionManifest,
    pub status: ExtensionStatus,
    pub install_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extension_category_display() {
        assert_eq!(ExtensionCategory::AI.to_string(), "AI");
        assert_eq!(ExtensionCategory::Validator.to_string(), "Validator");
    }

    #[test]
    fn test_manifest_to_metadata() {
        let manifest = ExtensionManifest {
            id: "test-ext".to_string(),
            version: "1.0.0".to_string(),
            display_name: "Test Extension".to_string(),
            description: "A test extension".to_string(),
            author: ExtensionAuthor {
                name: "Test".to_string(),
                email: None,
                url: None,
            },
            categories: vec![ExtensionCategory::AI],
            is_official: true,
            capabilities: vec![],
            activation_events: vec![],
            repository: None,
            min_app_version: None,
            icon: None,
            homepage: None,
            license: None,
        };

        let metadata = manifest.to_metadata();
        assert_eq!(metadata.id, "test-ext");
        assert_eq!(metadata.name, "Test Extension");
        assert!(metadata.is_official);
    }
}
