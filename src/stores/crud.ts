import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PendingChange, ColumnInfo } from "@/types";

export type CommitMode = "staged" | "immediate";

// Column filter configuration
export interface ColumnFilter {
  columnId: string;
  value: string;
  operator?: "contains" | "equals" | "startsWith" | "endsWith" | "gt" | "lt" | "gte" | "lte";
}

// Selection with full context for multi-table editing
export interface SelectedRow {
  rowId: string;
  tableName: string;
  rowData: Record<string, unknown>;
  columns: ColumnInfo[];
}

// State for creating a new row
export interface CreatingNewRow {
  tableName: string;
  columns: ColumnInfo[];
  data: Record<string, unknown>;
}

interface CRUDState {
  // Selection with context
  selectedRows: SelectedRow[];
  // Legacy: derived list of row IDs for backwards compatibility
  selectedRowIds: string[];

  // Inline editing
  editingCell: { rowId: string; columnId: string } | null;

  // Creating a new row (side panel create mode)
  creatingNewRow: CreatingNewRow | null;

  // Changes management
  pendingChanges: Record<string, PendingChange>; // Keyed by rowId
  commitMode: CommitMode;

  // Counter for generating unique temporary row IDs
  newRowCounter: number;

  // Client-side Pagination
  pageSize: number;
  pageIndex: number;

  // Column filtering
  columnFilters: Record<string, ColumnFilter>;

  // Actions
  setSelectedRowIds: (ids: string[]) => void;
  setSelectedRows: (rows: SelectedRow[]) => void;
  addSelectedRow: (row: SelectedRow) => void;
  removeSelectedRow: (rowId: string) => void;
  toggleRowSelection: (row: SelectedRow) => void;
  clearSelection: () => void;

  setEditingCell: (cell: { rowId: string; columnId: string } | null) => void;

  // Creating new row actions
  startCreatingRow: (tableName: string, columns: ColumnInfo[]) => void;
  updateCreatingRowField: (fieldName: string, value: unknown) => void;
  cancelCreatingRow: () => void;
  saveCreatingRow: () => void;

  addPendingChange: (change: PendingChange) => void;
  removePendingChange: (rowId: string) => void;
  clearPendingChanges: () => void;
  markSelectedForDeletion: (tableName: string, columns: ColumnInfo[]) => void;

  setCommitMode: (mode: CommitMode) => void;
  setPageSize: (size: number) => void;
  setPageIndex: (index: number) => void;

  setColumnFilter: (filter: ColumnFilter) => void;
  clearColumnFilter: (columnId: string) => void;
  clearAllFilters: () => void;
}

export const useCRUDStore = create<CRUDState>()(
  persist(
    (set) => ({
      selectedRows: [],
      selectedRowIds: [],
      editingCell: null,
      creatingNewRow: null,
      pendingChanges: {},
      commitMode: "staged",
      newRowCounter: 0,
      pageSize: 50,
      pageIndex: 0,
      columnFilters: {},

      setSelectedRowIds: (selectedRowIds) => set({ selectedRowIds }),

      setSelectedRows: (rows) =>
        set({
          selectedRows: rows,
          selectedRowIds: rows.map(r => r.rowId),
        }),

      addSelectedRow: (row) =>
        set((state) => {
          // Don't add if already selected
          if (state.selectedRows.some(r => r.rowId === row.rowId)) {
            return state;
          }
          const newSelectedRows = [...state.selectedRows, row];
          return {
            selectedRows: newSelectedRows,
            selectedRowIds: newSelectedRows.map(r => r.rowId),
          };
        }),
      
      removeSelectedRow: (rowId) =>
        set((state) => {
          const newSelectedRows = state.selectedRows.filter(r => r.rowId !== rowId);
          return {
            selectedRows: newSelectedRows,
            selectedRowIds: newSelectedRows.map(r => r.rowId),
          };
        }),
      
      toggleRowSelection: (row) =>
        set((state) => {
          const exists = state.selectedRows.some(r => r.rowId === row.rowId);
          const newSelectedRows = exists
            ? state.selectedRows.filter(r => r.rowId !== row.rowId)
            : [...state.selectedRows, row];
          return {
            selectedRows: newSelectedRows,
            selectedRowIds: newSelectedRows.map(r => r.rowId),
          };
        }),
        
      clearSelection: () => set({ selectedRows: [], selectedRowIds: [] }),

      setEditingCell: (editingCell) => set({ editingCell }),

      // Creating new row actions
      startCreatingRow: (tableName, columns) =>
        set({
          creatingNewRow: {
            tableName,
            columns,
            data: columns.reduce((acc, col) => {
              const dataType = col.dataType.toLowerCase();

              // Check if column is auto-increment
              const isAutoIncrement =
                dataType.includes("serial") ||
                dataType.includes("identity") ||
                dataType.includes("auto_increment") ||
                dataType.includes("autoincrement");

              if (isAutoIncrement) {
                // Auto-increment columns should be null (auto-generated by DB)
                acc[col.name] = null;
              } else if (dataType.includes("int") || dataType.includes("numeric") ||
                         dataType.includes("decimal") || dataType.includes("float") ||
                         dataType.includes("double") || dataType.includes("real")) {
                // Numeric types: null to allow user input or NULL toggle
                acc[col.name] = null;
              } else if (dataType.includes("bool") || dataType === "bit") {
                // Boolean: default to false
                acc[col.name] = false;
              } else if (dataType.includes("date") || dataType.includes("time") ||
                         dataType.includes("timestamp")) {
                // DateTime: null to allow user to pick or use NULL
                acc[col.name] = null;
              } else {
                // Text and other types: empty string so field is editable
                acc[col.name] = "";
              }
              return acc;
            }, {} as Record<string, unknown>),
          },
          // Clear selection when starting to create a new row
          selectedRows: [],
          selectedRowIds: [],
        }),

      updateCreatingRowField: (fieldName, value) =>
        set((state) => {
          if (!state.creatingNewRow) return state;
          return {
            creatingNewRow: {
              ...state.creatingNewRow,
              data: {
                ...state.creatingNewRow.data,
                [fieldName]: value,
              },
            },
          };
        }),

      cancelCreatingRow: () => set({ creatingNewRow: null }),

      saveCreatingRow: () =>
        set((state) => {
          if (!state.creatingNewRow) return state;

          const { tableName, data } = state.creatingNewRow;

          // Generate a unique temporary ID for the new row
          const tempId = `__new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const primaryKey: Record<string, unknown> = { __temp_id: tempId };

          const newChange: PendingChange = {
            id: crypto.randomUUID(),
            tableName,
            type: "insert",
            newData: data,
            primaryKey,
          };

          return {
            creatingNewRow: null,
            pendingChanges: {
              ...state.pendingChanges,
              [JSON.stringify(primaryKey)]: newChange,
            },
          };
        }),

      addPendingChange: (change) =>
        set((state) => {
          const rowId = JSON.stringify(change.primaryKey);
          return {
            pendingChanges: {
              ...state.pendingChanges,
              [rowId]: change,
            },
          };
        }),

      removePendingChange: (rowId) =>
        set((state) => {
          const newChanges = { ...state.pendingChanges };
          delete newChanges[rowId];
          return { pendingChanges: newChanges };
        }),

      clearPendingChanges: () => set({ pendingChanges: {} }),

      markSelectedForDeletion: (tableName, columns) =>
        set((state) => {
          const newChanges = { ...state.pendingChanges };
          const pkColumns = columns.filter((c) => c.isPrimaryKey).sort((a, b) => a.name.localeCompare(b.name));

          for (const row of state.selectedRows) {
            // Build primary key with sorted keys
            const primaryKey: Record<string, unknown> = {};
            if (pkColumns.length > 0) {
              pkColumns.forEach((c) => {
                primaryKey[c.name] = row.rowData[c.name];
              });
            } else {
              // Fallback: use all columns sorted by name
              const sortedKeys = Object.keys(row.rowData).sort();
              sortedKeys.forEach((k) => {
                primaryKey[k] = row.rowData[k];
              });
            }

            const rowId = JSON.stringify(primaryKey);
            newChanges[rowId] = {
              id: crypto.randomUUID(),
              tableName,
              type: "delete",
              originalData: row.rowData,
              primaryKey,
            };
          }

          return {
            pendingChanges: newChanges,
            selectedRows: [],
            selectedRowIds: [],
          };
        }),

      setCommitMode: (commitMode) => set({ commitMode }),

      setPageSize: (pageSize) => set({ pageSize, pageIndex: 0 }),
      setPageIndex: (pageIndex) => set({ pageIndex }),

      setColumnFilter: (filter) =>
        set((state) => ({
          columnFilters: {
            ...state.columnFilters,
            [filter.columnId]: filter,
          },
          pageIndex: 0, // Reset to first page when filtering
        })),

      clearColumnFilter: (columnId) =>
        set((state) => {
          const newFilters = { ...state.columnFilters };
          delete newFilters[columnId];
          return { columnFilters: newFilters };
        }),

      clearAllFilters: () => set({ columnFilters: {} }),
    }),
    {
      name: "dbfordevs-crud",
      partialize: (state) => ({
        commitMode: state.commitMode,
        pageSize: state.pageSize,
      }),
    }
  )
);

