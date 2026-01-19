import { useMemo } from "react";
import { Loader2, History, X, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { useSchemaSearchStore } from "@/stores";
import { SchemaSearchResultItem } from "./SchemaSearchResultItem";
import { SCHEMA_OBJECT_TYPE_LABELS } from "@/types";
import type { SchemaObjectType, SchemaSearchResult, SearchHistoryEntry } from "@/types";

interface SchemaSearchResultsProps {
  onResultClick: (result: SchemaSearchResult) => void;
  onHistoryClick: (entry: SearchHistoryEntry) => void;
}

interface GroupedResults {
  objectType: SchemaObjectType;
  label: string;
  results: SchemaSearchResult[];
}

export function SchemaSearchResults({
  onResultClick,
  onHistoryClick,
}: SchemaSearchResultsProps) {
  const {
    query,
    results,
    isSearching,
    selectedIndex,
    setSelectedIndex,
    searchHistory,
    removeFromHistory,
    clearHistory,
    enabledFilters,
  } = useSchemaSearchStore();

  // Filter results by enabled filters
  const filteredResults = useMemo(() => {
    return results.filter((r) => enabledFilters.includes(r.objectType));
  }, [results, enabledFilters]);

  // Group results by object type
  const groupedResults = useMemo((): GroupedResults[] => {
    const groups: Record<SchemaObjectType, SchemaSearchResult[]> = {
      table: [],
      column: [],
      view: [],
      index: [],
      procedure: [],
      function: [],
      trigger: [],
      sequence: [],
      // Redis
      "redis-key": [],
      // MongoDB
      "mongo-database": [],
      "mongo-collection": [],
      "mongo-index": [],
    };

    for (const result of filteredResults) {
      groups[result.objectType].push(result);
    }

    // Order: tables first, then columns, then rest, then Redis, then MongoDB
    const order: SchemaObjectType[] = [
      "table",
      "column",
      "view",
      "index",
      "procedure",
      "function",
      "trigger",
      "sequence",
      // Redis
      "redis-key",
      // MongoDB
      "mongo-database",
      "mongo-collection",
      "mongo-index",
    ];

    return order
      .filter((type) => groups[type].length > 0)
      .map((type) => ({
        objectType: type,
        label: SCHEMA_OBJECT_TYPE_LABELS[type],
        results: groups[type],
      }));
  }, [filteredResults]);

  // Calculate flat index for keyboard navigation
  const getFlatIndexForResult = (result: SchemaSearchResult): number => {
    let currentIndex = 0;
    for (const group of groupedResults) {
      for (const r of group.results) {
        if (r.id === result.id) return currentIndex;
        currentIndex++;
      }
    }
    return -1;
  };

  // Loading state
  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
      </div>
    );
  }

  // No query - show history
  if (!query.trim()) {
    if (searchHistory.length === 0) {
      return (
        <div className="py-8 text-center">
          <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Search for tables, columns, views, and more
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Type to start searching
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            <span>Recent searches</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearHistory}
          >
            Clear
          </Button>
        </div>
        <div className="space-y-0.5">
          {searchHistory.map((entry) => (
            <button
              key={entry.id}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent/50 group"
              onClick={() => onHistoryClick(entry)}
            >
              <History className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-left truncate">{entry.query}</span>
              <span className="text-xs text-muted-foreground">
                {entry.resultCount} result{entry.resultCount !== 1 ? "s" : ""}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromHistory(entry.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // No results
  if (filteredResults.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No results found for "{query}"
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Try a different search term or adjust filters
        </p>
      </div>
    );
  }

  // Results grouped by type
  return (
    <div className="space-y-2 py-1">
      {groupedResults.map((group) => (
        <div key={group.objectType}>
          {/* Group header */}
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider sticky top-0 bg-popover/95 backdrop-blur-sm">
            {group.label} ({group.results.length})
          </div>

          {/* Group items */}
          <div className="space-y-0.5">
            {group.results.map((result) => {
              const flatIndex = getFlatIndexForResult(result);
              return (
                <SchemaSearchResultItem
                  key={result.id}
                  result={result}
                  isSelected={flatIndex === selectedIndex}
                  onClick={() => onResultClick(result)}
                  onMouseEnter={() => setSelectedIndex(flatIndex)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
