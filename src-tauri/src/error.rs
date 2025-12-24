use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database connection error: {0}")]
    ConnectionError(String),

    #[error("Query execution error: {0}")]
    QueryError(String),

    #[allow(dead_code)]
    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerdeError(#[from] serde_json::Error),

    #[error("Error: {0}")]
    GenericError(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Extension error: {0}")]
    ExtensionError(String),
}

// Implement serialize for Tauri command returns
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;

