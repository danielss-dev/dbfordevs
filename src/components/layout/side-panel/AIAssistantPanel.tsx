import { useState, useEffect, useRef } from "react";
import { AlertCircle, Loader2, Sparkles, Settings, Bot, History, Plus, Coins } from "lucide-react";
import {
  Button,
  ScrollArea,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { useQueryStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { useAIStore } from "@/lib/ai/store";
import { useAIAssistant } from "@/lib/ai/hooks";
import { PROVIDER_INFO } from "@/lib/ai/types";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { AIInput } from "@/components/ai/AIInput";
import { AISettingsDialog } from "@/components/ai/AISettingsDialog";
import { ChatHistoryPanel } from "@/components/ai/ChatHistoryPanel";

// AI Assistant Panel
export function AIAssistantPanel() {
  const {
    isConfigured,
    isEnabled,
    isLoading,
    isStreaming,
    messages,
    usageStats,
    sendMessage,
    context,
    updateContext,
  } = useAIAssistant();

  const {
    getCurrentProvider,
    historyPanelOpen,
    setHistoryPanelOpen,
    toggleHistoryPanel,
    getActiveSession,
    createNewChatSession,
  } = useAIStore();

  const activeSession = getActiveSession();

  // Get active connection and its tables
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const tablesByConnection = useQueryStore((state) => state.tablesByConnection);
  const tabs = useQueryStore((state) => state.tabs);
  const activeTabId = useQueryStore((state) => state.activeTabId);

  // Get current query from active tab
  const activeTab = tabs.find(t => t.id === activeTabId);
  const currentQuery = activeTab?.type === "query" ? activeTab.content : undefined;

  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentProvider = getCurrentProvider();
  const providerDisplayName = PROVIDER_INFO[currentProvider]?.displayName || "AI";

  // Sync tables and current query from active connection to AI context
  useEffect(() => {
    if (activeConnection) {
      const tables = tablesByConnection[activeConnection.id] || [];
      updateContext(tables, undefined, activeConnection.databaseType, activeConnection.id, currentQuery);
    } else {
      updateContext([], undefined, undefined, undefined, undefined);
    }
  }, [activeConnection, tablesByConnection, currentQuery, updateContext]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isStreaming]);

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
          <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-elev-1">
            <Sparkles className="h-10 w-10 text-muted-foreground/30" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground/60 mb-2">AI Disabled</p>
        <p className="text-xs text-muted-foreground/60 max-w-[200px]">
          Enable AI in settings to use the assistant
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* Header Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          {activeSession && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {activeSession.title}
            </span>
          )}
          {usageStats && usageStats.totalTokens > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-[10px] text-primary">
                  <Coins className="h-3 w-3" />
                  {usageStats.totalTokens >= 1000
                    ? `${(usageStats.totalTokens / 1000).toFixed(1)}k`
                    : usageStats.totalTokens}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <div>Input: {usageStats.totalPromptTokens.toLocaleString()} tokens</div>
                  <div>Output: {usageStats.totalCompletionTokens.toLocaleString()} tokens</div>
                  <div className="font-semibold">Est. cost: ${usageStats.estimatedCost.toFixed(4)}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleHistoryPanel} title="Chat History">
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(true)} title="Settings">
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={createNewChatSession} title="New Chat">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Context indicator */}
      {context.selectedTable && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b border-border text-xs shrink-0">
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
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 p-3 pb-4 overflow-hidden">
          {!isConfigured && (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-medium text-sm">API Key Required</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                  Configure your {providerDisplayName} API key to use the AI Assistant.
                </p>
              </div>
              <Button variant="default" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Configure
              </Button>
            </div>
          )}

          {isConfigured && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Ask me about SQL</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                  Generate queries, explain SQL, or get optimization tips.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {["Show all users", "Count by category"].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-6 px-2"
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

          {isLoading && !isStreaming && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <Loader2 className="h-3 w-3 text-primary-foreground animate-spin" />
              </div>
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <AIInput onSend={sendMessage} isLoading={isLoading} />

      {/* History Panel */}
      <ChatHistoryPanel open={historyPanelOpen} onOpenChange={setHistoryPanelOpen} />

      {/* Settings Dialog */}
      <AISettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
