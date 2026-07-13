import { Star, FileCode, Database } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import type { Bookmark } from "@/types";
import { cn } from "@/lib/utils";

interface BookmarksDropdownItemProps {
  bookmark: Bookmark;
  onClick: () => void;
  onHover?: () => void;
  onLeave?: () => void;
  isExpanded?: boolean;
}

function truncateSQL(sql: string, maxLength: number = 80): string {
  const firstLine = sql.split("\n")[0].trim();
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.substring(0, maxLength - 3) + "...";
}

export function BookmarksDropdownItem({
  bookmark,
  onClick,
  onHover,
  onLeave,
  isExpanded = false,
}: BookmarksDropdownItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full text-left px-2 py-[var(--pad-menu-y)] rounded-sm cursor-pointer",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:bg-accent focus:text-accent-foreground focus:outline-none",
            "transition-colors duration-150"
          )}
          onClick={onClick}
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {bookmark.isFavorite ? (
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
              ) : bookmark.isTemplate ? (
                <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{bookmark.name}</span>
                {bookmark.isTemplate && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    Template
                  </span>
                )}
                {bookmark.databaseType && !bookmark.connectionId && (
                  <Badge variant="info" className="text-[10px] px-1.5 py-0.5 rounded-full gap-1">
                    <Database className="h-2.5 w-2.5" />
                    {bookmark.databaseType}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                {truncateSQL(bookmark.sql)}
              </p>
              {isExpanded && bookmark.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {bookmark.description}
                </p>
              )}
            </div>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[300px]">
        <div className="space-y-1">
          <p className="font-medium">{bookmark.name}</p>
          {bookmark.description && (
            <p className="text-xs text-muted-foreground">{bookmark.description}</p>
          )}
          <pre className="text-xs font-mono bg-muted/50 p-2 rounded mt-2 whitespace-pre-wrap max-h-[200px] overflow-auto">
            {bookmark.sql.length > 300 ? bookmark.sql.substring(0, 300) + "..." : bookmark.sql}
          </pre>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
