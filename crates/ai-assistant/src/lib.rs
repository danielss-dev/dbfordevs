//! AI Query Assistant Extension for dbfordevs
//!
//! This extension provides AI-powered query assistance using Claude (Anthropic).
//! Features include:
//! - Natural language to SQL translation
//! - Query explanation and analysis
//! - Query optimization suggestions
//! - Schema-aware completions

pub mod providers;
mod prompts;

use extension_core::{Extension, ExtensionCategory, ExtensionError, ExtensionMetadata};
use providers::{AIProvider, AIRequest};
use serde::{Deserialize, Serialize};

/// AI Assistant extension for dbfordevs
pub struct AIAssistant {
    provider: Box<dyn AIProvider>,
}

impl AIAssistant {
    /// Create a new AI Assistant with the specified provider
    pub fn new(provider: Box<dyn AIProvider>) -> Self {
        Self { provider }
    }

    /// Create with default Anthropic provider
    pub fn with_anthropic(api_key: String) -> Self {
        Self {
            provider: Box::new(providers::anthropic::AnthropicProvider::new(api_key)),
        }
    }

    /// Generate SQL from natural language
    pub async fn generate_sql(
        &self,
        prompt: &str,
        context: &QueryContext,
    ) -> Result<GeneratedSQL, ExtensionError> {
        let system_prompt = prompts::sql_generation_prompt(context);
        let request = AIRequest {
            prompt: prompt.to_string(),
            system_prompt: Some(system_prompt),
            max_tokens: Some(2048),
            temperature: Some(0.1), // Low temperature for more deterministic SQL
        };

        let response = self.provider.complete(request).await?;
        
        Ok(GeneratedSQL {
            sql: response.content,
            explanation: response.metadata.get("explanation").cloned(),
            confidence: response.metadata.get("confidence")
                .and_then(|c| c.parse().ok())
                .unwrap_or(0.8),
        })
    }

    /// Explain an existing SQL query
    pub async fn explain_query(
        &self,
        sql: &str,
        context: &QueryContext,
    ) -> Result<QueryExplanation, ExtensionError> {
        let system_prompt = prompts::query_explanation_prompt(context);
        let request = AIRequest {
            prompt: format!("Explain this SQL query:\n\n```sql\n{}\n```", sql),
            system_prompt: Some(system_prompt),
            max_tokens: Some(1024),
            temperature: Some(0.3),
        };

        let response = self.provider.complete(request).await?;
        
        Ok(QueryExplanation {
            summary: response.content,
            steps: vec![], // Parse from response if structured
            warnings: vec![],
        })
    }

    /// Suggest optimizations for a query
    pub async fn optimize_query(
        &self,
        sql: &str,
        context: &QueryContext,
    ) -> Result<OptimizationSuggestions, ExtensionError> {
        let system_prompt = prompts::optimization_prompt(context);
        let request = AIRequest {
            prompt: format!("Analyze and optimize this SQL query:\n\n```sql\n{}\n```", sql),
            system_prompt: Some(system_prompt),
            max_tokens: Some(2048),
            temperature: Some(0.2),
        };

        let response = self.provider.complete(request).await?;
        
        Ok(OptimizationSuggestions {
            original_sql: sql.to_string(),
            optimized_sql: None, // Parse from response
            suggestions: vec![response.content],
            estimated_improvement: None,
        })
    }
}

impl Extension for AIAssistant {
    fn metadata(&self) -> ExtensionMetadata {
        ExtensionMetadata {
            id: "ai-assistant".to_string(),
            name: "AI Query Assistant".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: "Generate SQL from natural language, optimize queries, and explain plans using Claude AI".to_string(),
            author: "dbfordevs".to_string(),
            category: ExtensionCategory::AI,
            is_official: true,
            repository: Some("https://github.com/dbfordevs/dbfordevs".to_string()),
            min_app_version: Some("0.1.0".to_string()),
        }
    }

    fn on_load(&self) -> Result<(), ExtensionError> {
        Ok(())
    }
}

/// Context for AI queries - provides schema information
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QueryContext {
    /// Database type (postgres, mysql, sqlite, etc.)
    pub database_type: Option<String>,
    /// Current database name
    pub database_name: Option<String>,
    /// Current schema
    pub schema_name: Option<String>,
    /// Available tables with their columns
    pub tables: Vec<TableInfo>,
    /// Currently selected table (if any)
    pub selected_table: Option<String>,
}

/// Table information for context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub columns: Vec<ColumnInfo>,
}

/// Column information for context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
}

/// Result of SQL generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedSQL {
    /// The generated SQL query
    pub sql: String,
    /// Optional explanation of what the query does
    pub explanation: Option<String>,
    /// Confidence score (0.0 - 1.0)
    pub confidence: f32,
}

/// Result of query explanation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryExplanation {
    /// High-level summary
    pub summary: String,
    /// Step-by-step breakdown
    pub steps: Vec<String>,
    /// Any warnings or potential issues
    pub warnings: Vec<String>,
}

/// Result of query optimization analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestions {
    /// Original SQL
    pub original_sql: String,
    /// Optimized SQL (if changes suggested)
    pub optimized_sql: Option<String>,
    /// List of suggestions
    pub suggestions: Vec<String>,
    /// Estimated performance improvement
    pub estimated_improvement: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata() {
        // Create a mock provider for testing
        let provider = providers::anthropic::AnthropicProvider::new("test-key".to_string());
        let assistant = AIAssistant::new(Box::new(provider));
        
        let metadata = assistant.metadata();
        assert_eq!(metadata.id, "ai-assistant");
        assert!(metadata.is_official);
    }
}

