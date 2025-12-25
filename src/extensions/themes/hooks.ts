/**
 * Theme Hooks
 */

import { useMemo } from "react";
import { useThemeStore } from "./store";
import { useExtensionStore } from "../core/store";

/**
 * Hook to manage themes
 */
export function useThemes() {
  const {
    activeThemeId,
    registerTheme,
    unregisterTheme,
    activateTheme,
    getAllThemes,
  } = useThemeStore();

  const themes = getAllThemes();

  return {
    activeThemeId,
    themes,
    officialThemes: themes.filter((t) => t.isOfficial),
    communityThemes: themes.filter((t) => !t.isOfficial),
    register: registerTheme,
    unregister: unregisterTheme,
    activate: activateTheme,
    deactivate: () => activateTheme(null),
  };
}

/**
 * Hook to get themes that are currently installed and enabled via the extension system.
 * Useful for the appearance menu.
 */
export function useInstalledThemes() {
  const { themes } = useThemes();
  const { isEnabled, isInstalled } = useExtensionStore();

  return useMemo(() => {
    return themes.filter(theme => isInstalled(theme.id) && isEnabled(theme.id));
  }, [themes, isEnabled, isInstalled]);
}



