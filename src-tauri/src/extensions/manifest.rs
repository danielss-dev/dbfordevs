//! Extension Manifest Parser
//!
//! Handles parsing and validation of extension.json manifest files.

use std::path::Path;

use extension_core::{ExtensionError, ExtensionManifest};

use crate::error::{AppError, AppResult};

/// Parser for extension manifest files
pub struct ManifestParser;

impl ManifestParser {
    /// Parse a manifest from a JSON string
    pub fn parse(json: &str) -> Result<ExtensionManifest, ExtensionError> {
        serde_json::from_str(json).map_err(|e| {
            ExtensionError::ManifestError(format!("Failed to parse manifest: {}", e))
        })
    }

    /// Parse a manifest from a file
    pub fn parse_file(path: &Path) -> AppResult<ExtensionManifest> {
        let content = std::fs::read_to_string(path).map_err(|e| {
            AppError::Internal(format!("Failed to read manifest file: {}", e))
        })?;

        Self::parse(&content).map_err(|e| AppError::Internal(e.to_string()))
    }

    /// Validate a manifest
    pub fn validate(manifest: &ExtensionManifest) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Required fields
        if manifest.id.is_empty() {
            errors.push("Extension ID is required".to_string());
        }

        if manifest.version.is_empty() {
            errors.push("Extension version is required".to_string());
        }

        if manifest.display_name.is_empty() {
            errors.push("Extension display name is required".to_string());
        }

        // Validate ID format (alphanumeric with hyphens)
        if !manifest.id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            errors.push("Extension ID must contain only alphanumeric characters, hyphens, and underscores".to_string());
        }

        // Validate semver format
        if !Self::is_valid_semver(&manifest.version) {
            errors.push("Extension version must be valid semver (e.g., 1.0.0)".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Check if a version string is valid semver
    fn is_valid_semver(version: &str) -> bool {
        let parts: Vec<&str> = version.split('.').collect();
        if parts.len() < 2 || parts.len() > 3 {
            return false;
        }

        parts.iter().all(|p| p.parse::<u32>().is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_manifest() {
        let json = r#"{
            "id": "test-extension",
            "version": "1.0.0",
            "displayName": "Test Extension",
            "description": "A test extension",
            "author": {
                "name": "Test Author"
            },
            "categories": ["ai"]
        }"#;

        let result = ManifestParser::parse(json);
        assert!(result.is_ok());

        let manifest = result.unwrap();
        assert_eq!(manifest.id, "test-extension");
        assert_eq!(manifest.version, "1.0.0");
    }

    #[test]
    fn test_validate_manifest() {
        let json = r#"{
            "id": "valid-ext",
            "version": "1.0.0",
            "displayName": "Valid Extension",
            "description": "A valid extension",
            "author": {"name": "Author"},
            "categories": ["ai"]
        }"#;

        let manifest = ManifestParser::parse(json).unwrap();
        assert!(ManifestParser::validate(&manifest).is_ok());
    }

    #[test]
    fn test_validate_invalid_id() {
        let json = r#"{
            "id": "invalid id with spaces",
            "version": "1.0.0",
            "displayName": "Invalid Extension",
            "description": "An invalid extension",
            "author": {"name": "Author"},
            "categories": ["ai"]
        }"#;

        let manifest = ManifestParser::parse(json).unwrap();
        let result = ManifestParser::validate(&manifest);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_valid_semver() {
        assert!(ManifestParser::is_valid_semver("1.0.0"));
        assert!(ManifestParser::is_valid_semver("2.1"));
        assert!(ManifestParser::is_valid_semver("0.0.1"));
        assert!(!ManifestParser::is_valid_semver("not-a-version"));
        assert!(!ManifestParser::is_valid_semver("1.0.0.0"));
    }
}

