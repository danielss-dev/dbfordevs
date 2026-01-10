import { create } from "zustand";
import type { ExplainResult } from "@/types";
import { useUIStore } from "./ui";

interface ExplainState {
  isExplainOpen: boolean;
  isExplainLoading: boolean;
  explainResult: ExplainResult | null;
  explainSql: string | null;
  explainConnectionId: string | null;
  isAnalyzeMode: boolean;
  error: string | null;

  // Actions
  openExplain: (sql: string, connectionId: string, analyze?: boolean) => void;
  setExplainResult: (result: ExplainResult | null) => void;
  setExplainLoading: (loading: boolean) => void;
  setExplainError: (error: string | null) => void;
  closeExplain: () => void;
  toggleAnalyzeMode: () => void;
}

export const useExplainStore = create<ExplainState>()((set) => ({
  isExplainOpen: false,
  isExplainLoading: false,
  explainResult: null,
  explainSql: null,
  explainConnectionId: null,
  isAnalyzeMode: false,
  error: null,

  openExplain: (sql, connectionId, analyze = false) => {
    // Open the Explain panel
    useUIStore.getState().setRightPanelTab("explain");
    set({
      isExplainOpen: true,
      explainSql: sql,
      explainConnectionId: connectionId,
      explainResult: null,
      isExplainLoading: true,
      isAnalyzeMode: analyze,
      error: null,
    });
  },

  setExplainResult: (result) =>
    set({ explainResult: result, isExplainLoading: false }),

  setExplainLoading: (loading) =>
    set({ isExplainLoading: loading }),

  setExplainError: (error) =>
    set({ error, isExplainLoading: false }),

  closeExplain: () =>
    set({
      isExplainOpen: false,
      explainResult: null,
      explainSql: null,
      explainConnectionId: null,
      isExplainLoading: false,
      error: null,
    }),

  toggleAnalyzeMode: () =>
    set((state) => ({ isAnalyzeMode: !state.isAnalyzeMode })),
}));
