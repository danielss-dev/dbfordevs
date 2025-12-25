//! Extension management commands
//!
//! Tauri commands for managing extensions from the frontend.

use std::collections::HashMap;
use std::sync::Arc;

use extension_core::ExtensionStatus;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppResult;
use crate::extensions::{ExtensionInfo, ExtensionLoader, ExtensionRegistry, ExtensionSettings, GitHubExtensionSource};

/// State for extension management
pub struct ExtensionState {
    pub registry: Arc<ExtensionRegistry>,
    pub loader: ExtensionLoader,
    pub settings: std::sync::RwLock<ExtensionSettings>,
}

impl ExtensionState {
    pub fn new() -> Self {
        let registry = Arc::new(ExtensionRegistry::default());
        let loader = ExtensionLoader::new(registry.clone());
        Self {
            registry,
            loader,
            settings: std::sync::RwLock::new(ExtensionSettings::default()),
        }
    }
}

impl Default for ExtensionState {
    fn default() -> Self {
        Self::new()
    }
}

/// List all installed extensions
#[tauri::command]
pub async fn list_extensions(state: State<'_, ExtensionState>) -> AppResult<Vec<ExtensionInfo>> {
    state.registry.list_installed()
}

/// Get extension by ID
#[tauri::command]
pub async fn get_extension(
    extension_id: String,
    state: State<'_, ExtensionState>,
) -> AppResult<Option<ExtensionInfo>> {
    let ext = state.registry.get(&extension_id)?;
    Ok(ext.as_ref().map(ExtensionInfo::from))
}

/// Enable an extension
#[tauri::command]
pub async fn enable_extension(
    extension_id: String,
    state: State<'_, ExtensionState>,
) -> AppResult<()> {
    state.loader.activate(&extension_id)
}

/// Disable an extension
#[tauri::command]
pub async fn disable_extension(
    extension_id: String,
    state: State<'_, ExtensionState>,
) -> AppResult<()> {
    state.loader.deactivate(&extension_id)
}

/// Uninstall an extension
#[tauri::command]
pub async fn uninstall_extension(
    extension_id: String,
    state: State<'_, ExtensionState>,
) -> AppResult<()> {
    state.loader.uninstall(&extension_id)
}

/// Install extension from GitHub
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallFromGitHubRequest {
    pub repository_url: String,
}

#[tauri::command]
pub async fn install_extension_from_github(
    request: InstallFromGitHubRequest,
    state: State<'_, ExtensionState>,
) -> AppResult<ExtensionInfo> {
    let (owner, repo) = GitHubExtensionSource::parse_repo_url(&request.repository_url)
        .ok_or_else(|| crate::error::AppError::Internal("Invalid GitHub repository URL".to_string()))?;

    let source = GitHubExtensionSource::new();
    let (release, _data) = source.download_extension(&owner, &repo).await?;

    // For now, just return info about what would be installed
    // Full installation would extract the zip and call loader.install()
    
    Ok(ExtensionInfo {
        id: repo.clone(),
        name: release.name.unwrap_or_else(|| repo.clone()),
        version: release.tag_name,
        description: release.body.unwrap_or_default(),
        author: owner,
        category: "Other".to_string(),
        status: ExtensionStatus::Installing,
        is_official: false,
        repository: Some(request.repository_url),
        icon: None,
    })
}

/// Update extension settings
#[tauri::command]
pub async fn update_extension_settings(
    settings: ExtensionSettings,
    state: State<'_, ExtensionState>,
) -> AppResult<()> {
    let mut current = state.settings.write().map_err(|_| {
        crate::error::AppError::Internal("Failed to acquire settings lock".to_string())
    })?;
    *current = settings;
    Ok(())
}

/// Get extension settings
#[tauri::command]
pub async fn get_extension_settings(
    state: State<'_, ExtensionState>,
) -> AppResult<ExtensionSettings> {
    let settings = state.settings.read().map_err(|_| {
        crate::error::AppError::Internal("Failed to acquire settings lock".to_string())
    })?;
    Ok(settings.clone())
}
