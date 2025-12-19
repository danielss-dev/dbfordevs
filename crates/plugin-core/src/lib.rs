//! Core traits and types for the dbfordevs plugin system.
//!
//! This crate provides the foundational architecture for all plugins
//! in the dbfordevs ecosystem.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Common errors that can occur within the plugin system.
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum PluginError {
    #[error("Initialization error: {0}")]
    InitializationError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Plugin not found: {0}")]
    NotFound(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),
}

/// Metadata about a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    /// Unique identifier for the plugin (e.g., "official-ai-assistant")
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Plugin version (semantic versioning)
    pub version: String,
    /// Description of what the plugin does
    pub description: String,
    /// Author information
    pub author: String,
    /// Category of the plugin (e.g., "validator", "ai", "exporter")
    pub category: PluginCategory,
}

/// Categories for plugins to organize them in the Marketplace.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PluginCategory {
    Validator,
    AI,
    Exporter,
    Theme,
    Other(String),
}

/// The base trait that all plugins must implement.
pub trait Plugin: Send + Sync {
    /// Returns metadata about the plugin.
    fn metadata(&self) -> PluginMetadata;

    /// Called when the plugin is loaded.
    fn on_load(&self) -> Result<(), PluginError> {
        Ok(())
    }

    /// Called when the plugin is unloaded.
    fn on_unload(&self) -> Result<(), PluginError> {
        Ok(())
    }
}

/// Represents the status of a plugin in the system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PluginStatus {
    Installed,
    Active,
    Disabled,
    Error(String),
}

/// Information about a plugin in the marketplace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplacePlugin {
    pub metadata: PluginMetadata,
    pub status: PluginStatus,
    pub download_url: Option<String>,
}

