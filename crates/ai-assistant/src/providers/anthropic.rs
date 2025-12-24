//! Anthropic (Claude) AI Provider
//!
//! This module implements the AIProvider trait for Anthropic's Claude API.

use async_trait::async_trait;
use extension_core::ExtensionError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::traits::{AIProvider, AIRequest, AIResponse, TokenUsage};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

/// Anthropic Claude AI Provider
pub struct AnthropicProvider {
    api_key: String,
    client: Client,
    model: String,
}

impl AnthropicProvider {
    /// Create a new Anthropic provider with the given API key
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
            model: DEFAULT_MODEL.to_string(),
        }
    }

    /// Create with a specific model
    pub fn with_model(api_key: String, model: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
            model,
        }
    }
}

/// Anthropic API request format
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

/// Anthropic API response format
#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
    usage: AnthropicUsage,
    #[serde(default)]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    content_type: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

/// Anthropic API error response
#[derive(Debug, Deserialize)]
struct AnthropicError {
    error: AnthropicErrorDetail,
}

#[derive(Debug, Deserialize)]
struct AnthropicErrorDetail {
    message: String,
    #[serde(rename = "type")]
    error_type: String,
}

#[async_trait]
impl AIProvider for AnthropicProvider {
    fn name(&self) -> &str {
        "Anthropic (Claude)"
    }

    fn is_configured(&self) -> bool {
        !self.api_key.is_empty()
    }

    async fn complete(&self, request: AIRequest) -> Result<AIResponse, ExtensionError> {
        if !self.is_configured() {
            return Err(ExtensionError::ConfigurationError(
                "Anthropic API key is not configured".to_string(),
            ));
        }

        let anthropic_request = AnthropicRequest {
            model: self.model.clone(),
            max_tokens: request.max_tokens.unwrap_or(1024),
            system: request.system_prompt,
            messages: vec![AnthropicMessage {
                role: "user".to_string(),
                content: request.prompt,
            }],
            temperature: request.temperature,
        };

        let response = self
            .client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(&anthropic_request)
            .send()
            .await
            .map_err(|e| ExtensionError::NetworkError(format!("Failed to send request: {}", e)))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| ExtensionError::NetworkError(format!("Failed to read response: {}", e)))?;

        if !status.is_success() {
            // Try to parse error response
            if let Ok(error) = serde_json::from_str::<AnthropicError>(&body) {
                return Err(ExtensionError::ExecutionError(format!(
                    "Anthropic API error ({}): {}",
                    error.error.error_type, error.error.message
                )));
            }
            return Err(ExtensionError::ExecutionError(format!(
                "Anthropic API error ({}): {}",
                status, body
            )));
        }

        let anthropic_response: AnthropicResponse = serde_json::from_str(&body)
            .map_err(|e| ExtensionError::ExecutionError(format!("Failed to parse response: {}", e)))?;

        // Extract text from content blocks
        let content = anthropic_response
            .content
            .into_iter()
            .filter(|block| block.content_type == "text")
            .map(|block| block.text)
            .collect::<Vec<_>>()
            .join("\n");

        let mut metadata = HashMap::new();
        if let Some(stop_reason) = anthropic_response.stop_reason {
            metadata.insert("stop_reason".to_string(), stop_reason);
        }

        Ok(AIResponse {
            content,
            usage: TokenUsage {
                input_tokens: anthropic_response.usage.input_tokens,
                output_tokens: anthropic_response.usage.output_tokens,
                total_tokens: anthropic_response.usage.input_tokens
                    + anthropic_response.usage.output_tokens,
            },
            metadata,
        })
    }

    async fn validate_api_key(&self) -> Result<bool, ExtensionError> {
        if !self.is_configured() {
            return Ok(false);
        }

        // Send a minimal request to validate the key
        let test_request = AIRequest {
            prompt: "Say 'ok'".to_string(),
            system_prompt: None,
            max_tokens: Some(10),
            temperature: Some(0.0),
        };

        match self.complete(test_request).await {
            Ok(_) => Ok(true),
            Err(ExtensionError::ExecutionError(msg)) if msg.contains("authentication") => Ok(false),
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_name() {
        let provider = AnthropicProvider::new("test-key".to_string());
        assert_eq!(provider.name(), "Anthropic (Claude)");
    }

    #[test]
    fn test_is_configured() {
        let provider = AnthropicProvider::new("test-key".to_string());
        assert!(provider.is_configured());

        let empty_provider = AnthropicProvider::new(String::new());
        assert!(!empty_provider.is_configured());
    }
}

