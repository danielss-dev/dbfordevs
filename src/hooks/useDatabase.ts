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
  TableProperties,
  TableRelationship,
} from "@/types";

/**
 * Hook for database operations via Tauri commands
 */
export function useDatabase() {
  const {
    setConnections,
    addConnection,
    removeConnection,
    updateConnection,
    setActiveConnection,
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
   * Connect to a database
   */
  const connect = useCallback(
    async (connectionId: string): Promise<boolean> => {
      setConnecting(true);
      setConnectionError(null);

      try {
        await invoke("connect", { connectionId });
        updateConnection(connectionId, { connected: true });
        setActiveConnection(connectionId);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [setConnecting, setConnectionError, updateConnection, setActiveConnection]
  );

  /**
   * Disconnect from a database
   */
  const disconnect = useCallback(
    async (connectionId: string): Promise<boolean> => {
      setConnecting(true);
      setConnectionError(null);

      try {
        await invoke("disconnect", { connectionId });
        updateConnection(connectionId, { connected: false });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [setConnecting, setConnectionError, updateConnection]
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
   * Get a connection configuration by ID
   */
  const getConnection = useCallback(
    async (connectionId: string): Promise<ConnectionConfig | null> => {
      try {
        const config = await invoke<ConnectionConfig | null>("get_connection", {
          connectionId,
        });
        return config;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return null;
      }
    },
    [setConnectionError]
  );

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

  /**
   * Insert a new row
   */
  const insertRow = useCallback(
    async (
      connectionId: string,
      tableName: string,
      values: Record<string, unknown>
    ): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("insert_row", {
          connectionId,
          tableName,
          values,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Update a row
   */
  const updateRow = useCallback(
    async (
      connectionId: string,
      tableName: string,
      primaryKey: Record<string, unknown>,
      values: Record<string, unknown>
    ): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("update_row", {
          connectionId,
          tableName,
          primaryKey,
          values,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Delete a row
   */
  const deleteRow = useCallback(
    async (
      connectionId: string,
      tableName: string,
      primaryKey: Record<string, unknown>
    ): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("delete_row", {
          connectionId,
          tableName,
          primaryKey,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Drop a table
   */
  const dropTable = useCallback(
    async (connectionId: string, tableName: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("drop_table", {
          connectionId,
          tableName,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Generate CREATE TABLE DDL for a table
   */
  const generateTableDdl = useCallback(
    async (connectionId: string, tableName: string): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("generate_table_ddl", {
          connectionId,
          tableName,
        });
        return ddl;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      }
    },
    [setQueryError]
  );

  /**
   * Rename a table
   */
  const renameTable = useCallback(
    async (connectionId: string, oldName: string, newName: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("rename_table", {
          connectionId,
          oldName,
          newName,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Get full table properties including extended column info, indexes, and constraints
   */
  const getTableProperties = useCallback(
    async (connectionId: string, tableName: string): Promise<TableProperties | null> => {
      try {
        const properties = await invoke<TableProperties>("get_table_properties", {
          connectionId,
          tableName,
        });
        return properties;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      }
    },
    [setQueryError]
  );

  /**
   * Get table relationships (foreign keys both inbound and outbound)
   */
  const getTableRelationships = useCallback(
    async (connectionId: string, tableName: string): Promise<TableRelationship[]> => {
      try {
        const relationships = await invoke<TableRelationship[]>("get_table_relationships", {
          connectionId,
          tableName,
        });
        return relationships;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  return {
    testConnection,
    saveConnection,
    connect,
    disconnect,
    loadConnections,
    getConnection,
    deleteConnection,
    executeQuery,
    getTables,
    getTableSchema,
    insertRow,
    updateRow,
    deleteRow,
    dropTable,
    generateTableDdl,
    renameTable,
    getTableProperties,
    getTableRelationships,
  };
}

