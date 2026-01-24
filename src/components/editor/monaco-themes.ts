import type * as Monaco from "monaco-editor";

/**
 * Register custom Monaco themes that match the app's design system
 */
export function registerCustomThemes(monaco: typeof Monaco) {
  // Default Dark theme - near-black with orange accents
  monaco.editor.defineTheme("dbfordevs-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "f97316", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "f97316", fontStyle: "bold" },
      { token: "string", foreground: "fbbf24" },
      { token: "string.sql", foreground: "fbbf24" },
      { token: "number", foreground: "a78bfa" },
      { token: "number.sql", foreground: "a78bfa" },
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "comment.sql", foreground: "6b7280", fontStyle: "italic" },
      { token: "operator", foreground: "e5e5e5" },
      { token: "operator.sql", foreground: "e5e5e5" },
      { token: "identifier", foreground: "d4d4d4" },
      { token: "identifier.sql", foreground: "d4d4d4" },
      { token: "type", foreground: "c084fc" },
      { token: "predefined.sql", foreground: "c084fc" },
    ],
    colors: {
      "editor.background": "#1a1a1a",
      "editor.foreground": "#ebebeb",
      "editor.lineHighlightBackground": "#262626",
      "editor.selectionBackground": "#f9731640",
      "editorLineNumber.foreground": "#525252",
      "editorLineNumber.activeForeground": "#f97316",
      "editorCursor.foreground": "#f97316",
      "editor.inactiveSelectionBackground": "#f9731620",
      "editorWidget.background": "#212121",
      "editorWidget.border": "#333333",
      "editorSuggestWidget.background": "#212121",
      "editorSuggestWidget.border": "#333333",
      "editorSuggestWidget.foreground": "#ebebeb",
      "editorSuggestWidget.selectedBackground": "#f9731630",
      "editorSuggestWidget.highlightForeground": "#f97316",
      "scrollbarSlider.background": "#52525233",
      "scrollbarSlider.hoverBackground": "#52525280",
      "scrollbarSlider.activeBackground": "#525252",
      "editorGutter.background": "#1a1a1a",
      "editorGutter.foldingControlForeground": "#525252",
      "editor.foldBackground": "#262626",
    },
  });

  // Default Light theme - warm white with orange accents
  monaco.editor.defineTheme("dbfordevs-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "ea580c", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "ea580c", fontStyle: "bold" },
      { token: "string", foreground: "b45309" },
      { token: "string.sql", foreground: "b45309" },
      { token: "number", foreground: "7c3aed" },
      { token: "number.sql", foreground: "7c3aed" },
      { token: "comment", foreground: "9ca3af", fontStyle: "italic" },
      { token: "comment.sql", foreground: "9ca3af", fontStyle: "italic" },
      { token: "operator", foreground: "374151" },
      { token: "operator.sql", foreground: "374151" },
      { token: "identifier", foreground: "1f2937" },
      { token: "identifier.sql", foreground: "1f2937" },
      { token: "type", foreground: "9333ea" },
      { token: "predefined.sql", foreground: "9333ea" },
    ],
    colors: {
      "editor.background": "#faf8f5",
      "editor.foreground": "#1f2937",
      "editor.lineHighlightBackground": "#f5f0eb",
      "editor.selectionBackground": "#fdba7440",
      "editorLineNumber.foreground": "#9ca3af",
      "editorLineNumber.activeForeground": "#ea580c",
      "editorCursor.foreground": "#ea580c",
      "editor.inactiveSelectionBackground": "#fdba7420",
      "editorWidget.background": "#fefdfb",
      "editorWidget.border": "#e5e0da",
      "editorSuggestWidget.background": "#fefdfb",
      "editorSuggestWidget.border": "#e5e0da",
      "editorSuggestWidget.foreground": "#1f2937",
      "editorSuggestWidget.selectedForeground": "#ffffff",
      "editorSuggestWidget.selectedBackground": "#ea580c",
      "editorSuggestWidget.highlightForeground": "#ea580c",
      "editorSuggestWidget.focusHighlightForeground": "#ffffff",
      "list.hoverBackground": "#f5f0eb",
      "list.focusBackground": "#ea580c",
      "list.focusForeground": "#ffffff",
      "list.activeSelectionBackground": "#ea580c",
      "list.activeSelectionForeground": "#ffffff",
      "list.activeSelectionIconForeground": "#ffffff",
      "list.focusHighlightForeground": "#ffffff",
      "scrollbarSlider.background": "#9ca3af33",
      "scrollbarSlider.hoverBackground": "#9ca3af66",
      "scrollbarSlider.activeBackground": "#9ca3af",
      "editorGutter.background": "#faf8f5",
      "editorGutter.foldingControlForeground": "#9ca3af",
      "editor.foldBackground": "#f5f0eb",
    },
  });

  // Classic Dark theme - original blue accent dark theme
  monaco.editor.defineTheme("dbfordevs-classic-dark", {
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

  // Classic Light theme - original blue accent light theme
  monaco.editor.defineTheme("dbfordevs-classic-light", {
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
      "editorSuggestWidget.selectedForeground": "#ffffff",
      "editorSuggestWidget.selectedBackground": "#0969da",
      "editorSuggestWidget.highlightForeground": "#0969da",
      "editorSuggestWidget.focusHighlightForeground": "#ffffff",
      "list.hoverBackground": "#eaeef2",
      "list.focusBackground": "#0969da",
      "list.focusForeground": "#ffffff",
      "list.activeSelectionBackground": "#0969da",
      "list.activeSelectionForeground": "#ffffff",
      "list.activeSelectionIconForeground": "#ffffff",
      "list.highlightForeground": "#0969da",
      "list.focusHighlightForeground": "#ffffff",
      "scrollbarSlider.background": "#8c8c8c33",
      "scrollbarSlider.hoverBackground": "#8c8c8c66",
      "editorGutter.background": "#ffffff",
      "editorGutter.foldingControlForeground": "#636c76",
      "editor.foldBackground": "#f0f0f0",
    },
  });

  // Solarized Dark theme - warm, precision-crafted dark theme
  monaco.editor.defineTheme("dbfordevs-solarized-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "859900", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "859900", fontStyle: "bold" },
      { token: "string", foreground: "2aa198" },
      { token: "string.sql", foreground: "2aa198" },
      { token: "number", foreground: "d33682" },
      { token: "number.sql", foreground: "d33682" },
      { token: "comment", foreground: "586e75", fontStyle: "italic" },
      { token: "comment.sql", foreground: "586e75", fontStyle: "italic" },
      { token: "operator", foreground: "93a1a1" },
      { token: "operator.sql", foreground: "93a1a1" },
      { token: "identifier", foreground: "839496" },
      { token: "identifier.sql", foreground: "839496" },
      { token: "type", foreground: "b58900" },
      { token: "predefined.sql", foreground: "b58900" },
    ],
    colors: {
      "editor.background": "#002b36",
      "editor.foreground": "#839496",
      "editor.lineHighlightBackground": "#073642",
      "editor.selectionBackground": "#073642",
      "editorLineNumber.foreground": "#586e75",
      "editorLineNumber.activeForeground": "#93a1a1",
      "editorCursor.foreground": "#268bd2",
      "editor.inactiveSelectionBackground": "#07364280",
      "editorWidget.background": "#073642",
      "editorWidget.border": "#586e75",
      "editorSuggestWidget.background": "#073642",
      "editorSuggestWidget.border": "#586e75",
      "editorSuggestWidget.foreground": "#839496",
      "editorSuggestWidget.selectedBackground": "#268bd240",
      "editorSuggestWidget.highlightForeground": "#268bd2",
      "scrollbarSlider.background": "#58667533",
      "scrollbarSlider.hoverBackground": "#58667566",
      "scrollbarSlider.activeBackground": "#586675",
      "editorGutter.background": "#002b36",
      "editorGutter.foldingControlForeground": "#586e75",
      "editor.foldBackground": "#073642",
    },
  });

  // Solarized Light theme - warm, precision-crafted light theme
  monaco.editor.defineTheme("dbfordevs-solarized-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "859900", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "859900", fontStyle: "bold" },
      { token: "string", foreground: "2aa198" },
      { token: "string.sql", foreground: "2aa198" },
      { token: "number", foreground: "d33682" },
      { token: "number.sql", foreground: "d33682" },
      { token: "comment", foreground: "93a1a1", fontStyle: "italic" },
      { token: "comment.sql", foreground: "93a1a1", fontStyle: "italic" },
      { token: "operator", foreground: "657b83" },
      { token: "operator.sql", foreground: "657b83" },
      { token: "identifier", foreground: "586e75" },
      { token: "identifier.sql", foreground: "586e75" },
      { token: "type", foreground: "b58900" },
      { token: "predefined.sql", foreground: "b58900" },
    ],
    colors: {
      "editor.background": "#fdf6e3",
      "editor.foreground": "#657b83",
      "editor.lineHighlightBackground": "#eee8d5",
      "editor.selectionBackground": "#eee8d5",
      "editorLineNumber.foreground": "#93a1a1",
      "editorLineNumber.activeForeground": "#586e75",
      "editorCursor.foreground": "#268bd2",
      "editor.inactiveSelectionBackground": "#eee8d580",
      "editorWidget.background": "#eee8d5",
      "editorWidget.border": "#93a1a1",
      "editorSuggestWidget.background": "#eee8d5",
      "editorSuggestWidget.border": "#93a1a1",
      "editorSuggestWidget.foreground": "#657b83",
      "editorSuggestWidget.selectedBackground": "#268bd230",
      "editorSuggestWidget.highlightForeground": "#268bd2",
      "scrollbarSlider.background": "#93a1a133",
      "scrollbarSlider.hoverBackground": "#93a1a166",
      "scrollbarSlider.activeBackground": "#93a1a1",
      "editorGutter.background": "#fdf6e3",
      "editorGutter.foldingControlForeground": "#93a1a1",
      "editor.foldBackground": "#eee8d5",
    },
  });

  // One Dark theme - Atom-inspired dark theme
  monaco.editor.defineTheme("dbfordevs-one-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "c678dd", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "c678dd", fontStyle: "bold" },
      { token: "string", foreground: "98c379" },
      { token: "string.sql", foreground: "98c379" },
      { token: "number", foreground: "d19a66" },
      { token: "number.sql", foreground: "d19a66" },
      { token: "comment", foreground: "5c6370", fontStyle: "italic" },
      { token: "comment.sql", foreground: "5c6370", fontStyle: "italic" },
      { token: "operator", foreground: "abb2bf" },
      { token: "operator.sql", foreground: "abb2bf" },
      { token: "identifier", foreground: "e06c75" },
      { token: "identifier.sql", foreground: "e06c75" },
      { token: "type", foreground: "61afef" },
      { token: "predefined.sql", foreground: "61afef" },
    ],
    colors: {
      "editor.background": "#282c34",
      "editor.foreground": "#abb2bf",
      "editor.lineHighlightBackground": "#2c313c",
      "editor.selectionBackground": "#3e4451",
      "editorLineNumber.foreground": "#4b5263",
      "editorLineNumber.activeForeground": "#abb2bf",
      "editorCursor.foreground": "#528bff",
      "editor.inactiveSelectionBackground": "#3e445180",
      "editorWidget.background": "#21252b",
      "editorWidget.border": "#3a3f4b",
      "editorSuggestWidget.background": "#21252b",
      "editorSuggestWidget.border": "#3a3f4b",
      "editorSuggestWidget.foreground": "#abb2bf",
      "editorSuggestWidget.selectedBackground": "#2c313c",
      "editorSuggestWidget.highlightForeground": "#61afef",
      "scrollbarSlider.background": "#4b526333",
      "scrollbarSlider.hoverBackground": "#4b526366",
      "scrollbarSlider.activeBackground": "#4b5263",
      "editorGutter.background": "#282c34",
      "editorGutter.foldingControlForeground": "#4b5263",
      "editor.foldBackground": "#2c313c",
    },
  });

  // High Contrast theme - WCAG AAA compliant accessibility theme
  monaco.editor.defineTheme("dbfordevs-high-contrast", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "ffff00", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "ffff00", fontStyle: "bold" },
      { token: "string", foreground: "00ff00" },
      { token: "string.sql", foreground: "00ff00" },
      { token: "number", foreground: "ff80ff" },
      { token: "number.sql", foreground: "ff80ff" },
      { token: "comment", foreground: "00ffff", fontStyle: "italic" },
      { token: "comment.sql", foreground: "00ffff", fontStyle: "italic" },
      { token: "operator", foreground: "ffffff" },
      { token: "operator.sql", foreground: "ffffff" },
      { token: "identifier", foreground: "ffffff" },
      { token: "identifier.sql", foreground: "ffffff" },
      { token: "type", foreground: "80d4ff" },
      { token: "predefined.sql", foreground: "80d4ff" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.foreground": "#ffffff",
      "editor.lineHighlightBackground": "#1a1a1a",
      "editor.selectionBackground": "#ffff0040",
      "editorLineNumber.foreground": "#808080",
      "editorLineNumber.activeForeground": "#ffff00",
      "editorCursor.foreground": "#ffff00",
      "editor.inactiveSelectionBackground": "#ffff0020",
      "editorWidget.background": "#0d0d0d",
      "editorWidget.border": "#666666",
      "editorSuggestWidget.background": "#0d0d0d",
      "editorSuggestWidget.border": "#666666",
      "editorSuggestWidget.foreground": "#ffffff",
      "editorSuggestWidget.selectedBackground": "#ffff0040",
      "editorSuggestWidget.highlightForeground": "#ffff00",
      "scrollbarSlider.background": "#66666633",
      "scrollbarSlider.hoverBackground": "#66666666",
      "scrollbarSlider.activeBackground": "#666666",
      "editorGutter.background": "#000000",
      "editorGutter.foldingControlForeground": "#808080",
      "editor.foldBackground": "#1a1a1a",
    },
  });
}

/**
 * Built-in theme type for the function signature
 */
type BuiltInTheme = "light" | "dark" | "system" | "classic-light" | "classic-dark" | "nordic-dark" | "nordic-light" | "solarized-dark" | "solarized-light" | "one-dark" | "high-contrast";

/**
 * Get the Monaco theme name based on the app's current theme setting
 *
 * @param appTheme - The current app theme (built-in or custom:id)
 * @param customThemeBaseTheme - For custom themes, the base theme (light or dark)
 */
export function getMonacoTheme(
  appTheme: BuiltInTheme | `custom:${string}`,
  customThemeBaseTheme?: "light" | "dark"
): string {
  // Handle custom themes - use base theme to determine Monaco theme
  if (appTheme.startsWith("custom:")) {
    // For custom themes, use the base theme (default to dark if not provided)
    const baseTheme = customThemeBaseTheme || "dark";
    return baseTheme === "light" ? "dbfordevs-light" : "dbfordevs-dark";
  }

  // Handle Classic themes
  if (appTheme === "classic-dark") {
    return "dbfordevs-classic-dark";
  }
  if (appTheme === "classic-light") {
    return "dbfordevs-classic-light";
  }

  // Handle Nordic themes (use generic dark/light monaco)
  if (appTheme === "nordic-dark") {
    return "dbfordevs-dark";
  }
  if (appTheme === "nordic-light") {
    return "dbfordevs-light";
  }

  // Handle Solarized themes
  if (appTheme === "solarized-dark") {
    return "dbfordevs-solarized-dark";
  }
  if (appTheme === "solarized-light") {
    return "dbfordevs-solarized-light";
  }

  // Handle One Dark theme
  if (appTheme === "one-dark") {
    return "dbfordevs-one-dark";
  }

  // Handle High Contrast theme
  if (appTheme === "high-contrast") {
    return "dbfordevs-high-contrast";
  }

  // Handle system theme
  if (appTheme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dbfordevs-dark" : "dbfordevs-light";
  }

  // Handle light/dark themes
  return appTheme === "dark" ? "dbfordevs-dark" : "dbfordevs-light";
}
