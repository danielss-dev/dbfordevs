import { useState, useEffect } from "react";
import { Play, Loader2, Table, Terminal, AlertCircle } from "lucide-react";
import { Button, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import { useQueryStore, useConnectionsStore, selectActiveConnection, selectActiveResults } from "@/stores";
import { useUIStore } from "@/stores/ui";
import { useDatabase } from "@/hooks";
import { DataGrid } from "@/components/data-grid";
import { SqlEditor } from "@/components/editor";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import { RowCountBadge } from "@/components/ui/row-count-badge";
import type { Tab } from "@/types";

interface QueryEditorTabProps {
  tab: Tab;
}

export function QueryEditorTab({ tab }: QueryEditorTabProps) {
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
            <RowCountBadge rowCount={results.rows.length} affectedRows={results.affectedRows} />
            <ExecutionTimeBadge timeMs={results.executionTimeMs} />
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
