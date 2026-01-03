import { create } from "zustand";
import type { PreviewResult } from "@/types";

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

  openPreview: (sql, connectionId) =>
    set({
      isPreviewOpen: true,
      previewSql: sql,
      previewConnectionId: connectionId,
      previewResult: null,
      isPreviewLoading: true,
    }),

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
