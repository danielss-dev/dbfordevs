/**
 * AI Assistant Hooks
 */

import { useCallback } from "react";
import { useAIStore } from "./store";
import { useExtensionStore } from "../core/store";
import type { TableInfo } from "./types";

/**
 * Hook for AI Assistant functionality
 */
export function useAIAssistant() {
  const {
    panelOpen,
    messages,
    isLoading,
    context,
    setPanelOpen,
    togglePanel,
    sendMessage: storeSendMessage,
    clearMessages,
    setContext,
    settings,
    setApiKey,
  } = useAIStore();

  const { isEnabled } = useExtensionStore();
  
  const isAIExtensionEnabled = isEnabled("ai-assistant");
  const isConfigured = Boolean(settings.aiApiKey);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;
      await storeSendMessage(message);
    },
    [storeSendMessage]
  );

  const updateContext = useCallback(
    (tables: TableInfo[], selectedTable?: string, databaseType?: string) => {
      setContext({ tables, selectedTable, databaseType });
    },
    [setContext]
  );

  return {
    isOpen: panelOpen,
    isConfigured,
    isEnabled: isAIExtensionEnabled,
    isLoading: isLoading,
    messages: messages,
    context: context,
    open: () => setPanelOpen(true),
    close: () => setPanelOpen(false),
    toggle: togglePanel,
    sendMessage,
    clearMessages: clearMessages,
    updateContext,
    setApiKey: setApiKey,
  };
}

