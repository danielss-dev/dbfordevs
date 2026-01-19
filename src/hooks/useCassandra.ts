import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useCassandraStore } from "@/stores";
import type {
  CassandraKeyspaceInfo,
  CassandraTableInfo,
  CassandraColumnInfo,
  CassandraQueryResult,
  CassandraIndexInfo,
  CassandraServerInfo,
  CassandraShellHistoryEntry,
  CassandraConsistencyLevel,
} from "@/types";

/**
 * Hook for Cassandra operations via Tauri commands
 */
export function useCassandra() {
  const {
    setKeyspaces,
    clearKeyspaces,
    setTables,
    clearTables,
    setColumns,
    clearColumns,
    setSelectedKeyspace,
    setSelectedTable,
    setRows,
    clearRows,
    setIndexes,
    setServerInfo,
    addShellHistoryEntry,
    clearShellHistory,
    setLoading,
    setLoadingKeyspaces,
    setLoadingTables,
    setLoadingRows,
    setError,
  } = useCassandraStore();

  // ===== Keyspace Operations =====

  /**
   * List all keyspaces
   */
  const listKeyspaces = useCallback(
    async (connectionId: string): Promise<CassandraKeyspaceInfo[] | null> => {
      setLoadingKeyspaces(true);
      setError(null);

      try {
        const result = await invoke<CassandraKeyspaceInfo[]>("cassandra_list_keyspaces", {
          connectionId,
        });
        setKeyspaces(connectionId, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingKeyspaces(false);
      }
    },
    [setLoadingKeyspaces, setError, setKeyspaces]
  );

  /**
   * Create a new keyspace
   */
  const createKeyspace = useCallback(
    async (
      connectionId: string,
      name: string,
      replicationStrategy: string = "SimpleStrategy",
      replicationFactor: number = 1,
      durableWrites: boolean = true
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("cassandra_create_keyspace", {
          connectionId,
          name,
          replicationStrategy,
          replicationFactor,
          durableWrites,
        });

        if (result) {
          // Refresh keyspaces list
          await listKeyspaces(connectionId);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, listKeyspaces]
  );

  /**
   * Drop a keyspace
   */
  const dropKeyspace = useCallback(
    async (connectionId: string, keyspace: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("cassandra_drop_keyspace", {
          connectionId,
          keyspace,
        });

        if (result) {
          // Refresh keyspaces list
          await listKeyspaces(connectionId);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, listKeyspaces]
  );

  // ===== Table Operations =====

  /**
   * List tables in a keyspace
   */
  const listTables = useCallback(
    async (connectionId: string, keyspace: string): Promise<CassandraTableInfo[] | null> => {
      setLoadingTables(true);
      setError(null);

      try {
        const result = await invoke<CassandraTableInfo[]>("cassandra_list_tables", {
          connectionId,
          keyspace,
        });
        setTables(connectionId, keyspace, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingTables(false);
      }
    },
    [setLoadingTables, setError, setTables]
  );

  /**
   * Describe table columns
   */
  const describeTable = useCallback(
    async (
      connectionId: string,
      keyspace: string,
      table: string
    ): Promise<CassandraColumnInfo[] | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<CassandraColumnInfo[]>("cassandra_describe_table", {
          connectionId,
          keyspace,
          table,
        });
        setColumns(connectionId, keyspace, table, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setColumns]
  );

  /**
   * Drop a table
   */
  const dropTable = useCallback(
    async (connectionId: string, keyspace: string, table: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("cassandra_drop_table", {
          connectionId,
          keyspace,
          table,
        });

        if (result) {
          // Refresh tables list
          await listTables(connectionId, keyspace);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, listTables]
  );

  /**
   * Truncate a table
   */
  const truncateTable = useCallback(
    async (connectionId: string, keyspace: string, table: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("cassandra_truncate_table", {
          connectionId,
          keyspace,
          table,
        });

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  // ===== Query Operations =====

  /**
   * Execute a CQL query
   */
  const executeCql = useCallback(
    async (
      connectionId: string,
      cql: string,
      keyspace?: string,
      pageSize: number = 100,
      pagingState?: string,
      consistency?: CassandraConsistencyLevel
    ): Promise<CassandraQueryResult | null> => {
      setLoadingRows(true);
      setError(null);

      const startTime = Date.now();

      try {
        const result = await invoke<CassandraQueryResult>("cassandra_execute_cql", {
          connectionId,
          keyspace,
          cql,
          pageSize,
          pagingState,
          consistency,
        });

        // If we have keyspace and it looks like a SELECT on a specific table,
        // update the rows in store
        if (keyspace) {
          // Try to extract table name from simple SELECT queries
          // Handle both "FROM table" and "FROM keyspace.table" formats
          const selectMatch = cql.match(/SELECT\s+.*\s+FROM\s+(?:(\w+)\.)?(\w+)/i);
          if (selectMatch) {
            // selectMatch[1] is keyspace (optional), selectMatch[2] is table name
            const tableName = selectMatch[2];
            // Parse JSON rows
            const parsedRows = result.rows.map((row) => {
              try {
                return JSON.parse(row);
              } catch {
                return { _raw: row };
              }
            });
            setRows(connectionId, keyspace, tableName, parsedRows, result.rowCount, result.pagingState);
          }
        }

        // Add to shell history
        const historyEntry: CassandraShellHistoryEntry = {
          id: crypto.randomUUID(),
          cql,
          output: JSON.stringify(result.rows.slice(0, 5), null, 2) + (result.rows.length > 5 ? `\n... and ${result.rows.length - 5} more rows` : ""),
          executionTimeMs: result.executionTimeMs,
          timestamp: startTime,
        };
        addShellHistoryEntry(connectionId, historyEntry);

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);

        // Add failed command to history
        const historyEntry: CassandraShellHistoryEntry = {
          id: crypto.randomUUID(),
          cql,
          output: "",
          executionTimeMs: Date.now() - startTime,
          error: message,
          timestamp: startTime,
        };
        addShellHistoryEntry(connectionId, historyEntry);

        return null;
      } finally {
        setLoadingRows(false);
      }
    },
    [setLoadingRows, setError, setRows, addShellHistoryEntry]
  );

  /**
   * Query rows from a table (convenience wrapper around executeCql)
   */
  const queryTable = useCallback(
    async (
      connectionId: string,
      keyspace: string,
      table: string,
      limit: number = 100,
      pagingState?: string
    ): Promise<CassandraQueryResult | null> => {
      setLoadingRows(true);
      setError(null);

      try {
        const cql = `SELECT * FROM ${keyspace}.${table} LIMIT ${limit}`;
        const result = await invoke<CassandraQueryResult>("cassandra_execute_cql", {
          connectionId,
          keyspace,
          cql,
          pageSize: limit,
          pagingState,
        });

        // Parse JSON rows and store directly with known table name
        const parsedRows = result.rows.map((row) => {
          try {
            return JSON.parse(row);
          } catch {
            return { _raw: row };
          }
        });

        setRows(connectionId, keyspace, table, parsedRows, result.rowCount, result.pagingState);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingRows(false);
      }
    },
    [setLoadingRows, setError, setRows]
  );

  // ===== Index Operations =====

  /**
   * List indexes in a keyspace
   */
  const listIndexes = useCallback(
    async (connectionId: string, keyspace: string): Promise<CassandraIndexInfo[] | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<CassandraIndexInfo[]>("cassandra_list_indexes", {
          connectionId,
          keyspace,
        });
        setIndexes(connectionId, keyspace, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setIndexes]
  );

  // ===== Server Operations =====

  /**
   * Get server information
   */
  const getServerInfo = useCallback(
    async (connectionId: string): Promise<CassandraServerInfo | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<CassandraServerInfo>("cassandra_get_server_info", {
          connectionId,
        });
        setServerInfo(connectionId, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setServerInfo]
  );

  return {
    // Keyspace operations
    listKeyspaces,
    createKeyspace,
    dropKeyspace,

    // Table operations
    listTables,
    describeTable,
    dropTable,
    truncateTable,

    // Query operations
    executeCql,
    queryTable,

    // Index operations
    listIndexes,

    // Server operations
    getServerInfo,

    // Store actions
    setSelectedKeyspace,
    setSelectedTable,
    clearKeyspaces,
    clearTables,
    clearColumns,
    clearRows,
    clearShellHistory,
  };
}
