import { useEffect, useRef, useCallback } from "react";
import { useUpdaterStore } from "@/stores/updater";
import { useUIStore } from "@/stores/ui";

export type { UpdaterState } from "@/stores/updater";

export function useUpdater() {
  const {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    currentVersion,
    newVersion,
    dismissed,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  } = useUpdaterStore();

  const { generalSettings } = useUIStore();
  const hasCheckedRef = useRef(false);

  // Memoize checkForUpdates to avoid stale closure issues
  const stableCheckForUpdates = useCallback(() => {
    return checkForUpdates();
  }, [checkForUpdates]);

  // Check for updates on mount if setting is enabled (with a delay to not block app startup)
  // Skip in development mode since Tauri updater doesn't work in dev
  useEffect(() => {
    // Skip in development mode
    if (import.meta.env.DEV) {
      return;
    }

    if (!generalSettings.checkUpdatesOnStartup) {
      return;
    }

    // Prevent multiple checks in StrictMode or re-renders
    if (hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;

    const timer = setTimeout(() => {
      stableCheckForUpdates().catch((err) => {
        console.error("Failed to check for updates on startup:", err);
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [generalSettings.checkUpdatesOnStartup, stableCheckForUpdates]);

  return {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    currentVersion,
    newVersion,
    dismissed,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}
