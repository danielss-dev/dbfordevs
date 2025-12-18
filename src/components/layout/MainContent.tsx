import { useState, useEffect } from "react";
import { X, Play, Plus, Table, Code, Loader2, AlertCircle, Terminal, Rows3, RefreshCw } from "lucide-react";
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
        return <Code className="h-3.5 w-3.5" />;
      case "table":
        return <Table className="h-3.5 w-3.5" />;
      default:
        return <Code className="h-3.5 w-3.5" />;
    }
  };

  return (
    <button
      className={cn(
        "group relative flex items-center gap-2 px-4 py-2.5 text-sm transition-all duration-200 border-r border-border/50",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/80 rounded-full blur-[0.5px]" />
      )}
      <span className={cn(
        "transition-colors",
        isActive ? "text-primary/90" : "text-muted-foreground group-hover:text-foreground"
      )}>
        {getIcon()}
      </span>
      <span className="max-w-[120px] truncate font-medium">{tab.title}</span>
      <button
        className={cn(
          "ml-1 rounded-md p-0.5 transition-all duration-200",
          "opacity-0 group-hover:opacity-100",
          "hover:bg-muted-foreground/20"
        )}
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
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground animate-fade-in">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl" />
        <div className="relative bg-muted/50 p-6 rounded-2xl border border-border">
          <Terminal className="h-12 w-12 text-muted-foreground/50" />
        </div>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">No tabs open</h2>
      <p className="mb-6 text-sm max-w-sm text-center">
        {activeConnection
          ? "Start by opening a new query or selecting a table from the sidebar"
          : "Select a connection from the sidebar to get started"}
      </p>
      {activeConnection && (
        <Button onClick={handleNewQuery} size="lg">
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

  // Handle F5 refresh (re-run query)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        handleExecute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, activeConnection, isExecuting]);

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
    // Tab key handling for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newContent = content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);
      updateTabContent(tab.id, newContent);
      // Set cursor position after the tab
      setTimeout(() => {
        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting || !activeConnection || !content.trim()}
              className="gap-2"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Run Query
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Execute Query (Cmd+Enter)</TooltipContent>
        </Tooltip>

        {results && (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge badge-success">
              <Rows3 className="h-3 w-3 mr-1" />
              {results.rows.length} rows
            </span>
            <span className="text-muted-foreground">
              in {results.executionTimeMs}ms
            </span>
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-4 bg-background">
        <div className="relative h-full rounded-lg border border-border bg-card overflow-hidden">
          {/* Line numbers gutter (visual) */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-muted/30 border-r border-border flex flex-col items-end pt-3 pr-2 text-xs text-muted-foreground/50 font-mono select-none overflow-hidden">
            {content.split('\n').map((_, i) => (
              <div key={i} className="leading-6">{i + 1}</div>
            ))}
          </div>
          <textarea
            className={cn(
              "h-full w-full resize-none bg-transparent pl-14 pr-4 py-3 font-mono text-sm leading-6",
              "focus:outline-none",
              "placeholder:text-muted-foreground/50"
            )}
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
      </div>

      {/* Results Area */}
      <div className="h-2/5 min-h-[200px] border-t border-border flex flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
          <Table className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Results</span>
          {results && (
            <span className="text-xs text-muted-foreground">
              ({results.rows.length} rows)
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="flex h-full items-center justify-center gap-3 p-4">
              <div className="flex items-center gap-3 text-destructive bg-destructive/10 px-4 py-3 rounded-lg border border-destructive/20">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          ) : results ? (
            <DataGrid data={results} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Terminal className="h-8 w-8 mb-2 opacity-30" />
              <span className="text-sm">Execute a query to see results</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TableViewer({ tab }: { tab: Tab }) {
  const { isExecuting, error, results } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const { executeQuery } = useDatabase();
  const tabResults = results[tab.id];

  const loadData = async () => {
    if (!activeConnection || !tab.title) return;
    
    // In a real app, we'd handle schema names too
    await executeQuery(
      {
        connectionId: activeConnection.id,
        sql: `SELECT * FROM ${tab.title}`,
        limit: 100, // Default limit for table view
      },
      tab.id
    );
  };

  useEffect(() => {
    if (!tabResults && !isExecuting) {
      loadData();
    }
  }, [tab.id, activeConnection?.id]);

  // Handle F5 refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only refresh if this tab is active
      if (e.key === "F5") {
        e.preventDefault();
        loadData();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab.id, activeConnection?.id, isExecuting]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isExecuting || !activeConnection}
          className="gap-2"
        >
          {isExecuting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>

        {tabResults && (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge badge-success">
              <Rows3 className="h-3 w-3 mr-1" />
              {tabResults.rows.length} rows
            </span>
            <span className="text-muted-foreground">
              in {tabResults.executionTimeMs}ms
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {error && !tabResults ? (
          <div className="flex h-full items-center justify-center gap-3 p-4">
            <div className="flex items-center gap-3 text-destructive bg-destructive/10 px-4 py-3 rounded-lg border border-destructive/20">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        ) : tabResults ? (
          <DataGrid data={tabResults} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-30" />
            <span className="text-sm">Loading table data...</span>
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
      <div className="flex h-11 items-center border-b border-border bg-card/50">
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
          <div className="flex items-center px-2 border-l border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNewTab}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Tab</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          activeTab.type === "query" ? (
            <QueryEditor tab={activeTab} />
          ) : activeTab.type === "table" ? (
            <TableViewer tab={activeTab} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Table className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Schema view coming soon</p>
              </div>
            </div>
          )
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}
