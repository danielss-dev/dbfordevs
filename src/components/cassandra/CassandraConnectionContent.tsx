import { useState, useEffect, useRef, useCallback } from "react";
import {
  Database,
  FolderClosed,
  FolderOpen,
  Table2,
  Terminal,
  ServerCog,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
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
import { useCassandra, useToast } from "@/hooks";
import { useCassandraStore, useQueryStore } from "@/stores";
import type { Tab } from "@/types";

interface TreeItemProps {
  label: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  level?: number;
  onClick?: () => void;
  isActive?: boolean;
  isHighlighted?: boolean;
  rightElement?: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  count?: number;
  itemRef?: React.RefObject<HTMLDivElement>;
  badge?: string;
}

function TreeItem({
  label,
  icon,
  children,
  level = 0,
  onClick,
  isActive,
  isHighlighted,
  rightElement,
  defaultOpen = false,
  forceOpen,
  count,
  itemRef,
  badge,
}: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = Boolean(children);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const effectiveOpen = isOpen || forceOpen;

  return (
    <div className="group/tree relative min-w-0" ref={itemRef}>
      {level > 0 && (
        <div
          className="tree-guide"
          style={{ left: `${(level - 1) * 16 + 18}px` }}
        />
      )}
      <div
        className={cn(
          "group flex w-full items-center gap-1 rounded-md py-1.5 text-sm transition-all duration-200 min-w-0",
          "hover:bg-sidebar-accent/60",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          isHighlighted && "animate-highlight-blink"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px`, paddingRight: "8px" }}
      >
        <button
          className="flex flex-1 items-center gap-1.5 overflow-hidden min-w-0"
          onClick={() => {
            if (hasChildren) setIsOpen(!isOpen);
            onClick?.();
          }}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                effectiveOpen && "rotate-90",
                isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"
              )}
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span
            className={cn(
              "shrink-0 flex items-center justify-center w-4 h-4 rounded",
              isActive ? "text-sidebar-accent-foreground" : ""
            )}
          >
            {icon}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate flex-1 text-left min-w-0">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="right" align="start">
              {label}
            </TooltipContent>
          </Tooltip>
          {badge && (
            <span className="shrink-0 text-[10px] text-muted-foreground/70 font-mono ml-1">
              {badge}
            </span>
          )}
          {count !== undefined && (
            <span className="shrink-0 text-[10px] text-muted-foreground bg-muted/50 px-1 rounded ml-0.5">
              {count}
            </span>
          )}
        </button>
        {rightElement && (
          <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {rightElement}
          </div>
        )}
      </div>
      {effectiveOpen && children && <div className="animate-slide-down">{children}</div>}
    </div>
  );
}

interface CassandraConnectionContentProps {
  connectionId: string;
}

export function CassandraConnectionContent({ connectionId }: CassandraConnectionContentProps) {
  const { listKeyspaces, listTables, describeTable, getServerInfo, dropKeyspace, dropTable, truncateTable } = useCassandra();
  const { addTab, tabs, setActiveTab } = useQueryStore();
  const { toast } = useToast();
  const {
    keyspacesByConnection,
    tablesByKeyspace,
    columnsByTable,
    loadingKeyspaces,
    loadingTables,
    selectedKeyspaceByConnection,
    setSelectedKeyspace,
    highlightedItemByConnection,
    clearHighlightedItem,
  } = useCassandraStore();

  const keyspaces = keyspacesByConnection[connectionId] || [];
  const selectedKeyspace = selectedKeyspaceByConnection[connectionId];
  const highlightedItem = highlightedItemByConnection[connectionId] || null;

  // Refs for scrolling to highlighted items
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Dialog states
  const [dropKeyspaceDialog, setDropKeyspaceDialog] = useState<string | null>(null);
  const [dropTableDialog, setDropTableDialog] = useState<{ keyspace: string; table: string } | null>(null);
  const [truncateDialog, setTruncateDialog] = useState<{ keyspace: string; table: string } | null>(null);

  // Scroll to highlighted item when it changes
  useEffect(() => {
    if (highlightedItem) {
      const refKey = highlightedItem.type === "keyspace"
        ? `ks-${highlightedItem.name}`
        : highlightedItem.type === "table"
          ? `tbl-${highlightedItem.keyspace}-${highlightedItem.name}`
          : `col-${highlightedItem.keyspace}-${highlightedItem.table}-${highlightedItem.name}`;

      if (itemRefs.current[refKey]) {
        setTimeout(() => {
          itemRefs.current[refKey]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 100);

        setTimeout(() => {
          clearHighlightedItem(connectionId);
        }, 2000);
      }
    }
  }, [highlightedItem, connectionId, clearHighlightedItem]);

  const setItemRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[key] = el;
  }, []);

  // Load keyspaces on mount
  useEffect(() => {
    listKeyspaces(connectionId);
    getServerInfo(connectionId);
  }, [connectionId]);

  const handleRefreshKeyspaces = () => {
    listKeyspaces(connectionId);
  };

  const handleRefreshTables = (keyspace: string) => {
    listTables(connectionId, keyspace);
  };

  const handleKeyspaceClick = async (keyspace: string) => {
    setSelectedKeyspace(connectionId, keyspace);
    const key = `${connectionId}:${keyspace}`;
    if (!tablesByKeyspace[key]) {
      await listTables(connectionId, keyspace);
    }
  };

  const handleTableClick = async (keyspace: string, tableName: string) => {
    // Load columns if not already loaded
    const key = `${connectionId}:${keyspace}:${tableName}`;
    if (!columnsByTable[key]) {
      await describeTable(connectionId, keyspace, tableName);
    }

    const tabId = `cassandra-browser-${connectionId}-${keyspace}-${tableName}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: tableName.length > 20 ? tableName.substring(0, 17) + "..." : tableName,
        type: "cassandra-browser",
        connectionId,
        cassandraKeyspace: keyspace,
        cassandraTable: tableName,
      } as Tab);
    }
  };

  const handleOpenShell = () => {
    const tabId = `cassandra-shell-${connectionId}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "CQL Shell",
        type: "cassandra-shell",
        connectionId,
      } as Tab);
    }
  };

  const handleOpenServerInfo = () => {
    const tabId = `cassandra-info-${connectionId}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "Cluster Info",
        type: "cassandra-info",
        connectionId,
      } as Tab);
    }
  };

  const handleDropKeyspace = async (keyspace: string) => {
    const success = await dropKeyspace(connectionId, keyspace);
    if (success) {
      toast({
        title: "Keyspace dropped",
        description: `Keyspace "${keyspace}" has been dropped.`,
      });
      listKeyspaces(connectionId);
    } else {
      toast({
        title: "Failed to drop keyspace",
        description: `Could not drop keyspace "${keyspace}".`,
        variant: "destructive",
      });
    }
    setDropKeyspaceDialog(null);
  };

  const handleDropTable = async (keyspace: string, table: string) => {
    const success = await dropTable(connectionId, keyspace, table);
    if (success) {
      toast({
        title: "Table dropped",
        description: `Table "${table}" has been dropped.`,
      });
      listTables(connectionId, keyspace);
    } else {
      toast({
        title: "Failed to drop table",
        description: `Could not drop table "${table}".`,
        variant: "destructive",
      });
    }
    setDropTableDialog(null);
  };

  const handleTruncateTable = async (keyspace: string, table: string) => {
    const success = await truncateTable(connectionId, keyspace, table);
    if (success) {
      toast({
        title: "Table truncated",
        description: `Table "${table}" has been truncated.`,
      });
    } else {
      toast({
        title: "Failed to truncate table",
        description: `Could not truncate table "${table}".`,
        variant: "destructive",
      });
    }
    setTruncateDialog(null);
  };

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    toast({
      title: "Copied",
      description: `"${name}" copied to clipboard.`,
    });
  };

  // Filter out system keyspaces for cleaner display
  const userKeyspaces = keyspaces.filter(ks => !ks.name.startsWith("system"));
  const systemKeyspaces = keyspaces.filter(ks => ks.name.startsWith("system"));

  return (
    <>
      {/* Keyspaces Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Keyspaces"
              icon={<Database className="h-3.5 w-3.5 text-muted-foreground" />}
              level={0}
              defaultOpen={true}
              count={userKeyspaces.length}
              rightElement={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshKeyspaces();
                      }}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loadingKeyspaces && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh keyspaces</TooltipContent>
                </Tooltip>
              }
            >
              {loadingKeyspaces ? (
                <div className="ml-8 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                <>
                  {userKeyspaces.map((ks) => {
                    const tables = tablesByKeyspace[`${connectionId}:${ks.name}`] || [];
                    const isExpanded = selectedKeyspace === ks.name;
                    const shouldForceOpenKs = highlightedItem && (
                      (highlightedItem.type === "keyspace" && highlightedItem.name === ks.name) ||
                      (highlightedItem.type === "table" && highlightedItem.keyspace === ks.name) ||
                      (highlightedItem.type === "column" && highlightedItem.keyspace === ks.name)
                    );
                    const isKsHighlighted = highlightedItem?.type === "keyspace" && highlightedItem.name === ks.name;

                    return (
                      <ContextMenu key={ks.name}>
                        <ContextMenuTrigger asChild>
                          <div ref={setItemRef(`ks-${ks.name}`)}>
                            <TreeItem
                              label={ks.name}
                              icon={
                                isExpanded || shouldForceOpenKs ? (
                                  <FolderOpen className="h-3.5 w-3.5 text-purple-500" />
                                ) : (
                                  <FolderClosed className="h-3.5 w-3.5 text-purple-500" />
                                )
                              }
                              level={1}
                              count={ks.tableCount}
                              badge={ks.replicationStrategy === "SimpleStrategy" ? `RF=${ks.replicationFactor}` : "NTS"}
                              defaultOpen={isExpanded}
                              forceOpen={shouldForceOpenKs || false}
                              isHighlighted={isKsHighlighted}
                              onClick={() => handleKeyspaceClick(ks.name)}
                            >
                              {loadingTables ? (
                                <div className="ml-12 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Loading...</span>
                                </div>
                              ) : (
                                tables.map((tbl) => {
                                  const isTableHighlighted = highlightedItem?.type === "table" &&
                                    highlightedItem.keyspace === ks.name &&
                                    highlightedItem.name === tbl.name;

                                  return (
                                    <ContextMenu key={tbl.name}>
                                      <ContextMenuTrigger asChild>
                                        <div ref={setItemRef(`tbl-${ks.name}-${tbl.name}`)}>
                                          <TreeItem
                                            label={tbl.name}
                                            icon={<Table2 className="h-3.5 w-3.5 text-blue-500" />}
                                            level={2}
                                            count={tbl.columnCount}
                                            isHighlighted={isTableHighlighted}
                                            onClick={() => handleTableClick(ks.name, tbl.name)}
                                            rightElement={
                                              tbl.partitionKeys.length > 0 ? (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                                      <Key className="h-3 w-3" />
                                                      {tbl.partitionKeys.length}
                                                    </span>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    Partition keys: {tbl.partitionKeys.join(", ")}
                                                  </TooltipContent>
                                                </Tooltip>
                                              ) : undefined
                                            }
                                          />
                                        </div>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent className="w-48">
                                        <ContextMenuItem
                                          onSelect={() => handleTableClick(ks.name, tbl.name)}
                                          className="gap-2"
                                        >
                                          <Table2 className="h-4 w-4" />
                                          Browse Data
                                        </ContextMenuItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                          onSelect={() => handleCopyName(tbl.name)}
                                          className="gap-2"
                                        >
                                          <Copy className="h-4 w-4" />
                                          Copy Name
                                        </ContextMenuItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                          onSelect={() => setTruncateDialog({ keyspace: ks.name, table: tbl.name })}
                                          className="gap-2 text-orange-500 focus:text-orange-500"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Truncate Table
                                        </ContextMenuItem>
                                        <ContextMenuItem
                                          onSelect={() => setDropTableDialog({ keyspace: ks.name, table: tbl.name })}
                                          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Drop Table
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                                  );
                                })
                              )}
                              {!loadingTables && tables.length === 0 && (
                                <div className="ml-12 py-1 text-xs text-muted-foreground">No tables</div>
                              )}
                            </TreeItem>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            onSelect={() => handleRefreshTables(ks.name)}
                            className="gap-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Refresh Tables
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onSelect={() => handleCopyName(ks.name)}
                            className="gap-2"
                          >
                            <Copy className="h-4 w-4" />
                            Copy Name
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onSelect={() => setDropKeyspaceDialog(ks.name)}
                            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Drop Keyspace
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}

                  {/* System Keyspaces (collapsed by default) */}
                  {systemKeyspaces.length > 0 && (
                    <TreeItem
                      label="System"
                      icon={<FolderClosed className="h-3.5 w-3.5 text-gray-500" />}
                      level={1}
                      count={systemKeyspaces.length}
                    >
                      {systemKeyspaces.map((ks) => (
                        <TreeItem
                          key={ks.name}
                          label={ks.name}
                          icon={<Database className="h-3.5 w-3.5 text-gray-400" />}
                          level={2}
                          onClick={() => handleKeyspaceClick(ks.name)}
                        />
                      ))}
                    </TreeItem>
                  )}
                </>
              )}
              {!loadingKeyspaces && keyspaces.length === 0 && (
                <div className="ml-8 py-2 text-xs text-muted-foreground">No keyspaces found</div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleRefreshKeyspaces} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Keyspaces
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* CQL Shell Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="CQL Shell"
              icon={<Terminal className="h-3.5 w-3.5 text-muted-foreground" />}
              level={0}
              onClick={handleOpenShell}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleOpenShell} className="gap-2">
            <Terminal className="h-4 w-4" />
            Open CQL Shell
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Cluster Info Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Cluster Info"
              icon={<ServerCog className="h-3.5 w-3.5 text-muted-foreground" />}
              level={0}
              onClick={handleOpenServerInfo}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleOpenServerInfo} className="gap-2">
            <ServerCog className="h-4 w-4" />
            View Cluster Info
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop Keyspace Confirmation Dialog */}
      <AlertDialog open={!!dropKeyspaceDialog} onOpenChange={() => setDropKeyspaceDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Keyspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the keyspace "{dropKeyspaceDialog}"? This action cannot be undone
              and will permanently delete all tables and data in this keyspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dropKeyspaceDialog && handleDropKeyspace(dropKeyspaceDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Keyspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drop Table Confirmation Dialog */}
      <AlertDialog open={!!dropTableDialog} onOpenChange={() => setDropTableDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the table "{dropTableDialog?.table}"? This action cannot
              be undone and will permanently delete all data in this table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dropTableDialog && handleDropTable(dropTableDialog.keyspace, dropTableDialog.table)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Truncate Table Confirmation Dialog */}
      <AlertDialog open={!!truncateDialog} onOpenChange={() => setTruncateDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Truncate Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to truncate the table "{truncateDialog?.table}"? This will
              delete all data but keep the table structure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => truncateDialog && handleTruncateTable(truncateDialog.keyspace, truncateDialog.table)}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Truncate Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
