/**
 * AI Assistant Store
 *
 * Zustand store for AI-specific state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AISettings,
  AIChatMessage,
  TableInfo,
} from "./types";
import * as api from "./api";
import * as coreApi from "../core/api";

interface AIState {
  // Settings
  settings: AISettings;

  // AI Panel state
  panelOpen: boolean;
  messages: AIChatMessage[];
  isLoading: boolean;
  context: {
    databaseType?: string;
    databaseName?: string;
    schemaName?: string;
    tables: TableInfo[];
    selectedTable?: string;
  };

  // Actions
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  setContext: (context: Partial<AIState["context"]>) => void;
  updateSettings: (settings: Partial<AISettings>) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: {
        aiProvider: "anthropic",
      },
      panelOpen: false,
      messages: [],
      isLoading: false,
      context: {
        tables: [],
      },

      // Panel actions
      setPanelOpen: (open: boolean) => set({ panelOpen: open }),
      
      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

      // Chat actions
      sendMessage: async (message: string) => {
        const { context, messages } = get();

        const userMessage: AIChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          timestamp: new Date(),
        };

        set({
          messages: [...messages, userMessage],
          isLoading: true,
        });

        try {
          const response = await api.aiChat({
            message,
            context: {
              prompt: message,
              databaseType: context.databaseType,
              databaseName: context.databaseName,
              schemaName: context.schemaName,
              tables: context.tables,
              selectedTable: context.selectedTable,
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
            messages: [...state.messages, assistantMessage],
            isLoading: false,
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
            messages: [...state.messages, errorMessage],
            isLoading: false,
          }));
        }
      },

      clearMessages: () => set({ messages: [] }),

      setContext: (context) =>
        set((state) => ({
          context: { ...state.context, ...context },
        })),

      // Settings actions
      updateSettings: async (newSettings: Partial<AISettings>) => {
        const current = get().settings;
        const updated = { ...current, ...newSettings };
        
        // Try to update backend settings (core API handles all extension settings)
        try {
          await coreApi.updateExtensionSettings(updated);
        } catch {
          // Fallback to local
        }
        
        set({ settings: updated });
      },

      setApiKey: async (key: string) => {
        await get().updateSettings({ aiApiKey: key });
      },
    }),
    {
      name: "dbfordevs-ai-assistant",
      partialize: (state) => ({
        settings: state.settings,
        messages: state.messages.slice(-50),
      }),
    }
  )
);

