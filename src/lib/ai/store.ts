/**
 * AI Assistant Store
 *
 * Zustand store for AI-specific state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type {
  AISettings,
  AIChatMessage,
  TableInfo,
  AIModelsConfig,
  AIProviderType,
  AIQueryHistoryItem,
  ColumnInfo,
  AIChatSession,
  AIChatHistorySettings,
  AIStorageMetadata,
  TokenUsage,
  SessionUsageStats,
  AIContextConfig,
  ManualContextEntry,
  ContextTemplate,
  EnhancedTableInfo,
  ContextSizeInfo,
  ValidationConfig,
  ValidationResult,
  ChatTemplate,
  MongoContext,
  RedisContext,
} from "./types";
import {
  DEFAULT_CONTEXT_CONFIG,
  buildEnhancedContext,
  calculateContextSize,
} from "./context-builder";
import { validateQuery as runValidation } from "./validation";
import { AVAILABLE_MODELS, DEFAULT_MODELS } from "./types";
import { calculateCost, aiChatStream } from "./api";
import * as api from "./api";
import { generateChatTitle, cleanupOldChats, migrateToVersion1 } from "./utils";

/** Calculate aggregated usage stats for a session */
function calculateSessionUsageStats(messages: AIChatMessage[], modelId: string): SessionUsageStats {
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let messageCount = 0;

  for (const msg of messages) {
    if (msg.role === "assistant" && msg.usage) {
      totalPromptTokens += msg.usage.promptTokens;
      totalCompletionTokens += msg.usage.completionTokens;
      messageCount++;
    }
  }

  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const estimatedCost = calculateCost(
    { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens, totalTokens },
    modelId
  );

  return {
    totalTokens,
    totalPromptTokens,
    totalCompletionTokens,
    estimatedCost,
    messageCount,
  };
}

/** Extract @table references from a message (supports @table and @schema.table formats) */
function extractTableReferences(message: string): string[] {
  // Match @table or @schema.table patterns
  const matches = message.match(/@([\w]+(?:\.[\w]+)?)/g) || [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

/** Check if a table matches a reference (handles both "table" and "schema.table" formats)
 *
 * Different databases return table info differently:
 * - PostgreSQL/Oracle: name includes schema (e.g., "public.users")
 * - MySQL/SQLite: name is just table name (e.g., "users"), schema is database name
 * - MSSQL: name is just table name, schema is separate (e.g., "dbo")
 */
function tableMatchesReference(table: TableInfo, reference: string): boolean {
  const tableNameLower = table.name.toLowerCase();
  const schemaName = table.schema?.toLowerCase();

  // Check if table.name already includes schema (PostgreSQL, Oracle return "schema.table")
  const tableNameHasSchema = tableNameLower.includes('.');

  // Extract just the table name without schema prefix
  const pureTableName = tableNameHasSchema
    ? tableNameLower.split('.').pop()!
    : tableNameLower;

  // If reference doesn't include schema, match against pure table name
  if (!reference.includes('.')) {
    return pureTableName === reference;
  }

  // Reference includes schema (e.g., @schema.table)
  const [refSchema, refTable] = reference.split('.');

  // For tables where name already includes schema (PostgreSQL, Oracle)
  if (tableNameHasSchema) {
    return tableNameLower === reference;
  }

  // For tables where schema is separate (MySQL, MSSQL, SQLite)
  return schemaName === refSchema && pureTableName === refTable;
}

/** Fetch table schema from backend */
async function fetchTableSchema(
  connectionId: string,
  tableName: string
): Promise<{ columns: ColumnInfo[] } | null> {
  try {
    const schema = await invoke<{
      tableName: string;
      columns: Array<{
        name: string;
        dataType: string;
        nullable: boolean;
        isPrimaryKey: boolean;
      }>;
    }>("get_table_schema", { connectionId, tableName });

    return {
      columns: schema.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
        isNullable: c.nullable,
        isPrimaryKey: c.isPrimaryKey,
      })),
    };
  } catch (error) {
    console.error(`[AI Store] Failed to fetch schema for ${tableName}:`, error);
    return null;
  }
}


interface AIState {
  // Settings
  settings: AISettings;

  // Models configuration (fetched from backend)
  availableModels: AIModelsConfig | null;
  modelsLoading: boolean;

  // AI Panel state
  panelOpen: boolean;
  panelExpanded: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  context: {
    connectionId?: string;
    databaseType?: string;
    databaseName?: string;
    schemaName?: string;
    tables: TableInfo[];
    selectedTable?: string;
    /** Current query from the editor (for context-aware AI) */
    currentQuery?: string;
  };

  // Chat sessions (replaces messages and queryHistory)
  chatSessions: AIChatSession[];
  activeChatSessionId: string | null;
  historyPanelOpen: boolean;

  // History settings
  historySettings: AIChatHistorySettings;
  storageMetadata: AIStorageMetadata;

  // Legacy fields for migration
  _legacy_messages?: AIChatMessage[];
  _legacy_queryHistory?: AIQueryHistoryItem[];

  // Table reference dropdown state
  tableDropdownOpen: boolean;
  tableDropdownFilter: string;

  // Enhanced context state (Phase 1)
  contextConfig: AIContextConfig;
  manualContextEntries: ManualContextEntry[];
  contextTemplates: ContextTemplate[];
  enhancedTables: EnhancedTableInfo[];
  contextPanelOpen: boolean;

  // Validation state (Phase 2)
  validationConfig: ValidationConfig;
  lastValidationResult: ValidationResult | null;

  // Chat templates state (Phase 3)
  chatTemplates: ChatTemplate[];

  // NoSQL context state (Phase 4)
  mongoContext?: MongoContext;
  redisContext?: RedisContext;

  // Actions
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  togglePanelExpanded: () => void;
  sendMessage: (message: string, useStreaming?: boolean) => Promise<void>;
  setContext: (context: Partial<AIState["context"]>) => void;
  updateSettings: (settings: Partial<AISettings>) => Promise<void>;
  setApiKey: (key: string, provider?: AIProviderType) => Promise<void>;

  // Provider/model actions
  fetchModels: () => Promise<void>;
  setProvider: (provider: AIProviderType) => Promise<void>;
  setModel: (provider: AIProviderType, model: string) => Promise<void>;

  // Session actions (replaces clearMessages, addToHistory, clearHistory)
  createNewChatSession: () => void;
  switchChatSession: (sessionId: string) => void;
  deleteChatSession: (sessionId: string) => void;
  updateChatSessionTitle: (sessionId: string, title: string) => void;
  toggleSessionFavorite: (sessionId: string) => void;
  updateHistorySettings: (settings: Partial<AIChatHistorySettings>) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  toggleHistoryPanel: () => void;

  // Table reference actions
  openTableDropdown: (filter: string) => void;
  closeTableDropdown: () => void;

  // Context enhancement actions (Phase 1)
  updateContextConfig: (config: Partial<AIContextConfig>) => void;
  addManualContextEntry: (entry: Omit<ManualContextEntry, 'id' | 'addedAt'>) => void;
  removeManualContextEntry: (id: string) => void;
  saveContextTemplate: (name: string, description: string) => void;
  applyContextTemplate: (templateId: string) => void;
  deleteContextTemplate: (templateId: string) => void;
  fetchEnhancedTables: (tableNames: string[]) => Promise<void>;
  setContextPanelOpen: (open: boolean) => void;
  toggleContextPanel: () => void;
  estimateContextSize: () => ContextSizeInfo;

  // Validation actions (Phase 2)
  updateValidationConfig: (config: Partial<ValidationConfig>) => void;
  validateQuery: (sql: string) => ValidationResult;

  // Chat template actions (Phase 3)
  createSessionFromTemplate: (templateId: string) => void;
  saveChatAsTemplate: (name: string, description: string) => void;
  deleteChatTemplate: (templateId: string) => void;

  // NoSQL context actions (Phase 4)
  setMongoContext: (context: MongoContext | undefined) => void;
  setRedisContext: (context: RedisContext | undefined) => void;

  // Computed helpers
  getCurrentProvider: () => AIProviderType;
  getCurrentModel: () => string;
  isConfigured: () => boolean;
  getActiveSession: () => AIChatSession | null;
  getSessionUsageStats: (sessionId?: string) => SessionUsageStats | null;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: {
        aiEnabled: true,
        aiProvider: "anthropic",
      },
      availableModels: null,
      modelsLoading: false,
      panelOpen: false,
      panelExpanded: false,
      isLoading: false,
      isStreaming: false,
      streamingMessageId: null,
      context: {
        tables: [],
      },
      chatSessions: [],
      activeChatSessionId: null,
      historyPanelOpen: false,
      historySettings: {
        autoCleanupEnabled: true,
        maxDaysOld: 30,
        maxChatCount: 100,
        cleanupOnStartup: true,
      },
      storageMetadata: {
        version: 0,
      },
      tableDropdownOpen: false,
      tableDropdownFilter: "",

      // Enhanced context state
      contextConfig: DEFAULT_CONTEXT_CONFIG,
      manualContextEntries: [],
      contextTemplates: [
        // Built-in templates
        {
          id: "minimal",
          name: "Minimal",
          description: "Only table names and columns",
          includeForeignKeys: false,
          includeIndexes: false,
          includeSampleData: false,
          sampleDataRows: 0,
          isBuiltIn: true,
        },
        {
          id: "standard",
          name: "Standard",
          description: "Tables, columns, and relationships",
          includeForeignKeys: true,
          includeIndexes: false,
          includeSampleData: false,
          sampleDataRows: 0,
          isBuiltIn: true,
        },
        {
          id: "comprehensive",
          name: "Comprehensive",
          description: "Full schema with indexes and sample data",
          includeForeignKeys: true,
          includeIndexes: true,
          includeSampleData: true,
          sampleDataRows: 3,
          isBuiltIn: true,
        },
      ],
      enhancedTables: [],
      contextPanelOpen: false,

      // Validation state
      validationConfig: {
        enableSyntaxCheck: true,
        enableSemanticCheck: true,
        enablePerformanceWarnings: true,
        enableSecurityWarnings: true,
        blockDangerousQueries: false,
      },
      lastValidationResult: null,

      // Chat templates
      chatTemplates: [
        {
          id: "query-builder",
          name: "Query Builder",
          description: "Step-by-step SQL construction",
          starterPrompts: [
            "Help me build a query to...",
            "I need to join these tables...",
            "Create a report showing...",
          ],
          isBuiltIn: true,
        },
        {
          id: "query-optimization",
          name: "Query Optimization",
          description: "Analyze and improve queries",
          starterPrompts: [
            "Analyze this query for performance...",
            "How can I optimize this query?",
            "Suggest indexes for this query...",
          ],
          isBuiltIn: true,
        },
        {
          id: "data-exploration",
          name: "Data Exploration",
          description: "Understand your data",
          starterPrompts: [
            "What data is in this table?",
            "Show me the relationships between tables...",
            "Summarize the data distribution...",
          ],
          isBuiltIn: true,
        },
      ],

      // NoSQL context
      mongoContext: undefined,
      redisContext: undefined,

      // Panel actions
      setPanelOpen: (open: boolean) => set({ panelOpen: open }),

      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

      togglePanelExpanded: () => set((state) => ({ panelExpanded: !state.panelExpanded })),

      // Chat actions
      sendMessage: async (message: string, useStreaming: boolean = true) => {
        const { context, activeChatSessionId, settings, createNewChatSession, getCurrentModel } = get();

        console.log("[AI Store] sendMessage called with:", message);
        console.log("[AI Store] Current context:", JSON.stringify(context, null, 2));

        // Create new session if none active
        let sessionId = activeChatSessionId;
        if (!sessionId) {
          createNewChatSession();
          sessionId = get().activeChatSessionId;
        }

        // Re-fetch chatSessions after potential session creation
        const chatSessions = get().chatSessions;

        const activeSession = chatSessions.find(s => s.id === sessionId);
        if (!activeSession) {
          console.error("[AI Store] No active session found");
          return;
        }

        const userMessage: AIChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          timestamp: new Date(),
        };

        // Add user message to session
        const messages = [...activeSession.messages, userMessage];

        // Auto-generate title from first message
        const title = activeSession.messages.length === 0
          ? generateChatTitle(userMessage)
          : activeSession.title;

        // Create placeholder for streaming assistant message
        const assistantMessageId = crypto.randomUUID();

        set((state) => ({
          chatSessions: state.chatSessions.map(s =>
            s.id === sessionId
              ? { ...s, messages, title, updatedAt: new Date() }
              : s
          ),
          isLoading: true,
          isStreaming: useStreaming,
          streamingMessageId: useStreaming ? assistantMessageId : null,
        }));

        try {
          // Extract @table references from the message
          const referencedTables = extractTableReferences(message);
          console.log("[AI Store] Referenced tables:", referencedTables);

          // Fetch schemas for referenced tables
          let tablesWithSchema: TableInfo[] = context.tables || [];

          if (context.connectionId && referencedTables.length > 0) {
            const enrichedTables = await Promise.all(
              (context.tables || []).map(async (table) => {
                const isReferenced = referencedTables.some((ref) => tableMatchesReference(table, ref));

                if (isReferenced && (!table.columns || table.columns.length === 0)) {
                  const tableNameIncludesSchema = table.name.includes('.');
                  const dbType = context.databaseType?.toLowerCase();
                  const isMySQLOrSQLite = dbType === 'mysql' || dbType === 'mariadb' || dbType === 'sqlite';

                  let tableNameForFetch: string;
                  if (isMySQLOrSQLite) {
                    tableNameForFetch = tableNameIncludesSchema ? table.name.split('.').pop()! : table.name;
                  } else {
                    tableNameForFetch = tableNameIncludesSchema
                      ? table.name
                      : (table.schema ? `${table.schema}.${table.name}` : table.name);
                  }

                  console.log(`[AI Store] Fetching schema for: ${tableNameForFetch}`);
                  const schema = await fetchTableSchema(context.connectionId!, tableNameForFetch);
                  if (schema) {
                    return { ...table, columns: schema.columns };
                  }
                }
                return table;
              })
            );
            tablesWithSchema = enrichedTables;
          }

          const selectedTable = referencedTables.length === 1
            ? (context.tables || []).find(t => tableMatchesReference(t, referencedTables[0]))?.name
            : context.selectedTable;

          const requestContext = {
            prompt: message,
            databaseType: context.databaseType,
            databaseName: context.databaseName,
            schemaName: context.schemaName,
            tables: tablesWithSchema,
            selectedTable,
            currentQuery: context.currentQuery,
          };

          const messagesWithUser = [...messages];

          if (useStreaming) {
            // Streaming mode
            const streamingMessage: AIChatMessage = {
              id: assistantMessageId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              isStreaming: true,
            };

            // Add placeholder message
            set((state) => ({
              chatSessions: state.chatSessions.map(s =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, streamingMessage], updatedAt: new Date() }
                  : s
              ),
            }));

            const stream = aiChatStream(
              { message, context: requestContext },
              messagesWithUser,
              settings
            );

            let finalUsage: TokenUsage | undefined;

            for await (const chunk of stream) {
              if (chunk.done) {
                finalUsage = chunk.usage;
              }

              // Update streaming message content
              set((state) => ({
                chatSessions: state.chatSessions.map(s =>
                  s.id === sessionId
                    ? {
                        ...s,
                        messages: s.messages.map(m =>
                          m.id === assistantMessageId
                            ? { ...m, content: chunk.text, isStreaming: !chunk.done }
                            : m
                        ),
                        updatedAt: new Date(),
                      }
                    : s
                ),
              }));
            }

            // Parse final response for SQL
            const finalText = get().chatSessions.find(s => s.id === sessionId)?.messages
              .find(m => m.id === assistantMessageId)?.content || "";

            // Try to extract SQL from code blocks first
            const sqlCodeBlockMatch = finalText.match(/```(?:sql)?\s*([\s\S]*?)```/i);
            let sql: string | undefined;

            if (sqlCodeBlockMatch) {
              sql = sqlCodeBlockMatch[1].trim();
            } else {
              // No code block - check if the entire response looks like SQL
              const trimmedText = finalText.trim();
              const sqlPattern = /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\s/i;
              if (sqlPattern.test(trimmedText)) {
                // Extract the SQL statement (everything up to the first non-SQL content or end)
                // This handles cases where AI returns just SQL without code blocks
                sql = trimmedText;
              }
            }

            const looksLikeSQL = sql && /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\s/i.test(sql);

            // Prepare content - if SQL was extracted, clean up the content
            let finalContent = finalText;
            if (looksLikeSQL && sql) {
              if (sqlCodeBlockMatch) {
                // Remove the code block from content, keep any surrounding text
                finalContent = finalText.replace(/```(?:sql)?\s*[\s\S]*?```/gi, "").trim();
              } else {
                // SQL was the entire content - use a default message
                finalContent = "";
              }
              // If no content left after removing SQL, use a default message
              if (!finalContent) {
                finalContent = "Here's the SQL query for your request:";
              }
            }

            // Finalize message with SQL and usage
            set((state) => ({
              chatSessions: state.chatSessions.map(s =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.map(m =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              content: finalContent,
                              sql: looksLikeSQL ? sql : undefined,
                              usage: finalUsage,
                              isStreaming: false,
                            }
                          : m
                      ),
                      updatedAt: new Date(),
                    }
                  : s
              ),
              isLoading: false,
              isStreaming: false,
              streamingMessageId: null,
            }));
          } else {
            // Non-streaming mode
            const response = await api.aiChat(
              { message, context: requestContext },
              messagesWithUser,
              settings
            );

            const assistantMessage: AIChatMessage = {
              id: assistantMessageId,
              role: "assistant",
              content: response.message,
              sql: response.sql,
              timestamp: new Date(),
              usage: response.usage,
            };

            set((state) => ({
              chatSessions: state.chatSessions.map(s =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: new Date() }
                  : s
              ),
              isLoading: false,
              isStreaming: false,
              streamingMessageId: null,
            }));
          }

          // Update session usage stats
          const currentSession = get().chatSessions.find(s => s.id === sessionId);
          if (currentSession) {
            const modelId = getCurrentModel();
            const usageStats = calculateSessionUsageStats(currentSession.messages, modelId);
            set((state) => ({
              chatSessions: state.chatSessions.map(s =>
                s.id === sessionId ? { ...s, usageStats } : s
              ),
            }));
          }
        } catch (error) {
          const streamingMessageId = get().streamingMessageId;
          const currentSession = get().chatSessions.find(s => s.id === sessionId);
          const existingStreamingMessage = currentSession?.messages.find(m => m.id === streamingMessageId);

          set((state) => ({
            chatSessions: state.chatSessions.map(s =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: existingStreamingMessage
                      ? s.messages.map(m =>
                          m.id === streamingMessageId
                            ? {
                                ...m,
                                content:
                                  error instanceof Error
                                    ? `Error: ${error.message}`
                                    : "An error occurred while processing your request.",
                                isStreaming: false,
                              }
                            : m
                        )
                      : [...s.messages, {
                          id: crypto.randomUUID(),
                          role: "assistant",
                          content:
                            error instanceof Error
                              ? `Error: ${error.message}`
                              : "An error occurred while processing your request.",
                          timestamp: new Date(),
                        }],
                    updatedAt: new Date(),
                  }
                : s
            ),
            isLoading: false,
            isStreaming: false,
            streamingMessageId: null,
          }));
        }
      },

      setContext: (context) =>
        set((state) => ({
          context: { ...state.context, ...context },
        })),

      // Settings actions
      updateSettings: async (newSettings: Partial<AISettings>) => {
        const current = get().settings;
        const updated = { ...current, ...newSettings };
        // Settings are stored locally only - no backend sync needed
        set({ settings: updated });
      },

      setApiKey: async (key: string, provider?: AIProviderType) => {
        const targetProvider = provider || get().settings.aiProvider;
        const keyField = `ai${targetProvider.charAt(0).toUpperCase() + targetProvider.slice(1)}ApiKey` as keyof AISettings;
        await get().updateSettings({ [keyField]: key });
      },

      // Provider/model actions
      fetchModels: async () => {
        // Models are now defined in frontend - no API call needed
        set({ availableModels: AVAILABLE_MODELS, modelsLoading: false });
      },

      setProvider: async (provider: AIProviderType) => {
        await get().updateSettings({ aiProvider: provider });
      },

      setModel: async (provider: AIProviderType, model: string) => {
        const modelField = `ai${provider.charAt(0).toUpperCase() + provider.slice(1)}Model` as keyof AISettings;
        await get().updateSettings({ [modelField]: model });
      },

      // Session actions
      createNewChatSession: () => {
        const newSession: AIChatSession = {
          id: crypto.randomUUID(),
          title: "New Chat",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
          isFavorite: false,
          connectionId: get().context.connectionId,
          databaseType: get().context.databaseType,
        };
        set((state) => ({
          chatSessions: [newSession, ...state.chatSessions],
          activeChatSessionId: newSession.id,
        }));
      },

      switchChatSession: (sessionId: string) => {
        set({ activeChatSessionId: sessionId });
      },

      deleteChatSession: (sessionId: string) => {
        set((state) => {
          const newSessions = state.chatSessions.filter(s => s.id !== sessionId);
          // If we deleted the active session, switch to the first one
          const newActiveId = state.activeChatSessionId === sessionId
            ? (newSessions.length > 0 ? newSessions[0].id : null)
            : state.activeChatSessionId;
          return {
            chatSessions: newSessions,
            activeChatSessionId: newActiveId,
          };
        });
      },

      updateChatSessionTitle: (sessionId: string, title: string) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s =>
            s.id === sessionId ? { ...s, title } : s
          ),
        }));
      },

      toggleSessionFavorite: (sessionId: string) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s =>
            s.id === sessionId ? { ...s, isFavorite: !s.isFavorite } : s
          ),
        }));
      },

      updateHistorySettings: (newSettings: Partial<AIChatHistorySettings>) => {
        set((state) => ({
          historySettings: { ...state.historySettings, ...newSettings },
        }));
      },

      setHistoryPanelOpen: (open: boolean) => set({ historyPanelOpen: open }),

      toggleHistoryPanel: () =>
        set((state) => ({ historyPanelOpen: !state.historyPanelOpen })),

      // Table reference actions
      openTableDropdown: (filter: string) =>
        set({ tableDropdownOpen: true, tableDropdownFilter: filter }),

      closeTableDropdown: () =>
        set({ tableDropdownOpen: false, tableDropdownFilter: "" }),

      // Context enhancement actions (Phase 1)
      updateContextConfig: (config: Partial<AIContextConfig>) =>
        set((state) => ({
          contextConfig: { ...state.contextConfig, ...config },
        })),

      addManualContextEntry: (entry: Omit<ManualContextEntry, 'id' | 'addedAt'>) =>
        set((state) => ({
          manualContextEntries: [
            ...state.manualContextEntries,
            {
              ...entry,
              id: crypto.randomUUID(),
              addedAt: new Date(),
            },
          ],
        })),

      removeManualContextEntry: (id: string) =>
        set((state) => ({
          manualContextEntries: state.manualContextEntries.filter((e) => e.id !== id),
        })),

      saveContextTemplate: (name: string, description: string) => {
        const { contextConfig } = get();
        const newTemplate: ContextTemplate = {
          id: crypto.randomUUID(),
          name,
          description,
          includeForeignKeys: contextConfig.includeForeignKeys,
          includeIndexes: contextConfig.includeIndexes,
          includeSampleData: contextConfig.includeSampleData,
          sampleDataRows: contextConfig.sampleDataRows,
          isBuiltIn: false,
        };
        set((state) => ({
          contextTemplates: [...state.contextTemplates, newTemplate],
        }));
      },

      applyContextTemplate: (templateId: string) => {
        const template = get().contextTemplates.find((t) => t.id === templateId);
        if (template) {
          set({
            contextConfig: {
              includeForeignKeys: template.includeForeignKeys,
              includeIndexes: template.includeIndexes,
              includeSampleData: template.includeSampleData,
              sampleDataRows: template.sampleDataRows,
              maxTablesInContext: get().contextConfig.maxTablesInContext,
            },
          });
        }
      },

      deleteContextTemplate: (templateId: string) =>
        set((state) => ({
          contextTemplates: state.contextTemplates.filter(
            (t) => t.id !== templateId && !t.isBuiltIn
          ),
        })),

      fetchEnhancedTables: async (tableNames: string[]) => {
        const { context, contextConfig } = get();
        if (!context.connectionId) return;

        try {
          const enhanced = await buildEnhancedContext(
            context.connectionId,
            tableNames,
            contextConfig
          );
          set({ enhancedTables: enhanced });
        } catch (error) {
          console.error("[AI Store] Failed to fetch enhanced tables:", error);
        }
      },

      setContextPanelOpen: (open: boolean) => set({ contextPanelOpen: open }),

      toggleContextPanel: () =>
        set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),

      estimateContextSize: () => {
        const { enhancedTables, manualContextEntries } = get();
        return calculateContextSize(enhancedTables, manualContextEntries);
      },

      // Validation actions (Phase 2)
      updateValidationConfig: (config: Partial<ValidationConfig>) =>
        set((state) => ({
          validationConfig: { ...state.validationConfig, ...config },
        })),

      validateQuery: (sql: string) => {
        const { context, validationConfig } = get();
        const result = runValidation(sql, context.tables, validationConfig);
        set({ lastValidationResult: result });
        return result;
      },

      // Chat template actions (Phase 3)
      createSessionFromTemplate: (templateId: string) => {
        const template = get().chatTemplates.find((t) => t.id === templateId);
        if (!template) return;

        const newSession: AIChatSession = {
          id: crypto.randomUUID(),
          title: template.name,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
          isFavorite: false,
          connectionId: get().context.connectionId,
          databaseType: get().context.databaseType,
        };

        set((state) => ({
          chatSessions: [newSession, ...state.chatSessions],
          activeChatSessionId: newSession.id,
        }));
      },

      saveChatAsTemplate: (name: string, description: string) => {
        const session = get().getActiveSession();
        if (!session || session.messages.length === 0) return;

        // Extract user prompts as starter prompts
        const starterPrompts = session.messages
          .filter((m) => m.role === "user")
          .slice(0, 3)
          .map((m) => m.content);

        const newTemplate: ChatTemplate = {
          id: crypto.randomUUID(),
          name,
          description,
          starterPrompts,
          isBuiltIn: false,
        };

        set((state) => ({
          chatTemplates: [...state.chatTemplates, newTemplate],
        }));
      },

      deleteChatTemplate: (templateId: string) =>
        set((state) => ({
          chatTemplates: state.chatTemplates.filter(
            (t) => t.id !== templateId && !t.isBuiltIn
          ),
        })),

      // NoSQL context actions (Phase 4)
      setMongoContext: (context: MongoContext | undefined) =>
        set({ mongoContext: context }),

      setRedisContext: (context: RedisContext | undefined) =>
        set({ redisContext: context }),

      // Computed helpers
      getCurrentProvider: () => {
        const provider = get().settings.aiProvider as string;
        // Handle invalid values - default to anthropic
        if (!provider) return "anthropic";
        if (provider !== "anthropic" && provider !== "gemini" && provider !== "openai") return "anthropic";
        return provider as AIProviderType;
      },

      getCurrentModel: () => {
        const { settings } = get();
        const provider = get().getCurrentProvider();
        const modelField = `ai${provider.charAt(0).toUpperCase() + provider.slice(1)}Model` as keyof AISettings;
        return (settings[modelField] as string) || DEFAULT_MODELS[provider];
      },

      isConfigured: () => {
        const { settings } = get();
        const provider = get().getCurrentProvider();
        const keyField = `ai${provider.charAt(0).toUpperCase() + provider.slice(1)}ApiKey` as keyof AISettings;
        const apiKey = settings[keyField] as string | undefined;
        // Also check legacy field for anthropic
        if (provider === "anthropic" && !apiKey) {
          return !!settings.aiApiKey;
        }
        return !!apiKey;
      },

      getActiveSession: () => {
        const { chatSessions, activeChatSessionId } = get();
        return chatSessions.find(s => s.id === activeChatSessionId) || null;
      },

      getSessionUsageStats: (sessionId?: string) => {
        const { chatSessions, activeChatSessionId, getCurrentModel } = get();
        const targetId = sessionId || activeChatSessionId;
        if (!targetId) return null;

        const session = chatSessions.find(s => s.id === targetId);
        if (!session) return null;

        // Return cached stats or calculate new ones
        if (session.usageStats) return session.usageStats;

        return calculateSessionUsageStats(session.messages, getCurrentModel());
      },
    }),
    {
      name: "dbfordevs-ai-assistant",
      partialize: (state) => ({
        settings: state.settings,
        historySettings: state.historySettings,
        storageMetadata: state.storageMetadata,
        activeChatSessionId: state.activeChatSessionId,
        panelExpanded: state.panelExpanded,
        // Limit stored sessions and messages per session
        chatSessions: state.chatSessions.slice(0, 100).map(session => ({
          ...session,
          messages: session.messages.slice(-50), // Max 50 messages per session
        })),
        // Context and validation config (Phase 1 & 2)
        contextConfig: state.contextConfig,
        manualContextEntries: state.manualContextEntries,
        contextTemplates: state.contextTemplates.filter(t => !t.isBuiltIn), // Only persist custom templates
        validationConfig: state.validationConfig,
        // Chat templates (Phase 3)
        chatTemplates: state.chatTemplates.filter(t => !t.isBuiltIn), // Only persist custom templates
        // Keep legacy fields during migration
        _legacy_messages: state._legacy_messages,
        _legacy_queryHistory: state._legacy_queryHistory,
        messages: state._legacy_messages || (state as any).messages, // Capture old messages field
        queryHistory: state._legacy_queryHistory || (state as any).queryHistory, // Capture old queryHistory field
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        console.log("[AI Store] Rehydrating from local storage...");

        // Fix buggy model IDs from version 0.2.0 early builds
        if (state.settings) {
          if (state.settings.aiAnthropicModel === "claude-haiku-4-5-20250514") {
            state.settings.aiAnthropicModel = DEFAULT_MODELS.anthropic;
          }
          if (state.settings.aiGeminiModel === "gemini-flash-3") {
            state.settings.aiGeminiModel = DEFAULT_MODELS.gemini;
          }
        }

        // Check version and run migration if needed
        const currentVersion = state.storageMetadata?.version || 0;

        if (currentVersion === 0) {
          // Store legacy fields for migration
          state._legacy_messages = (state as any).messages;
          state._legacy_queryHistory = (state as any).queryHistory;

          console.log("[AI Store] Found version 0, running migration...");
          migrateToVersion1(state);
        }

        // Auto-cleanup if enabled
        if (state.historySettings?.cleanupOnStartup) {
          console.log("[AI Store] Running auto-cleanup on startup...");
          state.chatSessions = cleanupOldChats(
            state.chatSessions,
            state.historySettings
          );
        }

        console.log(`[AI Store] Rehydration complete. ${state.chatSessions.length} chat sessions loaded.`);
      },
    }
  )
);



