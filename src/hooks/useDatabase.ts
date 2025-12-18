import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useConnectionsStore, useQueryStore } from "@/stores";
import type {
  ConnectionConfig,
  ConnectionInfo,
  TestConnectionResult,
  QueryRequest,
  QueryResult,
  TableInfo,
  TableSchema,
} from "@/types";

/**
 * Hook for database operations via Tauri commands
 */
export function useDatabase() {
  const {
    setConnections,
    addConnection,
    removeConnection,
    setLoading,
    setConnecting,
    setError: setConnectionError,
  } = useConnectionsStore();

  const {
    setResults,
    setTables,
    setTableSchema,
    setExecuting,
    setError: setQueryError,
  } = useQueryStore();

  /**
   * Test a database connection
   */
  const testConnection = useCallback(
    async (config: ConnectionConfig): Promise<TestConnectionResult> => {
      setConnecting(true);
      setConnectionError(null);

      try {
        const result = await invoke<TestConnectionResult>("test_connection", {
          config,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return {
          success: false,
          message,
        };
      } finally {
        setConnecting(false);
      }
    },
    [setConnecting, setConnectionError]
  );

  /**
   * Save a connection configuration
   */
  const saveConnection = useCallback(
    async (config: ConnectionConfig): Promise<ConnectionInfo | null> => {
      setLoading(true);
      setConnectionError(null);

      try {
        const result = await invoke<ConnectionInfo>("save_connection", {
          config,
        });
        addConnection(result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setConnectionError, addConnection]
  );

  /**
   * Load all saved connections
   */
  const loadConnections = useCallback(async (): Promise<void> => {
    setLoading(true);
    setConnectionError(null);

    try {
      const connections = await invoke<ConnectionInfo[]>("list_connections");
      setConnections(connections);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConnectionError(message);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setConnectionError, setConnections]);

  /**
   * Delete a connection
   */
  const deleteConnection = useCallback(
    async (connectionId: string): Promise<boolean> => {
      setLoading(true);
      setConnectionError(null);

      try {
        await invoke("delete_connection", { connectionId });
        removeConnection(connectionId);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setConnectionError, removeConnection]
  );

  /**
   * Execute a SQL query
   */
  const executeQuery = useCallback(
    async (request: QueryRequest, tabId: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("execute_query", { request });
        setResults(tabId, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError, setResults]
  );

  /**
   * Get tables for a connection
   */
  const getTables = useCallback(
    async (connectionId: string): Promise<TableInfo[]> => {
      setLoading(true);
      setQueryError(null);

      try {
        const tables = await invoke<TableInfo[]>("get_tables", { connectionId });
        setTables(tables);
        return tables;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setQueryError, setTables]
  );

  /**
   * Get schema for a specific table
   */
  const getTableSchema = useCallback(
    async (connectionId: string, tableName: string): Promise<TableSchema | null> => {
      setLoading(true);
      setQueryError(null);

      try {
        const schema = await invoke<TableSchema>("get_table_schema", {
          connectionId,
          tableName,
        });
        setTableSchema(schema);
        return schema;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setQueryError, setTableSchema]
  );

  return {
    testConnection,
    saveConnection,
    loadConnections,
    deleteConnection,
    executeQuery,
    getTables,
    getTableSchema,
  };
}

