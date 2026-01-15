import { create } from "zustand";
import type { ViewInfo } from "@/types";

interface ViewsState {
  // Data by connection
  viewsByConnection: Record<string, ViewInfo[]>;

  // Loading state
  loading: boolean;

  // Error state
  error: string | null;

  // Selection state
  selectedView: ViewInfo | null;

  // Actions - Data setters
  setViews: (connectionId: string, views: ViewInfo[]) => void;

  // Actions - Clear data
  clearViewsForConnection: (connectionId: string) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Selection
  setSelectedView: (view: ViewInfo | null) => void;
}

export const useViewsStore = create<ViewsState>()((set) => ({
  // Initial state
  viewsByConnection: {},
  loading: false,
  error: null,
  selectedView: null,

  // Data setters
  setViews: (connectionId, views) =>
    set((state) => ({
      viewsByConnection: {
        ...state.viewsByConnection,
        [connectionId]: views,
      },
    })),

  // Clear data
  clearViewsForConnection: (connectionId) =>
    set((state) => {
      const newViews = { ...state.viewsByConnection };
      delete newViews[connectionId];
      return { viewsByConnection: newViews };
    }),

  // Loading state
  setLoading: (loading) => set({ loading }),

  // Error state
  setError: (error) => set({ error }),

  // Selection
  setSelectedView: (selectedView) => set({ selectedView }),
}));
