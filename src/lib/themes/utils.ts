import type { CustomTheme, ThemeColors, DatabaseIconColors } from "@/types/theme";

/**
 * Convert a ThemeColors object property name to CSS variable name
 */
function colorKeyToCssVar(key: keyof ThemeColors): string {
  const mapping: Record<keyof ThemeColors, string> = {
    background: "--background",
    foreground: "--foreground",
    card: "--card",
    cardForeground: "--card-foreground",
    popover: "--popover",
    popoverForeground: "--popover-foreground",
    primary: "--primary",
    primaryForeground: "--primary-foreground",
    secondary: "--secondary",
    secondaryForeground: "--secondary-foreground",
    muted: "--muted",
    mutedForeground: "--muted-foreground",
    accent: "--accent",
    accentForeground: "--accent-foreground",
    destructive: "--destructive",
    destructiveForeground: "--destructive-foreground",
    border: "--border",
    input: "--input",
    ring: "--ring",
    success: "--success",
    warning: "--warning",
    info: "--info",
    tableHeaderBg: "--table-header-bg",
    tableRowOdd: "--table-row-odd",
    tableRowEven: "--table-row-even",
    tableRowHover: "--table-row-hover",
    textPrimary: "--text-primary",
    textSecondary: "--text-secondary",
    textDim: "--text-dim",
    sidebarBackground: "--sidebar-background",
    sidebarForeground: "--sidebar-foreground",
    sidebarPrimary: "--sidebar-primary",
    sidebarPrimaryForeground: "--sidebar-primary-foreground",
    sidebarAccent: "--sidebar-accent",
    sidebarAccentForeground: "--sidebar-accent-foreground",
    sidebarBorder: "--sidebar-border",
    sidebarRing: "--sidebar-ring",
  };
  return mapping[key];
}

/**
 * Convert a DatabaseIconColors property name to CSS variable name
 */
function dbIconKeyToCssVar(key: keyof DatabaseIconColors): string {
  const mapping: Record<keyof DatabaseIconColors, string> = {
    postgresql: "--db-postgresql",
    mysql: "--db-mysql",
    mariadb: "--db-mariadb",
    sqlite: "--db-sqlite",
    mssql: "--db-mssql",
    oracle: "--db-oracle",
    mongodb: "--db-mongodb",
    redis: "--db-redis",
    cockroachdb: "--db-cockroachdb",
    cassandra: "--db-cassandra",
  };
  return mapping[key];
}

/**
 * Generate CSS custom properties from a custom theme
 */
export function generateThemeCss(theme: CustomTheme): string {
  const lines: string[] = [];

  // Add UI colors (HSL format)
  for (const [key, value] of Object.entries(theme.colors)) {
    const cssVar = colorKeyToCssVar(key as keyof ThemeColors);
    if (cssVar) {
      lines.push(`${cssVar}: ${value};`);
    }
  }

  // Add database icon colors (hex format)
  for (const [key, value] of Object.entries(theme.databaseIcons)) {
    const cssVar = dbIconKeyToCssVar(key as keyof DatabaseIconColors);
    if (cssVar) {
      lines.push(`${cssVar}: ${value};`);
    }
  }

  return lines.join("\n");
}

/**
 * Apply a custom theme to the document by injecting a style element
 */
export function applyCustomTheme(theme: CustomTheme): void {
  // Remove any existing custom theme style
  removeCustomTheme();

  // Remove all built-in theme classes
  const root = document.documentElement;
  root.classList.remove(
    "dark",
    "theme-classic-light",
    "theme-classic-dark",
    "theme-nordic-dark",
    "theme-nordic-light",
    "theme-solarized-dark",
    "theme-solarized-light",
    "theme-one-dark",
    "theme-high-contrast"
  );

  // Add dark class if base theme is dark
  if (theme.baseTheme === "dark") {
    root.classList.add("dark");
  }

  // Create and inject style element with custom CSS
  const css = generateThemeCss(theme);
  const styleId = "custom-theme-styles";
  const styleEl = document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = `:root {\n${css}\n}`;
  document.head.appendChild(styleEl);

  // Add custom theme marker class
  root.classList.add("custom-theme-active");
  root.dataset.customTheme = theme.id;
}

/**
 * Remove custom theme styling
 */
export function removeCustomTheme(): void {
  // Remove custom style element
  const styleEl = document.getElementById("custom-theme-styles");
  if (styleEl) {
    styleEl.remove();
  }

  // Remove custom theme marker
  const root = document.documentElement;
  root.classList.remove("custom-theme-active");
  delete root.dataset.customTheme;
}

/**
 * Check if a custom theme is currently active
 */
export function isCustomThemeActive(): boolean {
  return document.documentElement.classList.contains("custom-theme-active");
}

/**
 * Get the currently active custom theme ID, if any
 */
export function getActiveCustomThemeId(): string | null {
  return document.documentElement.dataset.customTheme || null;
}

/**
 * Convert HSL string to hex color
 * @param hsl HSL values as "h s% l%" (e.g., "220 14% 96%")
 */
export function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length !== 3) return "#000000";

  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace("%", "")) / 100;
  const l = parseFloat(parts[2].replace("%", "")) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex color to HSL string
 * @param hex Hex color (e.g., "#1a1a2e")
 * @returns HSL values as "h s% l%"
 */
export function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Validate a hex color string
 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Validate an HSL string
 */
export function isValidHsl(hsl: string): boolean {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length !== 3) return false;

  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace("%", ""));
  const l = parseFloat(parts[2].replace("%", ""));

  return !isNaN(h) && !isNaN(s) && !isNaN(l) &&
         h >= 0 && h <= 360 &&
         s >= 0 && s <= 100 &&
         l >= 0 && l <= 100;
}
