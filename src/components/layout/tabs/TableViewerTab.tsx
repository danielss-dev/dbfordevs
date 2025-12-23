import { useEffect } from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { useQueryStore } from "@/stores";
import { useDatabase } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import { RowCountBadge } from "@/components/ui/row-count-badge";
import type { Tab } from "@/types";

interface TableViewerTabProps {
  tab: Tab;
}

export function TableViewerTab({ tab }: TableViewerTabProps) {
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
            <RowCountBadge rowCount={tabResults.rows.length} affectedRows={tabResults.affectedRows} />
            <ExecutionTimeBadge timeMs={tabResults.executionTimeMs} />
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
