import { useEffect } from "react";
import { RefreshCw, Server, Database, Clock, Plug, HardDrive, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useMongoDB } from "@/hooks";
import { useMongoDBStore } from "@/stores";

interface MongoServerInfoProps {
  connectionId: string;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "< 1m";
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value ?? "N/A"}</span>
    </div>
  );
}

export function MongoServerInfo({ connectionId }: MongoServerInfoProps) {
  const { getServerInfo, listDatabases } = useMongoDB();
  const { serverInfoByConnection, databasesByConnection, loading, loadingDatabases } = useMongoDBStore();

  const serverInfo = serverInfoByConnection[connectionId];
  const databases = databasesByConnection[connectionId] || [];

  // Load server info and databases on mount
  useEffect(() => {
    getServerInfo(connectionId);
    listDatabases(connectionId);
  }, [connectionId, getServerInfo, listDatabases]);

  const handleRefresh = () => {
    getServerInfo(connectionId);
    listDatabases(connectionId);
  };

  if (!serverInfo && loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Server Information</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh server info</TooltipContent>
        </Tooltip>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Server */}
        <InfoCard title="Server" icon={Server}>
          <InfoRow label="Version" value={serverInfo?.version} />
          <InfoRow label="Host" value={serverInfo?.host} />
          <InfoRow label="Storage Engine" value={serverInfo?.storageEngine} />
          {serverInfo?.replicaSet && (
            <InfoRow label="Replica Set" value={serverInfo.replicaSet} />
          )}
        </InfoCard>

        {/* Connections */}
        <InfoCard title="Connections" icon={Plug}>
          <InfoRow label="Current" value={serverInfo?.connectionsCurrent} />
          <InfoRow label="Available" value={serverInfo?.connectionsAvailable} />
        </InfoCard>

        {/* Uptime */}
        <InfoCard title="Uptime" icon={Clock}>
          <InfoRow
            label="Uptime"
            value={serverInfo ? formatUptime(serverInfo.uptimeSeconds) : "N/A"}
          />
          <InfoRow label="Seconds" value={serverInfo?.uptimeSeconds?.toLocaleString()} />
        </InfoCard>

        {/* Databases */}
        <InfoCard title="Databases" icon={Database}>
          {loadingDatabases ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : databases.length === 0 ? (
            <div className="py-2 text-sm text-muted-foreground">No databases</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-auto">
              {databases.map((db) => (
                <div
                  key={db.name}
                  className="flex items-center justify-between py-1 text-sm"
                >
                  <span className="truncate">{db.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {db.collectionCount} coll
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 pt-2 border-t">
            <InfoRow label="Total Databases" value={databases.length} />
          </div>
        </InfoCard>

        {/* Storage Summary */}
        <InfoCard title="Storage" icon={HardDrive}>
          <div className="space-y-1 max-h-48 overflow-auto">
            {databases.map((db) => (
              <div
                key={db.name}
                className="flex items-center justify-between py-1 text-sm"
              >
                <span className="truncate">{db.name}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {formatBytes(db.sizeBytes)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t">
            <InfoRow
              label="Total Size"
              value={formatBytes(databases.reduce((sum, db) => sum + db.sizeBytes, 0))}
            />
          </div>
        </InfoCard>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
