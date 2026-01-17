import { create } from "zustand";
import type { TriggerInfo } from "@/types";

interface TriggersState {
  // Data by connection
  triggersByConnection: Record<string, TriggerInfo[]>;

  // Loading state
  loading: boolean;

  // Error state
  error: string | null;

  // Selection state
  selectedTrigger: TriggerInfo | null;

  // Actions - Data setters
  setTriggers: (connectionId: string, triggers: TriggerInfo[]) => void;

  // Actions - Clear data
  clearTriggersForConnection: (connectionId: string) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Selection
  setSelectedTrigger: (trigger: TriggerInfo | null) => void;
}

export const useTriggersStore = create<TriggersState>()((set) => ({
  // Initial state
  triggersByConnection: {},
  loading: false,
  error: null,
  selectedTrigger: null,

  // Data setters
  setTriggers: (connectionId, triggers) =>
    set((state) => ({
      triggersByConnection: {
        ...state.triggersByConnection,
        [connectionId]: triggers,
      },
    })),

  // Clear data
  clearTriggersForConnection: (connectionId) =>
    set((state) => {
      const newTriggers = { ...state.triggersByConnection };
      delete newTriggers[connectionId];
      return { triggersByConnection: newTriggers };
    }),

  // Loading state
  setLoading: (loading) => set({ loading }),

  // Error state
  setError: (error) => set({ error }),

  // Selection
  setSelectedTrigger: (selectedTrigger) => set({ selectedTrigger }),
}));
