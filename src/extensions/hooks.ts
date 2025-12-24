/**
 * Extension Hooks
 *
 * React hooks for consuming extension functionality.
 */

import { useCallback, useEffect } from "react";
import { useExtensionStore } from "./store";
import type { TableInfo } from "./types";

/**
 * Hook for AI Assistant functionality
 */
export function useAIAssistant() {
  const {
    aiPanelOpen,
    aiMessages,
    aiIsLoading,
    aiContext,
    setAIPanelOpen,
    toggleAIPanel,
    sendAIMessage,
    clearAIMessages,
    setAIContext,
    settings,
    setAiApiKey,
  } = useExtensionStore();

  const isConfigured = Boolean(settings.aiApiKey);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;
      await sendAIMessage(message);
    },
    [sendAIMessage]
  );

  const updateContext = useCallback(
    (tables: TableInfo[], selectedTable?: string, databaseType?: string) => {
      setAIContext({ tables, selectedTable, databaseType });
    },
    [setAIContext]
  );

  return {
    isOpen: aiPanelOpen,
    isConfigured,
    isLoading: aiIsLoading,
    messages: aiMessages,
    context: aiContext,
    open: () => setAIPanelOpen(true),
    close: () => setAIPanelOpen(false),
    toggle: toggleAIPanel,
    sendMessage,
    clearMessages: clearAIMessages,
    updateContext,
    setApiKey: setAiApiKey,
  };
}

/**
 * Hook for extension management
 */
export function useExtensions() {
  const {
    extensions,
    isLoading,
    error,
    loadExtensions,
    enableExtension,
    disableExtension,
    uninstallExtension,
    installFromGitHub,
  } = useExtensionStore();

  // Load extensions on mount
  useEffect(() => {
    loadExtensions();
  }, [loadExtensions]);

  const officialExtensions = extensions.filter((ext) => ext.isOfficial);
  const communityExtensions = extensions.filter((ext) => !ext.isOfficial);

  return {
    extensions,
    officialExtensions,
    communityExtensions,
    isLoading,
    error,
    refresh: loadExtensions,
    enable: enableExtension,
    disable: disableExtension,
    uninstall: uninstallExtension,
    installFromGitHub,
  };
}

/**
 * Hook for extension settings
 */
export function useExtensionSettings() {
  const { settings, loadSettings, updateSettings } = useExtensionStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    updateSettings,
  };
}

