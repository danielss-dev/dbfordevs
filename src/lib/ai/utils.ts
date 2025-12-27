/**
 * AI Assistant Utility Functions
 */

import type {
  AIChatMessage,
  AIChatSession,
  AIChatHistorySettings,
  AIQueryHistoryItem,
} from "./types";

/**
 * Generate a concise chat title from the first user message
 * Max 50 characters, intelligently truncated
 */
export function generateChatTitle(firstMessage: AIChatMessage): string {
  if (firstMessage.role !== "user") {
    return "New Chat";
  }

  const content = firstMessage.content.trim();

  if (!content) {
    return "New Chat";
  }

  // Extract SQL-relevant parts (table names, keywords)
  const hasTableRef = content.match(/@(\w+)/);
  if (hasTableRef) {
    const table = hasTableRef[1];
    const action = extractAction(content);
    const title = `${action} ${table}`;
    return title.length > 50 ? title.substring(0, 47) + "..." : title;
  }

  // Otherwise use first sentence or 50 chars
  const firstSentence = content.split(/[.!?]/)[0].trim();
  return firstSentence.length > 50
    ? firstSentence.substring(0, 47) + "..."
    : firstSentence;
}

/**
 * Extract the action verb from a prompt
 */
function extractAction(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("show") || lower.includes("list") || lower.includes("get")) return "Show";
  if (lower.includes("count")) return "Count";
  if (lower.includes("find") || lower.includes("search")) return "Find";
  if (lower.includes("update")) return "Update";
  if (lower.includes("delete") || lower.includes("remove")) return "Delete";
  if (lower.includes("create") || lower.includes("insert") || lower.includes("add")) return "Create";
  if (lower.includes("join")) return "Join";
  if (lower.includes("aggregate") || lower.includes("sum") || lower.includes("average")) return "Aggregate";
  return "Query";
}

/**
 * Group chat sessions by time periods
 * Returns a record with time labels as keys and sessions as values
 */
export function groupSessionsByTime(
  sessions: AIChatSession[]
): Record<string, AIChatSession[]> {
  const now = new Date();
  const groups: Record<string, AIChatSession[]> = {};

  // Initialize all groups
  const groupNames = ["Today", "Yesterday", "2d ago", "3d ago", "4d ago", "This Week", "This Month", "Older"];
  groupNames.forEach(name => groups[name] = []);

  sessions.forEach((session) => {
    const sessionDate = new Date(session.updatedAt);
    const daysAgo = Math.floor(
      (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysAgo === 0) {
      groups["Today"].push(session);
    } else if (daysAgo === 1) {
      groups["Yesterday"].push(session);
    } else if (daysAgo === 2) {
      groups["2d ago"].push(session);
    } else if (daysAgo === 3) {
      groups["3d ago"].push(session);
    } else if (daysAgo === 4) {
      groups["4d ago"].push(session);
    } else if (daysAgo <= 7) {
      groups["This Week"].push(session);
    } else if (daysAgo <= 30) {
      groups["This Month"].push(session);
    } else {
      groups["Older"].push(session);
    }
  });

  // Filter out empty groups and return
  return Object.fromEntries(
    Object.entries(groups).filter(([_, sessions]) => sessions.length > 0)
  );
}

/**
 * Clean up old chats based on settings
 * Favorites are always exempt from cleanup
 */
export function cleanupOldChats(
  sessions: AIChatSession[],
  settings: AIChatHistorySettings
): AIChatSession[] {
  if (!settings.autoCleanupEnabled) {
    return sessions;
  }

  const now = new Date();

  // Filter by age (favorites exempt)
  let filtered = sessions.filter((session) => {
    if (session.isFavorite) return true; // Always keep favorites

    const sessionDate = new Date(session.updatedAt);
    const daysOld = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld <= settings.maxDaysOld;
  });

  // Sort by updatedAt (most recent first)
  filtered.sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateB - dateA;
  });

  // Keep only maxChatCount (but always keep ALL favorites)
  const favorites = filtered.filter(s => s.isFavorite);
  const nonFavorites = filtered.filter(s => !s.isFavorite);
  const keptNonFavorites = nonFavorites.slice(0, Math.max(0, settings.maxChatCount - favorites.length));

  return [...favorites, ...keptNonFavorites].sort((a, b) => {
    // Sort by updated date descending
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/**
 * Convert a single query history item into a chat session
 */
function queryToChatSession(query: AIQueryHistoryItem): AIChatSession {
  const userMessage: AIChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: query.prompt,
    timestamp: query.timestamp,
  };

  const assistantMessage: AIChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: query.generatedSQL
      ? `Here's the SQL query:\n\n${query.generatedSQL}`
      : "I generated a query for you.",
    sql: query.generatedSQL,
    timestamp: query.timestamp,
  };

  return {
    id: query.id, // Preserve original ID
    title: generateChatTitle(userMessage),
    createdAt: query.timestamp,
    updatedAt: query.timestamp,
    messages: [userMessage, assistantMessage],
    isFavorite: query.isFavorite,
  };
}

/**
 * Migrate from version 0 (legacy) to version 1 (chat sessions)
 * This function mutates the state object
 */
export function migrateToVersion1(state: any): void {
  console.log("[AI Store] Migrating to version 1 (chat sessions)...");

  // Initialize new state fields if they don't exist
  if (!state.chatSessions) {
    state.chatSessions = [];
  }

  if (!state.historySettings) {
    state.historySettings = {
      autoCleanupEnabled: true,
      maxDaysOld: 30,
      maxChatCount: 100,
      cleanupOnStartup: true,
    };
  }

  // Migrate legacy messages to a chat session
  if (state._legacy_messages && state._legacy_messages.length > 0) {
    const firstMessage = state._legacy_messages[0];
    const lastMessage = state._legacy_messages[state._legacy_messages.length - 1];

    const legacySession: AIChatSession = {
      id: crypto.randomUUID(),
      title: generateChatTitle(firstMessage),
      createdAt: firstMessage.timestamp || new Date(),
      updatedAt: lastMessage.timestamp || new Date(),
      messages: state._legacy_messages,
      isFavorite: false,
    };

    state.chatSessions.unshift(legacySession);
    console.log(`[AI Store] Migrated ${state._legacy_messages.length} messages to a chat session`);
  }

  // Migrate legacy queryHistory to chat sessions
  if (state._legacy_queryHistory && state._legacy_queryHistory.length > 0) {
    const querySessions: AIChatSession[] = state._legacy_queryHistory.map(queryToChatSession);
    state.chatSessions.push(...querySessions);
    console.log(`[AI Store] Migrated ${state._legacy_queryHistory.length} query history items to chat sessions`);
  }

  // Set active session to the most recent one
  if (state.chatSessions.length > 0 && !state.activeChatSessionId) {
    state.activeChatSessionId = state.chatSessions[0].id;
  }

  // Mark as migrated
  state.storageMetadata = {
    version: 1,
    migratedAt: new Date(),
  };

  // Clean up legacy fields
  delete state._legacy_messages;
  delete state._legacy_queryHistory;
  delete state.messages; // Remove old messages field
  delete state.queryHistory; // Remove old queryHistory field

  console.log("[AI Store] Migration to version 1 complete");
}
