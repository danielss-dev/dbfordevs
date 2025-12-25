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
    // Legacy field - kept for backwards compatibility
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_api_key: Option<String>,

    /// Current AI provider: "anthropic" or "gemini"
    #[serde(default = "default_ai_provider")]
    pub ai_provider: String,

    // Provider-specific API keys
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_anthropic_api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_gemini_api_key: Option<String>,

    // Provider-specific models
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_anthropic_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_gemini_model: Option<String>,

    /// Temperature for AI generation (0.0 - 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_temperature: Option<f32>,

    /// Max tokens for AI generation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_max_tokens: Option<u32>,
}

fn default_ai_provider() -> String {
    "anthropic".to_string()
}

impl ExtensionSettings {
    /// Get the API key for the current provider
    pub fn current_api_key(&self) -> Option<&String> {
        match self.ai_provider.as_str() {
            "anthropic" => self.ai_anthropic_api_key.as_ref().or(self.ai_api_key.as_ref()),
            "gemini" => self.ai_gemini_api_key.as_ref(),
            _ => self.ai_anthropic_api_key.as_ref().or(self.ai_api_key.as_ref()),
        }
    }

    /// Get the model for the current provider
    pub fn current_model(&self) -> Option<&String> {
        match self.ai_provider.as_str() {
            "anthropic" => self.ai_anthropic_model.as_ref(),
            "gemini" => self.ai_gemini_model.as_ref(),
            _ => self.ai_anthropic_model.as_ref(),
        }
    }
}

