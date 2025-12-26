/**
 * AI Provider Configuration
 *
 * Creates and configures AI SDK providers with Tauri HTTP fetch
 * to bypass CORS restrictions.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { tauriFetchWrapper } from "./tauri-fetch";
import { DEFAULT_MODELS, type AISettings, type AIProviderType } from "./types";

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
 * Create an OpenAI provider instance with Tauri fetch
 */
export function createOpenAIProvider(apiKey: string) {
  return createOpenAI({
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
    let modelId = settings.aiAnthropicModel || DEFAULT_MODELS.anthropic;

    // Fix known buggy IDs from previous version
    if (modelId === "claude-haiku-4-5-20250514") {
      modelId = DEFAULT_MODELS.anthropic;
    }

    return anthropic(modelId);
  }

  if (provider === "gemini") {
    const apiKey = settings.aiGeminiApiKey;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    const gemini = createGeminiProvider(apiKey);
    let modelId = settings.aiGeminiModel || DEFAULT_MODELS.gemini;

    // Fix known buggy IDs from previous version
    if (modelId === "gemini-flash-3") {
      modelId = DEFAULT_MODELS.gemini;
    }

    return gemini(modelId);
  }

  if (provider === "openai") {
    const apiKey = settings.aiOpenaiApiKey;
    if (!apiKey) {
      throw new Error("OpenAI API key is not configured");
    }
    const openai = createOpenAIProvider(apiKey);
    const modelId = settings.aiOpenaiModel || DEFAULT_MODELS.openai;

    return openai(modelId);
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

    let model;
    if (provider === "anthropic") {
      model = createAnthropicProvider(apiKey)(DEFAULT_MODELS.anthropic);
    } else if (provider === "gemini") {
      model = createGeminiProvider(apiKey)(DEFAULT_MODELS.gemini);
    } else if (provider === "openai") {
      model = createOpenAIProvider(apiKey)(DEFAULT_MODELS.openai);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

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
