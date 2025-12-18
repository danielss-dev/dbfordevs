// Database types
export type DatabaseType = "postgresql" | "mysql" | "sqlite" | "mssql";

export interface ConnectionConfig {
  id?: string;
  name: string;
  databaseType: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  sslMode?: string;
  filePath?: string;
}

export interface ConnectionInfo {
  id: string;
  name: string;
  databaseType: DatabaseType;
  host?: string;
  database: string;
  connected: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  serverVersion?: string;
}

// Query types
export interface QueryRequest {
  connectionId: string;
  sql: string;
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  affectedRows?: number;
  executionTimeMs: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface TableInfo {
  name: string;
  schema?: string;
  tableType: string;
  rowCount?: number;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
}

export interface ForeignKeyInfo {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

// Validator types
export interface ValidatorInfo {
  id: string;
  name: string;
  description: string;
  supportedDatabases: string[];
}

export interface ValidationMessage {
  code: string;
  message: string;
  field?: string;
}

export interface ParsedConnection {
  databaseType?: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  sslMode?: string;
  options: Record<string, string>;
  originalFormat?: string;
}

export interface ValidationResult {
  valid: boolean;
  parsed?: ParsedConnection;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

// UI types
export interface Tab {
  id: string;
  title: string;
  type: "query" | "table" | "schema";
  connectionId: string;
  content?: string;
}

export interface PendingChange {
  id: string;
  tableName: string;
  type: "insert" | "update" | "delete";
  originalData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  primaryKey: Record<string, unknown>;
}

