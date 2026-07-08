import { Check, X, Clock, Star, Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QueryHistoryEntry } from "@/types";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatExecutionTime, truncateSQL } from "./query-history-utils";

interface QueryHistoryDropdownItemProps {
  entry: QueryHistoryEntry;
  isExpanded: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onToggleFavorite?: (e: React.MouseEvent, id: string) => void;
  onDelete?: (e: React.MouseEvent, id: string) => void;
}

export function QueryHistoryDropdownItem({
  entry,
  isExpanded,
  onHover,
  onLeave,
  onClick,
  onToggleFavorite,
  onDelete,
}: QueryHistoryDropdownItemProps) {
  return (
    <DropdownMenuItem
      className={cn(
        "flex flex-col items-start gap-2 p-3 cursor-pointer transition-all duration-200 group",
        entry.success ? "border-l-2 border-l-transparent" : "border-l-2 border-l-destructive",
        entry.isFavorite && "border-l-warning bg-warning/5",
        isExpanded && "bg-muted/50"
      )}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onSelect={onClick}
    >
      {/* Compact view - always visible */}
      <div className="flex items-center gap-2 w-full">
        {entry.success ? (
          <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
        ) : (
          <X className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatRelativeTime(entry.executedAt)}
        </span>
        {entry.isFavorite && (
          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />
        )}
        <code className={cn(
          "text-xs font-mono flex-1 min-w-0 transition-all duration-200",
          isExpanded ? "whitespace-pre-wrap line-clamp-3" : "truncate"
        )}>
          {isExpanded ? entry.sql : truncateSQL(entry.sql, 60)}
        </code>
        {/* Action buttons - visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => onToggleFavorite(e, entry.id)}
            >
              <Star
                className={cn(
                  "h-3 w-3",
                  entry.isFavorite ? "fill-yellow-500 text-yellow-500" : ""
                )}
              />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => onDelete(e, entry.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded metadata - only visible on hover */}
      {isExpanded && (
        <div className="flex items-center gap-2 flex-wrap w-full animate-in fade-in-0 duration-200">
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
            <Badge variant="destructive" className="text-xs max-w-full truncate">
              Error: {entry.error}
            </Badge>
          )}
        </div>
      )}
    </DropdownMenuItem>
  );
}
