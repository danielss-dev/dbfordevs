/**
 * Core Extension Store
 *
 * Zustand store for managing extension lifecycle.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ExtensionSettings,
  ExtensionStatus,
} from "./types";
import * as api from "./api";
import { EXTENSION_CATALOG } from "./catalog";

interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  isOfficial: boolean;
  status: ExtensionStatus;
  installedAt: string;
}

interface CoreExtensionState {
  // Installed extensions (persisted)
  installedExtensions: InstalledExtension[];
  
  // Loading state
  isLoading: boolean;
  error: string | null;

  // Extension settings (Generic)
  settings: ExtensionSettings;

  // Extension actions
  installExtension: (extensionId: string) => Promise<void>;
  uninstallExtension: (extensionId: string) => Promise<void>;
  enableExtension: (extensionId: string) => void;
  disableExtension: (extensionId: string) => void;
  isInstalled: (extensionId: string) => boolean;
  isEnabled: (extensionId: string) => boolean;
  getExtension: (extensionId: string) => InstalledExtension | undefined;
  
  // Settings actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<ExtensionSettings>) => Promise<void>;
}

export const useExtensionStore = create<CoreExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      installedExtensions: [],
      isLoading: false,
      error: null,
      settings: {},

      // Install an extension from the catalog
      installExtension: async (extensionId: string) => {
        const catalog = EXTENSION_CATALOG.find((e) => e.id === extensionId);
        if (!catalog) {
          set({ error: `Extension ${extensionId} not found in catalog` });
          return;
        }

        // Check if already installed
        if (get().isInstalled(extensionId)) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Try to call backend (may not be implemented yet)
          try {
            await api.enableExtension(extensionId);
          } catch {
            // Backend not available, continue with local install
          }

          const newExtension: InstalledExtension = {
            id: catalog.id,
            name: catalog.name,
            version: catalog.version,
            description: catalog.description,
            author: catalog.author,
            category: catalog.category,
            isOfficial: catalog.isOfficial,
            status: "active",
            installedAt: new Date().toISOString(),
          };

          set((state) => ({
            installedExtensions: [...state.installedExtensions, newExtension],
            isLoading: false,
          }));

          // Side effects for themes
          if (catalog.category === "theme") {
            const { useThemeStore } = await import("../themes/store");
            const { useUIStore } = await import("@/stores/ui");
            useThemeStore.getState().activateTheme(catalog.id);
            useUIStore.getState().setTheme(`ext:${catalog.id}` as any);
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to install extension",
            isLoading: false,
          });
        }
      },

      // Uninstall an extension
      uninstallExtension: async (extensionId: string) => {
        const ext = get().installedExtensions.find((e) => e.id === extensionId);
        set({ isLoading: true, error: null });

        try {
          // Theme cleanup
          if (ext?.category === "theme") {
            const { useThemeStore } = await import("../themes/store");
            const themeStore = useThemeStore.getState();
            if (themeStore.activeThemeId === extensionId) {
              themeStore.activateTheme(null);
            }
            
            const { useUIStore } = await import("@/stores/ui");
            const uiStore = useUIStore.getState();
            if (uiStore.theme === `ext:${extensionId}`) {
              uiStore.setTheme("system");
            }
          }

          // Try to call backend
          try {
            await api.uninstallExtension(extensionId);
          } catch {
            // Backend not available, continue with local uninstall
          }

          set((state) => ({
            installedExtensions: state.installedExtensions.filter(
              (e) => e.id !== extensionId
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to uninstall extension",
            isLoading: false,
          });
        }
      },

      // Enable an installed extension
      enableExtension: (extensionId: string) => {
        const ext = get().installedExtensions.find((e) => e.id === extensionId);
        
        set((state) => ({
          installedExtensions: state.installedExtensions.map((e) =>
            e.id === extensionId ? { ...e, status: "active" as ExtensionStatus } : e
          ),
        }));

        // Theme activation
        if (ext?.category === "theme") {
          Promise.all([
            import("../themes/store"),
            import("@/stores/ui")
          ]).then(([{ useThemeStore }, { useUIStore }]) => {
            useThemeStore.getState().activateTheme(extensionId);
            useUIStore.getState().setTheme(`ext:${extensionId}` as any);
          });
        }

        // Try backend call (fire and forget)
        api.enableExtension(extensionId).catch(() => {});
      },

      // Disable an installed extension
      disableExtension: (extensionId: string) => {
        const ext = get().installedExtensions.find((e) => e.id === extensionId);
        
        set((state) => ({
          installedExtensions: state.installedExtensions.map((e) =>
            e.id === extensionId ? { ...e, status: "disabled" as ExtensionStatus } : e
          ),
        }));

        // Theme deactivation
        if (ext?.category === "theme") {
          Promise.all([
            import("../themes/store"),
            import("@/stores/ui")
          ]).then(([{ useThemeStore }, { useUIStore }]) => {
            const themeStore = useThemeStore.getState();
            const uiStore = useUIStore.getState();
            if (themeStore.activeThemeId === extensionId) {
              themeStore.activateTheme(null);
            }
            if (uiStore.theme === `ext:${extensionId}`) {
              uiStore.setTheme("system");
            }
          });
        }

        // Try backend call (fire and forget)
        api.disableExtension(extensionId).catch(() => {});
      },

      // Check if extension is installed
      isInstalled: (extensionId: string) => {
        return get().installedExtensions.some((e) => e.id === extensionId);
      },

      // Check if extension is enabled
      isEnabled: (extensionId: string) => {
        const ext = get().installedExtensions.find((e) => e.id === extensionId);
        return ext?.status === "active";
      },

      // Get installed extension by ID
      getExtension: (extensionId: string) => {
        return get().installedExtensions.find((e) => e.id === extensionId);
      },

      // Load settings
      loadSettings: async () => {
        try {
          const settings = await api.getExtensionSettings();
          set({ settings });
        } catch {
          // Use default settings
        }
      },

      // Update settings
      updateSettings: async (newSettings: Partial<ExtensionSettings>) => {
        const current = get().settings;
        const updated = { ...current, ...newSettings };
        try {
          await api.updateExtensionSettings(updated);
        } catch {
          // Continue with local update
        }
        set({ settings: updated });
      },
    }),
    {
      name: "dbfordevs-extensions-core",
      partialize: (state) => ({
        installedExtensions: state.installedExtensions,
        settings: state.settings,
      }),
    }
  )
);

