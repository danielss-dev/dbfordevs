import { useState, useEffect, useCallback } from "react";
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
  MoreHorizontal,
  Trash2,
  Clock,
  ChevronRight,
  ChevronDown,
  Plus,
} from "lucide-react";
import {
  Button,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisStore } from "@/stores";
import type { RedisKeyInfo, RedisKeyType } from "@/types";
import { cn } from "@/lib/utils";

interface RedisKeyListProps {
  connectionId: string;
  onKeySelect: (key: string) => void;
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

const KEY_TYPE_LABELS: Record<RedisKeyType, string> = {
  string: "Strings",
  list: "Lists",
  set: "Sets",
  hash: "Hashes",
  zset: "Sorted Sets",
  stream: "Streams",
  unknown: "Unknown",
};

function formatTtl(ttl: number): string {
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "Key not found";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
  return `${Math.floor(ttl / 86400)}d`;
}

function formatSize(size: number | undefined): string {
  if (size === undefined) return "";
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export function RedisKeyList({ connectionId, onKeySelect }: RedisKeyListProps) {
  const { scanKeys, deleteKey, setTtl } = useRedis();
  const { toast } = useToast();
  const [pattern, setPattern] = useState("*");
  const [expandedTypes, setExpandedTypes] = useState<Set<RedisKeyType>>(new Set(["string", "list", "set", "hash", "zset", "stream"]));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const {
    keysByConnection,
    scanCursorByConnection,
    loadingKeys,
    error,
  } = useRedisStore();

  const keys = keysByConnection[connectionId] || [];
  const cursor = scanCursorByConnection[connectionId] || 0;
  const hasMore = cursor !== 0;

  // Group keys by type
  const groupedKeys = keys.reduce<Record<RedisKeyType, RedisKeyInfo[]>>(
    (acc, key) => {
      const type = key.keyType || "unknown";
      if (!acc[type]) acc[type] = [];
      acc[type].push(key);
      return acc;
    },
    {} as Record<RedisKeyType, RedisKeyInfo[]>
  );

  const loadKeys = useCallback(async (append = false) => {
    await scanKeys(connectionId, pattern, 100, append ? cursor : 0, append);
  }, [connectionId, pattern, cursor, scanKeys]);

  useEffect(() => {
    loadKeys(false);
  }, [connectionId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadKeys(false);
  };

  const handleKeyClick = (key: string) => {
    setSelectedKey(key);
    onKeySelect(key);
  };

  const toggleType = (type: RedisKeyType) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const handleDeleteKey = async (key: string) => {
    const success = await deleteKey(connectionId, key);
    if (success) {
      toast({
        title: "Key deleted",
        description: `Key "${key}" has been deleted.`,
      });
    }
  };

  const handleSetTtl = async (key: string, ttlSeconds: number) => {
    const success = await setTtl(connectionId, key, ttlSeconds);
    if (success) {
      toast({
        title: "TTL updated",
        description: ttlSeconds < 0
          ? `Expiry removed from key "${key}".`
          : `TTL set to ${formatTtl(ttlSeconds)} for key "${key}".`,
      });
      loadKeys(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b space-y-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Pattern (e.g., user:*)"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="flex-1 h-8"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={loadingKeys}
              >
                {loadingKeys ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search keys</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => loadKeys(false)}
                disabled={loadingKeys}
              >
                <RefreshCw className={cn("h-4 w-4", loadingKeys && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </form>

        {error && (
          <div className="text-xs text-destructive">{error}</div>
        )}

        <div className="text-xs text-muted-foreground">
          {keys.length} keys loaded{hasMore && " (more available)"}
        </div>
      </div>

      {/* Keys grouped by type */}
      <div className="flex-1 overflow-auto">
        {Object.entries(groupedKeys).map(([type, typeKeys]) => (
          <div key={type} className="border-b last:border-b-0">
            <button
              onClick={() => toggleType(type as RedisKeyType)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {expandedTypes.has(type as RedisKeyType) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {KEY_TYPE_ICONS[type as RedisKeyType]}
              <span className="flex-1 text-left">{KEY_TYPE_LABELS[type as RedisKeyType]}</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {typeKeys.length}
              </span>
            </button>

            {expandedTypes.has(type as RedisKeyType) && (
              <div className="pl-6">
                {typeKeys.map((keyInfo) => (
                  <div
                    key={keyInfo.key}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer",
                      selectedKey === keyInfo.key
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleKeyClick(keyInfo.key)}
                  >
                    <span className="flex-1 truncate font-mono text-xs">
                      {keyInfo.key}
                    </span>

                    {keyInfo.ttl > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTtl(keyInfo.ttl)}
                      </span>
                    )}

                    {keyInfo.size !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {formatSize(keyInfo.size)}
                      </span>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetTtl(keyInfo.key, 3600);
                          }}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Set TTL (1h)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetTtl(keyInfo.key, -1);
                          }}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Remove TTL
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKey(keyInfo.key);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {keys.length === 0 && !loadingKeys && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Hash className="h-8 w-8 mb-2" />
            <p className="text-sm">No keys found</p>
            <p className="text-xs">Try a different pattern</p>
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="p-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => loadKeys(true)}
            disabled={loadingKeys}
          >
            {loadingKeys ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
