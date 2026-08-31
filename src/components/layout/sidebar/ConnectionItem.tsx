import { useState, useEffect, useRef, useCallback } from "react";
import {
  Database,
  TreeStructure,
  Table,
  Plus,
  CaretRight,
  CircleNotch,
  PencilSimple,
  Trash,
  Info,
  Plugs,
  PlugsConnected,
  ArrowClockwise,
  Copy,
  ClipboardText,
  Graph,
  GitDiff,
  Camera,
  Rows,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TreeRowsSkeleton,
} from "@/components/ui";
import { ConnectionPropertiesDialog } from "@/components/connections";
import { RedisConnectionContent } from "@/components/redis";
import { MongoConnectionContent } from "@/components/mongodb";
import { CassandraConnectionContent } from "@/components/cassandra";
import { useConnectionsStore, useUIStore, useQueryStore, useSidebarHighlightStore, useDiffStore, useDataDiffStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo, TableInfo, DatabaseInfo, DatabaseType } from "@/types";
import { getDatabaseFeatureSupport } from "@/lib/database-features";
import { BrandIcon } from "@/components/ui";
import { copyToClipboard, readFromClipboard } from "@/lib/utils";
import { getDatabaseBrand, getDatabaseColor } from "@/lib/constants";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast-helpers";
import { buildTableIdentifier } from "@/lib/table-utils";
import { TreeItem } from "./TreeItem";
import { SecuritySection } from "./sections/SecuritySection";
import { ViewsSection } from "./sections/ViewsSection";
import { IndexesSection } from "./sections/IndexesSection";
import { ProceduresSection } from "./sections/ProceduresSection";
import { FunctionsSection } from "./sections/FunctionsSection";
import { TriggersSection } from "./sections/TriggersSection";
import { SequencesSection } from "./sections/SequencesSection";

export function ConnectionItem({ connection }: { connection: ConnectionInfo }) {
  // Use granular selectors to prevent re-renders from unrelated store changes
  const activeConnectionId = useConnectionsStore(state => state.activeConnectionId);
  const setActiveConnection = useConnectionsStore(state => state.setActiveConnection);
  const openConnectionModal = useUIStore(state => state.openConnectionModal);
  const openRenameTableDialog = useUIStore(state => state.openRenameTableDialog);
  const openRenameConnectionDialog = useUIStore(state => state.openRenameConnectionDialog);
  const openCreateTableDialog = useUIStore(state => state.openCreateTableDialog);
  const openAssignGroupDialog = useUIStore(state => state.openAssignGroupDialog);
  // Only subscribe to this connection's data, not all connections
  const tablesByConnection = useQueryStore(state => state.tablesByConnection);
  const addTab = useQueryStore(state => state.addTab);
  const tabs = useQueryStore(state => state.tabs);
  const setActiveTab = useQueryStore(state => state.setActiveTab);
  const removeTab = useQueryStore(state => state.removeTab);
  const highlightedTable = useSidebarHighlightStore(state => state.highlightedTableByConnection[connection.id] || null);
  const clearHighlightedTable = useSidebarHighlightStore(state => state.clearHighlightedTable);
  const openSchemaDiffDialog = useDiffStore(state => state.openSchemaDiffDialog);
  const openDataCompareDialog = useDataDiffStore(state => state.openDataCompareDialog);
  const {
    connect,
    disconnect,
    getTables,
    getMssqlDatabases,
    getMssqlDatabaseTables,
    createMssqlDatabase,
    dropMssqlDatabase,
    deleteConnection,
    dropTable,
    generateTableDdl,
    saveSchemaSnapshot,
  } = useDatabase();
  const { toast } = useToast();
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const [showDeleteConnectionDialog, setShowDeleteConnectionDialog] = useState(false);
  const [tableToDrop, setTableToDrop] = useState<string | null>(null);
  const isActive = activeConnectionId === connection.id;

  // Get database feature support
  const featureSupport = getDatabaseFeatureSupport(connection.databaseType as DatabaseType);

  // MSSQL-specific state for showing all databases
  const isMssql = connection.databaseType === "mssql";
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [databasesOpen, setDatabasesOpen] = useState(false);
  // Track tables per database for MSSQL explorer view
  const [tablesByDatabase, setTablesByDatabase] = useState<Record<string, TableInfo[]>>({});
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set());
  const [loadingDatabaseTables, setLoadingDatabaseTables] = useState<Set<string>>(new Set());
  // MSSQL database management state (only for generic connections without specific database)
  const [databaseToDelete, setDatabaseToDelete] = useState<string | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [showCreateDatabaseDialog, setShowCreateDatabaseDialog] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [isCreatingDatabase, setIsCreatingDatabase] = useState(false);
  const [isDeletingDatabase, setIsDeletingDatabase] = useState(false);

  // Refs for scrolling to highlighted items
  const tableRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setTableRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    tableRefs.current[key] = el;
  }, []);

  // Handle highlighted table from search
  useEffect(() => {
    if (highlightedTable) {
      // Force expand tables section
      setTablesOpen(true);

      // Scroll to highlighted item after a short delay
      const refKey = highlightedTable.schema
        ? `${highlightedTable.schema}.${highlightedTable.table}`
        : highlightedTable.table;

      setTimeout(() => {
        if (tableRefs.current[refKey]) {
          tableRefs.current[refKey]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 150);

      // Clear highlight after animation
      setTimeout(() => {
        clearHighlightedTable(connection.id);
      }, 2000);
    }
  }, [highlightedTable, connection.id, clearHighlightedTable]);

  useEffect(() => {
    if (isActive && connection.connected && tablesOpen && !tablesByConnection[connection.id]?.length) {
      loadTables();
    }
  }, [isActive, connection.connected, tablesOpen]);

  // Handle F5 refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5" && isActive && connection.connected) {
        e.preventDefault();
        loadTables();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, connection.connected]);

  const loadTables = async () => {
    if (!connection.connected) {
      const connected = await connect(connection.id);
      if (!connected) {
        showErrorToast("Connection failed", `Failed to connect to "${connection.name}". Please check your connection settings.`);
        return;
      }
    }

    setIsLoadingTables(true);
    try {
      await getTables(connection.id);
    } catch (error) {
      console.error("Failed to load tables:", error);
      showErrorToast("Failed to load tables", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingTables(false);
    }
  };

  // Check if connection has a specific database configured
  const hasSpecificDatabase = isMssql && connection.database && connection.database.trim() !== "";

  // Load all databases for MSSQL (similar to SSMS Object Explorer)
  const loadDatabases = async () => {
    if (!isMssql) return;

    if (!connection.connected) {
      const connected = await connect(connection.id);
      if (!connected) {
        showErrorToast("Connection failed", `Failed to connect to "${connection.name}". Please check your connection settings.`);
        return;
      }
    }

    // If a specific database is configured, only show that one
    if (hasSpecificDatabase) {
      setDatabases([{
        name: connection.database,
        state: "ONLINE",
        recoveryModel: "",
        compatibilityLevel: 0,
        isCurrent: true,
      }]);
      return;
    }

    // Otherwise, fetch all accessible databases
    setIsLoadingDatabases(true);
    try {
      const dbs = await getMssqlDatabases(connection.id);
      setDatabases(dbs);
    } catch (error) {
      console.error("Failed to load databases:", error);
      showErrorToast("Failed to load databases", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const handleDatabasesClick = () => {
    setDatabasesOpen(!databasesOpen);
    if (!databasesOpen && connection.connected && databases.length === 0) {
      loadDatabases();
    }
  };

  // Load tables for a specific database (MSSQL)
  const loadTablesForDatabase = async (databaseName: string) => {
    if (!isMssql || loadingDatabaseTables.has(databaseName)) return;

    setLoadingDatabaseTables(prev => new Set(prev).add(databaseName));
    try {
      const tables = await getMssqlDatabaseTables(connection.id, databaseName);
      setTablesByDatabase(prev => ({ ...prev, [databaseName]: tables }));
    } catch (error) {
      console.error(`Failed to load tables for database '${databaseName}':`, error);
      showErrorToast("Failed to load tables", error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingDatabaseTables(prev => {
        const next = new Set(prev);
        next.delete(databaseName);
        return next;
      });
    }
  };

  // Toggle database expansion (MSSQL)
  const handleDatabaseToggle = (databaseName: string) => {
    const isExpanding = !expandedDatabases.has(databaseName);
    setExpandedDatabases(prev => {
      const next = new Set(prev);
      if (isExpanding) {
        next.add(databaseName);
      } else {
        next.delete(databaseName);
      }
      return next;
    });

    // Load tables if expanding and not already loaded
    if (isExpanding && !tablesByDatabase[databaseName]) {
      loadTablesForDatabase(databaseName);
    }
  };

  const handleConnectionClick = async () => {
    setActiveConnection(connection.id);
    if (!connection.connected) {
      const connected = await connect(connection.id);
      if (!connected) {
        showErrorToast("Connection failed", `Failed to connect to "${connection.name}". Please check your connection settings.`);
      }
    }
  };

  const handleTablesClick = () => {
    setTablesOpen(!tablesOpen);
    if (!tablesOpen && connection.connected && !tablesByConnection[connection.id]?.length) {
      loadTables();
    }
  };

  const handleTableClick = (tableIdentifier: string, displayName: string) => {
    const tabId = `table-${connection.id}-${tableIdentifier}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: displayName,
        tableName: tableIdentifier,
        type: "table",
        connectionId: connection.id,
      });
    }
  };

  const handleTableDelete = async (tableIdentifier: string) => {
    setTableToDrop(tableIdentifier);
  };

  const handleCopyDdl = async (tableIdentifier: string) => {
    try {
      const ddl = await generateTableDdl(connection.id, tableIdentifier);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "CREATE TABLE statement copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not generate DDL for this table.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const handlePasteAsNewTable = async () => {
    try {
      const ddl = await readFromClipboard();
      if (ddl && ddl.trim().toUpperCase().startsWith("CREATE TABLE")) {
        // Instead of executing immediately, open a new query tab so the user can
        // rename the table if it already exists or modify the DDL.
        const tabId = crypto.randomUUID();
        addTab({
          id: tabId,
          title: "New Table (Paste)",
          type: "query",
          connectionId: connection.id,
          content: ddl,
        });
        setActiveTab(tabId);

        toast({
          title: "DDL Pasted",
          description: "Opened in a new query tab. You can now rename the table and execute.",
        });
      } else {
        toast({
          title: "Invalid DDL",
          description: "Clipboard does not contain a valid CREATE TABLE statement.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Paste Failed",
        description: error instanceof Error ? error.message : "Unable to read clipboard or execute DDL.",
        variant: "destructive",
      });
    }
  };

  const handleViewProperties = (tableIdentifier: string, displayName: string) => {
    const tabId = `properties-${connection.id}-${tableIdentifier}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: `${displayName} Properties`,
        tableName: tableIdentifier,
        type: "properties",
        connectionId: connection.id,
      });
    }
  };

  const handleViewDiagram = (tableIdentifier: string, displayName: string) => {
    const tabId = `diagram-${connection.id}-${tableIdentifier}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: `${displayName} Diagram`,
        tableName: tableIdentifier,
        type: "diagram",
        connectionId: connection.id,
      });
    }
  };

  const handleRenameTable = (tableIdentifier: string) => {
    openRenameTableDialog(tableIdentifier, connection.id);
  };

  const handleCompareSchema = (_schemaName: string) => {
    // Open diff dialog without pre-selecting a table - user can select in the dialog
    openSchemaDiffDialog(connection.id);
  };

  const handleSaveTableSnapshot = async (tableIdentifier: string) => {
    try {
      const tableName = tableIdentifier.split(".").pop() || tableIdentifier;
      const snapshotName = `${tableName} - ${new Date().toLocaleString()}`;
      await saveSchemaSnapshot({
        connectionId: connection.id,
        tableName: tableIdentifier,
        snapshotName,
        description: `Snapshot of ${tableIdentifier}`,
      });
      showSuccessToast(`Snapshot saved: ${snapshotName}`);
    } catch (error) {
      showErrorToast(`Failed to save snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // MSSQL Database management handlers (only for generic connections)
  const handleCreateDatabase = async () => {
    if (!newDatabaseName.trim()) return;

    setIsCreatingDatabase(true);
    try {
      const success = await createMssqlDatabase(connection.id, newDatabaseName.trim());
      if (success) {
        showSuccessToast(`Database "${newDatabaseName}" created successfully`);
        setShowCreateDatabaseDialog(false);
        setNewDatabaseName("");
        // Refresh the database list
        await loadDatabases();
      }
    } catch (error) {
      showErrorToast(`Failed to create database: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCreatingDatabase(false);
    }
  };

  const handleDeleteDatabase = async () => {
    if (!databaseToDelete || deleteConfirmationInput !== databaseToDelete) return;

    setIsDeletingDatabase(true);
    try {
      const success = await dropMssqlDatabase(connection.id, databaseToDelete);
      if (success) {
        showSuccessToast(`Database "${databaseToDelete}" deleted successfully`);
        setDatabaseToDelete(null);
        setDeleteConfirmationInput("");
        // Remove from expanded set if it was expanded
        setExpandedDatabases(prev => {
          const next = new Set(prev);
          next.delete(databaseToDelete);
          return next;
        });
        // Clear tables for this database
        setTablesByDatabase(prev => {
          const next = { ...prev };
          delete next[databaseToDelete];
          return next;
        });
        // Refresh the database list
        await loadDatabases();
      }
    } catch (error) {
      showErrorToast(`Failed to delete database: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeletingDatabase(false);
    }
  };

  const handleViewSchemaDiagram = (schemaName: string) => {
    const tabId = `schema-diagram-${connection.id}-${schemaName}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: `${schemaName} Diagram`,
        type: "diagram",
        connectionId: connection.id,
        content: schemaName, // Schema name stored in content for schema diagrams
      });
    }
  };

  const isSqlite = connection.databaseType === "sqlite";

  const confirmTableDelete = async () => {
    if (!tableToDrop) return;
    try {
      const result = await dropTable(connection.id, tableToDrop);
      if (result) {
        // Remove associated tab if open
        const tabId = `table-${connection.id}-${tableToDrop}`;
        removeTab(tabId);
        // Refresh tables list
        await getTables(connection.id);

        toast({
          title: "Table dropped",
          description: `Table "${tableToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop table",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setTableToDrop(null);
    }
  };

  const handleEdit = () => {
    openConnectionModal(connection.id);
  };

  const handleRename = () => {
    openRenameConnectionDialog(connection.id, connection.name, false);
  };

  const handleDuplicate = () => {
    openRenameConnectionDialog(connection.id, connection.name, true);
  };

  const handleDelete = async () => {
    setShowDeleteConnectionDialog(true);
  };

  const confirmDeleteConnection = async () => {
    try {
      const result = await deleteConnection(connection.id);
      if (result) {
        showSuccessToast("Connection deleted", `Connection "${connection.name}" has been deleted successfully.`);
      }
    } catch (error) {
      showErrorToast("Failed to delete connection", error instanceof Error ? error.message : String(error));
    } finally {
      setShowDeleteConnectionDialog(false);
    }
  };

  const handleConnect = async () => {
    try {
      const success = await connect(connection.id);
      if (success) {
        showSuccessToast("Connected", `Connected to "${connection.name}" successfully.`);
      }
    } catch (error) {
      showErrorToast("Connection failed", error instanceof Error ? error.message : String(error));
    }
  };

  const handleDisconnect = async () => {
    try {
      const success = await disconnect(connection.id);
      if (success) {
        toast({
          title: "Disconnected",
          description: `Disconnected from "${connection.name}".`,
        });
      }
    } catch (error) {
      toast({
        title: "Disconnect failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const getIcon = () => {
    const baseClasses = "h-4 w-4";
    const brand = getDatabaseBrand(connection.databaseType);
    const color = getDatabaseColor(connection.databaseType);
    return <BrandIcon name={brand} className={cn(baseClasses, color)} />;
  };

  const connectionTables = tablesByConnection[connection.id] || [];

  // Group tables by schema
  const tablesBySchema = connectionTables.reduce((acc: Record<string, TableInfo[]>, table: TableInfo) => {
    const schemaName = table.schema || "default";
    if (!acc[schemaName]) {
      acc[schemaName] = [];
    }
    acc[schemaName].push(table);
    return acc;
  }, {});

  const schemaNames = Object.keys(tablesBySchema).sort();
  const isSingleSchema = schemaNames.length === 1;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="rounded-lg overflow-hidden">
            <TreeItem
              label={connection.name}
              icon={getIcon()}
              isActive={isActive}
              isConnected={connection.connected}
              onClick={handleConnectionClick}
            >
              {connection.connected && (
                <>
                  {/* Redis: Show Redis-specific content */}
                  {featureSupport.isRedis && (
                    <RedisConnectionContent connectionId={connection.id} />
                  )}

                  {/* MongoDB: Show MongoDB-specific content */}
                  {featureSupport.isMongoDB && (
                    <MongoConnectionContent connectionId={connection.id} />
                  )}

                  {/* Cassandra: Show Cassandra-specific content */}
                  {featureSupport.isCassandra && (
                    <CassandraConnectionContent connectionId={connection.id} />
                  )}

                  {/* MSSQL: Show "Databases" node with expandable databases containing tables */}
                  {!featureSupport.isRedis && !featureSupport.isMongoDB && !featureSupport.isCassandra && isMssql && (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          <TreeItem
                            label="Databases"
                            icon={<Database className="h-3.5 w-3.5 text-muted-foreground" />}
                            onClick={handleDatabasesClick}
                            defaultOpen={false}
                          >
                            {isLoadingDatabases ? (
                              <TreeRowsSkeleton rows={4} level={1} />
                            ) : databases.length > 0 ? (
                              databases.map((db) => {
                                const isExpanded = expandedDatabases.has(db.name);
                                const isLoadingTables = loadingDatabaseTables.has(db.name);
                                const dbTables = tablesByDatabase[db.name] || [];

                                // Group tables by schema for this database
                                const dbTablesBySchema = dbTables.reduce((acc: Record<string, TableInfo[]>, table: TableInfo) => {
                                  const schemaName = table.schema || "dbo";
                                  if (!acc[schemaName]) {
                                    acc[schemaName] = [];
                                  }
                                  acc[schemaName].push(table);
                                  return acc;
                                }, {});
                                const dbSchemaNames = Object.keys(dbTablesBySchema).sort();

                                // Check if this is a system database that cannot be deleted
                                const isSystemDb = ["master", "tempdb", "model", "msdb"].some(
                                  sysDb => sysDb.toLowerCase() === db.name.toLowerCase()
                                );

                                return (
                                  <ContextMenu key={db.name}>
                                    <ContextMenuTrigger asChild>
                                      <div className="ml-2">
                                        <div
                                          className={cn(
                                            "group flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-all duration-200 cursor-pointer",
                                            "hover:bg-sidebar-accent/50",
                                            db.isCurrent && "bg-primary/10 font-medium"
                                          )}
                                          onClick={() => handleDatabaseToggle(db.name)}
                                        >
                                          <CaretRight
                                            className={cn(
                                              "h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-muted-foreground",
                                              isExpanded && "rotate-90"
                                            )}
                                          />
                                          <Database className={cn("h-3.5 w-3.5", db.isCurrent ? "text-primary" : "text-muted-foreground")} />
                                          <span className="truncate flex-1 text-left">{db.name}</span>
                                          {db.isCurrent && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">current</span>
                                          )}
                                          {db.state !== "ONLINE" && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                                              {db.state.toLowerCase()}
                                            </span>
                                          )}
                                        </div>

                                        {/* Expanded database content - show tables */}
                                    {isExpanded && (
                                      <div className="ml-4 animate-slide-down">
                                        {isLoadingTables ? (
                                          <TreeRowsSkeleton rows={4} level={2} />
                                        ) : dbSchemaNames.length > 0 ? (
                                          dbSchemaNames.map((schemaName) => (
                                            <TreeItem
                                              key={schemaName}
                                              label={schemaName}
                                              icon={<TreeStructure className="h-3.5 w-3.5 text-muted-foreground/50" />}
                                              level={1}
                                              defaultOpen={dbSchemaNames.length === 1}
                                            >
                                              {dbTablesBySchema[schemaName].map((table) => (
                                                <ContextMenu key={table.name}>
                                                  <ContextMenuTrigger asChild>
                                                    <div>
                                                      <TreeItem
                                                        label={table.name}
                                                        icon={<Table className="h-3.5 w-3.5 text-muted-foreground" />}
                                                        level={2}
                                                        onClick={() => handleTableClick(`${db.name}.${schemaName}.${table.name}`, table.name)}
                                                      />
                                                    </div>
                                                  </ContextMenuTrigger>
                                                  <ContextMenuContent className="w-56">
                                                    <ContextMenuItem onSelect={() => handleTableClick(`${db.name}.${schemaName}.${table.name}`, table.name)} className="gap-2">
                                                      <Table className="h-4 w-4" />
                                                      View Data
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onSelect={() => handleViewProperties(`${db.name}.${schemaName}.${table.name}`, table.name)} className="gap-2">
                                                      <Info className="h-4 w-4" />
                                                      View Properties
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onSelect={() => handleViewDiagram(`${db.name}.${schemaName}.${table.name}`, table.name)} className="gap-2">
                                                      <Graph className="h-4 w-4" />
                                                      View Diagram
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem onSelect={() => handleCopyDdl(`${db.name}.${schemaName}.${table.name}`)} className="gap-2">
                                                      <Copy className="h-4 w-4" />
                                                      Copy
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onSelect={() => handlePasteAsNewTable()} className="gap-2">
                                                      <ClipboardText className="h-4 w-4" />
                                                      Paste
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem onSelect={() => handleRenameTable(`${db.name}.${schemaName}.${table.name}`)} className="gap-2">
                                                      <PencilSimple className="h-4 w-4" />
                                                      Rename Table
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onSelect={() => handleSaveTableSnapshot(`${db.name}.${schemaName}.${table.name}`)} className="gap-2">
                                                      <Camera className="h-4 w-4" />
                                                      Save Snapshot
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onSelect={() => openDataCompareDialog(connection.id, `${db.name}.${schemaName}.${table.name}`)} className="gap-2">
                                                      <Rows className="h-4 w-4" />
                                                      Compare Data...
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem
                                                      onSelect={() => handleTableDelete(`${db.name}.${schemaName}.${table.name}`)}
                                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                                    >
                                                      <Trash className="h-4 w-4" />
                                                      Drop Table
                                                    </ContextMenuItem>
                                                  </ContextMenuContent>
                                                </ContextMenu>
                                              ))}
                                            </TreeItem>
                                          ))
                                        ) : (
                                          <div className="ml-4 py-2 text-xs text-muted-foreground">No tables found</div>
                                        )}
                                      </div>
                                    )}
                                      </div>
                                    </ContextMenuTrigger>
                                    {/* Only show delete option for non-system databases when no specific database is configured */}
                                    {!hasSpecificDatabase && !isSystemDb && (
                                      <ContextMenuContent className="w-48">
                                        <ContextMenuItem
                                          onSelect={() => setDatabaseToDelete(db.name)}
                                          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                          <Trash className="h-4 w-4" />
                                          Delete Database
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    )}
                                  </ContextMenu>
                                );
                              })
                            ) : databasesOpen ? (
                              <div className="ml-6 py-2 text-xs text-muted-foreground">No databases found</div>
                            ) : null}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        {!hasSpecificDatabase && (
                          <>
                            <ContextMenuItem onSelect={() => setShowCreateDatabaseDialog(true)} className="gap-2">
                              <Plus className="h-4 w-4" />
                              New Database
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                          </>
                        )}
                        <ContextMenuItem onSelect={loadDatabases} className="gap-2">
                          <ArrowClockwise className={cn("h-4 w-4", isLoadingDatabases && "animate-spin")} />
                          Refresh
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )}

                  {/* For non-MSSQL databases (excluding Redis, MongoDB, and Cassandra), show Schemas tree */}
                  {!featureSupport.isRedis && !featureSupport.isMongoDB && !featureSupport.isCassandra && !isMssql && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div>
                      <TreeItem
                        label="Schemas"
                        icon={<TreeStructure className="h-3.5 w-3.5 text-muted-foreground" />}
                        onClick={handleTablesClick}
                        defaultOpen={true}
                      >
                        {isLoadingTables ? (
                          <TreeRowsSkeleton rows={5} level={1} />
                        ) : schemaNames.length > 0 ? (
                          schemaNames.map((schemaName) => {
                            // Check if any table in this schema is highlighted
                            const hasHighlightedTable = highlightedTable?.schema === schemaName;

                            return (
                            <ContextMenu key={schemaName}>
                              <ContextMenuTrigger asChild>
                                <div>
                                  <TreeItem
                                    label={schemaName}
                                    icon={<TreeStructure className="h-3.5 w-3.5 text-muted-foreground/50" />}
                                    level={1}
                                    defaultOpen={isSingleSchema}
                                    forceOpen={hasHighlightedTable}
                                  >
                                    {tablesBySchema[schemaName].map((table) => {
                                const tableId = buildTableIdentifier(table);

                                // Check if this specific table is highlighted
                                const isTableHighlighted = highlightedTable?.schema === schemaName &&
                                  highlightedTable?.table === tableId;

                                return (
                                  <ContextMenu key={table.name}>
                                    <ContextMenuTrigger asChild>
                                      <div ref={setTableRef(tableId)}>
                                        <TreeItem
                                          label={table.name}
                                          icon={<Table className="h-3.5 w-3.5 text-muted-foreground" />}
                                          level={2}
                                          onClick={() => handleTableClick(tableId, table.name)}
                                          isHighlighted={isTableHighlighted}
                                        />
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="w-56">
                                      <ContextMenuItem onSelect={() => handleTableClick(tableId, table.name)} className="gap-2">
                                        <Table className="h-4 w-4" />
                                        View Data
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => handleViewProperties(tableId, table.name)} className="gap-2">
                                        <Info className="h-4 w-4" />
                                        View Properties
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => handleViewDiagram(tableId, table.name)} className="gap-2">
                                        <Graph className="h-4 w-4" />
                                        View Diagram
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => handleCopyDdl(tableId)} className="gap-2">
                                        <Copy className="h-4 w-4" />
                                        Copy
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => handlePasteAsNewTable()} className="gap-2">
                                        <ClipboardText className="h-4 w-4" />
                                        Paste
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => handleRenameTable(tableId)} className="gap-2">
                                        <PencilSimple className="h-4 w-4" />
                                        Rename Table
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => handleSaveTableSnapshot(tableId)} className="gap-2">
                                        <Camera className="h-4 w-4" />
                                        Save Snapshot
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => openDataCompareDialog(connection.id, tableId)} className="gap-2">
                                        <Rows className="h-4 w-4" />
                                        Compare Data...
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        onSelect={() => handleTableDelete(tableId)}
                                        className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                      >
                                        <Trash className="h-4 w-4" />
                                        Drop Table
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                              })}
                                  </TreeItem>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56">
                                <ContextMenuItem onSelect={() => openCreateTableDialog(connection.id, schemaName)} className="gap-2">
                                  <Plus className="h-4 w-4" />
                                  Create Table
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => handleViewSchemaDiagram(schemaName)} className="gap-2">
                                  <Graph className="h-4 w-4" />
                                  View Diagram
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => handleCompareSchema(schemaName)} className="gap-2">
                                  <GitDiff className="h-4 w-4" />
                                  Compare Schema...
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                          })
                        ) : tablesOpen ? (
                          <div className="ml-6 py-2 text-xs text-muted-foreground">No schemas found</div>
                        ) : null}
                      </TreeItem>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem onSelect={loadTables} className="gap-2">
                      <ArrowClockwise className={cn("h-4 w-4", isLoadingTables && "animate-spin")} />
                      Refresh
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                  )}

                  {/* Security section - Users and Roles (not for SQLite) */}
                  {!isSqlite && (
                    <SecuritySection connection={connection} />
                  )}

                  {/* Views section */}
                  <ViewsSection connection={connection} />

                  {/* Indexes section */}
                  <IndexesSection connection={connection} />

                  {/* Stored Procedures section (conditionally rendered based on database support) */}
                  {featureSupport.procedures && (
                    <ProceduresSection connection={connection} />
                  )}

                  {/* Functions section (conditionally rendered based on database support) */}
                  {featureSupport.functions && (
                    <FunctionsSection connection={connection} />
                  )}

                  {/* Triggers section (conditionally rendered based on database support) */}
                  {featureSupport.triggers && (
                    <TriggersSection connection={connection} />
                  )}

                  {/* Sequences section (conditionally rendered based on database support) */}
                  {featureSupport.sequences && (
                    <SequencesSection connection={connection} />
                  )}
                </>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {connection.connected ? (
            <>
              <ContextMenuItem onSelect={handleDisconnect} className="gap-2">
                <PlugsConnected className="h-4 w-4" />
                Disconnect
              </ContextMenuItem>
              <ContextMenuItem onSelect={loadTables} className="gap-2">
                <ArrowClockwise className={cn("h-4 w-4", isLoadingTables && "animate-spin")} />
                Refresh
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem onSelect={handleConnect} className="gap-2">
              <Plugs className="h-4 w-4" />
              Connect
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleEdit} className="gap-2">
            <PencilSimple className="h-4 w-4" />
            Edit Connection
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleRename} className="gap-2">
            <PencilSimple className="h-4 w-4" />
            Rename Connection
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleDuplicate} className="gap-2">
            <Copy className="h-4 w-4" />
            Duplicate Connection
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setShowProperties(true)} className="gap-2">
            <Info className="h-4 w-4" />
            Properties
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => openAssignGroupDialog(connection.id)} className="gap-2">
            <TreeStructure className="h-4 w-4" />
            Assign to Group...
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={handleDelete}
            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash className="h-4 w-4" />
            Delete Connection
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ConnectionPropertiesDialog
        connectionId={connection.id}
        open={showProperties}
        onOpenChange={setShowProperties}
      />

      <AlertDialog open={showDeleteConnectionDialog} onOpenChange={setShowDeleteConnectionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the connection "{connection.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteConnection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!tableToDrop} onOpenChange={(open) => !open && setTableToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the table "{tableToDrop}"? All data will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmTableDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MSSQL Create Database Dialog */}
      <Dialog open={showCreateDatabaseDialog} onOpenChange={(open) => {
        setShowCreateDatabaseDialog(open);
        if (!open) setNewDatabaseName("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Database</DialogTitle>
            <DialogDescription>
              Enter a name for the new database. The database will be created on the SQL Server instance.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="database-name">Database Name</Label>
            <Input
              id="database-name"
              value={newDatabaseName}
              onChange={(e) => setNewDatabaseName(e.target.value)}
              placeholder="Enter database name"
              className="mt-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDatabaseName.trim()) {
                  handleCreateDatabase();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDatabaseDialog(false);
                setNewDatabaseName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDatabase}
              disabled={!newDatabaseName.trim() || isCreatingDatabase}
            >
              {isCreatingDatabase ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Database"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MSSQL Delete Database Confirmation Dialog */}
      <AlertDialog open={!!databaseToDelete} onOpenChange={(open) => {
        if (!open) {
          setDatabaseToDelete(null);
          setDeleteConfirmationInput("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Database</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                You are about to permanently delete the database <strong>"{databaseToDelete}"</strong>.
              </p>
              <p className="text-destructive font-medium">
                This action will close all connections to the database and permanently delete all data. This cannot be undone.
              </p>
              <div className="pt-2">
                <Label htmlFor="confirm-database-name" className="text-foreground">
                  Type <strong>{databaseToDelete}</strong> to confirm:
                </Label>
                <Input
                  id="confirm-database-name"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  placeholder="Enter database name to confirm"
                  className="mt-2"
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDatabaseToDelete(null);
              setDeleteConfirmationInput("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDatabase}
              disabled={deleteConfirmationInput !== databaseToDelete || isDeletingDatabase}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingDatabase ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Database"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
