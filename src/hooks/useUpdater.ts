import { useEffect } from "react";
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

  // Check for updates on mount if setting is enabled (with a delay to not block app startup)
  useEffect(() => {
    if (!generalSettings.checkUpdatesOnStartup) {
      return;
    }

    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => clearTimeout(timer);
  }, [generalSettings.checkUpdatesOnStartup, checkForUpdates]);

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
