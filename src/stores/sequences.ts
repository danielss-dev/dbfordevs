import { create } from "zustand";
import type { SequenceInfo } from "@/types";

interface SequencesState {
  // Data by connection
  sequencesByConnection: Record<string, SequenceInfo[]>;

  // Loading state
  loading: boolean;

  // Error state
  error: string | null;

  // Selection state
  selectedSequence: SequenceInfo | null;

  // Actions - Data setters
  setSequences: (connectionId: string, sequences: SequenceInfo[]) => void;

  // Actions - Clear data
  clearSequencesForConnection: (connectionId: string) => void;

  // Actions - Loading state
  setLoading: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Selection
  setSelectedSequence: (sequence: SequenceInfo | null) => void;
}

export const useSequencesStore = create<SequencesState>()((set) => ({
  // Initial state
  sequencesByConnection: {},
  loading: false,
  error: null,
  selectedSequence: null,

  // Data setters
  setSequences: (connectionId, sequences) =>
    set((state) => ({
      sequencesByConnection: {
        ...state.sequencesByConnection,
        [connectionId]: sequences,
      },
    })),

  // Clear data
  clearSequencesForConnection: (connectionId) =>
    set((state) => {
      const newSequences = { ...state.sequencesByConnection };
      delete newSequences[connectionId];
      return { sequencesByConnection: newSequences };
    }),

  // Loading state
  setLoading: (loading) => set({ loading }),

  // Error state
  setError: (error) => set({ error }),

  // Selection
  setSelectedSequence: (selectedSequence) => set({ selectedSequence }),
}));
