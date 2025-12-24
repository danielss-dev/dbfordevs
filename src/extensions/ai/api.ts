/**
 * AI Assistant API
 *
 * Tauri commands for interacting with the AI extension.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  GenerateSQLRequest,
  GeneratedSQL,
  ExplainQueryRequest,
  QueryExplanation,
  AIChatRequest,
  AIChatResponse,
} from "./types";

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

