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
}

function TreeItem({ label, icon, children, level = 0, onClick, isActive }: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = Boolean(children);

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
          level > 0 && "ml-4"
        )}
        onClick={() => {
          if (hasChildren) setIsOpen(!isOpen);
          onClick?.();
        }}
      >
        {hasChildren && (
          <span className="text-muted-foreground">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
        {!hasChildren && <span className="w-3" />}
        <span className="text-muted-foreground">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
      {isOpen && children && <div className="ml-2">{children}</div>}
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
    switch (connection.databaseType) {
      case "postgresql":
        return <Database className="h-4 w-4 text-blue-500" />;
      case "mysql":
        return <Database className="h-4 w-4 text-orange-500" />;
      case "sqlite":
        return <HardDrive className="h-4 w-4 text-green-500" />;
      case "mssql":
        return <Server className="h-4 w-4 text-red-500" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const connectionTables = isActive ? tables : [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label={connection.name}
              icon={getIcon()}
              isActive={isActive}
              onClick={handleConnectionClick}
            >
              {connection.connected && (
                <TreeItem
                  label="Tables"
                  icon={<FolderTree className="h-3 w-3" />}
                  onClick={handleTablesClick}
                >
                  {isLoadingTables ? (
                    <div className="ml-4 flex items-center gap-2 py-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : connectionTables.length > 0 ? (
                    connectionTables.map((table) => (
                      <TreeItem
                        key={table.name}
                        label={table.name}
                        icon={<Table className="h-3 w-3" />}
                        level={1}
                      />
                    ))
                  ) : tablesOpen ? (
                    <div className="ml-4 py-1 text-xs text-muted-foreground">No tables found</div>
                  ) : null}
                </TreeItem>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {connection.connected ? (
            <ContextMenuItem onClick={handleDisconnect}>
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handleConnect}>
              <Plug className="mr-2 h-4 w-4" />
              Connect
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Connection
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowProperties(true)}>
            <Info className="mr-2 h-4 w-4" />
            Properties
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
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
      <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">dbfordevs</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowConnectionModal(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Connection</TooltipContent>
        </Tooltip>
      </div>

      {/* Connections List */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-1">
          {connections.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Database className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No connections yet</p>
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => setShowConnectionModal(true)}
              >
                Add your first connection
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
                className="flex-1 justify-start gap-2"
                onClick={() => setShowValidatorModal(true)}
              >
                <Wrench className="h-4 w-4" />
                <span className="text-xs">Validator</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connection String Validator</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSettingsDialog(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
