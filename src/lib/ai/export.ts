/**
 * AI Chat Export
 *
 * Utilities for exporting chat sessions to various formats.
 */

import type { AIChatSession, AIChatMessage, ExportFormat, ExportOptions } from "./types";

/**
 * Default export options
 */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeTimestamps: true,
  includeUsageStats: false,
  sqlOnly: false,
};

/**
 * Format a date for export
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleString();
}

/**
 * Extract SQL blocks from a message
 */
function extractSqlBlocks(message: AIChatMessage): string[] {
  const blocks: string[] = [];

  // Add explicit SQL field if present
  if (message.sql) {
    blocks.push(message.sql);
  }

  // Extract SQL code blocks from content
  const codeBlockPattern = /```(?:sql)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = codeBlockPattern.exec(message.content)) !== null) {
    const sql = match[1].trim();
    if (sql && !blocks.includes(sql)) {
      blocks.push(sql);
    }
  }

  return blocks;
}

/**
 * Export chat session to Markdown format
 */
export function exportToMarkdown(
  session: AIChatSession,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${session.title}`);
  lines.push("");

  if (options.includeTimestamps) {
    lines.push(`**Created:** ${formatDate(session.createdAt)}`);
    lines.push(`**Last Updated:** ${formatDate(session.updatedAt)}`);
    lines.push("");
  }

  if (session.databaseType) {
    lines.push(`**Database Type:** ${session.databaseType}`);
    lines.push("");
  }

  if (options.includeUsageStats && session.usageStats) {
    lines.push("## Usage Statistics");
    lines.push("");
    lines.push(`- **Total Tokens:** ${session.usageStats.totalTokens.toLocaleString()}`);
    lines.push(`- **Input Tokens:** ${session.usageStats.totalPromptTokens.toLocaleString()}`);
    lines.push(`- **Output Tokens:** ${session.usageStats.totalCompletionTokens.toLocaleString()}`);
    lines.push(`- **Estimated Cost:** $${session.usageStats.estimatedCost.toFixed(4)}`);
    lines.push(`- **Messages:** ${session.usageStats.messageCount}`);
    lines.push("");
  }

  // SQL Only mode - just extract SQL statements
  if (options.sqlOnly) {
    lines.push("## SQL Queries");
    lines.push("");

    let queryIndex = 1;
    for (const message of session.messages) {
      const sqlBlocks = extractSqlBlocks(message);
      for (const sql of sqlBlocks) {
        lines.push(`### Query ${queryIndex}`);
        if (options.includeTimestamps) {
          lines.push(`*Generated at ${formatDate(message.timestamp)}*`);
        }
        lines.push("");
        lines.push("```sql");
        lines.push(sql);
        lines.push("```");
        lines.push("");
        queryIndex++;
      }
    }

    return lines.join("\n");
  }

  // Full conversation mode
  lines.push("## Conversation");
  lines.push("");

  for (const message of session.messages) {
    const role = message.role === "user" ? "You" : "AI Assistant";
    const icon = message.role === "user" ? "👤" : "🤖";

    lines.push(`### ${icon} ${role}`);

    if (options.includeTimestamps) {
      lines.push(`*${formatDate(message.timestamp)}*`);
    }

    lines.push("");
    lines.push(message.content);
    lines.push("");

    // Add SQL block if present
    if (message.sql) {
      lines.push("```sql");
      lines.push(message.sql);
      lines.push("```");
      lines.push("");
    }

    // Add usage stats for assistant messages
    if (options.includeUsageStats && message.usage && message.role === "assistant") {
      lines.push(`*Tokens: ${message.usage.totalTokens.toLocaleString()}*`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export chat session to JSON format
 */
export function exportToJSON(session: AIChatSession): string {
  const exportData = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    databaseType: session.databaseType,
    connectionId: session.connectionId,
    isFavorite: session.isFavorite,
    usageStats: session.usageStats,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sql: m.sql,
      timestamp: m.timestamp,
      usage: m.usage,
    })),
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Download exported content as a file
 */
export function downloadExport(
  content: string,
  filename: string,
  format: ExportFormat
): void {
  const mimeType = format === "json" ? "application/json" : "text/markdown";
  const extension = format === "json" ? ".json" : ".md";
  const fullFilename = filename.endsWith(extension) ? filename : `${filename}${extension}`;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fullFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for export
 */
export function generateExportFilename(
  session: AIChatSession,
  format: ExportFormat
): string {
  const sanitizedTitle = session.title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);

  const date = new Date().toISOString().split("T")[0];
  const extension = format === "json" ? "json" : "md";

  return `chat-${sanitizedTitle}-${date}.${extension}`;
}

/**
 * Export multiple sessions to a single file
 */
export function exportMultipleSessions(
  sessions: AIChatSession[],
  format: ExportFormat,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): string {
  if (format === "json") {
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      sessionCount: sessions.length,
      sessions: sessions.map((s) => JSON.parse(exportToJSON(s))),
    };
    return JSON.stringify(exportData, null, 2);
  }

  // Markdown format
  const lines: string[] = [];
  lines.push("# Chat Export");
  lines.push("");
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push(`**Sessions:** ${sessions.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const session of sessions) {
    lines.push(exportToMarkdown(session, options));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Copy content to clipboard
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    console.error("[Export] Failed to copy to clipboard:", error);
    return false;
  }
}
