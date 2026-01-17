import type {
  ThemeValidationResult,
  ThemeColors,
  DatabaseIconColors,
  EditorThemeColors,
  SyntaxTokenColors,
} from "@/types/theme";
import { isValidHsl, isValidHex } from "./utils";

/**
 * Required keys for ThemeColors validation
 */
const REQUIRED_THEME_COLOR_KEYS: (keyof ThemeColors)[] = [
  "background", "foreground", "card", "cardForeground",
  "popover", "popoverForeground", "primary", "primaryForeground",
  "secondary", "secondaryForeground", "muted", "mutedForeground",
  "accent", "accentForeground", "destructive", "destructiveForeground",
  "border", "input", "ring", "success", "warning", "info",
  "tableHeaderBg", "tableRowOdd", "tableRowEven", "tableRowHover",
  "textPrimary", "textSecondary", "textDim",
  "sidebarBackground", "sidebarForeground", "sidebarPrimary",
  "sidebarPrimaryForeground", "sidebarAccent", "sidebarAccentForeground",
  "sidebarBorder", "sidebarRing",
];

/**
 * Required keys for DatabaseIconColors validation
 */
const REQUIRED_DB_ICON_KEYS: (keyof DatabaseIconColors)[] = [
  "postgresql", "mysql", "mariadb", "sqlite", "mssql",
  "oracle", "mongodb", "redis", "cockroachdb", "cassandra",
];

/**
 * Required keys for EditorThemeColors validation
 */
const REQUIRED_EDITOR_COLOR_KEYS: (keyof EditorThemeColors)[] = [
  "editorBackground", "editorForeground", "lineHighlightBackground",
  "selectionBackground", "lineNumberForeground", "lineNumberActiveForeground",
  "cursorForeground", "inactiveSelectionBackground", "widgetBackground",
  "widgetBorder", "suggestWidgetBackground", "suggestWidgetBorder",
  "suggestWidgetForeground", "suggestWidgetSelectedBackground",
  "suggestWidgetHighlightForeground", "scrollbarSliderBackground",
  "scrollbarSliderHoverBackground", "scrollbarSliderActiveBackground",
  "gutterBackground", "foldingControlForeground", "foldBackground",
];

/**
 * Required keys for SyntaxTokenColors validation
 */
const REQUIRED_SYNTAX_COLOR_KEYS: (keyof SyntaxTokenColors)[] = [
  "keyword", "string", "number", "comment", "operator", "identifier", "type",
];

/**
 * Validate theme colors (HSL format)
 */
export function validateThemeColors(colors: unknown): string[] {
  const errors: string[] = [];

  if (!colors || typeof colors !== "object") {
    return ["Colors object is required"];
  }

  const colorObj = colors as Record<string, unknown>;

  for (const key of REQUIRED_THEME_COLOR_KEYS) {
    const value = colorObj[key];
    if (typeof value !== "string") {
      errors.push(`Missing color: ${key}`);
    } else if (!isValidHsl(value)) {
      errors.push(`Invalid HSL format for ${key}: "${value}" (expected "H S% L%")`);
    }
  }

  return errors;
}

/**
 * Validate database icon colors (hex format)
 */
export function validateDatabaseIconColors(icons: unknown): string[] {
  const errors: string[] = [];

  if (!icons || typeof icons !== "object") {
    return ["Database icons object is required"];
  }

  const iconObj = icons as Record<string, unknown>;

  for (const key of REQUIRED_DB_ICON_KEYS) {
    const value = iconObj[key];
    if (typeof value !== "string") {
      errors.push(`Missing database icon color: ${key}`);
    } else if (!isValidHex(value)) {
      errors.push(`Invalid hex format for ${key}: "${value}" (expected "#RRGGBB")`);
    }
  }

  return errors;
}

/**
 * Validate editor colors (hex format)
 */
export function validateEditorColors(colors: unknown): string[] {
  const errors: string[] = [];

  if (!colors || typeof colors !== "object") {
    return ["Editor colors object is required"];
  }

  const colorObj = colors as Record<string, unknown>;

  for (const key of REQUIRED_EDITOR_COLOR_KEYS) {
    const value = colorObj[key];
    if (typeof value !== "string") {
      errors.push(`Missing editor color: ${key}`);
    } else if (!isValidHex(value)) {
      errors.push(`Invalid hex format for ${key}: "${value}" (expected "#RRGGBB")`);
    }
  }

  return errors;
}

/**
 * Validate syntax colors (hex format)
 */
export function validateSyntaxColors(colors: unknown): string[] {
  const errors: string[] = [];

  if (!colors || typeof colors !== "object") {
    return ["Syntax colors object is required"];
  }

  const colorObj = colors as Record<string, unknown>;

  for (const key of REQUIRED_SYNTAX_COLOR_KEYS) {
    const value = colorObj[key];
    if (typeof value !== "string") {
      errors.push(`Missing syntax color: ${key}`);
    } else if (!isValidHex(value)) {
      errors.push(`Invalid hex format for ${key}: "${value}" (expected "#RRGGBB")`);
    }
  }

  return errors;
}

/**
 * Validate a complete theme export format
 */
export function validateThemeExport(data: unknown): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid theme data"], warnings: [] };
  }

  const exportData = data as Record<string, unknown>;

  // Check format version
  if (exportData.formatVersion !== 1) {
    errors.push("Invalid or unsupported format version (expected 1)");
  }

  if (!exportData.theme || typeof exportData.theme !== "object") {
    errors.push("Missing theme object");
    return { valid: false, errors, warnings };
  }

  const theme = exportData.theme as Record<string, unknown>;

  // Validate required fields
  if (typeof theme.name !== "string" || theme.name.trim().length === 0) {
    errors.push("Theme name is required");
  } else if (theme.name.length > 50) {
    warnings.push("Theme name is very long (over 50 characters)");
  }

  if (theme.baseTheme !== "light" && theme.baseTheme !== "dark") {
    errors.push("Base theme must be 'light' or 'dark'");
  }

  // Validate all color sections
  errors.push(...validateThemeColors(theme.colors));
  errors.push(...validateDatabaseIconColors(theme.databaseIcons));
  errors.push(...validateEditorColors(theme.editorColors));
  errors.push(...validateSyntaxColors(theme.syntaxColors));

  // Add warnings for optional fields
  if (!theme.description) {
    warnings.push("Theme has no description");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a theme name
 */
export function validateThemeName(name: string, existingNames: string[]): string | null {
  if (!name || name.trim().length === 0) {
    return "Theme name is required";
  }

  if (name.trim().length < 2) {
    return "Theme name must be at least 2 characters";
  }

  if (name.length > 50) {
    return "Theme name must be 50 characters or less";
  }

  const normalizedName = name.trim().toLowerCase();
  if (existingNames.some((n) => n.toLowerCase() === normalizedName)) {
    return "A theme with this name already exists";
  }

  return null;
}
