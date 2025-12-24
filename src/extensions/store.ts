/**
 * Extension Store
 *
 * Zustand store for managing extension state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ExtensionInfo,
  ExtensionSettings,
  AIChatMessage,
  TableInfo,
} from "./types";
import * as api from "./api";

interface ExtensionState {
  // Extension management
  extensions: ExtensionInfo[];
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

  // Actions
  loadExtensions: () => Promise<void>;
  enableExtension: (id: string) => Promise<void>;
  disableExtension: (id: string) => Promise<void>;
  uninstallExtension: (id: string) => Promise<void>;
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

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      extensions: [],
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

      // Load extensions from backend
      loadExtensions: async () => {
        set({ isLoading: true, error: null });
        try {
          const extensions = await api.listExtensions();
          set({ extensions, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to load extensions",
            isLoading: false,
          });
        }
      },

      // Enable extension
      enableExtension: async (id: string) => {
        try {
          await api.enableExtension(id);
          await get().loadExtensions();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to enable extension",
          });
        }
      },

      // Disable extension
      disableExtension: async (id: string) => {
        try {
          await api.disableExtension(id);
          await get().loadExtensions();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to disable extension",
          });
        }
      },

      // Uninstall extension
      uninstallExtension: async (id: string) => {
        try {
          await api.uninstallExtension(id);
          await get().loadExtensions();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to uninstall extension",
          });
        }
      },

      // Install from GitHub
      installFromGitHub: async (repoUrl: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.installExtensionFromGitHub({ repositoryUrl: repoUrl });
          await get().loadExtensions();
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
        } catch (error) {
          console.error("Failed to load settings:", error);
        }
      },

      // Update settings
      updateSettings: async (newSettings: Partial<ExtensionSettings>) => {
        const current = get().settings;
        const updated = { ...current, ...newSettings };
        try {
          await api.updateExtensionSettings(updated);
          set({ settings: updated });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to update settings",
          });
        }
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

        // Add user message
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

          // Add assistant message
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
          // Add error message
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

      // Clear AI messages
      clearAIMessages: () => set({ aiMessages: [] }),

      // Set AI context
      setAIContext: (context) =>
        set((state) => ({
          aiContext: { ...state.aiContext, ...context },
        })),
    }),
    {
      name: "dbfordevs-extensions",
      partialize: (state) => ({
        settings: state.settings,
        aiMessages: state.aiMessages.slice(-50), // Keep last 50 messages
      }),
    }
  )
);

