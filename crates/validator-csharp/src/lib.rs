//! C# / .NET ADO.NET Connection String Validator
//!
//! This validator handles ADO.NET style connection strings used in C# applications
//! with SqlConnection, NpgsqlConnection, MySqlConnection, etc.
//!
//! # Format
//! ADO.NET connection strings use semicolon-separated key=value pairs:
//! ```text
//! Server=localhost;Database=mydb;User Id=user;Password=pass;
//! ```

use std::collections::HashMap;
use validator_core::{
    ConnectionStringValidator, DatabaseType, ParsedConnection,
    ValidationResult, ValidatorError, ValidatorInfo, error_message, warning_message,
};

pub struct CSharpValidator;

impl CSharpValidator {
    pub fn new() -> Self {
        Self
    }

    /// Parse ADO.NET style connection string into key-value pairs
    fn parse_key_value_pairs(&self, conn_str: &str) -> HashMap<String, String> {
        let mut result = HashMap::new();
        
        for part in conn_str.split(';') {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }
            
            if let Some(eq_pos) = part.find('=') {
                let key = part[..eq_pos].trim().to_lowercase();
                let value = part[eq_pos + 1..].trim().to_string();
                result.insert(key, value);
            }
        }
        
        result
    }

    /// Detect database type from connection string
    fn detect_database_type(&self, pairs: &HashMap<String, String>) -> Option<DatabaseType> {
        // Check for provider hints
        if let Some(provider) = pairs.get("provider") {
            let provider_lower = provider.to_lowercase();
            if provider_lower.contains("npgsql") || provider_lower.contains("postgres") {
                return Some(DatabaseType::PostgreSQL);
            }
            if provider_lower.contains("mysql") {
                return Some(DatabaseType::MySQL);
            }
            if provider_lower.contains("sqlclient") || provider_lower.contains("sqlserver") {
                return Some(DatabaseType::MSSQL);
            }
        }

        // Check for database-specific keys
        if pairs.contains_key("ssl mode") || pairs.contains_key("sslmode") {
            // PostgreSQL typically uses ssl mode
            return Some(DatabaseType::PostgreSQL);
        }
        
        if pairs.contains_key("initial catalog") || pairs.contains_key("trustservercertificate") {
            return Some(DatabaseType::MSSQL);
        }

        if pairs.contains_key("sslmode") && pairs.get("port").map_or(false, |p| p == "3306") {
            return Some(DatabaseType::MySQL);
        }

        // Default based on port
        if let Some(port) = pairs.get("port") {
            match port.as_str() {
                "5432" => return Some(DatabaseType::PostgreSQL),
                "3306" => return Some(DatabaseType::MySQL),
                "1433" => return Some(DatabaseType::MSSQL),
                _ => {}
            }
        }

        None
    }
}

impl Default for CSharpValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionStringValidator for CSharpValidator {
    fn info(&self) -> ValidatorInfo {
        ValidatorInfo {
            id: "csharp".to_string(),
            name: "C# / .NET".to_string(),
            description: "ADO.NET connection strings (SqlConnection, NpgsqlConnection, MySqlConnection)".to_string(),
            supported_databases: vec![
                "postgresql".to_string(),
                "mysql".to_string(),
                "mssql".to_string(),
            ],
        }
    }

    fn parse(&self, connection_string: &str) -> Result<ParsedConnection, ValidatorError> {
        if connection_string.trim().is_empty() {
            return Err(ValidatorError::ParseError("Connection string is empty".to_string()));
        }

        let pairs = self.parse_key_value_pairs(connection_string);
        
        if pairs.is_empty() {
            return Err(ValidatorError::InvalidFormat(
                "No valid key=value pairs found".to_string()
            ));
        }

        let mut parsed = ParsedConnection::default();
        parsed.original_format = Some("ado.net".to_string());

        // Extract host (various key names)
        parsed.host = pairs.get("server")
            .or_else(|| pairs.get("host"))
            .or_else(|| pairs.get("data source"))
            .cloned();

        // Extract port
        parsed.port = pairs.get("port")
            .and_then(|p| p.parse().ok());

        // Extract database name
        parsed.database = pairs.get("database")
            .or_else(|| pairs.get("initial catalog"))
            .cloned();

        // Extract username
        parsed.username = pairs.get("user id")
            .or_else(|| pairs.get("uid"))
            .or_else(|| pairs.get("username"))
            .or_else(|| pairs.get("user"))
            .cloned();

        // Extract password
        parsed.password = pairs.get("password")
            .or_else(|| pairs.get("pwd"))
            .cloned();

        // Extract SSL mode
        parsed.ssl_mode = pairs.get("ssl mode")
            .or_else(|| pairs.get("sslmode"))
            .cloned();

        // Detect database type
        parsed.database_type = self.detect_database_type(&pairs);

        // Store remaining options
        let known_keys = [
            "server", "host", "data source", "port", "database", "initial catalog",
            "user id", "uid", "username", "user", "password", "pwd", "ssl mode", "sslmode",
            "provider"
        ];
        
        for (key, value) in pairs {
            if !known_keys.contains(&key.as_str()) {
                parsed.options.insert(key, value);
            }
        }

        Ok(parsed)
    }

    fn validate(&self, connection_string: &str) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Try to parse
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
                    "Connection string must include Server, Host, or Data Source",
                    Some("host"),
                ));
            }

            if p.database.is_none() {
                errors.push(error_message(
                    "MISSING_DATABASE",
                    "Connection string must include Database or Initial Catalog",
                    Some("database"),
                ));
            }

            // Warnings
            if p.username.is_none() {
                warnings.push(warning_message(
                    "MISSING_USER",
                    "No username specified; connection may use Windows Authentication or default credentials",
                    Some("username"),
                ));
            }

            if p.password.is_some() && p.ssl_mode.is_none() {
                warnings.push(warning_message(
                    "NO_SSL",
                    "Password provided without SSL mode; consider enabling SSL for security",
                    Some("ssl_mode"),
                ));
            }

            if p.database_type.is_none() {
                warnings.push(warning_message(
                    "UNKNOWN_DB_TYPE",
                    "Could not determine database type; consider specifying a port or provider",
                    None,
                ));
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
        let mut parts = Vec::new();

        if let Some(ref host) = parsed.host {
            parts.push(format!("Server={}", host));
        }

        if let Some(port) = parsed.port {
            parts.push(format!("Port={}", port));
        }

        if let Some(ref db) = parsed.database {
            parts.push(format!("Database={}", db));
        }

        if let Some(ref user) = parsed.username {
            parts.push(format!("User Id={}", user));
        }

        if let Some(ref pass) = parsed.password {
            parts.push(format!("Password={}", pass));
        }

        if let Some(ref ssl) = parsed.ssl_mode {
            parts.push(format!("SSL Mode={}", ssl));
        }

        for (key, value) in &parsed.options {
            parts.push(format!("{}={}", key, value));
        }

        Ok(parts.join(";"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_basic_connection_string() {
        let validator = CSharpValidator::new();
        let result = validator.parse("Server=localhost;Database=mydb;User Id=user;Password=pass");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.host, Some("localhost".to_string()));
        assert_eq!(parsed.database, Some("mydb".to_string()));
        assert_eq!(parsed.username, Some("user".to_string()));
        assert_eq!(parsed.password, Some("pass".to_string()));
    }

    #[test]
    fn test_validate_missing_host() {
        let validator = CSharpValidator::new();
        let result = validator.validate("Database=mydb;User Id=user");
        
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.code == "MISSING_HOST"));
    }

    #[test]
    fn test_mssql_detection() {
        let validator = CSharpValidator::new();
        let result = validator.parse("Server=localhost;Initial Catalog=mydb;TrustServerCertificate=true");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::MSSQL));
    }
}

