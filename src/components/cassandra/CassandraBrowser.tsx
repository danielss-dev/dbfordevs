import { useState, useEffect } from "react";
import { Play, RefreshCw, Key, Columns3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui";
import { useCassandra } from "@/hooks";
import { useCassandraStore } from "@/stores";
import type { CassandraColumnInfo } from "@/types";

interface CassandraBrowserProps {
  connectionId: string;
  keyspace: string;
  table: string;
}

export function CassandraBrowser({ connectionId, keyspace, table }: CassandraBrowserProps) {
  const { describeTable, queryTable } = useCassandra();
  const { columnsByTable, rowsByTable, rowCountByTable, loadingRows } = useCassandraStore();

  const [limit, setLimit] = useState(100);
  const [showSchema, setShowSchema] = useState(true);

  const tableKey = `${connectionId}:${keyspace}:${table}`;
  const columns = columnsByTable[tableKey] || [];
  const rows = rowsByTable[tableKey] || [];
  const rowCount = rowCountByTable[tableKey] || 0;

  useEffect(() => {
    // Load columns and initial data
    if (columns.length === 0) {
      describeTable(connectionId, keyspace, table);
    }
    queryTable(connectionId, keyspace, table, limit);
  }, [connectionId, keyspace, table]);

  const handleRefresh = () => {
    queryTable(connectionId, keyspace, table, limit);
  };

  const handleLimitChange = (newLimit: string) => {
    const l = parseInt(newLimit, 10);
    setLimit(l);
    queryTable(connectionId, keyspace, table, l);
  };

  // Group columns by kind
  const partitionKeys = columns.filter((c) => c.kind === "partition_key");
  const clusteringKeys = columns.filter((c) => c.kind === "clustering");
  const regularColumns = columns.filter((c) => c.kind === "regular" || c.kind === "static");

  const getColumnIcon = (col: CassandraColumnInfo) => {
    if (col.kind === "partition_key") {
      return <Key className="h-3 w-3 text-yellow-500" />;
    }
    if (col.kind === "clustering") {
      return <Key className="h-3 w-3 text-blue-500" />;
    }
    if (col.kind === "static") {
      return <span className="text-[10px] text-purple-500 font-mono">S</span>;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <span className="text-sm font-medium">
          {keyspace}.{table}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-muted-foreground">Limit:</span>
          <Select value={limit.toString()} onValueChange={handleLimitChange}>
            <SelectTrigger className="w-[80px] h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="500">500</SelectItem>
              <SelectItem value="1000">1000</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={loadingRows}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loadingRows && "animate-spin")} />
          Refresh
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowSchema(!showSchema)}
        >
          <Columns3 className="h-3.5 w-3.5 mr-1" />
          Schema
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Schema Panel */}
        {showSchema && (
          <div className="w-64 border-r overflow-auto p-3 bg-muted/20 shrink-0">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Columns3 className="h-4 w-4" />
              Columns ({columns.length})
            </h3>

            {/* Partition Keys */}
            {partitionKeys.length > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1 hover:text-foreground">
                  <ChevronDown className="h-3 w-3" />
                  <Key className="h-3 w-3 text-yellow-500" />
                  Partition Keys ({partitionKeys.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mb-3">
                  {partitionKeys.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-2 text-xs py-0.5"
                    >
                      <span className="font-mono">{col.name}</span>
                      <span className="text-muted-foreground">{col.dataType}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Clustering Keys */}
            {clusteringKeys.length > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1 hover:text-foreground">
                  <ChevronDown className="h-3 w-3" />
                  <Key className="h-3 w-3 text-blue-500" />
                  Clustering Keys ({clusteringKeys.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mb-3">
                  {clusteringKeys.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-2 text-xs py-0.5"
                    >
                      <span className="font-mono">{col.name}</span>
                      <span className="text-muted-foreground">{col.dataType}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Regular Columns */}
            {regularColumns.length > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1 hover:text-foreground">
                  <ChevronDown className="h-3 w-3" />
                  Columns ({regularColumns.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4">
                  {regularColumns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-2 text-xs py-0.5"
                    >
                      {col.kind === "static" && (
                        <span className="text-[10px] text-purple-500 font-mono">S</span>
                      )}
                      <span className="font-mono">{col.name}</span>
                      <span className="text-muted-foreground">{col.dataType}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Data Grid */}
        <div className="flex-1 overflow-auto">
          {loadingRows ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No data found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.name}
                      className="text-left py-2 px-3 font-medium whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        {getColumnIcon(col)}
                        <span>{col.name}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({col.dataType})
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <div>{col.dataType}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {col.kind.replace("_", " ")}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, rowIdx) => (
                  <tr key={rowIdx} className="border-b hover:bg-muted/50">
                    {columns.map((col) => {
                      const value = row[col.name];
                      const displayValue = formatCellValue(value);

                      return (
                        <td
                          key={col.name}
                          className="py-2 px-3 font-mono text-xs max-w-[300px] truncate"
                        >
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          {rows.length} rows displayed
          {rowCount > rows.length && ` (${rowCount} total)`}
        </span>
        <span>
          {columns.length} columns
        </span>
      </div>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
