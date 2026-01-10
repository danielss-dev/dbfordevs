// Re-export import types
export * from "./import";

// Database types
export type DatabaseType =
  | "postgresql"
  | "mysql"
  | "mariadb"
  | "sqlite"
  | "mssql"
  | "oracle"
  | "mongodb"
  | "redis"
  | "cockroachdb"
  | "cassandra";

// SSL Configuration
export type SslMode = 'disable' | 'require' | 'prefer' | 'verify-ca' | 'verify-full';

export interface SslConfig {
  mode: SslMode;
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
}

// SSH Tunnel Configuration
export type SshAuthMethod = 'password' | 'privateKey';

export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

export interface ConnectionConfig {
  id?: string;
  name: string;
  databaseType: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  /** @deprecated Use `ssl.mode` instead */
  sslMode?: string;
  filePath?: string;
  // Advanced connection options
  connectionString?: string;
  useConnectionString?: boolean;
  /** SSL configuration - preferred over legacy sslMode */
  ssl?: SslConfig;
  sshTunnel?: SshTunnelConfig;
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
  rows: any[][];
  affectedRows?: number;
  executionTimeMs: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface QueryHistoryEntry {
  id: string;
  connectionId: string;
  sql: string;
  executedAt: number;
  executionTimeMs?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
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

// Extended types for table properties view

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface ConstraintInfo {
  name: string;
  constraintType: string; // CHECK, UNIQUE, EXCLUSION
  definition: string;
}

export interface ExtendedColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface TableProperties {
  tableName: string;
  schema?: string;
  columns: ExtendedColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  rowCount?: number;
  tableComment?: string;
}

export interface TableRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  constraintName?: string;
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
  /** Raw SSL mode from connection string - convert to SslConfig.mode for use */
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
  type: "query" | "table" | "schema" | "properties" | "diagram";
  connectionId: string;
  content?: string;
  tableName?: string; // Full table identifier for "table", "properties", and "diagram" types
}

export interface PendingChange {
  id: string;
  tableName: string;
  type: "insert" | "update" | "delete";
  originalData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  primaryKey: Record<string, unknown>;
}

// Preview query types
export type StatementType = "ddl" | "dml" | "select" | "other";

export interface StatementPreview {
  statementType: StatementType;
  sql: string;
  schemaBefore?: string;
  schemaAfter?: string;
  affectedRows?: unknown[][];
  affectedColumns?: ColumnInfo[];
  rowCount: number;
  tableName?: string;
}

export interface PreviewResult {
  statements: StatementPreview[];
  executionTimeMs: number;
  success: boolean;
  error?: string;
  warning?: string;
}

export interface PreviewRequest {
  connectionId: string;
  sql: string;
}

