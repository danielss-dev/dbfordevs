import { useRef, useEffect, useState } from "react";
import {
  X,
  Sparkles,
  Settings,
  Bot,
  AlertCircle,
  Loader2,
  History,
  Plus,
} from "lucide-react";
import {
  Button,
  ScrollArea,
  Badge,
} from "@/components/ui";
import { useAIAssistant } from "@/extensions";
import { useAIStore } from "@/extensions/ai/store";
import { PROVIDER_INFO } from "@/extensions/ai/types";
import { useConnectionsStore, useQueryStore, selectActiveConnection } from "@/stores";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { AIInput } from "./AIInput";
import { AISettingsDialog } from "./AISettingsDialog";
import { ChatHistoryPanel } from "./ChatHistoryPanel";

export function AIPanel() {
  const {
    isOpen,
    isConfigured,
    isEnabled,
    isLoading,
    messages,
    close,
    sendMessage,
    context,
    updateContext,
  } = useAIAssistant();

  const {
    getCurrentProvider,
    historyPanelOpen,
    toggleHistoryPanel,
    getActiveSession,
    createNewChatSession,
  } = useAIStore();

  const activeSession = getActiveSession();

  // Get active connection and its tables
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const tablesByConnection = useQueryStore((state) => state.tablesByConnection);

  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentProvider = getCurrentProvider();
  const providerDisplayName = PROVIDER_INFO[currentProvider]?.displayName || "AI";

  // Sync tables from active connection to AI context
  useEffect(() => {
    if (activeConnection) {
      const tables = tablesByConnection[activeConnection.id] || [];
      console.log("[AIPanel] Syncing tables to context:", {
        connectionId: activeConnection.id,
        databaseType: activeConnection.databaseType,
        tableCount: tables.length,
        tables: tables.slice(0, 3), // Log first 3 for debugging
      });
      // Pass connectionId so we can fetch table schemas when @table is used
      updateContext(tables, undefined, activeConnection.databaseType, activeConnection.id);
    } else {
      console.log("[AIPanel] No active connection, clearing context");
      updateContext([], undefined, undefined, undefined);
    }
  }, [activeConnection, tablesByConnection, updateContext]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Don't show if not open or if extension is disabled
  if (!isOpen || !isEnabled) return null;

  return (
    <>
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 flex flex-col",
          "w-[420px] border-l border-border bg-background shadow-2xl",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">
                {activeSession ? activeSession.title : "AI Assistant"}
              </h2>
              {activeSession && (
                <p className="text-xs text-muted-foreground">
                  {activeSession.messages.length} messages
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleHistoryPanel}
              title="Chat History"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={createNewChatSession}
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={close}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Context indicator */}
        {context.selectedTable && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border text-xs">
            <span className="text-muted-foreground">Context:</span>
            <Badge variant="secondary" className="text-[10px] h-5">
              {context.selectedTable}
            </Badge>
            {context.databaseType && (
              <Badge variant="outline" className="text-[10px] h-5">
                {context.databaseType}
              </Badge>
            )}
          </div>
        )}

        {/* Messages area */}
        <ScrollArea className="flex-1 overflow-hidden" ref={scrollRef}>
          <div className="flex flex-col gap-6 p-4 pb-6 overflow-hidden">
            {!isConfigured && (
              <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-medium">API Key Required</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
                    Please configure your {providerDisplayName} API key to use the AI
                    Assistant.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure API Key
                </Button>
              </div>
            )}

            {isConfigured && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 text-violet-500">
                  <Bot className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-medium">Ask me anything about SQL</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
                    I can help you generate queries, explain complex SQL, and
                    suggest optimizations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {[
                    "Show all users",
                    "Find top 10 orders",
                    "Count by category",
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => sendMessage(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Thinking...
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <AIInput onSend={sendMessage} isLoading={isLoading} />
      </div>

      <AISettingsDialog open={showSettings} onOpenChange={setShowSettings} />

      {/* History Panel */}
      {historyPanelOpen && (
        <ChatHistoryPanel onClose={toggleHistoryPanel} />
      )}
    </>
  );
}

