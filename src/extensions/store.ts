/**
 * Extension Store
 *
 * Zustand store for managing extension state.
 * Handles local state for extensions with fallback when backend isn't available.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ExtensionSettings,
  ExtensionStatus,
  AIChatMessage,
  TableInfo,
} from "./types";
import * as api from "./api";

// ============================================================================
// Available Extensions Catalog
// These are all extensions that can be installed
// ============================================================================

export interface MarketplaceExtension {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: "validator" | "ai" | "exporter" | "theme" | "connector";
  isOfficial: boolean;
  isFeatured?: boolean;
  downloads: string;
  rating: number;
  repository?: string;
  icon?: string;
}

export const EXTENSION_CATALOG: MarketplaceExtension[] = [
  // Theme Extensions
  {
    id: "nordic-dark",
    name: "Nordic Dark",
    description: "An arctic, north-bluish dark theme inspired by the Nordic wilderness. Features Polar Night backgrounds and Frost accents.",
    version: "1.0.0",
    author: "dbfordevs",
    category: "theme",
    isOfficial: true,
    isFeatured: true,
    downloads: "2.1k",
    rating: 4.9,
  },
  {
    id: "nordic-light",
    name: "Nordic Light",
    description: "A light variant of the Nordic theme with Snow Storm backgrounds and aurora accent colors.",
    version: "1.0.0",
    author: "dbfordevs",
    category: "theme",
    isOfficial: true,
    downloads: "1.8k",
    rating: 4.8,
  },
  // AI Extensions
  {
    id: "ai-assistant",
    name: "AI Query Assistant",
    description: "Generate SQL from natural language, optimize slow queries, and get intelligent explanations. Powered by Claude.",
    version: "2.0.1",
    author: "dbfordevs",
    category: "ai",
    isOfficial: true,
    isFeatured: true,
    downloads: "5.4k",
    rating: 5.0,
  },
  // Validator Extensions (for future)
  {
    id: "validator-csharp",
    name: "C# / .NET Validator",
    description: "Validate ADO.NET connection strings for SQL Server, PostgreSQL, and MySQL.",
    version: "1.0.2",
    author: "dbfordevs",
    category: "validator",
    isOfficial: true,
    downloads: "1.2k",
    rating: 4.8,
  },
  {
    id: "validator-nodejs",
    name: "Node.js Validator",
    description: "Support for pg, mysql2, and mssql connection string formats (URL and JSON).",
    version: "1.1.0",
    author: "dbfordevs",
    category: "validator",
    isOfficial: true,
    downloads: "2.5k",
    rating: 4.9,
  },
  {
    id: "validator-python",
    name: "Python Validator",
    description: "SQLAlchemy, psycopg2, and PyMySQL connection URL validation.",
    version: "1.0.5",
    author: "dbfordevs",
    category: "validator",
    isOfficial: true,
    downloads: "800",
    rating: 4.7,
  },
];

// ============================================================================
// Extension Store Types
// ============================================================================

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

interface ExtensionState {
  // Installed extensions (persisted)
  installedExtensions: InstalledExtension[];
  
  // Loading state
  isLoading: boolean;
  error: string | null;

  // Extension settings
  settings: ExtensionSettings;

  // AI Assistant state
  aiPanelOpen: boolean;
  aiMessages: AIChatMessage[];
  aiIsLoading: boolean;
  aiContext: {
    databaseType?: string;
    databaseName?: string;
    schemaName?: string;
    tables: TableInfo[];
    selectedTable?: string;
  };

  // Extension actions
  installExtension: (extensionId: string) => Promise<void>;
  uninstallExtension: (extensionId: string) => Promise<void>;
  enableExtension: (extensionId: string) => void;
  disableExtension: (extensionId: string) => void;
  isInstalled: (extensionId: string) => boolean;
  isEnabled: (extensionId: string) => boolean;
  getExtension: (extensionId: string) => InstalledExtension | undefined;
  
  // Legacy compatibility
  loadExtensions: () => Promise<void>;
  installFromGitHub: (repoUrl: string) => Promise<void>;

  // Settings actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<ExtensionSettings>) => Promise<void>;
  setAiApiKey: (key: string) => Promise<void>;

  // AI Panel actions
  setAIPanelOpen: (open: boolean) => void;
  toggleAIPanel: () => void;
  sendAIMessage: (message: string) => Promise<void>;
  clearAIMessages: () => void;
  setAIContext: (context: Partial<ExtensionState["aiContext"]>) => void;
}

// ============================================================================
// Extension Store
// ============================================================================

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      installedExtensions: [],
      isLoading: false,
      error: null,
      settings: {
        aiProvider: "anthropic",
      },
      aiPanelOpen: false,
      aiMessages: [],
      aiIsLoading: false,
      aiContext: {
        tables: [],
      },

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

          // If it's a theme extension, activate it and update UI theme
          if (catalog.category === "theme") {
            Promise.all([
              import("./themes"),
              import("@/stores/ui")
            ]).then(([{ useThemeStore }, { useUIStore }]) => {
              // Activate theme CSS
              useThemeStore.getState().activateTheme(catalog.id);
              // Update UI store so dropdown shows the theme as selected
              useUIStore.getState().setTheme(`ext:${catalog.id}` as "light" | "dark" | "system" | `ext:${string}`);
            });
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
          // If it's a theme, always deactivate it and reset UI theme
          if (ext?.category === "theme") {
            const { useThemeStore } = await import("./themes");
            const themeStore = useThemeStore.getState();
            // Deactivate theme CSS
            if (themeStore.activeThemeId === extensionId) {
              themeStore.activateTheme(null);
            }
            
            // Also reset UI store theme if it was using this extension
            const { useUIStore } = await import("@/stores/ui");
            const uiStore = useUIStore.getState();
            if (uiStore.theme === `ext:${extensionId}`) {
              uiStore.setTheme("system");
            }
          }
          
          // If it's the AI extension, close the AI panel
          if (extensionId === "ai-assistant") {
            set({ aiPanelOpen: false });
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

        // If it's a theme extension, activate it and update UI theme
        if (ext?.category === "theme") {
          Promise.all([
            import("./themes"),
            import("@/stores/ui")
          ]).then(([{ useThemeStore }, { useUIStore }]) => {
            // Activate theme CSS
            useThemeStore.getState().activateTheme(extensionId);
            // Update UI store so dropdown shows the theme as selected
            useUIStore.getState().setTheme(`ext:${extensionId}` as "light" | "dark" | "system" | `ext:${string}`);
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

        // If it's a theme extension, deactivate it and reset UI theme
        if (ext?.category === "theme") {
          Promise.all([
            import("./themes"),
            import("@/stores/ui")
          ]).then(([{ useThemeStore }, { useUIStore }]) => {
            const themeStore = useThemeStore.getState();
            const uiStore = useUIStore.getState();
            
            // Deactivate theme CSS
            if (themeStore.activeThemeId === extensionId) {
              themeStore.activateTheme(null);
            }
            
            // Reset UI store theme if it was using this extension
            if (uiStore.theme === `ext:${extensionId}`) {
              uiStore.setTheme("system");
            }
          });
        }

        // If it's the AI extension, close the AI panel
        if (extensionId === "ai-assistant") {
          set({ aiPanelOpen: false });
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

      // Legacy: Load extensions (now just returns installed)
      loadExtensions: async () => {
        // Already loaded from persistence
        set({ isLoading: false });
      },

      // Install from GitHub (placeholder)
      installFromGitHub: async (repoUrl: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.installExtensionFromGitHub({ repositoryUrl: repoUrl });
          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to install extension",
            isLoading: false,
          });
        }
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

      // Set AI API key
      setAiApiKey: async (key: string) => {
        await get().updateSettings({ aiApiKey: key });
      },

      // AI Panel actions
      setAIPanelOpen: (open: boolean) => set({ aiPanelOpen: open }),
      
      toggleAIPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),

      // Send AI message
      sendAIMessage: async (message: string) => {
        const { aiContext, aiMessages } = get();

        const userMessage: AIChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          timestamp: new Date(),
        };

        set({
          aiMessages: [...aiMessages, userMessage],
          aiIsLoading: true,
        });

        try {
          const response = await api.aiChat({
            message,
            context: {
              prompt: message,
              databaseType: aiContext.databaseType,
              databaseName: aiContext.databaseName,
              schemaName: aiContext.schemaName,
              tables: aiContext.tables,
              selectedTable: aiContext.selectedTable,
            },
          });

          const assistantMessage: AIChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: response.message,
            sql: response.sql,
            timestamp: new Date(),
          };

          set((state) => ({
            aiMessages: [...state.aiMessages, assistantMessage],
            aiIsLoading: false,
          }));
        } catch (error) {
          const errorMessage: AIChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: error instanceof Error 
              ? `Error: ${error.message}` 
              : "An error occurred while processing your request.",
            timestamp: new Date(),
          };

          set((state) => ({
            aiMessages: [...state.aiMessages, errorMessage],
            aiIsLoading: false,
          }));
        }
      },

      clearAIMessages: () => set({ aiMessages: [] }),

      setAIContext: (context) =>
        set((state) => ({
          aiContext: { ...state.aiContext, ...context },
        })),
    }),
    {
      name: "dbfordevs-extensions",
      partialize: (state) => ({
        installedExtensions: state.installedExtensions,
        settings: state.settings,
        aiMessages: state.aiMessages.slice(-50),
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectInstalledExtensions = (state: ExtensionState) => 
  state.installedExtensions;

export const selectEnabledExtensions = (state: ExtensionState) =>
  state.installedExtensions.filter((e) => e.status === "active");

export const selectExtensionsByCategory = (category: string) => (state: ExtensionState) =>
  state.installedExtensions.filter((e) => e.category === category);
