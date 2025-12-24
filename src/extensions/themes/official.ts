/**
 * Official Theme Extensions
 *
 * Bundled themes that ship with dbfordevs.
 * These are registered on app initialization.
 */

import type { ThemeDefinition } from "./index";

// ============================================================================
// Nordic Theme - Dark Variant
// An arctic, north-bluish color palette based on Nord
// ============================================================================

const NORDIC_DARK_CSS = `
/* Nordic Dark Theme - An arctic, north-bluish color palette */
/* Based on Nord (https://www.nordtheme.com/) */

.theme-nordic-dark {
  /* Background colors - Polar Night */
  --background: 220 16% 22%;
  --foreground: 218 27% 92%;
  
  /* Card colors - Polar Night (lighter) */
  --card: 220 17% 24%;
  --card-foreground: 218 27% 92%;
  
  /* Popover colors */
  --popover: 220 16% 22%;
  --popover-foreground: 218 27% 92%;
  
  /* Primary - Frost Blue (nord8: #88C0D0) */
  --primary: 193 43% 67%;
  --primary-foreground: 220 16% 22%;
  
  /* Secondary - Polar Night (nord2) */
  --secondary: 220 16% 31%;
  --secondary-foreground: 218 27% 92%;
  
  /* Muted colors */
  --muted: 220 16% 31%;
  --muted-foreground: 220 17% 40%;
  
  /* Accent - Frost (nord9: #81A1C1) */
  --accent: 213 32% 63%;
  --accent-foreground: 220 16% 22%;
  
  /* Destructive - Aurora Red (nord11: #BF616A) */
  --destructive: 354 42% 56%;
  --destructive-foreground: 218 27% 92%;
  
  /* Border and input */
  --border: 220 16% 36%;
  --input: 220 16% 36%;
  --ring: 193 43% 67%;
  
  /* Semantic colors - Aurora */
  --success: 92 28% 65%;
  --warning: 40 81% 73%;
  --info: 193 43% 67%;
  
  /* Table Specifics */
  --table-header-bg: 220 16% 20%;
  --table-row-odd: 220 16% 22%;
  --table-row-even: 220 17% 24%;
  --table-row-hover: 220 16% 28%;
  
  /* Text Hierarchy */
  --text-primary: 218 27% 92%;
  --text-secondary: 218 20% 70%;
  --text-dim: 220 17% 50%;
  
  /* Sidebar - Polar Night darker */
  --sidebar-background: 220 16% 18%;
  --sidebar-foreground: 218 27% 92%;
  --sidebar-primary: 193 43% 67%;
  --sidebar-primary-foreground: 220 16% 22%;
  --sidebar-accent: 220 16% 26%;
  --sidebar-accent-foreground: 218 27% 92%;
  --sidebar-border: 220 16% 28%;
  --sidebar-ring: 193 43% 67%;
}
`;

export const nordicDarkTheme: ThemeDefinition = {
  id: "nordic-dark",
  name: "Nordic Dark",
  description: "An arctic, north-bluish color palette inspired by the Nordic wilderness. Features cool blues, soft whites, and aurora accents.",
  author: "dbfordevs",
  version: "1.0.0",
  variant: "dark",
  isOfficial: true,
  css: NORDIC_DARK_CSS,
};

// ============================================================================
// Nordic Theme - Light Variant
// ============================================================================

const NORDIC_LIGHT_CSS = `
/* Nordic Light Theme - Snow Storm backgrounds with Polar Night text */

.theme-nordic-light {
  /* Background colors - Snow Storm */
  --background: 219 28% 96%;
  --foreground: 220 16% 22%;
  
  /* Card colors */
  --card: 220 27% 98%;
  --card-foreground: 220 16% 22%;
  
  /* Popover colors */
  --popover: 220 27% 98%;
  --popover-foreground: 220 16% 22%;
  
  /* Primary - Deep Frost (nord10: #5E81AC) */
  --primary: 213 32% 52%;
  --primary-foreground: 219 28% 96%;
  
  /* Secondary - Snow Storm (darker) */
  --secondary: 219 28% 88%;
  --secondary-foreground: 220 16% 22%;
  
  /* Muted colors */
  --muted: 219 28% 90%;
  --muted-foreground: 220 16% 36%;
  
  /* Accent - Frost (nord9: #81A1C1) */
  --accent: 213 32% 63%;
  --accent-foreground: 220 16% 22%;
  
  /* Destructive - Aurora Red (nord11: #BF616A) */
  --destructive: 354 42% 56%;
  --destructive-foreground: 219 28% 96%;
  
  /* Border and input */
  --border: 218 27% 82%;
  --input: 218 27% 82%;
  --ring: 213 32% 52%;
  
  /* Semantic colors - Aurora (darker for contrast) */
  --success: 92 28% 52%;
  --warning: 28 72% 50%;
  --info: 213 32% 52%;
  
  /* Table Specifics */
  --table-header-bg: 219 28% 92%;
  --table-row-odd: 219 28% 96%;
  --table-row-even: 220 27% 98%;
  --table-row-hover: 219 28% 88%;
  
  /* Text Hierarchy */
  --text-primary: 220 16% 22%;
  --text-secondary: 220 16% 36%;
  --text-dim: 220 17% 50%;
  
  /* Sidebar - Slightly darker */
  --sidebar-background: 219 28% 94%;
  --sidebar-foreground: 220 16% 22%;
  --sidebar-primary: 213 32% 52%;
  --sidebar-primary-foreground: 219 28% 96%;
  --sidebar-accent: 219 28% 88%;
  --sidebar-accent-foreground: 220 16% 22%;
  --sidebar-border: 218 27% 82%;
  --sidebar-ring: 213 32% 52%;
}
`;

export const nordicLightTheme: ThemeDefinition = {
  id: "nordic-light",
  name: "Nordic Light",
  description: "A light variant of the Nordic theme with Snow Storm backgrounds and Polar Night text.",
  author: "dbfordevs",
  version: "1.0.0",
  variant: "light",
  isOfficial: true,
  css: NORDIC_LIGHT_CSS,
};

// ============================================================================
// All Official Themes
// ============================================================================

export const officialThemes: ThemeDefinition[] = [
  nordicDarkTheme,
  nordicLightTheme,
];

/**
 * Register all official themes with the theme store
 */
export function registerOfficialThemes(register: (theme: ThemeDefinition) => void): void {
  officialThemes.forEach(register);
}

