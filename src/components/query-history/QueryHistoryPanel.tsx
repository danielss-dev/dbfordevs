import { useState, useMemo, useCallback } from "react";
import {
  History,
  Search,
  X,
  Trash2,
  Filter,
  Download,
  Star,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea, Badge, Separator } from "@/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQueryStore } from "@/stores";
import { QueryHistoryItem } from "./QueryHistoryItem";
import { formatExecutionTime } from "./query-history-utils";
import type { QueryHistoryFilters } from "@/types";

interface QueryHistoryPanelProps {
  connectionId: string;
  onLoadQuery: (sql: string) => void;
}

const defaultFilters: QueryHistoryFilters = {
  searchQuery: "",
  dateRange: { start: null, end: null },
  successFilter: "all",
  executionTimeRange: { min: null, max: null },
  showFavoritesOnly: false,
};

export function QueryHistoryPanel({ connectionId, onLoadQuery }: QueryHistoryPanelProps) {
  const {
    queryHistory,
    clearHistoryForConnection,
    toggleFavorite,
    deleteHistoryEntry,
    getHistoryStats,
    exportHistory,
  } = useQueryStore();

  const [filters, setFilters] = useState<QueryHistoryFilters>(defaultFilters);
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const connectionHistory = queryHistory[connectionId] || [];
  const stats = getHistoryStats(connectionId);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.successFilter !== "all") count++;
    if (filters.showFavoritesOnly) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.executionTimeRange.min !== null || filters.executionTimeRange.max !== null) count++;
    return count;
  }, [filters]);

  const filteredHistory = useMemo(() => {
    let result = connectionHistory;

    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.sql.toLowerCase().includes(query) ||
          entry.error?.toLowerCase().includes(query)
      );
    }

    // Success/failure filter
    if (filters.successFilter === "success") {
      result = result.filter((entry) => entry.success);
    } else if (filters.successFilter === "failed") {
      result = result.filter((entry) => !entry.success);
    }

    // Favorites filter
    if (filters.showFavoritesOnly) {
      result = result.filter((entry) => entry.isFavorite);
    }

    // Date range filter
    if (filters.dateRange.start) {
      result = result.filter((entry) => entry.executedAt >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      result = result.filter((entry) => entry.executedAt <= filters.dateRange.end!);
    }

    // Execution time filter
    if (filters.executionTimeRange.min !== null) {
      result = result.filter(
        (entry) =>
          entry.executionTimeMs !== undefined &&
          entry.executionTimeMs >= filters.executionTimeRange.min!
      );
    }
    if (filters.executionTimeRange.max !== null) {
      result = result.filter(
        (entry) =>
          entry.executionTimeMs !== undefined &&
          entry.executionTimeMs <= filters.executionTimeRange.max!
      );
    }

    return result;
  }, [connectionHistory, filters]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteHistoryEntry(connectionId, id);
    },
    [connectionId, deleteHistoryEntry]
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavorite(connectionId, id);
    },
    [connectionId, toggleFavorite]
  );

  const handleClearAll = () => {
    clearHistoryForConnection(connectionId);
  };

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

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  // Date presets for quick filtering
  const setDatePreset = (preset: "today" | "week" | "month") => {
    const now = Date.now();
    let start: number;

    switch (preset) {
      case "today":
        start = new Date().setHours(0, 0, 0, 0);
        break;
      case "week":
        start = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        start = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    setFilters((f) => ({ ...f, dateRange: { start, end: null } }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Query History</h3>
          <Badge variant="secondary" className="text-xs">
            {filteredHistory.length}
            {filteredHistory.length !== connectionHistory.length && (
              <span className="text-muted-foreground">/{connectionHistory.length}</span>
            )}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* Stats toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showStats ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowStats(!showStats)}
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Statistics</TooltipContent>
          </Tooltip>

          {/* Export dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={connectionHistory.length === 0}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Export history</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("json")}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear all */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClearAll}
                disabled={connectionHistory.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all history</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Statistics panel (collapsible) */}
      {showStats && (
        <div className="p-3 border-b bg-muted/30 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-md bg-background">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{stats.totalQueries}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-success" />
                Success
              </span>
              <span className="font-medium text-success">{stats.successfulQueries}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background">
              <span className="text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3 text-destructive" />
                Failed
              </span>
              <span className="font-medium text-destructive">{stats.failedQueries}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background">
              <span className="text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                Favorites
              </span>
              <span className="font-medium">{stats.favoriteCount}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background col-span-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Avg. time
              </span>
              <span className="font-medium">
                {formatExecutionTime(Math.round(stats.averageExecutionTime))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="p-3 border-b space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search queries..."
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((f) => ({ ...f, searchQuery: e.target.value }))
              }
              className="pl-8 pr-8 h-8 text-xs"
            />
            {filters.searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={() => setFilters((f) => ({ ...f, searchQuery: "" }))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                variant={activeFilterCount > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="h-4 px-1 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={clearFilters}
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Status filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <div className="flex gap-1">
                    {(["all", "success", "failed"] as const).map((status) => (
                      <Button
                        key={status}
                        variant={filters.successFilter === status ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() =>
                          setFilters((f) => ({ ...f, successFilter: status }))
                        }
                      >
                        {status === "all" ? "All" : status === "success" ? "Success" : "Failed"}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Favorites filter */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Favorites only
                  </label>
                  <Button
                    variant={filters.showFavoritesOnly ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        showFavoritesOnly: !f.showFavoritesOnly,
                      }))
                    }
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        filters.showFavoritesOnly ? "fill-yellow-500 text-yellow-500" : ""
                      }`}
                    />
                  </Button>
                </div>

                <Separator />

                {/* Date range presets */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Date range
                  </label>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => setDatePreset("today")}
                    >
                      Today
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => setDatePreset("week")}
                    >
                      Week
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => setDatePreset("month")}
                    >
                      Month
                    </Button>
                  </div>
                  {(filters.dateRange.start || filters.dateRange.end) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs w-full"
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          dateRange: { start: null, end: null },
                        }))
                      }
                    >
                      Clear date filter
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Execution time filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Execution time (ms)
                  </label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      placeholder="Min"
                      className="h-7 text-xs"
                      value={filters.executionTimeRange.min ?? ""}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          executionTimeRange: {
                            ...f.executionTimeRange,
                            min: e.target.value ? parseInt(e.target.value) : null,
                          },
                        }))
                      }
                    />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      className="h-7 text-xs"
                      value={filters.executionTimeRange.max ?? ""}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          executionTimeRange: {
                            ...f.executionTimeRange,
                            max: e.target.value ? parseInt(e.target.value) : null,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* History list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {filters.searchQuery || activeFilterCount > 0
                  ? "No matching queries found"
                  : "No query history yet"}
              </p>
              {!filters.searchQuery && activeFilterCount === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Execute queries to build your history
                </p>
              )}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            filteredHistory.map((entry) => (
              <QueryHistoryItem
                key={entry.id}
                entry={entry}
                onLoad={onLoadQuery}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
