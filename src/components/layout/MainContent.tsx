import { useState, useEffect } from "react";
import { X, Play, Plus, Table, Code, Loader2, AlertCircle, Terminal, Rows3, RefreshCw, Info, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ScrollArea, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useQueryStore, useConnectionsStore, selectActiveConnection, selectActiveResults } from "@/stores";
import { useUIStore } from "@/stores/ui";
import { useDatabase } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { SqlEditor } from "@/components/editor";
import { TablePropertiesTab, TableDiagramTab } from "@/components/table";
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
      case "properties":
        return <Info className="h-3.5 w-3.5" />;
      case "diagram":
        return <Network className="h-3.5 w-3.5" />;
      default:
        return <Code className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex items-center gap-2 px-4 py-2.5 text-sm transition-all duration-200 border-r border-border/50 cursor-pointer outline-none focus-visible:bg-muted/50",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
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
    </div>
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
  const { updateTabContent, isExecuting, error, tablesByConnection } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const connectionId = tab.connectionId || activeConnection?.id;
  const tables = connectionId ? tablesByConnection[connectionId] || [] : [];
  const results = useQueryStore(selectActiveResults);
  const { theme } = useUIStore();
  const { executeQuery, getTableSchema } = useDatabase();
  const [content, setContent] = useState(tab.content || "");

  // Create a schema fetcher for the SQL editor
  const fetchTableSchema = async (tableName: string) => {
    if (!connectionId) return null;
    return getTableSchema(connectionId, tableName);
  };

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
  }, [content, connectionId, isExecuting]);

  useEffect(() => {
    setContent(tab.content || "");
  }, [tab.content]);

  const handleExecute = async () => {
    if (!connectionId || !content.trim()) return;

    await executeQuery(
      {
        connectionId: connectionId,
        sql: content,
        limit: undefined,
        offset: undefined,
      },
      tab.id
    );
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
              disabled={isExecuting || !connectionId || !content.trim()}
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
              {results.affectedRows !== undefined && results.affectedRows !== null ? (
                <>{results.affectedRows} rows affected</>
              ) : (
                <>{results.rows.length} rows</>
              )}
            </span>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-[hsl(var(--success)/0.05)] border border-[hsl(var(--success)/0.1)] text-[10px] font-mono text-[hsl(var(--success))] font-bold uppercase tracking-wider">
              <div className="h-1 w-1 rounded-full bg-[hsl(var(--success))]" />
              <span className="tabular-nums">{results.executionTimeMs}ms</span>
            </div>
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-background overflow-hidden">
        <SqlEditor
          value={content}
          onChange={(value) => {
            setContent(value);
            updateTabContent(tab.id, value);
          }}
          onExecute={handleExecute}
          tables={tables}
          getTableSchema={fetchTableSchema}
          theme={theme}
          height="100%"
        />
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
  const { executeQuery } = useDatabase();
  const tabResults = results[tab.id];
  const connectionId = tab.connectionId;

  const loadData = async () => {
    if (!connectionId) return;
    
    const tableIdentifier = tab.tableName ?? tab.title;
    
    await executeQuery(
      {
        connectionId: connectionId,
        sql: `SELECT * FROM ${tableIdentifier}`,
        limit: 100, // Default limit for table view
      },
      tab.id
    );
  };

  useEffect(() => {
    if (!tabResults && !isExecuting && connectionId) {
      loadData();
    }
  }, [tab.id, connectionId]);

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
  }, [tab.id, connectionId, isExecuting]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isExecuting || !connectionId}
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
              {tabResults.affectedRows !== undefined && tabResults.affectedRows !== null ? (
                <>{tabResults.affectedRows} rows affected</>
              ) : (
                <>{tabResults.rows.length} rows</>
              )}
            </span>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-[hsl(var(--success)/0.05)] border border-[hsl(var(--success)/0.1)] text-[10px] font-mono text-[hsl(var(--success))] font-bold uppercase tracking-wider">
              <div className="h-1 w-1 rounded-full bg-[hsl(var(--success))]" />
              <span className="tabular-nums">{tabResults.executionTimeMs}ms</span>
            </div>
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
          ) : activeTab.type === "properties" ? (
            <TablePropertiesTab tab={activeTab} />
          ) : activeTab.type === "diagram" ? (
            <TableDiagramTab tab={activeTab} />
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
