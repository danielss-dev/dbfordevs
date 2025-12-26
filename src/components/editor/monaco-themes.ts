import type * as Monaco from "monaco-editor";

/**
 * Register custom Monaco themes that match the app's design system
 */
export function registerCustomThemes(monaco: typeof Monaco) {
  // Dark theme matching the app's design
  monaco.editor.defineTheme("dbfordevs-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "569cd6", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "569cd6", fontStyle: "bold" },
      { token: "string", foreground: "ce9178" },
      { token: "string.sql", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
      { token: "number.sql", foreground: "b5cea8" },
      { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      { token: "comment.sql", foreground: "6a9955", fontStyle: "italic" },
      { token: "operator", foreground: "d4d4d4" },
      { token: "operator.sql", foreground: "d4d4d4" },
      { token: "identifier", foreground: "9cdcfe" },
      { token: "identifier.sql", foreground: "9cdcfe" },
      { token: "type", foreground: "4ec9b0" },
      { token: "predefined.sql", foreground: "4ec9b0" },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#e6edf3",
      "editor.lineHighlightBackground": "#161b2240",
      "editor.selectionBackground": "#264f78",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#e6edf3",
      "editorCursor.foreground": "#58a6ff",
      "editor.inactiveSelectionBackground": "#264f7840",
      "editorWidget.background": "#161b22",
      "editorWidget.border": "#30363d",
      "editorSuggestWidget.background": "#161b22",
      "editorSuggestWidget.border": "#30363d",
      "editorSuggestWidget.foreground": "#e6edf3",
      "editorSuggestWidget.selectedBackground": "#1f6feb40",
      "editorSuggestWidget.highlightForeground": "#58a6ff",
      "scrollbarSlider.background": "#6e768133",
      "scrollbarSlider.hoverBackground": "#6e768180",
      "scrollbarSlider.activeBackground": "#6e7681",
      "editorGutter.background": "#0d1117",
      "editorGutter.foldingControlForeground": "#6e7681",
      "editor.foldBackground": "#161b22",
    },
  });

  // Light theme for light mode
  monaco.editor.defineTheme("dbfordevs-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "0000ff", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "0000ff", fontStyle: "bold" },
      { token: "string", foreground: "a31515" },
      { token: "string.sql", foreground: "a31515" },
      { token: "number", foreground: "098658" },
      { token: "number.sql", foreground: "098658" },
      { token: "comment", foreground: "008000", fontStyle: "italic" },
      { token: "comment.sql", foreground: "008000", fontStyle: "italic" },
      { token: "operator", foreground: "000000" },
      { token: "identifier", foreground: "001080" },
      { token: "type", foreground: "267f99" },
      { token: "predefined.sql", foreground: "267f99" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1f2328",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editor.selectionBackground": "#add6ff",
      "editorLineNumber.foreground": "#636c76",
      "editorLineNumber.activeForeground": "#1f2328",
      "editorCursor.foreground": "#0969da",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#d1d9e0",
      "editorSuggestWidget.background": "#ffffff",
      "editorSuggestWidget.border": "#d1d9e0",
      "editorSuggestWidget.foreground": "#1f2328",
      "editorSuggestWidget.selectedForeground": "#1f2328",
      "editorSuggestWidget.selectedBackground": "#ddf4ff",
      "editorSuggestWidget.highlightForeground": "#0969da",
      "editorSuggestWidget.focusHighlightForeground": "#0969da",
      "list.hoverBackground": "#eaeef2",
      "list.focusBackground": "#ddf4ff",
      "list.activeSelectionBackground": "#ddf4ff",
      "list.activeSelectionForeground": "#1f2328",
      "scrollbarSlider.background": "#8c8c8c33",
      "scrollbarSlider.hoverBackground": "#8c8c8c66",
      "editorGutter.background": "#ffffff",
      "editorGutter.foldingControlForeground": "#636c76",
      "editor.foldBackground": "#f0f0f0",
    },
  });
}

/**
 * Get the Monaco theme name based on the app's current theme setting
 *
 * @param appTheme - The current app theme (light/dark/system or extension theme like "ext:nordic-light")
 * @param getThemeVariant - Optional function to get theme variant for extension themes
 */
export function getMonacoTheme(
  appTheme: "light" | "dark" | "system" | string,
  getThemeVariant?: (themeId: string) => "light" | "dark" | undefined
): string {
  // Handle extension themes (e.g., "ext:nordic-light")
  if (appTheme.startsWith("ext:")) {
    const extensionThemeId = appTheme.slice(4); // Remove "ext:" prefix
    const variant = getThemeVariant?.(extensionThemeId);
    return variant === "light" ? "dbfordevs-light" : "dbfordevs-dark";
  }

  // Handle built-in themes
  if (appTheme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dbfordevs-dark" : "dbfordevs-light";
  }
  return appTheme === "dark" ? "dbfordevs-dark" : "dbfordevs-light";
}
