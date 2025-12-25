/**
 * AI Assistant Types
 */

/** Table information for AI context */
export interface TableInfo {
  name: string;
  schema?: string;
  tableType?: string;
  columns?: ColumnInfo[];
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

/** Available AI provider types */
export type AIProviderType = "anthropic" | "gemini";

/** AI model definition */
export interface AIModel {
  id: string;
  name: string;
  default?: boolean;
}

/** Models available per provider */
export interface AIModelsConfig {
  anthropic: AIModel[];
  gemini: AIModel[];
}

/** AI-specific settings */
export interface AISettings {
  // Core
  /** Enable/disable AI Assistant feature */
  aiEnabled?: boolean;

  // Legacy field - kept for backwards compatibility
  aiApiKey?: string;

  /** Current AI provider */
  aiProvider: AIProviderType;

  // Provider-specific API keys
  aiAnthropicApiKey?: string;
  aiGeminiApiKey?: string;

  // Provider-specific models
  aiAnthropicModel?: string;
  aiGeminiModel?: string;

  /** Temperature for AI generation (0.0 - 2.0) */
  aiTemperature?: number;

  /** Max tokens for AI generation */
  aiMaxTokens?: number;
}

/** Table reference for @ mentions */
export interface TableReference {
  name: string;
  schema?: string;
  startIndex: number;
  endIndex: number;
}

/** Column reference for @ mentions */
export interface ColumnReference {
  tableName: string;
  columnName: string;
  startIndex: number;
  endIndex: number;
}

/** Query history item
 * @deprecated Use AIChatSession instead
 */
export interface AIQueryHistoryItem {
  id: string;
  prompt: string;
  generatedSQL?: string;
  provider: AIProviderType;
  model: string;
  timestamp: Date;
  isFavorite: boolean;
}

/** Chat session containing multiple messages */
export interface AIChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: AIChatMessage[];
  isFavorite: boolean;
  connectionId?: string;
  databaseType?: string;
}

/** Settings for chat history cleanup */
export interface AIChatHistorySettings {
  autoCleanupEnabled: boolean;
  maxDaysOld: number;
  maxChatCount: number;
  cleanupOnStartup: boolean;
}

/** Storage metadata for versioning and migrations */
export interface AIStorageMetadata {
  version: number;
  migratedAt?: Date;
}

/** Provider display info */
export const PROVIDER_INFO: Record<AIProviderType, { name: string; displayName: string; icon: string; apiKeyUrl: string }> = {
  anthropic: {
    name: "anthropic",
    displayName: "Anthropic (Claude)",
    icon: "sparkles",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    name: "gemini",
    displayName: "Google (Gemini)",
    icon: "stars",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
  },
};

/** Available models per provider (frontend-defined, no backend call needed) */
export const AVAILABLE_MODELS: AIModelsConfig = {
  anthropic: [
    { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
    { id: "claude-sonnet-4-5-20251101", name: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", default: true },
  ],
  gemini: [
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro "},
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", default: true },
  ],
};

/** Default models for each provider */
export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  gemini: "gemini-3-flash-preview",
};



