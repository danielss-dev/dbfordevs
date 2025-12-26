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
    isLoading,
    isStreaming,
    context,
    settings,
    setPanelOpen,
    togglePanel,
    sendMessage: storeSendMessage,
    setContext,
    setApiKey,
    isConfigured: checkIsConfigured,
    getActiveSession,
    getSessionUsageStats,
  } = useAIStore();

  const isAIEnabled = settings.aiEnabled ?? true;
  const isConfigured = checkIsConfigured();

  // Get messages from active session
  const activeSession = getActiveSession();
  const messages = activeSession?.messages || [];
  const usageStats = getSessionUsageStats();

  const sendMessage = useCallback(
    async (message: string, useStreaming: boolean = true) => {
      if (!message.trim()) return;
      await storeSendMessage(message, useStreaming);
    },
    [storeSendMessage]
  );

  const updateContext = useCallback(
    (tables: TableInfo[], selectedTable?: string, databaseType?: string, connectionId?: string, currentQuery?: string) => {
      setContext({ tables, selectedTable, databaseType, connectionId, currentQuery });
    },
    [setContext]
  );

  return {
    isOpen: panelOpen,
    isConfigured,
    isEnabled: isAIEnabled,
    isLoading,
    isStreaming,
    messages,
    context,
    usageStats,
    open: () => setPanelOpen(true),
    close: () => setPanelOpen(false),
    toggle: togglePanel,
    sendMessage,
    updateContext,
    setApiKey,
  };
}
