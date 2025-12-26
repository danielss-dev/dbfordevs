import { useState, useMemo } from "react";
import {
  Copy,
  Check,
  FileEdit,
  Bot,
  User,
  AlertCircle,
  Play,
  Coins,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AIChatMessage } from "@/extensions";
import { useQueryStore } from "@/stores/query";
import { useConnectionsStore } from "@/stores/connections";
import { invoke } from "@tauri-apps/api/core";
import { QueryDiffView } from "./QueryDiffView";

interface ChatMessageProps {
  message: AIChatMessage;
}

// SQL keywords for syntax highlighting
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
  "IS", "NULL", "AS", "ON", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "FULL", "CROSS", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC",
  "LIMIT", "OFFSET", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
  "DELETE", "CREATE", "TABLE", "INDEX", "VIEW", "DROP", "ALTER", "ADD",
  "COLUMN", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE",
  "DEFAULT", "CHECK", "CONSTRAINT", "CASCADE", "DISTINCT", "ALL",
  "UNION", "INTERSECT", "EXCEPT", "EXISTS", "CASE", "WHEN", "THEN",
  "ELSE", "END", "CAST", "CONVERT", "COALESCE", "NULLIF", "COUNT",
  "SUM", "AVG", "MIN", "MAX", "WITH", "RECURSIVE", "OVER", "PARTITION",
  "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD", "FIRST_VALUE",
  "LAST_VALUE", "EXPLAIN", "ANALYZE", "TRUNCATE", "COMMIT", "ROLLBACK",
  "BEGIN", "TRANSACTION", "RETURNING", "USING", "ILIKE", "SERIAL",
  "IDENTITY", "AUTO_INCREMENT", "TOP", "FETCH", "NEXT", "ROWS", "ONLY",
];

const SQL_FUNCTIONS = [
  "COUNT", "SUM", "AVG", "MIN", "MAX", "UPPER", "LOWER", "LENGTH",
  "SUBSTRING", "TRIM", "LTRIM", "RTRIM", "REPLACE", "CONCAT", "COALESCE",
  "NULLIF", "CAST", "CONVERT", "NOW", "CURRENT_DATE", "CURRENT_TIME",
  "CURRENT_TIMESTAMP", "DATE", "TIME", "YEAR", "MONTH", "DAY", "HOUR",
  "MINUTE", "SECOND", "EXTRACT", "DATE_FORMAT", "TO_CHAR", "TO_DATE",
  "ABS", "ROUND", "CEIL", "CEILING", "FLOOR", "MOD", "POWER", "SQRT",
  "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD", "FIRST_VALUE",
  "LAST_VALUE", "NTH_VALUE", "NTILE",
];

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const queryStore = useQueryStore();
  const activeConnectionId = useConnectionsStore((state) => state.activeConnectionId);
  const isUser = message.role === "user";
  const isError = message.content.toLowerCase().startsWith("error:");
  const isStreaming = message.isStreaming;

  // Check if content is meaningful (not just whitespace or code block markers)
  const hasContent = message.content.trim().length > 0 &&
    !message.content.trim().match(/^```\w*\s*$/);
  const showStreamingIndicator = isStreaming && !hasContent;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertSQL = () => {
    if (!message.sql) return;

    const { tabs, activeTabId, addTab, updateTabContent } = queryStore;
    const activeTab = tabs.find((t) => t.id === activeTabId && t.type === "query");

    if (activeTab) {
      updateTabContent(activeTab.id, message.sql);
    } else {
      if (!activeConnectionId) {
        console.error("No active connection - cannot create query tab");
        return;
      }
      addTab({
        id: crypto.randomUUID(),
        title: "AI Query",
        type: "query",
        connectionId: activeConnectionId,
        content: message.sql,
      });
    }
  };

  const handleRunSQL = async () => {
    if (!message.sql || !activeConnectionId) return;

    setIsRunning(true);
    try {
      // Insert SQL into editor first
      handleInsertSQL();

      // Execute the query
      const result = await invoke<unknown>("execute_query", {
        connectionId: activeConnectionId,
        query: message.sql,
      });

      console.log("[ChatMessage] Query executed:", result);

      // Find the query tab to focus on results
      const { tabs } = queryStore;
      const resultsTab = tabs.find(t => t.type === "query" && t.connectionId === activeConnectionId);
      console.log("[ChatMessage] Results tab:", resultsTab?.id);
    } catch (error) {
      console.error("[ChatMessage] Query execution failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  // SQL Syntax highlighting
  const highlightedSQL = useMemo(() => {
    if (!message.sql) return null;

    const sql = message.sql;
    const tokens: Array<{ text: string; type: "keyword" | "function" | "string" | "number" | "comment" | "operator" | "identifier" }> = [];

    // Simple tokenization for SQL
    const regex = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|--[^\n]*|\d+\.?\d*|\w+|[^\s\w]+|\s+)/g;
    let match;

    while ((match = regex.exec(sql)) !== null) {
      const text = match[0];
      const upperText = text.toUpperCase();

      if (text.startsWith("'") || text.startsWith('"')) {
        tokens.push({ text, type: "string" });
      } else if (text.startsWith("--")) {
        tokens.push({ text, type: "comment" });
      } else if (/^\d+\.?\d*$/.test(text)) {
        tokens.push({ text, type: "number" });
      } else if (SQL_KEYWORDS.includes(upperText)) {
        tokens.push({ text, type: "keyword" });
      } else if (SQL_FUNCTIONS.includes(upperText)) {
        tokens.push({ text, type: "function" });
      } else if (/^[+\-*/%=<>!&|^~]+$/.test(text) || text === "(" || text === ")" || text === "," || text === ";") {
        tokens.push({ text, type: "operator" });
      } else if (/^\w+$/.test(text)) {
        tokens.push({ text, type: "identifier" });
      } else {
        tokens.push({ text, type: "identifier" });
      }
    }

    return tokens;
  }, [message.sql]);

  // Clean error message by removing URLs and technical details
  const cleanErrorMessage = (content: string): string => {
    if (!isError) return content;

    let cleaned = content.replace(/\(https?:\/\/[^\)]+\)/g, "");
    cleaned = cleaned.replace(/https?:\/\/\S+/g, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned || "An error occurred. Please try again.";
  };

  // Format token usage
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  return (
    <div
      className={cn(
        "flex gap-3 group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background",
          isUser
            ? "bg-blue-500 ring-blue-500/20"
            : isError
            ? "bg-red-500 ring-red-500/20"
            : "bg-gradient-to-br from-violet-500 to-purple-600 ring-violet-500/20"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : isError ? (
          <AlertCircle className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex flex-col gap-2.5 min-w-0 flex-1 max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Streaming indicator when no content yet */}
        {showStreamingIndicator && (
          <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-md bg-muted/80 backdrop-blur-sm">
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}

        {/* Message text */}
        {hasContent && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm shadow-sm",
              isUser
                ? "bg-blue-500 text-white rounded-br-md"
                : isError
                ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 rounded-bl-md"
                : "bg-muted/80 backdrop-blur-sm rounded-bl-md"
            )}
          >
            {isUser || isError ? (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {cleanErrorMessage(message.content)}
              </p>
            ) : (
              <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:text-violet-400 prose-code:bg-violet-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none max-w-none break-words">
                <ReactMarkdown
                  components={{
                    // Override code blocks to use our SQL highlighting when it looks like SQL
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded text-xs" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className={cn("block bg-[#1e1e2e] p-3 rounded-lg text-xs overflow-x-auto", className)} {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <>{children}</>,
                    // Make links open in external browser
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {cleanErrorMessage(message.content)}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-violet-500 rounded-sm animate-pulse" />
                )}
              </div>
            )}
          </div>
        )}

        {/* SQL block with syntax highlighting */}
        {message.sql && (
          <div className="w-full max-w-full rounded-xl border border-border bg-[#1e1e2e] overflow-hidden shadow-md">
            {/* SQL header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#181825]/80 backdrop-blur-sm border-b border-border/30">
              <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">
                Generated SQL
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-white/10 transition-colors"
                  onClick={handleRunSQL}
                  disabled={isRunning || !activeConnectionId}
                  title="Run Query"
                >
                  <Play className={cn("h-3.5 w-3.5 text-green-400", isRunning && "animate-pulse")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-white/10 transition-colors"
                  onClick={() => copyToClipboard(message.sql!)}
                  title="Copy SQL"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-white/10 transition-colors"
                  onClick={handleInsertSQL}
                  title="Insert into Query Editor"
                >
                  <FileEdit className="h-3.5 w-3.5 text-blue-400" />
                </Button>
              </div>
            </div>
            {/* SQL code with syntax highlighting */}
            <pre className="p-4 overflow-x-auto text-xs max-w-full">
              <code className="font-mono whitespace-pre-wrap break-all leading-relaxed">
                {highlightedSQL?.map((token, i) => (
                  <span
                    key={i}
                    className={cn(
                      token.type === "keyword" && "text-[#ff79c6] font-semibold",
                      token.type === "function" && "text-[#8be9fd]",
                      token.type === "string" && "text-[#f1fa8c]",
                      token.type === "number" && "text-[#bd93f9]",
                      token.type === "comment" && "text-[#6272a4] italic",
                      token.type === "operator" && "text-[#ff79c6]",
                      token.type === "identifier" && "text-[#f8f8f2]"
                    )}
                  >
                    {token.text}
                  </span>
                ))}
              </code>
            </pre>
          </div>
        )}

        {/* Query diff view for optimizations */}
        {message.queryDiff && (
          <div className="w-full">
            <QueryDiffView
              diff={message.queryDiff}
              onApply={(optimizedSql) => {
                const { tabs, activeTabId, addTab, updateTabContent } = queryStore;
                const activeTab = tabs.find((t) => t.id === activeTabId && t.type === "query");

                if (activeTab) {
                  updateTabContent(activeTab.id, optimizedSql);
                } else if (activeConnectionId) {
                  addTab({
                    id: crypto.randomUUID(),
                    title: "Optimized Query",
                    type: "query",
                    connectionId: activeConnectionId,
                    content: optimizedSql,
                  });
                }
              }}
            />
          </div>
        )}

        {/* Token usage indicator */}
        {message.usage && !isUser && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
            <Coins className="h-3 w-3" />
            <span>{formatTokens(message.usage.totalTokens)} tokens</span>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground/50 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
