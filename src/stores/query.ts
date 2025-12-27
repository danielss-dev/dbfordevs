import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueryResult, Tab, TableInfo, TableSchema, QueryHistoryEntry } from "@/types";

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

  // Actions
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTabContent: (id: string, content: string) => void;
  setResults: (tabId: string, results: QueryResult) => void;
  clearResults: (tabId: string) => void;
  setTablesForConnection: (connectionId: string, tables: TableInfo[]) => void;
  clearTablesForConnection: (connectionId: string) => void;
  setTableSchema: (schema: TableSchema | null) => void;
  setExecuting: (executing: boolean) => void;
  setError: (error: string | null) => void;
  renameTableInTabs: (connectionId: string, oldName: string, newName: string) => void;
  addQueryToHistory: (entry: QueryHistoryEntry) => void;
  clearHistoryForConnection: (connectionId: string) => void;
}

export const useQueryStore = create<QueryState>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,
      results: {},
      tablesByConnection: {},
      tableSchema: null,
      isExecuting: false,
      error: null,
      queryHistory: {},

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

  addQueryToHistory: (entry) =>
    set((state) => {
      const connectionHistory = state.queryHistory[entry.connectionId] || [];
      // Add new entry to the beginning and limit to 50 entries
      const updatedHistory = [entry, ...connectionHistory].slice(0, 50);
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
    }),
    {
      name: "query-store",
      partialize: (state) => ({
        queryHistory: state.queryHistory,
      }),
    }
  )
);

// Selectors
export const selectActiveTab = (state: QueryState) =>
  state.tabs.find((t) => t.id === state.activeTabId) ?? null;

export const selectActiveResults = (state: QueryState) =>
  state.activeTabId ? state.results[state.activeTabId] : null;

