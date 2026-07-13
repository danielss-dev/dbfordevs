import { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  Type,
  List,
  CircleDot,
  Hash,
  ArrowUpDown,
  Activity,
  Trash2,
  Eye,
} from "lucide-react";
import {
  Button,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ScrollArea,
} from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisStore, useQueryStore } from "@/stores";
import type { RedisKeyInfo, RedisKeyType, Tab } from "@/types";
import { cn } from "@/lib/utils";

interface RedisBrowserProps {
  connectionId: string;
}

const KEY_TYPE_ICONS: Record<RedisKeyType, React.ReactNode> = {
  string: <Type className="h-4 w-4 text-blue-500" />,
  list: <List className="h-4 w-4 text-green-500" />,
  set: <CircleDot className="h-4 w-4 text-purple-500" />,
  hash: <Hash className="h-4 w-4 text-orange-500" />,
  zset: <ArrowUpDown className="h-4 w-4 text-yellow-500" />,
  stream: <Activity className="h-4 w-4 text-pink-500" />,
  unknown: <Hash className="h-4 w-4 text-muted-foreground" />,
};

const KEY_TYPE_COLORS: Record<RedisKeyType, string> = {
  string: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  list: "bg-green-500/10 text-green-600 dark:text-green-400",
  set: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  hash: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  zset: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  stream: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  unknown: "bg-muted text-muted-foreground",
};

function formatTtl(ttl: number): string {
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "Expired";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  if (ttl < 86400) {
    const hours = Math.floor(ttl / 3600);
    const mins = Math.floor((ttl % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  const days = Math.floor(ttl / 86400);
  const hours = Math.floor((ttl % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function formatSize(size: number | undefined): string {
  if (size === undefined) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

interface KeyRowProps {
  keyInfo: RedisKeyInfo;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onDelete: () => void;
  preview?: string;
}

function KeyRow({ keyInfo, isSelected, onSelect, onView, onDelete, preview }: KeyRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-2 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors",
        isSelected && "bg-primary/5"
      )}
      onClick={onSelect}
      onDoubleClick={onView}
    >
      {/* Type Icon */}
      <div className="shrink-0">
        {KEY_TYPE_ICONS[keyInfo.keyType]}
      </div>

      {/* Key Name */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm truncate">{keyInfo.key}</div>
        {preview && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {preview}
          </div>
        )}
      </div>

      {/* Type Badge */}
      <div className={cn(
        "shrink-0 px-2 py-0.5 rounded text-xs font-medium",
        KEY_TYPE_COLORS[keyInfo.keyType]
      )}>
        {keyInfo.keyType}
      </div>

      {/* TTL */}
      <div className="shrink-0 w-24 text-xs text-muted-foreground text-right">
        {keyInfo.ttl !== undefined && (
          <span className={cn(keyInfo.ttl > 0 && keyInfo.ttl < 60 && "text-warning")}>
            {formatTtl(keyInfo.ttl)}
          </span>
        )}
      </div>

      {/* Size */}
      <div className="shrink-0 w-20 text-xs text-muted-foreground text-right">
        {formatSize(keyInfo.size)}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onView(); }}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>View value</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete key</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function RedisBrowser({ connectionId }: RedisBrowserProps) {
  const { scanKeys, deleteKey, getString } = useRedis();
  const { toast } = useToast();
  const { addTab, tabs, setActiveTab } = useQueryStore();
  const [pattern, setPattern] = useState("*");
  const [searchInput, setSearchInput] = useState("*");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<RedisKeyType | "all">("all");

  const {
    keysByConnection,
    scanCursorByConnection,
    loadingKeys,
  } = useRedisStore();

  const allKeys = keysByConnection[connectionId] || [];
  const cursor = scanCursorByConnection[connectionId] || 0;
  const hasMore = cursor !== 0;

  // Filter keys by type
  const keys = useMemo(() => {
    if (typeFilter === "all") return allKeys;
    return allKeys.filter(k => k.keyType === typeFilter);
  }, [allKeys, typeFilter]);

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allKeys.length };
    allKeys.forEach(k => {
      counts[k.keyType] = (counts[k.keyType] || 0) + 1;
    });
    return counts;
  }, [allKeys]);

  // Load keys on mount
  useEffect(() => {
    scanKeys(connectionId, pattern, 100, 0, false);
  }, [connectionId]);

  // Load string previews
  useEffect(() => {
    const loadPreviews = async () => {
      const stringKeys = keys.filter(k => k.keyType === "string").slice(0, 50);
      const newPreviews: Record<string, string> = {};

      for (const keyInfo of stringKeys) {
        if (!previews[keyInfo.key]) {
          try {
            const result = await getString(connectionId, keyInfo.key);
            if (result) {
              const value = result.value;
              newPreviews[keyInfo.key] = value.length > 100 ? value.substring(0, 100) + "..." : value;
            }
          } catch {
            // Ignore preview errors
          }
        }
      }

      if (Object.keys(newPreviews).length > 0) {
        setPreviews(prev => ({ ...prev, ...newPreviews }));
      }
    };

    loadPreviews();
  }, [keys, connectionId]);

  const handleSearch = () => {
    setPattern(searchInput);
    scanKeys(connectionId, searchInput, 100, 0, false);
  };

  const handleLoadMore = () => {
    if (hasMore) {
      scanKeys(connectionId, pattern, 100, cursor, true);
    }
  };

  const handleRefresh = () => {
    setPreviews({});
    scanKeys(connectionId, pattern, 100, 0, false);
  };

  const handleViewKey = (key: string) => {
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

  const handleDeleteKey = async (key: string) => {
    try {
      const success = await deleteKey(connectionId, key);
      if (success) {
        toast({
          title: "Key deleted",
          description: `Key "${key}" has been deleted.`,
        });
        // Remove from previews
        setPreviews(prev => {
          const newPreviews = { ...prev };
          delete newPreviews[key];
          return newPreviews;
        });
      }
    } catch (error) {
      toast({
        title: "Error deleting key",
        description: error instanceof Error ? error.message : "Failed to delete key",
        variant: "destructive",
      });
    }
  };

  const typeOptions: { value: RedisKeyType | "all"; label: string; icon?: React.ReactNode }[] = [
    { value: "all", label: "All Types" },
    { value: "string", label: "Strings", icon: KEY_TYPE_ICONS.string },
    { value: "list", label: "Lists", icon: KEY_TYPE_ICONS.list },
    { value: "set", label: "Sets", icon: KEY_TYPE_ICONS.set },
    { value: "hash", label: "Hashes", icon: KEY_TYPE_ICONS.hash },
    { value: "zset", label: "Sorted Sets", icon: KEY_TYPE_ICONS.zset },
    { value: "stream", label: "Streams", icon: KEY_TYPE_ICONS.stream },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search pattern (e.g., user:*, cache:*)"
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch}>
            Search
          </Button>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 border rounded-md p-1">
          {typeOptions.map(opt => (
            <Tooltip key={opt.value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 gap-1",
                    typeFilter === opt.value && "bg-muted"
                  )}
                  onClick={() => setTypeFilter(opt.value)}
                >
                  {opt.icon}
                  {opt.value === "all" ? "All" : null}
                  {typeCounts[opt.value] !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {typeCounts[opt.value] || 0}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{opt.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Refresh */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4", loadingKeys && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
        <div className="w-4"></div>
        <div className="flex-1">Key</div>
        <div className="w-16 text-center">Type</div>
        <div className="w-24 text-right">TTL</div>
        <div className="w-20 text-right">Size</div>
        <div className="w-16"></div>
      </div>

      {/* Keys List */}
      <ScrollArea className="flex-1">
        {loadingKeys && keys.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Hash className="h-12 w-12 mb-4 opacity-20" />
            <p>No keys found</p>
            <p className="text-xs mt-1">Try a different search pattern</p>
          </div>
        ) : (
          <>
            {keys.map((keyInfo) => (
              <KeyRow
                key={keyInfo.key}
                keyInfo={keyInfo}
                isSelected={selectedKey === keyInfo.key}
                onSelect={() => setSelectedKey(keyInfo.key)}
                onView={() => handleViewKey(keyInfo.key)}
                onDelete={() => handleDeleteKey(keyInfo.key)}
                preview={previews[keyInfo.key]}
              />
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingKeys}>
                  {loadingKeys ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          {keys.length} keys{typeFilter !== "all" && ` (filtered from ${allKeys.length})`}
          {hasMore && " • More available"}
        </span>
        <span>Pattern: {pattern}</span>
      </div>
    </div>
  );
}
