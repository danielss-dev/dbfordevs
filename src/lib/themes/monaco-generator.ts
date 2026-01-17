import type * as Monaco from "monaco-editor";
import type { CustomTheme, EditorThemeColors, SyntaxTokenColors } from "@/types/theme";

/**
 * Generate a Monaco theme definition from a CustomTheme
 */
export function generateMonacoTheme(theme: CustomTheme): Monaco.editor.IStandaloneThemeData {
  const { editorColors, syntaxColors, baseTheme } = theme;

  return {
    base: baseTheme === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: generateTokenRules(syntaxColors),
    colors: generateEditorColors(editorColors),
  };
}

/**
 * Generate Monaco token rules from syntax colors
 */
function generateTokenRules(syntaxColors: SyntaxTokenColors): Monaco.editor.ITokenThemeRule[] {
  const { keyword, string, number, comment, operator, identifier, type } = syntaxColors;

  // Remove # from hex colors for Monaco rules
  const stripHash = (hex: string) => hex.replace(/^#/, "");

  return [
    { token: "keyword", foreground: stripHash(keyword), fontStyle: "bold" },
    { token: "keyword.sql", foreground: stripHash(keyword), fontStyle: "bold" },
    { token: "string", foreground: stripHash(string) },
    { token: "string.sql", foreground: stripHash(string) },
    { token: "number", foreground: stripHash(number) },
    { token: "number.sql", foreground: stripHash(number) },
    { token: "comment", foreground: stripHash(comment), fontStyle: "italic" },
    { token: "comment.sql", foreground: stripHash(comment), fontStyle: "italic" },
    { token: "operator", foreground: stripHash(operator) },
    { token: "operator.sql", foreground: stripHash(operator) },
    { token: "identifier", foreground: stripHash(identifier) },
    { token: "identifier.sql", foreground: stripHash(identifier) },
    { token: "type", foreground: stripHash(type) },
    { token: "predefined.sql", foreground: stripHash(type) },
  ];
}

/**
 * Generate Monaco editor colors from EditorThemeColors
 */
function generateEditorColors(colors: EditorThemeColors): Monaco.editor.IColors {
  return {
    "editor.background": colors.editorBackground,
    "editor.foreground": colors.editorForeground,
    "editor.lineHighlightBackground": colors.lineHighlightBackground,
    "editor.selectionBackground": colors.selectionBackground,
    "editorLineNumber.foreground": colors.lineNumberForeground,
    "editorLineNumber.activeForeground": colors.lineNumberActiveForeground,
    "editorCursor.foreground": colors.cursorForeground,
    "editor.inactiveSelectionBackground": colors.inactiveSelectionBackground,
    "editorWidget.background": colors.widgetBackground,
    "editorWidget.border": colors.widgetBorder,
    "editorSuggestWidget.background": colors.suggestWidgetBackground,
    "editorSuggestWidget.border": colors.suggestWidgetBorder,
    "editorSuggestWidget.foreground": colors.suggestWidgetForeground,
    "editorSuggestWidget.selectedBackground": colors.suggestWidgetSelectedBackground,
    "editorSuggestWidget.highlightForeground": colors.suggestWidgetHighlightForeground,
    "scrollbarSlider.background": colors.scrollbarSliderBackground,
    "scrollbarSlider.hoverBackground": colors.scrollbarSliderHoverBackground,
    "scrollbarSlider.activeBackground": colors.scrollbarSliderActiveBackground,
    "editorGutter.background": colors.gutterBackground,
    "editorGutter.foldingControlForeground": colors.foldingControlForeground,
    "editor.foldBackground": colors.foldBackground,
  };
}

/**
 * Register a custom theme with Monaco editor
 */
export function registerCustomMonacoTheme(
  monaco: typeof Monaco,
  theme: CustomTheme
): string {
  const themeName = `custom-${theme.id}`;
  const themeData = generateMonacoTheme(theme);
  monaco.editor.defineTheme(themeName, themeData);
  return themeName;
}

/**
 * Get the Monaco theme name for a custom theme
 */
export function getCustomMonacoThemeName(themeId: string): string {
  return `custom-${themeId}`;
}
