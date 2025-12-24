import { useState } from "react";
import { Copy, Check, Play, Bot, User } from "lucide-react";
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

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex flex-col gap-2 max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Message text */}
        <div
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted rounded-bl-sm"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* SQL block */}
        {message.sql && (
          <div className="w-full rounded-xl border border-border bg-[#1e1e2e] overflow-hidden">
            {/* SQL header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-b border-border/50">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                SQL
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-white/10"
                  onClick={() => copyToClipboard(message.sql!)}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
                {onExecuteSQL && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-white/10"
                    onClick={handleExecute}
                  >
                    <Play className="h-3 w-3 text-green-400" />
                  </Button>
                )}
              </div>
            </div>
            {/* SQL code */}
            <pre className="p-3 overflow-x-auto text-xs">
              <code className="text-[#cdd6f4] font-mono">
                {formatSQL(message.sql)}
              </code>
            </pre>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground/60">
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

