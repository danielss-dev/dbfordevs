/**
 * AI Assistant API
 *
 * Direct AI SDK implementation - no backend/Tauri calls needed.
 */

import { generateText } from "ai";
import { getProviderModel } from "./providers";
import {
  sqlGenerationPrompt,
  queryExplanationPrompt,
  type QueryContext,
} from "./prompts";
import type {
  GenerateSQLRequest,
  GeneratedSQL,
  ExplainQueryRequest,
  QueryExplanation,
  AIChatRequest,
  AIChatResponse,
  AISettings,
  AIModelsConfig,
} from "./types";
import { AVAILABLE_MODELS } from "./types";

/**
 * Parse SQL from AI response text
 * Handles both raw SQL and markdown code blocks
 */
function parseSQLFromResponse(text: string): string {
  // Try to extract from markdown code block first
  const codeBlockMatch = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Otherwise return the text as-is (trimmed)
  return text.trim();
}

/**
 * Build query context from request
 */
function buildQueryContext(request: GenerateSQLRequest): QueryContext {
  return {
    databaseType: request.databaseType,
    databaseName: request.databaseName,
    schemaName: request.schemaName,
    tables: request.tables,
    selectedTable: request.selectedTable,
  };
}

/**
 * Generate SQL from natural language using AI SDK
 */
export async function aiGenerateSQL(
  request: GenerateSQLRequest,
  settings: AISettings
): Promise<GeneratedSQL> {
  console.log("[AI API] aiGenerateSQL request:", JSON.stringify(request, null, 2));

  const model = getProviderModel(settings);
  const context = buildQueryContext(request);
  const systemPrompt = sqlGenerationPrompt(context);

  try {
    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      prompt: request.prompt,
      temperature: settings.aiTemperature ?? 0.3,
      maxOutputTokens: settings.aiMaxTokens ?? 2048,
    });

    console.log("[AI API] aiGenerateSQL response:", text);
    console.log("[AI API] Token usage:", usage);

    const sql = parseSQLFromResponse(text);

    return {
      sql,
      explanation: undefined,
      confidence: 0.9, // AI SDK doesn't provide confidence, use default
    };
  } catch (error) {
    console.error("[AI API] aiGenerateSQL error:", error);
    throw error;
  }
}

/**
 * Explain a SQL query using AI SDK
 */
export async function aiExplainQuery(
  request: ExplainQueryRequest,
  settings: AISettings
): Promise<QueryExplanation> {
  console.log("[AI API] aiExplainQuery request:", JSON.stringify(request, null, 2));

  const model = getProviderModel(settings);
  const context: QueryContext = {
    databaseType: request.databaseType,
    tables: [],
  };
  const systemPrompt = queryExplanationPrompt(context);

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `Please explain the following SQL query:\n\n${request.sql}`,
      temperature: settings.aiTemperature ?? 0.3,
      maxOutputTokens: settings.aiMaxTokens ?? 2048,
    });

    console.log("[AI API] aiExplainQuery response:", text);

    // Parse the structured response
    const summaryMatch = text.match(/\*\*Summary:\*\*\s*(.+?)(?=\n\*\*|$)/s);
    const stepsMatch = text.match(
      /\*\*Step-by-step breakdown:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/
    );
    const warningsMatch = text.match(
      /\*\*Potential issues:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/
    );

    const steps = stepsMatch
      ? stepsMatch[1]
          .split(/\n\d+\.\s+/)
          .filter((s) => s.trim())
          .map((s) => s.trim())
      : [];

    const warnings = warningsMatch
      ? warningsMatch[1]
          .split(/\n[-*]\s+/)
          .filter((s) => s.trim())
          .map((s) => s.trim())
      : [];

    return {
      summary: summaryMatch ? summaryMatch[1].trim() : text.split("\n")[0],
      steps,
      warnings,
    };
  } catch (error) {
    console.error("[AI API] aiExplainQuery error:", error);
    throw error;
  }
}

/**
 * Convert AIChatMessage to AI SDK CoreMessage format
 */
function convertToCoreMessages(messages: import("./types").AIChatMessage[]) {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
}

/**
 * Chat with AI assistant - conversational chatbot with message history
 */
export async function aiChat(
  request: AIChatRequest,
  messages: import("./types").AIChatMessage[],
  settings: AISettings
): Promise<AIChatResponse> {
  console.log("[AI API] aiChat request:", JSON.stringify(request, null, 2));
  console.log("[AI API] Message history length:", messages.length);

  const { chatPrompt } = await import("./prompts");

  const model = getProviderModel(settings);
  const context: QueryContext = request.context
    ? buildQueryContext(request.context)
    : { tables: [] };
  const systemPrompt = chatPrompt(context);

  try {
    // Convert message history to AI SDK format
    const coreMessages = convertToCoreMessages(messages);

    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      temperature: settings.aiTemperature ?? 0.3,
      maxOutputTokens: settings.aiMaxTokens ?? 2048,
    });

    console.log("[AI API] aiChat response:", text);

    // Check if the response looks like SQL
    const sql = parseSQLFromResponse(text);
    const looksLikeSQL =
      /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\s/i.test(
        sql
      );

    if (looksLikeSQL) {
      return {
        message: "Here's the SQL query for your request:",
        sql,
        explanation: undefined,
      };
    }

    // Not SQL - return as message
    return {
      message: text,
      sql: undefined,
      explanation: undefined,
    };
  } catch (error) {
    console.error("[AI API] aiChat error:", error);
    throw error;
  }
}

/**
 * Get available AI models
 * Now returns frontend-defined constants (no backend call needed)
 */
export async function getAIModels(): Promise<AIModelsConfig> {
  return AVAILABLE_MODELS;
}
