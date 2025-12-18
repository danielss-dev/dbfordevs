import { useState, useEffect } from "react";
import {
  Database,
  FolderTree,
  Table,
  Plus,
  Settings,
  ChevronRight,
  ChevronDown,
  Server,
  HardDrive,
  Wrench,
  Loader2,
  Pencil,
  Trash2,
  Info,
  Plug,
  Unplug,
  Zap,
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
} from "@/components/ui";
import { ConnectionPropertiesDialog } from "@/components/connections";
import { useConnectionsStore, useUIStore, useQueryStore } from "@/stores";
import { useDatabase } from "@/hooks";
import type { ConnectionInfo } from "@/types";

interface TreeItemProps {
  label: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  level?: number;
  onClick?: () => void;
  isActive?: boolean;
  isConnected?: boolean;
}

function TreeItem({ label, icon, children, level = 0, onClick, isActive, isConnected }: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = Boolean(children);

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-all duration-200",
          "hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
          level > 0 && "ml-4"
        )}
        onClick={() => {
          if (hasChildren) setIsOpen(!isOpen);
          onClick?.();
        }}
      >
        {hasChildren ? (
          <span className="text-muted-foreground transition-transform duration-200">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        ) : (
          <span className="w-3.5" />
        )}
        <span className="shrink-0">{icon}</span>
        <span className="truncate flex-1 text-left">{label}</span>
        {isConnected !== undefined && (
          <span className={cn(
            "w-2 h-2 rounded-full shrink-0",
            isConnected ? "bg-[hsl(var(--success))]" : "bg-muted-foreground/30"
          )} />
        )}
      </button>
      {isOpen && children && (
        <div className="ml-2 animate-slide-down">{children}</div>
      )}
    </div>
  );
}

function ConnectionItem({ connection }: { connection: ConnectionInfo }) {
  const { activeConnectionId, setActiveConnection } = useConnectionsStore();
  const { openConnectionModal } = useUIStore();
  const { tables } = useQueryStore();
  const { connect, disconnect, getTables, deleteConnection } = useDatabase();
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const isActive = activeConnectionId === connection.id;

  useEffect(() => {
    if (isActive && connection.connected && tablesOpen && tables.length === 0) {
      loadTables();
    }
  }, [isActive, connection.connected, tablesOpen]);

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
    if (!tablesOpen && connection.connected && tables.length === 0) {
      loadTables();
    }
  };

  const handleEdit = () => {
    openConnectionModal(connection.id);
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete connection "${connection.name}"?`)) {
      await deleteConnection(connection.id);
    }
  };

  const handleConnect = async () => {
    await connect(connection.id);
  };

  const handleDisconnect = async () => {
    await disconnect(connection.id);
  };

  const getIcon = () => {
    const baseClasses = "h-4 w-4";
    switch (connection.databaseType) {
      case "postgresql":
        return <Database className={cn(baseClasses, "text-blue-500")} />;
      case "mysql":
        return <Database className={cn(baseClasses, "text-orange-500")} />;
      case "sqlite":
        return <HardDrive className={cn(baseClasses, "text-green-500")} />;
      case "mssql":
        return <Server className={cn(baseClasses, "text-red-500")} />;
      default:
        return <Database className={baseClasses} />;
    }
  };

  const connectionTables = isActive ? tables : [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className={cn(
            "rounded-lg transition-all duration-200",
            isActive && "bg-sidebar-accent/50"
          )}>
            <TreeItem
              label={connection.name}
              icon={getIcon()}
              isActive={isActive}
              isConnected={connection.connected}
              onClick={handleConnectionClick}
            >
              {connection.connected && (
                <TreeItem
                  label="Tables"
                  icon={<FolderTree className="h-3.5 w-3.5 text-muted-foreground" />}
                  onClick={handleTablesClick}
                >
                  {isLoadingTables ? (
                    <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : connectionTables.length > 0 ? (
                    connectionTables.map((table) => (
                      <TreeItem
                        key={table.name}
                        label={table.name}
                        icon={<Table className="h-3.5 w-3.5 text-muted-foreground" />}
                        level={1}
                      />
                    ))
                  ) : tablesOpen ? (
                    <div className="ml-6 py-2 text-xs text-muted-foreground">No tables found</div>
                  ) : null}
                </TreeItem>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {connection.connected ? (
            <ContextMenuItem onClick={handleDisconnect} className="gap-2">
              <Unplug className="h-4 w-4" />
              Disconnect
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handleConnect} className="gap-2">
              <Plug className="h-4 w-4" />
              Connect
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit Connection
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowProperties(true)} className="gap-2">
            <Info className="h-4 w-4" />
            Properties
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleDelete}
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
    </>
  );
}

export function Sidebar() {
  const { sidebarOpen, sidebarWidth, setShowConnectionModal, setShowValidatorModal, setShowSettingsDialog } = useUIStore();
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
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm">dbfordevs</span>
            <span className="text-[10px] text-muted-foreground ml-1.5">v0.1</span>
          </div>
        </div>
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
                size="sm"
                className="flex-1 justify-start gap-2 h-9"
                onClick={() => setShowValidatorModal(true)}
              >
                <Wrench className="h-4 w-4" />
                <span className="text-xs">Validator</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Connection String Validator</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setShowSettingsDialog(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
