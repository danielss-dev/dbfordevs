import { Database, Clock, AlertCircle, CheckCircle, Loader2, Sparkles, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionsStore, useQueryStore, useUIStore, selectActiveConnection } from "@/stores";
import { useExtensionStore } from "@/extensions";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState, useRef } from "react";
import { useAnime } from "@/hooks/useAnime";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";

export function StatusBar() {
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const { isConnecting } = useConnectionsStore();
  const { isExecuting } = useQueryStore();
  const { pendingChanges } = useUIStore();
  const { toggleAIPanel, aiPanelOpen, isEnabled } = useExtensionStore();
  const { setShowMarketplace } = useUIStore();
  const isAIEnabled = isEnabled("ai-assistant");
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

  const status = getConnectionStatus();

  return (
    <footer className="flex h-7 items-center justify-between border-t border-border bg-muted/30 px-3 text-xs">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div ref={statusRef} className={cn("flex items-center gap-2", status.textClass)}>
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
        {/* AI Assistant button */}
        {isAIEnabled ? (
          <button
            onClick={toggleAIPanel}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all",
              "hover:bg-violet-500/10 group",
              aiPanelOpen && "bg-violet-500/10 text-violet-500"
            )}
            title="Toggle AI Assistant (Cmd+Shift+A)"
          >
            <Sparkles className={cn(
              "h-3 w-3 transition-colors",
              aiPanelOpen ? "text-violet-500" : "text-muted-foreground group-hover:text-violet-500"
            )} />
            <span className={cn(
              "font-medium transition-colors",
              aiPanelOpen ? "text-violet-500" : "text-muted-foreground group-hover:text-violet-500"
            )}>
              AI
            </span>
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowMarketplace(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all hover:bg-muted group"
                title="Install AI Assistant extension"
              >
                <Sparkles className="h-3 w-3 text-muted-foreground/50" />
                <span className="font-medium text-muted-foreground/50">AI</span>
                <Download className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Install AI Assistant extension</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* App info */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Database className="h-3 w-3" />
          <span className="font-medium">dbfordevs</span>
          <span className="text-muted-foreground/50">v{version || "..."}</span>
        </div>
      </div>
    </footer>
  );
}
