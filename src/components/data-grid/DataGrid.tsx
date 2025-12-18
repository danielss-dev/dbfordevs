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
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight } from "lucide-react";
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
            className="flex items-center gap-2 hover:text-foreground transition-colors group w-full"
            onClick={() => column.toggleSorting(sorted === "asc")}
          >
            <span className="font-semibold">{col.name}</span>
            <span className={cn(
              "transition-opacity",
              sorted ? "opacity-100" : "opacity-0 group-hover:opacity-50"
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
      cell: ({ getValue, column }) => {
        const value = getValue();
        if (value === null || value === undefined) {
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted/50 text-muted-foreground/60 uppercase tracking-wider">
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

          return <span className="text-sm text-[hsl(var(--text-secondary))]">{value}</span>;
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
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
              value ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" : "bg-muted/50 text-muted-foreground/60"
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
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-[hsl(var(--table-header-bg))] backdrop-blur-md border-b border-[hsl(var(--border))]">
                {headerGroup.headers.map((header, idx) => {
                  const isNumeric = header.column.id.toLowerCase().includes("id") || 
                                  header.column.id.toLowerCase().includes("count") ||
                                  header.column.id.toLowerCase().includes("amount");
                  
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3.5 text-muted-foreground font-semibold transition-colors",
                        isNumeric ? "text-right" : "text-left",
                        idx === 0 && "pl-6"
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
                          "px-4 py-3 border-r border-[hsl(var(--border)/0.3)] last:border-r-0",
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
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5">
        <div className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {pageIndex * pageSize + 1}
          </span>
          {" "}-{" "}
          <span className="font-medium text-foreground">
            {Math.min((pageIndex + 1) * pageSize, totalRows)}
          </span>
          {" "}of{" "}
          <span className="font-medium text-foreground">{totalRows}</span> rows
        </div>
        <div className="flex items-center gap-1">
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
