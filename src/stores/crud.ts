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

interface CRUDState {
  // Selection with context
  selectedRows: SelectedRow[];
  // Legacy: derived list of row IDs for backwards compatibility
  selectedRowIds: string[];
  
  // Inline editing
  editingCell: { rowId: string; columnId: string } | null;
  
  // Changes management
  pendingChanges: Record<string, PendingChange>; // Keyed by rowId
  commitMode: CommitMode;
  
  // Client-side Pagination
  pageSize: number;
  pageIndex: number;

  // Column filtering
  columnFilters: Record<string, ColumnFilter>;

  // Actions
  setSelectedRowIds: (ids: string[]) => void;
  addSelectedRow: (row: SelectedRow) => void;
  removeSelectedRow: (rowId: string) => void;
  toggleRowSelection: (row: SelectedRow) => void;
  clearSelection: () => void;
  
  setEditingCell: (cell: { rowId: string; columnId: string } | null) => void;
  
  addPendingChange: (change: PendingChange) => void;
  removePendingChange: (rowId: string) => void;
  clearPendingChanges: () => void;
  
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
      pendingChanges: {},
      commitMode: "staged",
      pageSize: 50,
      pageIndex: 0,
      columnFilters: {},

      setSelectedRowIds: (selectedRowIds) => set({ selectedRowIds }),
      
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

