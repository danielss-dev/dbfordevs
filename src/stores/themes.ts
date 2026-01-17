import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CustomTheme,
  ThemeExportFormat,
  ThemeValidationResult,
  ThemeColors,
  DatabaseIconColors,
  EditorThemeColors,
  SyntaxTokenColors,
} from "@/types/theme";
import {
  DEFAULT_LIGHT_THEME_COLORS,
  DEFAULT_DARK_THEME_COLORS,
  DEFAULT_LIGHT_DATABASE_ICONS,
  DEFAULT_DARK_DATABASE_ICONS,
  DEFAULT_LIGHT_EDITOR_COLORS,
  DEFAULT_DARK_EDITOR_COLORS,
  DEFAULT_LIGHT_SYNTAX_COLORS,
  DEFAULT_DARK_SYNTAX_COLORS,
} from "@/types/theme";

interface ThemesState {
  customThemes: CustomTheme[];

  // Actions
  addTheme: (theme: Omit<CustomTheme, "id" | "createdAt" | "updatedAt">) => string;
  updateTheme: (id: string, updates: Partial<Omit<CustomTheme, "id" | "createdAt">>) => void;
  removeTheme: (id: string) => void;
  duplicateTheme: (id: string, newName: string) => string | null;
  getThemeById: (id: string) => CustomTheme | undefined;
  importTheme: (exportData: ThemeExportFormat) => ThemeValidationResult & { themeId?: string };
  exportTheme: (id: string) => ThemeExportFormat | null;
}

function generateId(): string {
  return `theme_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function validateThemeColors(colors: unknown): string[] {
  const errors: string[] = [];
  if (!colors || typeof colors !== "object") {
    errors.push("Colors object is required");
    return errors;
  }

  const requiredColorKeys: (keyof ThemeColors)[] = [
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

  const colorObj = colors as Record<string, unknown>;
  for (const key of requiredColorKeys) {
    if (typeof colorObj[key] !== "string") {
      errors.push(`Missing or invalid color: ${key}`);
    }
  }

  return errors;
}

function validateDatabaseIcons(icons: unknown): string[] {
  const errors: string[] = [];
  if (!icons || typeof icons !== "object") {
    errors.push("Database icons object is required");
    return errors;
  }

  const requiredKeys: (keyof DatabaseIconColors)[] = [
    "postgresql", "mysql", "mariadb", "sqlite", "mssql",
    "oracle", "mongodb", "redis", "cockroachdb", "cassandra",
  ];

  const iconObj = icons as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (typeof iconObj[key] !== "string" || !iconObj[key].toString().match(/^#[0-9A-Fa-f]{6}$/)) {
      errors.push(`Invalid database icon color: ${key} (must be hex format #RRGGBB)`);
    }
  }

  return errors;
}

function validateEditorColors(colors: unknown): string[] {
  const errors: string[] = [];
  if (!colors || typeof colors !== "object") {
    errors.push("Editor colors object is required");
    return errors;
  }

  const requiredKeys: (keyof EditorThemeColors)[] = [
    "editorBackground", "editorForeground", "lineHighlightBackground",
    "selectionBackground", "lineNumberForeground", "lineNumberActiveForeground",
    "cursorForeground", "inactiveSelectionBackground", "widgetBackground",
    "widgetBorder", "suggestWidgetBackground", "suggestWidgetBorder",
    "suggestWidgetForeground", "suggestWidgetSelectedBackground",
    "suggestWidgetHighlightForeground", "scrollbarSliderBackground",
    "scrollbarSliderHoverBackground", "scrollbarSliderActiveBackground",
    "gutterBackground", "foldingControlForeground", "foldBackground",
  ];

  const colorObj = colors as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (typeof colorObj[key] !== "string") {
      errors.push(`Missing or invalid editor color: ${key}`);
    }
  }

  return errors;
}

function validateSyntaxColors(colors: unknown): string[] {
  const errors: string[] = [];
  if (!colors || typeof colors !== "object") {
    errors.push("Syntax colors object is required");
    return errors;
  }

  const requiredKeys: (keyof SyntaxTokenColors)[] = [
    "keyword", "string", "number", "comment", "operator", "identifier", "type",
  ];

  const colorObj = colors as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (typeof colorObj[key] !== "string" || !colorObj[key].toString().match(/^#[0-9A-Fa-f]{6}$/)) {
      errors.push(`Invalid syntax color: ${key} (must be hex format #RRGGBB)`);
    }
  }

  return errors;
}

function validateTheme(data: unknown): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid theme data"], warnings: [] };
  }

  const exportData = data as Record<string, unknown>;

  // Check format version
  if (exportData.formatVersion !== 1) {
    errors.push("Invalid or missing format version");
  }

  if (!exportData.theme || typeof exportData.theme !== "object") {
    errors.push("Missing theme object");
    return { valid: false, errors, warnings };
  }

  const theme = exportData.theme as Record<string, unknown>;

  // Validate required fields
  if (typeof theme.name !== "string" || theme.name.trim().length === 0) {
    errors.push("Theme name is required");
  }

  if (theme.baseTheme !== "light" && theme.baseTheme !== "dark") {
    errors.push("Base theme must be 'light' or 'dark'");
  }

  // Validate color objects
  errors.push(...validateThemeColors(theme.colors));
  errors.push(...validateDatabaseIcons(theme.databaseIcons));
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

export const useThemesStore = create<ThemesState>()(
  persist(
    (set, get) => ({
      customThemes: [],

      addTheme: (themeData) => {
        const id = generateId();
        const now = Date.now();
        const newTheme: CustomTheme = {
          ...themeData,
          id,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          customThemes: [...state.customThemes, newTheme],
        }));

        return id;
      },

      updateTheme: (id, updates) => {
        set((state) => ({
          customThemes: state.customThemes.map((theme) =>
            theme.id === id
              ? { ...theme, ...updates, updatedAt: Date.now() }
              : theme
          ),
        }));
      },

      removeTheme: (id) => {
        set((state) => ({
          customThemes: state.customThemes.filter((theme) => theme.id !== id),
        }));
      },

      duplicateTheme: (id, newName) => {
        const original = get().customThemes.find((t) => t.id === id);
        if (!original) return null;

        const newId = generateId();
        const now = Date.now();
        const duplicated: CustomTheme = {
          ...original,
          id: newId,
          name: newName,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          customThemes: [...state.customThemes, duplicated],
        }));

        return newId;
      },

      getThemeById: (id) => {
        return get().customThemes.find((t) => t.id === id);
      },

      importTheme: (exportData) => {
        const validation = validateTheme(exportData);
        if (!validation.valid) {
          return validation;
        }

        const themeData = exportData.theme;
        const id = get().addTheme({
          name: themeData.name,
          description: themeData.description,
          baseTheme: themeData.baseTheme,
          colors: themeData.colors,
          databaseIcons: themeData.databaseIcons,
          editorColors: themeData.editorColors,
          syntaxColors: themeData.syntaxColors,
        });

        return { ...validation, themeId: id };
      },

      exportTheme: (id) => {
        const theme = get().customThemes.find((t) => t.id === id);
        if (!theme) return null;

        return {
          formatVersion: 1,
          theme: {
            name: theme.name,
            description: theme.description,
            baseTheme: theme.baseTheme,
            colors: theme.colors,
            databaseIcons: theme.databaseIcons,
            editorColors: theme.editorColors,
            syntaxColors: theme.syntaxColors,
          },
        };
      },
    }),
    {
      name: "dbfordevs-custom-themes",
      partialize: (state) => ({
        customThemes: state.customThemes,
      }),
    }
  )
);

/**
 * Create a new custom theme with default values based on base theme
 */
export function createDefaultCustomTheme(
  name: string,
  baseTheme: "light" | "dark"
): Omit<CustomTheme, "id" | "createdAt" | "updatedAt"> {
  const isLight = baseTheme === "light";

  return {
    name,
    baseTheme,
    colors: isLight ? { ...DEFAULT_LIGHT_THEME_COLORS } : { ...DEFAULT_DARK_THEME_COLORS },
    databaseIcons: isLight ? { ...DEFAULT_LIGHT_DATABASE_ICONS } : { ...DEFAULT_DARK_DATABASE_ICONS },
    editorColors: isLight ? { ...DEFAULT_LIGHT_EDITOR_COLORS } : { ...DEFAULT_DARK_EDITOR_COLORS },
    syntaxColors: isLight ? { ...DEFAULT_LIGHT_SYNTAX_COLORS } : { ...DEFAULT_DARK_SYNTAX_COLORS },
  };
}
