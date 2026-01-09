use serde::{Deserialize, Serialize};

/// File format for import
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportFormat {
    Csv,
    Json,
    Sql,
}

/// Duplicate handling strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DuplicateHandling {
    Skip,    // Skip rows with duplicate keys
    Replace, // UPDATE existing rows (upsert)
    Fail,    // Fail entire import on duplicate
}

/// Column mapping from source to target
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnMapping {
    pub source_column: String,
    pub target_column: String,
    pub data_type: Option<String>,
}

/// Request to preview import data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewRequest {
    pub connection_id: String,
    pub format: ImportFormat,
    pub content: String,
    pub delimiter: Option<char>,
    pub has_header: Option<bool>,
    pub preview_rows: Option<usize>,
}

/// Preview result showing detected columns and sample data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewResult {
    pub source_columns: Vec<String>,
    pub detected_types: Vec<String>,
    pub sample_rows: Vec<Vec<serde_json::Value>>,
    pub total_rows_detected: Option<usize>,
    pub delimiter_detected: Option<char>,
}

/// Main import request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    pub connection_id: String,
    pub table_name: String,
    pub format: ImportFormat,
    pub content: String,
    pub column_mappings: Vec<ColumnMapping>,
    pub duplicate_handling: DuplicateHandling,
    pub batch_size: Option<usize>,
    pub delimiter: Option<char>,
    pub has_header: Option<bool>,
    pub use_transaction: bool,
    pub stop_on_error: bool,
}

/// Progress event payload (emitted to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub import_id: String,
    pub rows_processed: usize,
    pub rows_total: Option<usize>,
    pub rows_inserted: usize,
    pub rows_updated: usize,
    pub rows_skipped: usize,
    pub rows_failed: usize,
    pub current_batch: usize,
    pub total_batches: Option<usize>,
    pub percent_complete: Option<f32>,
    pub status: ImportStatus,
    pub current_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportStatus {
    Preparing,
    Processing,
    Committing,
    Completed,
    Failed,
    Cancelled,
}

/// Import result returned when complete
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub rows_inserted: usize,
    pub rows_updated: usize,
    pub rows_skipped: usize,
    pub rows_failed: usize,
    pub errors: Vec<ImportRowError>,
    pub execution_time_ms: u64,
    pub message: String,
}

/// Per-row error detail
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRowError {
    pub row_number: usize,
    pub error_message: String,
    pub row_data: Option<Vec<serde_json::Value>>,
}

/// Batch progress callback data
#[derive(Debug, Clone)]
pub struct BatchProgress {
    pub rows_processed: usize,
    pub rows_inserted: usize,
    pub rows_updated: usize,
    pub rows_skipped: usize,
    pub rows_failed: usize,
    pub current_batch: usize,
    pub current_error: Option<String>,
}

impl Default for BatchProgress {
    fn default() -> Self {
        Self {
            rows_processed: 0,
            rows_inserted: 0,
            rows_updated: 0,
            rows_skipped: 0,
            rows_failed: 0,
            current_batch: 0,
            current_error: None,
        }
    }
}

/// Batch import result from driver
#[derive(Debug, Clone, Default)]
pub struct BatchImportResult {
    pub success: bool,
    pub rows_inserted: usize,
    pub rows_updated: usize,
    pub rows_skipped: usize,
    pub rows_failed: usize,
    pub errors: Vec<ImportRowError>,
}
