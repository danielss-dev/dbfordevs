import { useEffect } from "react";
import {
  Server,
  Database,
  HardDrive,
  Activity,
  Globe,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useCassandra } from "@/hooks";
import { useCassandraStore } from "@/stores";

interface CassandraServerInfoProps {
  connectionId: string;
}

export function CassandraServerInfo({ connectionId }: CassandraServerInfoProps) {
  const { getServerInfo } = useCassandra();
  const { serverInfoByConnection, loading } = useCassandraStore();

  const serverInfo = serverInfoByConnection[connectionId];

  useEffect(() => {
    if (!serverInfo) {
      getServerInfo(connectionId);
    }
  }, [connectionId, serverInfo, getServerInfo]);

  const handleRefresh = () => {
    getServerInfo(connectionId);
  };

  if (!serverInfo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Loading cluster information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Database className="h-5 w-5" />
          Cluster Information
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Cluster Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Cluster
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Name</span>
              <span className="font-mono text-sm">{serverInfo.clusterName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Version</span>
              <span className="font-mono text-sm">{serverInfo.releaseVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Datacenter</span>
              <span className="font-mono text-sm">{serverInfo.datacenter}</span>
            </div>
          </CardContent>
        </Card>

        {/* Node Count */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{serverInfo.nodes.length}</div>
            <div className="flex items-center gap-2 mt-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">
                {serverInfo.nodes.filter((n) => n.isUp).length} up
              </span>
              {serverInfo.nodes.some((n) => !n.isUp) && (
                <>
                  <XCircle className="h-4 w-4 text-red-500 ml-2" />
                  <span className="text-sm text-muted-foreground">
                    {serverInfo.nodes.filter((n) => !n.isUp).length} down
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm">Connected</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Cassandra {serverInfo.releaseVersion}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nodes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Cluster Nodes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 font-medium">Address</th>
                  <th className="text-left py-2 px-4 font-medium">Datacenter</th>
                  <th className="text-left py-2 px-4 font-medium">Rack</th>
                  <th className="text-left py-2 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {serverInfo.nodes.map((node, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-4 font-mono">{node.address}</td>
                    <td className="py-2 px-4">{node.datacenter}</td>
                    <td className="py-2 px-4">{node.rack}</td>
                    <td className="py-2 px-4">
                      {node.isUp ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Up
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          Down
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
