//! Node.js Connection String Validator
//!
//! This validator handles connection strings used in Node.js applications
//! with packages like pg, mysql2, and mssql.
//!
//! # Supported Formats
//! 
//! ## URL Format (pg, mysql2)
//! ```text
//! postgresql://user:password@localhost:5432/mydb
//! mysql://user:password@localhost:3306/mydb
//! ```
//!
//! ## MSSQL Configuration Object (as JSON)
//! ```text
//! {"server":"localhost","database":"mydb","user":"user","password":"pass"}
//! ```

use extension_core::{Extension, ExtensionCategory, ExtensionMetadata};
use std::collections::HashMap;
use url::Url;
use validator_core::{
    ConnectionStringValidator, DatabaseType, ParsedConnection,
    ValidationResult, ValidatorError, error_message, warning_message,
};

pub struct NodeJsValidator;

impl NodeJsValidator {
    pub fn new() -> Self {
        Self
    }

    /// Detect the format of the connection string
    fn detect_format(&self, conn_str: &str) -> ConnectionFormat {
        let trimmed = conn_str.trim();
        
        if trimmed.starts_with('{') {
            ConnectionFormat::Json
        } else if trimmed.contains("://") {
            ConnectionFormat::Url
        } else {
            ConnectionFormat::Unknown
        }
    }

    /// Parse URL-style connection string
    fn parse_url(&self, conn_str: &str) -> Result<ParsedConnection, ValidatorError> {
        let url = Url::parse(conn_str)
            .map_err(|e| ValidatorError::ParseError(format!("Invalid URL: {}", e)))?;

        let mut parsed = ParsedConnection::default();
        parsed.original_format = Some("url".to_string());

        // Detect database type from scheme
        parsed.database_type = match url.scheme() {
            "postgresql" | "postgres" => Some(DatabaseType::PostgreSQL),
            "mysql" => Some(DatabaseType::MySQL),
            "mssql" | "sqlserver" => Some(DatabaseType::MSSQL),
            _ => None,
        };

        parsed.host = url.host_str().map(String::from);
        parsed.port = url.port();
        parsed.username = if url.username().is_empty() {
            None
        } else {
            Some(url.username().to_string())
        };
        parsed.password = url.password().map(String::from);
        
        // Database name is the path without leading slash
        let path = url.path();
        if path.len() > 1 {
            parsed.database = Some(path[1..].to_string());
        }

        // Parse query parameters as options
        for (key, value) in url.query_pairs() {
            if key == "sslmode" || key == "ssl" {
                parsed.ssl_mode = Some(value.to_string());
            } else {
                parsed.options.insert(key.to_string(), value.to_string());
            }
        }

        Ok(parsed)
    }

    /// Parse JSON configuration object
    fn parse_json(&self, conn_str: &str) -> Result<ParsedConnection, ValidatorError> {
        let json: HashMap<String, serde_json::Value> = serde_json::from_str(conn_str)
            .map_err(|e| ValidatorError::ParseError(format!("Invalid JSON: {}", e)))?;

        let mut parsed = ParsedConnection::default();
        parsed.original_format = Some("json".to_string());

        // Extract fields
        parsed.host = json.get("server")
            .or_else(|| json.get("host"))
            .and_then(|v| v.as_str())
            .map(String::from);

        parsed.port = json.get("port")
            .and_then(|v| v.as_u64())
            .map(|v| v as u16);

        parsed.database = json.get("database")
            .and_then(|v| v.as_str())
            .map(String::from);

        parsed.username = json.get("user")
            .or_else(|| json.get("username"))
            .and_then(|v| v.as_str())
            .map(String::from);

        parsed.password = json.get("password")
            .and_then(|v| v.as_str())
            .map(String::from);

        // Check for SSL options
        if let Some(options) = json.get("options").and_then(|v| v.as_object()) {
            if let Some(encrypt) = options.get("encrypt").and_then(|v| v.as_bool()) {
                parsed.ssl_mode = Some(if encrypt { "require" } else { "disable" }.to_string());
            }
        }

        // Detect database type (MSSQL typically uses JSON config)
        parsed.database_type = Some(DatabaseType::MSSQL);

        Ok(parsed)
    }
}

#[derive(Debug, Clone, PartialEq)]
enum ConnectionFormat {
    Url,
    Json,
    Unknown,
}

impl Default for NodeJsValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl Extension for NodeJsValidator {
    fn metadata(&self) -> ExtensionMetadata {
        ExtensionMetadata {
            id: "nodejs".to_string(),
            name: "Node.js Validator".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: "Connection strings for pg, mysql2, mssql packages".to_string(),
            author: "Daniels".to_string(),
            category: ExtensionCategory::Validator,
            is_official: true,
            repository: None,
            min_app_version: None,
        }
    }
}

impl ConnectionStringValidator for NodeJsValidator {
    fn parse(&self, connection_string: &str) -> Result<ParsedConnection, ValidatorError> {
        if connection_string.trim().is_empty() {
            return Err(ValidatorError::ParseError("Connection string is empty".to_string()));
        }

        match self.detect_format(connection_string) {
            ConnectionFormat::Url => self.parse_url(connection_string),
            ConnectionFormat::Json => self.parse_json(connection_string),
            ConnectionFormat::Unknown => {
                Err(ValidatorError::InvalidFormat(
                    "Connection string must be a URL (postgresql://...) or JSON object".to_string()
                ))
            }
        }
    }

    fn validate(&self, connection_string: &str) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        let parsed = match self.parse(connection_string) {
            Ok(p) => Some(p),
            Err(e) => {
                errors.push(error_message("PARSE_ERROR", &e.to_string(), None));
                None
            }
        };

        if let Some(ref p) = parsed {
            // Validate required fields
            if p.host.is_none() {
                errors.push(error_message(
                    "MISSING_HOST",
                    "Connection string must include a host/server",
                    Some("host"),
                ));
            }

            if p.database.is_none() {
                errors.push(error_message(
                    "MISSING_DATABASE",
                    "Connection string must include a database name",
                    Some("database"),
                ));
            }

            // Warnings
            if p.username.is_none() {
                warnings.push(warning_message(
                    "MISSING_USER",
                    "No username specified in connection string",
                    Some("username"),
                ));
            }

            if p.password.is_some() && p.ssl_mode.is_none() {
                warnings.push(warning_message(
                    "NO_SSL",
                    "Password provided without SSL; consider enabling SSL for security",
                    Some("ssl_mode"),
                ));
            }

            // Validate port ranges
            if let Some(port) = p.port {
                if port == 0 {
                    errors.push(error_message(
                        "INVALID_PORT",
                        "Port cannot be 0",
                        Some("port"),
                    ));
                }
            }
        }

        ValidationResult {
            valid: errors.is_empty(),
            parsed,
            errors,
            warnings,
        }
    }

    fn supports_database(&self, db_type: &DatabaseType) -> bool {
        matches!(
            db_type,
            DatabaseType::PostgreSQL | DatabaseType::MySQL | DatabaseType::MSSQL
        )
    }

    fn to_connection_string(&self, parsed: &ParsedConnection) -> Result<String, ValidatorError> {
        let scheme = match parsed.database_type {
            Some(DatabaseType::PostgreSQL) => "postgresql",
            Some(DatabaseType::MySQL) => "mysql",
            Some(DatabaseType::MSSQL) => "mssql",
            _ => "postgresql", // Default
        };

        let mut url = format!("{}://", scheme);

        if let Some(ref user) = parsed.username {
            url.push_str(user);
            if let Some(ref pass) = parsed.password {
                url.push(':');
                url.push_str(pass);
            }
            url.push('@');
        }

        if let Some(ref host) = parsed.host {
            url.push_str(host);
        }

        if let Some(port) = parsed.port {
            url.push(':');
            url.push_str(&port.to_string());
        }

        if let Some(ref db) = parsed.database {
            url.push('/');
            url.push_str(db);
        }

        // Add query parameters
        let mut query_parts = Vec::new();
        if let Some(ref ssl) = parsed.ssl_mode {
            query_parts.push(format!("sslmode={}", ssl));
        }
        for (key, value) in &parsed.options {
            query_parts.push(format!("{}={}", key, value));
        }

        if !query_parts.is_empty() {
            url.push('?');
            url.push_str(&query_parts.join("&"));
        }

        Ok(url)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_postgresql_url() {
        let validator = NodeJsValidator::new();
        let result = validator.parse("postgresql://user:pass@localhost:5432/mydb");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::PostgreSQL));
        assert_eq!(parsed.host, Some("localhost".to_string()));
        assert_eq!(parsed.port, Some(5432));
        assert_eq!(parsed.database, Some("mydb".to_string()));
        assert_eq!(parsed.username, Some("user".to_string()));
        assert_eq!(parsed.password, Some("pass".to_string()));
    }

    #[test]
    fn test_parse_mysql_url() {
        let validator = NodeJsValidator::new();
        let result = validator.parse("mysql://root:secret@127.0.0.1:3306/testdb");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::MySQL));
    }

    #[test]
    fn test_parse_json_config() {
        let validator = NodeJsValidator::new();
        let result = validator.parse(r#"{"server":"localhost","database":"mydb","user":"sa","password":"pass"}"#);
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.host, Some("localhost".to_string()));
        assert_eq!(parsed.database, Some("mydb".to_string()));
    }

    #[test]
    fn test_validate_missing_database() {
        let validator = NodeJsValidator::new();
        let result = validator.validate("postgresql://user:pass@localhost:5432");
        
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "MISSING_DATABASE"));
    }
}

