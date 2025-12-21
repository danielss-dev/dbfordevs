import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryResult } from "@/types";

interface DataGridProps {
  data: QueryResult;
  onRowClick?: (row: Record<string, unknown>) => void;
}

export function DataGrid({ data, onRowClick }: DataGridProps) {
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return data.columns.map((col) => ({
      id: col.name,
      accessorKey: col.name,
      header: ({ column }) => {
        const sorted = column.getIsSorted();
        return (
          <button
            className="flex items-center gap-2 hover:text-foreground transition-colors group w-full h-full"
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            <span className="font-bold text-foreground/80 tracking-tight">{col.name}</span>
            <span className={cn(
              "transition-opacity shrink-0",
              sorted ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50 text-muted-foreground"
            )}>
              {sorted === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : sorted === "desc" ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpDown className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
        );
      },
      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || value === undefined) {
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground/60 uppercase tracking-wider border border-border/50">
              NULL
            </span>
          );
        }

        if (typeof value === "string") {
          // Check if it's a timestamp
          const isTimestamp = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/.test(value);
          if (isTimestamp) {
            const parts = value.split(/([T\s])/);
            const date = parts[0];
            const separator = parts[1];
            const time = parts.slice(2).join("");
            
            return (
              <span className="font-mono text-xs whitespace-nowrap">
                <span className="text-[hsl(var(--text-primary))]">{date}</span>
                <span className="text-[hsl(var(--text-dim))]">{separator}</span>
                <span className="text-[hsl(var(--text-secondary))]">
                  {time.includes(".") ? (
                    <>
                      {time.split(".")[0]}
                      <span className="text-[hsl(var(--text-dim))] opacity-70">.{time.split(".")[1]}</span>
                    </>
                  ) : time}
                </span>
              </span>
            );
          }

          // Check if it's a long hash or ID
          if (value.length > 20 && /^[a-fA-F0-0x:-]+$/.test(value)) {
            return (
              <span 
                className="font-mono text-xs text-[hsl(var(--text-dim))] hover:text-[hsl(var(--text-secondary))] transition-colors cursor-help truncate block max-w-[200px]"
                title={value}
              >
                {value}
              </span>
            );
          }

          return <span className="text-sm text-[hsl(var(--text-secondary))] whitespace-nowrap">{value}</span>;
        }

        if (typeof value === "number") {
          return (
            <span className="font-mono text-sm tabular-nums text-[hsl(var(--text-primary))]">
              {value.toLocaleString()}
            </span>
          );
        }

        if (typeof value === "boolean") {
          return (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
              value 
                ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]" 
                : "bg-muted text-muted-foreground/60 border-border/50"
            )}>
              {value ? "true" : "false"}
            </span>
          );
        }

        return <span className="font-mono text-sm text-[hsl(var(--text-secondary))]">{String(value)}</span>;
      },
    }));
  }, [data.columns]);

  const tableData = useMemo(() => {
    return data.rows.map((row) => {
      const record: Record<string, unknown> = {};
      data.columns.forEach((col, idx) => {
        record[col.name] = row[idx] ?? null;
      });
      return record;
    });
  }, [data.rows, data.columns]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  if (data.columns.length === 0) {
    if (data.affectedRows !== undefined && data.affectedRows !== null) {
      return (
        <div className="flex h-full flex-col items-center justify-center text-center p-8 animate-fade-in">
          <div className="mb-4 rounded-full bg-success/10 p-4 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Query executed successfully</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.affectedRows} {data.affectedRows === 1 ? 'row' : 'rows'} affected
          </p>
          <div className="mt-6 flex gap-3">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Time: {data.executionTimeMs}ms
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>No data to display</p>
      </div>
    );
  }

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = tableData.length;
  const totalPages = table.getPageCount();

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--background))]">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-[hsl(var(--table-header-bg))] backdrop-blur-md">
                {headerGroup.headers.map((header, idx) => {
                  const isNumeric = header.column.id.toLowerCase().includes("id") || 
                                  header.column.id.toLowerCase().includes("count") ||
                                  header.column.id.toLowerCase().includes("amount");
                  
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-foreground/70 transition-colors relative min-w-[100px]",
                        isNumeric ? "text-right" : "text-left",
                        idx === 0 && "pl-6",
                        "after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-[1px] after:bg-border/30 last:after:hidden"
                      )}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border)/0.5)]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="px-4 py-12 text-center text-muted-foreground/60 italic">
                  No rows found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors cursor-pointer group",
                    idx % 2 === 0 ? "bg-[hsl(var(--table-row-odd))]" : "bg-[hsl(var(--table-row-even))]",
                    "hover:bg-[hsl(var(--table-row-hover))]"
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell, cellIdx) => {
                    const isNumeric = cell.column.id.toLowerCase().includes("id") || 
                                    cell.column.id.toLowerCase().includes("count") ||
                                    cell.column.id.toLowerCase().includes("amount");
                    
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-4 py-2.5 transition-colors border-r border-[hsl(var(--border)/0.2)] last:border-r-0 min-w-[100px]",
                          isNumeric ? "text-right" : "text-left",
                          cellIdx === 0 && "pl-6"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-6 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>
            Showing{" "}
            <span className="font-semibold text-foreground/80">
              {pageIndex * pageSize + 1}
            </span>
            {" "}-{" "}
            <span className="font-semibold text-foreground/80">
              {Math.min((pageIndex + 1) * pageSize, totalRows)}
            </span>
            {" "}of{" "}
            <span className="font-semibold text-foreground/80">{totalRows}</span> rows
          </div>
          {data.executionTimeMs !== undefined && (
            <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-[hsl(var(--success)/0.05)] border border-[hsl(var(--success)/0.1)] text-[10px] font-mono text-[hsl(var(--success))] font-bold uppercase tracking-wider">
              <div className="h-1 w-1 rounded-full bg-[hsl(var(--success))]" />
              <span className="tabular-nums">{data.executionTimeMs}ms</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm text-muted-foreground">Page</span>
            <span className="text-sm font-medium min-w-[3ch] text-center">
              {pageIndex + 1}
            </span>
            <span className="text-sm text-muted-foreground">of {totalPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(totalPages - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
