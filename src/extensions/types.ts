/**
 * Extension System Types
 *
 * TypeScript interfaces for the dbfordevs extension system.
 */

/** Extension status */
export type ExtensionStatus =
  | "installed"
  | "active"
  | "disabled"
  | { error: string }
  | "installing"
  | "updating";

/** Extension category */
export type ExtensionCategory =
  | "validator"
  | "ai"
  | "exporter"
  | "theme"
  | "connector"
  | { other: string };

/** Extension information from the backend */
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  status: ExtensionStatus;
  isOfficial: boolean;
  repository?: string;
  icon?: string;
}

/** Extension settings */
export interface ExtensionSettings {
  aiApiKey?: string;
  aiProvider: string;
}

/** Request to install from GitHub */
export interface InstallFromGitHubRequest {
  repositoryUrl: string;
}

// ============================================================================
// AI Assistant Types
// ============================================================================

/** Table information for AI context */
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

/** Column information for AI context */
export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

/** Request for SQL generation */
export interface GenerateSQLRequest {
  prompt: string;
  databaseType?: string;
  databaseName?: string;
  schemaName?: string;
  tables: TableInfo[];
  selectedTable?: string;
}

/** Generated SQL response */
export interface GeneratedSQL {
  sql: string;
  explanation?: string;
  confidence: number;
}

/** Request for query explanation */
export interface ExplainQueryRequest {
  sql: string;
  databaseType?: string;
}

/** Query explanation response */
export interface QueryExplanation {
  summary: string;
  steps: string[];
  warnings: string[];
}

/** AI chat message */
export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  timestamp: Date;
}

/** AI chat request */
export interface AIChatRequest {
  message: string;
  context?: GenerateSQLRequest;
}

/** AI chat response */
export interface AIChatResponse {
  message: string;
  sql?: string;
  explanation?: string;
}

