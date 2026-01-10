// Import types

export type ImportFormat = "csv" | "json" | "sql";

export type DuplicateHandling = "skip" | "replace" | "fail";

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  dataType?: string;
}

export interface ImportPreviewRequest {
  connectionId: string;
  format: ImportFormat;
  content: string;
  delimiter?: string;
  hasHeader?: boolean;
  previewRows?: number;
}

export interface ImportPreviewResult {
  sourceColumns: string[];
  detectedTypes: string[];
  sampleRows: unknown[][];
  totalRowsDetected?: number;
  delimiterDetected?: string;
}

export interface ImportRequest {
  connectionId: string;
  tableName: string;
  format: ImportFormat;
  content: string;
  columnMappings: ColumnMapping[];
  duplicateHandling: DuplicateHandling;
  batchSize?: number;
  delimiter?: string;
  hasHeader?: boolean;
  useTransaction: boolean;
  stopOnError: boolean;
}

export interface ImportProgress {
  importId: string;
  rowsProcessed: number;
  rowsTotal?: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  rowsFailed: number;
  currentBatch: number;
  totalBatches?: number;
  percentComplete?: number;
  status: ImportStatus;
  currentError?: string;
}

export type ImportStatus =
  | "preparing"
  | "processing"
  | "committing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ImportResult {
  success: boolean;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  rowsFailed: number;
  errors: ImportRowError[];
  executionTimeMs: number;
  message: string;
}

export interface ImportRowError {
  rowNumber: number;
  errorMessage: string;
  rowData?: unknown[];
}
