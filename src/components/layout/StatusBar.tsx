import { Database, Clock, AlertCircle, CheckCircle, Loader2, Table, FileCode, Info, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionsStore, useQueryStore, useUIStore, selectActiveConnection, selectActiveTab, selectActiveResults } from "@/stores";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState, useRef } from "react";
import { useAnime } from "@/hooks/useAnime";
import { BrandIcon } from "@/components/ui";

export function StatusBar() {
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const { isConnecting } = useConnectionsStore();
  const { isExecuting } = useQueryStore();
  const activeTab = useQueryStore(selectActiveTab);
  const activeResults = useQueryStore(selectActiveResults);
  const { pendingChanges } = useUIStore();
  const [version, setVersion] = useState<string>("");
  const { animate } = useAnime();
  const statusRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef<{ connected: boolean | undefined; isConnecting: boolean }>({
    connected: undefined,
    isConnecting: false,
  });

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  // Animate status changes
  useEffect(() => {
    const currentConnected = activeConnection?.connected;
    const prevStatus = previousStatusRef.current;

    // Only animate if the status actually changed
    if (statusRef.current &&
        (prevStatus.connected !== currentConnected || prevStatus.isConnecting !== isConnecting) &&
        prevStatus.connected !== undefined) {
      animate({
        targets: statusRef.current,
        scale: [0.95, 1],
        opacity: [0.5, 1],
        duration: 300,
        easing: "easeOutQuad",
      });
    }

    // Update the previous status
    previousStatusRef.current = {
      connected: currentConnected,
      isConnecting,
    };
  }, [activeConnection?.connected, isConnecting, animate]);

  const getConnectionStatus = () => {
    if (isConnecting) {
      return {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        text: "Connecting...",
        dotClass: "status-dot-warning",
        textClass: "text-[hsl(var(--warning))]",
      };
    }
    if (!activeConnection) {
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        text: "No connection",
        dotClass: "",
        textClass: "text-muted-foreground",
      };
    }
    if (activeConnection.connected) {
      return {
        icon: <CheckCircle className="h-3 w-3" />,
        text: "Connected",
        dotClass: "status-dot-success",
        textClass: "text-[hsl(var(--success))]",
      };
    }
    return {
      icon: <Database className="h-3 w-3" />,
      text: "Disconnected",
      dotClass: "",
      textClass: "text-muted-foreground",
    };
  };

  const getTabTypeInfo = () => {
    if (!activeTab) return null;

    switch (activeTab.type) {
      case "query":
        return { icon: <FileCode className="h-3 w-3" />, text: "Query" };
      case "table":
        return { icon: <Table className="h-3 w-3" />, text: "Table" };
      case "properties":
        return { icon: <Info className="h-3 w-3" />, text: "Properties" };
      case "diagram":
        return { icon: <Network className="h-3 w-3" />, text: "Diagram" };
      case "schema":
        return { icon: <Database className="h-3 w-3" />, text: "Schema" };
      default:
        return null;
    }
  };

  const status = getConnectionStatus();
  const tabInfo = getTabTypeInfo();

  return (
    <footer className="flex h-7 items-center justify-between border-t border-border bg-gradient-to-r from-muted/40 via-muted/20 to-muted/40 px-3 text-xs">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div ref={statusRef} className={cn("flex items-center gap-2 pr-3 border-r border-border/50", status.textClass)}>
          {status.dotClass && <span className={cn("status-dot", status.dotClass)} />}
          {!status.dotClass && status.icon}
          <span className="font-medium">{status.text}</span>
          {activeConnection && (
            <>
              <span className="text-border/70">|</span>
              <BrandIcon name={activeConnection.databaseType} className="h-3 w-3" />
              <span className="text-foreground/90 font-medium">{activeConnection.name}</span>
            </>
          )}
        </div>

        {/* Tab context */}
        {tabInfo && (
          <div className="flex items-center gap-1.5 text-muted-foreground/80 pr-3 border-r border-border/50">
            {tabInfo.icon}
            <span className="font-medium">{tabInfo.text}</span>
            {activeTab?.tableName && (
              <>
                <span className="text-border/50 mx-0.5">·</span>
                <span className="text-foreground/80 font-medium">{activeTab.tableName}</span>
              </>
            )}
          </div>
        )}

        {/* Results info */}
        {activeResults && (
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <Table className="h-3 w-3" />
            <span className="tabular-nums font-medium">{activeResults.rows.length} rows</span>
            {activeResults.executionTimeMs !== undefined && (
              <>
                <span className="text-border/50 mx-0.5">·</span>
                <Clock className="h-3 w-3" />
                <span className="tabular-nums">{activeResults.executionTimeMs}ms</span>
              </>
            )}
          </div>
        )}

        {/* Query status */}
        {isExecuting && (
          <div className="flex items-center gap-1.5 text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] px-2 py-0.5 rounded">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-medium">Executing...</span>
          </div>
        )}

        {/* Pending changes */}
        {pendingChanges.length > 0 && (
          <div className="flex items-center gap-1.5 text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] px-2 py-0.5 rounded">
            <Clock className="h-3 w-3" />
            <span className="font-medium tabular-nums">{pendingChanges.length} pending</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        <Database className="h-3 w-3" />
        <span className="font-medium">dbfordevs</span>
        <span className="text-muted-foreground/40 tabular-nums">v{version || "..."}</span>
      </div>
    </footer>
  );
}
