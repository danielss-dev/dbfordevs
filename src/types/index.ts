// Re-export import types
export * from "./import";

// Re-export grid types
export * from "./grid";

// Re-export Redis types
export * from "./redis";

// Re-export MongoDB types
export * from "./mongodb";

// Re-export Cassandra types
export * from "./cassandra";

// Re-export theme types
export * from "./theme";

// Re-export schema search types
export * from "./schema-search";

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
  groupId?: string | null;   // Reference to ConnectionGroup
  tagIds?: string[];         // Array of ConnectionTag IDs
}

// Connection Group for organizing connections by environment
export interface ConnectionGroup {
  id: string;
  name: string;
  color: string;           // Hex color (e.g., "#EF4444")
  description?: string;
  sortOrder: number;
  isCollapsed: boolean;
  createdAt: number;
  updatedAt: number;
}

// Connection Tag for labeling connections
export interface ConnectionTag {
  id: string;
  name: string;
  color: string;           // Hex color for badge display
  createdAt: number;
}

// Predefined environment presets for quick group creation
export type EnvironmentType = 'development' | 'staging' | 'production' | 'testing' | 'custom';

export const ENVIRONMENT_PRESETS: Record<EnvironmentType, { name: string; color: string }> = {
  development: { name: 'Development', color: '#22C55E' },
  staging: { name: 'Staging', color: '#F59E0B' },
  production: { name: 'Production', color: '#EF4444' },
  testing: { name: 'Testing', color: '#8B5CF6' },
  custom: { name: 'Custom', color: '#6B7280' },
};

export interface TestConnectionResult {
  success: boolean;
  message: string;
  serverVersion?: string;
}

// SSL Test Types
export interface CertificateInfo {
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validUntil?: string;
  serialNumber?: string;
}

export interface SslTestResult {
  success: boolean;
  message: string;
  sslEnabled: boolean;
  sslMode?: string;
  protocolVersion?: string;
  cipherSuite?: string;
  certificateInfo?: CertificateInfo;
  serverVersion?: string;
  supportsSsl: boolean;
  databaseType: string;
}

export interface SslSupportInfo {
  databaseType: string;
  supportsSsl: boolean;
  supportsCaCert: boolean;
  supportsClientCert: boolean;
  notes: string;
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
  isFavorite?: boolean;
}

export interface QueryHistorySettings {
  maxHistoryItems: number;
  maxDaysOld: number;
  autoCleanupEnabled: boolean;
}

export interface QueryHistoryFilters {
  searchQuery: string;
  dateRange: { start: number | null; end: number | null };
  successFilter: 'all' | 'success' | 'failed';
  executionTimeRange: { min: number | null; max: number | null };
  showFavoritesOnly: boolean;
}

export interface QueryHistoryStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  favoriteCount: number;
}

export interface TableInfo {
  name: string;
  schema?: string;
  tableType: string;
  rowCount?: number;
}

/** Information about a database (used for MSSQL to show all databases like SSMS) */
export interface DatabaseInfo {
  name: string;
  state: string;           // ONLINE, OFFLINE, etc.
  recoveryModel: string;   // SIMPLE, FULL, BULK_LOGGED
  compatibilityLevel: number;
  isCurrent: boolean;      // Is this the currently connected database?
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
  type: "query" | "table" | "schema" | "properties" | "diagram" | "redis-key" | "redis-cli" | "redis-pubsub" | "redis-info" | "redis-browser" | "mongodb-browser" | "mongodb-document" | "mongodb-aggregation" | "mongodb-shell" | "mongodb-info" | "cassandra-browser" | "cassandra-shell" | "cassandra-info";
  connectionId: string;
  content?: string;
  tableName?: string; // Full table identifier for "table", "properties", and "diagram" types
  redisKey?: string; // Redis key name for "redis-key" type
  mongoDatabase?: string; // MongoDB database name for mongo tabs
  mongoCollection?: string; // MongoDB collection name for mongo tabs
  mongoDocumentId?: string; // MongoDB document ID for document view
  cassandraKeyspace?: string; // Cassandra keyspace name for cassandra tabs
  cassandraTable?: string; // Cassandra table name for cassandra tabs
  isPinned?: boolean; // Pinned tabs appear first and cannot be accidentally closed
}

export interface PendingChange {
  id: string;
  tableName: string;
  type: "insert" | "update" | "delete";
  originalData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  primaryKey: Record<string, unknown>;
}

// Table Creation types

export type ForeignKeyAction = 'CASCADE' | 'SET_NULL' | 'SET_DEFAULT' | 'RESTRICT' | 'NO_ACTION';

export interface NewColumnDefinition {
  id: string;
  name: string;
  dataType: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isUnique: boolean;
  comment?: string;
}

export interface NewForeignKeyDefinition {
  id: string;
  name?: string;
  columns: string[];
  referencesTable: string;
  referencesColumns: string[];
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface NewCheckConstraintDefinition {
  id: string;
  name?: string;
  expression: string;
}

export interface NewIndexDefinition {
  id: string;
  name?: string;
  columns: string[];
  isUnique: boolean;
}

export interface NewTableDefinition {
  name: string;
  schema?: string;
  columns: NewColumnDefinition[];
  primaryKeyColumns: string[];
  foreignKeys: NewForeignKeyDefinition[];
  checkConstraints: NewCheckConstraintDefinition[];
  indexes: NewIndexDefinition[];
  comment?: string;
}

export interface TableReferenceInfo {
  tableName: string;
  schema?: string;
  primaryKeyColumns: ColumnInfo[];
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

// Execution Plan types

export interface ExplainRequest {
  connectionId: string;
  sql: string;
  analyze: boolean;
}

export interface PlanNode {
  nodeType: string;
  relationName?: string;
  alias?: string;
  startupCost?: number;
  totalCost?: number;
  planRows?: number;
  planWidth?: number;
  actualStartupTime?: number;
  actualTotalTime?: number;
  actualRows?: number;
  actualLoops?: number;
  indexName?: string;
  indexCond?: string;
  filter?: string;
  rowsRemovedByFilter?: number;
  sortKey?: string[];
  sortMethod?: string;
  joinType?: string;
  hashCond?: string;
  buffersSharedHit?: number;
  buffersSharedRead?: number;
  children: PlanNode[];
  warnings: string[];
  extraInfo: Record<string, unknown>;
}

export interface ExplainWarning {
  severity: "info" | "warning" | "critical";
  message: string;
  nodeType?: string;
  suggestion?: string;
}

export interface ExplainResult {
  plan: PlanNode;
  planningTime?: number;
  executionTime?: number;
  totalCost: number;
  warnings: ExplainWarning[];
  rawOutput: string;
  databaseType: string;
}

// Query Bookmark types

export interface TemplateVariable {
  name: string;
  placeholder: string;
  defaultValue?: string;
}

export interface Bookmark {
  id: string;
  name: string;
  description?: string;
  sql: string;
  folderId: string | null;
  connectionId: string | null;
  databaseType?: DatabaseType;
  isFavorite: boolean;
  isTemplate: boolean;
  variables?: TemplateVariable[];
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

// Oracle client setup types

export interface OracleClientStatus {
  isInstalled: boolean;
  installPath?: string;
  version?: string;
  errorMessage?: string;
}

export interface OracleDownloadInfo {
  url: string;
  filename: string;
  size: string;
  installPath: string;
}

export interface OracleDownloadProgress {
  stage: "downloading" | "extracting" | "complete" | "error";
  progress: number;
  message: string;
}

// User management types

export interface DatabaseUser {
  name: string;
  host?: string;
  isSuperuser: boolean;
  canLogin: boolean;
  roles: string[];
}

export interface DatabaseRole {
  name: string;
  isSystemRole: boolean;
  members: string[];
}

export interface DatabasePermission {
  privilege: string;
  grantee: string;
  isGrantable: boolean;
}

export interface AvailablePrivileges {
  databasePrivileges: string[];
}

export interface CreateUserRequest {
  username: string;
  password: string;
  host?: string;
}

export interface ChangePasswordRequest {
  username: string;
  host?: string;
  newPassword: string;
}

export interface CreateRoleRequest {
  roleName: string;
}

export interface PermissionRequest {
  grantee: string;
  host?: string;
  privilege: string;
  withGrantOption: boolean;
}

export interface RoleMembershipRequest {
  roleName: string;
  memberName: string;
  memberHost?: string;
}

// View management types

export interface ViewInfo {
  name: string;
  schema?: string;
  definition?: string;
  isUpdatable: boolean;
  checkOption?: string;
}

export interface NewViewDefinition {
  name: string;
  schema?: string;
  definition: string;
  orReplace: boolean;
  checkOption?: string;
}

// Standalone index types (for index management, not table creation)

export interface StandaloneIndexInfo {
  name: string;
  schema?: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  indexType?: string;
}

export interface CreateIndexDefinition {
  name?: string;
  schema?: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  indexType?: string;
  whereClause?: string;
}

// Stored Procedure types

export interface ProcedureInfo {
  name: string;
  schema?: string;
  language?: string;
  parameterCount?: number;
}

export interface NewProcedureDefinition {
  name: string;
  schema?: string;
  definition: string;
  orReplace: boolean;
}

// Function types

export interface FunctionInfo {
  name: string;
  schema?: string;
  language?: string;
  returnType?: string;
  parameterCount?: number;
}

export interface NewFunctionDefinition {
  name: string;
  schema?: string;
  definition: string;
  orReplace: boolean;
}

// Trigger types

export interface TriggerInfo {
  name: string;
  schema?: string;
  tableName: string;
  timing?: string;       // BEFORE, AFTER, INSTEAD OF
  event?: string;        // INSERT, UPDATE, DELETE
  enabled: boolean;
}

export interface NewTriggerDefinition {
  name: string;
  schema?: string;
  definition: string;
  orReplace: boolean;
}

// Sequence types

export interface SequenceInfo {
  name: string;
  schema?: string;
  currentValue?: number;
  incrementBy?: number;
  minValue?: number;
  maxValue?: number;
  cycle: boolean;
}

export interface NewSequenceDefinition {
  name: string;
  schema?: string;
  startValue?: number;
  incrementBy?: number;
  minValue?: number;
  maxValue?: number;
  cycle: boolean;
}

