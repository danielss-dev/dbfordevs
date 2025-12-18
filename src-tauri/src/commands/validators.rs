use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use validator_core::{ParsedConnection, ValidationResult, ValidatorInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateRequest {
    pub validator_id: String,
    pub connection_string: String,
}

/// Validate a connection string using the specified validator
#[tauri::command]
pub async fn validate_connection_string(
    request: ValidateRequest,
) -> AppResult<ValidationResult> {
    // TODO: Route to appropriate validator based on validator_id
    let _ = request;
    Ok(ValidationResult {
        valid: true,
        parsed: Some(ParsedConnection::default()),
        errors: vec![],
        warnings: vec![],
    })
}

/// List all available connection string validators
#[tauri::command]
pub async fn list_validators() -> AppResult<Vec<ValidatorInfo>> {
    Ok(vec![
        ValidatorInfo {
            id: "csharp".to_string(),
            name: "C# / .NET".to_string(),
            description: "ADO.NET connection strings".to_string(),
            supported_databases: vec!["postgresql".to_string(), "mysql".to_string(), "mssql".to_string()],
        },
        ValidatorInfo {
            id: "nodejs".to_string(),
            name: "Node.js".to_string(),
            description: "Connection strings for pg, mysql2, mssql packages".to_string(),
            supported_databases: vec!["postgresql".to_string(), "mysql".to_string(), "mssql".to_string()],
        },
        ValidatorInfo {
            id: "python".to_string(),
            name: "Python".to_string(),
            description: "SQLAlchemy connection URLs".to_string(),
            supported_databases: vec!["postgresql".to_string(), "mysql".to_string(), "sqlite".to_string()],
        },
    ])
}

