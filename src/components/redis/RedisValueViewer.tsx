import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Clock, HardDrive } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis } from "@/hooks";
import { useRedisStore } from "@/stores";
import type { RedisKeyInfo } from "@/types";
import { cn } from "@/lib/utils";
import { RedisStringEditor } from "./RedisStringEditor";
import { RedisListEditor } from "./RedisListEditor";
import { RedisSetEditor } from "./RedisSetEditor";
import { RedisHashEditor } from "./RedisHashEditor";
import { RedisZSetEditor } from "./RedisZSetEditor";
import { RedisStreamViewer } from "./RedisStreamViewer";

interface RedisValueViewerProps {
  connectionId: string;
  keyName: string;
}

function formatTtl(ttl: number): string {
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "Key not found";
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
  if (size === undefined) return "Unknown";
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function RedisValueViewer({ connectionId, keyName }: RedisValueViewerProps) {
  const { getKeyInfo } = useRedis();
  const [keyInfo, setKeyInfo] = useState<RedisKeyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { loadingValue } = useRedisStore();

  const loadKeyInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const info = await getKeyInfo(connectionId, keyName);
      if (info) {
        setKeyInfo(info);
      } else {
        setError("Key not found or failed to load");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load key info");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeyInfo();
  }, [connectionId, keyName]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !keyInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">{error || "Key not found"}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={loadKeyInfo}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with key info */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-medium truncate">{keyName}</h3>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded uppercase font-medium",
              keyInfo.keyType === "string" && "bg-blue-500/10 text-blue-500",
              keyInfo.keyType === "list" && "bg-green-500/10 text-green-500",
              keyInfo.keyType === "set" && "bg-purple-500/10 text-purple-500",
              keyInfo.keyType === "hash" && "bg-orange-500/10 text-orange-500",
              keyInfo.keyType === "zset" && "bg-yellow-500/10 text-yellow-500",
              keyInfo.keyType === "stream" && "bg-pink-500/10 text-pink-500",
            )}>
              {keyInfo.keyType}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              TTL: {formatTtl(keyInfo.ttl)}
            </span>
            {keyInfo.size !== undefined && (
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                Size: {formatSize(keyInfo.size)}
              </span>
            )}
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={loadKeyInfo}
              disabled={loadingValue}
            >
              <RefreshCw className={cn("h-4 w-4", loadingValue && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {/* Type-specific editor */}
      <div className="flex-1 overflow-hidden">
        {keyInfo.keyType === "string" && (
          <RedisStringEditor connectionId={connectionId} keyName={keyName} />
        )}
        {keyInfo.keyType === "list" && (
          <RedisListEditor connectionId={connectionId} keyName={keyName} />
        )}
        {keyInfo.keyType === "set" && (
          <RedisSetEditor connectionId={connectionId} keyName={keyName} />
        )}
        {keyInfo.keyType === "hash" && (
          <RedisHashEditor connectionId={connectionId} keyName={keyName} />
        )}
        {keyInfo.keyType === "zset" && (
          <RedisZSetEditor connectionId={connectionId} keyName={keyName} />
        )}
        {keyInfo.keyType === "stream" && (
          <RedisStreamViewer connectionId={connectionId} keyName={keyName} />
        )}
        {keyInfo.keyType === "unknown" && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Unknown key type</p>
          </div>
        )}
      </div>
    </div>
  );
}
