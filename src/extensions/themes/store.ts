/**
 * Theme Extension Store
 *
 * Manages dynamic loading and unloading of theme CSS.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeDefinition } from "./types";

interface ThemeState {
  /** Currently active theme ID (null = default system theme) */
  activeThemeId: string | null;
  /** Registered themes */
  themes: Map<string, ThemeDefinition>;
  /** Loading state */
  isLoading: boolean;

  // Actions
  registerTheme: (theme: ThemeDefinition) => void;
  unregisterTheme: (themeId: string) => void;
  activateTheme: (themeId: string | null) => void;
  getTheme: (themeId: string) => ThemeDefinition | undefined;
  getAllThemes: () => ThemeDefinition[];
}

// ============================================================================
// CSS Injection Utilities
// ============================================================================

const THEME_STYLE_PREFIX = "dbfordevs-theme-";
const THEME_ROOT_CLASS_PREFIX = "theme-";

/**
 * Inject CSS into the document
 */
function injectCSS(themeId: string, css: string, isUrl: boolean = false): void {
  // Remove any existing style for this theme first
  removeCSS(themeId);

  if (isUrl) {
    // Create link element for external CSS
    const link = document.createElement("link");
    link.id = `${THEME_STYLE_PREFIX}${themeId}`;
    link.rel = "stylesheet";
    link.href = css;
    document.head.appendChild(link);
  } else {
    // Create style element for inline CSS
    const style = document.createElement("style");
    style.id = `${THEME_STYLE_PREFIX}${themeId}`;
    style.textContent = css;
    document.head.appendChild(style);
  }
}

/**
 * Remove injected CSS from the document
 */
function removeCSS(themeId: string): void {
  const element = document.getElementById(`${THEME_STYLE_PREFIX}${themeId}`);
  if (element) {
    element.remove();
  }
}

/**
 * Apply theme class to document root
 */
function applyThemeClass(themeId: string | null, variant: "light" | "dark" | null): void {
  const root = document.documentElement;

  // Remove all theme classes
  const classesToRemove = Array.from(root.classList).filter(
    (c) => c.startsWith(THEME_ROOT_CLASS_PREFIX) || c === "dark"
  );
  classesToRemove.forEach((c) => root.classList.remove(c));

  if (themeId) {
    // Add theme-specific class
    root.classList.add(`${THEME_ROOT_CLASS_PREFIX}${themeId}`);
    // Add dark class if it's a dark variant (for components that rely on .dark)
    if (variant === "dark") {
      root.classList.add("dark");
    }
  }
}

// ============================================================================
// Theme Store
// ============================================================================

// We need a non-persisted store for the Map, but persist the activeThemeId
interface PersistedThemeState {
  activeThemeId: string | null;
}

const persistedStore = create<PersistedThemeState>()(
  persist(
    () => ({
      activeThemeId: null as string | null,
    }),
    {
      name: "dbfordevs-active-theme",
    }
  )
);

// In-memory theme registry
const themeRegistry = new Map<string, ThemeDefinition>();

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeThemeId: persistedStore.getState().activeThemeId,
  themes: themeRegistry,
  isLoading: false,

  registerTheme: (theme: ThemeDefinition) => {
    themeRegistry.set(theme.id, theme);
    set({ themes: new Map(themeRegistry) });

    // If this theme was previously active, re-activate it
    const { activeThemeId } = get();
    if (activeThemeId === theme.id) {
      get().activateTheme(theme.id);
    }
  },

  unregisterTheme: (themeId: string) => {
    const { activeThemeId } = get();

    // If this theme is active, deactivate it first
    if (activeThemeId === themeId) {
      get().activateTheme(null);
    }

    // Remove CSS and registry entry
    removeCSS(themeId);
    themeRegistry.delete(themeId);
    set({ themes: new Map(themeRegistry) });
  },

  activateTheme: (themeId: string | null) => {
    const { activeThemeId } = get();

    // Deactivate current theme - remove its CSS
    if (activeThemeId) {
      removeCSS(activeThemeId);
    }

    // Activate new theme
    if (themeId) {
      const theme = themeRegistry.get(themeId);
      if (theme) {
        injectCSS(themeId, theme.css, theme.isUrl);
        applyThemeClass(themeId, theme.variant);
      }
    } else {
      // Reset to default (system theme) - also remove any lingering theme CSS
      applyThemeClass(null, null);
      
      // Clean up any theme CSS that might have been orphaned
      document.querySelectorAll(`[id^="${THEME_STYLE_PREFIX}"]`).forEach(el => el.remove());
    }

    // Update state and persist
    set({ activeThemeId: themeId });
    persistedStore.setState({ activeThemeId: themeId });
  },

  getTheme: (themeId: string) => {
    return themeRegistry.get(themeId);
  },

  getAllThemes: () => {
    return Array.from(themeRegistry.values());
  },
}));

// Subscribe to persisted store to sync activeThemeId
persistedStore.subscribe((state) => {
  const currentState = useThemeStore.getState();
  if (currentState.activeThemeId !== state.activeThemeId) {
    // Will be activated once theme is registered
    useThemeStore.setState({ activeThemeId: state.activeThemeId });
  }
});



