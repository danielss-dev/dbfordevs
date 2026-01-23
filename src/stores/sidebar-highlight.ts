import { create } from "zustand";

interface SidebarHighlightState {
  // Highlighted table per connection (for SQL databases)
  highlightedTableByConnection: Record<string, {
    schema?: string;
    table: string;
  } | null>;

  // Actions
  setHighlightedTable: (connectionId: string, item: { schema?: string; table: string } | null) => void;
  clearHighlightedTable: (connectionId: string) => void;
}

export const useSidebarHighlightStore = create<SidebarHighlightState>()((set) => ({
  highlightedTableByConnection: {},

  setHighlightedTable: (connectionId, item) =>
    set((state) => ({
      highlightedTableByConnection: {
        ...state.highlightedTableByConnection,
        [connectionId]: item,
      },
    })),

  clearHighlightedTable: (connectionId) =>
    set((state) => ({
      highlightedTableByConnection: {
        ...state.highlightedTableByConnection,
        [connectionId]: null,
      },
    })),
}));
