import { useState, useEffect } from "react";
import {
  Database,
  FolderTree,
  Table,
  Plus,
  Settings,
  ChevronRight,
  ChevronDown,
  Loader2,
  Pencil,
  Trash2,
  Info,
  Plug,
  Unplug,
  RefreshCw,
  ShoppingBag,
  Copy,
  ClipboardPaste,
  Network,
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
import { TableSearch } from "@/components/sidebar/TableSearch";
import { useConnectionsStore, useUIStore, useQueryStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo, TableInfo } from "@/types";
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
    <div className="relative">
      {isActive && level === 0 && (
        <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-full z-10" />
      )}
      <div
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-all duration-200",
          "hover:bg-sidebar-accent/50",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          level > 0 && "ml-4"
        )}
      >
        <button
          className="flex flex-1 items-center gap-2 overflow-hidden"
          onClick={() => {
            if (hasChildren) setIsOpen(!isOpen);
            onClick?.();
          }}
        >
          {hasChildren ? (
            <span className={cn(
              "transition-transform duration-200",
              isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"
            )}>
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          ) : (
            <span className="w-3.5" />
          )}
          <span className={cn(
            "shrink-0 transition-colors",
            isActive ? "text-sidebar-accent-foreground" : ""
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
        <div className="ml-2 animate-slide-down">{children}</div>
      )}
    </div>
  );
}

function ConnectionItem({ connection }: { connection: ConnectionInfo }) {
  const { activeConnectionId, setActiveConnection } = useConnectionsStore();
  const { openConnectionModal, openRenameTableDialog, openRenameConnectionDialog } = useUIStore();
  const { tablesByConnection, addTab, tabs, setActiveTab, removeTab } = useQueryStore();
  const { connect, disconnect, getTables, deleteConnection, dropTable, generateTableDdl } = useDatabase();
  const { toast } = useToast();
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showDeleteConnectionDialog, setShowDeleteConnectionDialog] = useState(false);
  const [tableToDrop, setTableToDrop] = useState<string | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const isActive = activeConnectionId === connection.id;

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
      if (!connected) return;
    }

    setIsLoadingTables(true);
    try {
      await getTables(connection.id);
    } catch (error) {
      console.error("Failed to load tables:", error);
    } finally {
      setIsLoadingTables(false);
    }
  };

  const handleConnectionClick = async () => {
    setActiveConnection(connection.id);
    if (!connection.connected) {
      await connect(connection.id);
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

  // Filter tables based on search query
  const filteredTables = tableSearchQuery.trim()
    ? connectionTables.filter((table) =>
        table.name.toLowerCase().includes(tableSearchQuery.toLowerCase())
      )
    : connectionTables;

  // Group tables by schema
  const tablesBySchema = filteredTables.reduce((acc: Record<string, TableInfo[]>, table: TableInfo) => {
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
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div>
                      <TreeItem
                        label="Schemas"
                        icon={<FolderTree className="h-3.5 w-3.5 text-muted-foreground" />}
                        onClick={handleTablesClick}
                        defaultOpen={true}
                      >
                        {tablesOpen && connectionTables.length > 0 && (
                          <div className="ml-6 mb-2">
                            <TableSearch
                              value={tableSearchQuery}
                              onChange={setTableSearchQuery}
                              onClear={() => setTableSearchQuery("")}
                              matchCount={filteredTables.length}
                            />
                          </div>
                        )}
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
    </>
  );
}

export function Sidebar() {
  const {
    sidebarOpen,
    sidebarWidth,
    setShowConnectionModal,
    openSettingsWithTab,
    setShowMarketplace,
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
            connections.map((conn) => (
              <ConnectionItem key={conn.id} connection={conn} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 group"
                onClick={() => setShowMarketplace(true)}
              >
                <ShoppingBag className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Extensions</TooltipContent>
          </Tooltip>

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