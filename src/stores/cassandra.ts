import { create } from "zustand";
import type {
  CassandraKeyspaceInfo,
  CassandraTableInfo,
  CassandraColumnInfo,
  CassandraIndexInfo,
  CassandraServerInfo,
  CassandraShellHistoryEntry,
} from "@/types";

interface CassandraState {
  // Keyspaces by connection
  keyspacesByConnection: Record<string, CassandraKeyspaceInfo[]>;

  // Tables by keyspace (key = `${connectionId}:${keyspace}`)
  tablesByKeyspace: Record<string, CassandraTableInfo[]>;

  // Columns by table (key = `${connectionId}:${keyspace}:${table}`)
  columnsByTable: Record<string, CassandraColumnInfo[]>;

  // Selected keyspace per connection
  selectedKeyspaceByConnection: Record<string, string | null>;

  // Selected table per connection
  selectedTableByConnection: Record<string, string | null>;

  // Highlighted item for search navigation
  highlightedItemByConnection: Record<string, {
    type: "keyspace" | "table" | "column" | "index";
    keyspace?: string;
    table?: string;
    name: string;
  } | null>;

  // Rows by table (key = `${connectionId}:${keyspace}:${table}`)
  rowsByTable: Record<string, unknown[]>;

  // Row count by table (for pagination)
  rowCountByTable: Record<string, number>;

  // Indexes by keyspace (key = `${connectionId}:${keyspace}`)
  indexesByKeyspace: Record<string, CassandraIndexInfo[]>;

  // Server info per connection
  serverInfoByConnection: Record<string, CassandraServerInfo | null>;

  // Shell history per connection (limited to last 50)
  shellHistoryByConnection: Record<string, CassandraShellHistoryEntry[]>;

  // Paging state by table for pagination
  pagingStateByTable: Record<string, string | null>;

  // Loading states
  loading: boolean;
  loadingKeyspaces: boolean;
  loadingTables: boolean;
  loadingRows: boolean;

  // Error state
  error: string | null;

  // Actions - Keyspaces
  setKeyspaces: (connectionId: string, keyspaces: CassandraKeyspaceInfo[]) => void;
  clearKeyspaces: (connectionId: string) => void;

  // Actions - Tables
  setTables: (connectionId: string, keyspace: string, tables: CassandraTableInfo[]) => void;
  clearTables: (connectionId: string, keyspace: string) => void;

  // Actions - Columns
  setColumns: (connectionId: string, keyspace: string, table: string, columns: CassandraColumnInfo[]) => void;
  clearColumns: (connectionId: string, keyspace: string, table: string) => void;

  // Actions - Selected keyspace/table
  setSelectedKeyspace: (connectionId: string, keyspace: string | null) => void;
  setSelectedTable: (connectionId: string, table: string | null) => void;

  // Actions - Highlighted item (for search navigation)
  setHighlightedItem: (connectionId: string, item: {
    type: "keyspace" | "table" | "column" | "index";
    keyspace?: string;
    table?: string;
    name: string;
  } | null) => void;
  clearHighlightedItem: (connectionId: string) => void;

  // Actions - Rows
  setRows: (connectionId: string, keyspace: string, table: string, rows: unknown[], totalCount: number, pagingState?: string | null) => void;
  clearRows: (connectionId: string, keyspace: string, table: string) => void;

  // Actions - Indexes
  setIndexes: (connectionId: string, keyspace: string, indexes: CassandraIndexInfo[]) => void;

  // Actions - Server info
  setServerInfo: (connectionId: string, info: CassandraServerInfo | null) => void;

  // Actions - Shell history
  addShellHistoryEntry: (connectionId: string, entry: CassandraShellHistoryEntry) => void;
  clearShellHistory: (connectionId: string) => void;

  // Actions - Loading states
  setLoading: (loading: boolean) => void;
  setLoadingKeyspaces: (loading: boolean) => void;
  setLoadingTables: (loading: boolean) => void;
  setLoadingRows: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Clear all data for a connection
  clearConnectionData: (connectionId: string) => void;
}

const MAX_SHELL_HISTORY = 50;

// Helper to create table key
const tableKey = (connectionId: string, keyspace: string, table: string) =>
  `${connectionId}:${keyspace}:${table}`;

const keyspaceKey = (connectionId: string, keyspace: string) =>
  `${connectionId}:${keyspace}`;

export const useCassandraStore = create<CassandraState>()((set) => ({
  // Initial state
  keyspacesByConnection: {},
  tablesByKeyspace: {},
  columnsByTable: {},
  selectedKeyspaceByConnection: {},
  selectedTableByConnection: {},
  highlightedItemByConnection: {},
  rowsByTable: {},
  rowCountByTable: {},
  indexesByKeyspace: {},
  serverInfoByConnection: {},
  shellHistoryByConnection: {},
  pagingStateByTable: {},
  loading: false,
  loadingKeyspaces: false,
  loadingTables: false,
  loadingRows: false,
  error: null,

  // Keyspaces
  setKeyspaces: (connectionId, keyspaces) =>
    set((state) => ({
      keyspacesByConnection: {
        ...state.keyspacesByConnection,
        [connectionId]: keyspaces,
      },
    })),

  clearKeyspaces: (connectionId) =>
    set((state) => {
      const newKeyspaces = { ...state.keyspacesByConnection };
      delete newKeyspaces[connectionId];
      return { keyspacesByConnection: newKeyspaces };
    }),

  // Tables
  setTables: (connectionId, keyspace, tables) =>
    set((state) => ({
      tablesByKeyspace: {
        ...state.tablesByKeyspace,
        [keyspaceKey(connectionId, keyspace)]: tables,
      },
    })),

  clearTables: (connectionId, keyspace) =>
    set((state) => {
      const newTables = { ...state.tablesByKeyspace };
      delete newTables[keyspaceKey(connectionId, keyspace)];
      return { tablesByKeyspace: newTables };
    }),

  // Columns
  setColumns: (connectionId, keyspace, table, columns) =>
    set((state) => ({
      columnsByTable: {
        ...state.columnsByTable,
        [tableKey(connectionId, keyspace, table)]: columns,
      },
    })),

  clearColumns: (connectionId, keyspace, table) =>
    set((state) => {
      const newColumns = { ...state.columnsByTable };
      delete newColumns[tableKey(connectionId, keyspace, table)];
      return { columnsByTable: newColumns };
    }),

  // Selected keyspace/table
  setSelectedKeyspace: (connectionId, keyspace) =>
    set((state) => ({
      selectedKeyspaceByConnection: {
        ...state.selectedKeyspaceByConnection,
        [connectionId]: keyspace,
      },
    })),

  setSelectedTable: (connectionId, table) =>
    set((state) => ({
      selectedTableByConnection: {
        ...state.selectedTableByConnection,
        [connectionId]: table,
      },
    })),

  // Highlighted item (for search navigation)
  setHighlightedItem: (connectionId, item) =>
    set((state) => ({
      highlightedItemByConnection: {
        ...state.highlightedItemByConnection,
        [connectionId]: item,
      },
    })),

  clearHighlightedItem: (connectionId) =>
    set((state) => ({
      highlightedItemByConnection: {
        ...state.highlightedItemByConnection,
        [connectionId]: null,
      },
    })),

  // Rows
  setRows: (connectionId, keyspace, table, rows, totalCount, pagingState) =>
    set((state) => {
      const key = tableKey(connectionId, keyspace, table);
      return {
        rowsByTable: {
          ...state.rowsByTable,
          [key]: rows,
        },
        rowCountByTable: {
          ...state.rowCountByTable,
          [key]: totalCount,
        },
        pagingStateByTable: {
          ...state.pagingStateByTable,
          [key]: pagingState ?? null,
        },
      };
    }),

  clearRows: (connectionId, keyspace, table) =>
    set((state) => {
      const key = tableKey(connectionId, keyspace, table);
      const newRows = { ...state.rowsByTable };
      delete newRows[key];
      const newCounts = { ...state.rowCountByTable };
      delete newCounts[key];
      const newPaging = { ...state.pagingStateByTable };
      delete newPaging[key];
      return {
        rowsByTable: newRows,
        rowCountByTable: newCounts,
        pagingStateByTable: newPaging,
      };
    }),

  // Indexes
  setIndexes: (connectionId, keyspace, indexes) =>
    set((state) => ({
      indexesByKeyspace: {
        ...state.indexesByKeyspace,
        [keyspaceKey(connectionId, keyspace)]: indexes,
      },
    })),

  // Server info
  setServerInfo: (connectionId, info) =>
    set((state) => ({
      serverInfoByConnection: {
        ...state.serverInfoByConnection,
        [connectionId]: info,
      },
    })),

  // Shell history
  addShellHistoryEntry: (connectionId, entry) =>
    set((state) => {
      const existing = state.shellHistoryByConnection[connectionId] || [];
      const updated = [...existing, entry].slice(-MAX_SHELL_HISTORY);
      return {
        shellHistoryByConnection: {
          ...state.shellHistoryByConnection,
          [connectionId]: updated,
        },
      };
    }),

  clearShellHistory: (connectionId) =>
    set((state) => ({
      shellHistoryByConnection: {
        ...state.shellHistoryByConnection,
        [connectionId]: [],
      },
    })),

  // Loading states
  setLoading: (loading) => set({ loading }),
  setLoadingKeyspaces: (loadingKeyspaces) => set({ loadingKeyspaces }),
  setLoadingTables: (loadingTables) => set({ loadingTables }),
  setLoadingRows: (loadingRows) => set({ loadingRows }),

  // Error state
  setError: (error) => set({ error }),

  // Clear all data for a connection
  clearConnectionData: (connectionId) =>
    set((state) => {
      // Helper to filter out keys starting with connectionId
      const filterByConnectionId = <T>(record: Record<string, T>): Record<string, T> => {
        const result: Record<string, T> = {};
        for (const [key, value] of Object.entries(record)) {
          if (!key.startsWith(connectionId + ":") && key !== connectionId) {
            result[key] = value;
          }
        }
        return result;
      };

      return {
        keyspacesByConnection: filterByConnectionId(state.keyspacesByConnection),
        tablesByKeyspace: filterByConnectionId(state.tablesByKeyspace),
        columnsByTable: filterByConnectionId(state.columnsByTable),
        selectedKeyspaceByConnection: filterByConnectionId(state.selectedKeyspaceByConnection),
        selectedTableByConnection: filterByConnectionId(state.selectedTableByConnection),
        highlightedItemByConnection: filterByConnectionId(state.highlightedItemByConnection),
        rowsByTable: filterByConnectionId(state.rowsByTable),
        rowCountByTable: filterByConnectionId(state.rowCountByTable),
        indexesByKeyspace: filterByConnectionId(state.indexesByKeyspace),
        serverInfoByConnection: filterByConnectionId(state.serverInfoByConnection),
        shellHistoryByConnection: filterByConnectionId(state.shellHistoryByConnection),
        pagingStateByTable: filterByConnectionId(state.pagingStateByTable),
      };
    }),
}));
