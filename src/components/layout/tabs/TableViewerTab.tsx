import { useEffect, useCallback, useMemo, useState } from "react";
import {
  ArrowClockwise,
  FloppyDisk,
  ArrowCounterClockwise,
  Plus,
  Trash,
  CircleNotch,
  TerminalWindow,
  Play,
  TreeStructure,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { Button, GridSkeleton, Separator } from "@/components/ui";
import {
  useQueryStore,
  useCRUDStore,
  useUIStore,
  useConnectionsStore,
  useSchemaStore,
  useExplainStore,
} from "@/stores";
import { useDatabase, useCRUD } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { QueryError } from "@/components/query-editor/QueryError";
import { SqlEditor } from "@/components/editor";
import { quoteIdentifier } from "@/lib/utils";
import { useAIStore } from "@/lib/ai/store";
import { cn } from "@/lib/utils";
import type { Tab, ColumnInfo } from "@/types";

interface TableViewerTabProps {
  tab: Tab;
}

export function TableViewerTab({ tab }: TableViewerTabProps) {
  const { isExecuting, error, results } = useQueryStore();
  const { pendingChanges, clearPendingChanges, selectedRows, startCreatingRow, markSelectedForDeletion } = useCRUDStore();
  const { setRightPanelTab, theme, formatterSettings } = useUIStore();
  const { connections } = useConnectionsStore();
  const { getSchema } = useSchemaStore();
  const { executeQuery, getTableSchema, explainQuery } = useDatabase();
  const { commitChanges } = useCRUD();
  const openExplain = useExplainStore((s) => s.openExplain);
  const setExplainResult = useExplainStore((s) => s.setExplainResult);
  const setExplainError = useExplainStore((s) => s.setExplainError);
  const setPanelOpen = useAIStore((s) => s.setPanelOpen);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const isAIEnabled = useAIStore((s) => s.settings.aiEnabled ?? true);

  const tabResults = results[tab.id];
  const connectionId = tab.connectionId;
  const connection = connections.find((c) => c.id === connectionId);
  const tableName = tab.tableName || tab.title;

  const pendingCount = Object.keys(pendingChanges).length;
  const selectedCount = selectedRows.length;

  const [sqlMode, setSqlMode] = useState(false);
  const [sqlContent, setSqlContent] = useState("");

  const cachedSchema = getSchema(connectionId, tableName);

  const columns: ColumnInfo[] =
    (tabResults?.columns && tabResults.columns.length > 0)
      ? tabResults.columns
      : cachedSchema?.columns || [];

  const dataGridData = useMemo(() => {
    if (!tabResults) return null;
    if (tabResults.columns.length > 0) return tabResults;
    if (cachedSchema?.columns && cachedSchema.columns.length > 0) {
      return {
        ...tabResults,
        columns: cachedSchema.columns,
      };
    }
    return tabResults;
  }, [tabResults, cachedSchema]);

  const defaultSql = useMemo(() => {
    if (!connection) return "";
    const tableIdentifier = tab.tableName ?? tab.title;
    const quotedTable = quoteIdentifier(tableIdentifier, connection.databaseType);
    return `SELECT *\nFROM ${quotedTable}\nLIMIT 100;`;
  }, [connection, tab.tableName, tab.title]);

  useEffect(() => {
    if (sqlMode && !sqlContent) {
      setSqlContent(defaultSql);
    }
  }, [sqlMode, sqlContent, defaultSql]);

  const handleAddRow = useCallback(() => {
    if (!tableName || columns.length === 0) return;
    const columnsForCreate = cachedSchema?.columns && cachedSchema.columns.length > 0
      ? cachedSchema.columns
      : columns;
    startCreatingRow(tableName, columnsForCreate);
    setRightPanelTab("fields");
  }, [tableName, columns, cachedSchema, startCreatingRow, setRightPanelTab]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedCount === 0 || columns.length === 0) return;
    markSelectedForDeletion(tableName, columns);
  }, [selectedCount, tableName, columns, markSelectedForDeletion]);

  const loadData = useCallback(async () => {
    if (!connectionId || !connection) return;

    const tableIdentifier = tab.tableName ?? tab.title;
    const quotedTable = quoteIdentifier(tableIdentifier, connection.databaseType);

    await executeQuery(
      {
        connectionId: connectionId,
        sql: `SELECT * FROM ${quotedTable}`,
      },
      tab.id
    );
  }, [connectionId, connection, tab.tableName, tab.title, tab.id, executeQuery]);

  const handleCommit = useCallback(async () => {
    const successCount = await commitChanges();
    if (successCount && successCount > 0) {
      await loadData();
    }
  }, [commitChanges, loadData]);

  const handleRunSql = useCallback(async () => {
    if (!connectionId || !sqlContent.trim()) return;
    await executeQuery(
      {
        connectionId,
        sql: sqlContent,
      },
      tab.id
    );
  }, [connectionId, sqlContent, tab.id, executeQuery]);

  const handleExplain = useCallback(async () => {
    if (!connectionId) return;
    const sql = sqlMode && sqlContent.trim()
      ? sqlContent
      : defaultSql;
    if (!sql.trim()) return;
    openExplain(sql, connectionId, false);
    setRightPanelTab("explain");
    try {
      const result = await explainQuery({
        connectionId,
        sql,
        analyze: false,
      });
      if (result) {
        setExplainResult(result);
      } else {
        setExplainError("Failed to get execution plan");
      }
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : String(err));
    }
  }, [
    connectionId,
    sqlMode,
    sqlContent,
    defaultSql,
    openExplain,
    setRightPanelTab,
    explainQuery,
    setExplainResult,
    setExplainError,
  ]);

  const handleAI = useCallback(() => {
    if (!isAIEnabled) return;
    setRightPanelTab("ai");
    setPanelOpen(true);
    const sql = sqlMode && sqlContent.trim() ? sqlContent : defaultSql;
    if (sql.trim()) {
      sendMessage(`Help me with this table query for ${tableName}:\n\n\`\`\`sql\n${sql}\n\`\`\``);
    }
  }, [isAIEnabled, setRightPanelTab, setPanelOpen, sendMessage, sqlMode, sqlContent, defaultSql, tableName]);

  useEffect(() => {
    if (!tabResults && !isExecuting && connectionId) {
      loadData();
    }
  }, [tab.id, connectionId]);

  useEffect(() => {
    if (connectionId && tableName && !cachedSchema) {
      getTableSchema(connectionId, tableName);
    }
  }, [connectionId, tableName, cachedSchema, getTableSchema]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        if (sqlMode) {
          handleRunSql();
        } else {
          loadData();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab.id, connectionId, isExecuting, sqlMode, handleRunSql, loadData]);

  const rowMeta = tabResults
    ? `${tabResults.rows.length} rows`
    : null;
  const timeMeta =
    tabResults?.executionTimeMs !== undefined
      ? `${tabResults.executionTimeMs}ms`
      : null;

  return (
    <div className="flex h-full flex-col">
      {/* Dense toolbar ~30px */}
      <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-border px-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (sqlMode ? handleRunSql() : loadData())}
            disabled={isExecuting || !connectionId}
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {isExecuting ? (
              <CircleNotch weight="regular" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowClockwise weight="regular" className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>

          <Button
            variant={sqlMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSqlMode((v) => !v)}
            className={cn(
              "h-6 gap-1 px-1.5 text-xs",
              sqlMode
                ? "bg-[hsl(var(--sel))] text-primary hover:bg-[hsl(var(--sel-strong))]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TerminalWindow weight="regular" className="h-3.5 w-3.5" />
            SQL
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-3.5" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddRow}
            disabled={isExecuting || !connectionId || columns.length === 0}
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus weight="regular" className="h-3.5 w-3.5" />
            Add
          </Button>

          {selectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteSelected}
              className="h-6 gap-1 px-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash weight="regular" className="h-3.5 w-3.5" />
              Delete ({selectedCount})
            </Button>
          )}

          {pendingCount > 0 && (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-3.5" />
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPendingChanges}
                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowCounterClockwise weight="regular" className="h-3.5 w-3.5" />
                Discard
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleCommit}
                className="h-6 gap-1 bg-success px-2 text-xs text-success-foreground hover:bg-success/90"
              >
                <FloppyDisk weight="regular" className="h-3.5 w-3.5" />
                Commit ({pendingCount})
              </Button>
            </>
          )}

          {/* Quiet meta — not a badge farm */}
          {(rowMeta || timeMeta) && (
            <div className="ml-1.5 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
              {rowMeta && <span>{rowMeta}</span>}
              {timeMeta && (
                <span className="font-medium text-success">{timeMeta}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {isAIEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAI}
              className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkle weight="regular" className="h-3.5 w-3.5" />
              AI
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExplain}
            disabled={!connectionId}
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <TreeStructure weight="regular" className="h-3.5 w-3.5" />
            EXPLAIN
          </Button>
        </div>
      </div>

      {/* SQL mode pane — entered from toolbar, not first paint */}
      {sqlMode && (
        <div className="flex shrink-0 flex-col border-b border-border">
          <div className="flex h-7 items-center gap-1 border-b border-border/60 px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRunSql}
              disabled={isExecuting || !connectionId || !sqlContent.trim()}
              className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {isExecuting ? (
                <CircleNotch weight="regular" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play weight="regular" className="h-3.5 w-3.5" />
              )}
              Run
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExplain}
              disabled={!connectionId || !sqlContent.trim()}
              className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <TreeStructure weight="regular" className="h-3.5 w-3.5" />
              EXPLAIN
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSqlMode(false)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Close SQL mode"
            >
              <X weight="regular" className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="h-[140px]">
            <SqlEditor
              value={sqlContent}
              onChange={setSqlContent}
              onExecute={handleRunSql}
              theme={theme as "light" | "dark" | "system"}
              databaseType={connection?.databaseType}
              formatterOptions={formatterSettings}
              height="140px"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {isExecuting && !tabResults ? (
          <GridSkeleton className="h-full" />
        ) : error && !tabResults ? (
          <QueryError error={error} onRetry={loadData} />
        ) : dataGridData ? (
          <DataGrid
            data={dataGridData}
            tableName={tab.tableName || tab.title}
            connectionId={connectionId}
            onDataChange={loadData}
          />
        ) : (
          <GridSkeleton className="h-full" />
        )}
      </div>
    </div>
  );
}
