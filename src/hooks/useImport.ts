import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ImportPreviewRequest,
  ImportPreviewResult,
  ImportRequest,
  ImportResult,
  ImportProgress,
} from "@/types/import";

/**
 * Hook for data import operations via Tauri commands
 */
export function useImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen to progress events from backend
  useEffect(() => {
    const unlistenPromise = listen<ImportProgress>("import-progress", (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  /**
   * Preview import data - detects columns and returns sample rows
   */
  const previewImport = useCallback(
    async (request: ImportPreviewRequest): Promise<ImportPreviewResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<ImportPreviewResult>("preview_import", {
          request,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Execute data import with progress tracking
   */
  const executeImport = useCallback(
    async (request: ImportRequest): Promise<ImportResult | null> => {
      setIsLoading(true);
      setError(null);
      setProgress(null);

      try {
        const result = await invoke<ImportResult>("execute_import", {
          request,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Cancel an ongoing import
   */
  const cancelImport = useCallback(async (importId: string): Promise<boolean> => {
    try {
      return await invoke<boolean>("cancel_import", { importId });
    } catch {
      return false;
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset progress state
   */
  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    previewImport,
    executeImport,
    cancelImport,
    isLoading,
    progress,
    error,
    clearError,
    resetProgress,
  };
}
