import { useEffect, useCallback, useMemo } from "react";
import { Loader2, RefreshCw, AlertCircle, Save, RotateCcw, Plus, Trash2 } from "lucide-react";
import { Button, Separator } from "@/components/ui";
import { useQueryStore, useCRUDStore, useUIStore, useConnectionsStore, useSchemaStore } from "@/stores";
import { useDatabase, useCRUD } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import { RowCountBadge } from "@/components/ui/row-count-badge";
import { quoteIdentifier } from "@/lib/utils";
import type { Tab, ColumnInfo } from "@/types";

interface TableViewerTabProps {
  tab: Tab;
}

export function TableViewerTab({ tab }: TableViewerTabProps) {
  const { isExecuting, error, results } = useQueryStore();
  const { pendingChanges, clearPendingChanges, selectedRows, addPendingChange, markSelectedForDeletion } = useCRUDStore();
  const { setRightPanelTab } = useUIStore();
  const { connections } = useConnectionsStore();
  const { getSchema } = useSchemaStore();
  const { executeQuery, getTableSchema } = useDatabase();
  const { commitChanges } = useCRUD();
  const tabResults = results[tab.id];
  const connectionId = tab.connectionId;
  const connection = connections.find((c) => c.id === connectionId);
  const tableName = tab.tableName || tab.title;

  const pendingCount = Object.keys(pendingChanges).length;
  const selectedCount = selectedRows.length;

  // Get cached schema for this table (used for empty tables fallback)
  const cachedSchema = getSchema(connectionId, tableName);

  // Get columns from results or cached schema (for empty tables)
  // Note: tabResults?.columns might be empty array when table has 0 rows,
  // so we need to explicitly check length, not just truthiness
  const columns: ColumnInfo[] =
    (tabResults?.columns && tabResults.columns.length > 0)
      ? tabResults.columns
      : cachedSchema?.columns || [];

  // Create merged data for DataGrid that uses cached schema columns for empty tables
  const dataGridData = useMemo(() => {
    if (!tabResults) return null;
    // If query returned columns, use them directly
    if (tabResults.columns.length > 0) return tabResults;
    // If no columns from query but we have cached schema, use those columns
    if (cachedSchema?.columns && cachedSchema.columns.length > 0) {
      return {
        ...tabResults,
        columns: cachedSchema.columns,
      };
    }
    return tabResults;
  }, [tabResults, cachedSchema]);

  // Add a new row with null values
  const handleAddRow = useCallback(() => {
    if (!tableName || columns.length === 0) return;

    // Create a new row with null values
    const newRowData: Record<string, unknown> = {};
    columns.forEach((col) => {
      newRowData[col.name] = null;
    });

    // Generate a unique temporary ID for the new row
    const tempId = `__new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const primaryKey: Record<string, unknown> = { __temp_id: tempId };

    addPendingChange({
      id: crypto.randomUUID(),
      tableName,
      type: "insert",
      newData: newRowData,
      primaryKey,
    });
  }, [tableName, columns, addPendingChange]);

  // Delete selected rows
  const handleDeleteSelected = useCallback(() => {
    if (selectedCount === 0 || columns.length === 0) return;
    markSelectedForDeletion(tableName, columns);
  }, [selectedCount, tableName, columns, markSelectedForDeletion]);

  const loadData = async () => {
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
  };

  useEffect(() => {
    if (!tabResults && !isExecuting && connectionId) {
      loadData();
    }
  }, [tab.id, connectionId]);

  // Fetch schema to get primary key info (needed for proper WHERE clause generation)
  // Also needed for empty tables to know the column structure
  useEffect(() => {
    if (connectionId && tableName && !cachedSchema) {
      getTableSchema(connectionId, tableName);
    }
  }, [connectionId, tableName, cachedSchema, getTableSchema]);

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
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
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

          <Separator orientation="vertical" className="h-4" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={isExecuting || !connectionId || columns.length === 0}
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </Button>

          {selectedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedCount})
            </Button>
          )}
       
                 {pendingCount > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearPendingChanges}
                  className="text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={commitChanges}
                  className="bg-success hover:bg-success/90 text-success-foreground gap-1.5 h-8 px-3"
                >
                  <Save className="h-3.5 w-3.5" />
                  Commit ({pendingCount})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRightPanelTab("changes")}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 px-1"
                >
                  View changes
                </Button>
              </div>
            </>
          )}

          {tabResults && (
            <div className="flex items-center gap-2 text-sm ml-2">
              <RowCountBadge rowCount={tabResults.rows.length} affectedRows={tabResults.affectedRows} />
              <ExecutionTimeBadge timeMs={tabResults.executionTimeMs} />
            </div>
          )}
        </div>

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
        ) : dataGridData ? (
          <DataGrid
            data={dataGridData}
            tableName={tab.tableName || tab.title}
            connectionId={connectionId}
            onDataChange={loadData}
          />
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
