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
} from "./types";
import { AVAILABLE_MODELS, DEFAULT_MODELS } from "./types";
import * as api from "./api";
import { generateChatTitle, cleanupOldChats, migrateToVersion1 } from "./utils";

/** Extract @table references from a message (supports @table and @schema.table formats) */
function extractTableReferences(message: string): string[] {
  // Match @table or @schema.table patterns
  const matches = message.match(/@([\w]+(?:\.[\w]+)?)/g) || [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

/** Check if a table matches a reference (handles both "table" and "schema.table" formats) */
function tableMatchesReference(table: TableInfo, reference: string): boolean {
  const tableName = table.name.toLowerCase();
  const schemaName = table.schema?.toLowerCase();

  // Check full qualified name (schema.table)
  if (schemaName && reference.includes(".")) {
    const fullName = `${schemaName}.${tableName}`;
    if (fullName === reference) return true;
  }

  // Check just the table name (for @table without schema)
  if (tableName === reference) return true;

  // Check if reference is schema.table and matches this table
  if (reference.includes(".")) {
    const [refSchema, refTable] = reference.split(".");
    if (schemaName === refSchema && tableName === refTable) return true;
  }

  return false;
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
  isLoading: boolean;
  context: {
    connectionId?: string;
    databaseType?: string;
    databaseName?: string;
    schemaName?: string;
    tables: TableInfo[];
    selectedTable?: string;
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

  // Actions
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  sendMessage: (message: string) => Promise<void>;
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
  toggleHistoryPanel: () => void;

  // Table reference actions
  openTableDropdown: (filter: string) => void;
  closeTableDropdown: () => void;

  // Computed helpers
  getCurrentProvider: () => AIProviderType;
  getCurrentModel: () => string;
  isConfigured: () => boolean;
  getActiveSession: () => AIChatSession | null;
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
      isLoading: false,
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

      // Panel actions
      setPanelOpen: (open: boolean) => set({ panelOpen: open }),

      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

      // Chat actions
      sendMessage: async (message: string) => {
        const { context, chatSessions, activeChatSessionId, settings, createNewChatSession } = get();

        console.log("[AI Store] sendMessage called with:", message);
        console.log("[AI Store] Current context:", JSON.stringify(context, null, 2));

        // Create new session if none active
        let sessionId = activeChatSessionId;
        if (!sessionId) {
          createNewChatSession();
          sessionId = get().activeChatSessionId;
        }

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

        set((state) => ({
          chatSessions: state.chatSessions.map(s =>
            s.id === sessionId
              ? { ...s, messages, title, updatedAt: new Date() }
              : s
          ),
          isLoading: true,
        }));

        try {
          // Extract @table references from the message
          const referencedTables = extractTableReferences(message);
          console.log("[AI Store] Referenced tables:", referencedTables);
          console.log("[AI Store] Available tables in context:", context.tables?.map(t => ({
            name: t.name,
            schema: t.schema,
            hasColumns: !!(t.columns && t.columns.length > 0),
            columnCount: t.columns?.length || 0
          })));

          // Fetch schemas for referenced tables
          let tablesWithSchema: TableInfo[] = context.tables || [];

          if (context.connectionId && referencedTables.length > 0) {
            const enrichedTables = await Promise.all(
              (context.tables || []).map(async (table) => {
                // Check if this table matches any of the referenced tables
                const isReferenced = referencedTables.some((ref) => tableMatchesReference(table, ref));
                console.log(`[AI Store] Table ${table.schema}.${table.name} - isReferenced: ${isReferenced}, hasColumns: ${!!(table.columns && table.columns.length > 0)}`);

                // If table is referenced and doesn't have columns, fetch them
                if (isReferenced && (!table.columns || table.columns.length === 0)) {
                  // Build the table name for schema fetching
                  // Different databases expect different formats:
                  // - PostgreSQL: "schema.table" (e.g., "public.accounts")
                  // - MySQL: just "table" (e.g., "users") - uses current database
                  // - SQLite: just "table"

                  let tableNameForFetch: string;

                  // Check if table.name already includes schema/database prefix
                  const tableNameIncludesSchema = table.name.includes('.');

                  // For MySQL and SQLite, use just the table name (no schema prefix)
                  const dbType = context.databaseType?.toLowerCase();
                  const isMySQLOrSQLite = dbType === 'mysql' || dbType === 'mariadb' || dbType === 'sqlite';

                  if (isMySQLOrSQLite) {
                    // For MySQL/SQLite: use just the table name, never include schema/database
                    tableNameForFetch = tableNameIncludesSchema ? table.name.split('.').pop()! : table.name;
                  } else {
                    // For PostgreSQL and others: use schema.table format
                    tableNameForFetch = tableNameIncludesSchema
                      ? table.name
                      : (table.schema ? `${table.schema}.${table.name}` : table.name);
                  }

                  console.log(`[AI Store] Fetching schema for referenced table: ${tableNameForFetch} (dbType: ${dbType})`);
                  const schema = await fetchTableSchema(context.connectionId!, tableNameForFetch);
                  if (schema) {
                    console.log(`[AI Store] Successfully fetched schema for ${tableNameForFetch}, columns:`, schema.columns.map(c => c.name));
                    return { ...table, columns: schema.columns };
                  } else {
                    console.warn(`[AI Store] Failed to fetch schema for ${tableNameForFetch}`);
                  }
                }
                return table;
              })
            );
            tablesWithSchema = enrichedTables;

            // Log final tables with schema
            console.log("[AI Store] Final tables with schema:", tablesWithSchema.map(t => ({
              name: t.name,
              schema: t.schema,
              columns: t.columns?.map(c => c.name) || []
            })));
          }

          // Determine the selected table from @ references
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
          };
          console.log("[AI Store] Sending request with context:", JSON.stringify(requestContext, null, 2));

          // Pass full message history for conversational context
          const messagesWithUser = [...messages, userMessage];

          const response = await api.aiChat(
            {
              message,
              context: requestContext,
            },
            messagesWithUser,
            settings
          );

          const assistantMessage: AIChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: response.message,
            sql: response.sql,
            timestamp: new Date(),
          };

          // Add assistant message to session
          set((state) => ({
            chatSessions: state.chatSessions.map(s =>
              s.id === sessionId
                ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: new Date() }
                : s
            ),
            isLoading: false,
          }));
        } catch (error) {
          const errorMessage: AIChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              error instanceof Error
                ? `Error: ${error.message}`
                : "An error occurred while processing your request.",
            timestamp: new Date(),
          };

          set((state) => ({
            chatSessions: state.chatSessions.map(s =>
              s.id === sessionId
                ? { ...s, messages: [...s.messages, errorMessage], updatedAt: new Date() }
                : s
            ),
            isLoading: false,
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

      toggleHistoryPanel: () =>
        set((state) => ({ historyPanelOpen: !state.historyPanelOpen })),

      // Table reference actions
      openTableDropdown: (filter: string) =>
        set({ tableDropdownOpen: true, tableDropdownFilter: filter }),

      closeTableDropdown: () =>
        set({ tableDropdownOpen: false, tableDropdownFilter: "" }),

      // Computed helpers
      getCurrentProvider: () => {
        const provider = get().settings.aiProvider as string;
        // Handle legacy "openai" provider or invalid values - migrate to anthropic
        if (!provider || provider === "openai") return "anthropic";
        if (provider !== "anthropic" && provider !== "gemini") return "anthropic";
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
    }),
    {
      name: "dbfordevs-ai-assistant",
      partialize: (state) => ({
        settings: state.settings,
        historySettings: state.historySettings,
        storageMetadata: state.storageMetadata,
        activeChatSessionId: state.activeChatSessionId,
        // Limit stored sessions and messages per session
        chatSessions: state.chatSessions.slice(0, 100).map(session => ({
          ...session,
          messages: session.messages.slice(-50), // Max 50 messages per session
        })),
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



