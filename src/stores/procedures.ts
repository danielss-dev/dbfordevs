import { create } from "zustand";
import type { ProcedureInfo } from "@/types";

interface ProceduresState {
  // Data by connection
  proceduresByConnection: Record<string, ProcedureInfo[]>;

  // Loading state
  loading: boolean;

  // Error state
  error: string | null;

  // Selection state
  selectedProcedure: ProcedureInfo | null;

  // Actions - Data setters
  setProcedures: (connectionId: string, procedures: ProcedureInfo[]) => void;

  // Actions - Clear data
  clearProceduresForConnection: (connectionId: string) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Selection
  setSelectedProcedure: (procedure: ProcedureInfo | null) => void;
}

export const useProceduresStore = create<ProceduresState>()((set) => ({
  // Initial state
  proceduresByConnection: {},
  loading: false,
  error: null,
  selectedProcedure: null,

  // Data setters
  setProcedures: (connectionId, procedures) =>
    set((state) => ({
      proceduresByConnection: {
        ...state.proceduresByConnection,
        [connectionId]: procedures,
      },
    })),

  // Clear data
  clearProceduresForConnection: (connectionId) =>
    set((state) => {
      const newProcedures = { ...state.proceduresByConnection };
      delete newProcedures[connectionId];
      return { proceduresByConnection: newProcedures };
    }),

  // Loading state
  setLoading: (loading) => set({ loading }),

  // Error state
  setError: (error) => set({ error }),

  // Selection
  setSelectedProcedure: (selectedProcedure) => set({ selectedProcedure }),
}));
