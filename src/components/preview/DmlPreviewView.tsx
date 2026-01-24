import { Database, Plus, Trash2, RefreshCw } from "lucide-react";
import type { StatementPreview } from "@/types";
import { cn } from "@/lib/utils";

interface DmlPreviewViewProps {
  statements: StatementPreview[];
}

function getOperationType(sql: string): "INSERT" | "UPDATE" | "DELETE" | "UNKNOWN" {
  const sqlUpper = sql.trim().toUpperCase();
  if (sqlUpper.startsWith("INSERT")) return "INSERT";
  if (sqlUpper.startsWith("UPDATE")) return "UPDATE";
  if (sqlUpper.startsWith("DELETE")) return "DELETE";
  return "UNKNOWN";
}

function getOperationIcon(op: string) {
  switch (op) {
    case "INSERT":
      return <Plus className="h-3.5 w-3.5" />;
    case "DELETE":
      return <Trash2 className="h-3.5 w-3.5" />;
    case "UPDATE":
      return <RefreshCw className="h-3.5 w-3.5" />;
    default:
      return <Database className="h-3.5 w-3.5" />;
  }
}

export function DmlPreviewView({ statements }: DmlPreviewViewProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Database className="h-4 w-4" />
        Data Changes
      </h3>

      {statements.map((stmt, index) => {
        const operationType = getOperationType(stmt.sql);

        return (
          <div key={index} className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded",
                    operationType === "INSERT" && "bg-green-500/20 text-green-600 dark:text-green-400",
                    operationType === "DELETE" && "bg-red-500/20 text-red-600 dark:text-red-400",
                    operationType === "UPDATE" && "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  )}
                >
                  {getOperationIcon(operationType)}
                  {operationType}
                </span>
                <span className="text-sm text-muted-foreground">
                  {stmt.tableName}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {stmt.rowCount} row{stmt.rowCount !== 1 ? "s" : ""} affected
              </span>
            </div>

            {stmt.affectedRows && stmt.affectedColumns && stmt.affectedRows.length > 0 ? (
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {stmt.affectedColumns.map((col, colIdx) => (
                        <th
                          key={colIdx}
                          className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stmt.affectedRows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className={cn(
                          "border-b border-border last:border-b-0",
                          rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20"
                        )}
                      >
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate"
                            title={String(cell ?? "")}
                          >
                            {cell === null ? (
                              <span className="text-muted-foreground italic">NULL</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {stmt.rowCount > 0 ? (
                  <span>
                    {stmt.rowCount} row{stmt.rowCount !== 1 ? "s" : ""} will be affected
                  </span>
                ) : (
                  <span>No rows affected</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
