/**
 * Extension System
 *
 * Public exports for the dbfordevs extension system.
 */

// Types
export type {
  ExtensionInfo,
  ExtensionSettings,
  ExtensionStatus,
  ExtensionCategory,
  TableInfo,
  ColumnInfo,
  GenerateSQLRequest,
  GeneratedSQL,
  ExplainQueryRequest,
  QueryExplanation,
  AIChatMessage,
  AIChatRequest,
  AIChatResponse,
} from "./types";

// Store
export { useExtensionStore } from "./store";

// Hooks
export { useAIAssistant, useExtensions, useExtensionSettings } from "./hooks";

// API (for direct access when needed)
export * as extensionApi from "./api";

// Theme System
export { useThemeStore, useThemes } from "./themes";
export type { ThemeDefinition } from "./themes";
export { officialThemes, registerOfficialThemes } from "./themes/official";

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

// Re-export the theme store for direct access
import { useThemeStore } from "./themes";

