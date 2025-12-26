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
  /** Current query from the editor for context */
  currentQuery?: string;
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
  /** Token usage for this message (assistant messages only) */
  usage?: TokenUsage;
  /** Suggested follow-up actions (assistant messages only) */
  suggestedActions?: SuggestedAction[];
  /** Multiple query variants (for multi-query generation) */
  queryVariants?: QueryVariant[];
  /** Query optimization diff */
  queryDiff?: QueryDiff;
  /** Whether this message is still streaming */
  isStreaming?: boolean;
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
export type AIProviderType = "anthropic" | "gemini" | "openai";

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
  openai: AIModel[];
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
  aiOpenaiApiKey?: string;

  // Provider-specific models
  aiAnthropicModel?: string;
  aiGeminiModel?: string;
  aiOpenaiModel?: string;

  /** Temperature for AI generation (0.0 - 2.0) */
  aiTemperature?: number;

  /** Max tokens for AI generation */
  aiMaxTokens?: number;
}

/** Token usage tracking */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Cost estimate per provider/model (per 1M tokens) */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/** Session usage statistics */
export interface SessionUsageStats {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCost: number;
  messageCount: number;
}

/** Suggested follow-up action */
export interface SuggestedAction {
  label: string;
  prompt: string;
  icon?: string;
}

/** Query variant for multi-query generation */
export interface QueryVariant {
  sql: string;
  description: string;
  approach: string;
}

/** Query diff for optimization comparisons */
export interface QueryDiff {
  original: string;
  optimized: string;
  changes: string[];
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
  /** Aggregated usage stats for this session */
  usageStats?: SessionUsageStats;
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
  openai: {
    name: "openai",
    displayName: "OpenAI (GPT)",
    icon: "brain",
    apiKeyUrl: "https://platform.openai.com/api-keys",
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
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", default: true },
  ],
  openai: [
    { id: "gpt-5.2-2025-12-11", name: "GPT-5.2", default: true },
    { id: "gpt-5-mini-2025-08-07", name: "GPT-5 Mini" },
    { id: "gpt-5.2-pro-2025-12-11", name: "GPT-5.2 Pro" },
  ],
};

/** Default models for each provider */
export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  gemini: "gemini-3-flash-preview",
  openai: "gpt-5-mini-2025-08-07",
};

/** Model pricing (per 1M tokens) - approximate as of Dec 2024 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-5-20251101": { inputPer1M: 15, outputPer1M: 75 },
  "claude-sonnet-4-5-20251101": { inputPer1M: 3, outputPer1M: 15 },
  "claude-haiku-4-5-20251001": { inputPer1M: 0.25, outputPer1M: 1.25 },
  // Gemini
  "gemini-3-pro-preview": { inputPer1M: 1.25, outputPer1M: 5 },
  "gemini-3-flash-preview": { inputPer1M: 0.075, outputPer1M: 0.30 },
  // OpenAI
  "gpt-5.2-2025-12-11": { inputPer1M: 1.75, outputPer1M: 14 },
  "gpt-5-mini-2025-08-07": { inputPer1M: 0.25, outputPer1M: 2 },
  "gpt-5.2-pro-2025-12-11": { inputPer1M: 21, outputPer1M: 168 },
};



