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
import { useSchemaSearchStore, useQueryStore, useConnectionsStore, useUIStore, selectActiveConnection, useSidebarHighlightStore } from "@/stores";
import { useMongoDBStore } from "@/stores/mongodb";
import { useCassandraStore } from "@/stores/cassandra";
import { useDatabase, useRedis, useMongoDB, useCassandra } from "@/hooks";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { getDatabaseFeatureSupport } from "@/lib/database-features";
import { getDatabaseBrand, getDatabaseColor } from "@/lib/constants";
import { getSchemaObjectFullName, getBaseName } from "@/lib/table-utils";
import { SchemaSearchResults } from "./SchemaSearchResults";
import { SchemaSearchFilters } from "./SchemaSearchFilters";
import type { SchemaSearchResult, Tab } from "@/types";

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
    setEnabledFilters,
    updateSchemaCache,
    getFromCache,
  } = useSchemaSearchStore();

  const { tabs, addTab, setActiveTab } = useQueryStore();
  const { connections, setActiveConnection } = useConnectionsStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const { setRightPanelTab } = useUIStore();
  const { setHighlightedTable } = useSidebarHighlightStore();
  const {
    getTables,
    getViews,
    getAllIndexes,
    getProcedures,
    getFunctions,
    getTriggers,
    getSequences,
  } = useDatabase();

  // Hooks for fetching Redis, MongoDB, and Cassandra data
  const { scanKeys } = useRedis();
  const { listDatabases, listCollections, listIndexes } = useMongoDB();
  const { listKeyspaces, listTables: listCassandraTables, describeTable: describeCassandraTable, listIndexes: listCassandraIndexes } = useCassandra();

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

  // Clear results and reset filters when connection changes
  useEffect(() => {
    setResults([]);
    setQuery("");
    // Reset filters to appropriate ones for the new database type
    if (selectedConnection) {
      const dbType = selectedConnection.databaseType;
      if (dbType === "redis") {
        setEnabledFilters(["redis-key"]);
      } else if (dbType === "mongodb") {
        setEnabledFilters(["mongo-database", "mongo-collection", "mongo-index"]);
      } else if (dbType === "cassandra") {
        setEnabledFilters(["cassandra-keyspace", "cassandra-table", "cassandra-column", "cassandra-index"]);
      } else {
        // SQL databases
        setEnabledFilters(["table", "column", "view", "index", "procedure", "function", "trigger", "sequence"]);
      }
    }
  }, [selectedConnectionId, selectedConnection, setResults, setQuery, setEnabledFilters]);

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
    const dbType = selectedConnection.databaseType;

    try {
      // Redis: actively fetch keys
      if (dbType === "redis") {
        // Fetch keys from backend (scan with wildcard pattern)
        const scanResult = await scanKeys(connId, "*", 1000, 0, false);
        const redisKeys = scanResult?.keys || [];

        for (const keyInfo of redisKeys) {
          items.push({
            id: `redis-key-${keyInfo.key}`,
            objectType: "redis-key",
            name: keyInfo.key,
            fullPath: keyInfo.key,
            connectionId: connId,
            matchScore: 0,
            matchIndices: [],
            metadata: { keyType: keyInfo.keyType, ttl: keyInfo.ttl },
          });
        }
        return items;
      }

      // MongoDB: actively fetch databases, collections, and indexes
      if (dbType === "mongodb") {
        // Fetch databases from backend
        const mongoDbs = await listDatabases(connId) || [];

        for (const db of mongoDbs) {
          items.push({
            id: `mongo-database-${db.name}`,
            objectType: "mongo-database",
            name: db.name,
            fullPath: db.name,
            connectionId: connId,
            matchScore: 0,
            matchIndices: [],
            metadata: { sizeBytes: db.sizeBytes, isEmpty: db.isEmpty },
          });

          // Fetch collections for this database
          const collections = await listCollections(connId, db.name) || [];
          for (const coll of collections) {
            const collFullPath = `${db.name}.${coll.name}`;
            items.push({
              id: `mongo-collection-${collFullPath}`,
              objectType: "mongo-collection",
              name: coll.name,
              fullPath: collFullPath,
              parentName: db.name,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: { documentCount: coll.documentCount, capped: coll.capped },
            });

            // Fetch indexes for this collection
            const indexes = await listIndexes(connId, db.name, coll.name) || [];
            for (const idx of indexes) {
              const idxFullPath = `${db.name}.${coll.name}.${idx.name}`;
              items.push({
                id: `mongo-index-${idxFullPath}`,
                objectType: "mongo-index",
                name: idx.name,
                fullPath: idxFullPath,
                parentName: coll.name,
                schema: db.name,
                connectionId: connId,
                matchScore: 0,
                matchIndices: [],
                metadata: { keys: idx.keys, unique: idx.unique },
              });
            }
          }
        }
        return items;
      }

      // Cassandra: fetch keyspaces, tables, columns, and indexes
      if (dbType === "cassandra") {
        // Fetch keyspaces from backend
        const keyspaces = await listKeyspaces(connId) || [];

        for (const ks of keyspaces) {
          items.push({
            id: `cassandra-keyspace-${ks.name}`,
            objectType: "cassandra-keyspace",
            name: ks.name,
            fullPath: ks.name,
            connectionId: connId,
            matchScore: 0,
            matchIndices: [],
            metadata: { replicationStrategy: ks.replicationStrategy, replicationFactor: ks.replicationFactor },
          });

          // Fetch tables for this keyspace
          const tables = await listCassandraTables(connId, ks.name) || [];
          for (const table of tables) {
            const tableFullPath = `${ks.name}.${table.name}`;
            items.push({
              id: `cassandra-table-${tableFullPath}`,
              objectType: "cassandra-table",
              name: table.name,
              fullPath: tableFullPath,
              parentName: ks.name,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: { columnCount: table.columnCount, partitionKeys: table.partitionKeys },
            });

            // Fetch columns for this table
            const columns = await describeCassandraTable(connId, ks.name, table.name) || [];
            for (const col of columns) {
              const colFullPath = `${ks.name}.${table.name}.${col.name}`;
              items.push({
                id: `cassandra-column-${colFullPath}`,
                objectType: "cassandra-column",
                name: col.name,
                fullPath: colFullPath,
                parentName: table.name,
                schema: ks.name,
                connectionId: connId,
                matchScore: 0,
                matchIndices: [],
                metadata: { dataType: col.dataType, kind: col.kind },
              });
            }
          }

          // Fetch indexes for this keyspace
          const indexes = await listCassandraIndexes(connId, ks.name) || [];
          for (const idx of indexes) {
            const idxFullPath = `${ks.name}.${idx.tableName}.${idx.name}`;
            items.push({
              id: `cassandra-index-${idxFullPath}`,
              objectType: "cassandra-index",
              name: idx.name,
              fullPath: idxFullPath,
              parentName: idx.tableName,
              schema: ks.name,
              connectionId: connId,
              matchScore: 0,
              matchIndices: [],
              metadata: { indexType: idx.indexType, columnName: idx.columnName },
            });
          }
        }
        return items;
      }

      // SQL databases: fetch tables and their columns
      const tables = await getTables(connId);
      for (const table of tables) {
        const fullPath = getSchemaObjectFullName(table);
        const displayName = getBaseName(table.name);
        items.push({
          id: `table-${fullPath}`,
          objectType: "table",
          name: displayName,
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
          const displayName = getBaseName(view.name);
          items.push({
            id: `view-${fullPath}`,
            objectType: "view",
            name: displayName,
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
      const { tablesByConnection } = useQueryStore.getState();
      const connectionTables = tablesByConnection[connId] || [];

      const { getSchema } = await import("@/stores/schema").then(m => ({ getSchema: m.useSchemaStore.getState().getSchema }));

      for (const table of connectionTables) {
        const tablePath = getSchemaObjectFullName(table);
        const tableDisplayName = getBaseName(table.name);
        const schema = getSchema(connId, tablePath);
        if (schema) {
          for (const col of schema.columns) {
            items.push({
              id: `column-${tablePath}.${col.name}`,
              objectType: "column",
              name: col.name,
              fullPath: `${tablePath}.${col.name}`,
              parentName: tableDisplayName,
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
    scanKeys,
    listDatabases,
    listCollections,
    listIndexes,
    listKeyspaces,
    listCassandraTables,
    describeCassandraTable,
    listCassandraIndexes,
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
        // Open the table browser (same as clicking in sidebar)
        const tabId = `table-${result.connectionId}-${result.fullPath}`;
        const existingTab = tabs.find((t) => t.id === tabId);
        if (existingTab) {
          setActiveTab(tabId);
        } else {
          addTab({
            id: tabId,
            title: result.name,
            tableName: result.fullPath,
            type: "table",
            connectionId: result.connectionId,
          });
        }
        // Highlight the table in the sidebar tree
        setHighlightedTable(result.connectionId, {
          schema: result.schema,
          table: result.fullPath,
        });
        // Switch to the connection and close search panel
        setActiveConnection(result.connectionId);
        setRightPanelTab(null);
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
      // Redis
      case "redis-key": {
        // Open the key viewer (same as clicking in sidebar)
        const tabId = `redis-key-${result.connectionId}-${result.name}`;
        const existingTab = tabs.find((t) => t.id === tabId);
        if (existingTab) {
          setActiveTab(tabId);
        } else {
          addTab({
            id: tabId,
            title: result.name.length > 20 ? result.name.substring(0, 17) + "..." : result.name,
            type: "redis-key",
            connectionId: result.connectionId,
            redisKey: result.name,
          } as Tab);
        }
        // Switch to the connection and close search panel
        setActiveConnection(result.connectionId);
        setRightPanelTab(null);
        break;
      }
      // MongoDB
      case "mongo-database": {
        // Switch to the connection and highlight the database
        setActiveConnection(result.connectionId);
        useMongoDBStore.getState().setHighlightedItem(result.connectionId, {
          type: "database",
          name: result.name,
        });
        // Close the search panel
        setRightPanelTab(null);
        break;
      }
      case "mongo-collection": {
        const dbName = result.parentName;
        if (dbName) {
          // Open the collection browser (same as clicking in sidebar)
          const tabId = `mongodb-browser-${result.connectionId}-${dbName}-${result.name}`;
          const existingTab = tabs.find((t) => t.id === tabId);
          if (existingTab) {
            setActiveTab(tabId);
          } else {
            addTab({
              id: tabId,
              title: result.name.length > 20 ? result.name.substring(0, 17) + "..." : result.name,
              type: "mongodb-browser",
              connectionId: result.connectionId,
              mongoDatabase: dbName,
              mongoCollection: result.name,
            } as Tab);
          }
          // Highlight the collection in the sidebar tree
          useMongoDBStore.getState().setHighlightedItem(result.connectionId, {
            type: "collection",
            dbName,
            name: result.name,
          });
          // Switch to the connection and close search panel
          setActiveConnection(result.connectionId);
          setRightPanelTab(null);
        }
        break;
      }
      case "mongo-index": {
        const dbName = result.schema;
        const collName = result.parentName;
        if (dbName && collName) {
          // Switch to the connection and highlight the index
          setActiveConnection(result.connectionId);
          useMongoDBStore.getState().setHighlightedItem(result.connectionId, {
            type: "index",
            dbName,
            collName,
            name: result.name,
          });
          // Close the search panel
          setRightPanelTab(null);
        }
        break;
      }
      // Cassandra
      case "cassandra-keyspace": {
        // Switch to the connection and highlight the keyspace
        setActiveConnection(result.connectionId);
        useCassandraStore.getState().setHighlightedItem(result.connectionId, {
          type: "keyspace",
          name: result.name,
        });
        // Close the search panel
        setRightPanelTab(null);
        break;
      }
      case "cassandra-table": {
        const keyspace = result.parentName;
        if (keyspace) {
          // Open the table browser (same as clicking in sidebar)
          const tabId = `cassandra-browser-${result.connectionId}-${keyspace}-${result.name}`;
          const existingTab = tabs.find((t) => t.id === tabId);
          if (existingTab) {
            setActiveTab(tabId);
          } else {
            addTab({
              id: tabId,
              title: result.name.length > 20 ? result.name.substring(0, 17) + "..." : result.name,
              type: "cassandra-browser",
              connectionId: result.connectionId,
              cassandraKeyspace: keyspace,
              cassandraTable: result.name,
            } as Tab);
          }
          // Highlight the table in the sidebar tree
          useCassandraStore.getState().setHighlightedItem(result.connectionId, {
            type: "table",
            keyspace,
            name: result.name,
          });
          // Switch to the connection and close search panel
          setActiveConnection(result.connectionId);
          setRightPanelTab(null);
        }
        break;
      }
      case "cassandra-column": {
        const keyspace = result.schema;
        const tableName = result.parentName;
        if (keyspace && tableName) {
          // Switch to the connection and highlight the column
          setActiveConnection(result.connectionId);
          useCassandraStore.getState().setHighlightedItem(result.connectionId, {
            type: "column",
            keyspace,
            table: tableName,
            name: result.name,
          });
          // Close the search panel
          setRightPanelTab(null);
        }
        break;
      }
      case "cassandra-index": {
        const keyspace = result.schema;
        const tableName = result.parentName;
        if (keyspace && tableName) {
          // Switch to the connection and highlight the index
          setActiveConnection(result.connectionId);
          useCassandraStore.getState().setHighlightedItem(result.connectionId, {
            type: "index",
            keyspace,
            table: tableName,
            name: result.name,
          });
          // Close the search panel
          setRightPanelTab(null);
        }
        break;
      }
    }
  }, [addTab, setActiveTab, setActiveConnection, setRightPanelTab]);

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

  // Calculate filter count based on database type
  const getFilterCount = () => {
    const dbType = selectedConnection?.databaseType;
    if (dbType === "redis") {
      const redisFilters = enabledFilters.filter(f => f === "redis-key");
      return 1 - redisFilters.length; // 1 filter type for Redis
    }
    if (dbType === "mongodb") {
      const mongoFilters = enabledFilters.filter(f => f.startsWith("mongo-"));
      return 3 - mongoFilters.length; // 3 filter types for MongoDB
    }
    if (dbType === "cassandra") {
      const cassandraFilters = enabledFilters.filter(f => f.startsWith("cassandra-"));
      return 4 - cassandraFilters.length; // 4 filter types for Cassandra
    }
    // SQL databases have 8 filter types
    const sqlFilters = enabledFilters.filter(f => !f.startsWith("redis-") && !f.startsWith("mongo-") && !f.startsWith("cassandra-"));
    return 8 - sqlFilters.length;
  };
  const activeFilterCount = getFilterCount();

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
            placeholder={
              selectedConnection?.databaseType === "redis"
                ? "Search keys..."
                : selectedConnection?.databaseType === "mongodb"
                  ? "Search databases, collections..."
                  : selectedConnection?.databaseType === "cassandra"
                    ? "Search keyspaces, tables..."
                    : "Search tables, columns, views..."
            }
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
          <SchemaSearchFilters databaseType={selectedConnection?.databaseType} />
        </div>
      )}

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <SchemaSearchResults
            onResultClick={handleResultClick}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
