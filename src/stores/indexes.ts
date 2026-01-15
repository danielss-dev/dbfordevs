import { create } from "zustand";
import type { StandaloneIndexInfo } from "@/types";

interface IndexesState {
  // Data by connection
  indexesByConnection: Record<string, StandaloneIndexInfo[]>;

  // Loading state
  loading: boolean;

  // Error state
  error: string | null;

  // Selection state
  selectedIndex: StandaloneIndexInfo | null;

  // Actions - Data setters
  setIndexes: (connectionId: string, indexes: StandaloneIndexInfo[]) => void;

  // Actions - Clear data
  clearIndexesForConnection: (connectionId: string) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Selection
  setSelectedIndex: (index: StandaloneIndexInfo | null) => void;
}

export const useIndexesStore = create<IndexesState>()((set) => ({
  // Initial state
  indexesByConnection: {},
  loading: false,
  error: null,
  selectedIndex: null,

  // Data setters
  setIndexes: (connectionId, indexes) =>
    set((state) => ({
      indexesByConnection: {
        ...state.indexesByConnection,
        [connectionId]: indexes,
      },
    })),

  // Clear data
  clearIndexesForConnection: (connectionId) =>
    set((state) => {
      const newIndexes = { ...state.indexesByConnection };
      delete newIndexes[connectionId];
      return { indexesByConnection: newIndexes };
    }),

  // Loading state
  setLoading: (loading) => set({ loading }),

  // Error state
  setError: (error) => set({ error }),

  // Selection
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
}));
