import {
  CircleNotch,
  WarningCircle,
  CheckCircle,
  Database,
  Table,
  FileCode,
  Info,
  TreeStructure,
} from "@phosphor-icons/react";
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

  useEffect(() => {
    const currentConnected = activeConnection?.connected;
    const prevStatus = previousStatusRef.current;

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

    previousStatusRef.current = {
      connected: currentConnected,
      isConnecting,
    };
  }, [activeConnection?.connected, isConnecting, animate]);

  const getConnectionStatus = () => {
    if (isConnecting) {
      return {
        icon: <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />,
        text: "Connecting…",
        dotClass: "status-dot-warning",
        textClass: "text-muted-foreground",
      };
    }
    if (!activeConnection) {
      return {
        icon: <WarningCircle weight="regular" className="h-3 w-3" />,
        text: "No connection",
        dotClass: "",
        textClass: "text-muted-foreground",
      };
    }
    if (activeConnection.connected) {
      return {
        icon: <CheckCircle weight="regular" className="h-3 w-3" />,
        text: "Connected",
        dotClass: "status-dot-success",
        textClass: "text-muted-foreground",
      };
    }
    return {
      icon: <Database weight="regular" className="h-3 w-3" />,
      text: "Disconnected",
      dotClass: "",
      textClass: "text-muted-foreground",
    };
  };

  const getTabTypeInfo = () => {
    if (!activeTab) return null;

    switch (activeTab.type) {
      case "query":
        return { icon: <FileCode weight="regular" className="h-3 w-3" />, text: "Query" };
      case "table":
        return { icon: <Table weight="regular" className="h-3 w-3" />, text: "Table" };
      case "properties":
        return { icon: <Info weight="regular" className="h-3 w-3" />, text: "Properties" };
      case "diagram":
        return { icon: <TreeStructure weight="regular" className="h-3 w-3" />, text: "Diagram" };
      case "schema":
        return { icon: <Database weight="regular" className="h-3 w-3" />, text: "Schema" };
      default:
        return null;
    }
  };

  const status = getConnectionStatus();
  const tabInfo = getTabTypeInfo();

  return (
    <footer className="flex h-6 items-center justify-between border-t border-border bg-[hsl(var(--sidebar-background))] px-2.5 text-[11px] tabular-nums text-muted-foreground">
      <div className="flex items-center gap-2.5 min-w-0">
        <div ref={statusRef} className={cn("flex items-center gap-1.5", status.textClass)}>
          {status.dotClass ? (
            <span className={cn("status-dot", status.dotClass)} />
          ) : (
            status.icon
          )}
          <span>{status.text}</span>
          {activeConnection && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <BrandIcon name={activeConnection.databaseType} className="h-3 w-3" />
              <span className="truncate text-foreground/80">{activeConnection.name}</span>
            </>
          )}
        </div>

        {tabInfo && (
          <div className="hidden items-center gap-1 sm:flex text-muted-foreground/70">
            <span className="text-muted-foreground/30">·</span>
            {tabInfo.icon}
            <span>{tabInfo.text}</span>
            {activeTab?.tableName && (
              <span className="text-foreground/70">{activeTab.tableName}</span>
            )}
          </div>
        )}

        {activeResults && (
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <span className="text-muted-foreground/30">·</span>
            <span>
              Showing {activeResults.rows.length > 0 ? `1–${activeResults.rows.length}` : "0"} of{" "}
              {activeResults.rows.length}
            </span>
            {activeResults.executionTimeMs !== undefined && (
              <span className="text-success font-medium">{activeResults.executionTimeMs}ms</span>
            )}
          </div>
        )}

        {isExecuting && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />
            <span>Executing…</span>
          </div>
        )}

        {pendingChanges.length > 0 && (
          <div className="flex items-center gap-1 text-warning">
            <span>{pendingChanges.length} pending</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-muted-foreground/50 shrink-0">
        <span>Hybrid · Instrument + Calm</span>
        <span className="text-muted-foreground/30">·</span>
        <span>v{version || "…"}</span>
      </div>
    </footer>
  );
}
