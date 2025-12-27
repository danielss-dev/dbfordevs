/**
 * AI Library - Main exports
 */

// Export all types
export type {
  TableInfo,
  ColumnInfo,
  GenerateSQLRequest,
  GeneratedSQL,
  ExplainQueryRequest,
  QueryExplanation,
  AIChatMessage,
  AIChatRequest,
  AIChatResponse,
  AIProviderType,
  AIModel,
  AIModelsConfig,
  AISettings,
  TokenUsage,
  ModelPricing,
  SessionUsageStats,
  SuggestedAction,
  QueryVariant,
  QueryDiff,
  TableReference,
  ColumnReference,
  AIQueryHistoryItem,
  AIChatSession,
  AIChatHistorySettings,
  AIStorageMetadata,
} from "./types";

// Export constants
export {
  PROVIDER_INFO,
  AVAILABLE_MODELS,
  DEFAULT_MODELS,
  MODEL_PRICING,
} from "./types";

// Export store
export { useAIStore } from "./store";

// Export hooks
export { useAIAssistant } from "./hooks";

// Export API functions
export {
  calculateCost,
  aiGenerateSQL,
  aiExplainQuery,
  aiChatStream,
  aiChat,
  aiGenerateMultipleQueries,
  aiOptimizeQuery,
  getAIModels,
} from "./api";

// Export providers
export {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAIProvider,
  getProviderModel,
  validateApiKey,
} from "./providers";

// Export utilities
export {
  generateChatTitle,
  groupSessionsByTime,
  cleanupOldChats,
  migrateToVersion1,
} from "./utils";
