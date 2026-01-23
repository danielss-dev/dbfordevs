import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Button } from "@/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSchemaSearchStore, useQueryStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { useDatabase } from "@/hooks";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { getDatabaseFeatureSupport } from "@/lib/database-features";
import { getSchemaObjectFullName } from "@/lib/table-utils";
import { SchemaSearchResults } from "./SchemaSearchResults";
import { SchemaSearchFilters } from "./SchemaSearchFilters";
import type { SchemaSearchResult } from "@/types";

interface SchemaSearchInputProps {
  connectionId: string;
}

export function SchemaSearchInput({ connectionId }: SchemaSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);

  const {
    isOpen,
    setOpen,
    query,
    setQuery,
    results,
    setResults,
    setSearching,
    selectedIndex,
    selectNext,
    selectPrevious,
    enabledFilters,
    updateSchemaCache,
    getFromCache,
  } = useSchemaSearchStore();

  const { addTab, setActiveTab } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const {
    getTables,
    getViews,
    getAllIndexes,
    getProcedures,
    getFunctions,
    getTriggers,
    getSequences,
  } = useDatabase();

  // Get database feature support
  const featureSupport = useMemo(() => {
    if (!activeConnection) return null;
    return getDatabaseFeatureSupport(activeConnection.databaseType);
  }, [activeConnection]);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Fetch all schema objects for the connection
   */
  const fetchSchemaObjects = useCallback(async (): Promise<SchemaSearchResult[]> => {
    if (!activeConnection) return [];

    const items: SchemaSearchResult[] = [];
    const connId = connectionId;

    try {
      // Fetch tables and their columns
      const tables = await getTables(connId);
      for (const table of tables) {
        const fullPath = getSchemaObjectFullName(table);
        items.push({
          id: `table-${fullPath}`,
          objectType: "table",
          name: table.name,
          fullPath,
          schema: table.schema,
          connectionId: connId,
          matchScore: 0,
          matchIndices: [],
          metadata: { rowCount: table.rowCount },
        });
      }

      // Fetch views - try for all databases, silently fail if not supported
      try {
        const views = await getViews(connId);
        for (const view of views) {
          const fullPath = getSchemaObjectFullName(view);
          items.push({
            id: `view-${fullPath}`,
            objectType: "view",
            name: view.name,
            fullPath,
            schema: view.schema,
            connectionId: connId,
            matchScore: 0,
            matchIndices: [],
          });
        }
      } catch {
        // Views not available for this connection
      }

      // Fetch indexes - try for all databases, silently fail if not supported
      try {
        const indexes = await getAllIndexes(connId);
        for (const idx of indexes) {
          const fullPath = getSchemaObjectFullName(idx);
          items.push({
            id: `index-${fullPath}`,
            objectType: "index",
            name: idx.name,
            fullPath,
            parentName: idx.tableName,
            schema: idx.schema,
            connectionId: connId,
            matchScore: 0,
            matchIndices: [],
            metadata: { isUnique: idx.isUnique, columns: idx.columns },
          });
        }
      } catch {
        // Indexes not available
      }

      // Fetch procedures if supported
      if (featureSupport?.procedures) {
        try {
          const procedures = await getProcedures(connId);
          for (const proc of procedures) {
            const fullPath = getSchemaObjectFullName(proc);
            items.push({
              id: `procedure-${fullPath}`,
              objectType: "procedure",
              name: proc.name,
              fullPath,
              schema: proc.schema,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: { language: proc.language },
            });
          }
        } catch {
          // Procedures not available
        }
      }

      // Fetch functions if supported
      if (featureSupport?.functions) {
        try {
          const functions = await getFunctions(connId);
          for (const func of functions) {
            const fullPath = getSchemaObjectFullName(func);
            items.push({
              id: `function-${fullPath}`,
              objectType: "function",
              name: func.name,
              fullPath,
              schema: func.schema,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: { returnType: func.returnType, language: func.language },
            });
          }
        } catch {
          // Functions not available
        }
      }

      // Fetch triggers if supported
      if (featureSupport?.triggers) {
        try {
          const triggers = await getTriggers(connId);
          for (const trigger of triggers) {
            const fullPath = getSchemaObjectFullName(trigger);
            items.push({
              id: `trigger-${fullPath}`,
              objectType: "trigger",
              name: trigger.name,
              fullPath,
              parentName: trigger.tableName,
              schema: trigger.schema,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: { timing: trigger.timing, event: trigger.event },
            });
          }
        } catch {
          // Triggers not available
        }
      }

      // Fetch sequences if supported
      if (featureSupport?.sequences) {
        try {
          const sequences = await getSequences(connId);
          for (const seq of sequences) {
            const fullPath = getSchemaObjectFullName(seq);
            items.push({
              id: `sequence-${fullPath}`,
              objectType: "sequence",
              name: seq.name,
              fullPath,
              schema: seq.schema,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: { currentValue: seq.currentValue },
            });
          }
        } catch {
          // Sequences not available
        }
      }

      // Also add column items from cached table data
      // We need to get columns from table schemas
      const { tablesByConnection } = useQueryStore.getState();
      const connectionTables = tablesByConnection[connId] || [];

      // We need to fetch table schemas to get columns
      // For performance, we'll fetch schemas lazily during search
      // For now, we rely on cached schemas from the schema store
      const { getSchema } = await import("@/stores/schema").then(m => ({ getSchema: m.useSchemaStore.getState().getSchema }));

      for (const table of connectionTables) {
        const tablePath = getSchemaObjectFullName(table);
        const schema = getSchema(connId, tablePath);
        if (schema) {
          for (const col of schema.columns) {
            items.push({
              id: `column-${tablePath}.${col.name}`,
              objectType: "column",
              name: col.name,
              fullPath: `${tablePath}.${col.name}`,
              parentName: table.name,
              schema: table.schema,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: {
                dataType: col.dataType,
                nullable: col.nullable,
                isPrimaryKey: col.isPrimaryKey
              },
            });
          }
        }
      }

      return items;
    } catch (error) {
      console.error("Error fetching schema objects:", error);
      return [];
    }
  }, [
    connectionId,
    activeConnection,
    featureSupport,
    getTables,
    getViews,
    getAllIndexes,
    getProcedures,
    getFunctions,
    getTriggers,
    getSequences,
  ]);

  /**
   * Perform the search
   */
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);

    try {
      // Check cache first
      let items = getFromCache(connectionId);

      if (!items) {
        // Fetch fresh data
        items = await fetchSchemaObjects();
        updateSchemaCache(connectionId, items);
      }

      // Filter by enabled object types
      const filteredItems = items.filter(item => enabledFilters.includes(item.objectType));

      // Perform fuzzy search
      const searchResults = fuzzySearch(
        filteredItems,
        searchQuery,
        (item) => item.name
      );

      // Update results
      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [
    connectionId,
    enabledFilters,
    getFromCache,
    fetchSchemaObjects,
    updateSchemaCache,
    setResults,
    setSearching,
  ]);

  /**
   * Handle search input change with debounce
   */
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the search
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [setQuery, performSearch]);

  /**
   * Handle result selection
   */
  const handleResultClick = useCallback((result: SchemaSearchResult) => {
    setOpen(false);
    setQuery("");

    // Navigate to the result
    switch (result.objectType) {
      case "table":
      case "view": {
        // Open a query tab with SELECT * from the table/view
        const tabId = crypto.randomUUID();
        const sql = `SELECT * FROM ${result.fullPath} LIMIT 100;`;
        addTab({
          id: tabId,
          title: result.name,
          type: "query",
          connectionId: result.connectionId,
          content: sql,
        });
        setActiveTab(tabId);
        break;
      }
      case "column": {
        // Open a query tab with SELECT of the column
        const parentTable = result.parentName;
        const schema = result.schema;
        const tablePath = schema ? `${schema}.${parentTable}` : parentTable;
        const tabId = crypto.randomUUID();
        const sql = `SELECT ${result.name} FROM ${tablePath} LIMIT 100;`;
        addTab({
          id: tabId,
          title: `${parentTable}.${result.name}`,
          type: "query",
          connectionId: result.connectionId,
          content: sql,
        });
        setActiveTab(tabId);
        break;
      }
      case "index": {
        // Could show index definition or navigate to the table
        // For now, we'll just show the table the index belongs to
        const tabId = crypto.randomUUID();
        const parentTable = result.parentName;
        const schema = result.schema;
        const tablePath = schema ? `${schema}.${parentTable}` : parentTable;
        const sql = `-- Index: ${result.name}\n-- Table: ${tablePath}\n-- Columns: ${(result.metadata?.columns as string[])?.join(", ") || "unknown"}\n\nSELECT * FROM ${tablePath} LIMIT 100;`;
        addTab({
          id: tabId,
          title: result.name,
          type: "query",
          connectionId: result.connectionId,
          content: sql,
        });
        setActiveTab(tabId);
        break;
      }
      case "procedure":
      case "function": {
        // Open a tab showing how to call the procedure/function
        const tabId = crypto.randomUUID();
        const sql = `-- ${result.objectType === "procedure" ? "Procedure" : "Function"}: ${result.fullPath}\n-- Language: ${result.metadata?.language || "unknown"}\n${result.objectType === "function" ? `-- Return type: ${result.metadata?.returnType || "unknown"}\n` : ""}\n-- To execute:\n-- CALL ${result.fullPath}();`;
        addTab({
          id: tabId,
          title: result.name,
          type: "query",
          connectionId: result.connectionId,
          content: sql,
        });
        setActiveTab(tabId);
        break;
      }
      case "trigger": {
        // Show trigger info
        const tabId = crypto.randomUUID();
        const sql = `-- Trigger: ${result.fullPath}\n-- Table: ${result.parentName}\n-- Timing: ${result.metadata?.timing || "unknown"}\n-- Event: ${result.metadata?.event || "unknown"}`;
        addTab({
          id: tabId,
          title: result.name,
          type: "query",
          connectionId: result.connectionId,
          content: sql,
        });
        setActiveTab(tabId);
        break;
      }
      case "sequence": {
        // Show sequence value
        const tabId = crypto.randomUUID();
        const sql = `-- Sequence: ${result.fullPath}\n-- Current value: ${result.metadata?.currentValue || "unknown"}\n\n-- To get next value (PostgreSQL):\n-- SELECT nextval('${result.fullPath}');`;
        addTab({
          id: tabId,
          title: result.name,
          type: "query",
          connectionId: result.connectionId,
          content: sql,
        });
        setActiveTab(tabId);
        break;
      }
    }
  }, [setOpen, setQuery, addTab, setActiveTab]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        selectNext();
        break;
      case "ArrowUp":
        e.preventDefault();
        selectPrevious();
        break;
      case "Enter":
        e.preventDefault();
        if (results.length > 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  }, [isOpen, results, selectedIndex, selectNext, selectPrevious, handleResultClick, setOpen]);

  // Clear results when filters change
  useEffect(() => {
    if (query.trim()) {
      performSearch(query);
    }
  }, [enabledFilters]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const activeFilterCount = 8 - enabledFilters.length; // Show count of disabled filters

  return (
    <div className="px-2 py-1.5 border-b border-sidebar-border">
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search schema..."
                className="h-7 pl-7 pr-7 text-xs bg-sidebar-accent/50"
                onClick={() => !isOpen && setOpen(true)}
              />
              {query && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                    setResults([]);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              variant={activeFilterCount > 0 ? "secondary" : "ghost"}
              size="icon"
              className={cn(
                "h-7 w-7 flex-shrink-0 relative",
                activeFilterCount > 0 && "text-primary"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setShowFilters(!showFilters);
                if (!isOpen) setOpen(true);
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-medium text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-[320px] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          {showFilters ? (
            <div className="p-2">
              <SchemaSearchFilters />
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowFilters(false)}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="p-1">
              <SchemaSearchResults
                onResultClick={handleResultClick}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
