import { create } from "zustand";
import type { QueryResult, Tab, TableInfo, TableSchema } from "@/types";

interface QueryState {
  // Open tabs
  tabs: Tab[];
  // Currently active tab
  activeTabId: string | null;
  // Query results per tab
  results: Record<string, QueryResult>;
  // Tables for current connection
  tables: TableInfo[];
  // Schema for selected table
  tableSchema: TableSchema | null;
  // Execution state
  isExecuting: boolean;
  // Error state
  error: string | null;

  // Actions
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTabContent: (id: string, content: string) => void;
  setResults: (tabId: string, results: QueryResult) => void;
  clearResults: (tabId: string) => void;
  setTables: (tables: TableInfo[]) => void;
  setTableSchema: (schema: TableSchema | null) => void;
  setExecuting: (executing: boolean) => void;
  setError: (error: string | null) => void;
}

export const useQueryStore = create<QueryState>()((set) => ({
  tabs: [],
  activeTabId: null,
  results: {},
  tables: [],
  tableSchema: null,
  isExecuting: false,
  error: null,

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
    })),

  clearResults: (tabId) =>
    set((state) => {
      const newResults = { ...state.results };
      delete newResults[tabId];
      return { results: newResults };
    }),

  setTables: (tables) => set({ tables }),

  setTableSchema: (tableSchema) => set({ tableSchema }),

  setExecuting: (isExecuting) => set({ isExecuting }),

  setError: (error) => set({ error }),
}));

// Selectors
export const selectActiveTab = (state: QueryState) =>
  state.tabs.find((t) => t.id === state.activeTabId) ?? null;

export const selectActiveResults = (state: QueryState) =>
  state.activeTabId ? state.results[state.activeTabId] : null;

