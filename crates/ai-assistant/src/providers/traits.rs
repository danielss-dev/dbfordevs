//! AI Provider trait definitions

use async_trait::async_trait;
use extension_core::ExtensionError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Request structure for AI completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRequest {
    /// The user prompt
    pub prompt: String,
    /// Optional system prompt for context
    pub system_prompt: Option<String>,
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    /// Temperature for randomness (0.0 - 1.0)
    pub temperature: Option<f32>,
}

/// Response structure from AI completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    /// The generated content
    pub content: String,
    /// Token usage information
    pub usage: TokenUsage,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

/// Token usage information
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenUsage {
    /// Input tokens used
    pub input_tokens: u32,
    /// Output tokens generated
    pub output_tokens: u32,
    /// Total tokens
    pub total_tokens: u32,
}

/// Trait that all AI providers must implement
#[async_trait]
pub trait AIProvider: Send + Sync {
    /// Get the provider name
    fn name(&self) -> &str;
    
    /// Check if the provider is configured and ready
    fn is_configured(&self) -> bool;
    
    /// Complete a prompt
    async fn complete(&self, request: AIRequest) -> Result<AIResponse, ExtensionError>;
    
    /// Check if the API key is valid
    async fn validate_api_key(&self) -> Result<bool, ExtensionError>;
}

