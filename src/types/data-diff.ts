import type { ColumnInfo } from "./index";

// Options for data comparison
export interface DataCompareOptions {
  keyColumns: string[];
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
  numericTolerance: number | null;
  nullEqualsEmpty: boolean;
  maxRows: number;
}

// Status of a row in the diff
export type RowDiffStatus = "matched" | "added" | "removed" | "modified";

// Diff for a single cell
export interface CellDiff {
  columnName: string;
  sourceValue: unknown;
  targetValue: unknown;
}

// Diff result for a single row
export interface RowDiff {
  status: RowDiffStatus;
  rowIndex: number;
  keyValues: Record<string, unknown>;
  sourceRow: unknown[] | null;
  targetRow: unknown[] | null;
  cellDiffs: CellDiff[];
}

// Summary statistics
export interface DataDiffSummary {
  totalSourceRows: number;
  totalTargetRows: number;
  matchedRows: number;
  addedRows: number;
  removedRows: number;
  modifiedRows: number;
  comparisonTimeMs: number;
}

// Complete data comparison result
export interface DataCompareResult {
  sourceLabel: string;
  targetLabel: string;
  columns: ColumnInfo[];
  keyColumns: string[];
  rows: RowDiff[];
  summary: DataDiffSummary;
  warnings: string[];
  truncated: boolean;
}

// Request to compare table data
export interface DataCompareTableRequest {
  sourceConnectionId: string;
  sourceTableName: string;
  targetConnectionId: string;
  targetTableName: string;
  options: DataCompareOptions;
}

// Request to compare query data
export interface DataCompareQueryRequest {
  sourceConnectionId: string;
  sourceSql: string;
  targetConnectionId: string;
  targetSql: string;
  options: DataCompareOptions;
}

// Frontend-only types
export type DiffFilterMode =
  | "all"
  | "differences"
  | "matched"
  | "added"
  | "removed"
  | "modified";

export type DataSourceType = "table" | "query";
