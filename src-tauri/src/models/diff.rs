use serde::{Deserialize, Serialize};

use super::{ConstraintInfo, DatabaseType, ExtendedColumnInfo, ForeignKeyInfo, IndexInfo};

/// Change type for schema diff
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffChangeType {
    Added,
    Removed,
    Modified,
}

/// Diff result for a column
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDiff {
    pub name: String,
    pub change_type: DiffChangeType,
    pub source_column: Option<ExtendedColumnInfo>,
    pub target_column: Option<ExtendedColumnInfo>,
    /// Specific changes detected (e.g., "type changed from INT to VARCHAR")
    pub changes: Vec<String>,
}

/// Diff result for an index
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexDiff {
    pub name: String,
    pub change_type: DiffChangeType,
    pub source_index: Option<IndexInfo>,
    pub target_index: Option<IndexInfo>,
    /// Specific changes detected
    pub changes: Vec<String>,
}

/// Diff result for a constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintDiff {
    pub name: String,
    pub change_type: DiffChangeType,
    pub source_constraint: Option<ConstraintInfo>,
    pub target_constraint: Option<ConstraintInfo>,
    /// Specific changes detected
    pub changes: Vec<String>,
}

/// Diff result for a foreign key
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyDiff {
    pub change_type: DiffChangeType,
    pub source_fk: Option<ForeignKeyInfo>,
    pub target_fk: Option<ForeignKeyInfo>,
    /// Specific changes detected
    pub changes: Vec<String>,
}

/// A migration statement with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationStatement {
    /// The SQL statement to execute
    pub sql: String,
    /// Human-readable description of what this statement does
    pub description: String,
    /// Order of execution (0 = first)
    pub order: u32,
    /// Whether this statement could result in data loss
    pub is_destructive: bool,
}

/// Complete schema diff result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDiffResult {
    /// Source table name
    pub source_table: String,
    /// Target table name
    pub target_table: String,
    /// Source schema/database name
    pub source_schema: Option<String>,
    /// Target schema/database name
    pub target_schema: Option<String>,
    /// Column differences
    pub column_diffs: Vec<ColumnDiff>,
    /// Index differences
    pub index_diffs: Vec<IndexDiff>,
    /// Constraint differences
    pub constraint_diffs: Vec<ConstraintDiff>,
    /// Foreign key differences
    pub foreign_key_diffs: Vec<ForeignKeyDiff>,
    /// Whether the schemas are identical
    pub is_identical: bool,
    /// Generated migration SQL statements
    pub migration_sql: Vec<MigrationStatement>,
    /// Warnings about the migration
    pub warnings: Vec<String>,
    /// Whether the migration requires table recreation (mainly for SQLite)
    pub requires_table_recreation: bool,
}

/// Comparison mode for schema diff
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComparisonMode {
    /// Compare tables across two different connections
    Connections,
    /// Compare tables across two schemas on the same connection
    Schemas,
    /// Compare current table against a saved snapshot
    Snapshot,
}

/// Request for comparing two table schemas
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDiffRequest {
    /// Comparison mode
    pub mode: ComparisonMode,
    /// Source connection ID
    pub source_connection_id: String,
    /// Source table name (can include schema prefix)
    pub source_table_name: String,
    /// Target connection ID (same as source for schema comparison)
    pub target_connection_id: String,
    /// Target table name (can include schema prefix)
    pub target_table_name: String,
    /// Generate migration direction: "source_to_target" or "target_to_source"
    pub migration_direction: String,
}

/// Request for comparing with a snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCompareRequest {
    /// Connection ID for the current table
    pub connection_id: String,
    /// Table name to compare
    pub table_name: String,
    /// Snapshot ID to compare against
    pub snapshot_id: String,
}

/// A saved schema snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaSnapshot {
    /// Unique identifier
    pub id: String,
    /// User-friendly name for the snapshot
    pub name: String,
    /// Optional description
    pub description: Option<String>,
    /// Table name this snapshot is for
    pub table_name: String,
    /// Schema name
    pub schema_name: Option<String>,
    /// Connection ID this was taken from
    pub connection_id: String,
    /// Database type
    pub database_type: DatabaseType,
    /// Columns at snapshot time
    pub columns: Vec<ExtendedColumnInfo>,
    /// Primary keys at snapshot time
    pub primary_keys: Vec<String>,
    /// Foreign keys at snapshot time
    pub foreign_keys: Vec<ForeignKeyInfo>,
    /// Indexes at snapshot time
    pub indexes: Vec<IndexInfo>,
    /// Constraints at snapshot time
    pub constraints: Vec<ConstraintInfo>,
    /// Timestamp when the snapshot was created
    pub created_at: String,
}

/// Request for creating a schema snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnapshotRequest {
    /// Connection ID
    pub connection_id: String,
    /// Table name
    pub table_name: String,
    /// User-friendly name for the snapshot
    pub snapshot_name: String,
    /// Optional description
    pub description: Option<String>,
}
