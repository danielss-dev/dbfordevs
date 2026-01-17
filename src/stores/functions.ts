import { create } from "zustand";
import type { FunctionInfo } from "@/types";

interface FunctionsState {
  // Data by connection
  functionsByConnection: Record<string, FunctionInfo[]>;

  // Loading state
  loading: boolean;

  // Error state
  error: string | null;

  // Selection state
  selectedFunction: FunctionInfo | null;

  // Actions - Data setters
  setFunctions: (connectionId: string, functions: FunctionInfo[]) => void;

  // Actions - Clear data
  clearFunctionsForConnection: (connectionId: string) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Selection
  setSelectedFunction: (func: FunctionInfo | null) => void;
}

export const useFunctionsStore = create<FunctionsState>()((set) => ({
  // Initial state
  functionsByConnection: {},
  loading: false,
  error: null,
  selectedFunction: null,

  // Data setters
  setFunctions: (connectionId, functions) =>
    set((state) => ({
      functionsByConnection: {
        ...state.functionsByConnection,
        [connectionId]: functions,
      },
    })),

  // Clear data
  clearFunctionsForConnection: (connectionId) =>
    set((state) => {
      const newFunctions = { ...state.functionsByConnection };
      delete newFunctions[connectionId];
      return { functionsByConnection: newFunctions };
    }),

  // Loading state
  setLoading: (loading) => set({ loading }),

  // Error state
  setError: (error) => set({ error }),

  // Selection
  setSelectedFunction: (selectedFunction) => set({ selectedFunction }),
}));
