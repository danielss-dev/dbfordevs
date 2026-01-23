import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  SchemaObjectType,
  SchemaSearchResult,
  SchemaCacheEntry,
} from "@/types/schema-search";

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

interface SchemaSearchState {
  /** Whether the search popover is open */
  isOpen: boolean;
  /** Current search query */
  query: string;
  /** Search results */
  results: SchemaSearchResult[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Enabled object type filters */
  enabledFilters: SchemaObjectType[];
  /** Currently selected result index for keyboard navigation */
  selectedIndex: number;
  /** Cached schema data per connection */
  schemaCache: Record<string, SchemaCacheEntry>;

  // Actions
  setOpen: (isOpen: boolean) => void;
  setQuery: (query: string) => void;
  setResults: (results: SchemaSearchResult[]) => void;
  setSearching: (isSearching: boolean) => void;
  toggleFilter: (filter: SchemaObjectType) => void;
  setEnabledFilters: (filters: SchemaObjectType[]) => void;
  resetFilters: (filterOrder?: SchemaObjectType[]) => void;
  selectAll: (filterOrder?: SchemaObjectType[]) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  setSelectedIndex: (index: number) => void;
  updateSchemaCache: (connectionId: string, items: SchemaSearchResult[]) => void;
  clearSchemaCache: (connectionId?: string) => void;
  isCacheValid: (connectionId: string) => boolean;
  getFromCache: (connectionId: string) => SchemaSearchResult[] | null;
  reset: () => void;
}

/** All available schema object types */
const ALL_OBJECT_TYPES: SchemaObjectType[] = [
  "table",
  "column",
  "view",
  "index",
  "procedure",
  "function",
  "trigger",
  "sequence",
  // Redis
  "redis-key",
  // MongoDB
  "mongo-database",
  "mongo-collection",
  "mongo-index",
  // Cassandra
  "cassandra-keyspace",
  "cassandra-table",
  "cassandra-column",
  "cassandra-index",
];

const initialState = {
  isOpen: false,
  query: "",
  results: [],
  isSearching: false,
  enabledFilters: [...ALL_OBJECT_TYPES],
  selectedIndex: 0,
  schemaCache: {},
};

export const useSchemaSearchStore = create<SchemaSearchState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setOpen: (isOpen) => {
        set({ isOpen });
        // Reset selected index when opening
        if (isOpen) {
          set({ selectedIndex: 0 });
        }
      },

      setQuery: (query) => set({ query, selectedIndex: 0 }),

      setResults: (results) => set({ results, selectedIndex: 0 }),

      setSearching: (isSearching) => set({ isSearching }),

      toggleFilter: (filter) =>
        set((state) => {
          const isEnabled = state.enabledFilters.includes(filter);
          if (isEnabled) {
            // Don't allow removing the last filter
            if (state.enabledFilters.length === 1) return state;
            return {
              enabledFilters: state.enabledFilters.filter((f) => f !== filter),
            };
          } else {
            return {
              enabledFilters: [...state.enabledFilters, filter],
            };
          }
        }),

      setEnabledFilters: (filters) =>
        set({
          enabledFilters: filters.length > 0 ? filters : [...ALL_OBJECT_TYPES],
        }),

      resetFilters: (filterOrder) => set((state) => {
        const types = filterOrder || ALL_OBJECT_TYPES;
        // When resetting, enable all filters from the given order
        // while preserving any other enabled filters from different database types
        const otherFilters = state.enabledFilters.filter(f => !types.includes(f));
        return { enabledFilters: [...otherFilters, ...types] };
      }),

      selectAll: (filterOrder) => set((state) => {
        const types = filterOrder || ALL_OBJECT_TYPES;
        // When selecting all, add all filters from the given order
        // while preserving any other enabled filters from different database types
        const otherFilters = state.enabledFilters.filter(f => !types.includes(f));
        return { enabledFilters: [...otherFilters, ...types] };
      }),

      selectNext: () =>
        set((state) => ({
          selectedIndex: Math.min(
            state.selectedIndex + 1,
            state.results.length - 1
          ),
        })),

      selectPrevious: () =>
        set((state) => ({
          selectedIndex: Math.max(state.selectedIndex - 1, 0),
        })),

      setSelectedIndex: (index) => set({ selectedIndex: index }),

      updateSchemaCache: (connectionId, items) =>
        set((state) => ({
          schemaCache: {
            ...state.schemaCache,
            [connectionId]: {
              connectionId,
              lastUpdated: Date.now(),
              items,
            },
          },
        })),

      clearSchemaCache: (connectionId) =>
        set((state) => {
          if (connectionId) {
            const { [connectionId]: _, ...rest } = state.schemaCache;
            return { schemaCache: rest };
          }
          return { schemaCache: {} };
        }),

      isCacheValid: (connectionId) => {
        const cache = get().schemaCache[connectionId];
        if (!cache) return false;
        return Date.now() - cache.lastUpdated < CACHE_TTL;
      },

      getFromCache: (connectionId) => {
        const cache = get().schemaCache[connectionId];
        if (!cache || Date.now() - cache.lastUpdated >= CACHE_TTL) {
          return null;
        }
        return cache.items;
      },

      reset: () =>
        set({
          ...initialState,
          // Keep persisted data
          enabledFilters: get().enabledFilters,
        }),
    }),
    {
      name: "dbfordevs-schema-search",
      partialize: (state) => ({
        enabledFilters: state.enabledFilters,
      }),
    }
  )
);

/** Selector for getting the currently selected result */
export const selectSelectedResult = (
  state: SchemaSearchState
): SchemaSearchResult | null => {
  if (state.results.length === 0) return null;
  return state.results[state.selectedIndex] ?? null;
};
