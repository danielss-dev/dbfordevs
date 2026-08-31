import { useMemo, useCallback, useState, useEffect, useRef } from "react";
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
import { Input } from "@/components/ui/input";
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
  Search,
  X,
} from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import { ExecutionTimeBadge } from "@/components/ui/execution-time-badge";
import type { QueryResult, ColumnInfo } from "@/types";
import { useCRUDStore, useUIStore, useSchemaStore, useGridStore } from "@/stores";
import { EditableCell } from "./EditableCell";
import { ColumnFilterPopover } from "./ColumnFilterPopover";
import { ExportMenu } from "./ExportMenu";
import { ImportButton } from "./ImportButton";
import { ColumnVisibilityPopover } from "./ColumnVisibilityPopover";
import { ColumnHeaderMenu, ColumnHeaderContextMenu } from "./ColumnHeaderMenu";
import { ColumnStatisticsDialog } from "./ColumnStatisticsDialog";
import { FindReplaceBar } from "./FindReplaceBar";
import { BinaryPreviewDialog } from "./BinaryPreviewDialog";
import {
  getNullDisplay,
  getConditionalStyle,
  conditionalStyleToCss,
  formatNumber,
  isNegativeNumber,
  formatJson,
  isBinaryType,
} from "@/lib/format-utils";

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
  connectionId?: string;
  onDataChange?: () => void;
}

const getTypeIcon = (dataType: string) => {
  const type = dataType.toLowerCase();
  // Numeric types (integers, decimals, floats)
  if (
    type.includes("int") ||
    type.includes("decimal") ||
    type.includes("numeric") ||
    type.includes("float") ||
    type.includes("real") ||
    type.includes("double") ||
    type.includes("money") ||
    type.includes("serial") ||
    type === "number"
  ) {
    return <Hash className="h-3 w-3 text-blue-500/70" />;
  }
  // Text/string types
  if (
    type.includes("char") ||
    type.includes("text") ||
    type.includes("varchar") ||
    type.includes("string") ||
    type.includes("clob") ||
    type.includes("name") ||
    type.includes("uuid") ||
    type.includes("enum") ||
    type.includes("citext")
  ) {
    return <Type className="h-3 w-3 text-amber-500/70" />;
  }
  // Date/time types
  if (
    type.includes("date") ||
    type.includes("time") ||
    type.includes("timestamp") ||
    type.includes("interval")
  ) {
    return <Calendar className="h-3 w-3 text-emerald-500/70" />;
  }
  // Boolean types
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

export function DataGrid({ data, onRowClick, tableName, connectionId, onDataChange }: DataGridProps) {
  // Use granular selectors to avoid re-renders on unrelated CRUD store changes
  const selectedRowIds = useCRUDStore(state => state.selectedRowIds);
  const addSelectedRow = useCRUDStore(state => state.addSelectedRow);
  const setSelectedRows = useCRUDStore(state => state.setSelectedRows);
  const toggleRowSelection = useCRUDStore(state => state.toggleRowSelection);
  const clearSelection = useCRUDStore(state => state.clearSelection);
  const editingCell = useCRUDStore(state => state.editingCell);
  const setEditingCell = useCRUDStore(state => state.setEditingCell);
  const pendingChanges = useCRUDStore(state => state.pendingChanges);
  const addPendingChange = useCRUDStore(state => state.addPendingChange);
  const storePageSize = useCRUDStore(state => state.pageSize);
  const setPageSize = useCRUDStore(state => state.setPageSize);
  const storePageIndex = useCRUDStore(state => state.pageIndex);
  const setPageIndex = useCRUDStore(state => state.setPageIndex);
  const columnFilters = useCRUDStore(state => state.columnFilters);
  const setColumnFilter = useCRUDStore(state => state.setColumnFilter);
  const clearColumnFilter = useCRUDStore(state => state.clearColumnFilter);
  const setRightPanelTab = useUIStore(state => state.setRightPanelTab);
  const getSchema = useSchemaStore(state => state.getSchema);

  // Grid store for enhanced features
  const gridPreferences = useGridStore(state => state.gridPreferences);
  const defaultRowHeight = useGridStore(state => state.defaultRowHeight);
  const nullDisplay = useGridStore(state => state.nullDisplay);
  const numberFormat = useGridStore(state => state.numberFormat);
  const jsonDisplay = useGridStore(state => state.jsonDisplay);
  const conditionalRules = useGridStore(state => state.conditionalRules);
  const openFindReplace = useGridStore(state => state.openFindReplace);
  const openBinaryPreviewDialog = useGridStore(state => state.openBinaryPreviewDialog);
  const resetGridPreferences = useGridStore(state => state.resetGridPreferences);

  // Generate table key for preferences
  const tableKey = useMemo(
    () => connectionId && tableName ? `${connectionId}:${tableName}` : "",
    [connectionId, tableName]
  );

  // Reset grid preferences when component mounts or tableKey changes
  // This ensures each grid view starts with default configuration
  useEffect(() => {
    if (tableKey) {
      resetGridPreferences(tableKey);
    }
  }, [tableKey, resetGridPreferences]);

  // Get row height based on preferences
  const rowHeightPx = useMemo(() => {
    const prefs = gridPreferences[tableKey];
    const mode = prefs?.rowHeight?.mode || defaultRowHeight.mode;
    const heights = { compact: 28, default: 36, comfortable: 44, custom: 36 };
    return heights[mode] || 36;
  }, [gridPreferences, tableKey, defaultRowHeight.mode]);

  // Get column visibility from grid preferences (for TanStack Table)
  const columnVisibility = useMemo(() => {
    const prefs = gridPreferences[tableKey];
    if (!prefs) return {};
    const visibility: Record<string, boolean> = {};
    Object.entries(prefs.columns).forEach(([colName, colConfig]) => {
      visibility[colName] = colConfig.visible;
    });
    return visibility;
  }, [gridPreferences, tableKey]);

  // Get column pinning from grid preferences (for TanStack Table)
  // Always include "rowNumber" at the start of left-pinned columns
  const columnPinning = useMemo(() => {
    const prefs = gridPreferences[tableKey];
    const left: string[] = ["rowNumber"]; // rowNumber is always first on left
    const right: string[] = [];
    if (prefs) {
      Object.entries(prefs.columns).forEach(([colName, colConfig]) => {
        if (colConfig.pinned === "left") left.push(colName);
        else if (colConfig.pinned === "right") right.push(colName);
      });
    }
    return { left, right };
  }, [gridPreferences, tableKey]);

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get cached schema and merge isPrimaryKey info into columns
  // This is needed because query results don't include primary key info
  const columnsWithPK = useMemo(() => {
    const cachedSchema = connectionId ? getSchema(connectionId, tableName || "") : null;
    if (!cachedSchema) return data.columns;

    // Build a set of primary key column names
    const pkSet = new Set(cachedSchema.primaryKeys || []);
    cachedSchema.columns?.forEach(col => {
      if (col.isPrimaryKey) pkSet.add(col.name);
    });

    // Merge isPrimaryKey into data columns
    return data.columns.map(col => ({
      ...col,
      isPrimaryKey: col.isPrimaryKey || pkSet.has(col.name),
    }));
  }, [data.columns, connectionId, tableName, getSchema]);

  // Handle Cmd+F / Ctrl+F to focus search, Cmd+H for find/replace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+F opens find replace bar
          openFindReplace();
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault();
        openFindReplace();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openFindReplace]);

  // Helper to create a SelectedRow object with full context
  const createSelectedRow = useCallback((row: Record<string, unknown>) => ({
    rowId: generateRowId(row, columnsWithPK),
    tableName: tableName || "unknown",
    rowData: row,
    columns: columnsWithPK,
  }), [columnsWithPK, tableName]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const tableColumns: ColumnDef<Record<string, unknown>>[] = [];
    
    // Row Number Column (Gutter) - Standardized as the selection trigger
    tableColumns.push({
      id: "rowNumber",
      header: ({ table }) => {
        const allRows = table.getRowModel().rows;
        const allRowIds = allRows.map(r => r.id);
        const allSelected = allRowIds.length > 0 && allRowIds.every(id => selectedRowIds.includes(id));

        const handleSelectAll = () => {
          if (allSelected) {
            // Deselect all
            clearSelection();
            table.toggleAllRowsSelected(false);
          } else {
            // Select all visible rows
            const newSelectedRows = allRows.map(r => createSelectedRow(r.original));
            setSelectedRows(newSelectedRows);
            table.toggleAllRowsSelected(true);
            setRightPanelTab("fields");
          }
        };

        return (
          <div
            className={cn(
              "flex items-center justify-center w-full h-full text-[9px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors",
              allSelected
                ? "text-primary bg-primary/10"
                : "text-muted-foreground/50 hover:text-primary/70 hover:bg-primary/5"
            )}
            onClick={handleSelectAll}
            title={allSelected ? "Deselect all rows" : "Select all rows"}
          >
            #
          </div>
        );
      },
      cell: ({ row, table }) => {
        const pageIndex = table.getState().pagination.pageIndex;
        const pageSize = table.getState().pagination.pageSize;
        const isSelected = row.getIsSelected();

        return (
          <div
            className={cn(
              "flex items-center justify-center w-full h-full text-[11px] font-medium transition-all cursor-pointer select-none",
              isSelected
                ? "bg-primary/20 text-primary font-bold"
                : "text-muted-foreground/50 hover:bg-primary/10 hover:text-primary/70"
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
                  // Open Fields panel to show selected rows
                  setRightPanelTab("fields");
                }
              } else {
                // Toggle with full context
                const selectedRow = createSelectedRow(row.original);
                const isCurrentlySelected = row.getIsSelected();
                toggleRowSelection(selectedRow);
                row.toggleSelected(!isCurrentlySelected);
                // Open Fields panel when selecting a row (not when deselecting)
                if (!isCurrentlySelected) {
                  setRightPanelTab("fields");
                }
              }
              setLastSelectedId(row.id);
            }}
          >
            {row.index + 1 + (pageIndex * pageSize)}
          </div>
        );
      },
      size: 56,
      enableSorting: false,
      enableResizing: false,
    });

    tableColumns.push(...columnsWithPK.map((col) => ({
      id: col.name,
      accessorKey: col.name,
      header: ({ column }: { column: any }) => {
        const sorted = column.getIsSorted();
        const currentFilter = columnFilters[col.name];

        return (
          <ColumnHeaderContextMenu
            column={column}
            columnInfo={col}
            tableKey={tableKey}
            data={tableData}
          >
            <div className="flex items-center gap-1.5 w-full h-full group">
              <button
                className="flex items-center gap-2 hover:text-foreground transition-all flex-1 py-0.5"
                onClick={() => column.toggleSorting(sorted === "asc")}
              >
                <div className={cn(
                  "flex items-center gap-1.5 transition-all",
                  sorted ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                )}>
                  <span className={cn(
                    "transition-colors",
                    sorted ? "text-primary" : "text-muted-foreground group-hover:text-foreground/70"
                  )}>
                    {getTypeIcon(col.dataType)}
                  </span>
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors",
                    sorted ? "text-primary" : "text-muted-foreground group-hover:text-foreground/80"
                  )}>
                    {col.name}
                  </span>
                </div>
                <span className={cn(
                  "transition-all shrink-0 ml-auto",
                  sorted ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-40 text-muted-foreground"
                )}>
                  {sorted === "asc" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : sorted === "desc" ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3" />
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
              <ColumnHeaderMenu
                column={column}
                columnInfo={col}
                tableKey={tableKey}
                data={tableData}
              />
            </div>
          </ColumnHeaderContextMenu>
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
                const isPendingInsertRow = row.original.__pending_insert === true;

                // For pending insert rows, update the existing insert change
                if (isPendingInsertRow) {
                  const tempPk = row.original.__temp_pk as Record<string, unknown>;
                  addPendingChange({
                    id: change?.id || crypto.randomUUID(),
                    tableName: tableName || "unknown",
                    type: "insert",
                    newData: {
                      ...(change?.newData || {}),
                      [colId]: newValue,
                    },
                    primaryKey: tempPk,
                  });
                  setEditingCell(null);
                  return;
                }

                // For existing rows, create an update change
                if (newValue !== value) {
                  // Build primaryKey with sorted keys to match generateRowId
                  const pkColumns = columnsWithPK.filter(c => c.isPrimaryKey).sort((a, b) => a.name.localeCompare(b.name));
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
          const nullConfig = getNullDisplay(nullDisplay);
          return (
            <span className={cn(
              nullConfig.className,
              isModified && "bg-warning/10 text-warning border-warning/30"
            )}>
              {nullConfig.text}
            </span>
          );
        }

        // Apply conditional formatting
        const conditionalStyle = getConditionalStyle(displayValue, colId, conditionalRules);
        const cellStyle = conditionalStyleToCss(conditionalStyle);

        let content: React.ReactNode;

        // Check if this is a binary column or looks like binary data
        const isBinaryColumn = isBinaryType(col.dataType);
        const looksLikeBinary = typeof displayValue === "string" && (
          // Base64 PNG/JPEG/GIF patterns
          displayValue.startsWith("iVBORw") || // PNG
          displayValue.startsWith("/9j/") ||    // JPEG
          displayValue.startsWith("R0lGOD") ||  // GIF
          displayValue.startsWith("UklGR") ||   // WebP (RIFF)
          // Hex patterns
          displayValue.startsWith("\\x") ||
          displayValue.startsWith("0x") ||
          // Long base64 strings (likely binary)
          (/^[A-Za-z0-9+/]+=*$/.test(displayValue) && displayValue.length > 50)
        );

        if ((isBinaryColumn || looksLikeBinary) && typeof displayValue === "string") {
          const truncated = displayValue.length > 30
            ? displayValue.slice(0, 30) + "..."
            : displayValue;
          content = (
            <button
              className="font-mono text-[11px] text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.8)] hover:underline transition-colors cursor-pointer truncate block max-w-[200px] text-left"
              title="Click to view binary data"
              onClick={(e) => {
                e.stopPropagation();
                openBinaryPreviewDialog(displayValue);
              }}
            >
              {truncated}
            </button>
          );
        } else if (typeof displayValue === "string") {
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
          const formattedNum = formatNumber(displayValue, numberFormat);
          const isNegative = numberFormat.negativeColor && isNegativeNumber(displayValue);
          content = (
            <span className={cn(
              "font-mono text-xs tabular-nums text-[hsl(var(--text-primary))]",
              isNegative && "text-destructive"
            )} style={cellStyle}>
              {formattedNum}
            </span>
          );
        } else if (typeof displayValue === "boolean") {
          content = (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
              displayValue
                ? "bg-success/10 text-success border-success/20"
                : "bg-muted text-muted-foreground/60 border-border/50"
            )}>
              {displayValue ? "true" : "false"}
            </span>
          );
        } else if (typeof displayValue === "object") {
          // Handle JSON/object values using grid store settings
          const { text: jsonText } = formatJson(displayValue, jsonDisplay);
          content = (
            <span
              className={cn(
                "font-mono text-[11px] text-[hsl(var(--text-dim))] hover:text-[hsl(var(--text-secondary))] transition-colors cursor-help truncate block max-w-[200px]",
                jsonDisplay === "pretty" && "whitespace-pre-wrap"
              )}
              title={JSON.stringify(displayValue, null, 2)}
              style={cellStyle}
            >
              {jsonText}
            </span>
          );
        } else {
          content = <span className="font-mono text-xs text-[hsl(var(--text-secondary))]">{String(displayValue)}</span>;
        }

        return (
          <div className={cn(
            "relative group/cell min-h-[1.5rem] flex items-center",
            isModified && "after:absolute after:top-0 after:right-0 after:w-2 after:h-2 after:bg-warning after:rounded-bl-full"
          )}>
            {content}
          </div>
        );
      },
    })));
    return tableColumns;
  }, [columnsWithPK, editingCell, pendingChanges, tableName, addPendingChange, setEditingCell, lastSelectedId, createSelectedRow, addSelectedRow, toggleRowSelection, columnFilters, setColumnFilter, clearColumnFilter, selectedRowIds, clearSelection, setSelectedRows, setRightPanelTab]);

  // Split into two memos: existingRows only recalculates when data changes,
  // not on every pending change edit
  const existingRows = useMemo(() => {
    return data.rows.map((row) => {
      const record: Record<string, unknown> = {};
      data.columns.forEach((col, idx) => {
        record[col.name] = row[idx] ?? null;
      });
      return record;
    });
  }, [data.rows, data.columns]);

  const tableData = useMemo(() => {
    // Add pending insert rows for this table
    const pendingInserts = Object.values(pendingChanges)
      .filter(change => change.type === "insert" && change.tableName === tableName)
      .map(change => {
        const record: Record<string, unknown> = { ...change.newData };
        record.__pending_insert = true;
        record.__temp_pk = change.primaryKey;
        return record;
      });

    return pendingInserts.length > 0 ? [...existingRows, ...pendingInserts] : existingRows;
  }, [existingRows, pendingChanges, tableName]);

  const getRowId = useCallback((row: Record<string, unknown>) => {
    // For pending insert rows, use the temp primary key
    if (row.__pending_insert && row.__temp_pk) {
      return JSON.stringify(row.__temp_pk);
    }
    return generateRowId(row, columnsWithPK);
  }, [columnsWithPK]);

  // Sync selectedRows with current data when tableData changes
  // This ensures selectedRows has fresh data after a refresh
  // Use a ref to track the data.rows to detect actual data refresh (not just pendingChanges updates)
  const lastDataRowsRef = useRef<typeof data.rows | null>(null);

  useEffect(() => {
    // Skip if no selection
    if (selectedRowIds.length === 0) return;

    // Only run when actual data rows change (from query refresh), not just pendingChanges
    if (lastDataRowsRef.current === data.rows) return;
    lastDataRowsRef.current = data.rows;

    // Build a map of rowId -> current row data from tableData
    const rowDataMap = new Map<string, Record<string, unknown>>();
    tableData.forEach(row => {
      const rowId = row.__pending_insert && row.__temp_pk
        ? JSON.stringify(row.__temp_pk)
        : generateRowId(row, columnsWithPK);
      rowDataMap.set(rowId, row);
    });

    // Update selectedRows with fresh data for rows that still exist
    const updatedSelectedRows = selectedRowIds
      .map(rowId => {
        const rowData = rowDataMap.get(rowId);
        if (!rowData) return null;
        return {
          rowId,
          tableName: tableName || "unknown",
          rowData,
          columns: columnsWithPK,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    // Always update to sync fresh data (the selection IDs are preserved)
    setSelectedRows(updatedSelectedRows);
  }, [data.rows, tableData, columnsWithPK, tableName, selectedRowIds, setSelectedRows]);

  // Convert our store filters to TanStack Table format
  const tanstackFilters = useMemo(() => {
    return Object.values(columnFilters).map(filter => ({
      id: filter.columnId,
      value: { value: filter.value, operator: filter.operator },
    }));
  }, [columnFilters]);

  // Memoize rowSelection to avoid recreating object on every render
  const rowSelection = useMemo(
    () => selectedRowIds.reduce<Record<string, boolean>>((acc, id) => { acc[id] = true; return acc; }, {}),
    [selectedRowIds]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 60,
      maxSize: 1200,
    },
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
      rowSelection,
      pagination: {
        pageIndex: storePageIndex,
        pageSize: storePageSize,
      },
      columnFilters: tanstackFilters,
      globalFilter,
      columnVisibility,
      columnPinning,
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      return row.getAllCells().some((cell) => {
        const value = cell.getValue();
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(search);
      });
    },
  });

  const totalRows = tableData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalPages = table.getPageCount();

  if (columnsWithPK.length === 0) {
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
    <div data-focus-zone="grid" data-grid-container tabIndex={0} className="flex h-full flex-col bg-[hsl(var(--background))] relative overflow-hidden outline-none">
      {/* Find & Replace Bar */}
      <FindReplaceBar
        columns={columnsWithPK}
        data={tableData}
        onReplace={(columnId, rowIndex, _oldValue, newValue) => {
          const rowData = tableData[rowIndex];
          if (!rowData) return;

          const pkColumns = columnsWithPK.filter(c => c.isPrimaryKey);
          const primaryKey: Record<string, unknown> = {};
          pkColumns.forEach(c => {
            primaryKey[c.name] = rowData[c.name];
          });

          addPendingChange({
            id: crypto.randomUUID(),
            tableName: tableName || "unknown",
            type: "update",
            originalData: rowData,
            newData: { ...rowData, [columnId]: newValue },
            primaryKey,
          });
        }}
      />

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-sm" style={{ minWidth: '100%', width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-[hsl(var(--table-header-bg))] border-b border-border shadow-sm">
                {headerGroup.headers.map((header) => {
                  const isNumeric = header.column.id.toLowerCase().includes("id") ||
                                  header.column.id.toLowerCase().includes("count") ||
                                  header.column.id.toLowerCase().includes("amount");
                  const isPinned = header.column.getIsPinned();

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-3 py-2 text-foreground/90 font-bold transition-all relative",
                        "hover:bg-muted/50",
                        isNumeric ? "text-right" : "text-left",
                        header.column.id === "rowNumber"
                          ? "px-1 py-0 w-14 text-center bg-muted/20 border-r border-border/30 sticky left-0 z-30 bg-[hsl(var(--table-header-bg))]"
                          : "min-w-[120px] border-r border-border/20 last:border-r-0",
                        header.column.id !== "rowNumber" && isPinned && "sticky z-20 bg-[hsl(var(--table-header-bg))]",
                        header.column.id !== "rowNumber" && isPinned === "left" && "shadow-[2px_0_4px_-2px_hsl(var(--foreground)/0.12)]",
                        header.column.id !== "rowNumber" && isPinned === "right" && "right-0 shadow-[-2px_0_4px_-2px_hsl(var(--foreground)/0.12)]"
                      )}
                      style={{
                        width: header.getSize(),
                        left: header.column.id === "rowNumber"
                          ? 0
                          : isPinned === "left"
                            ? `${header.getStart("left") + 56}px` // 56px = row number column width
                            : undefined,
                        right: isPinned === "right" ? `${header.column.getAfter("right")}px` : undefined,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          className={cn(
                            "absolute top-0 right-0 w-[3px] h-full cursor-col-resize select-none touch-none",
                            header.column.getIsResizing() ? "bg-primary" : "bg-transparent hover:bg-primary/50"
                          )}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border)/0.3)]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Database className="h-10 w-10 text-muted-foreground/30" />
                    <div className="text-muted-foreground/60">
                      <p className="font-medium">No rows found</p>
                      <p className="text-xs mt-1">Add rows using the toolbar or import data</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => {
                const isPendingInsert = row.original.__pending_insert === true;
                const isPendingDelete = pendingChanges[row.id]?.type === "delete";

                return (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-all cursor-pointer group",
                    idx % 2 === 0 ? "bg-[hsl(var(--table-row-odd))]" : "bg-[hsl(var(--table-row-even))]",
                    "hover:bg-[hsl(var(--table-row-hover))]",
                    row.getIsSelected() && "bg-[hsl(var(--sel))] hover:bg-[hsl(var(--sel-strong))]",
                    isPendingDelete && "opacity-40 grayscale line-through decoration-destructive/70 decoration-2",
                    isPendingInsert && "bg-success/10 hover:bg-success/15 ring-1 ring-inset ring-success/30"
                  )}
                  style={{ height: `${rowHeightPx}px` }}
                  onClick={() => {
                    onRowClick?.(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = cell.column.id.toLowerCase().includes("id") ||
                                    cell.column.id.toLowerCase().includes("count") ||
                                    cell.column.id.toLowerCase().includes("amount");
                    const isPinned = cell.column.getIsPinned();

                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-1.5 transition-colors",
                          isNumeric ? "text-right" : "text-left",
                          cell.column.id === "rowNumber"
                            ? "px-1 py-0 w-14 text-center border-r border-border/20 sticky left-0 z-20 bg-[hsl(var(--background))]"
                            : "border-r border-[hsl(var(--border)/0.15)] last:border-r-0",
                          editingCell?.rowId === row.id && editingCell?.columnId === cell.column.id && "p-0 bg-background ring-2 ring-primary/50",
                          cell.column.id !== "rowNumber" && isPinned && "sticky z-10 bg-[hsl(var(--background))]",
                          cell.column.id !== "rowNumber" && isPinned === "left" && "shadow-[2px_0_4px_-2px_hsl(var(--foreground)/0.12)]",
                          cell.column.id !== "rowNumber" && isPinned === "right" && "right-0 shadow-[-2px_0_4px_-2px_hsl(var(--foreground)/0.12)]"
                        )}
                        style={{
                          width: cell.column.getSize(),
                          left: cell.column.id === "rowNumber"
                            ? 0
                            : isPinned === "left"
                              ? `${cell.column.getStart("left") + 56}px` // 56px = row number column width
                              : undefined,
                          right: isPinned === "right" ? `${cell.column.getAfter("right")}px` : undefined,
                        }}
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
              );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 px-4 py-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-7 w-[160px] pl-8 pr-8 text-xs bg-background/70 border-border/50"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Import/Export */}
          {connectionId && (
            <ImportButton
              connectionId={connectionId}
              tableName={tableName}
              onImportComplete={onDataChange}
            />
          )}
          <ExportMenu tableName={tableName} />

          {/* Column Visibility */}
          {tableKey && (
            <ColumnVisibilityPopover tableKey={tableKey} columns={columnsWithPK} />
          )}

          {/* Status Text */}
          <div className="flex items-center gap-1 text-muted-foreground/80">
            <span>Showing</span>
            <span className="font-semibold text-foreground/80 tabular-nums">
              {table.getFilteredRowModel().rows.length > 0 ? pageIndex * pageSize + 1 : 0}
            </span>
            <span>-</span>
            <span className="font-semibold text-foreground/80 tabular-nums">
              {Math.min((pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length)}
            </span>
            <span>of</span>
            <span className="font-semibold text-foreground/80 tabular-nums">{table.getFilteredRowModel().rows.length.toLocaleString()}</span>
            <span>rows</span>
            {globalFilter && table.getFilteredRowModel().rows.length !== totalRows && (
              <span className="text-primary/70 ml-1 tabular-nums">
                (filtered from {totalRows.toLocaleString()})
              </span>
            )}
          </div>

          {/* Execution Time */}
          {data.executionTimeMs !== undefined && (
            <ExecutionTimeBadge timeMs={data.executionTimeMs} />
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-border/50">
            <span className="micro-label text-muted-foreground/60">Rows:</span>
            <Select
              value={String(storePageSize)}
              onValueChange={(value) => {
                const newSize = Number(value);
                setPageSize(newSize);
                table.setPageSize(newSize);
              }}
            >
              <SelectTrigger className="h-7 w-[70px] text-xs font-medium bg-background/70 border-border/50">
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
              className="h-7 w-7 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
              onClick={() => setPageIndex(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 px-3 text-xs font-medium min-w-[90px] justify-center bg-background/70 h-7 rounded-md border border-border/40">
              <span className="text-primary font-semibold tabular-nums">{pageIndex + 1}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="tabular-nums">{totalPages}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
              onClick={() => setPageIndex(pageIndex + 1)}
              disabled={pageIndex >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ColumnStatisticsDialog columns={columnsWithPK} data={tableData} />
      <BinaryPreviewDialog />
    </div>
  );
}
