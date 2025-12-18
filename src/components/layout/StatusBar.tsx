import { Database, Clock, AlertCircle, CheckCircle, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionsStore, useQueryStore, useUIStore, selectActiveConnection } from "@/stores";

export function StatusBar() {
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const { isConnecting } = useConnectionsStore();
  const { isExecuting } = useQueryStore();
  const { pendingChanges } = useUIStore();

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

  const status = getConnectionStatus();

  return (
    <footer className="flex h-7 items-center justify-between border-t border-border bg-muted/30 px-3 text-xs">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className={cn("flex items-center gap-2", status.textClass)}>
          {status.dotClass && <span className={cn("status-dot", status.dotClass)} />}
          {!status.dotClass && status.icon}
          <span className="font-medium">{status.text}</span>
          {activeConnection && (
            <>
              <span className="text-border">|</span>
              <span className="text-foreground font-medium">{activeConnection.name}</span>
            </>
          )}
        </div>

        {/* Query status */}
        {isExecuting && (
          <div className="flex items-center gap-2 text-[hsl(var(--warning))]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-medium">Executing...</span>
          </div>
        )}

        {/* Pending changes */}
        {pendingChanges.length > 0 && (
          <div className="flex items-center gap-2 text-[hsl(var(--warning))]">
            <Clock className="h-3 w-3" />
            <span className="font-medium">{pendingChanges.length} pending</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* App info */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span className="font-medium">dbfordevs</span>
          <span className="text-muted-foreground/50">v0.1.0</span>
        </div>
      </div>
    </footer>
  );
}
