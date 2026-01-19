import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Button, ScrollArea, BrandIcon } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchemaSearchStore, useQueryStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { useDatabase } from "@/hooks";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { getDatabaseFeatureSupport } from "@/lib/database-features";
import { getDatabaseBrand, getDatabaseColor } from "@/lib/constants";
import { SchemaSearchResults } from "./SchemaSearchResults";
import { SchemaSearchFilters } from "./SchemaSearchFilters";
import type { SchemaSearchResult, SearchHistoryEntry } from "@/types";

export function SchemaSearchPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");

  const {
    query,
    setQuery,
    results,
    setResults,
    setSearching,
    selectedIndex,
    selectNext,
    selectPrevious,
    enabledFilters,
    addToHistory,
    updateSchemaCache,
    getFromCache,
  } = useSchemaSearchStore();

  const { addTab, setActiveTab } = useQueryStore();
  const { connections } = useConnectionsStore();
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

  // Get only connected connections
  const connectedConnections = useMemo(() => {
    return connections.filter(c => c.connected);
  }, [connections]);

  // Get the selected connection object
  const selectedConnection = useMemo(() => {
    return connectedConnections.find(c => c.id === selectedConnectionId) || null;
  }, [connectedConnections, selectedConnectionId]);

  // Initialize selected connection to active connection or first connected
  useEffect(() => {
    if (!selectedConnectionId || !connectedConnections.find(c => c.id === selectedConnectionId)) {
      if (activeConnection?.connected) {
        setSelectedConnectionId(activeConnection.id);
      } else if (connectedConnections.length > 0) {
        setSelectedConnectionId(connectedConnections[0].id);
      }
    }
  }, [activeConnection, connectedConnections, selectedConnectionId]);

  // Clear results when connection changes
  useEffect(() => {
    setResults([]);
    setQuery("");
  }, [selectedConnectionId, setResults, setQuery]);

  // Get database feature support for selected connection
  const featureSupport = useMemo(() => {
    if (!selectedConnection) return null;
    return getDatabaseFeatureSupport(selectedConnection.databaseType);
  }, [selectedConnection]);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Fetch all schema objects for the connection
   */
  const fetchSchemaObjects = useCallback(async (): Promise<SchemaSearchResult[]> => {
    if (!selectedConnection || !selectedConnectionId) return [];

    const items: SchemaSearchResult[] = [];
    const connId = selectedConnectionId;

    try {
      // Fetch tables and their columns
      const tables = await getTables(connId);
      for (const table of tables) {
        const fullPath = table.schema ? `${table.schema}.${table.name}` : table.name;
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
          const fullPath = view.schema ? `${view.schema}.${view.name}` : view.name;
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
          const fullPath = idx.schema ? `${idx.schema}.${idx.name}` : idx.name;
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
            const fullPath = proc.schema ? `${proc.schema}.${proc.name}` : proc.name;
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
            const fullPath = func.schema ? `${func.schema}.${func.name}` : func.name;
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
            const fullPath = trigger.schema ? `${trigger.schema}.${trigger.name}` : trigger.name;
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
            const fullPath = seq.schema ? `${seq.schema}.${seq.name}` : seq.name;
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
      const { tablesByConnection } = useQueryStore.getState();
      const connectionTables = tablesByConnection[connId] || [];

      const { getSchema } = await import("@/stores/schema").then(m => ({ getSchema: m.useSchemaStore.getState().getSchema }));

      for (const table of connectionTables) {
        const tablePath = table.schema ? `${table.schema}.${table.name}` : table.name;
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
    selectedConnectionId,
    selectedConnection,
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
    if (!searchQuery.trim() || !selectedConnectionId) {
      setResults([]);
      return;
    }

    setSearching(true);

    try {
      // Check cache first
      let items = getFromCache(selectedConnectionId);

      if (!items) {
        // Fetch fresh data
        items = await fetchSchemaObjects();
        updateSchemaCache(selectedConnectionId, items);
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

      // Add to history if we have results
      if (searchResults.length > 0) {
        addToHistory({
          query: searchQuery,
          connectionId: selectedConnectionId,
          timestamp: Date.now(),
          resultCount: searchResults.length,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [
    selectedConnectionId,
    enabledFilters,
    getFromCache,
    fetchSchemaObjects,
    updateSchemaCache,
    setResults,
    setSearching,
    addToHistory,
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
    // Navigate to the result
    switch (result.objectType) {
      case "table":
      case "view": {
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
  }, [addTab, setActiveTab]);

  /**
   * Handle history item click
   */
  const handleHistoryClick = useCallback((entry: SearchHistoryEntry) => {
    // If the history entry is for a different connection, switch to it
    if (entry.connectionId !== selectedConnectionId) {
      const conn = connectedConnections.find(c => c.id === entry.connectionId);
      if (conn) {
        setSelectedConnectionId(entry.connectionId);
      }
    }
    setQuery(entry.query);
    performSearch(entry.query);
  }, [setQuery, performSearch, selectedConnectionId, connectedConnections]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
    }
  }, [results, selectedIndex, selectNext, selectPrevious, handleResultClick]);

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

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const activeFilterCount = 8 - enabledFilters.length;

  // No connected connections
  if (connectedConnections.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground text-center">
          Connect to a database to search its schema
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">Schema Search</h3>
        <Button
          variant={activeFilterCount > 0 ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-7 px-2 relative",
            activeFilterCount > 0 && "text-primary"
          )}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3.5 w-3.5 mr-1" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 h-4 w-4 rounded-full bg-primary text-[9px] font-medium text-primary-foreground flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Connection Selector */}
      <div className="px-4 py-2 border-b border-border">
        <Select
          value={selectedConnectionId}
          onValueChange={(value) => setSelectedConnectionId(value)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select connection">
              {selectedConnection && (
                <div className="flex items-center gap-2">
                  <BrandIcon
                    name={getDatabaseBrand(selectedConnection.databaseType)}
                    className={cn("h-4 w-4", getDatabaseColor(selectedConnection.databaseType))}
                  />
                  <span className="truncate">{selectedConnection.name}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {connectedConnections.map((conn) => (
              <SelectItem key={conn.id} value={conn.id}>
                <div className="flex items-center gap-2">
                  <BrandIcon
                    name={getDatabaseBrand(conn.databaseType)}
                    className={cn("h-4 w-4", getDatabaseColor(conn.databaseType))}
                  />
                  <span>{conn.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({conn.database})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search Input */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tables, columns, views..."
            className="h-9 pl-9 pr-9"
          />
          {query && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel (collapsible) */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <SchemaSearchFilters />
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <SchemaSearchResults
            onResultClick={handleResultClick}
            onHistoryClick={handleHistoryClick}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
