import { Database, Clock, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
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
        color: "text-yellow-500",
      };
    }
    if (!activeConnection) {
      return {
        icon: <AlertCircle className="h-3 w-3" />,
        text: "No connection",
        color: "text-muted-foreground",
      };
    }
    if (activeConnection.connected) {
      return {
        icon: <CheckCircle className="h-3 w-3" />,
        text: "Connected",
        color: "text-green-500",
      };
    }
    return {
      icon: <Database className="h-3 w-3" />,
      text: "Disconnected",
      color: "text-muted-foreground",
    };
  };

  const status = getConnectionStatus();

  return (
    <footer className="flex h-6 items-center justify-between border-t border-border bg-muted/30 px-3 text-xs">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className={cn("flex items-center gap-1.5", status.color)}>
          {status.icon}
          <span>{status.text}</span>
          {activeConnection && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-foreground">{activeConnection.name}</span>
            </>
          )}
        </div>

        {/* Query status */}
        {isExecuting && (
          <div className="flex items-center gap-1.5 text-yellow-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Executing...</span>
          </div>
        )}

        {/* Pending changes */}
        {pendingChanges.length > 0 && (
          <div className="flex items-center gap-1.5 text-orange-500">
            <Clock className="h-3 w-3" />
            <span>{pendingChanges.length} pending change(s)</span>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Version */}
        <span className="text-muted-foreground">v0.1.0</span>
      </div>
    </footer>
  );
}

