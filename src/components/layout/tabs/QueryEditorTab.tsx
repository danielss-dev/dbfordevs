import { useState, useEffect, useCallback, useRef } from "react";
import { Play, CircleNotch, Table, TerminalWindow, ArrowClockwise, Eye, TreeStructure } from "@phosphor-icons/react";
import { Button, SplitButton, Tooltip, TooltipTrigger, TooltipContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, GridSkeleton } from "@/components/ui";
import {
  useQueryStore,
  useConnectionsStore,
  selectActiveConnection,
  selectActiveResults,
  useSchemaStore,
  usePreviewStore,
  useExplainStore,
  useViewsStore,
  useProceduresStore,
  useFunctionsStore,
} from "@/stores";
import { useUIStore } from "@/stores/ui";
import { useAIStore } from "@/lib/ai/store";
import { useDatabase } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { SqlEditor, type SqlEditorHandle } from "@/components/editor";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import { RowCountBadge } from "@/components/ui/row-count-badge";
import { EmptyQueryState } from "@/components/query-editor/EmptyQueryState";
import { QueryError } from "@/components/query-editor/QueryError";
import { QueryHistoryDropdown } from "@/components/query-history/QueryHistoryDropdown";
import { BookmarksDropdown } from "@/components/bookmarks";
import { BrandIcon } from "@/components/ui";
import { getDatabaseBrand } from "@/lib/constants";
import type { Tab, QueryHistoryEntry } from "@/types";

interface QueryEditorTabProps {
  tab: Tab;
}

export function QueryEditorTab({ tab: tabProp }: QueryEditorTabProps) {
  const tabs = useQueryStore(state => state.tabs);
  const updateTabContent = useQueryStore(state => state.updateTabContent);
  const isExecuting = useQueryStore(state => state.isExecuting);
  const error = useQueryStore(state => state.error);
  const tablesByConnection = useQueryStore(state => state.tablesByConnection);
  const addQueryToHistory = useQueryStore(state => state.addQueryToHistory);
  const updateTab = useQueryStore(state => state.updateTab);
  const pendingBookmarkQuery = useQueryStore(state => state.pendingBookmarkQuery);
  const setPendingBookmarkQuery = useQueryStore(state => state.setPendingBookmarkQuery);
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const connections = useConnectionsStore(state => state.connections);
  const getSchemas = useSchemaStore(state => state.getSchemas);
  const viewsByConnection = useViewsStore(state => state.viewsByConnection);
  const proceduresByConnection = useProceduresStore(state => state.proceduresByConnection);
  const functionsByConnection = useFunctionsStore(state => state.functionsByConnection);

  // Get the latest tab from store to ensure we have the most up-to-date connectionId
  const tab = tabs.find(t => t.id === tabProp.id) || tabProp;
  const connectionId = tab.connectionId || activeConnection?.id;
  const tables = connectionId ? tablesByConnection[connectionId] || [] : [];
  const schemas = connectionId ? getSchemas(connectionId) : {};
  const views = connectionId ? viewsByConnection[connectionId] || [] : [];
  const procedures = connectionId ? proceduresByConnection[connectionId] || [] : [];
  const functions = connectionId ? functionsByConnection[connectionId] || [] : [];
  const results = useQueryStore(selectActiveResults);
  const theme = useUIStore(state => state.theme);
  const formatterSettings = useUIStore(state => state.formatterSettings);
  const openSaveBookmarkDialog = useUIStore(state => state.openSaveBookmarkDialog);
  const setPanelOpen = useAIStore(state => state.setPanelOpen);
  const sendMessage = useAIStore(state => state.sendMessage);
  const settings = useAIStore(state => state.settings);
  const isAIEnabled = settings.aiEnabled ?? true;
  const { executeQuery, fetchAllSchemas, refreshSchemas, previewQuery, explainQuery } = useDatabase();
  const openPreview = usePreviewStore(state => state.openPreview);
  const setPreviewResult = usePreviewStore(state => state.setPreviewResult);
  const openExplain = useExplainStore(state => state.openExplain);
  const setExplainResult = useExplainStore(state => state.setExplainResult);
  const setExplainError = useExplainStore(state => state.setExplainError);
  const [content, setContent] = useState(tab.content || "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sqlEditorRef = useRef<SqlEditorHandle>(null);

  // Get the current connection for database type
  const currentConnection = connections.find(c => c.id === connectionId);
  const databaseType = currentConnection?.databaseType;

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

  // Save as bookmark handler
  const handleSaveAsBookmark = useCallback((sql: string) => {
    if (sql.trim()) {
      openSaveBookmarkDialog(sql, connectionId || null);
    }
  }, [connectionId, openSaveBookmarkDialog]);

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

  // Auto-execute pending bookmark query
  useEffect(() => {
    if (pendingBookmarkQuery && pendingBookmarkQuery.tabId === tab.id) {
      setPendingBookmarkQuery(null);
      setContent(pendingBookmarkQuery.sql);
      handleExecuteRef.current(pendingBookmarkQuery.sql);
    }
  }, [pendingBookmarkQuery, tab.id, setPendingBookmarkQuery]);

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
      {/* SQL toolbar */}
      <div className="flex h-[30px] items-center gap-2 border-b border-border px-2">
        <SplitButton
          size="sm"
          onPrimaryClick={() => handleExecute()}
          disabled={isExecuting || !connectionId || !content.trim()}
          className="gap-1.5 h-6 text-xs"
          dropdownItems={[
            {
              label: "Preview Changes",
              icon: <Eye weight="regular" className="h-3.5 w-3.5" />,
              onClick: handlePreview,
              disabled: isExecuting || !connectionId || !content.trim(),
            },
            {
              label: "Explain Plan",
              icon: <TreeStructure weight="regular" className="h-3.5 w-3.5" />,
              onClick: () => handleExplain(false),
              disabled: isExecuting || !connectionId || !content.trim(),
            },
            {
              label: "Explain Analyze",
              icon: <TreeStructure weight="regular" className="h-3.5 w-3.5" />,
              onClick: () => handleExplain(true),
              disabled: isExecuting || !connectionId || !content.trim(),
            },
          ]}
        >
          {isExecuting ? (
            <>
              <CircleNotch weight="regular" className="h-3.5 w-3.5 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play weight="regular" className="h-3.5 w-3.5" />
              Run
            </>
          )}
        </SplitButton>

        <Select value={connectionId || ""} onValueChange={handleConnectionChange}>
          <SelectTrigger className="h-6 w-[180px] text-[11px]">
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
                    <span className="ml-auto w-2 h-2 rounded-full bg-success" />
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

        {/* Spacer to push toolbar icons to the right */}
        <div className="flex-1" />

        {connectionId && (
          <QueryHistoryDropdown
            connectionId={connectionId}
            onLoadQuery={handleSelectExample}
          />
        )}

        <BookmarksDropdown
          connectionId={connectionId || null}
          databaseType={databaseType}
          currentSql={content}
          onLoadBookmark={handleSelectExample}
        />

        {connectionId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                onClick={handleRefreshSchemas}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                {isRefreshing ? (
                  <CircleNotch weight="regular" className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowClockwise weight="regular" className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Schema</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-background overflow-hidden">
        <SqlEditor
          ref={sqlEditorRef}
          value={content}
          onChange={(value) => {
            setContent(value);
            updateTabContent(tab.id, value);
          }}
          onExecute={handleExecute}
          onExplainWithAI={isAIEnabled ? handleExplainWithAI : undefined}
          onOptimizeWithAI={isAIEnabled ? handleOptimizeWithAI : undefined}
          onSaveAsBookmark={handleSaveAsBookmark}
          tables={tables}
          schemas={schemas}
          views={views}
          procedures={procedures}
          functions={functions}
          theme={theme}
          databaseType={databaseType}
          formatterOptions={formatterSettings}
          height="100%"
        />
      </div>

      {/* Results Area */}
      <div className="h-2/5 min-h-[200px] border-t border-border flex flex-col">
        <div className="flex h-7 items-center gap-1.5 border-b border-border px-2">
          <Table weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Results</span>
          {results && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {results.rows.length} rows
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {isExecuting ? (
            <GridSkeleton className="h-full" />
          ) : error ? (
            <QueryError error={error} onRetry={() => handleExecute()} />
          ) : results ? (
            <DataGrid data={results} connectionId={connectionId} />
          ) : !content.trim() ? (
            <EmptyQueryState
              onSelectExample={handleSelectExample}
              databaseType={activeConnection?.databaseType}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <TerminalWindow weight="regular" className="h-6 w-6 mb-2 opacity-30" />
              <span className="text-xs">Execute a query to see results</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
