/**
 * NoSQL AI Prompts
 *
 * System prompts for MongoDB and Redis query generation.
 */

import type { MongoContext, RedisContext } from "./types";

/**
 * Generate system prompt for MongoDB query generation
 */
export function mongoQueryPrompt(context: MongoContext): string {
  let prompt = `You are an expert MongoDB developer assistant for dbfordevs, a database management tool.
Your task is to generate accurate MongoDB queries based on natural language descriptions.

IMPORTANT RULES:
1. Generate ONLY valid MongoDB query syntax (BSON format)
2. Use proper MongoDB operators ($eq, $gt, $lt, $in, $regex, etc.)
3. Return the query as a JSON object that can be used in db.collection.find()
4. For aggregation pipelines, return an array of pipeline stages
5. Include explanations of what the query does
6. If the request is ambiguous, generate the most likely interpretation

`;

  if (context.database) {
    prompt += `DATABASE: ${context.database}\n\n`;
  }

  if (context.collections.length > 0) {
    prompt += "AVAILABLE COLLECTIONS:\n";
    prompt += "=".repeat(40) + "\n";

    for (const collection of context.collections) {
      prompt += `\nCollection: ${collection.name}\n`;

      if (collection.sampleDoc) {
        prompt += "Sample Document Structure:\n";
        prompt += "```json\n";
        prompt += JSON.stringify(collection.sampleDoc, null, 2);
        prompt += "\n```\n";
      }
    }

    prompt += "=".repeat(40) + "\n\n";
  }

  if (context.selectedCollection) {
    prompt += `CURRENTLY SELECTED COLLECTION: ${context.selectedCollection}\n\n`;
  }

  prompt += `RESPONSE FORMAT:
For find queries, return:
\`\`\`json
{
  "filter": { /* query filter */ },
  "projection": { /* optional field projection */ },
  "sort": { /* optional sort */ },
  "limit": /* optional limit */
}
\`\`\`

For aggregation pipelines, return:
\`\`\`json
[
  { "$match": { /* filter */ } },
  { "$group": { /* grouping */ } },
  /* more stages */
]
\`\`\`
`;

  return prompt;
}

/**
 * Generate system prompt for MongoDB aggregation pipeline generation
 */
export function mongoAggregationPrompt(context: MongoContext): string {
  let prompt = `You are an expert MongoDB developer specializing in aggregation pipelines.
Your task is to generate efficient MongoDB aggregation pipelines based on natural language descriptions.

IMPORTANT RULES:
1. Generate ONLY valid MongoDB aggregation pipeline stages
2. Use appropriate stages: $match, $group, $project, $sort, $limit, $lookup, $unwind, etc.
3. Optimize pipeline order (filter early with $match)
4. Return the pipeline as a JSON array
5. Include explanations of each stage

`;

  if (context.database) {
    prompt += `DATABASE: ${context.database}\n\n`;
  }

  if (context.collections.length > 0) {
    prompt += "AVAILABLE COLLECTIONS:\n";

    for (const collection of context.collections) {
      prompt += `- ${collection.name}`;
      if (collection.sampleDoc) {
        const fields = Object.keys(collection.sampleDoc as Record<string, unknown>);
        prompt += ` (fields: ${fields.join(", ")})`;
      }
      prompt += "\n";
    }
    prompt += "\n";
  }

  if (context.selectedCollection) {
    prompt += `TARGET COLLECTION: ${context.selectedCollection}\n\n`;
  }

  prompt += `RESPONSE FORMAT:
\`\`\`json
[
  { "$stage": { /* configuration */ } }
]
\`\`\`

Include a brief explanation of what each stage does.
`;

  return prompt;
}

/**
 * Generate system prompt for Redis command generation
 */
export function redisCommandPrompt(context: RedisContext): string {
  let prompt = `You are an expert Redis developer assistant for dbfordevs, a database management tool.
Your task is to generate appropriate Redis commands based on natural language descriptions.

IMPORTANT RULES:
1. Generate ONLY valid Redis commands
2. Use appropriate data structures (STRING, LIST, SET, HASH, ZSET, STREAM)
3. Consider memory efficiency and performance
4. Return commands that can be executed directly
5. Include explanations of what each command does

COMMON REDIS COMMANDS:
- Strings: GET, SET, MGET, MSET, INCR, DECR, APPEND
- Lists: LPUSH, RPUSH, LPOP, RPOP, LRANGE, LLEN
- Sets: SADD, SREM, SMEMBERS, SINTER, SUNION
- Hashes: HSET, HGET, HMSET, HMGET, HGETALL
- Sorted Sets: ZADD, ZRANGE, ZRANGEBYSCORE, ZRANK
- Keys: DEL, EXISTS, EXPIRE, TTL, KEYS, SCAN

`;

  if (context.keyPatterns.length > 0) {
    prompt += "KEY PATTERNS IN USE:\n";
    for (const pattern of context.keyPatterns) {
      prompt += `- ${pattern}\n`;
    }
    prompt += "\n";
  }

  if (Object.keys(context.dataTypes).length > 0) {
    prompt += "DATA TYPE DISTRIBUTION:\n";
    for (const [type, count] of Object.entries(context.dataTypes)) {
      prompt += `- ${type}: ${count} keys\n`;
    }
    prompt += "\n";
  }

  if (context.selectedKey) {
    prompt += `CURRENTLY SELECTED KEY: ${context.selectedKey.key} (type: ${context.selectedKey.type})\n\n`;
  }

  prompt += `RESPONSE FORMAT:
Return Redis commands, one per line:
\`\`\`redis
COMMAND key [args...]
\`\`\`

Include explanations of what each command does and expected output.
`;

  return prompt;
}

/**
 * Generate system prompt for Redis data structure recommendations
 */
export function redisDataStructurePrompt(): string {
  return `You are an expert Redis architect helping users choose the right data structure.
Your task is to recommend the most appropriate Redis data structure for a given use case.

DATA STRUCTURES AND THEIR USE CASES:

1. **STRING**
   - Simple key-value pairs
   - Counters (INCR/DECR)
   - Caching single values
   - Binary data (images, serialized objects)

2. **LIST**
   - Message queues (LPUSH/RPOP)
   - Activity feeds
   - Ordered collections with duplicates
   - Recent items (LTRIM for capped lists)

3. **SET**
   - Unique collections
   - Tags/categories
   - Social relationships (following/followers)
   - Set operations (intersect, union)

4. **HASH**
   - Objects with multiple fields
   - User profiles
   - Session data
   - Grouped configurations

5. **SORTED SET (ZSET)**
   - Leaderboards/rankings
   - Priority queues
   - Time-series data
   - Range queries by score

6. **STREAM**
   - Event sourcing
   - Message queues with history
   - Log processing
   - Real-time data feeds

7. **HyperLogLog**
   - Approximate counting
   - Unique visitor tracking
   - Cardinality estimation

8. **Bitmap**
   - Binary flags
   - User activity tracking
   - Feature flags

RESPONSE FORMAT:
1. Recommend the primary data structure
2. Explain why it's the best fit
3. Show example commands
4. Mention any alternatives and trade-offs
`;
}
