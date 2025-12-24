/**
 * Extension System
 *
 * Public exports for the dbfordevs extension system.
 */

// Core
export * from "./core/types";
export * from "./core/store";
export * from "./core/hooks";
export * as extensionApi from "./core/api";
export { EXTENSION_CATALOG } from "./core/catalog";

// AI Assistant
export * from "./ai/types";
export * from "./ai/store";
export * from "./ai/hooks";
export * as aiApi from "./ai/api";

// Themes
export * from "./themes";

// Initialization
import { useThemeStore } from "./themes/store";

/**
 * Initialize the extension system.
 * Call this once on app startup.
 */
export function initializeExtensions(): void {
  // Register official themes
  const { registerTheme, activeThemeId, activateTheme } = useThemeStore.getState();
  
  // Import and register official themes
  import("./themes/official").then(({ officialThemes }) => {
    officialThemes.forEach(registerTheme);
    
    // Re-activate persisted theme if it exists
    if (activeThemeId) {
      // Small delay to ensure CSS is ready
      setTimeout(() => {
        activateTheme(activeThemeId);
      }, 0);
    }
  });
}
