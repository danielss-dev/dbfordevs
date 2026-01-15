import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueryResult, Tab, TableInfo, TableSchema, QueryHistoryEntry, QueryHistorySettings, QueryHistoryStats } from "@/types";

interface QueryState {
  // Open tabs
  tabs: Tab[];
  // Currently active tab
  activeTabId: string | null;
  // Query results per tab
  results: Record<string, QueryResult>;
  // Tables per connection (keyed by connectionId)
  tablesByConnection: Record<string, TableInfo[]>;
  // Schema for selected table
  tableSchema: TableSchema | null;
  // Execution state
  isExecuting: boolean;
  // Error state
  error: string | null;
  // Query history per connection (keyed by connectionId)
  queryHistory: Record<string, QueryHistoryEntry[]>;
  // Query history settings
  historySettings: QueryHistorySettings;

  // Actions
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  updateTabContent: (id: string, content: string) => void;
  setResults: (tabId: string, results: QueryResult) => void;
  clearResults: (tabId: string) => void;
  setTablesForConnection: (connectionId: string, tables: TableInfo[]) => void;
  clearTablesForConnection: (connectionId: string) => void;
  setTableSchema: (schema: TableSchema | null) => void;
  setExecuting: (executing: boolean) => void;
  setError: (error: string | null) => void;
  renameTableInTabs: (connectionId: string, oldName: string, newName: string) => void;
  addQueryToHistory: (entry: QueryHistoryEntry, detectDuplicates?: boolean) => void;
  clearHistoryForConnection: (connectionId: string) => void;
  // New history actions
  toggleFavorite: (connectionId: string, entryId: string) => void;
  deleteHistoryEntry: (connectionId: string, entryId: string) => void;
  updateHistorySettings: (settings: Partial<QueryHistorySettings>) => void;
  cleanupOldHistory: () => void;
  getHistoryStats: (connectionId: string) => QueryHistoryStats;
  exportHistory: (connectionId: string, format: 'json' | 'csv') => string;
}

// Default history settings
const DEFAULT_HISTORY_SETTINGS: QueryHistorySettings = {
  maxHistoryItems: 100,
  maxDaysOld: 30,
  autoCleanupEnabled: true,
};

// Helper to normalize SQL for duplicate detection
function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

export const useQueryStore = create<QueryState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      results: {},
      tablesByConnection: {},
      tableSchema: null,
      isExecuting: false,
      error: null,
      queryHistory: {},
      historySettings: DEFAULT_HISTORY_SETTINGS,

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),

  removeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      const newResults = { ...state.results };
      delete newResults[id];

      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === id) {
        const index = state.tabs.findIndex((t) => t.id === id);
        newActiveTabId = newTabs[index - 1]?.id ?? newTabs[0]?.id ?? null;
      }

      return {
        tabs: newTabs,
        results: newResults,
        activeTabId: newActiveTabId,
      };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  updateTabContent: (id, content) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, content } : t)),
    })),

  setResults: (tabId, results) =>
    set((state) => ({
      results: { ...state.results, [tabId]: results },
      isExecuting: false, // Ensure isExecuting is false when results are set
    })),

  clearResults: (tabId) =>
    set((state) => {
      const newResults = { ...state.results };
      delete newResults[tabId];
      return { results: newResults };
    }),

  setTablesForConnection: (connectionId, tables) =>
    set((state) => ({
      tablesByConnection: { ...state.tablesByConnection, [connectionId]: tables },
    })),

  clearTablesForConnection: (connectionId) =>
    set((state) => {
      const newTablesByConnection = { ...state.tablesByConnection };
      delete newTablesByConnection[connectionId];
      return { tablesByConnection: newTablesByConnection };
    }),

  setTableSchema: (tableSchema) => set({ tableSchema }),

  setExecuting: (isExecuting) => set({ isExecuting }),

  setError: (error) => set({ error, isExecuting: false }),

  renameTableInTabs: (connectionId, oldName, newName) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.connectionId === connectionId && tab.tableName === oldName) {
          // If the table name includes a schema, we should preserve it or handle it
          // For now, let's assume if it had a schema, it still does but the table part changed
          let updatedName = newName;
          if (oldName.includes(".") && !newName.includes(".")) {
            const schema = oldName.split(".")[0];
            updatedName = `${schema}.${newName}`;
          }

          return {
            ...tab,
            tableName: updatedName,
            title: tab.type === "properties"
              ? `${newName} Properties`
              : tab.type === "diagram"
              ? `${newName} Diagram`
              : newName,
          };
        }
        return tab;
      }),
    })),

  addQueryToHistory: (entry, detectDuplicates = true) =>
    set((state) => {
      const connectionHistory = state.queryHistory[entry.connectionId] || [];
      const maxItems = state.historySettings.maxHistoryItems;

      // Check for duplicates if enabled - mark the entry if it's a duplicate of a recent query
      let finalEntry = { ...entry };
      if (detectDuplicates) {
        const normalizedNewSql = normalizeSql(entry.sql);
        // Check last 10 entries for duplicates
        const recentDuplicate = connectionHistory.slice(0, 10).find(
          (h) => normalizeSql(h.sql) === normalizedNewSql
        );
        if (recentDuplicate) {
          // Still add it, but it's useful to know it's a duplicate for filtering
          finalEntry = { ...entry };
        }
      }

      // Add new entry to the beginning and limit to maxItems
      // Keep favorites even if they would be trimmed
      const favorites = connectionHistory.filter(h => h.isFavorite);

      // Combine: new entry + old entries, but keep all favorites
      const combined = [finalEntry, ...connectionHistory];
      const limitedNonFavorites = combined.filter(h => !h.isFavorite).slice(0, maxItems);
      const updatedHistory = [...favorites.filter(f => !limitedNonFavorites.some(n => n.id === f.id)), ...limitedNonFavorites]
        .sort((a, b) => b.executedAt - a.executedAt);

      return {
        queryHistory: {
          ...state.queryHistory,
          [entry.connectionId]: updatedHistory,
        },
      };
    }),

  clearHistoryForConnection: (connectionId) =>
    set((state) => {
      const newHistory = { ...state.queryHistory };
      delete newHistory[connectionId];
      return { queryHistory: newHistory };
    }),

  toggleFavorite: (connectionId, entryId) =>
    set((state) => {
      const connectionHistory = state.queryHistory[connectionId] || [];
      const updatedHistory = connectionHistory.map((entry) =>
        entry.id === entryId
          ? { ...entry, isFavorite: !entry.isFavorite }
          : entry
      );
      return {
        queryHistory: {
          ...state.queryHistory,
          [connectionId]: updatedHistory,
        },
      };
    }),

  deleteHistoryEntry: (connectionId, entryId) =>
    set((state) => {
      const connectionHistory = state.queryHistory[connectionId] || [];
      const updatedHistory = connectionHistory.filter((entry) => entry.id !== entryId);
      return {
        queryHistory: {
          ...state.queryHistory,
          [connectionId]: updatedHistory,
        },
      };
    }),

  updateHistorySettings: (settings) =>
    set((state) => ({
      historySettings: { ...state.historySettings, ...settings },
    })),

  cleanupOldHistory: () =>
    set((state) => {
      if (!state.historySettings.autoCleanupEnabled) {
        return state;
      }

      const maxDays = state.historySettings.maxDaysOld;
      const cutoffTime = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      const maxItems = state.historySettings.maxHistoryItems;

      const newHistory: Record<string, QueryHistoryEntry[]> = {};

      for (const [connectionId, entries] of Object.entries(state.queryHistory)) {
        // Filter out old entries but keep favorites
        const filtered = entries.filter(
          (entry) => entry.isFavorite || entry.executedAt > cutoffTime
        );
        // Then apply max items limit (keeping favorites)
        const favorites = filtered.filter((e) => e.isFavorite);
        const nonFavorites = filtered.filter((e) => !e.isFavorite).slice(0, maxItems);
        newHistory[connectionId] = [...favorites, ...nonFavorites].sort(
          (a, b) => b.executedAt - a.executedAt
        );
      }

      return { queryHistory: newHistory };
    }),

  getHistoryStats: (connectionId) => {
    const state = get();
    const entries = state.queryHistory[connectionId] || [];

    const successfulQueries = entries.filter((e) => e.success).length;
    const failedQueries = entries.filter((e) => !e.success).length;
    const executionTimes = entries
      .filter((e) => e.executionTimeMs !== undefined)
      .map((e) => e.executionTimeMs!);
    const totalExecutionTime = executionTimes.reduce((sum, t) => sum + t, 0);
    const averageExecutionTime = executionTimes.length > 0
      ? totalExecutionTime / executionTimes.length
      : 0;
    const favoriteCount = entries.filter((e) => e.isFavorite).length;

    return {
      totalQueries: entries.length,
      successfulQueries,
      failedQueries,
      averageExecutionTime,
      totalExecutionTime,
      favoriteCount,
    };
  },

  exportHistory: (connectionId, format) => {
    const state = get();
    const entries = state.queryHistory[connectionId] || [];

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = ['ID', 'SQL', 'Executed At', 'Execution Time (ms)', 'Row Count', 'Success', 'Error', 'Favorite'];
    const rows = entries.map((e) => [
      e.id,
      `"${e.sql.replace(/"/g, '""')}"`,
      new Date(e.executedAt).toISOString(),
      e.executionTimeMs?.toString() ?? '',
      e.rowCount?.toString() ?? '',
      e.success.toString(),
      e.error ? `"${e.error.replace(/"/g, '""')}"` : '',
      (e.isFavorite ?? false).toString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
    }),
    {
      name: "query-store",
      partialize: (state) => ({
        queryHistory: state.queryHistory,
        historySettings: state.historySettings,
      }),
    }
  )
);

// Selectors
export const selectActiveTab = (state: QueryState) =>
  state.tabs.find((t) => t.id === state.activeTabId) ?? null;

export const selectActiveResults = (state: QueryState) =>
  state.activeTabId ? state.results[state.activeTabId] : null;

