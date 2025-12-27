import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Loader2, Table, Terminal, AlertCircle, RefreshCw } from "lucide-react";
import { Button, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import { useQueryStore, useConnectionsStore, selectActiveConnection, selectActiveResults, useSchemaStore } from "@/stores";
import { useUIStore } from "@/stores/ui";
import { useAIStore } from "@/extensions/ai/store";
import { useThemeStore } from "@/extensions/themes/store";
import { useDatabase } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { SqlEditor } from "@/components/editor";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import { RowCountBadge } from "@/components/ui/row-count-badge";
import { EmptyQueryState } from "@/components/query-editor/EmptyQueryState";
import { QueryHistoryDropdown } from "@/components/query-history/QueryHistoryDropdown";
import type { Tab, QueryHistoryEntry } from "@/types";

interface QueryEditorTabProps {
  tab: Tab;
}

export function QueryEditorTab({ tab }: QueryEditorTabProps) {
  const { updateTabContent, isExecuting, error, tablesByConnection, addQueryToHistory } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const { getSchemas } = useSchemaStore();
  const connectionId = tab.connectionId || activeConnection?.id;
  const tables = connectionId ? tablesByConnection[connectionId] || [] : [];
  const schemas = connectionId ? getSchemas(connectionId) : {};
  const results = useQueryStore(selectActiveResults);
  const { theme } = useUIStore();
  const { getTheme } = useThemeStore();
  const { setPanelOpen, sendMessage, settings } = useAIStore();
  const isAIEnabled = settings.aiEnabled ?? true;
  const { executeQuery, fetchAllSchemas, refreshSchemas } = useDatabase();
  const [content, setContent] = useState(tab.content || "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Get theme variant for extension themes
  const themeVariant = theme.startsWith("ext:")
    ? getTheme(theme.slice(4))?.variant
    : undefined;

  // Fetch all schemas when connection changes
  useEffect(() => {
    if (connectionId) {
      fetchAllSchemas(connectionId);
    }
  }, [connectionId, fetchAllSchemas]);

  // Handle schema refresh
  const handleRefreshSchemas = useCallback(async () => {
    if (!connectionId) return;
    setIsRefreshing(true);
    try {
      await refreshSchemas(connectionId);
    } finally {
      setIsRefreshing(false);
    }
  }, [connectionId, refreshSchemas]);

  // AI context menu handlers
  const handleExplainWithAI = useCallback((sql: string) => {
    if (!isAIEnabled) return;
    setPanelOpen(true);
    // Send message to AI to explain the query
    sendMessage(`Please explain this SQL query:\n\n\`\`\`sql\n${sql}\n\`\`\``);
  }, [isAIEnabled, setPanelOpen, sendMessage]);

  const handleOptimizeWithAI = useCallback((sql: string) => {
    if (!isAIEnabled) return;
    setPanelOpen(true);
    // Send message to AI to optimize the query
    sendMessage(`Please optimize this SQL query for better performance:\n\n\`\`\`sql\n${sql}\n\`\`\``);
  }, [isAIEnabled, setPanelOpen, sendMessage]);

  useEffect(() => {
    setContent(tab.content || "");
  }, [tab.content]);

  const handleExecute = async (sql?: string) => {
    const queryToExecute = sql || content;
    if (!connectionId || !queryToExecute.trim()) return;

    const startTime = Date.now();
    const result = await executeQuery(
      {
        connectionId: connectionId,
        sql: queryToExecute,
        limit: undefined,
        offset: undefined,
      },
      tab.id
    );

    // Save query to history
    const historyEntry: QueryHistoryEntry = {
      id: `${connectionId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      connectionId,
      sql: queryToExecute,
      executedAt: startTime,
      executionTimeMs: result?.executionTimeMs,
      rowCount: result?.rows?.length ?? result?.affectedRows,
      success: result !== null,
      error: result === null ? useQueryStore.getState().error ?? undefined : undefined,
    };

    addQueryToHistory(historyEntry);
  };

  // Keep handleExecute in a ref for use in event listeners
  const handleExecuteRef = useRef(handleExecute);
  useEffect(() => {
    handleExecuteRef.current = handleExecute;
  }, [handleExecute]);

  // Handle F5 refresh (re-run query)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        handleExecuteRef.current?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectExample = (sql: string) => {
    setContent(sql);
    updateTabContent(tab.id, sql);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <Tooltip open={activeTooltip === "run"}>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={() => handleExecute()}
              disabled={isExecuting || !connectionId || !content.trim()}
              className="gap-2"
              onMouseEnter={() => setActiveTooltip("run")}
              onMouseLeave={() => setActiveTooltip(null)}
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
            <RowCountBadge rowCount={results.rows.length} affectedRows={results.affectedRows} />
            <ExecutionTimeBadge timeMs={results.executionTimeMs} />
          </div>
        )}

        {connectionId && (
          <QueryHistoryDropdown
            connectionId={connectionId}
            onLoadQuery={handleSelectExample}
            activeTooltip={activeTooltip}
            onSetActiveTooltip={setActiveTooltip}
          />
        )}

        {connectionId && (
          <Tooltip open={activeTooltip === "refresh"}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshSchemas}
                disabled={isRefreshing}
                className="gap-2"
                onMouseEnter={() => setActiveTooltip("refresh")}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh Schema
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh table schemas from database</TooltipContent>
          </Tooltip>
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
          onExplainWithAI={isAIEnabled ? handleExplainWithAI : undefined}
          onOptimizeWithAI={isAIEnabled ? handleOptimizeWithAI : undefined}
          tables={tables}
          schemas={schemas}
          theme={theme}
          themeVariant={themeVariant}
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
          ) : !content.trim() ? (
            <EmptyQueryState
              onSelectExample={handleSelectExample}
              databaseType={activeConnection?.databaseType}
            />
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
