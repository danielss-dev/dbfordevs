/**
 * Extension Hooks
 *
 * React hooks for consuming extension functionality.
 */

import { useCallback, useMemo } from "react";
import { useExtensionStore, EXTENSION_CATALOG, type MarketplaceExtension } from "./store";

export type ExtensionWithStatus = MarketplaceExtension & { installed: boolean; enabled: boolean };
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
    isEnabled,
  } = useExtensionStore();

  const isConfigured = Boolean(settings.aiApiKey);
  const isAIExtensionEnabled = isEnabled("ai-assistant");

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
    isEnabled: isAIExtensionEnabled,
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
 * Hook for extension management (Marketplace)
 */
export function useExtensions() {
  const {
    installedExtensions,
    isLoading,
    error,
    installExtension,
    uninstallExtension,
    enableExtension,
    disableExtension,
    isInstalled,
    isEnabled,
    installFromGitHub,
  } = useExtensionStore();

  // Get catalog with installation status
  const catalog = useMemo((): ExtensionWithStatus[] => {
    return EXTENSION_CATALOG.map((ext) => ({
      ...ext,
      installed: isInstalled(ext.id),
      enabled: isEnabled(ext.id),
    }));
  }, [installedExtensions, isInstalled, isEnabled]);

  // Split by category
  const themeExtensions = useMemo(
    () => catalog.filter((e) => e.category === "theme"),
    [catalog]
  );

  const aiExtensions = useMemo(
    () => catalog.filter((e) => e.category === "ai"),
    [catalog]
  );

  const validatorExtensions = useMemo(
    () => catalog.filter((e) => e.category === "validator"),
    [catalog]
  );

  const officialExtensions = useMemo(
    () => catalog.filter((e) => e.isOfficial),
    [catalog]
  );

  const communityExtensions = useMemo(
    () => catalog.filter((e) => !e.isOfficial),
    [catalog]
  );

  const featuredExtensions = useMemo(
    () => catalog.filter((e) => e.isFeatured),
    [catalog]
  );

  const installedList = useMemo(
    () => catalog.filter((e) => e.installed),
    [catalog]
  );

  return {
    catalog,
    installedExtensions: installedList,
    themeExtensions,
    aiExtensions,
    validatorExtensions,
    officialExtensions,
    communityExtensions,
    featuredExtensions,
    isLoading,
    error,
    install: installExtension,
    uninstall: uninstallExtension,
    enable: enableExtension,
    disable: disableExtension,
    isInstalled,
    isEnabled,
    installFromGitHub,
  };
}

/**
 * Hook for a single extension
 */
export function useExtension(extensionId: string) {
  const { 
    isInstalled, 
    isEnabled, 
    getExtension,
    installExtension,
    uninstallExtension,
    enableExtension,
    disableExtension,
    isLoading,
  } = useExtensionStore();

  const catalogEntry = EXTENSION_CATALOG.find((e) => e.id === extensionId);
  const installed = isInstalled(extensionId);
  const enabled = isEnabled(extensionId);
  const extension = getExtension(extensionId);

  return {
    extension: catalogEntry,
    installedInfo: extension,
    installed,
    enabled,
    isLoading,
    install: () => installExtension(extensionId),
    uninstall: () => uninstallExtension(extensionId),
    enable: () => enableExtension(extensionId),
    disable: () => disableExtension(extensionId),
  };
}

/**
 * Hook for extension settings
 */
export function useExtensionSettings() {
  const { settings, loadSettings, updateSettings } = useExtensionStore();

  return {
    settings,
    loadSettings,
    updateSettings,
  };
}
