//! Extension management commands
//!
//! Tauri commands for managing extensions from the frontend.

use std::sync::Arc;

use ai_assistant::{AIAssistant, ColumnInfo, GeneratedSQL, QueryContext, QueryExplanation, TableInfo};
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

// ============================================================================
// AI Assistant Commands
// ============================================================================

/// Request for AI SQL generation
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSQLRequest {
    pub prompt: String,
    pub database_type: Option<String>,
    pub database_name: Option<String>,
    pub schema_name: Option<String>,
    pub tables: Vec<TableInfoRequest>,
    pub selected_table: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfoRequest {
    pub name: String,
    pub columns: Vec<ColumnInfoRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfoRequest {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
}

impl From<GenerateSQLRequest> for QueryContext {
    fn from(req: GenerateSQLRequest) -> Self {
        QueryContext {
            database_type: req.database_type,
            database_name: req.database_name,
            schema_name: req.schema_name,
            tables: req.tables.into_iter().map(|t| TableInfo {
                name: t.name,
                columns: t.columns.into_iter().map(|c| ColumnInfo {
                    name: c.name,
                    data_type: c.data_type,
                    is_nullable: c.is_nullable,
                    is_primary_key: c.is_primary_key,
                }).collect(),
            }).collect(),
            selected_table: req.selected_table,
        }
    }
}

/// Generate SQL from natural language
#[tauri::command]
pub async fn ai_generate_sql(
    request: GenerateSQLRequest,
    state: State<'_, ExtensionState>,
) -> AppResult<GeneratedSQL> {
    let api_key = {
        let settings = state.settings.read().map_err(|_| {
            crate::error::AppError::Internal("Failed to acquire settings lock".to_string())
        })?;
        settings.ai_api_key.clone()
    };

    let api_key = api_key.ok_or_else(|| {
        crate::error::AppError::Internal("AI API key is not configured. Please set it in Settings > Extensions.".to_string())
    })?;

    let assistant = AIAssistant::with_anthropic(api_key);
    let context: QueryContext = request.into();
    
    assistant
        .generate_sql(&context.selected_table.clone().unwrap_or_default(), &context)
        .await
        .map_err(|e| crate::error::AppError::Internal(e.to_string()))
}

/// Request for AI query explanation
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainQueryRequest {
    pub sql: String,
    pub database_type: Option<String>,
}

/// Explain a SQL query
#[tauri::command]
pub async fn ai_explain_query(
    request: ExplainQueryRequest,
    state: State<'_, ExtensionState>,
) -> AppResult<QueryExplanation> {
    let api_key = {
        let settings = state.settings.read().map_err(|_| {
            crate::error::AppError::Internal("Failed to acquire settings lock".to_string())
        })?;
        settings.ai_api_key.clone()
    };

    let api_key = api_key.ok_or_else(|| {
        crate::error::AppError::Internal("AI API key is not configured".to_string())
    })?;

    let assistant = AIAssistant::with_anthropic(api_key);
    let context = QueryContext {
        database_type: request.database_type,
        ..Default::default()
    };
    
    assistant
        .explain_query(&request.sql, &context)
        .await
        .map_err(|e| crate::error::AppError::Internal(e.to_string()))
}

/// AI chat message for conversational interface
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIChatMessage {
    pub role: String,        // "user" or "assistant"
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sql: Option<String>, // Generated SQL if any
}

/// Request for AI chat
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIChatRequest {
    pub message: String,
    pub context: Option<GenerateSQLRequest>,
}

/// AI chat response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIChatResponse {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sql: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
}

/// Chat with AI assistant
#[tauri::command]
pub async fn ai_chat(
    request: AIChatRequest,
    state: State<'_, ExtensionState>,
) -> AppResult<AIChatResponse> {
    let api_key = {
        let settings = state.settings.read().map_err(|_| {
            crate::error::AppError::Internal("Failed to acquire settings lock".to_string())
        })?;
        settings.ai_api_key.clone()
    };

    let api_key = api_key.ok_or_else(|| {
        crate::error::AppError::Internal("AI API key is not configured. Please configure it in Settings > Extensions.".to_string())
    })?;

    let assistant = AIAssistant::with_anthropic(api_key);
    let context: QueryContext = request.context.map(Into::into).unwrap_or_default();
    
    // Try to generate SQL if the message seems like a query request
    let result = assistant
        .generate_sql(&request.message, &context)
        .await
        .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;

    Ok(AIChatResponse {
        message: result.explanation.clone().unwrap_or_else(|| {
            "Here's the SQL query for your request:".to_string()
        }),
        sql: Some(result.sql),
        explanation: result.explanation,
    })
}

