use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub connection_id: String,
    pub sql: String,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub affected_rows: Option<u64>,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub name: String,
    pub schema: Option<String>,
    pub table_type: String,
    pub row_count: Option<i64>,
}

/// Information about a database (used for MSSQL to show all databases like SSMS)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    pub name: String,
    pub state: String,          // ONLINE, OFFLINE, etc.
    pub recovery_model: String, // SIMPLE, FULL, BULK_LOGGED
    pub compatibility_level: i32,
    pub is_current: bool,       // Is this the currently connected database?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchema {
    pub table_name: String,
    pub columns: Vec<ColumnInfo>,
    pub primary_keys: Vec<String>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyInfo {
    pub column: String,
    pub references_table: String,
    pub references_column: String,
}

// Extended types for table properties view

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintInfo {
    pub name: String,
    pub constraint_type: String, // CHECK, UNIQUE, EXCLUSION
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtendedColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub is_primary_key: bool,
    pub default_value: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableProperties {
    pub table_name: String,
    pub schema: Option<String>,
    pub columns: Vec<ExtendedColumnInfo>,
    pub primary_keys: Vec<String>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
    pub indexes: Vec<IndexInfo>,
    pub constraints: Vec<ConstraintInfo>,
    pub row_count: Option<i64>,
    pub table_comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableRelationship {
    pub source_table: String,
    pub source_column: String,
    pub target_table: String,
    pub target_column: String,
    pub constraint_name: Option<String>,
}

// Preview query types

/// Type of SQL statement for preview purposes
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StatementType {
    Ddl,
    Dml,
    Select,
    Other,
}

/// Preview result for a single statement
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatementPreview {
    pub statement_type: StatementType,
    pub sql: String,
    /// For DDL: schema before the change
    pub schema_before: Option<String>,
    /// For DDL: schema after the change (within transaction)
    pub schema_after: Option<String>,
    /// For DML: affected rows data
    pub affected_rows: Option<Vec<Vec<serde_json::Value>>>,
    /// Column info for affected rows
    pub affected_columns: Option<Vec<ColumnInfo>>,
    /// Number of rows that would be affected
    pub row_count: u64,
    /// Table name affected (for context)
    pub table_name: Option<String>,
}

/// Complete preview result for a query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResult {
    pub statements: Vec<StatementPreview>,
    pub execution_time_ms: u64,
    /// Whether preview was successful
    pub success: bool,
    /// Error message if preview failed
    pub error: Option<String>,
    /// Warning message if preview was successful but has limitations
    pub warning: Option<String>,
}

/// Request for preview query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRequest {
    pub connection_id: String,
    pub sql: String,
}

// Execution Plan types

/// Request for EXPLAIN query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainRequest {
    pub connection_id: String,
    pub sql: String,
    pub analyze: bool,
}

/// A node in the execution plan tree
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanNode {
    pub node_type: String,
    pub relation_name: Option<String>,
    pub alias: Option<String>,
    pub startup_cost: Option<f64>,
    pub total_cost: Option<f64>,
    pub plan_rows: Option<u64>,
    pub plan_width: Option<u32>,
    pub actual_startup_time: Option<f64>,
    pub actual_total_time: Option<f64>,
    pub actual_rows: Option<u64>,
    pub actual_loops: Option<u64>,
    pub index_name: Option<String>,
    pub index_cond: Option<String>,
    pub filter: Option<String>,
    pub rows_removed_by_filter: Option<u64>,
    pub sort_key: Option<Vec<String>>,
    pub sort_method: Option<String>,
    pub join_type: Option<String>,
    pub hash_cond: Option<String>,
    pub buffers_shared_hit: Option<u64>,
    pub buffers_shared_read: Option<u64>,
    pub children: Vec<PlanNode>,
    pub warnings: Vec<String>,
    pub extra_info: std::collections::HashMap<String, serde_json::Value>,
}

/// Warning severity level
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WarningSeverity {
    Info,
    Warning,
    Critical,
}

/// Warning/suggestion from plan analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainWarning {
    pub severity: WarningSeverity,
    pub message: String,
    pub node_type: Option<String>,
    pub suggestion: Option<String>,
}

/// Result of an EXPLAIN query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResult {
    pub plan: PlanNode,
    pub planning_time: Option<f64>,
    pub execution_time: Option<f64>,
    pub total_cost: f64,
    pub warnings: Vec<ExplainWarning>,
    pub raw_output: String,
    pub database_type: String,
}

