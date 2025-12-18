import { useState, useEffect } from "react";
import { X, Play, Plus, Table, Code, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ScrollArea, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useQueryStore, useConnectionsStore, selectActiveConnection, selectActiveResults } from "@/stores";
import { useDatabase } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import type { Tab } from "@/types";

function TabItem({ tab, isActive, onClose, onClick }: {
  tab: Tab;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
}) {
  const getIcon = () => {
    switch (tab.type) {
      case "query":
        return <Code className="h-3 w-3" />;
      case "table":
        return <Table className="h-3 w-3" />;
      default:
        return <Code className="h-3 w-3" />;
    }
  };

  return (
    <button
      className={cn(
        "group flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
        isActive
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      {getIcon()}
      <span className="max-w-[120px] truncate">{tab.title}</span>
      <button
        className="ml-1 rounded-sm opacity-0 hover:bg-muted group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </button>
  );
}

function EmptyState() {
  const { addTab } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);

  const handleNewQuery = () => {
    if (!activeConnection) return;
    
    addTab({
      id: crypto.randomUUID(),
      title: "New Query",
      type: "query",
      connectionId: activeConnection.id,
      content: "-- Write your SQL query here\nSELECT * FROM ",
    });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
      <Code className="mb-4 h-16 w-16 opacity-30" />
      <h2 className="mb-2 text-lg font-medium text-foreground">No tabs open</h2>
      <p className="mb-4 text-sm">
        {activeConnection
          ? "Start by opening a new query or selecting a table"
          : "Select a connection from the sidebar to get started"}
      </p>
      {activeConnection && (
        <Button onClick={handleNewQuery}>
          <Plus className="mr-2 h-4 w-4" />
          New Query
        </Button>
      )}
    </div>
  );
}

function QueryEditor({ tab }: { tab: Tab }) {
  const { updateTabContent, isExecuting, error } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const results = useQueryStore(selectActiveResults);
  const { executeQuery } = useDatabase();
  const [content, setContent] = useState(tab.content || "");

  useEffect(() => {
    setContent(tab.content || "");
  }, [tab.content]);

  const handleExecute = async () => {
    if (!activeConnection || !content.trim()) return;
    
    await executeQuery(
      {
        connectionId: activeConnection.id,
        sql: content,
        limit: undefined,
        offset: undefined,
      },
      tab.id
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="sm" 
              onClick={handleExecute}
              disabled={isExecuting || !activeConnection || !content.trim()}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-1 h-3 w-3" />
                  Run
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Execute Query (Ctrl+Enter)</TooltipContent>
        </Tooltip>
        {results && (
          <span className="text-xs text-muted-foreground">
            {results.rows.length} rows in {results.executionTimeMs}ms
          </span>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-4">
        <textarea
          className="h-full w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            updateTabContent(tab.id, e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="-- Write your SQL query here"
          spellCheck={false}
        />
      </div>

      {/* Results Area */}
      <div className="h-1/3 border-t border-border">
        <div className="flex h-8 items-center border-b border-border bg-muted/50 px-3 text-xs text-muted-foreground">
          Results
        </div>
        {error ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : results ? (
          <div className="h-full overflow-hidden">
            <DataGrid data={results} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Execute a query to see results
          </div>
        )}
      </div>
    </div>
  );
}

export function MainContent() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleNewTab = () => {
    if (!activeConnection) return;

    addTab({
      id: crypto.randomUUID(),
      title: `Query ${tabs.length + 1}`,
      type: "query",
      connectionId: activeConnection.id,
      content: "",
    });
  };

  return (
    <main className="flex h-full flex-1 flex-col bg-background">
      {/* Tab Bar */}
      <div className="flex h-10 items-center border-b border-border bg-muted/30">
        <ScrollArea className="flex-1">
          <div className="flex">
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClick={() => setActiveTab(tab.id)}
                onClose={() => removeTab(tab.id)}
              />
            ))}
          </div>
        </ScrollArea>
        {activeConnection && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleNewTab}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Tab</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          activeTab.type === "query" ? (
            <QueryEditor tab={activeTab} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Table view coming soon
            </div>
          )
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}

