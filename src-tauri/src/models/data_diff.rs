use serde::{Deserialize, Serialize};

/// Options for data comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataCompareOptions {
    /// Columns to use as the unique key for row matching
    pub key_columns: Vec<String>,
    /// Whether to ignore case when comparing string values
    pub ignore_case: bool,
    /// Whether to ignore leading/trailing whitespace
    pub ignore_whitespace: bool,
    /// Tolerance for numeric comparisons (e.g., 0.001)
    pub numeric_tolerance: Option<f64>,
    /// Whether to treat NULL and empty string as equal
    pub null_equals_empty: bool,
    /// Maximum number of rows to compare
    pub max_rows: u32,
}

/// Status of a row in the diff
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RowDiffStatus {
    Matched,
    Added,
    Removed,
    Modified,
}

/// Diff for a single cell
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellDiff {
    pub column_name: String,
    pub source_value: serde_json::Value,
    pub target_value: serde_json::Value,
}

/// Diff result for a single row
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowDiff {
    pub status: RowDiffStatus,
    pub row_index: usize,
    pub key_values: serde_json::Map<String, serde_json::Value>,
    pub source_row: Option<Vec<serde_json::Value>>,
    pub target_row: Option<Vec<serde_json::Value>>,
    pub cell_diffs: Vec<CellDiff>,
}

/// Summary statistics for the comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDiffSummary {
    pub total_source_rows: usize,
    pub total_target_rows: usize,
    pub matched_rows: usize,
    pub added_rows: usize,
    pub removed_rows: usize,
    pub modified_rows: usize,
    pub comparison_time_ms: u64,
}

/// Complete data comparison result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataCompareResult {
    pub source_label: String,
    pub target_label: String,
    pub columns: Vec<super::ColumnInfo>,
    pub key_columns: Vec<String>,
    pub rows: Vec<RowDiff>,
    pub summary: DataDiffSummary,
    pub warnings: Vec<String>,
    pub truncated: bool,
}

/// Request to compare data between two tables
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataCompareTableRequest {
    pub source_connection_id: String,
    pub source_table_name: String,
    pub target_connection_id: String,
    pub target_table_name: String,
    pub options: DataCompareOptions,
}

/// Request to compare data from two queries
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataCompareQueryRequest {
    pub source_connection_id: String,
    pub source_sql: String,
    pub target_connection_id: String,
    pub target_sql: String,
    pub options: DataCompareOptions,
}
