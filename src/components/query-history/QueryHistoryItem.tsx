import { Check, X, Clock, Database, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import type { QueryHistoryEntry } from "@/types";
import { cn } from "@/lib/utils";

interface QueryHistoryItemProps {
  entry: QueryHistoryEntry;
  onLoad: (sql: string) => void;
  onDelete: (id: string) => void;
}

export function QueryHistoryItem({ entry, onLoad, onDelete }: QueryHistoryItemProps) {
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  const formatExecutionTime = (ms?: number): string => {
    if (ms === undefined) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const truncateSQL = (sql: string, maxLength: number = 100): string => {
    const singleLine = sql.replace(/\s+/g, " ").trim();
    if (singleLine.length <= maxLength) return singleLine;
    return singleLine.substring(0, maxLength) + "...";
  };

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors",
        entry.success ? "border-border" : "border-destructive/50"
      )}
      onClick={() => onLoad(entry.sql)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {entry.success ? (
            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : (
            <X className="h-4 w-4 text-destructive flex-shrink-0" />
          )}
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatRelativeTime(entry.executedAt)}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete from history</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <code className="text-xs font-mono flex-1 min-w-0 truncate">
          {truncateSQL(entry.sql)}
        </code>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {entry.executionTimeMs !== undefined && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            {formatExecutionTime(entry.executionTimeMs)}
          </Badge>
        )}
        {entry.rowCount !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {entry.rowCount} {entry.rowCount === 1 ? "row" : "rows"}
          </Badge>
        )}
        {!entry.success && entry.error && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="text-xs">
                Error
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {entry.error}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
