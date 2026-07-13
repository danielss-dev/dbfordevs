import { useState, useEffect } from "react";
import {
  Server,
  Cpu,
  HardDrive,
  Clock,
  Users,
  Activity,
  Database,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis } from "@/hooks";
import type { RedisServerInfo as RedisServerInfoType, RedisMemoryStats } from "@/types";
import { cn } from "@/lib/utils";

interface RedisServerInfoProps {
  connectionId: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  warning?: boolean;
}

function StatCard({ icon, label, value, subValue, warning }: StatCardProps) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-lg border bg-card",
      warning && "border-warning/50"
    )}>
      <div className={cn(
        "p-2 rounded-lg",
        warning ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
      )}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toString();
}

export function RedisServerInfo({ connectionId }: RedisServerInfoProps) {
  const { getServerInfo, getMemoryStats } = useRedis();
  const [serverInfo, setServerInfo] = useState<RedisServerInfoType | null>(null);
  const [memoryStats, setMemoryStats] = useState<RedisMemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [info, memory] = await Promise.all([
        getServerInfo(connectionId),
        getMemoryStats(connectionId),
      ]);
      setServerInfo(info);
      setMemoryStats(memory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load server info");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, [connectionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !serverInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2 text-warning" />
        <p className="text-sm">{error || "Failed to load server info"}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={loadInfo}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const totalKeys = Object.values(serverInfo.keyspace).reduce(
    (sum, db) => sum + db.keys,
    0
  );

  const highMemory = memoryStats && memoryStats.maxmemory > 0
    ? memoryStats.usedMemory / memoryStats.maxmemory > 0.9
    : false;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">Server Info</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={loadInfo}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Server Section */}
        <div>
          <h3 className="text-sm font-medium mb-3">Server</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Server className="h-4 w-4" />}
              label="Redis Version"
              value={serverInfo.version}
              subValue={serverInfo.mode}
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Uptime"
              value={formatUptime(serverInfo.uptimeSeconds)}
            />
            <StatCard
              icon={<Cpu className="h-4 w-4" />}
              label="Role"
              value={serverInfo.role.charAt(0).toUpperCase() + serverInfo.role.slice(1)}
            />
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="OS"
              value={serverInfo.os.split(" ")[0] || "Unknown"}
              subValue={serverInfo.os}
            />
          </div>
        </div>

        {/* Memory Section */}
        <div>
          <h3 className="text-sm font-medium mb-3">Memory</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<HardDrive className="h-4 w-4" />}
              label="Used Memory"
              value={memoryStats?.usedMemoryHuman || serverInfo.usedMemoryHuman}
              subValue={`Peak: ${memoryStats?.usedMemoryPeakHuman || serverInfo.usedMemoryPeakHuman}`}
              warning={highMemory}
            />
            {memoryStats && memoryStats.maxmemory > 0 && (
              <StatCard
                icon={<HardDrive className="h-4 w-4" />}
                label="Max Memory"
                value={`${(memoryStats.maxmemory / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                subValue={`Policy: ${memoryStats.maxmemoryPolicy}`}
              />
            )}
            {memoryStats && (
              <StatCard
                icon={<Activity className="h-4 w-4" />}
                label="Fragmentation Ratio"
                value={memoryStats.memFragmentationRatio.toFixed(2)}
                subValue={memoryStats.memAllocator}
                warning={memoryStats.memFragmentationRatio > 1.5}
              />
            )}
          </div>
        </div>

        {/* Clients Section */}
        <div>
          <h3 className="text-sm font-medium mb-3">Clients</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Connected Clients"
              value={serverInfo.connectedClients}
            />
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Total Connections"
              value={formatNumber(serverInfo.totalConnectionsReceived)}
            />
          </div>
        </div>

        {/* Stats Section */}
        <div>
          <h3 className="text-sm font-medium mb-3">Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Commands Processed"
              value={formatNumber(serverInfo.totalCommandsProcessed)}
            />
            <StatCard
              icon={<Database className="h-4 w-4" />}
              label="Total Keys"
              value={formatNumber(totalKeys)}
            />
          </div>
        </div>

        {/* Keyspace Section */}
        {Object.keys(serverInfo.keyspace).length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Keyspace</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Database</th>
                    <th className="text-right px-3 py-2 font-medium">Keys</th>
                    <th className="text-right px-3 py-2 font-medium">Expires</th>
                    <th className="text-right px-3 py-2 font-medium">Avg TTL</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(serverInfo.keyspace).map(([db, info]) => (
                    <tr key={db} className="border-t">
                      <td className="px-3 py-2">{db}</td>
                      <td className="text-right px-3 py-2">{formatNumber(info.keys)}</td>
                      <td className="text-right px-3 py-2">{formatNumber(info.expires)}</td>
                      <td className="text-right px-3 py-2 text-muted-foreground">
                        {info.avgTtl !== undefined ? `${info.avgTtl}ms` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
