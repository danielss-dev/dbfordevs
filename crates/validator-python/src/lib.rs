//! Python SQLAlchemy Connection String Validator
//!
//! This validator handles SQLAlchemy database URLs used in Python applications.
//!
//! # Format
//! SQLAlchemy uses RFC-1738 style URLs:
//! ```text
//! dialect+driver://username:password@host:port/database
//! ```
//!
//! # Examples
//! ```text
//! postgresql://user:pass@localhost/mydb
//! postgresql+psycopg2://user:pass@localhost/mydb
//! mysql+pymysql://user:pass@localhost/mydb
//! sqlite:///./mydb.sqlite
//! ```

use url::Url;
use validator_core::{
    ConnectionStringValidator, DatabaseType, ParsedConnection,
    ValidationResult, ValidatorError, ValidatorInfo, error_message, warning_message,
};

pub struct PythonValidator;

impl PythonValidator {
    pub fn new() -> Self {
        Self
    }

    /// Parse SQLAlchemy dialect+driver scheme
    fn parse_scheme(&self, scheme: &str) -> (Option<DatabaseType>, Option<String>) {
        let parts: Vec<&str> = scheme.split('+').collect();
        let dialect = parts[0];
        let driver = parts.get(1).map(|s| s.to_string());

        let db_type = match dialect {
            "postgresql" | "postgres" => Some(DatabaseType::PostgreSQL),
            "mysql" | "mariadb" => Some(DatabaseType::MySQL),
            "mssql" | "sqlserver" => Some(DatabaseType::MSSQL),
            "sqlite" => Some(DatabaseType::SQLite),
            "oracle" => Some(DatabaseType::Oracle),
            _ => None,
        };

        (db_type, driver)
    }

    /// Check if this is a SQLite file path URL
    fn is_sqlite_path(&self, conn_str: &str) -> bool {
        conn_str.starts_with("sqlite:///") || conn_str.starts_with("sqlite://")
    }

    /// Parse SQLite connection string
    fn parse_sqlite(&self, conn_str: &str) -> Result<ParsedConnection, ValidatorError> {
        let mut parsed = ParsedConnection::default();
        parsed.database_type = Some(DatabaseType::SQLite);
        parsed.original_format = Some("sqlalchemy".to_string());

        // Extract the file path
        let path = if conn_str.starts_with("sqlite:///") {
            &conn_str[10..] // Remove "sqlite:///"
        } else if conn_str.starts_with("sqlite://") {
            &conn_str[9..] // Remove "sqlite://"
        } else {
            return Err(ValidatorError::InvalidFormat("Invalid SQLite URL".to_string()));
        };

        // Handle query parameters
        if let Some(query_start) = path.find('?') {
            parsed.database = Some(path[..query_start].to_string());
            let query = &path[query_start + 1..];
            for param in query.split('&') {
                if let Some(eq_pos) = param.find('=') {
                    let key = &param[..eq_pos];
                    let value = &param[eq_pos + 1..];
                    parsed.options.insert(key.to_string(), value.to_string());
                }
            }
        } else {
            parsed.database = Some(path.to_string());
        }

        // Special case for in-memory database
        if parsed.database.as_deref() == Some(":memory:") || parsed.database.as_deref() == Some("") {
            parsed.options.insert("mode".to_string(), "memory".to_string());
        }

        Ok(parsed)
    }
}

impl Default for PythonValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionStringValidator for PythonValidator {
    fn info(&self) -> ValidatorInfo {
        ValidatorInfo {
            id: "python".to_string(),
            name: "Python".to_string(),
            description: "SQLAlchemy connection URLs, psycopg2, PyMySQL".to_string(),
            supported_databases: vec![
                "postgresql".to_string(),
                "mysql".to_string(),
                "sqlite".to_string(),
                "mssql".to_string(),
            ],
        }
    }

    fn parse(&self, connection_string: &str) -> Result<ParsedConnection, ValidatorError> {
        if connection_string.trim().is_empty() {
            return Err(ValidatorError::ParseError("Connection string is empty".to_string()));
        }

        // Handle SQLite specially
        if self.is_sqlite_path(connection_string) {
            return self.parse_sqlite(connection_string);
        }

        // Parse as URL
        let url = Url::parse(connection_string)
            .map_err(|e| ValidatorError::ParseError(format!("Invalid URL: {}", e)))?;

        let mut parsed = ParsedConnection::default();
        parsed.original_format = Some("sqlalchemy".to_string());

        // Parse dialect and driver from scheme
        let (db_type, driver) = self.parse_scheme(url.scheme());
        parsed.database_type = db_type;
        
        if let Some(drv) = driver {
            parsed.options.insert("driver".to_string(), drv);
        }

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

        // Parse query parameters
        for (key, value) in url.query_pairs() {
            if key == "sslmode" || key == "ssl_mode" {
                parsed.ssl_mode = Some(value.to_string());
            } else {
                parsed.options.insert(key.to_string(), value.to_string());
            }
        }

        Ok(parsed)
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
            // SQLite has different requirements
            let is_sqlite = p.database_type == Some(DatabaseType::SQLite);

            if !is_sqlite {
                // Validate required fields for network databases
                if p.host.is_none() {
                    errors.push(error_message(
                        "MISSING_HOST",
                        "Connection string must include a host",
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

                // Warnings for non-SQLite databases
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
                        "Password provided without sslmode; consider adding ?sslmode=require",
                        Some("ssl_mode"),
                    ));
                }
            } else {
                // SQLite validation
                if p.database.is_none() || p.database.as_deref() == Some("") {
                    warnings.push(warning_message(
                        "MEMORY_DB",
                        "No database path specified; this will create an in-memory database",
                        Some("database"),
                    ));
                }
            }

            // Check for deprecated drivers
            if let Some(driver) = p.options.get("driver") {
                if driver == "psycopg2" {
                    warnings.push(warning_message(
                        "DEPRECATED_DRIVER",
                        "psycopg2 is deprecated; consider using psycopg (psycopg3)",
                        Some("driver"),
                    ));
                }
            }

            if p.database_type.is_none() {
                errors.push(error_message(
                    "UNKNOWN_DIALECT",
                    "Could not determine database type from dialect",
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
            DatabaseType::PostgreSQL | DatabaseType::MySQL | DatabaseType::SQLite | DatabaseType::MSSQL
        )
    }

    fn to_connection_string(&self, parsed: &ParsedConnection) -> Result<String, ValidatorError> {
        // Handle SQLite specially
        if parsed.database_type == Some(DatabaseType::SQLite) {
            let db = parsed.database.as_deref().unwrap_or(":memory:");
            return Ok(format!("sqlite:///{}", db));
        }

        let dialect = match parsed.database_type {
            Some(DatabaseType::PostgreSQL) => "postgresql",
            Some(DatabaseType::MySQL) => "mysql",
            Some(DatabaseType::MSSQL) => "mssql",
            _ => "postgresql",
        };

        let driver = parsed.options.get("driver");
        let scheme = if let Some(drv) = driver {
            format!("{}+{}", dialect, drv)
        } else {
            dialect.to_string()
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
            if key != "driver" {
                query_parts.push(format!("{}={}", key, value));
            }
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
        let validator = PythonValidator::new();
        let result = validator.parse("postgresql://user:pass@localhost:5432/mydb");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::PostgreSQL));
        assert_eq!(parsed.host, Some("localhost".to_string()));
        assert_eq!(parsed.port, Some(5432));
        assert_eq!(parsed.database, Some("mydb".to_string()));
    }

    #[test]
    fn test_parse_postgresql_with_driver() {
        let validator = PythonValidator::new();
        let result = validator.parse("postgresql+psycopg2://user:pass@localhost/mydb");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::PostgreSQL));
        assert_eq!(parsed.options.get("driver"), Some(&"psycopg2".to_string()));
    }

    #[test]
    fn test_parse_sqlite() {
        let validator = PythonValidator::new();
        let result = validator.parse("sqlite:///./mydb.sqlite");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::SQLite));
        assert_eq!(parsed.database, Some("./mydb.sqlite".to_string()));
    }

    #[test]
    fn test_parse_sqlite_memory() {
        let validator = PythonValidator::new();
        let result = validator.parse("sqlite:///:memory:");
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::SQLite));
    }

    #[test]
    fn test_validate_mysql() {
        let validator = PythonValidator::new();
        let result = validator.validate("mysql+pymysql://root:pass@localhost:3306/testdb");
        
        assert!(result.valid);
        let parsed = result.parsed.unwrap();
        assert_eq!(parsed.database_type, Some(DatabaseType::MySQL));
    }
}

