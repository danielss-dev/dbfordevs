/**
 * AI Provider Configuration
 *
 * Creates and configures AI SDK providers with Tauri HTTP fetch
 * to bypass CORS restrictions.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { tauriFetchWrapper } from "./tauri-fetch";
import type { AISettings, AIProviderType } from "./types";

/**
 * Create an Anthropic provider instance with Tauri fetch
 */
export function createAnthropicProvider(apiKey: string) {
  return createAnthropic({
    apiKey,
    fetch: tauriFetchWrapper,
    headers: {
      "anthropic-dangerous-direct-browser-access": "true",
    },
  });
}

/**
 * Create a Google Generative AI (Gemini) provider instance with Tauri fetch
 */
export function createGeminiProvider(apiKey: string) {
  return createGoogleGenerativeAI({
    apiKey,
    fetch: tauriFetchWrapper,
  });
}

/**
 * Get the appropriate provider and model based on settings
 */
export function getProviderModel(settings: AISettings) {
  const provider = settings.aiProvider || "anthropic";

  if (provider === "anthropic") {
    const apiKey = settings.aiAnthropicApiKey || settings.aiApiKey;
    if (!apiKey) {
      throw new Error("Anthropic API key is not configured");
    }
    const anthropic = createAnthropicProvider(apiKey);
    const modelId = settings.aiAnthropicModel || "claude-haiku-4-5-20251001";
    return anthropic(modelId);
  }

  if (provider === "gemini") {
    const apiKey = settings.aiGeminiApiKey;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    const gemini = createGeminiProvider(apiKey);
    const modelId = settings.aiGeminiModel || "gemini-3-flash-preview";
    return gemini(modelId);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Validate an API key by attempting a minimal API call
 */
export async function validateApiKey(
  provider: AIProviderType,
  apiKey: string
): Promise<boolean> {
  try {
    const { generateText } = await import("ai");

    const model =
      provider === "anthropic"
        ? createAnthropicProvider(apiKey)("claude-haiku-4-5-20251001")
        : createGeminiProvider(apiKey)("gemini-3-flash-preview");

    await generateText({
      model,
      prompt: "Hi",
      maxOutputTokens: 1,
    });

    return true;
  } catch (error) {
    console.error(`[AI Providers] API key validation failed:`, error);
    return false;
  }
}
