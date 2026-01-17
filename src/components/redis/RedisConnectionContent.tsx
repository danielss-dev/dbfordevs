import { useState, useEffect } from "react";
import {
  Hash,
  Terminal,
  ServerCog,
  Type,
  List,
  CircleDot,
  ArrowUpDown,
  Activity,
  ChevronRight,
  Loader2,
  RefreshCw,
  LayoutGrid,
  Trash2,
  Eye,
  Copy,
  Clock,
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
import { useRedis, useToast } from "@/hooks";
import { useRedisStore, useQueryStore } from "@/stores";
import type { RedisKeyType, Tab } from "@/types";

interface TreeItemProps {
  label: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  level?: number;
  onClick?: () => void;
  isActive?: boolean;
  rightElement?: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}

function TreeItem({
  label,
  icon,
  children,
  level = 0,
  onClick,
  isActive,
  rightElement,
  defaultOpen = false,
  count,
}: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = Boolean(children);

  return (
    <div className="group/tree relative">
      {level > 0 && (
        <div
          className="tree-guide"
          style={{ left: `${(level - 1) * 16 + 18}px` }}
        />
      )}
      <div
        className={cn(
          "group flex w-full items-center gap-2 rounded-md py-1.5 text-sm transition-all duration-200",
          "hover:bg-sidebar-accent/60",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px`, paddingRight: "8px" }}
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
          <span
            className={cn(
              "shrink-0 flex items-center justify-center w-5 h-5 rounded bg-sidebar-accent/30",
              isActive ? "text-sidebar-accent-foreground bg-sidebar-accent/50" : ""
            )}
          >
            {icon}
          </span>
          <span className="truncate flex-1 text-left">{label}</span>
          {count !== undefined && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
        </button>
        {rightElement && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {rightElement}
          </div>
        )}
      </div>
      {isOpen && children && <div className="animate-slide-down">{children}</div>}
    </div>
  );
}

const KEY_TYPE_ICONS: Record<RedisKeyType, React.ReactNode> = {
  string: <Type className="h-3.5 w-3.5 text-blue-500" />,
  list: <List className="h-3.5 w-3.5 text-green-500" />,
  set: <CircleDot className="h-3.5 w-3.5 text-purple-500" />,
  hash: <Hash className="h-3.5 w-3.5 text-orange-500" />,
  zset: <ArrowUpDown className="h-3.5 w-3.5 text-yellow-500" />,
  stream: <Activity className="h-3.5 w-3.5 text-pink-500" />,
  unknown: <Hash className="h-3.5 w-3.5 text-muted-foreground" />,
};

const KEY_TYPE_LABELS: Record<RedisKeyType, string> = {
  string: "Strings",
  list: "Lists",
  set: "Sets",
  hash: "Hashes",
  zset: "Sorted Sets",
  stream: "Streams",
  unknown: "Unknown",
};

interface RedisConnectionContentProps {
  connectionId: string;
}

export function RedisConnectionContent({ connectionId }: RedisConnectionContentProps) {
  const { scanKeys, getServerInfo, deleteKey } = useRedis();
  const { addTab, tabs, setActiveTab } = useQueryStore();
  const { keysByConnection, loadingKeys } = useRedisStore();
  const { toast } = useToast();

  const keys = keysByConnection[connectionId] || [];

  // Dialog states
  const [deleteKeyDialog, setDeleteKeyDialog] = useState<string | null>(null);

  // Group keys by type
  const groupedKeys = keys.reduce<Record<RedisKeyType, typeof keys>>(
    (acc, key) => {
      const type = key.keyType || "unknown";
      if (!acc[type]) acc[type] = [];
      acc[type].push(key);
      return acc;
    },
    {} as Record<RedisKeyType, typeof keys>
  );

  // Load keys on mount
  useEffect(() => {
    scanKeys(connectionId, "*", 100, 0, false);
    getServerInfo(connectionId);
  }, [connectionId]);

  const handleRefreshKeys = () => {
    scanKeys(connectionId, "*", 100, 0, false);
  };

  const handleKeyClick = (key: string) => {
    const tabId = `redis-key-${connectionId}-${key}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: key.length > 20 ? key.substring(0, 17) + "..." : key,
        type: "redis-key",
        connectionId,
        redisKey: key,
      } as Tab);
    }
  };

  const handleOpenCli = () => {
    const tabId = `redis-cli-${connectionId}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "CLI",
        type: "redis-cli",
        connectionId,
      } as Tab);
    }
  };

  const handleOpenServerInfo = () => {
    const tabId = `redis-info-${connectionId}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "Server Info",
        type: "redis-info",
        connectionId,
      } as Tab);
    }
  };

  const handleOpenBrowser = () => {
    const tabId = `redis-browser-${connectionId}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: "Browser",
        type: "redis-browser",
        connectionId,
      } as Tab);
    }
  };

  const handleCopyKeyName = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied",
      description: `"${key}" copied to clipboard.`,
    });
  };

  const handleDeleteKey = async (key: string) => {
    const success = await deleteKey(connectionId, key);
    if (success) {
      toast({
        title: "Key deleted",
        description: `Key "${key}" has been deleted.`,
      });
      // Refresh keys
      scanKeys(connectionId, "*", 100, 0, false);
    } else {
      toast({
        title: "Failed to delete key",
        description: `Could not delete key "${key}".`,
        variant: "destructive",
      });
    }
    setDeleteKeyDialog(null);
  };

  return (
    <>
      {/* Browser - Full data view */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Browser"
              icon={<LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleOpenBrowser}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleOpenBrowser} className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Open Browser
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Keys Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Keys"
              icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              defaultOpen={true}
              count={keys.length}
              rightElement={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshKeys();
                      }}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loadingKeys && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh keys</TooltipContent>
                </Tooltip>
              }
            >
              {loadingKeys ? (
                <div className="ml-8 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                Object.entries(groupedKeys).map(([type, typeKeys]) => (
                  <ContextMenu key={type}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label={KEY_TYPE_LABELS[type as RedisKeyType]}
                          icon={KEY_TYPE_ICONS[type as RedisKeyType]}
                          level={2}
                          count={typeKeys.length}
                          defaultOpen={false}
                        >
                          {typeKeys.slice(0, 50).map((keyInfo) => (
                            <ContextMenu key={keyInfo.key}>
                              <ContextMenuTrigger asChild>
                                <div>
                                  <TreeItem
                                    label={keyInfo.key}
                                    icon={KEY_TYPE_ICONS[keyInfo.keyType]}
                                    level={3}
                                    onClick={() => handleKeyClick(keyInfo.key)}
                                    rightElement={
                                      keyInfo.ttl !== undefined && keyInfo.ttl > 0 ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                              <Clock className="h-3 w-3" />
                                              <span>{keyInfo.ttl}s</span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>TTL: {keyInfo.ttl} seconds</TooltipContent>
                                        </Tooltip>
                                      ) : undefined
                                    }
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48">
                                <ContextMenuItem
                                  onSelect={() => handleKeyClick(keyInfo.key)}
                                  className="gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  View Value
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onSelect={() => handleCopyKeyName(keyInfo.key)}
                                  className="gap-2"
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy Key Name
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onSelect={() => setDeleteKeyDialog(keyInfo.key)}
                                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete Key
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                          {typeKeys.length > 50 && (
                            <div className="ml-12 py-1 text-xs text-muted-foreground">
                              + {typeKeys.length - 50} more
                            </div>
                          )}
                        </TreeItem>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={handleRefreshKeys} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Refresh Keys
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
              {!loadingKeys && keys.length === 0 && (
                <div className="ml-8 py-2 text-xs text-muted-foreground">No keys found</div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleRefreshKeys} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Keys
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* CLI Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="CLI"
              icon={<Terminal className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleOpenCli}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleOpenCli} className="gap-2">
            <Terminal className="h-4 w-4" />
            Open CLI
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Server Info Section */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Server Info"
              icon={<ServerCog className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleOpenServerInfo}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handleOpenServerInfo} className="gap-2">
            <ServerCog className="h-4 w-4" />
            View Server Info
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete Key Confirmation Dialog */}
      <AlertDialog open={!!deleteKeyDialog} onOpenChange={() => setDeleteKeyDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the key "{deleteKeyDialog}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyDialog && handleDeleteKey(deleteKeyDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
