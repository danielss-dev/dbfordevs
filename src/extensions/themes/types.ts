/**
 * Theme Types
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  variant: "light" | "dark";
  isOfficial: boolean;
  /** CSS content - can be inline CSS or URL to CSS file */
  css: string;
  /** Whether CSS is a URL (true) or inline CSS string (false) */
  isUrl?: boolean;
}



