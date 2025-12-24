/**
 * Core Extension Hooks
 */

import { useMemo } from "react";
import { useExtensionStore } from "./store";
import { EXTENSION_CATALOG, type MarketplaceExtension } from "./catalog";

export type ExtensionWithStatus = MarketplaceExtension & { installed: boolean; enabled: boolean };

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
    featuredExtensions,
    isLoading,
    error,
    install: installExtension,
    uninstall: uninstallExtension,
    enable: enableExtension,
    disable: disableExtension,
    isInstalled,
    isEnabled,
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

