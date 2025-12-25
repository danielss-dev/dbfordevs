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
} from "./types";
import { AVAILABLE_MODELS, DEFAULT_MODELS } from "./types";
import * as api from "./api";

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
  messages: AIChatMessage[];
  isLoading: boolean;
  context: {
    connectionId?: string;
    databaseType?: string;
    databaseName?: string;
    schemaName?: string;
    tables: TableInfo[];
    selectedTable?: string;
  };

  // Query history
  queryHistory: AIQueryHistoryItem[];
  historyPanelOpen: boolean;

  // Table reference dropdown state
  tableDropdownOpen: boolean;
  tableDropdownFilter: string;

  // Actions
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  setContext: (context: Partial<AIState["context"]>) => void;
  updateSettings: (settings: Partial<AISettings>) => Promise<void>;
  setApiKey: (key: string, provider?: AIProviderType) => Promise<void>;

  // Provider/model actions
  fetchModels: () => Promise<void>;
  setProvider: (provider: AIProviderType) => Promise<void>;
  setModel: (provider: AIProviderType, model: string) => Promise<void>;

  // History actions
  toggleHistoryPanel: () => void;
  addToHistory: (item: Omit<AIQueryHistoryItem, "id" | "timestamp">) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;

  // Table reference actions
  openTableDropdown: (filter: string) => void;
  closeTableDropdown: () => void;

  // Computed helpers
  getCurrentProvider: () => AIProviderType;
  getCurrentModel: () => string;
  isConfigured: () => boolean;
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
      messages: [],
      isLoading: false,
      context: {
        tables: [],
      },
      queryHistory: [],
      historyPanelOpen: false,
      tableDropdownOpen: false,
      tableDropdownFilter: "",

      // Panel actions
      setPanelOpen: (open: boolean) => set({ panelOpen: open }),

      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

      // Chat actions
      sendMessage: async (message: string) => {
        const { context, messages, settings, addToHistory } = get();

        console.log("[AI Store] sendMessage called with:", message);
        console.log("[AI Store] Current context:", JSON.stringify(context, null, 2));

        const userMessage: AIChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          timestamp: new Date(),
        };

        set({
          messages: [...messages, userMessage],
          isLoading: true,
        });

        try {
          // Extract @table references from the message
          const referencedTables = extractTableReferences(message);
          console.log("[AI Store] Referenced tables:", referencedTables);

          // Fetch schemas for referenced tables
          let tablesWithSchema: TableInfo[] = context.tables || [];

          if (context.connectionId && referencedTables.length > 0) {
            const enrichedTables = await Promise.all(
              (context.tables || []).map(async (table) => {
                // Check if this table matches any of the referenced tables
                const isReferenced = referencedTables.some((ref) => tableMatchesReference(table, ref));

                // If table is referenced and doesn't have columns, fetch them
                if (isReferenced && (!table.columns || table.columns.length === 0)) {
                  // Build the full table name with schema for PostgreSQL
                  const fullTableName = table.schema ? `${table.schema}.${table.name}` : table.name;
                  console.log(`[AI Store] Fetching schema for referenced table: ${fullTableName}`);
                  const schema = await fetchTableSchema(context.connectionId!, fullTableName);
                  if (schema) {
                    return { ...table, columns: schema.columns };
                  }
                }
                return table;
              })
            );
            tablesWithSchema = enrichedTables;
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

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            isLoading: false,
          }));

          // Add to history if SQL was generated
          if (response.sql) {
            addToHistory({
              prompt: message,
              generatedSQL: response.sql,
              provider: settings.aiProvider,
              model: get().getCurrentModel(),
              isFavorite: false,
            });
          }
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
            messages: [...state.messages, errorMessage],
            isLoading: false,
          }));
        }
      },

      clearMessages: () => set({ messages: [] }),

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

      // History actions
      toggleHistoryPanel: () =>
        set((state) => ({ historyPanelOpen: !state.historyPanelOpen })),

      addToHistory: (item) => {
        const newItem: AIQueryHistoryItem = {
          ...item,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };
        set((state) => ({
          queryHistory: [newItem, ...state.queryHistory].slice(0, 100), // Keep last 100
        }));
      },

      toggleFavorite: (id: string) => {
        set((state) => ({
          queryHistory: state.queryHistory.map((item) =>
            item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
          ),
        }));
      },

      clearHistory: () => set({ queryHistory: [] }),

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
    }),
    {
      name: "dbfordevs-ai-assistant",
      partialize: (state) => ({
        settings: state.settings,
        messages: state.messages.slice(-50),
        queryHistory: state.queryHistory.slice(0, 100),
      }),
      onRehydrateStorage: () => (state) => {
        // Settings are stored locally - just log rehydration
        if (state) {
          console.log("[AI Store] Rehydrated settings from local storage");
        }
      },
    }
  )
);



