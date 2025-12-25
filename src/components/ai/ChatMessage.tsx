import { useState } from "react";
import { Copy, Check, Play, Bot, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AIChatMessage } from "@/extensions";

interface ChatMessageProps {
  message: AIChatMessage;
  onExecuteSQL?: (sql: string) => void;
}

export function ChatMessage({ message, onExecuteSQL }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isError = message.content.toLowerCase().startsWith("error:");

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = () => {
    if (message.sql && onExecuteSQL) {
      onExecuteSQL(message.sql);
    }
  };

  // Clean error message by removing URLs and technical details
  const cleanErrorMessage = (content: string): string => {
    if (!isError) return content;

    // Remove URLs in parentheses
    let cleaned = content.replace(/\(https?:\/\/[^\)]+\)/g, "");
    // Remove standalone URLs
    cleaned = cleaned.replace(/https?:\/\/\S+/g, "");
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned || "An error occurred. Please try again.";
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
        {/* Message text */}
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
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {cleanErrorMessage(message.content)}
          </p>
        </div>

        {/* SQL block */}
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
                  onClick={() => copyToClipboard(message.sql!)}
                  title="Copy SQL"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </Button>
                {onExecuteSQL && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-white/10 transition-colors"
                    onClick={handleExecute}
                    title="Execute SQL"
                  >
                    <Play className="h-3.5 w-3.5 text-green-400 fill-green-400/20" />
                  </Button>
                )}
              </div>
            </div>
            {/* SQL code */}
            <pre className="p-4 overflow-x-auto text-xs max-w-full">
              <code className="text-[#cdd6f4] font-mono whitespace-pre-wrap break-all leading-relaxed">
                {formatSQL(message.sql)}
              </code>
            </pre>
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

// Simple SQL formatting - in production, use a proper syntax highlighter
function formatSQL(sql: string): string {
  return sql;
}

function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

