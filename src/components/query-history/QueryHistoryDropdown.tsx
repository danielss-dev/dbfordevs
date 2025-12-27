import { useState, useEffect } from "react";
import { History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useQueryStore } from "@/stores";
import { QueryHistoryDropdownItem } from "./QueryHistoryDropdownItem";

interface QueryHistoryDropdownProps {
  connectionId: string;
  onLoadQuery: (sql: string) => void;
  activeTooltip: string | null;
  onSetActiveTooltip: (tooltip: string | null) => void;
}

export function QueryHistoryDropdown({ connectionId, onLoadQuery, activeTooltip, onSetActiveTooltip }: QueryHistoryDropdownProps) {
  const { queryHistory } = useQueryStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const connectionHistory = queryHistory[connectionId] || [];
  const hasHistory = connectionHistory.length > 0;

  // Clear active tooltip when dropdown opens or closes
  useEffect(() => {
    onSetActiveTooltip(null);
  }, [isDropdownOpen, onSetActiveTooltip]);

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <Tooltip open={activeTooltip === "history" && !isDropdownOpen}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasHistory}
              className="gap-2 ml-auto"
              onMouseEnter={() => onSetActiveTooltip("history")}
              onMouseLeave={() => onSetActiveTooltip(null)}
            >
              <History className="h-3.5 w-3.5" />
              History
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {hasHistory
            ? `${connectionHistory.length} ${connectionHistory.length === 1 ? "query" : "queries"} in history`
            : "No query history yet"}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-[500px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Query History</span>
          <span className="text-xs text-muted-foreground font-normal">
            {connectionHistory.length} {connectionHistory.length === 1 ? "query" : "queries"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <ScrollArea className="h-[400px]">
          <div className="p-1">
            {connectionHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <History className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No query history yet</p>
              </div>
            ) : (
              connectionHistory.map((entry) => (
                <QueryHistoryDropdownItem
                  key={entry.id}
                  entry={entry}
                  isExpanded={hoveredId === entry.id}
                  onHover={() => setHoveredId(entry.id)}
                  onLeave={() => setHoveredId(null)}
                  onClick={() => onLoadQuery(entry.sql)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
