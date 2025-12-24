//! Extension system for dbfordevs
//!
//! This module provides the core infrastructure for loading, managing, and
//! interacting with extensions.

mod github;
mod loader;
mod manifest;
mod registry;

pub use github::GitHubExtensionSource;
pub use loader::ExtensionLoader;
pub use manifest::ManifestParser;
pub use registry::ExtensionRegistry;

use extension_core::{ExtensionManifest, ExtensionStatus, InstalledExtension};
use serde::{Deserialize, Serialize};

/// Extension information returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub category: String,
    pub status: ExtensionStatus,
    pub is_official: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

impl From<&InstalledExtension> for ExtensionInfo {
    fn from(ext: &InstalledExtension) -> Self {
        Self {
            id: ext.manifest.id.clone(),
            name: ext.manifest.display_name.clone(),
            version: ext.manifest.version.clone(),
            description: ext.manifest.description.clone(),
            author: ext.manifest.author.name.clone(),
            category: ext.manifest.categories
                .first()
                .map(|c| c.to_string())
                .unwrap_or_else(|| "Other".to_string()),
            status: ext.status.clone(),
            is_official: ext.manifest.is_official,
            repository: ext.manifest.repository.clone(),
            icon: ext.manifest.icon.clone(),
        }
    }
}

/// Extension settings that can be configured
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSettings {
    /// AI Assistant API key (stored securely)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_api_key: Option<String>,
    /// Preferred AI provider
    #[serde(default = "default_ai_provider")]
    pub ai_provider: String,
}

fn default_ai_provider() -> String {
    "anthropic".to_string()
}

