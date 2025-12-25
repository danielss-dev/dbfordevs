/**
 * AI Assistant Hooks
 */

import { useCallback } from "react";
import { useAIStore } from "./store";
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
    settings,
    setPanelOpen,
    togglePanel,
    sendMessage: storeSendMessage,
    clearMessages,
    setContext,
    setApiKey,
    isConfigured: checkIsConfigured,
  } = useAIStore();

  const isAIEnabled = settings.aiEnabled ?? true;
  const isConfigured = checkIsConfigured();

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;
      await storeSendMessage(message);
    },
    [storeSendMessage]
  );

  const updateContext = useCallback(
    (tables: TableInfo[], selectedTable?: string, databaseType?: string, connectionId?: string) => {
      setContext({ tables, selectedTable, databaseType, connectionId });
    },
    [setContext]
  );

  return {
    isOpen: panelOpen,
    isConfigured,
    isEnabled: isAIEnabled,
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



