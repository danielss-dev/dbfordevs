//! Core traits and types for dbfordevs connection string validators
//!
//! This crate provides the foundational interfaces that all language-specific
//! connection string validators must implement.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur during connection string validation
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum ValidatorError {
    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Invalid format: {0}")]
    InvalidFormat(String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid value for {field}: {message}")]
    InvalidValue { field: String, message: String },

    #[error("Unsupported database type: {0}")]
    UnsupportedDatabase(String),
}

/// Supported database types for connection strings
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    PostgreSQL,
    MySQL,
    SQLite,
    MSSQL,
    Oracle,
    MongoDB,
    Redis,
}

impl std::fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseType::PostgreSQL => write!(f, "PostgreSQL"),
            DatabaseType::MySQL => write!(f, "MySQL"),
            DatabaseType::SQLite => write!(f, "SQLite"),
            DatabaseType::MSSQL => write!(f, "Microsoft SQL Server"),
            DatabaseType::Oracle => write!(f, "Oracle"),
            DatabaseType::MongoDB => write!(f, "MongoDB"),
            DatabaseType::Redis => write!(f, "Redis"),
        }
    }
}

/// Parsed connection string components
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ParsedConnection {
    /// Database type detected from connection string
    pub database_type: Option<DatabaseType>,
    /// Host/server address
    pub host: Option<String>,
    /// Port number
    pub port: Option<u16>,
    /// Database name
    pub database: Option<String>,
    /// Username for authentication
    pub username: Option<String>,
    /// Password (may be masked in display)
    pub password: Option<String>,
    /// SSL/TLS mode
    pub ssl_mode: Option<String>,
    /// Additional driver-specific options
    pub options: std::collections::HashMap<String, String>,
    /// Original connection string format
    pub original_format: Option<String>,
}

/// Result of connection string validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// Whether the connection string is valid
    pub valid: bool,
    /// Parsed connection details (if parsing succeeded)
    pub parsed: Option<ParsedConnection>,
    /// List of validation errors
    pub errors: Vec<ValidationMessage>,
    /// List of warnings (valid but potentially problematic)
    pub warnings: Vec<ValidationMessage>,
}

/// A validation message (error or warning)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationMessage {
    /// Message code for programmatic handling
    pub code: String,
    /// Human-readable message
    pub message: String,
    /// Field this message relates to (if applicable)
    pub field: Option<String>,
}

/// Information about a validator plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorInfo {
    /// Unique identifier for this validator
    pub id: String,
    /// Display name
    pub name: String,
    /// Description of what this validator handles
    pub description: String,
    /// List of supported database types
    pub supported_databases: Vec<String>,
}

/// Trait that all connection string validators must implement
pub trait ConnectionStringValidator: Send + Sync {
    /// Returns information about this validator
    fn info(&self) -> ValidatorInfo;

    /// Parse a connection string into its components
    fn parse(&self, connection_string: &str) -> Result<ParsedConnection, ValidatorError>;

    /// Validate a connection string
    fn validate(&self, connection_string: &str) -> ValidationResult;

    /// Check if this validator supports the given database type
    fn supports_database(&self, db_type: &DatabaseType) -> bool;

    /// Convert a ParsedConnection back to a connection string format
    fn to_connection_string(&self, parsed: &ParsedConnection) -> Result<String, ValidatorError>;
}

/// Helper function to create a validation error message
pub fn error_message(code: &str, message: &str, field: Option<&str>) -> ValidationMessage {
    ValidationMessage {
        code: code.to_string(),
        message: message.to_string(),
        field: field.map(String::from),
    }
}

/// Helper function to create a validation warning message
pub fn warning_message(code: &str, message: &str, field: Option<&str>) -> ValidationMessage {
    ValidationMessage {
        code: code.to_string(),
        message: message.to_string(),
        field: field.map(String::from),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_type_display() {
        assert_eq!(DatabaseType::PostgreSQL.to_string(), "PostgreSQL");
        assert_eq!(DatabaseType::MySQL.to_string(), "MySQL");
        assert_eq!(DatabaseType::MSSQL.to_string(), "Microsoft SQL Server");
    }

    #[test]
    fn test_parsed_connection_default() {
        let parsed = ParsedConnection::default();
        assert!(parsed.host.is_none());
        assert!(parsed.database_type.is_none());
    }
}

