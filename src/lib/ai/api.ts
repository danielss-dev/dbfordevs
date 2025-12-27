/**
 * AI Assistant API
 *
 * Direct AI SDK implementation with streaming, token tracking, and error recovery.
 */

import { generateText, streamText } from "ai";
import { getProviderModel } from "./providers";
import {
  sqlGenerationPrompt,
  queryExplanationPrompt,
  optimizationPrompt,
  type QueryContext,
} from "./prompts";
import type {
  GenerateSQLRequest,
  GeneratedSQL,
  ExplainQueryRequest,
  QueryExplanation,
  AIChatRequest,
  AISettings,
  AIModelsConfig,
  TokenUsage,
  SuggestedAction,
  QueryVariant,
  QueryDiff,
  AIChatMessage,
} from "./types";
import { AVAILABLE_MODELS, MODEL_PRICING } from "./types";

/** Maximum retry attempts for failed requests */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY = 1000;

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
    currentQuery: request.currentQuery,
  };
}

/**
 * Calculate cost estimate from token usage
 */
export function calculateCost(usage: TokenUsage, modelId: string): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return 0;

  const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Rate limits, timeouts, and temporary server errors are retryable
    return (
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("timeout") ||
      message.includes("503") ||
      message.includes("502") ||
      message.includes("500") ||
      message.includes("overloaded")
    );
  }
  return false;
}

/**
 * Execute with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error) || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
      console.log(`[AI API] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Generate suggested follow-up actions based on context and response
 */
function generateSuggestedActions(
  _userMessage: string,
  _response: string,
  sql?: string,
  context?: QueryContext
): SuggestedAction[] {
  const suggestions: SuggestedAction[] = [];

  if (sql) {
    // SQL-specific suggestions
    suggestions.push({
      label: "Add pagination",
      prompt: "Add LIMIT and OFFSET pagination to this query",
      icon: "list",
    });

    suggestions.push({
      label: "Optimize query",
      prompt: "Optimize this SQL query for better performance",
      icon: "zap",
    });

    if (sql.toLowerCase().includes("select")) {
      suggestions.push({
        label: "Add filters",
        prompt: "Add a WHERE clause to filter the results",
        icon: "filter",
      });

      suggestions.push({
        label: "Add sorting",
        prompt: "Add ORDER BY to sort the results",
        icon: "arrow-up-down",
      });
    }

    if (sql.toLowerCase().includes("join")) {
      suggestions.push({
        label: "Explain joins",
        prompt: "Explain how the JOINs work in this query",
        icon: "help-circle",
      });
    }
  } else {
    // General conversation suggestions - only show when we have context
    if (context?.tables && context.tables.length > 0) {
      // Suggest querying a specific table
      const randomTable = context.tables[Math.floor(Math.random() * context.tables.length)];
      suggestions.push({
        label: `Query ${randomTable.name}`,
        prompt: `Show me all records from ${randomTable.name}`,
        icon: "table",
      });

      // Suggest exploring table structure
      suggestions.push({
        label: `Describe ${randomTable.name}`,
        prompt: `Describe the structure and columns of ${randomTable.name}`,
        icon: "database",
      });
    }
    // Don't add generic fallback suggestions - they're not contextually useful
  }

  // Limit to 4 suggestions
  return suggestions.slice(0, 4);
}

/**
 * Generate SQL from natural language using AI SDK
 */
export async function aiGenerateSQL(
  request: GenerateSQLRequest,
  settings: AISettings
): Promise<GeneratedSQL> {
  console.log("[AI API] aiGenerateSQL request:", JSON.stringify(request, null, 2));

  return withRetry(async () => {
    const model = getProviderModel(settings);
    const context = buildQueryContext(request);
    const systemPrompt = sqlGenerationPrompt(context);

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
      confidence: 0.9,
    };
  });
}

/**
 * Explain a SQL query using AI SDK
 */
export async function aiExplainQuery(
  request: ExplainQueryRequest,
  settings: AISettings
): Promise<QueryExplanation> {
  console.log("[AI API] aiExplainQuery request:", JSON.stringify(request, null, 2));

  return withRetry(async () => {
    const model = getProviderModel(settings);
    const context: QueryContext = {
      databaseType: request.databaseType,
      tables: [],
    };
    const systemPrompt = queryExplanationPrompt(context);

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
  });
}

/**
 * Convert AIChatMessage to AI SDK CoreMessage format
 */
function convertToCoreMessages(messages: AIChatMessage[]) {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
}

/** Extended response with streaming and metadata */
export interface StreamingChatResponse {
  message: string;
  sql?: string;
  explanation?: string;
  usage?: TokenUsage;
  suggestedActions?: SuggestedAction[];
  queryVariants?: QueryVariant[];
  queryDiff?: QueryDiff;
}

/**
 * Chat with AI assistant - streaming version
 * Returns an async generator that yields partial responses
 */
export async function* aiChatStream(
  request: AIChatRequest,
  messages: AIChatMessage[],
  settings: AISettings
): AsyncGenerator<{ text: string; done: boolean; usage?: TokenUsage }> {
  console.log("[AI API] aiChatStream request:", JSON.stringify(request, null, 2));
  console.log("[AI API] Message history length:", messages.length);

  const { chatPrompt } = await import("./prompts");

  const model = getProviderModel(settings);
  const context: QueryContext = request.context
    ? buildQueryContext(request.context)
    : { tables: [] };
  const systemPrompt = chatPrompt(context);

  // Convert message history to AI SDK format
  const coreMessages = convertToCoreMessages(messages);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: coreMessages,
    temperature: settings.aiTemperature ?? 0.3,
    maxOutputTokens: settings.aiMaxTokens ?? 2048,
  });

  let fullText = "";

  for await (const chunk of result.textStream) {
    fullText += chunk;
    yield { text: fullText, done: false };
  }

  // Get final usage after stream completes
  const usage = await result.usage;
  const tokenUsage: TokenUsage | undefined = usage ? {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  } : undefined;

  yield { text: fullText, done: true, usage: tokenUsage };
}

/**
 * Chat with AI assistant - non-streaming version with enhanced response
 */
export async function aiChat(
  request: AIChatRequest,
  messages: AIChatMessage[],
  settings: AISettings
): Promise<StreamingChatResponse> {
  console.log("[AI API] aiChat request:", JSON.stringify(request, null, 2));
  console.log("[AI API] Message history length:", messages.length);

  return withRetry(async () => {
    const { chatPrompt } = await import("./prompts");

    const model = getProviderModel(settings);
    const context: QueryContext = request.context
      ? buildQueryContext(request.context)
      : { tables: [] };
    const systemPrompt = chatPrompt(context);

    // Convert message history to AI SDK format
    const coreMessages = convertToCoreMessages(messages);

    const { text, usage } = await generateText({
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

    const tokenUsage: TokenUsage | undefined = usage ? {
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    } : undefined;

    // Generate suggested follow-up actions
    const suggestedActions = generateSuggestedActions(
      request.message,
      text,
      looksLikeSQL ? sql : undefined,
      context
    );

    if (looksLikeSQL) {
      return {
        message: "Here's the SQL query for your request:",
        sql,
        explanation: undefined,
        usage: tokenUsage,
        suggestedActions,
      };
    }

    // Not SQL - return as message
    return {
      message: text,
      sql: undefined,
      explanation: undefined,
      usage: tokenUsage,
      suggestedActions,
    };
  });
}

/**
 * Generate multiple query variants for the same request
 */
export async function aiGenerateMultipleQueries(
  request: GenerateSQLRequest,
  settings: AISettings,
  count: number = 3
): Promise<QueryVariant[]> {
  console.log("[AI API] aiGenerateMultipleQueries request:", JSON.stringify(request, null, 2));

  return withRetry(async () => {
    const model = getProviderModel(settings);
    const context = buildQueryContext(request);
    const systemPrompt = sqlGenerationPrompt(context) + `

ADDITIONAL INSTRUCTION:
Generate exactly ${count} different SQL query variants that accomplish the same goal.
For each variant, provide:
1. The SQL query
2. A brief description of the approach
3. When this approach might be preferred

Format your response as:
--- VARIANT 1 ---
APPROACH: [Brief name of approach]
DESCRIPTION: [When to use this approach]
SQL:
\`\`\`sql
[SQL query]
\`\`\`

--- VARIANT 2 ---
...and so on.
`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: request.prompt,
      temperature: 0.7, // Higher temperature for more variation
      maxOutputTokens: settings.aiMaxTokens ?? 4096,
    });

    console.log("[AI API] aiGenerateMultipleQueries response:", text);

    // Parse variants from response
    const variants: QueryVariant[] = [];
    const variantPattern = /---\s*VARIANT\s*\d+\s*---\s*APPROACH:\s*(.+?)\s*DESCRIPTION:\s*(.+?)\s*SQL:\s*```(?:sql)?\s*([\s\S]+?)```/gi;

    let match;
    while ((match = variantPattern.exec(text)) !== null) {
      variants.push({
        approach: match[1].trim(),
        description: match[2].trim(),
        sql: match[3].trim(),
      });
    }

    // Fallback: if parsing failed, try to extract any SQL blocks
    if (variants.length === 0) {
      const sqlBlocks = text.match(/```(?:sql)?\s*([\s\S]+?)```/gi) || [];
      sqlBlocks.forEach((block, i) => {
        const sql = block.replace(/```(?:sql)?/gi, "").trim();
        variants.push({
          approach: `Variant ${i + 1}`,
          description: "Alternative approach",
          sql,
        });
      });
    }

    return variants.slice(0, count);
  });
}

/**
 * Optimize a SQL query and return a diff
 */
export async function aiOptimizeQuery(
  sql: string,
  settings: AISettings,
  databaseType?: string
): Promise<QueryDiff> {
  console.log("[AI API] aiOptimizeQuery request:", sql);

  return withRetry(async () => {
    const model = getProviderModel(settings);
    const context: QueryContext = {
      databaseType,
      tables: [],
    };
    const systemPrompt = optimizationPrompt(context) + `

ADDITIONAL INSTRUCTION:
After your analysis, provide a clear list of specific changes made.
Format the changes section as:
CHANGES:
- [Change 1]
- [Change 2]
...

Then provide the optimized query in a code block.
`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `Please optimize the following SQL query:\n\n\`\`\`sql\n${sql}\n\`\`\``,
      temperature: settings.aiTemperature ?? 0.3,
      maxOutputTokens: settings.aiMaxTokens ?? 2048,
    });

    console.log("[AI API] aiOptimizeQuery response:", text);

    // Extract optimized SQL
    const optimizedSQL = parseSQLFromResponse(text);

    // Extract changes list
    const changesMatch = text.match(/CHANGES:\s*([\s\S]*?)(?=\n\n|```|$)/i);
    const changes: string[] = [];

    if (changesMatch) {
      const changeLines = changesMatch[1].split(/\n[-*]\s*/);
      changeLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("CHANGES")) {
          changes.push(trimmed);
        }
      });
    }

    return {
      original: sql,
      optimized: optimizedSQL,
      changes: changes.length > 0 ? changes : ["Query structure optimized"],
    };
  });
}

/**
 * Get available AI models
 * Now returns frontend-defined constants (no backend call needed)
 */
export async function getAIModels(): Promise<AIModelsConfig> {
  return AVAILABLE_MODELS;
}
