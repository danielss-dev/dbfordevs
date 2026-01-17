/**
 * Theme Colors - Core UI colors in HSL format (e.g., "220 14% 96%")
 */
export interface ThemeColors {
  // Base colors
  background: string;
  foreground: string;

  // Card/surface colors
  card: string;
  cardForeground: string;

  // Popover colors
  popover: string;
  popoverForeground: string;

  // Primary brand color
  primary: string;
  primaryForeground: string;

  // Secondary color
  secondary: string;
  secondaryForeground: string;

  // Muted color for subtle backgrounds
  muted: string;
  mutedForeground: string;

  // Accent color
  accent: string;
  accentForeground: string;

  // Destructive/danger color
  destructive: string;
  destructiveForeground: string;

  // Border and input
  border: string;
  input: string;
  ring: string;

  // Status colors
  success: string;
  warning: string;
  info: string;

  // Table colors
  tableHeaderBg: string;
  tableRowOdd: string;
  tableRowEven: string;
  tableRowHover: string;

  // Text hierarchy
  textPrimary: string;
  textSecondary: string;
  textDim: string;

  // Sidebar colors
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

/**
 * Database icon colors in hex format
 */
export interface DatabaseIconColors {
  postgresql: string;
  mysql: string;
  mariadb: string;
  sqlite: string;
  mssql: string;
  oracle: string;
  mongodb: string;
  redis: string;
  cockroachdb: string;
  cassandra: string;
}

/**
 * Monaco editor colors in hex format
 */
export interface EditorThemeColors {
  editorBackground: string;
  editorForeground: string;
  lineHighlightBackground: string;
  selectionBackground: string;
  lineNumberForeground: string;
  lineNumberActiveForeground: string;
  cursorForeground: string;
  inactiveSelectionBackground: string;
  widgetBackground: string;
  widgetBorder: string;
  suggestWidgetBackground: string;
  suggestWidgetBorder: string;
  suggestWidgetForeground: string;
  suggestWidgetSelectedBackground: string;
  suggestWidgetHighlightForeground: string;
  scrollbarSliderBackground: string;
  scrollbarSliderHoverBackground: string;
  scrollbarSliderActiveBackground: string;
  gutterBackground: string;
  foldingControlForeground: string;
  foldBackground: string;
}

/**
 * Syntax highlighting colors in hex format
 */
export interface SyntaxTokenColors {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  operator: string;
  identifier: string;
  type: string;
}

/**
 * Full custom theme definition
 */
export interface CustomTheme {
  id: string;
  name: string;
  description?: string;
  baseTheme: "light" | "dark";
  colors: ThemeColors;
  databaseIcons: DatabaseIconColors;
  editorColors: EditorThemeColors;
  syntaxColors: SyntaxTokenColors;
  createdAt: number;
  updatedAt: number;
}

/**
 * Theme export format for sharing/importing themes
 */
export interface ThemeExportFormat {
  formatVersion: 1;
  theme: Omit<CustomTheme, "id" | "createdAt" | "updatedAt">;
}

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Built-in theme identifiers
 */
export type BuiltInThemeId =
  | "light"
  | "dark"
  | "system"
  | "nordic-dark"
  | "nordic-light"
  | "slasher"
  | "solarized-dark"
  | "solarized-light"
  | "one-dark"
  | "high-contrast";

/**
 * All theme identifiers (built-in or custom prefixed with "custom:")
 */
export type ThemeId = BuiltInThemeId | `custom:${string}`;

/**
 * Theme info for display in UI
 */
export interface ThemeInfo {
  id: ThemeId;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  baseTheme: "light" | "dark";
}

/**
 * Default theme colors for creating new themes
 */
export const DEFAULT_LIGHT_THEME_COLORS: ThemeColors = {
  background: "220 14% 96%",
  foreground: "224 71% 4%",
  card: "0 0% 100%",
  cardForeground: "224 71% 4%",
  popover: "0 0% 100%",
  popoverForeground: "224 71% 4%",
  primary: "220 90% 56%",
  primaryForeground: "210 20% 98%",
  secondary: "220 14% 96%",
  secondaryForeground: "220 9% 46%",
  muted: "220 14% 96%",
  mutedForeground: "220 9% 46%",
  accent: "220 14% 96%",
  accentForeground: "224 71% 4%",
  destructive: "0 84% 60%",
  destructiveForeground: "210 20% 98%",
  border: "220 13% 91%",
  input: "220 13% 91%",
  ring: "220 90% 56%",
  success: "142 71% 45%",
  warning: "38 92% 50%",
  info: "199 89% 48%",
  tableHeaderBg: "220 14% 94%",
  tableRowOdd: "0 0% 100%",
  tableRowEven: "220 14% 98%",
  tableRowHover: "220 14% 92%",
  textPrimary: "224 71% 4%",
  textSecondary: "224 9% 30%",
  textDim: "224 9% 55%",
  sidebarBackground: "0 0% 100%",
  sidebarForeground: "224 71% 4%",
  sidebarPrimary: "220 90% 56%",
  sidebarPrimaryForeground: "210 20% 98%",
  sidebarAccent: "220 14% 96%",
  sidebarAccentForeground: "224 71% 4%",
  sidebarBorder: "220 13% 91%",
  sidebarRing: "220 90% 56%",
};

export const DEFAULT_DARK_THEME_COLORS: ThemeColors = {
  background: "224 20% 6%",
  foreground: "213 31% 91%",
  card: "224 20% 10%",
  cardForeground: "213 31% 91%",
  popover: "224 20% 12%",
  popoverForeground: "213 31% 91%",
  primary: "212 90% 60%",
  primaryForeground: "224 20% 6%",
  secondary: "222 15% 18%",
  secondaryForeground: "210 40% 98%",
  muted: "223 15% 14%",
  mutedForeground: "215 15% 65%",
  accent: "216 20% 15%",
  accentForeground: "210 40% 98%",
  destructive: "0 84% 65%",
  destructiveForeground: "213 31% 91%",
  border: "224 20% 18%",
  input: "224 20% 16%",
  ring: "212 90% 60%",
  success: "158 64% 52%",
  warning: "37 90% 60%",
  info: "199 89% 48%",
  tableHeaderBg: "224 20% 8%",
  tableRowOdd: "224 20% 6%",
  tableRowEven: "224 20% 7%",
  tableRowHover: "224 20% 12%",
  textPrimary: "213 31% 91%",
  textSecondary: "215 15% 60%",
  textDim: "215 10% 45%",
  sidebarBackground: "224 20% 4%",
  sidebarForeground: "215 20% 75%",
  sidebarPrimary: "212 90% 60%",
  sidebarPrimaryForeground: "224 20% 6%",
  sidebarAccent: "222 15% 12%",
  sidebarAccentForeground: "210 40% 98%",
  sidebarBorder: "222 15% 10%",
  sidebarRing: "212 90% 60%",
};

export const DEFAULT_LIGHT_DATABASE_ICONS: DatabaseIconColors = {
  postgresql: "#4169E1",
  mysql: "#4479A1",
  mariadb: "#003545",
  sqlite: "#003B57",
  mssql: "#CC2927",
  oracle: "#F80000",
  mongodb: "#47A248",
  redis: "#FF4438",
  cockroachdb: "#6933FF",
  cassandra: "#1287B1",
};

export const DEFAULT_DARK_DATABASE_ICONS: DatabaseIconColors = {
  postgresql: "#5B7CE9",
  mysql: "#6BA0C2",
  mariadb: "#4DA6A0",
  sqlite: "#5E9BC9",
  mssql: "#E85450",
  oracle: "#FF4444",
  mongodb: "#5FBD68",
  redis: "#FF6B60",
  cockroachdb: "#8B5CF6",
  cassandra: "#35B5D6",
};

export const DEFAULT_LIGHT_EDITOR_COLORS: EditorThemeColors = {
  editorBackground: "#ffffff",
  editorForeground: "#1f2328",
  lineHighlightBackground: "#f6f8fa",
  selectionBackground: "#add6ff",
  lineNumberForeground: "#636c76",
  lineNumberActiveForeground: "#1f2328",
  cursorForeground: "#0969da",
  inactiveSelectionBackground: "#add6ff80",
  widgetBackground: "#ffffff",
  widgetBorder: "#d1d9e0",
  suggestWidgetBackground: "#ffffff",
  suggestWidgetBorder: "#d1d9e0",
  suggestWidgetForeground: "#1f2328",
  suggestWidgetSelectedBackground: "#ddf4ff",
  suggestWidgetHighlightForeground: "#0969da",
  scrollbarSliderBackground: "#8c8c8c33",
  scrollbarSliderHoverBackground: "#8c8c8c66",
  scrollbarSliderActiveBackground: "#8c8c8c",
  gutterBackground: "#ffffff",
  foldingControlForeground: "#636c76",
  foldBackground: "#f0f0f0",
};

export const DEFAULT_DARK_EDITOR_COLORS: EditorThemeColors = {
  editorBackground: "#0d1117",
  editorForeground: "#e6edf3",
  lineHighlightBackground: "#161b2240",
  selectionBackground: "#264f78",
  lineNumberForeground: "#6e7681",
  lineNumberActiveForeground: "#e6edf3",
  cursorForeground: "#58a6ff",
  inactiveSelectionBackground: "#264f7840",
  widgetBackground: "#161b22",
  widgetBorder: "#30363d",
  suggestWidgetBackground: "#161b22",
  suggestWidgetBorder: "#30363d",
  suggestWidgetForeground: "#e6edf3",
  suggestWidgetSelectedBackground: "#1f6feb40",
  suggestWidgetHighlightForeground: "#58a6ff",
  scrollbarSliderBackground: "#6e768133",
  scrollbarSliderHoverBackground: "#6e768180",
  scrollbarSliderActiveBackground: "#6e7681",
  gutterBackground: "#0d1117",
  foldingControlForeground: "#6e7681",
  foldBackground: "#161b22",
};

export const DEFAULT_LIGHT_SYNTAX_COLORS: SyntaxTokenColors = {
  keyword: "#0000ff",
  string: "#a31515",
  number: "#098658",
  comment: "#008000",
  operator: "#000000",
  identifier: "#001080",
  type: "#267f99",
};

export const DEFAULT_DARK_SYNTAX_COLORS: SyntaxTokenColors = {
  keyword: "#569cd6",
  string: "#ce9178",
  number: "#b5cea8",
  comment: "#6a9955",
  operator: "#d4d4d4",
  identifier: "#9cdcfe",
  type: "#4ec9b0",
};
