import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useConnectionsStore, useQueryStore, useSchemaStore } from "@/stores";
import type {
  ConnectionConfig,
  ConnectionInfo,
  DatabaseInfo,
  TestConnectionResult,
  SslTestResult,
  SslSupportInfo,
  QueryRequest,
  QueryResult,
  TableInfo,
  TableSchema,
  TableProperties,
  TableRelationship,
  PreviewRequest,
  PreviewResult,
  ExplainRequest,
  ExplainResult,
  NewTableDefinition,
  TableReferenceInfo,
  // User management types
  DatabaseUser,
  DatabaseRole,
  DatabasePermission,
  AvailablePrivileges,
  CreateUserRequest,
  ChangePasswordRequest,
  CreateRoleRequest,
  PermissionRequest,
  RoleMembershipRequest,
  // View management types
  ViewInfo,
  NewViewDefinition,
  // Index management types
  StandaloneIndexInfo,
  CreateIndexDefinition,
  // Procedure management types
  ProcedureInfo,
  NewProcedureDefinition,
  // Function management types
  FunctionInfo,
  NewFunctionDefinition,
  // Trigger management types
  TriggerInfo,
  NewTriggerDefinition,
  // Sequence management types
  SequenceInfo,
  NewSequenceDefinition,
  // Schema diff types
  SchemaDiffRequest,
  SchemaDiffResult,
  CreateSnapshotRequest,
  SchemaSnapshot,
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
    setTablesForConnection,
    setTableSchema,
    setExecuting,
    setError: setQueryError,
  } = useQueryStore();

  const { setSchemas, clearSchemas } = useSchemaStore();

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
   * Test SSL/TLS connection and return detailed security information
   */
  const testSslConnection = useCallback(
    async (config: ConnectionConfig): Promise<SslTestResult> => {
      setConnecting(true);
      setConnectionError(null);

      try {
        const result = await invoke<SslTestResult>("test_ssl_connection", {
          config,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return {
          success: false,
          message,
          sslEnabled: false,
          supportsSsl: false,
          databaseType: config.databaseType,
        };
      } finally {
        setConnecting(false);
      }
    },
    [setConnecting, setConnectionError]
  );

  /**
   * Get SSL support information for all database types
   */
  const getSslSupportInfo = useCallback(async (): Promise<SslSupportInfo[]> => {
    try {
      return await invoke<SslSupportInfo[]>("get_ssl_support_info");
    } catch (error) {
      console.error("Failed to get SSL support info:", error);
      return [];
    }
  }, []);

  /**
   * Save a connection configuration
   */
  const saveConnection = useCallback(
    async (config: ConnectionConfig): Promise<ConnectionInfo | null> => {
      setLoading(true);
      setConnectionError(null);

      const isUpdate = !!config.id;

      try {
        const result = await invoke<ConnectionInfo>("save_connection", {
          config,
        });
        if (isUpdate) {
          // Update existing connection in store
          updateConnection(result.id, result);
        } else {
          // Add new connection to store
          addConnection(result);
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setConnectionError, addConnection, updateConnection]
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
        // Clear cached tables for deleted connection to prevent memory leak
        const { clearTablesForConnection } = useQueryStore.getState();
        clearTablesForConnection(connectionId);
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

        // If the error indicates connection is not found, sync the connection state
        if (message.includes("Connection not found") || message.includes("not connected")) {
          // Update the connection state to show it's disconnected
          updateConnection(request.connectionId, { connected: false });
        }

        return null;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError, setResults, updateConnection]
  );

  /**
   * Preview a SQL query (dry-run with rollback)
   */
  const previewQuery = useCallback(
    async (request: PreviewRequest): Promise<PreviewResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<PreviewResult>("preview_query", { request });
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
   * Get execution plan for a SQL query
   */
  const explainQuery = useCallback(
    async (request: ExplainRequest): Promise<ExplainResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<ExplainResult>("explain_query", { request });
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
   * Get tables for a connection
   */
  const getTables = useCallback(
    async (connectionId: string): Promise<TableInfo[]> => {
      setLoading(true);
      setQueryError(null);

      try {
        const tables = await invoke<TableInfo[]>("get_tables", { connectionId });
        setTablesForConnection(connectionId, tables);
        return tables;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);

        // If the error indicates connection is not found, sync the connection state
        if (message.includes("Connection not found") || message.includes("not connected")) {
          updateConnection(connectionId, { connected: false });
        }

        return [];
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setQueryError, setTablesForConnection, updateConnection]
  );

  /**
   * Get list of all databases for MSSQL connections (similar to SSMS Object Explorer)
   */
  const getMssqlDatabases = useCallback(
    async (connectionId: string): Promise<DatabaseInfo[]> => {
      setLoading(true);
      setQueryError(null);

      try {
        const databases = await invoke<DatabaseInfo[]>("get_mssql_databases", { connectionId });
        return databases;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setQueryError]
  );

  /**
   * Get tables from a specific database on MSSQL (allows browsing any database)
   */
  const getMssqlDatabaseTables = useCallback(
    async (connectionId: string, databaseName: string): Promise<TableInfo[]> => {
      try {
        const tables = await invoke<TableInfo[]>("get_mssql_database_tables", { connectionId, databaseName });
        return tables;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Create a new database on MSSQL server (only for generic connections without specific database)
   */
  const createMssqlDatabase = useCallback(
    async (connectionId: string, databaseName: string): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("create_mssql_database", { connectionId, databaseName });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Drop a database from MSSQL server (only for generic connections without specific database)
   * This will forcefully close all connections to the database before dropping
   */
  const dropMssqlDatabase = useCallback(
    async (connectionId: string, databaseName: string): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("drop_mssql_database", { connectionId, databaseName });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
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
        // Also cache in schema store for data grid primary key detection
        setSchemas(connectionId, tableName, schema);
        return schema;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setQueryError, setTableSchema, setSchemas]
  );

  /**
   * Fetch all table schemas for a connection and cache them
   */
  const fetchAllSchemas = useCallback(
    async (connectionId: string): Promise<void> => {
      setLoading(true);
      setQueryError(null);

      try {
        const schemas = await invoke<TableSchema[]>("get_all_table_schemas", {
          connectionId,
        });

        // Cache all schemas
        schemas.forEach((schema) => {
          setSchemas(connectionId, schema.tableName, schema);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setQueryError, setSchemas]
  );

  /**
   * Refresh all cached schemas for a connection
   */
  const refreshSchemas = useCallback(
    async (connectionId: string): Promise<void> => {
      clearSchemas(connectionId);
      await fetchAllSchemas(connectionId);
    },
    [clearSchemas, fetchAllSchemas]
  );

  /**
   * Insert a new row
   */
  const insertRow = useCallback(
    async (
      connectionId: string,
      tableName: string,
      values: Record<string, unknown>
    ): Promise<QueryResult> => {
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
        throw new Error(message);
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

  /**
   * Generate CREATE TABLE DDL from a table definition
   */
  const generateCreateTableDDL = useCallback(
    async (connectionId: string, tableDefinition: NewTableDefinition): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("generate_create_table_ddl", {
          connectionId,
          tableDefinition,
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
   * Create a new table from a table definition
   */
  const createTable = useCallback(
    async (connectionId: string, tableDefinition: NewTableDefinition): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("create_table", {
          connectionId,
          tableDefinition,
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
   * Get tables with their primary keys for foreign key reference picker
   */
  const getReferenceableTables = useCallback(
    async (connectionId: string): Promise<TableReferenceInfo[]> => {
      try {
        const tables = await invoke<TableReferenceInfo[]>("get_referenceable_tables", {
          connectionId,
        });
        return tables;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  // ============================================
  // User Management Methods
  // ============================================

  /**
   * Check if connection supports user management
   */
  const supportsUserManagement = useCallback(
    async (connectionId: string): Promise<boolean> => {
      try {
        const supports = await invoke<boolean>("supports_user_management", {
          connectionId,
        });
        return supports;
      } catch {
        return false;
      }
    },
    []
  );

  /**
   * Get all users for a connection
   */
  const getUsers = useCallback(
    async (connectionId: string): Promise<DatabaseUser[]> => {
      try {
        const users = await invoke<DatabaseUser[]>("get_users", {
          connectionId,
        });
        return users;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Create a new database user
   */
  const createUser = useCallback(
    async (connectionId: string, request: CreateUserRequest): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("create_user", { connectionId, request });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Delete a database user
   */
  const deleteUser = useCallback(
    async (connectionId: string, username: string, host?: string): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("delete_user", { connectionId, username, host });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Change a user's password
   */
  const changePassword = useCallback(
    async (connectionId: string, request: ChangePasswordRequest): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("change_password", { connectionId, request });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Get all roles for a connection
   */
  const getRoles = useCallback(
    async (connectionId: string): Promise<DatabaseRole[]> => {
      try {
        const roles = await invoke<DatabaseRole[]>("get_roles", {
          connectionId,
        });
        return roles;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Create a new role
   */
  const createRole = useCallback(
    async (connectionId: string, request: CreateRoleRequest): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("create_role", { connectionId, request });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Delete a role
   */
  const deleteRole = useCallback(
    async (connectionId: string, roleName: string): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("delete_role", { connectionId, roleName });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Get permissions for a grantee (user or role)
   */
  const getPermissions = useCallback(
    async (connectionId: string, grantee: string, host?: string): Promise<DatabasePermission[]> => {
      try {
        const permissions = await invoke<DatabasePermission[]>("get_permissions", {
          connectionId,
          grantee,
          host,
        });
        return permissions;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Get available privileges for a connection
   */
  const getAvailablePrivileges = useCallback(
    async (connectionId: string): Promise<AvailablePrivileges | null> => {
      try {
        const privileges = await invoke<AvailablePrivileges>("get_available_privileges", {
          connectionId,
        });
        return privileges;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return null;
      }
    },
    [setQueryError]
  );

  /**
   * Grant a permission to a user or role
   */
  const grantPermission = useCallback(
    async (connectionId: string, request: PermissionRequest): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("grant_permission", { connectionId, request });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Revoke a permission from a user or role
   */
  const revokePermission = useCallback(
    async (connectionId: string, request: PermissionRequest): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("revoke_permission", { connectionId, request });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Grant a role to a user
   */
  const grantRole = useCallback(
    async (connectionId: string, request: RoleMembershipRequest): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("grant_role", { connectionId, request });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  /**
   * Revoke a role from a user
   */
  const revokeRole = useCallback(
    async (connectionId: string, request: RoleMembershipRequest): Promise<boolean> => {
      setExecuting(true);
      setQueryError(null);

      try {
        await invoke("revoke_role", { connectionId, request });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return false;
      } finally {
        setExecuting(false);
      }
    },
    [setExecuting, setQueryError]
  );

  // ============================================
  // View Management Methods
  // ============================================

  /**
   * Get all views for a connection
   */
  const getViews = useCallback(
    async (connectionId: string): Promise<ViewInfo[]> => {
      try {
        const views = await invoke<ViewInfo[]>("get_views", { connectionId });
        return views;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Get DDL for a view
   */
  const getViewDdl = useCallback(
    async (connectionId: string, viewName: string): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("get_view_ddl", { connectionId, viewName });
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
   * Create a new view
   */
  const createView = useCallback(
    async (connectionId: string, viewDefinition: NewViewDefinition): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("create_view", {
          connectionId,
          viewDefinition,
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
   * Drop a view
   */
  const dropView = useCallback(
    async (connectionId: string, viewName: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("drop_view", { connectionId, viewName });
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

  // ============================================
  // Index Management Methods
  // ============================================

  /**
   * Get all indexes for a connection
   */
  const getAllIndexes = useCallback(
    async (connectionId: string): Promise<StandaloneIndexInfo[]> => {
      try {
        const indexes = await invoke<StandaloneIndexInfo[]>("get_all_indexes", { connectionId });
        return indexes;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Get DDL for an index
   */
  const getIndexDdl = useCallback(
    async (connectionId: string, indexName: string, tableName?: string): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("get_index_ddl", { connectionId, indexName, tableName });
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
   * Create a new index
   */
  const createIndex = useCallback(
    async (connectionId: string, indexDefinition: CreateIndexDefinition): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("create_index", {
          connectionId,
          indexDefinition,
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
   * Drop an index
   */
  const dropIndex = useCallback(
    async (connectionId: string, indexName: string, tableName?: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("drop_index", { connectionId, indexName, tableName });
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

  // ============================================
  // Stored Procedure Management Methods
  // ============================================

  /**
   * Get all stored procedures for a connection
   */
  const getProcedures = useCallback(
    async (connectionId: string): Promise<ProcedureInfo[]> => {
      try {
        const procedures = await invoke<ProcedureInfo[]>("get_procedures", { connectionId });
        return procedures;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Get DDL for a stored procedure
   */
  const getProcedureDdl = useCallback(
    async (connectionId: string, procedureName: string): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("get_procedure_ddl", { connectionId, procedureName });
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
   * Create a new stored procedure
   */
  const createProcedure = useCallback(
    async (connectionId: string, procedureDefinition: NewProcedureDefinition): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("create_procedure", {
          connectionId,
          procedureDefinition,
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
   * Drop a stored procedure
   */
  const dropProcedure = useCallback(
    async (connectionId: string, procedureName: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("drop_procedure", { connectionId, procedureName });
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

  // ============================================
  // Function Management Methods
  // ============================================

  /**
   * Get all functions for a connection
   */
  const getFunctions = useCallback(
    async (connectionId: string): Promise<FunctionInfo[]> => {
      try {
        const functions = await invoke<FunctionInfo[]>("get_functions", { connectionId });
        return functions;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Get DDL for a function
   */
  const getFunctionDdl = useCallback(
    async (connectionId: string, functionName: string): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("get_function_ddl", { connectionId, functionName });
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
   * Create a new function
   */
  const createFunction = useCallback(
    async (connectionId: string, functionDefinition: NewFunctionDefinition): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("create_function", {
          connectionId,
          functionDefinition,
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
   * Drop a function
   */
  const dropFunction = useCallback(
    async (connectionId: string, functionName: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("drop_function", { connectionId, functionName });
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

  // ============================================
  // Trigger Management Methods
  // ============================================

  /**
   * Get all triggers for a connection
   */
  const getTriggers = useCallback(
    async (connectionId: string): Promise<TriggerInfo[]> => {
      try {
        const triggers = await invoke<TriggerInfo[]>("get_triggers", { connectionId });
        return triggers;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Get DDL for a trigger
   */
  const getTriggerDdl = useCallback(
    async (connectionId: string, triggerName: string, tableName?: string): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("get_trigger_ddl", { connectionId, triggerName, tableName });
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
   * Create a new trigger
   */
  const createTrigger = useCallback(
    async (connectionId: string, triggerDefinition: NewTriggerDefinition): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("create_trigger", {
          connectionId,
          triggerDefinition,
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
   * Drop a trigger
   */
  const dropTrigger = useCallback(
    async (connectionId: string, triggerName: string, tableName?: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("drop_trigger", { connectionId, triggerName, tableName });
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

  // ============================================
  // Sequence Management Methods
  // ============================================

  /**
   * Get all sequences for a connection
   */
  const getSequences = useCallback(
    async (connectionId: string): Promise<SequenceInfo[]> => {
      try {
        const sequences = await invoke<SequenceInfo[]>("get_sequences", { connectionId });
        return sequences;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setQueryError(message);
        return [];
      }
    },
    [setQueryError]
  );

  /**
   * Get DDL for a sequence
   */
  const getSequenceDdl = useCallback(
    async (connectionId: string, sequenceName: string): Promise<string | null> => {
      try {
        const ddl = await invoke<string>("get_sequence_ddl", { connectionId, sequenceName });
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
   * Create a new sequence
   */
  const createSequence = useCallback(
    async (connectionId: string, sequenceDefinition: NewSequenceDefinition): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("create_sequence", {
          connectionId,
          sequenceDefinition,
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
   * Drop a sequence
   */
  const dropSequence = useCallback(
    async (connectionId: string, sequenceName: string): Promise<QueryResult | null> => {
      setExecuting(true);
      setQueryError(null);

      try {
        const result = await invoke<QueryResult>("drop_sequence", { connectionId, sequenceName });
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

  // ============ Schema Diff Operations ============

  /**
   * Compare two table schemas
   */
  const compareTableSchemas = useCallback(
    async (request: SchemaDiffRequest): Promise<SchemaDiffResult | null> => {
      try {
        const result = await invoke<SchemaDiffResult>("compare_table_schemas", { request });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
      }
    },
    []
  );

  /**
   * Compare a table with a saved snapshot
   */
  const compareWithSnapshot = useCallback(
    async (connectionId: string, tableName: string, snapshotId: string): Promise<SchemaDiffResult | null> => {
      try {
        const result = await invoke<SchemaDiffResult>("compare_with_snapshot", {
          connectionId,
          tableName,
          snapshotId,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
      }
    },
    []
  );

  /**
   * Save a schema snapshot
   */
  const saveSchemaSnapshot = useCallback(
    async (request: CreateSnapshotRequest): Promise<SchemaSnapshot | null> => {
      try {
        const result = await invoke<SchemaSnapshot>("save_schema_snapshot", { request });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
      }
    },
    []
  );

  /**
   * List all saved schema snapshots
   */
  const listSchemaSnapshots = useCallback(
    async (): Promise<SchemaSnapshot[]> => {
      try {
        const result = await invoke<SchemaSnapshot[]>("list_schema_snapshots");
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
      }
    },
    []
  );

  /**
   * Delete a schema snapshot
   */
  const deleteSchemaSnapshot = useCallback(
    async (snapshotId: string): Promise<void> => {
      try {
        await invoke("delete_schema_snapshot", { snapshotId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
      }
    },
    []
  );

  return {
    testConnection,
    testSslConnection,
    getSslSupportInfo,
    saveConnection,
    connect,
    disconnect,
    loadConnections,
    getConnection,
    deleteConnection,
    executeQuery,
    previewQuery,
    explainQuery,
    getTables,
    getMssqlDatabases,
    getMssqlDatabaseTables,
    createMssqlDatabase,
    dropMssqlDatabase,
    getTableSchema,
    fetchAllSchemas,
    refreshSchemas,
    insertRow,
    updateRow,
    deleteRow,
    dropTable,
    generateTableDdl,
    renameTable,
    getTableProperties,
    getTableRelationships,
    generateCreateTableDDL,
    createTable,
    getReferenceableTables,
    // User management
    supportsUserManagement,
    getUsers,
    createUser,
    deleteUser,
    changePassword,
    getRoles,
    createRole,
    deleteRole,
    getPermissions,
    getAvailablePrivileges,
    grantPermission,
    revokePermission,
    grantRole,
    revokeRole,
    // View management
    getViews,
    getViewDdl,
    createView,
    dropView,
    // Index management
    getAllIndexes,
    getIndexDdl,
    createIndex,
    dropIndex,
    // Procedure management
    getProcedures,
    getProcedureDdl,
    createProcedure,
    dropProcedure,
    // Function management
    getFunctions,
    getFunctionDdl,
    createFunction,
    dropFunction,
    // Trigger management
    getTriggers,
    getTriggerDdl,
    createTrigger,
    dropTrigger,
    // Sequence management
    getSequences,
    getSequenceDdl,
    createSequence,
    dropSequence,
    // Schema diff
    compareTableSchemas,
    compareWithSnapshot,
    saveSchemaSnapshot,
    listSchemaSnapshots,
    deleteSchemaSnapshot,
  };
}

