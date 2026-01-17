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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis } from "@/hooks";
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
  const { scanKeys, getServerInfo } = useRedis();
  const { addTab, tabs, setActiveTab } = useQueryStore();
  const { keysByConnection, loadingKeys } = useRedisStore();

  const keys = keysByConnection[connectionId] || [];

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

  return (
    <>
      {/* Browser - Full data view */}
      <TreeItem
        label="Browser"
        icon={<LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />}
        level={1}
        onClick={handleOpenBrowser}
      />

      {/* Keys Section */}
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
            <TreeItem
              key={type}
              label={KEY_TYPE_LABELS[type as RedisKeyType]}
              icon={KEY_TYPE_ICONS[type as RedisKeyType]}
              level={2}
              count={typeKeys.length}
              defaultOpen={false}
            >
              {typeKeys.slice(0, 50).map((keyInfo) => (
                <TreeItem
                  key={keyInfo.key}
                  label={keyInfo.key}
                  icon={KEY_TYPE_ICONS[keyInfo.keyType]}
                  level={3}
                  onClick={() => handleKeyClick(keyInfo.key)}
                />
              ))}
              {typeKeys.length > 50 && (
                <div className="ml-12 py-1 text-xs text-muted-foreground">
                  + {typeKeys.length - 50} more
                </div>
              )}
            </TreeItem>
          ))
        )}
        {!loadingKeys && keys.length === 0 && (
          <div className="ml-8 py-2 text-xs text-muted-foreground">No keys found</div>
        )}
      </TreeItem>

      {/* CLI Section */}
      <TreeItem
        label="CLI"
        icon={<Terminal className="h-3.5 w-3.5 text-muted-foreground" />}
        level={1}
        onClick={handleOpenCli}
      />

      {/* Server Info Section */}
      <TreeItem
        label="Server Info"
        icon={<ServerCog className="h-3.5 w-3.5 text-muted-foreground" />}
        level={1}
        onClick={handleOpenServerInfo}
      />
    </>
  );
}
