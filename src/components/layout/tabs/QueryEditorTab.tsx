import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Loader2, Table, Terminal, AlertCircle, RefreshCw, Eye, TreeDeciduous } from "lucide-react";
import { Button, SplitButton, Tooltip, TooltipTrigger, TooltipContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { useQueryStore, useConnectionsStore, selectActiveConnection, selectActiveResults, useSchemaStore, usePreviewStore, useExplainStore } from "@/stores";
import { useUIStore } from "@/stores/ui";
import { useAIStore } from "@/lib/ai/store";
import { useDatabase } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { SqlEditor } from "@/components/editor";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import { RowCountBadge } from "@/components/ui/row-count-badge";
import { EmptyQueryState } from "@/components/query-editor/EmptyQueryState";
import { QueryHistoryDropdown } from "@/components/query-history/QueryHistoryDropdown";
import { BrandIcon } from "@/components/ui";
import { getDatabaseBrand } from "@/lib/constants";
import type { Tab, QueryHistoryEntry } from "@/types";

interface QueryEditorTabProps {
  tab: Tab;
}

export function QueryEditorTab({ tab: tabProp }: QueryEditorTabProps) {
  const { tabs, updateTabContent, isExecuting, error, tablesByConnection, addQueryToHistory, updateTab } = useQueryStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const { connections } = useConnectionsStore();
  const { getSchemas } = useSchemaStore();

  // Get the latest tab from store to ensure we have the most up-to-date connectionId
  const tab = tabs.find(t => t.id === tabProp.id) || tabProp;
  const connectionId = tab.connectionId || activeConnection?.id;
  const tables = connectionId ? tablesByConnection[connectionId] || [] : [];
  const schemas = connectionId ? getSchemas(connectionId) : {};
  const results = useQueryStore(selectActiveResults);
  const { theme } = useUIStore();
  const { setPanelOpen, sendMessage, settings } = useAIStore();
  const isAIEnabled = settings.aiEnabled ?? true;
  const { executeQuery, fetchAllSchemas, refreshSchemas, previewQuery, explainQuery } = useDatabase();
  const { openPreview, setPreviewResult } = usePreviewStore();
  const { openExplain, setExplainResult, setExplainError } = useExplainStore();
  const [content, setContent] = useState(tab.content || "");
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleExecute = async (sql?: string, overrideConnectionId?: string) => {
    const queryToExecute = sql || content;
    const targetConnectionId = overrideConnectionId || connectionId;
    if (!targetConnectionId || !queryToExecute.trim()) return;

    const startTime = Date.now();
    const result = await executeQuery(
      {
        connectionId: targetConnectionId,
        sql: queryToExecute,
        limit: undefined,
        offset: undefined,
      },
      tab.id
    );

    // Save query to history
    const historyEntry: QueryHistoryEntry = {
      id: `${targetConnectionId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      connectionId: targetConnectionId,
      sql: queryToExecute,
      executedAt: startTime,
      executionTimeMs: result?.executionTimeMs,
      rowCount: result?.rows?.length ?? result?.affectedRows,
      success: result !== null,
      error: result === null ? useQueryStore.getState().error ?? undefined : undefined,
    };

    addQueryToHistory(historyEntry);
  };

  const handlePreview = useCallback(async () => {
    if (!connectionId || !content.trim()) return;

    const currentSql = content;
    openPreview(currentSql, connectionId);
    
    try {
      const result = await previewQuery({
        connectionId,
        sql: currentSql,
      });

      // Verify that this preview result is still relevant
      // The user might have started a new preview request in the meantime
      const { previewSql, isPreviewOpen } = usePreviewStore.getState();
      if (!isPreviewOpen || previewSql !== currentSql) {
        return;
      }

      if (result) {
        setPreviewResult(result);
      } else {
        // If previewQuery returned null, there was an error
        // Ensure we capture the most recent error from the store
        const storeError = useQueryStore.getState().error;
        setPreviewResult({
          statements: [],
          executionTimeMs: 0,
          success: false,
          error: storeError || "Failed to preview query",
        });
      }
    } catch (error) {
      // In case of unexpected errors, ensure we don't leave the preview in loading state
      const { previewSql, isPreviewOpen } = usePreviewStore.getState();
      if (isPreviewOpen && previewSql === currentSql) {
        setPreviewResult({
          statements: [],
          executionTimeMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [connectionId, content, openPreview, previewQuery, setPreviewResult]);

  const handleExplain = useCallback(async (analyze = false) => {
    if (!connectionId || !content.trim()) return;

    const currentSql = content;
    openExplain(currentSql, connectionId, analyze);

    try {
      const result = await explainQuery({
        connectionId,
        sql: currentSql,
        analyze,
      });

      // Verify that this explain result is still relevant
      const { explainSql, isExplainOpen } = useExplainStore.getState();
      if (!isExplainOpen || explainSql !== currentSql) {
        return;
      }

      if (result) {
        setExplainResult(result);
      } else {
        setExplainError("Failed to get execution plan");
      }
    } catch (error) {
      const { explainSql, isExplainOpen } = useExplainStore.getState();
      if (isExplainOpen && explainSql === currentSql) {
        setExplainError(error instanceof Error ? error.message : String(error));
      }
    }
  }, [connectionId, content, openExplain, explainQuery, setExplainResult, setExplainError]);

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

  const handleConnectionChange = (newConnectionId: string) => {
    updateTab(tab.id, { connectionId: newConnectionId });
    // Clear results when switching connections to avoid showing stale data
    const { clearResults } = useQueryStore.getState();
    clearResults(tab.id);
    // Fetch schemas for the new connection
    fetchAllSchemas(newConnectionId);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2">
        <SplitButton
          size="sm"
          onPrimaryClick={() => handleExecute()}
          disabled={isExecuting || !connectionId || !content.trim()}
          className="gap-2"
          dropdownItems={[
            {
              label: "Preview Changes",
              icon: <Eye className="h-3.5 w-3.5" />,
              onClick: handlePreview,
              disabled: isExecuting || !connectionId || !content.trim(),
            },
            {
              label: "Explain Plan",
              icon: <TreeDeciduous className="h-3.5 w-3.5" />,
              onClick: () => handleExplain(false),
              disabled: isExecuting || !connectionId || !content.trim(),
            },
            {
              label: "Explain Analyze",
              icon: <TreeDeciduous className="h-3.5 w-3.5" />,
              onClick: () => handleExplain(true),
              disabled: isExecuting || !connectionId || !content.trim(),
            },
          ]}
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
        </SplitButton>

        {/* Connection Selector */}
        <Select value={connectionId || ""} onValueChange={handleConnectionChange}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="Select connection" />
          </SelectTrigger>
          <SelectContent>
            {connections.map((connection) => (
              <SelectItem key={connection.id} value={connection.id}>
                <div className="flex items-center gap-2">
                  <BrandIcon
                    name={getDatabaseBrand(connection.databaseType)}
                    className="h-3.5 w-3.5"
                  />
                  <span>{connection.name}</span>
                  {connection.connected && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-[hsl(var(--success))]" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
          />
        )}

        {connectionId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshSchemas}
                disabled={isRefreshing}
                className="gap-2"
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
            <DataGrid data={results} connectionId={connectionId} />
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
