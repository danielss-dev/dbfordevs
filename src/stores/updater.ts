import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdaterState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  update: Update | null;
  currentVersion: string | null;
  newVersion: string | null;
  // Track if user dismissed the update notification (to not show toast again until next app start)
  dismissed: boolean;
}

interface UpdaterActions {
  checkForUpdates: () => Promise<boolean>;
  downloadAndInstall: () => Promise<void>;
  dismissUpdate: () => void;
  resetDismissed: () => void;
}

type UpdaterStore = UpdaterState & UpdaterActions;

export const useUpdaterStore = create<UpdaterStore>()((set, get) => ({
  checking: false,
  available: false,
  downloading: false,
  progress: 0,
  error: null,
  update: null,
  currentVersion: null,
  newVersion: null,
  dismissed: false,

  checkForUpdates: async () => {
    set({ checking: true, error: null });

    try {
      const update = await check();

      if (update) {
        set({
          checking: false,
          available: true,
          update,
          currentVersion: update.currentVersion,
          newVersion: update.version,
        });
        return true;
      } else {
        set({
          checking: false,
          available: false,
        });
        return false;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check for updates";
      set({
        checking: false,
        error: errorMessage,
      });
      return false;
    }
  },

  downloadAndInstall: async () => {
    const { update } = get();
    if (!update) return;

    set({ downloading: true, progress: 0, error: null });

    try {
      let downloadedBytes = 0;
      let totalBytes = 0;

      console.log("[Updater] Starting download and install...");

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            console.log(`[Updater] Download started, total size: ${totalBytes} bytes`);
            // If content length is unknown, show indeterminate progress
            if (totalBytes === 0) {
              set({ progress: -1 }); // -1 indicates indeterminate
            }
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              set({ progress });
            } else {
              // For indeterminate progress, keep it at -1 but log bytes downloaded
              console.log(`[Updater] Downloaded ${downloadedBytes} bytes (total unknown)`);
            }
            break;
          case "Finished":
            console.log("[Updater] Download finished, installing...");
            set({ progress: 100 });
            break;
        }
      });

      console.log("[Updater] Install complete, relaunching...");
      // Relaunch the app after installation
      await relaunch();
    } catch (error) {
      console.error("[Updater] Error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to download and install update";
      set({
        downloading: false,
        error: errorMessage,
      });
    }
  },

  dismissUpdate: () => {
    set({
      dismissed: true,
    });
  },

  resetDismissed: () => {
    set({ dismissed: false });
  },
}));
