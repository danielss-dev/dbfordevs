import { useMemo, useCallback, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type FilterFn,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Database,
} from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import type { QueryResult, ColumnInfo } from "@/types";
import { useCRUDStore } from "@/stores";
import { EditableCell } from "./EditableCell";
import { ColumnFilterPopover } from "./ColumnFilterPopover";
import { ExportMenu } from "./ExportMenu";

// Shared utility to generate consistent row IDs
export function generateRowId(row: Record<string, unknown>, columns: ColumnInfo[]): string {
  const pkColumns = columns.filter(c => c.isPrimaryKey);
  if (pkColumns.length > 0) {
    const primaryKey: Record<string, unknown> = {};
    // Sort by column name to ensure consistent key order
    pkColumns.sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
      primaryKey[c.name] = row[c.name];
    });
    return JSON.stringify(primaryKey);
  }
  // Fallback: use all columns sorted by name
  const sortedKeys = Object.keys(row).sort();
  const sortedObj: Record<string, unknown> = {};
  sortedKeys.forEach(k => { sortedObj[k] = row[k]; });
  return JSON.stringify(sortedObj);
}

interface DataGridProps {
  data: QueryResult;
  onRowClick?: (row: Record<string, unknown>) => void;
  tableName?: string;
}

const getTypeIcon = (dataType: string) => {
  const type = dataType.toLowerCase();
  if (type.includes("int") || type.includes("decimal") || type.includes("numeric") || type.includes("float") || type.includes("real")) {
    return <Hash className="h-3 w-3 text-blue-500/70" />;
  }
  if (type.includes("char") || type.includes("text") || type.includes("varchar")) {
    return <Type className="h-3 w-3 text-amber-500/70" />;
  }
  if (type.includes("date") || type.includes("time") || type.includes("timestamp")) {
    return <Calendar className="h-3 w-3 text-emerald-500/70" />;
  }
  if (type.includes("bool") || type.includes("bit")) {
    return <ToggleLeft className="h-3 w-3 text-purple-500/70" />;
  }
  return <Database className="h-3 w-3 text-muted-foreground/50" />;
};

// Custom filter function for TanStack Table
const customColumnFilter: FilterFn<any> = (row, columnId, filterValue) => {
  if (!filterValue || typeof filterValue !== "object") return true;

  const { value, operator } = filterValue as { value: string; operator?: string };
  const cellValue = row.getValue(columnId);

  // Handle null/undefined
  if (cellValue === null || cellValue === undefined) {
    return value.toLowerCase() === "null" || value === "";
  }

  const cellStr = String(cellValue).toLowerCase();
  const filterStr = value.toLowerCase();

  // String operations
  if (operator === "contains" || !operator) {
    return cellStr.includes(filterStr);
  }
  if (operator === "equals") {
    return cellStr === filterStr;
  }
  if (operator === "startsWith") {
    return cellStr.startsWith(filterStr);
  }
  if (operator === "endsWith") {
    return cellStr.endsWith(filterStr);
  }

  // Numeric operations
  const cellNum = Number(cellValue);
  const filterNum = Number(value);
  if (!isNaN(cellNum) && !isNaN(filterNum)) {
    if (operator === "gt") return cellNum > filterNum;
    if (operator === "gte") return cellNum >= filterNum;
    if (operator === "lt") return cellNum < filterNum;
    if (operator === "lte") return cellNum <= filterNum;
  }

  return true;
};

export function DataGrid({ data, onRowClick, tableName }: DataGridProps) {
  const {
    selectedRowIds,
    addSelectedRow,
    toggleRowSelection,
    editingCell,
    setEditingCell,
    pendingChanges,
    addPendingChange,
    pageSize: storePageSize,
    setPageSize,
    pageIndex: storePageIndex,
    setPageIndex,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
  } = useCRUDStore();

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Helper to create a SelectedRow object with full context
  const createSelectedRow = useCallback((row: Record<string, unknown>) => ({
    rowId: generateRowId(row, data.columns),
    tableName: tableName || "unknown",
    rowData: row,
    columns: data.columns,
  }), [data.columns, tableName]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const tableColumns: ColumnDef<Record<string, unknown>>[] = [];
    
    // Row Number Column (Gutter) - Standardized as the selection trigger
    tableColumns.push({
      id: "rowNumber",
      header: () => null,
      cell: ({ row, table }) => {
        const pageIndex = table.getState().pagination.pageIndex;
        const pageSize = table.getState().pagination.pageSize;
        const isSelected = row.getIsSelected();
        
        return (
          <div 
            className={cn(
              "flex items-center justify-center w-full h-full text-[10px] font-medium transition-colors cursor-pointer select-none border-r border-border/50",
              isSelected 
                ? "bg-primary/20 text-primary-foreground font-bold border-r-primary/40" 
                : "text-muted-foreground/40 bg-muted/5 hover:bg-muted/10 hover:text-muted-foreground/60"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey && lastSelectedId) {
                const rows = table.getRowModel().rows;
                const currentIndex = rows.findIndex(r => r.id === row.id);
                const lastIndex = rows.findIndex(r => r.id === lastSelectedId);
                
                if (currentIndex !== -1 && lastIndex !== -1) {
                  const start = Math.min(currentIndex, lastIndex);
                  const end = Math.max(currentIndex, lastIndex);
                  
                  // Add all rows in range with full context
                  for (let i = start; i <= end; i++) {
                    const selectedRow = createSelectedRow(rows[i].original);
                    addSelectedRow(selectedRow);
                  }
                  
                  // Update table selection state
                  const selectionUpdate: Record<string, boolean> = { ...table.getState().rowSelection };
                  for (let i = start; i <= end; i++) {
                    selectionUpdate[rows[i].id] = true;
                  }
                  table.setRowSelection(selectionUpdate);
                }
              } else {
                // Toggle with full context
                const selectedRow = createSelectedRow(row.original);
                toggleRowSelection(selectedRow);
                row.toggleSelected(!row.getIsSelected());
              }
              setLastSelectedId(row.id);
            }}
          >
            {row.index + 1 + (pageIndex * pageSize)}
          </div>
        );
      },
      size: 40,
      enableSorting: false,
    });

    tableColumns.push(...data.columns.map((col) => ({
      id: col.name,
      accessorKey: col.name,
      header: ({ column }: { column: any }) => {
        const sorted = column.getIsSorted();
        const currentFilter = columnFilters[col.name];

        return (
          <div className="flex items-center gap-1 w-full h-full">
            <button
              className="flex items-center gap-2 hover:text-foreground transition-colors group flex-1"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                {getTypeIcon(col.dataType)}
                <span className="font-bold text-foreground/80 tracking-tight text-xs uppercase">{col.name}</span>
              </div>
              <span className={cn(
                "transition-opacity shrink-0 ml-auto",
                sorted ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50 text-muted-foreground"
              )}>
                {sorted === "asc" ? (
                  <ArrowUp className="h-3 w-3" />
                ) : sorted === "desc" ? (
                  <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
            <ColumnFilterPopover
              columnId={col.name}
              columnName={col.name}
              dataType={col.dataType}
              currentFilter={currentFilter}
              onFilterChange={(filter) => {
                if (filter) {
                  setColumnFilter(filter);
                } else {
                  clearColumnFilter(col.name);
                }
              }}
            />
          </div>
        );
      },
      filterFn: customColumnFilter,
      cell: ({ getValue, row, column }: { getValue: any, row: any, column: any }) => {
        const value = getValue();
        const rowId = row.id;
        const colId = column.id;
        const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === colId;
        
        const change = pendingChanges[rowId];
        const isModified = change && change.newData && colId in change.newData;
        const displayValue = isModified ? change.newData![colId] : value;

        if (isEditing) {
          return (
            <EditableCell
              value={displayValue}
              columnType={col.dataType}
              nullable={col.nullable}
              onSave={(newValue) => {
                // Always save changes, comparing against original value
                if (newValue !== value) {
                  // Build primaryKey with sorted keys to match generateRowId
                  const pkColumns = data.columns.filter(c => c.isPrimaryKey).sort((a, b) => a.name.localeCompare(b.name));
                  const primaryKey: Record<string, unknown> = {};

                  if (pkColumns.length > 0) {
                    // Use primary key columns
                    pkColumns.forEach(c => {
                      primaryKey[c.name] = row.original[c.name];
                    });
                  } else {
                    // Fallback: use all columns (matching generateRowId behavior)
                    const sortedKeys = Object.keys(row.original).sort();
                    sortedKeys.forEach(k => {
                      primaryKey[k] = row.original[k];
                    });
                  }

                  addPendingChange({
                    id: crypto.randomUUID(),
                    tableName: tableName || "unknown",
                    type: "update",
                    originalData: row.original,
                    newData: {
                      ...(change?.newData || {}),
                      [colId]: newValue,
                    },
                    primaryKey,
                  });
                }
                setEditingCell(null);
              }}
              onCancel={() => setEditingCell(null)}
            />
          );
        }

        if (displayValue === null || displayValue === undefined) {
          return (
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-border/50",
              isModified ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground/60"
            )}>
              NULL
            </span>
          );
        }

        let content: React.ReactNode;
        if (typeof displayValue === "string") {
          // Try to format as timestamp
          const timestampData = formatTimestamp(displayValue);
          if (timestampData) {
            // Display formatted timestamp without milliseconds, keep them in tooltip
            const tooltipText = timestampData.milliseconds
              ? `${timestampData.formatted}.${timestampData.milliseconds}${timestampData.timezone || ""}`
              : `${timestampData.formatted}${timestampData.timezone || ""}`;

            content = (
              <span
                className="font-mono text-[11px] whitespace-nowrap cursor-help"
                title={timestampData.milliseconds ? tooltipText : undefined}
              >
                <span className="text-[hsl(var(--text-primary))]">{timestampData.date}</span>
                <span className="text-[hsl(var(--text-dim))]"> </span>
                <span className="text-[hsl(var(--text-secondary))]">{timestampData.time}</span>
                {timestampData.timezone && (
                  <span className="text-[hsl(var(--text-dim))] text-[10px] ml-0.5">
                    {timestampData.timezone}
                  </span>
                )}
              </span>
            );
          } else if (displayValue.length > 20 && /^[a-fA-F0-0x:-]+$/.test(displayValue)) {
            content = (
              <span 
                className="font-mono text-[11px] text-[hsl(var(--text-dim))] hover:text-[hsl(var(--text-secondary))] transition-colors cursor-help truncate block max-w-[200px]"
                title={displayValue}
              >
                {displayValue}
              </span>
            );
          } else {
            content = <span className="text-xs text-[hsl(var(--text-secondary))] whitespace-nowrap">{displayValue}</span>;
          }
        } else if (typeof displayValue === "number") {
          content = (
            <span className="font-mono text-xs tabular-nums text-[hsl(var(--text-primary))]">
              {displayValue.toLocaleString()}
            </span>
          );
        } else if (typeof displayValue === "boolean") {
          content = (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
              displayValue 
                ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]" 
                : "bg-muted text-muted-foreground/60 border-border/50"
            )}>
              {displayValue ? "true" : "false"}
            </span>
          );
        } else {
          content = <span className="font-mono text-xs text-[hsl(var(--text-secondary))]">{String(displayValue)}</span>;
        }

        return (
          <div className={cn(
            "relative group/cell min-h-[1.5rem] flex items-center",
            isModified && "after:absolute after:top-0 after:right-0 after:w-2 after:h-2 after:bg-amber-500 after:rounded-bl-full"
          )}>
            {content}
          </div>
        );
      },
    })));
    return tableColumns;
  }, [data.columns, editingCell, pendingChanges, tableName, addPendingChange, setEditingCell, lastSelectedId, createSelectedRow, addSelectedRow, toggleRowSelection, columnFilters, setColumnFilter, clearColumnFilter]);

  const tableData = useMemo(() => {
    return data.rows.map((row) => {
      const record: Record<string, unknown> = {};
      data.columns.forEach((col, idx) => {
        record[col.name] = row[idx] ?? null;
      });
      return record;
    });
  }, [data.rows, data.columns]);

  const getRowId = useCallback((row: Record<string, unknown>) => {
    return generateRowId(row, data.columns);
  }, [data.columns]);

  // Convert our store filters to TanStack Table format
  const tanstackFilters = useMemo(() => {
    return Object.values(columnFilters).map(filter => ({
      id: filter.columnId,
      value: { value: filter.value, operator: filter.operator },
    }));
  }, [columnFilters]);

  const table = useReactTable({
    data: tableData,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Row selection is handled by our custom click handlers with full context
    // This just keeps TanStack Table's internal state in sync
    onPaginationChange: (updater) => {
      const currentPagination = {
        pageIndex: storePageIndex,
        pageSize: storePageSize,
      };
      const nextPagination = typeof updater === 'function'
        ? updater(currentPagination)
        : updater;

      setPageIndex(nextPagination.pageIndex);
      setPageSize(nextPagination.pageSize);
    },
    state: {
      rowSelection: selectedRowIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
      pagination: {
        pageIndex: storePageIndex,
        pageSize: storePageSize,
      },
      columnFilters: tanstackFilters,
    },
  });

  const totalRows = tableData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalPages = table.getPageCount();

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

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-muted/50 border-b-2 border-border shadow-md">
                {headerGroup.headers.map((header) => {
                  const isNumeric = header.column.id.toLowerCase().includes("id") ||
                                  header.column.id.toLowerCase().includes("count") ||
                                  header.column.id.toLowerCase().includes("amount");

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-3 py-2.5 text-foreground/90 font-bold transition-all relative",
                        "hover:bg-muted/70",
                        isNumeric ? "text-right" : "text-left",
                        header.column.id === "rowNumber" ? "p-0 w-10 text-center bg-muted/30" : "min-w-[120px]",
                        "border-r border-border/40 last:border-r-0"
                      )}
                      style={{ width: header.getSize() }}
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
          <tbody className="divide-y divide-[hsl(var(--border)/0.3)]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground/60 italic">
                  No rows found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors cursor-pointer group h-9",
                    idx % 2 === 0 ? "bg-[hsl(var(--table-row-odd))]" : "bg-[hsl(var(--table-row-even))]",
                    "hover:bg-[hsl(var(--table-row-hover))]",
                    row.getIsSelected() && "bg-primary/30 hover:bg-primary/35",
                    pendingChanges[row.id]?.type === "delete" && "opacity-50 grayscale line-through decoration-destructive"
                  )}
                  onClick={() => {
                    onRowClick?.(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = cell.column.id.toLowerCase().includes("id") || 
                                    cell.column.id.toLowerCase().includes("count") ||
                                    cell.column.id.toLowerCase().includes("amount");
                    
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-1.5 transition-colors border-r border-[hsl(var(--border)/0.2)] last:border-r-0",
                          isNumeric ? "text-right" : "text-left",
                          cell.column.id === "rowNumber" && "p-0 w-10 text-center",
                          editingCell?.rowId === row.id && editingCell?.columnId === cell.column.id && "p-0"
                        )}
                        onDoubleClick={() => {
                          if (cell.column.id !== "rowNumber") {
                            setEditingCell({ rowId: row.id, columnId: cell.column.id });
                          }
                        }}
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-6 py-2 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          {/* Export Menu */}
          <ExportMenu tableName={tableName} />

          {/* Status Text */}
          <div className="flex items-center gap-1">
            <span>Showing</span>
            <span className="font-semibold text-foreground/80">
              {pageIndex * pageSize + 1}
            </span>
            <span>-</span>
            <span className="font-semibold text-foreground/80">
              {Math.min((pageIndex + 1) * pageSize, totalRows)}
            </span>
            <span>of</span>
            <span className="font-semibold text-foreground/80">{totalRows.toLocaleString()}</span>
            <span>rows</span>
          </div>

          {/* Execution Time */}
          {data.executionTimeMs !== undefined && (
            <ExecutionTimeBadge timeMs={data.executionTimeMs} />
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 border-r border-border pr-4 mr-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground/60 mr-2">Rows per page:</span>
            <Select
              value={String(storePageSize)}
              onValueChange={(value) => {
                const newSize = Number(value);
                setPageSize(newSize);
                table.setPageSize(newSize);
              }}
            >
              <SelectTrigger className="h-7 w-[75px] text-[10px] uppercase font-bold bg-background/50">
                <SelectValue placeholder={String(storePageSize)} />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500, 1000].map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-background"
              onClick={() => setPageIndex(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 px-3 text-xs font-medium min-w-[100px] justify-center bg-background/50 h-7 rounded-md border border-border/30">
              <span className="text-primary">{pageIndex + 1}</span>
              <span className="text-muted-foreground font-normal">/</span>
              <span>{totalPages}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-background"
              onClick={() => setPageIndex(pageIndex + 1)}
              disabled={pageIndex >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
