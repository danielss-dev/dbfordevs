/**
 * Core Extension System Types
 */

/** Extension status */
export type ExtensionStatus =
  | "installed"
  | "active"
  | "disabled"
  | { error: string }
  | "installing"
  | "updating";

/** Extension category */
export type ExtensionCategory =
  | "validator"
  | "ai"
  | "exporter"
  | "theme"
  | "connector"
  | { other: string };

/** Extension information from the backend */
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  status: ExtensionStatus;
  isOfficial: boolean;
  repository?: string;
  icon?: string;
}

/** Extension settings (Generic) */
export interface ExtensionSettings {
  [key: string]: any;
}

/** Request to install from GitHub */
export interface InstallFromGitHubRequest {
  repositoryUrl: string;
}



