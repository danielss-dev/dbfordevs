import { useState, useCallback } from "react";
import { Save, Trash2, RotateCcw, Code, GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useCRUDStore, useQueryStore, useConnectionsStore, useSchemaStore } from "@/stores";
import { useRedisChangesStore } from "@/stores/redis-changes";
import { useCRUD, useDatabase } from "@/hooks";
import { useRedisCRUD } from "@/hooks/useRedisCRUD";
import { DiffViewer } from "@/components/data-grid/DiffViewer";
import { selectActiveTab } from "./shared";

// Helper to quote a table identifier (handles schema.table format)
function quoteTableIdentifier(tableName: string, databaseType: string): string {
  const parts = tableName.split('.');
  const quotePart = (part: string) => {
    if (databaseType === 'mysql' || databaseType === 'mariadb') {
      return `\`${part.replace(/`/g, '``')}\``;
    } else if (databaseType === 'mssql') {
      return `[${part.replace(/]/g, ']]')}]`;
    }
    return `"${part.replace(/"/g, '""')}"`;
  };
  return parts.map(quotePart).join('.');
}

// Helper function to format SQL values for preview
function formatSqlPreviewValue(val: unknown): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'number') {
    return String(val);
  }
  if (typeof val === 'string') {
    return `'${val.replace(/'/g, "''")}'`;
  }
  if (typeof val === 'object') {
    // Handle JSON objects - stringify and escape quotes
    try {
      const jsonStr = JSON.stringify(val);
      return `'${jsonStr.replace(/'/g, "''")}'`;
    } catch {
      return "'[Object]'";
    }
  }
  return `'${String(val)}'`;
}

// Helper function to format WHERE conditions for preview
function formatWhereCondition(key: string, val: unknown): React.ReactNode {
  if (val === null || val === undefined) {
    return (
      <>
        {key} <span className="text-info">IS</span> <span className="text-warning">NULL</span>
      </>
    );
  }
  return (
    <>
      {key} = <span className="text-warning">{formatSqlPreviewValue(val)}</span>
    </>
  );
}

// Helper to get actual primary key from schema
function useActualPrimaryKey() {
  const { getSchema } = useSchemaStore();
  const activeTab = useQueryStore(selectActiveTab);
  const connectionId = activeTab?.connectionId;

  return useCallback((change: { tableName: string; primaryKey: Record<string, unknown>; originalData?: Record<string, unknown> | null }) => {
    if (!connectionId) return change.primaryKey;

    const cachedSchema = getSchema(connectionId, change.tableName);
    if (!cachedSchema?.columns || !change.originalData) {
      return change.primaryKey;
    }

    // Build set of primary key column names from schema
    const pkSet = new Set(cachedSchema.primaryKeys || []);
    cachedSchema.columns.forEach(col => {
      if (col.isPrimaryKey) pkSet.add(col.name);
    });

    // If schema has primary key info, recalculate from original data
    if (pkSet.size > 0) {
      const actualPK: Record<string, unknown> = {};
      pkSet.forEach(colName => {
        actualPK[colName] = change.originalData![colName];
      });
      return actualPK;
    }

    return change.primaryKey;
  }, [connectionId, getSchema]);
}

// Helper to format a Redis operation as a command preview string
function formatRedisCommandPreview(op: import("@/types").RedisOperation, key: string): React.ReactNode {
  const q = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

  switch (op.op) {
    case "SET":
      return (
        <>
          <span className="text-info">SET</span> <span className="text-warning">{q(key)}</span> <span className="text-success">{q(op.value)}</span>
        </>
      );
    case "HSET":
      return (
        <>
          <span className="text-info">HSET</span> <span className="text-warning">{q(key)}</span> {q(op.field)} <span className="text-success">{q(op.value)}</span>
        </>
      );
    case "HDEL":
      return (
        <>
          <span className="text-destructive">HDEL</span> <span className="text-warning">{q(key)}</span> {q(op.field)}
        </>
      );
    case "SADD":
      return (
        <>
          <span className="text-info">SADD</span> <span className="text-warning">{q(key)}</span> <span className="text-success">{q(op.member)}</span>
        </>
      );
    case "SREM":
      return (
        <>
          <span className="text-destructive">SREM</span> <span className="text-warning">{q(key)}</span> {q(op.member)}
        </>
      );
    case "ZADD":
      return (
        <>
          <span className="text-info">ZADD</span> <span className="text-warning">{q(key)}</span> {op.score} <span className="text-success">{q(op.member)}</span>
        </>
      );
    case "ZREM":
      return (
        <>
          <span className="text-destructive">ZREM</span> <span className="text-warning">{q(key)}</span> {q(op.member)}
        </>
      );
    case "LSET":
      return (
        <>
          <span className="text-info">LSET</span> <span className="text-warning">{q(key)}</span> {op.index} <span className="text-success">{q(op.value)}</span>
        </>
      );
    case "RPUSH":
      return (
        <>
          <span className="text-info">RPUSH</span> <span className="text-warning">{q(key)}</span> <span className="text-success">{q(op.value)}</span>
        </>
      );
    case "LPUSH":
      return (
        <>
          <span className="text-info">LPUSH</span> <span className="text-warning">{q(key)}</span> <span className="text-success">{q(op.value)}</span>
        </>
      );
    case "LREM":
      return (
        <>
          <span className="text-destructive">LREM</span> <span className="text-warning">{q(key)}</span> 1 {q(op.value)}
        </>
      );
  }
}

// Changes Preview Panel
export function ChangesPreviewPanel() {
  const {
    pendingChanges,
    removePendingChange,
    clearPendingChanges,
  } = useCRUDStore();
  const { commitChanges } = useCRUD();
  const { executeQuery } = useDatabase();
  const activeTab = useQueryStore(selectActiveTab);
  const { connections } = useConnectionsStore();
  const [viewMode, setViewMode] = useState<"sql" | "diff">("sql");
  const getActualPrimaryKey = useActualPrimaryKey();

  // Redis changes
  const redisPendingChanges = useRedisChangesStore((state) => state.pendingChanges);
  const removeRedisChange = useRedisChangesStore((state) => state.removeChange);
  const clearRedisChanges = useRedisChangesStore((state) => state.clearChanges);
  const { commitRedisChanges } = useRedisCRUD();

  const pendingChangesList = Object.values(pendingChanges);
  const totalChangesCount = pendingChangesList.length + redisPendingChanges.length;

  // Get connection info for quoting identifiers
  const connection = activeTab?.connectionId
    ? connections.find(c => c.id === activeTab.connectionId)
    : null;

  // Commit and refresh data
  const handleCommit = useCallback(async () => {
    // Commit SQL changes
    if (pendingChangesList.length > 0) {
      const successCount = await commitChanges();
      if (successCount && successCount > 0 && activeTab?.connectionId && connection) {
        const tableName = activeTab.tableName || activeTab.title;
        if (tableName) {
          const quotedTable = quoteTableIdentifier(tableName, connection.databaseType);
          await executeQuery(
            {
              connectionId: activeTab.connectionId,
              sql: `SELECT * FROM ${quotedTable}`,
            },
            activeTab.id
          );
        }
      }
    }

    // Commit Redis changes
    if (redisPendingChanges.length > 0) {
      await commitRedisChanges();
    }
  }, [commitChanges, activeTab, connection, executeQuery, redisPendingChanges.length, commitRedisChanges, pendingChangesList.length]);

  // Clear all changes (SQL + Redis)
  const handleClearAll = useCallback(() => {
    clearPendingChanges();
    clearRedisChanges();
  }, [clearPendingChanges, clearRedisChanges]);

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle */}
      {totalChangesCount > 0 && (
        <div className="px-4 py-2 border-b border-border bg-muted/20 shrink-0">
          <div className="flex bg-muted rounded-md p-1 border border-border w-fit">
            <Button
              variant={viewMode === "sql" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-[11px] gap-1.5 font-medium transition-all",
                viewMode === "sql" && "shadow-sm"
              )}
              onClick={() => setViewMode("sql")}
            >
              <Code className="h-3.5 w-3.5" />
              Query
            </Button>
            <Button
              variant={viewMode === "diff" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-[11px] gap-1.5 font-medium transition-all",
                viewMode === "diff" && "shadow-sm"
              )}
              onClick={() => setViewMode("diff")}
            >
              <GitCommit className="h-3.5 w-3.5" />
              Diff
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {viewMode === "sql" ? (
            <div className="font-mono text-xs space-y-4">
              {pendingChangesList.length > 0 && (
                pendingChangesList.map((change, idx) => (
                  <div key={change.id} className="space-y-2 pb-4 border-b border-border last:border-0">
                    <div className="micro-label flex items-center justify-between mb-1">
                      <span>Change #{idx + 1}: {change.type}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 hover:text-destructive"
                        onClick={() => removePendingChange(JSON.stringify(change.primaryKey))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="bg-muted/50 p-3 rounded border border-border">
                      <pre className="text-foreground whitespace-pre-wrap break-all">
                        {change.type === "insert" && (() => {
                          const insertData = change.newData || {};
                          const columns = Object.keys(insertData);
                          const values = Object.values(insertData);
                          return (
                            <>
                              <span className="text-success">INSERT INTO</span> {change.tableName} <br />
                              <span className="text-muted-foreground">(</span>
                              {columns.map((col, i) => (
                                <span key={col}>
                                  {col}
                                  {i < columns.length - 1 ? ", " : ""}
                                </span>
                              ))}
                              <span className="text-muted-foreground">)</span> <br />
                              <span className="text-info">VALUES</span> <span className="text-muted-foreground">(</span>
                              {values.map((val, i) => (
                                <span key={i}>
                                  <span className="text-warning">{formatSqlPreviewValue(val)}</span>
                                  {i < values.length - 1 ? ", " : ""}
                                </span>
                              ))}
                              <span className="text-muted-foreground">)</span>;
                            </>
                          );
                        })()}
                        {change.type === "update" && (() => {
                          const actualPK = getActualPrimaryKey(change);
                          return (
                            <>
                              <span className="text-info">UPDATE</span> {change.tableName} <br />
                              <span className="text-info">SET</span> {
                                Object.entries(change.newData || {}).map(([key, val], i, arr) => (
                                  <span key={key}>
                                    {key} = <span className="text-warning">{formatSqlPreviewValue(val)}</span>
                                    {i < arr.length - 1 ? ", " : ""}
                                  </span>
                                ))
                              } <br />
                              <span className="text-info">WHERE</span> {
                                Object.entries(actualPK).map(([key, val], i, arr) => (
                                  <span key={key}>
                                    {formatWhereCondition(key, val)}
                                    {i < arr.length - 1 ? " AND " : ""}
                                  </span>
                                ))
                              };
                            </>
                          );
                        })()}
                        {change.type === "delete" && (() => {
                          const actualPK = getActualPrimaryKey(change);
                          return (
                            <>
                              <span className="text-destructive">DELETE FROM</span> {change.tableName} <br />
                              <span className="text-info">WHERE</span> {
                                Object.entries(actualPK).map(([key, val], i, arr) => (
                                  <span key={key}>
                                    {formatWhereCondition(key, val)}
                                    {i < arr.length - 1 ? " AND " : ""}
                                  </span>
                                ))
                              };
                            </>
                          );
                        })()}
                      </pre>
                    </div>
                  </div>
                ))
              )}

              {/* Redis changes */}
              {redisPendingChanges.length > 0 && (
                <>
                  {pendingChangesList.length > 0 && (
                    <div className="micro-label pt-2 pb-1 border-t border-border">
                      Redis Commands
                    </div>
                  )}
                  {redisPendingChanges.map((change) => (
                    <div key={change.id} className="space-y-2 pb-4 border-b border-border last:border-0">
                      <div className="micro-label flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="px-1 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px] font-semibold normal-case">Redis</span>
                          {change.operation.op}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 hover:text-destructive"
                          onClick={() => removeRedisChange(change.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="bg-muted/50 p-3 rounded border border-border">
                        <pre className="text-foreground whitespace-pre-wrap break-all">
                          {formatRedisCommandPreview(change.operation, change.key)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {totalChangesCount === 0 && (
                <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center mt-8">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-success/5 rounded-full blur-2xl scale-150" />
                    <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-elev-1">
                      <Code className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground/60 mb-2">No pending changes</p>
                  <p className="text-xs text-muted-foreground/60 max-w-[200px]">
                    Edit cell values or Redis keys to see changes here
                  </p>
                </div>
              )}
            </div>
          ) : (
            <DiffViewer changes={pendingChangesList} onRemoveChange={removePendingChange} redisChanges={redisPendingChanges} onRemoveRedisChange={removeRedisChange} />
          )}
        </div>
      </div>

      {/* Actions Footer */}
      <div className="border-t border-border p-3 bg-gradient-to-t from-muted/40 to-muted/20 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1.5 h-9 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={handleClearAll}
            disabled={totalChangesCount === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear All
          </Button>
          <Button
            size="sm"
            className={cn(
              "flex-1 text-xs gap-1.5 h-9 font-medium shadow-sm transition-all",
              totalChangesCount > 0
                ? "bg-primary hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
            disabled={totalChangesCount === 0}
            onClick={handleCommit}
          >
            <Save className="h-3.5 w-3.5" />
            Commit ({totalChangesCount})
          </Button>
        </div>
      </div>
    </div>
  );
}
