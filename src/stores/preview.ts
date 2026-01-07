import { create } from "zustand";
import type { PreviewResult } from "@/types";
import { useUIStore } from "./ui";

interface PreviewState {
  isPreviewOpen: boolean;
  isPreviewLoading: boolean;
  previewResult: PreviewResult | null;
  previewSql: string | null;
  previewConnectionId: string | null;

  // Actions
  openPreview: (sql: string, connectionId: string) => void;
  setPreviewResult: (result: PreviewResult | null) => void;
  setPreviewLoading: (loading: boolean) => void;
  closePreview: () => void;
}

export const usePreviewStore = create<PreviewState>()((set) => ({
  isPreviewOpen: false,
  isPreviewLoading: false,
  previewResult: null,
  previewSql: null,
  previewConnectionId: null,

  openPreview: (sql, connectionId) => {
    // Open the Query Preview panel
    useUIStore.getState().setRightPanelTab("preview");
    set({
      isPreviewOpen: true,
      previewSql: sql,
      previewConnectionId: connectionId,
      previewResult: null,
      isPreviewLoading: true,
    });
  },

  setPreviewResult: (result) =>
    set({ previewResult: result, isPreviewLoading: false }),

  setPreviewLoading: (loading) =>
    set({ isPreviewLoading: loading }),

  closePreview: () =>
    set({
      isPreviewOpen: false,
      previewResult: null,
      previewSql: null,
      previewConnectionId: null,
      isPreviewLoading: false,
    }),
}));
