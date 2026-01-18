/**
 * NoSQL AI Functions
 *
 * AI-powered query generation for MongoDB and Redis.
 */

import type { AISettings, MongoContext, RedisContext } from "./types";
import {
  mongoQueryPrompt,
  mongoAggregationPrompt,
  redisCommandPrompt,
  redisDataStructurePrompt,
} from "./nosql-prompts";
import { aiChat } from "./api";

/**
 * MongoDB query generation result
 */
export interface MongoQueryResult {
  query: string;
  explanation: string;
  type: "find" | "aggregation" | "update" | "other";
}

/**
 * MongoDB aggregation pipeline result
 */
export interface MongoAggregationResult {
  pipeline: object[];
  explanation: string;
}

/**
 * Redis command generation result
 */
export interface RedisCommandResult {
  commands: string[];
  explanation: string;
}

/**
 * Redis data structure recommendation result
 */
export interface RedisRecommendationResult {
  recommendation: string;
  example: string;
  alternatives?: string[];
}

/**
 * Generate a MongoDB query from natural language
 */
export async function generateMongoQuery(
  prompt: string,
  context: MongoContext,
  settings: AISettings
): Promise<MongoQueryResult> {
  const systemPrompt = mongoQueryPrompt(context);

  const response = await aiChat(
    {
      message: prompt,
      context: {
        prompt,
        tables: [],
        databaseType: "MongoDB",
        databaseName: context.database,
      },
    },
    [
      {
        id: "system",
        role: "user",
        content: systemPrompt,
        timestamp: new Date(),
      },
    ],
    settings
  );

  // Parse the response to extract query and explanation
  const content = response.message;

  // Try to extract JSON from code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  let query = "";
  let type: "find" | "aggregation" | "update" | "other" = "find";

  if (jsonMatch) {
    query = jsonMatch[1].trim();

    // Determine query type
    if (query.startsWith("[")) {
      type = "aggregation";
    } else if (query.includes('"$set"') || query.includes('"$unset"')) {
      type = "update";
    }
  }

  // Extract explanation (text before or after the code block)
  const explanation = content
    .replace(/```(?:json)?\s*[\s\S]*?```/g, "")
    .trim() || "Query generated successfully.";

  return {
    query,
    explanation,
    type,
  };
}

/**
 * Generate a MongoDB aggregation pipeline from natural language
 */
export async function generateAggregationPipeline(
  prompt: string,
  context: MongoContext,
  settings: AISettings
): Promise<MongoAggregationResult> {
  const systemPrompt = mongoAggregationPrompt(context);

  const response = await aiChat(
    {
      message: prompt,
      context: {
        prompt,
        tables: [],
        databaseType: "MongoDB",
        databaseName: context.database,
      },
    },
    [
      {
        id: "system",
        role: "user",
        content: systemPrompt,
        timestamp: new Date(),
      },
    ],
    settings
  );

  const content = response.message;

  // Try to extract JSON array from code block
  const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])```/);
  let pipeline: object[] = [];

  if (jsonMatch) {
    try {
      pipeline = JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.error("[NoSQL AI] Failed to parse aggregation pipeline:", e);
    }
  }

  // Extract explanation
  const explanation = content
    .replace(/```(?:json)?\s*[\s\S]*?```/g, "")
    .trim() || "Aggregation pipeline generated successfully.";

  return {
    pipeline,
    explanation,
  };
}

/**
 * Generate Redis commands from natural language
 */
export async function generateRedisCommands(
  prompt: string,
  context: RedisContext,
  settings: AISettings
): Promise<RedisCommandResult> {
  const systemPrompt = redisCommandPrompt(context);

  const response = await aiChat(
    {
      message: prompt,
      context: {
        prompt,
        tables: [],
        databaseType: "Redis",
      },
    },
    [
      {
        id: "system",
        role: "user",
        content: systemPrompt,
        timestamp: new Date(),
      },
    ],
    settings
  );

  const content = response.message;

  // Try to extract commands from code block
  const codeMatch = content.match(/```(?:redis)?\s*([\s\S]*?)```/);
  let commands: string[] = [];

  if (codeMatch) {
    commands = codeMatch[1]
      .trim()
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));
  }

  // Extract explanation
  const explanation = content
    .replace(/```(?:redis)?\s*[\s\S]*?```/g, "")
    .trim() || "Commands generated successfully.";

  return {
    commands,
    explanation,
  };
}

/**
 * Get Redis data structure recommendation for a use case
 */
export async function suggestDataStructure(
  useCase: string,
  settings: AISettings
): Promise<RedisRecommendationResult> {
  const systemPrompt = redisDataStructurePrompt();

  const response = await aiChat(
    {
      message: useCase,
      context: {
        prompt: useCase,
        tables: [],
        databaseType: "Redis",
      },
    },
    [
      {
        id: "system",
        role: "user",
        content: systemPrompt,
        timestamp: new Date(),
      },
    ],
    settings
  );

  const content = response.message;

  // Try to extract example commands
  const codeMatch = content.match(/```(?:redis)?\s*([\s\S]*?)```/);
  const example = codeMatch ? codeMatch[1].trim() : "";

  // The recommendation is the main content
  const recommendation = content
    .replace(/```(?:redis)?\s*[\s\S]*?```/g, "")
    .trim();

  return {
    recommendation,
    example,
  };
}

/**
 * Convert natural language to MongoDB BSON filter
 */
export async function naturalLanguageToFilter(
  description: string,
  context: MongoContext,
  settings: AISettings
): Promise<{ filter: object; explanation: string }> {
  const result = await generateMongoQuery(
    `Generate a MongoDB find() filter for: ${description}`,
    context,
    settings
  );

  let filter: object = {};

  if (result.query) {
    try {
      const parsed = JSON.parse(result.query);
      filter = parsed.filter || parsed;
    } catch (e) {
      console.error("[NoSQL AI] Failed to parse filter:", e);
    }
  }

  return {
    filter,
    explanation: result.explanation,
  };
}

/**
 * Explain a MongoDB query or aggregation pipeline
 */
export async function explainMongoQuery(
  query: string,
  settings: AISettings
): Promise<string> {
  const response = await aiChat(
    {
      message: `Explain this MongoDB query in detail:\n\`\`\`json\n${query}\n\`\`\``,
      context: {
        prompt: "Explain MongoDB query",
        tables: [],
        databaseType: "MongoDB",
      },
    },
    [],
    settings
  );

  return response.message;
}

/**
 * Explain Redis commands
 */
export async function explainRedisCommands(
  commands: string[],
  settings: AISettings
): Promise<string> {
  const commandsText = commands.join("\n");

  const response = await aiChat(
    {
      message: `Explain these Redis commands in detail:\n\`\`\`redis\n${commandsText}\n\`\`\``,
      context: {
        prompt: "Explain Redis commands",
        tables: [],
        databaseType: "Redis",
      },
    },
    [],
    settings
  );

  return response.message;
}
