import { useState, useMemo, useCallback } from "react";
import { History, Search, X, Star, Download, CheckCircle, XCircle, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, Badge } from "@/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useQueryStore } from "@/stores";
import { QueryHistoryDropdownItem } from "./QueryHistoryDropdownItem";

interface QueryHistoryDropdownProps {
  connectionId: string;
  onLoadQuery: (sql: string) => void;
}

type FilterType = "all" | "success" | "failed" | "favorites";

export function QueryHistoryDropdown({ connectionId, onLoadQuery }: QueryHistoryDropdownProps) {
  const {
    queryHistory,
    toggleFavorite,
    deleteHistoryEntry,
    exportHistory,
    clearHistoryForConnection,
    getHistoryStats,
  } = useQueryStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const connectionHistory = queryHistory[connectionId] || [];
  const hasHistory = connectionHistory.length > 0;
  const stats = getHistoryStats(connectionId);

  // Filter history
  const filteredHistory = useMemo(() => {
    let result = connectionHistory;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.sql.toLowerCase().includes(query) ||
          entry.error?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filter === "success") {
      result = result.filter((entry) => entry.success);
    } else if (filter === "failed") {
      result = result.filter((entry) => !entry.success);
    } else if (filter === "favorites") {
      result = result.filter((entry) => entry.isFavorite);
    }

    return result;
  }, [connectionHistory, searchQuery, filter]);

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      toggleFavorite(connectionId, id);
    },
    [connectionId, toggleFavorite]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteHistoryEntry(connectionId, id);
    },
    [connectionId, deleteHistoryEntry]
  );

  const handleExport = (format: "json" | "csv") => {
    const data = exportHistory(connectionId, format);
    const blob = new Blob([data], {
      type: format === "json" ? "application/json" : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-history-${connectionId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              disabled={!hasHistory}
              className="h-8 w-8"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {hasHistory
            ? `History (${connectionHistory.length})`
            : "No query history yet"}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-[500px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Query History</span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs font-normal">
              {filteredHistory.length}
              {filteredHistory.length !== connectionHistory.length && (
                <span className="text-muted-foreground">/{connectionHistory.length}</span>
              )}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleExport("json")}
                  disabled={connectionHistory.length === 0}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => clearHistoryForConnection(connectionId)}
                  disabled={connectionHistory.length === 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all history</TooltipContent>
            </Tooltip>
          </div>
        </DropdownMenuLabel>

        {/* Search and Filter Bar */}
        <div className="px-2 py-2 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 pr-7 text-xs"
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant={filter === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setFilter("all");
              }}
            >
              All
            </Button>
            <Button
              variant={filter === "success" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs flex-1 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setFilter("success");
              }}
            >
              <CheckCircle className="h-3 w-3 text-green-500" />
              {stats.successfulQueries}
            </Button>
            <Button
              variant={filter === "failed" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs flex-1 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setFilter("failed");
              }}
            >
              <XCircle className="h-3 w-3 text-red-500" />
              {stats.failedQueries}
            </Button>
            <Button
              variant={filter === "favorites" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs flex-1 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setFilter("favorites");
              }}
            >
              <Star className="h-3 w-3 text-yellow-500" />
              {stats.favoriteCount}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[350px]">
          <div className="p-1">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <History className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filter !== "all"
                    ? "No matching queries"
                    : "No query history yet"}
                </p>
              </div>
            ) : (
              filteredHistory.map((entry) => (
                <QueryHistoryDropdownItem
                  key={entry.id}
                  entry={entry}
                  isExpanded={hoveredId === entry.id}
                  onHover={() => setHoveredId(entry.id)}
                  onLeave={() => setHoveredId(null)}
                  onClick={() => onLoadQuery(entry.sql)}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
