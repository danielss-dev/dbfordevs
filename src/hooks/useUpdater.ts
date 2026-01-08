import { useState, useEffect, useCallback } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  update: Update | null;
  currentVersion: string | null;
  newVersion: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({
    checking: false,
    available: false,
    downloading: false,
    progress: 0,
    error: null,
    update: null,
    currentVersion: null,
    newVersion: null,
  });

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));

    try {
      const update = await check();

      if (update) {
        setState((prev) => ({
          ...prev,
          checking: false,
          available: true,
          update,
          currentVersion: update.currentVersion,
          newVersion: update.version,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          checking: false,
          available: false,
        }));
        return false;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check for updates";
      setState((prev) => ({
        ...prev,
        checking: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!state.update) return;

    setState((prev) => ({ ...prev, downloading: true, progress: 0 }));

    try {
      let downloadedBytes = 0;
      let totalBytes = 0;

      await state.update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              setState((prev) => ({ ...prev, progress }));
            }
            break;
          case "Finished":
            setState((prev) => ({ ...prev, progress: 100 }));
            break;
        }
      });

      // Relaunch the app after installation
      await relaunch();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to download and install update";
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: errorMessage,
      }));
    }
  }, [state.update]);

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      available: false,
      update: null,
      newVersion: null,
    }));
  }, []);

  // Check for updates on mount (with a delay to not block app startup)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}
