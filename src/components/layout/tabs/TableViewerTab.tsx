import { useEffect } from "react";
import { Loader2, RefreshCw, AlertCircle, Save, RotateCcw, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button, Separator, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useQueryStore, useCRUDStore, useUIStore } from "@/stores";
import { useDatabase, useCRUD } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import { RowCountBadge } from "@/components/ui/row-count-badge";
import type { Tab } from "@/types";

interface TableViewerTabProps {
  tab: Tab;
}

export function TableViewerTab({ tab }: TableViewerTabProps) {
  const { isExecuting, error, results } = useQueryStore();
  const { pendingChanges, clearPendingChanges } = useCRUDStore();
  const { toggleSidePanel, sidePanelOpen } = useUIStore();
  const { executeQuery } = useDatabase();
  const { commitChanges } = useCRUD();
  const tabResults = results[tab.id];
  const connectionId = tab.connectionId;

  const pendingCount = Object.keys(pendingChanges).length;

  const loadData = async () => {
    if (!connectionId) return;

    const tableIdentifier = tab.tableName ?? tab.title;

    await executeQuery(
      {
        connectionId: connectionId,
        sql: `SELECT * FROM ${tableIdentifier}`,
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
                  onClick={() => !sidePanelOpen && toggleSidePanel()}
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

        {/* Side Panel Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidePanel}
              className="h-8 w-8"
            >
              {sidePanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {sidePanelOpen ? "Hide side panel" : "Show side panel"}
          </TooltipContent>
        </Tooltip>
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
          <DataGrid 
            data={tabResults} 
            tableName={tab.tableName || tab.title}
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
