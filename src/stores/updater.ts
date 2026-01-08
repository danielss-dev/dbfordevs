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

    set({ downloading: true, progress: 0 });

    try {
      let downloadedBytes = 0;
      let totalBytes = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              const progress = Math.round((downloadedBytes / totalBytes) * 100);
              set({ progress });
            }
            break;
          case "Finished":
            set({ progress: 100 });
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
