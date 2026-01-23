import type {
  ConstraintInfo,
  DatabaseType,
  ExtendedColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
} from "./index";

// Change type for schema diff
export type DiffChangeType = "added" | "removed" | "modified";

// Diff result for a column
export interface ColumnDiff {
  name: string;
  changeType: DiffChangeType;
  sourceColumn?: ExtendedColumnInfo;
  targetColumn?: ExtendedColumnInfo;
  changes: string[];
}

// Diff result for an index
export interface IndexDiff {
  name: string;
  changeType: DiffChangeType;
  sourceIndex?: IndexInfo;
  targetIndex?: IndexInfo;
  changes: string[];
}

// Diff result for a constraint
export interface ConstraintDiff {
  name: string;
  changeType: DiffChangeType;
  sourceConstraint?: ConstraintInfo;
  targetConstraint?: ConstraintInfo;
  changes: string[];
}

// Diff result for a foreign key
export interface ForeignKeyDiff {
  changeType: DiffChangeType;
  sourceFk?: ForeignKeyInfo;
  targetFk?: ForeignKeyInfo;
  changes: string[];
}

// A migration statement with metadata
export interface MigrationStatement {
  sql: string;
  description: string;
  order: number;
  isDestructive: boolean;
}

// Complete schema diff result
export interface SchemaDiffResult {
  sourceTable: string;
  targetTable: string;
  sourceSchema?: string;
  targetSchema?: string;
  columnDiffs: ColumnDiff[];
  indexDiffs: IndexDiff[];
  constraintDiffs: ConstraintDiff[];
  foreignKeyDiffs: ForeignKeyDiff[];
  isIdentical: boolean;
  migrationSql: MigrationStatement[];
  warnings: string[];
  requiresTableRecreation: boolean;
}

// Comparison mode for schema diff
export type ComparisonMode = "connections" | "schemas" | "snapshot";

// Request for comparing two table schemas
export interface SchemaDiffRequest {
  mode: ComparisonMode;
  sourceConnectionId: string;
  sourceTableName: string;
  targetConnectionId: string;
  targetTableName: string;
  migrationDirection: "source_to_target" | "target_to_source";
}

// Request for comparing with a snapshot
export interface SnapshotCompareRequest {
  connectionId: string;
  tableName: string;
  snapshotId: string;
}

// A saved schema snapshot
export interface SchemaSnapshot {
  id: string;
  name: string;
  description?: string;
  tableName: string;
  schemaName?: string;
  connectionId: string;
  databaseType: DatabaseType;
  columns: ExtendedColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  createdAt: string;
}

// Request for creating a schema snapshot
export interface CreateSnapshotRequest {
  connectionId: string;
  tableName: string;
  snapshotName: string;
  description?: string;
}
