/**
 * Extension API
 *
 * Tauri commands for interacting with the extension system.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  ExtensionInfo,
  ExtensionSettings,
  InstallFromGitHubRequest,
  GenerateSQLRequest,
  GeneratedSQL,
  ExplainQueryRequest,
  QueryExplanation,
  AIChatRequest,
  AIChatResponse,
} from "./types";

// ============================================================================
// Extension Management
// ============================================================================

/** List all installed extensions */
export async function listExtensions(): Promise<ExtensionInfo[]> {
  return invoke("list_extensions");
}

/** Get extension by ID */
export async function getExtension(
  extensionId: string
): Promise<ExtensionInfo | null> {
  return invoke("get_extension", { extensionId });
}

/** Enable an extension */
export async function enableExtension(extensionId: string): Promise<void> {
  return invoke("enable_extension", { extensionId });
}

/** Disable an extension */
export async function disableExtension(extensionId: string): Promise<void> {
  return invoke("disable_extension", { extensionId });
}

/** Uninstall an extension */
export async function uninstallExtension(extensionId: string): Promise<void> {
  return invoke("uninstall_extension", { extensionId });
}

/** Install extension from GitHub repository */
export async function installExtensionFromGitHub(
  request: InstallFromGitHubRequest
): Promise<ExtensionInfo> {
  return invoke("install_extension_from_github", { request });
}

/** Update extension settings */
export async function updateExtensionSettings(
  settings: ExtensionSettings
): Promise<void> {
  return invoke("update_extension_settings", { settings });
}

/** Get extension settings */
export async function getExtensionSettings(): Promise<ExtensionSettings> {
  return invoke("get_extension_settings");
}

// ============================================================================
// AI Assistant
// ============================================================================

/** Generate SQL from natural language */
export async function aiGenerateSQL(
  request: GenerateSQLRequest
): Promise<GeneratedSQL> {
  return invoke("ai_generate_sql", { request });
}

/** Explain a SQL query */
export async function aiExplainQuery(
  request: ExplainQueryRequest
): Promise<QueryExplanation> {
  return invoke("ai_explain_query", { request });
}

/** Chat with AI assistant */
export async function aiChat(request: AIChatRequest): Promise<AIChatResponse> {
  return invoke("ai_chat", { request });
}

