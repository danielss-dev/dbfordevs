import { useState, useEffect } from "react";
import {
  Database,
  FolderTree,
  Table,
  Plus,
  Settings,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  Info,
  Plug,
  Unplug,
  RefreshCw,
  Copy,
  ClipboardPaste,
  Network,
  Shield,
  Users,
  UserCog,
  User,
  KeyRound,
  Eye,
  ListTree,
  Code2,
  FunctionSquare,
  Zap,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
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
} from "@/components/ui";
import { ConnectionPropertiesDialog } from "@/components/connections";
import { useConnectionsStore, useUIStore, useQueryStore, useUsersStore, useViewsStore, useIndexesStore, useProceduresStore, useFunctionsStore, useTriggersStore, useSequencesStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo, TableInfo, DatabaseInfo, StandaloneIndexInfo, DatabaseType } from "@/types";
import { getDatabaseFeatureSupport } from "@/lib/database-features";
import { BrandIcon } from "@/components/ui";
import { copyToClipboard, readFromClipboard } from "@/lib/utils";
import { getDatabaseBrand, getDatabaseColor } from "@/lib/constants";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast-helpers";

interface TreeItemProps {
  label: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  level?: number;
  onClick?: () => void;
  isActive?: boolean;
  isConnected?: boolean;
  rightElement?: React.ReactNode;
  defaultOpen?: boolean;
}

function TreeItem({
  label,
  icon,
  children,
  level = 0,
  onClick,
  isActive,
  isConnected,
  rightElement,
  defaultOpen = false
}: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = Boolean(children);

  return (
    <div className="group/tree relative">
      {/* Indentation guide lines for nested items */}
      {level > 0 && (
        <div
          className="tree-guide"
          style={{ left: `${(level - 1) * 16 + 18}px` }}
        />
      )}
      {/* Active indicator bar */}
      {isActive && level === 0 && (
        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-full z-10" />
      )}
      <div
        className={cn(
          "group flex w-full items-center gap-2 rounded-md py-1.5 text-sm transition-all duration-200",
          "hover:bg-sidebar-accent/60",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px`, paddingRight: '8px' }}
      >
        <button
          className="flex flex-1 items-center gap-2 overflow-hidden"
          onClick={() => {
            if (hasChildren) setIsOpen(!isOpen);
            onClick?.();
          }}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                isOpen && "rotate-90",
                isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"
              )}
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className={cn(
            "shrink-0 flex items-center justify-center w-5 h-5 rounded bg-sidebar-accent/30",
            isActive ? "text-sidebar-accent-foreground bg-sidebar-accent/50" : ""
          )}>{icon}</span>
          <span className="truncate flex-1 text-left">{label}</span>
          {isConnected !== undefined && (
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isConnected ? "bg-[hsl(var(--success))]" : "bg-muted-foreground/30"
            )} />
          )}
        </button>
        {rightElement && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {rightElement}
          </div>
        )}
      </div>
      {isOpen && children && (
        <div className="animate-slide-down">{children}</div>
      )}
    </div>
  );
}

function ConnectionItem({ connection }: { connection: ConnectionInfo }) {
  const { activeConnectionId, setActiveConnection } = useConnectionsStore();
  const {
    openConnectionModal,
    openRenameTableDialog,
    openRenameConnectionDialog,
    openCreateTableDialog,
    openCreateUserDialog,
    openChangePasswordDialog,
    openCreateRoleDialog,
    openManagePermissionsDialog,
  } = useUIStore();
  const { tablesByConnection, addTab, tabs, setActiveTab, removeTab } = useQueryStore();
  const {
    usersByConnection,
    rolesByConnection,
    setUsers,
    setRoles,
  } = useUsersStore();
  const { viewsByConnection, setViews } = useViewsStore();
  const { indexesByConnection, setIndexes } = useIndexesStore();
  const { proceduresByConnection, setProcedures } = useProceduresStore();
  const { functionsByConnection, setFunctions } = useFunctionsStore();
  const { triggersByConnection, setTriggers } = useTriggersStore();
  const { sequencesByConnection, setSequences } = useSequencesStore();
  const {
    connect,
    disconnect,
    getTables,
    getMssqlDatabases,
    getMssqlDatabaseTables,
    deleteConnection,
    dropTable,
    generateTableDdl,
    supportsUserManagement,
    getUsers,
    getRoles,
    deleteUser,
    deleteRole,
    getViews,
    getViewDdl,
    dropView,
    getAllIndexes,
    getIndexDdl,
    dropIndex,
    getProcedures,
    getProcedureDdl,
    dropProcedure,
    getFunctions,
    getFunctionDdl,
    dropFunction,
    getTriggers,
    getTriggerDdl,
    dropTrigger,
    getSequences,
    getSequenceDdl,
    dropSequence,
  } = useDatabase();
  const { toast } = useToast();
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const [showDeleteConnectionDialog, setShowDeleteConnectionDialog] = useState(false);
  const [tableToDrop, setTableToDrop] = useState<string | null>(null);
  const isActive = activeConnectionId === connection.id;

  // Security section state
  const [securityOpen, setSecurityOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ name: string; host?: string } | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [supportsUsers, setSupportsUsers] = useState<boolean | null>(null);

  // Views section state
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [viewToDrop, setViewToDrop] = useState<string | null>(null);

  // Indexes section state
  const [isLoadingIndexes, setIsLoadingIndexes] = useState(false);
  const [indexToDrop, setIndexToDrop] = useState<{ name: string; tableName?: string } | null>(null);

  // Procedures section state
  const [isLoadingProcedures, setIsLoadingProcedures] = useState(false);
  const [procedureToDrop, setProcedureToDrop] = useState<string | null>(null);

  // Functions section state
  const [isLoadingFunctions, setIsLoadingFunctions] = useState(false);
  const [functionToDrop, setFunctionToDrop] = useState<string | null>(null);

  // Triggers section state
  const [isLoadingTriggers, setIsLoadingTriggers] = useState(false);
  const [triggerToDrop, setTriggerToDrop] = useState<string | null>(null);

  // Sequences section state
  const [isLoadingSequences, setIsLoadingSequences] = useState(false);
  const [sequenceToDrop, setSequenceToDrop] = useState<string | null>(null);

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

  // Security section handlers
  const handleSecurityClick = async () => {
    const isOpening = !securityOpen;
    setSecurityOpen(isOpening);

    if (isOpening && connection.connected) {
      // Check if user management is supported
      if (supportsUsers === null) {
        const supported = await supportsUserManagement(connection.id);
        setSupportsUsers(supported);
        if (!supported) return;
      } else if (!supportsUsers) {
        return;
      }

      // Load users and roles if not already loaded
      if (!usersByConnection[connection.id]) {
        loadSecurityUsers();
      }
      if (!rolesByConnection[connection.id]) {
        loadSecurityRoles();
      }
    }
  };

  const loadSecurityUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await getUsers(connection.id);
      setUsers(connection.id, users);
    } catch (error) {
      console.error("Failed to load users:", error);
      showErrorToast("Failed to load users", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadSecurityRoles = async () => {
    setIsLoadingRoles(true);
    try {
      const roles = await getRoles(connection.id);
      setRoles(connection.id, roles);
    } catch (error) {
      console.error("Failed to load roles:", error);
      showErrorToast("Failed to load roles", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const success = await deleteUser(connection.id, userToDelete.name, userToDelete.host);
      if (success) {
        // Refresh users list
        await loadSecurityUsers();
        toast({
          title: "User deleted",
          description: `User "${userToDelete.name}" has been deleted successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to delete user",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
    }
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      const success = await deleteRole(connection.id, roleToDelete);
      if (success) {
        // Refresh roles list
        await loadSecurityRoles();
        toast({
          title: "Role deleted",
          description: `Role "${roleToDelete}" has been deleted successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to delete role",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setRoleToDelete(null);
    }
  };

  // Get users and roles for this connection
  const connectionUsers = usersByConnection[connection.id] || [];
  const connectionRoles = rolesByConnection[connection.id] || [];
  const isMySQL = connection.databaseType === "mysql";
  const isSqlite = connection.databaseType === "sqlite";

  // Views section handlers
  const handleViewsClick = async () => {
    // Load views on first expansion if not already loaded
    if (connection.connected && !viewsByConnection[connection.id] && !isLoadingViews) {
      setIsLoadingViews(true);
      try {
        const views = await getViews(connection.id);
        setViews(connection.id, views);
      } catch (error) {
        console.error("Failed to load views:", error);
        showErrorToast("Failed to load views", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingViews(false);
      }
    }
  };

  const loadConnectionViews = async () => {
    setIsLoadingViews(true);
    try {
      const views = await getViews(connection.id);
      setViews(connection.id, views);
    } catch (error) {
      console.error("Failed to load views:", error);
      showErrorToast("Failed to load views", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingViews(false);
    }
  };

  const handleViewClick = (viewName: string) => {
    // Open view data in a table-like tab
    const tabId = `view-${connection.id}-${viewName}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: viewName,
        tableName: viewName,
        type: "table", // Views can be queried like tables
        connectionId: connection.id,
      });
    }
  };

  const handleCopyViewDdl = async (viewName: string) => {
    try {
      const ddl = await getViewDdl(connection.id, viewName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "View definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this view.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmViewDrop = async () => {
    if (!viewToDrop) return;
    try {
      const result = await dropView(connection.id, viewToDrop);
      if (result) {
        // Remove associated tab if open
        const tabId = `view-${connection.id}-${viewToDrop}`;
        removeTab(tabId);
        // Refresh views list
        await loadConnectionViews();

        toast({
          title: "View dropped",
          description: `View "${viewToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop view",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setViewToDrop(null);
    }
  };

  // Indexes section handlers
  const handleIndexesClick = async () => {
    // Load indexes on first expansion if not already loaded
    if (connection.connected && !indexesByConnection[connection.id] && !isLoadingIndexes) {
      setIsLoadingIndexes(true);
      try {
        const indexes = await getAllIndexes(connection.id);
        setIndexes(connection.id, indexes);
      } catch (error) {
        console.error("Failed to load indexes:", error);
        showErrorToast("Failed to load indexes", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingIndexes(false);
      }
    }
  };

  const loadConnectionIndexes = async () => {
    setIsLoadingIndexes(true);
    try {
      const indexes = await getAllIndexes(connection.id);
      setIndexes(connection.id, indexes);
    } catch (error) {
      console.error("Failed to load indexes:", error);
      showErrorToast("Failed to load indexes", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingIndexes(false);
    }
  };

  const handleCopyIndexDdl = async (indexName: string, tableName?: string) => {
    try {
      const ddl = await getIndexDdl(connection.id, indexName, tableName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Index definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this index.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmIndexDrop = async () => {
    if (!indexToDrop) return;
    try {
      const result = await dropIndex(connection.id, indexToDrop.name, indexToDrop.tableName);
      if (result) {
        // Refresh indexes list
        await loadConnectionIndexes();

        toast({
          title: "Index dropped",
          description: `Index "${indexToDrop.name}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop index",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIndexToDrop(null);
    }
  };

  // Procedures section handlers
  const handleProceduresClick = async () => {
    if (connection.connected && !proceduresByConnection[connection.id] && !isLoadingProcedures) {
      setIsLoadingProcedures(true);
      try {
        const procedures = await getProcedures(connection.id);
        setProcedures(connection.id, procedures);
      } catch (error) {
        console.error("Failed to load procedures:", error);
        showErrorToast("Failed to load procedures", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingProcedures(false);
      }
    }
  };

  const loadConnectionProcedures = async () => {
    setIsLoadingProcedures(true);
    try {
      const procedures = await getProcedures(connection.id);
      setProcedures(connection.id, procedures);
    } catch (error) {
      console.error("Failed to load procedures:", error);
      showErrorToast("Failed to load procedures", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingProcedures(false);
    }
  };

  const handleCopyProcedureDdl = async (procedureName: string) => {
    try {
      const ddl = await getProcedureDdl(connection.id, procedureName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Procedure definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this procedure.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmProcedureDrop = async () => {
    if (!procedureToDrop) return;
    try {
      const result = await dropProcedure(connection.id, procedureToDrop);
      if (result) {
        await loadConnectionProcedures();
        toast({
          title: "Procedure dropped",
          description: `Procedure "${procedureToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop procedure",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setProcedureToDrop(null);
    }
  };

  // Functions section handlers
  const handleFunctionsClick = async () => {
    if (connection.connected && !functionsByConnection[connection.id] && !isLoadingFunctions) {
      setIsLoadingFunctions(true);
      try {
        const functions = await getFunctions(connection.id);
        setFunctions(connection.id, functions);
      } catch (error) {
        console.error("Failed to load functions:", error);
        showErrorToast("Failed to load functions", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingFunctions(false);
      }
    }
  };

  const loadConnectionFunctions = async () => {
    setIsLoadingFunctions(true);
    try {
      const functions = await getFunctions(connection.id);
      setFunctions(connection.id, functions);
    } catch (error) {
      console.error("Failed to load functions:", error);
      showErrorToast("Failed to load functions", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingFunctions(false);
    }
  };

  const handleCopyFunctionDdl = async (functionName: string) => {
    try {
      const ddl = await getFunctionDdl(connection.id, functionName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Function definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this function.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmFunctionDrop = async () => {
    if (!functionToDrop) return;
    try {
      const result = await dropFunction(connection.id, functionToDrop);
      if (result) {
        await loadConnectionFunctions();
        toast({
          title: "Function dropped",
          description: `Function "${functionToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop function",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setFunctionToDrop(null);
    }
  };

  // Triggers section handlers
  const handleTriggersClick = async () => {
    if (connection.connected && !triggersByConnection[connection.id] && !isLoadingTriggers) {
      setIsLoadingTriggers(true);
      try {
        const triggers = await getTriggers(connection.id);
        setTriggers(connection.id, triggers);
      } catch (error) {
        console.error("Failed to load triggers:", error);
        showErrorToast("Failed to load triggers", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingTriggers(false);
      }
    }
  };

  const loadConnectionTriggers = async () => {
    setIsLoadingTriggers(true);
    try {
      const triggers = await getTriggers(connection.id);
      setTriggers(connection.id, triggers);
    } catch (error) {
      console.error("Failed to load triggers:", error);
      showErrorToast("Failed to load triggers", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingTriggers(false);
    }
  };

  const handleCopyTriggerDdl = async (triggerName: string) => {
    try {
      const ddl = await getTriggerDdl(connection.id, triggerName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Trigger definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this trigger.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmTriggerDrop = async () => {
    if (!triggerToDrop) return;
    try {
      const result = await dropTrigger(connection.id, triggerToDrop);
      if (result) {
        await loadConnectionTriggers();
        toast({
          title: "Trigger dropped",
          description: `Trigger "${triggerToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop trigger",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setTriggerToDrop(null);
    }
  };

  // Sequences section handlers
  const handleSequencesClick = async () => {
    if (connection.connected && !sequencesByConnection[connection.id] && !isLoadingSequences) {
      setIsLoadingSequences(true);
      try {
        const sequences = await getSequences(connection.id);
        setSequences(connection.id, sequences);
      } catch (error) {
        console.error("Failed to load sequences:", error);
        showErrorToast("Failed to load sequences", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingSequences(false);
      }
    }
  };

  const loadConnectionSequences = async () => {
    setIsLoadingSequences(true);
    try {
      const sequences = await getSequences(connection.id);
      setSequences(connection.id, sequences);
    } catch (error) {
      console.error("Failed to load sequences:", error);
      showErrorToast("Failed to load sequences", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingSequences(false);
    }
  };

  const handleCopySequenceDdl = async (sequenceName: string) => {
    try {
      const ddl = await getSequenceDdl(connection.id, sequenceName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Sequence definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this sequence.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmSequenceDrop = async () => {
    if (!sequenceToDrop) return;
    try {
      const result = await dropSequence(connection.id, sequenceToDrop);
      if (result) {
        await loadConnectionSequences();
        toast({
          title: "Sequence dropped",
          description: `Sequence "${sequenceToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop sequence",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSequenceToDrop(null);
    }
  };

  // Get views and indexes for this connection
  const connectionViews = viewsByConnection[connection.id] || [];
  const connectionIndexes = indexesByConnection[connection.id] || [];

  // Group indexes by table
  const indexesByTable = connectionIndexes.reduce((acc: Record<string, StandaloneIndexInfo[]>, idx) => {
    const tableName = idx.tableName || "Unknown";
    if (!acc[tableName]) {
      acc[tableName] = [];
    }
    acc[tableName].push(idx);
    return acc;
  }, {});
  const indexTableNames = Object.keys(indexesByTable).sort();

  // Get procedures, functions, triggers, and sequences for this connection
  const connectionProcedures = proceduresByConnection[connection.id] || [];
  const connectionFunctions = functionsByConnection[connection.id] || [];
  const connectionTriggers = triggersByConnection[connection.id] || [];
  const connectionSequences = sequencesByConnection[connection.id] || [];

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
                  {/* MSSQL: Show "Databases" node with expandable databases containing tables */}
                  {isMssql && (
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
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading...</span>
                              </div>
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

                                return (
                                  <div key={db.name} className="ml-2">
                                    <div
                                      className={cn(
                                        "group flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-all duration-200 cursor-pointer",
                                        "hover:bg-sidebar-accent/50",
                                        db.isCurrent && "bg-primary/10 font-medium"
                                      )}
                                      onClick={() => handleDatabaseToggle(db.name)}
                                    >
                                      <ChevronRight
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
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                                          {db.state.toLowerCase()}
                                        </span>
                                      )}
                                    </div>

                                    {/* Expanded database content - show tables */}
                                    {isExpanded && (
                                      <div className="ml-4 animate-slide-down">
                                        {isLoadingTables ? (
                                          <div className="ml-4 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Loading tables...</span>
                                          </div>
                                        ) : dbSchemaNames.length > 0 ? (
                                          dbSchemaNames.map((schemaName) => (
                                            <TreeItem
                                              key={schemaName}
                                              label={schemaName}
                                              icon={<FolderTree className="h-3.5 w-3.5 text-muted-foreground/50" />}
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
                                                      <Network className="h-4 w-4" />
                                                      View Diagram
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem onSelect={() => handleCopyDdl(`${db.name}.${schemaName}.${table.name}`)} className="gap-2">
                                                      <Copy className="h-4 w-4" />
                                                      Copy
                                                    </ContextMenuItem>
                                                    <ContextMenuItem onSelect={() => handlePasteAsNewTable()} className="gap-2">
                                                      <ClipboardPaste className="h-4 w-4" />
                                                      Paste
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem onSelect={() => handleRenameTable(`${db.name}.${schemaName}.${table.name}`)} className="gap-2">
                                                      <Pencil className="h-4 w-4" />
                                                      Rename Table
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem
                                                      onSelect={() => handleTableDelete(`${db.name}.${schemaName}.${table.name}`)}
                                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                                    >
                                                      <Trash2 className="h-4 w-4" />
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
                                );
                              })
                            ) : databasesOpen ? (
                              <div className="ml-6 py-2 text-xs text-muted-foreground">No databases found</div>
                            ) : null}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onSelect={loadDatabases} className="gap-2">
                          <RefreshCw className={cn("h-4 w-4", isLoadingDatabases && "animate-spin")} />
                          Refresh
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )}

                  {/* For non-MSSQL databases, show Schemas tree */}
                  {!isMssql && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div>
                      <TreeItem
                        label="Schemas"
                        icon={<FolderTree className="h-3.5 w-3.5 text-muted-foreground" />}
                        onClick={handleTablesClick}
                        defaultOpen={true}
                      >
                        {isLoadingTables ? (
                          <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Loading...</span>
                          </div>
                        ) : schemaNames.length > 0 ? (
                          schemaNames.map((schemaName) => (
                            <ContextMenu key={schemaName}>
                              <ContextMenuTrigger asChild>
                                <div>
                                  <TreeItem
                                    label={schemaName}
                                    icon={<FolderTree className="h-3.5 w-3.5 text-muted-foreground/50" />}
                                    level={1}
                                    defaultOpen={isSingleSchema}
                                  >
                                    {tablesBySchema[schemaName].map((table) => {
                                // For display, strip the schema prefix if it's there
                                const displayLabel = table.name.startsWith(`${schemaName}.`) 
                                  ? table.name.slice(schemaName.length + 1)
                                  : table.name;
                                
                                return (
                                  <ContextMenu key={table.name}>
                                    <ContextMenuTrigger asChild>
                                      <div>
                                        <TreeItem
                                          label={displayLabel}
                                          icon={<Table className="h-3.5 w-3.5 text-muted-foreground" />}
                                          level={2}
                                          onClick={() => handleTableClick(table.name, displayLabel)}
                                        />
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="w-56">
                                      <ContextMenuItem onSelect={() => handleTableClick(table.name, displayLabel)} className="gap-2">
                                        <Table className="h-4 w-4" />
                                        View Data
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => handleViewProperties(table.name, displayLabel)} className="gap-2">
                                        <Info className="h-4 w-4" />
                                        View Properties
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => handleViewDiagram(table.name, displayLabel)} className="gap-2">
                                        <Network className="h-4 w-4" />
                                        View Diagram
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => handleCopyDdl(table.name)} className="gap-2">
                                        <Copy className="h-4 w-4" />
                                        Copy
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => handlePasteAsNewTable()} className="gap-2">
                                        <ClipboardPaste className="h-4 w-4" />
                                        Paste
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem onSelect={() => handleRenameTable(table.name)} className="gap-2">
                                        <Pencil className="h-4 w-4" />
                                        Rename Table
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        onSelect={() => handleTableDelete(table.name)}
                                        className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Drop Table
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                              })}
                                  </TreeItem>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48">
                                <ContextMenuItem onSelect={() => openCreateTableDialog(connection.id, schemaName)} className="gap-2">
                                  <Plus className="h-4 w-4" />
                                  Create Table
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => handleViewSchemaDiagram(schemaName)} className="gap-2">
                                  <Network className="h-4 w-4" />
                                  View Diagram
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))
                        ) : tablesOpen ? (
                          <div className="ml-6 py-2 text-xs text-muted-foreground">No schemas found</div>
                        ) : null}
                      </TreeItem>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem onSelect={loadTables} className="gap-2">
                      <RefreshCw className={cn("h-4 w-4", isLoadingTables && "animate-spin")} />
                      Refresh
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                  )}

                  {/* Security section - Users and Roles (not for SQLite) */}
                  {!isSqlite && (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          <TreeItem
                            label="Security"
                            icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                            onClick={handleSecurityClick}
                            defaultOpen={false}
                          >
                            {supportsUsers === false ? (
                              <div className="ml-6 py-2 text-xs text-muted-foreground">
                                User management not supported
                              </div>
                            ) : (
                              <>
                                {/* Users */}
                                <ContextMenu>
                                  <ContextMenuTrigger asChild>
                                    <div>
                                      <TreeItem
                                        label="Users"
                                        icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
                                        level={1}
                                        defaultOpen={false}
                                      >
                                        {isLoadingUsers ? (
                                          <div className="ml-4 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Loading...</span>
                                          </div>
                                        ) : connectionUsers.length > 0 ? (
                                          connectionUsers.map((user) => {
                                            const userDisplayName = isMySQL && user.host
                                              ? `${user.name}@${user.host}`
                                              : user.name;
                                            return (
                                              <ContextMenu key={userDisplayName}>
                                                <ContextMenuTrigger asChild>
                                                  <div>
                                                    <TreeItem
                                                      label={userDisplayName}
                                                      icon={<User className="h-3.5 w-3.5 text-muted-foreground" />}
                                                      level={2}
                                                    />
                                                  </div>
                                                </ContextMenuTrigger>
                                                <ContextMenuContent className="w-56">
                                                  <ContextMenuItem
                                                    onSelect={() => openManagePermissionsDialog(connection.id, user.name, user.host ?? undefined)}
                                                    className="gap-2"
                                                  >
                                                    <Shield className="h-4 w-4" />
                                                    Manage Permissions
                                                  </ContextMenuItem>
                                                  <ContextMenuItem
                                                    onSelect={() => openChangePasswordDialog(connection.id, user.name, user.host ?? undefined)}
                                                    className="gap-2"
                                                  >
                                                    <KeyRound className="h-4 w-4" />
                                                    Change Password
                                                  </ContextMenuItem>
                                                  <ContextMenuSeparator />
                                                  <ContextMenuItem
                                                    onSelect={() => setUserToDelete({ name: user.name, host: user.host ?? undefined })}
                                                    className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete User
                                                  </ContextMenuItem>
                                                </ContextMenuContent>
                                              </ContextMenu>
                                            );
                                          })
                                        ) : securityOpen ? (
                                          <div className="ml-4 py-2 text-xs text-muted-foreground">No users found</div>
                                        ) : null}
                                      </TreeItem>
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-48">
                                    <ContextMenuItem onSelect={() => openCreateUserDialog(connection.id)} className="gap-2">
                                      <Plus className="h-4 w-4" />
                                      Create User
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onSelect={loadSecurityUsers} className="gap-2">
                                      <RefreshCw className={cn("h-4 w-4", isLoadingUsers && "animate-spin")} />
                                      Refresh
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>

                                {/* Roles */}
                                <ContextMenu>
                                  <ContextMenuTrigger asChild>
                                    <div>
                                      <TreeItem
                                        label="Roles"
                                        icon={<UserCog className="h-3.5 w-3.5 text-muted-foreground" />}
                                        level={1}
                                        defaultOpen={false}
                                      >
                                        {isLoadingRoles ? (
                                          <div className="ml-4 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Loading...</span>
                                          </div>
                                        ) : connectionRoles.length > 0 ? (
                                          connectionRoles.map((role) => (
                                            <ContextMenu key={role.name}>
                                              <ContextMenuTrigger asChild>
                                                <div>
                                                  <TreeItem
                                                    label={role.name}
                                                    icon={<UserCog className="h-3.5 w-3.5 text-muted-foreground" />}
                                                    level={2}
                                                  />
                                                </div>
                                              </ContextMenuTrigger>
                                              <ContextMenuContent className="w-48">
                                                {!role.isSystemRole && (
                                                  <ContextMenuItem
                                                    onSelect={() => setRoleToDelete(role.name)}
                                                    className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete Role
                                                  </ContextMenuItem>
                                                )}
                                                {role.isSystemRole && (
                                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                    System role (cannot delete)
                                                  </div>
                                                )}
                                              </ContextMenuContent>
                                            </ContextMenu>
                                          ))
                                        ) : securityOpen ? (
                                          <div className="ml-4 py-2 text-xs text-muted-foreground">No roles found</div>
                                        ) : null}
                                      </TreeItem>
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-48">
                                    <ContextMenuItem onSelect={() => openCreateRoleDialog(connection.id)} className="gap-2">
                                      <Plus className="h-4 w-4" />
                                      Create Role
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onSelect={loadSecurityRoles} className="gap-2">
                                      <RefreshCw className={cn("h-4 w-4", isLoadingRoles && "animate-spin")} />
                                      Refresh
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              </>
                            )}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onSelect={() => { loadSecurityUsers(); loadSecurityRoles(); }} className="gap-2">
                          <RefreshCw className={cn("h-4 w-4", (isLoadingUsers || isLoadingRoles) && "animate-spin")} />
                          Refresh All
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )}

                  {/* Views section */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label="Views"
                          icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                          onClick={handleViewsClick}
                          defaultOpen={false}
                        >
                          {isLoadingViews ? (
                            <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Loading views...</span>
                            </div>
                          ) : connectionViews.length > 0 ? (
                            connectionViews.map((view) => (
                              <ContextMenu key={view.name}>
                                <ContextMenuTrigger asChild>
                                  <div>
                                    <TreeItem
                                      label={view.name}
                                      icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                                      level={1}
                                      onClick={() => handleViewClick(view.name)}
                                    />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-48">
                                  <ContextMenuItem onSelect={() => handleViewClick(view.name)} className="gap-2">
                                    <Table className="h-4 w-4" />
                                    View Data
                                  </ContextMenuItem>
                                  <ContextMenuItem onSelect={() => handleCopyViewDdl(view.name)} className="gap-2">
                                    <Copy className="h-4 w-4" />
                                    Copy DDL
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onSelect={() => setViewToDrop(view.name)}
                                    className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Drop View
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))
                          ) : viewsByConnection[connection.id] ? (
                            <div className="ml-6 py-2 text-xs text-muted-foreground">No views found</div>
                          ) : (
                            <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Loading views...</span>
                            </div>
                          )}
                        </TreeItem>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={loadConnectionViews} className="gap-2">
                        <RefreshCw className={cn("h-4 w-4", isLoadingViews && "animate-spin")} />
                        Refresh
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Indexes section */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label="Indexes"
                          icon={<ListTree className="h-3.5 w-3.5 text-muted-foreground" />}
                          onClick={handleIndexesClick}
                          defaultOpen={false}
                        >
                          {isLoadingIndexes ? (
                            <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Loading indexes...</span>
                            </div>
                          ) : indexTableNames.length > 0 ? (
                            indexTableNames.map((tableName) => (
                              <TreeItem
                                key={tableName}
                                label={tableName}
                                icon={<Table className="h-3.5 w-3.5 text-muted-foreground/50" />}
                                level={1}
                                defaultOpen={false}
                              >
                                {indexesByTable[tableName].map((idx) => (
                                  <ContextMenu key={idx.name}>
                                    <ContextMenuTrigger asChild>
                                      <div>
                                        <TreeItem
                                          label={idx.name}
                                          icon={<ListTree className={cn(
                                            "h-3.5 w-3.5",
                                            idx.isPrimary ? "text-primary" : idx.isUnique ? "text-yellow-500" : "text-muted-foreground"
                                          )} />}
                                          level={2}
                                        />
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="w-48">
                                      <ContextMenuItem onSelect={() => handleCopyIndexDdl(idx.name, idx.tableName)} className="gap-2">
                                        <Copy className="h-4 w-4" />
                                        Copy DDL
                                      </ContextMenuItem>
                                      {!idx.isPrimary && (
                                        <>
                                          <ContextMenuSeparator />
                                          <ContextMenuItem
                                            onSelect={() => setIndexToDrop({ name: idx.name, tableName: idx.tableName })}
                                            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Drop Index
                                          </ContextMenuItem>
                                        </>
                                      )}
                                      {idx.isPrimary && (
                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                          Primary key (cannot drop)
                                        </div>
                                      )}
                                    </ContextMenuContent>
                                  </ContextMenu>
                                ))}
                              </TreeItem>
                            ))
                          ) : indexesByConnection[connection.id] ? (
                            <div className="ml-6 py-2 text-xs text-muted-foreground">No indexes found</div>
                          ) : (
                            <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Loading indexes...</span>
                            </div>
                          )}
                        </TreeItem>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={loadConnectionIndexes} className="gap-2">
                        <RefreshCw className={cn("h-4 w-4", isLoadingIndexes && "animate-spin")} />
                        Refresh
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Stored Procedures section (conditionally rendered based on database support) */}
                  {featureSupport.procedures && (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          <TreeItem
                            label="Stored Procedures"
                            icon={<Code2 className="h-3.5 w-3.5 text-muted-foreground" />}
                            onClick={handleProceduresClick}
                            defaultOpen={false}
                          >
                            {isLoadingProcedures ? (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading procedures...</span>
                              </div>
                            ) : connectionProcedures.length > 0 ? (
                              connectionProcedures.map((proc) => (
                                <ContextMenu key={proc.name}>
                                  <ContextMenuTrigger asChild>
                                    <div>
                                      <TreeItem
                                        label={proc.name}
                                        icon={<Code2 className="h-3.5 w-3.5 text-muted-foreground" />}
                                        level={1}
                                      />
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-48">
                                    <ContextMenuItem onSelect={() => handleCopyProcedureDdl(proc.name)} className="gap-2">
                                      <Copy className="h-4 w-4" />
                                      Copy DDL
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onSelect={() => setProcedureToDrop(proc.name)}
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Drop Procedure
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              ))
                            ) : proceduresByConnection[connection.id] ? (
                              <div className="ml-6 py-2 text-xs text-muted-foreground">No procedures found</div>
                            ) : (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading procedures...</span>
                              </div>
                            )}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onSelect={loadConnectionProcedures} className="gap-2">
                          <RefreshCw className={cn("h-4 w-4", isLoadingProcedures && "animate-spin")} />
                          Refresh
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )}

                  {/* Functions section (conditionally rendered based on database support) */}
                  {featureSupport.functions && (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          <TreeItem
                            label="Functions"
                            icon={<FunctionSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                            onClick={handleFunctionsClick}
                            defaultOpen={false}
                          >
                            {isLoadingFunctions ? (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading functions...</span>
                              </div>
                            ) : connectionFunctions.length > 0 ? (
                              connectionFunctions.map((func) => (
                                <ContextMenu key={func.name}>
                                  <ContextMenuTrigger asChild>
                                    <div>
                                      <TreeItem
                                        label={func.name}
                                        icon={<FunctionSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                                        level={1}
                                      />
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-48">
                                    <ContextMenuItem onSelect={() => handleCopyFunctionDdl(func.name)} className="gap-2">
                                      <Copy className="h-4 w-4" />
                                      Copy DDL
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onSelect={() => setFunctionToDrop(func.name)}
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Drop Function
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              ))
                            ) : functionsByConnection[connection.id] ? (
                              <div className="ml-6 py-2 text-xs text-muted-foreground">No functions found</div>
                            ) : (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading functions...</span>
                              </div>
                            )}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onSelect={loadConnectionFunctions} className="gap-2">
                          <RefreshCw className={cn("h-4 w-4", isLoadingFunctions && "animate-spin")} />
                          Refresh
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )}

                  {/* Triggers section (conditionally rendered based on database support) */}
                  {featureSupport.triggers && (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          <TreeItem
                            label="Triggers"
                            icon={<Zap className="h-3.5 w-3.5 text-muted-foreground" />}
                            onClick={handleTriggersClick}
                            defaultOpen={false}
                          >
                            {isLoadingTriggers ? (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading triggers...</span>
                              </div>
                            ) : connectionTriggers.length > 0 ? (
                              connectionTriggers.map((trigger) => (
                                <ContextMenu key={trigger.name}>
                                  <ContextMenuTrigger asChild>
                                    <div>
                                      <TreeItem
                                        label={trigger.name}
                                        icon={<Zap className="h-3.5 w-3.5 text-muted-foreground" />}
                                        level={1}
                                      />
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-48">
                                    <ContextMenuItem onSelect={() => handleCopyTriggerDdl(trigger.name)} className="gap-2">
                                      <Copy className="h-4 w-4" />
                                      Copy DDL
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onSelect={() => setTriggerToDrop(trigger.name)}
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Drop Trigger
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              ))
                            ) : triggersByConnection[connection.id] ? (
                              <div className="ml-6 py-2 text-xs text-muted-foreground">No triggers found</div>
                            ) : (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading triggers...</span>
                              </div>
                            )}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onSelect={loadConnectionTriggers} className="gap-2">
                          <RefreshCw className={cn("h-4 w-4", isLoadingTriggers && "animate-spin")} />
                          Refresh
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )}

                  {/* Sequences section (conditionally rendered based on database support) */}
                  {featureSupport.sequences && (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          <TreeItem
                            label="Sequences"
                            icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}
                            onClick={handleSequencesClick}
                            defaultOpen={false}
                          >
                            {isLoadingSequences ? (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading sequences...</span>
                              </div>
                            ) : connectionSequences.length > 0 ? (
                              connectionSequences.map((seq) => (
                                <ContextMenu key={seq.name}>
                                  <ContextMenuTrigger asChild>
                                    <div>
                                      <TreeItem
                                        label={seq.name}
                                        icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}
                                        level={1}
                                      />
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-48">
                                    <ContextMenuItem onSelect={() => handleCopySequenceDdl(seq.name)} className="gap-2">
                                      <Copy className="h-4 w-4" />
                                      Copy DDL
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onSelect={() => setSequenceToDrop(seq.name)}
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Drop Sequence
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              ))
                            ) : sequencesByConnection[connection.id] ? (
                              <div className="ml-6 py-2 text-xs text-muted-foreground">No sequences found</div>
                            ) : (
                              <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading sequences...</span>
                              </div>
                            )}
                          </TreeItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onSelect={loadConnectionSequences} className="gap-2">
                          <RefreshCw className={cn("h-4 w-4", isLoadingSequences && "animate-spin")} />
                          Refresh
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
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
                <Unplug className="h-4 w-4" />
                Disconnect
              </ContextMenuItem>
              <ContextMenuItem onSelect={loadTables} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", isLoadingTables && "animate-spin")} />
                Refresh
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem onSelect={handleConnect} className="gap-2">
              <Plug className="h-4 w-4" />
              Connect
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit Connection
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleRename} className="gap-2">
            <Pencil className="h-4 w-4" />
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
          <ContextMenuItem
            onSelect={handleDelete}
            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user "{userToDelete?.name}{userToDelete?.host ? `@${userToDelete.host}` : ''}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation Dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete}"? Users assigned this role will lose associated permissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop View Confirmation Dialog */}
      <AlertDialog open={!!viewToDrop} onOpenChange={(open) => !open && setViewToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the view "{viewToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmViewDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop View
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Index Confirmation Dialog */}
      <AlertDialog open={!!indexToDrop} onOpenChange={(open) => !open && setIndexToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Index</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the index "{indexToDrop?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmIndexDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Index
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Procedure Confirmation Dialog */}
      <AlertDialog open={!!procedureToDrop} onOpenChange={(open) => !open && setProcedureToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Procedure</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the procedure "{procedureToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProcedureDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Procedure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Function Confirmation Dialog */}
      <AlertDialog open={!!functionToDrop} onOpenChange={(open) => !open && setFunctionToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Function</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the function "{functionToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmFunctionDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Function
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Trigger Confirmation Dialog */}
      <AlertDialog open={!!triggerToDrop} onOpenChange={(open) => !open && setTriggerToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Trigger</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the trigger "{triggerToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmTriggerDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Trigger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Sequence Confirmation Dialog */}
      <AlertDialog open={!!sequenceToDrop} onOpenChange={(open) => !open && setSequenceToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the sequence "{sequenceToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSequenceDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Sequence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function Sidebar() {
  const {
    sidebarOpen,
    sidebarWidth,
    setShowConnectionModal,
    openSettingsWithTab,
  } = useUIStore();
  const { connections } = useConnectionsStore();
  const { loadConnections } = useDatabase();

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside
      data-sidebar
      className="flex h-full flex-col border-r border-sidebar-border bg-sidebar"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm">dbfordevs</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowConnectionModal(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Connection</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Connections List */}
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="space-y-1">
          {connections.length === 0 ? (
            <div className="py-12 text-center animate-fade-in">
              <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Database className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No connections</p>
              <p className="text-xs text-muted-foreground mb-4">Add your first database connection</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConnectionModal(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Connection
              </Button>
            </div>
          ) : (
            connections.map((conn, index) => (
              <div key={conn.id} className={cn(
                index > 0 && "mt-1 pt-1 border-t border-sidebar-border/50"
              )}>
                <ConnectionItem connection={conn} />
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => openSettingsWithTab("general")}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}