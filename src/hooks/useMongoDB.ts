import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMongoDBStore } from "@/stores";
import type {
  MongoDatabaseInfo,
  MongoCollectionInfo,
  MongoQueryResult,
  MongoIndexInfo,
  MongoAggregationResult,
  MongoServerInfo,
  MongoCommandResult,
  MongoUpdateResult,
  MongoShellHistoryEntry,
} from "@/types";

/**
 * Hook for MongoDB operations via Tauri commands
 */
export function useMongoDB() {
  const {
    setDatabases,
    clearDatabases,
    setCollections,
    clearCollections,
    setSelectedDatabase,
    setSelectedCollection,
    setDocuments,
    clearDocuments,
    setIndexes,
    setServerInfo,
    addShellHistoryEntry,
    clearShellHistory,
    setFilter,
    setSort,
    setSkip,
    setLimit,
    setLoading,
    setLoadingDatabases,
    setLoadingCollections,
    setLoadingDocuments,
    setError,
  } = useMongoDBStore();

  // ===== Database Operations =====

  /**
   * List all databases
   */
  const listDatabases = useCallback(
    async (connectionId: string): Promise<MongoDatabaseInfo[] | null> => {
      setLoadingDatabases(true);
      setError(null);

      try {
        const result = await invoke<MongoDatabaseInfo[]>("mongodb_list_databases", {
          connectionId,
        });
        setDatabases(connectionId, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingDatabases(false);
      }
    },
    [setLoadingDatabases, setError, setDatabases]
  );

  /**
   * Get database statistics
   */
  const getDatabaseStats = useCallback(
    async (connectionId: string, dbName: string): Promise<MongoDatabaseInfo | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoDatabaseInfo>("mongodb_get_database_stats", {
          connectionId,
          dbName,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Drop a database
   */
  const dropDatabase = useCallback(
    async (connectionId: string, dbName: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("mongodb_drop_database", {
          connectionId,
          dbName,
        });

        if (result) {
          // Refresh databases list
          await listDatabases(connectionId);
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
    [setLoading, setError, listDatabases]
  );

  // ===== Collection Operations =====

  /**
   * List collections in a database
   */
  const listCollections = useCallback(
    async (connectionId: string, dbName: string): Promise<MongoCollectionInfo[] | null> => {
      setLoadingCollections(true);
      setError(null);

      try {
        const result = await invoke<MongoCollectionInfo[]>("mongodb_list_collections", {
          connectionId,
          dbName,
        });
        setCollections(connectionId, dbName, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingCollections(false);
      }
    },
    [setLoadingCollections, setError, setCollections]
  );

  /**
   * Get collection statistics
   */
  const getCollectionStats = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string
    ): Promise<MongoCollectionInfo | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoCollectionInfo>("mongodb_get_collection_stats", {
          connectionId,
          dbName,
          collectionName,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Create a new collection
   */
  const createCollection = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      capped: boolean = false,
      size?: number,
      maxDocs?: number
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("mongodb_create_collection", {
          connectionId,
          dbName,
          collectionName,
          capped,
          size,
          maxDocs,
        });

        if (result) {
          // Refresh collections list
          await listCollections(connectionId, dbName);
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
    [setLoading, setError, listCollections]
  );

  /**
   * Drop a collection
   */
  const dropCollection = useCallback(
    async (connectionId: string, dbName: string, collectionName: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("mongodb_drop_collection", {
          connectionId,
          dbName,
          collectionName,
        });

        if (result) {
          // Refresh collections list
          await listCollections(connectionId, dbName);
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
    [setLoading, setError, listCollections]
  );

  /**
   * Rename a collection
   */
  const renameCollection = useCallback(
    async (
      connectionId: string,
      dbName: string,
      oldName: string,
      newName: string
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("mongodb_rename_collection", {
          connectionId,
          dbName,
          oldName,
          newName,
        });

        if (result) {
          // Refresh collections list
          await listCollections(connectionId, dbName);
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
    [setLoading, setError, listCollections]
  );

  // ===== Document Operations =====

  /**
   * Find documents in a collection
   */
  const findDocuments = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter?: string,
      projection?: string,
      sort?: string,
      skip: number = 0,
      limit: number = 50
    ): Promise<MongoQueryResult | null> => {
      setLoadingDocuments(true);
      setError(null);

      try {
        const result = await invoke<MongoQueryResult>("mongodb_find_documents", {
          connectionId,
          dbName,
          collectionName,
          filter,
          projection,
          sort,
          skip,
          limit,
        });

        // Parse JSON documents
        const parsedDocs = result.documents.map((doc) => {
          try {
            return JSON.parse(doc);
          } catch {
            return { _raw: doc };
          }
        });

        setDocuments(connectionId, dbName, collectionName, parsedDocs, result.totalCount);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingDocuments(false);
      }
    },
    [setLoadingDocuments, setError, setDocuments]
  );

  /**
   * Insert a single document
   */
  const insertDocument = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      document: string
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<string>("mongodb_insert_document", {
          connectionId,
          dbName,
          collectionName,
          document,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Insert multiple documents
   */
  const insertDocuments = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      documents: string[]
    ): Promise<string[] | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<string[]>("mongodb_insert_documents", {
          connectionId,
          dbName,
          collectionName,
          documents,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Update a single document
   */
  const updateDocument = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: string,
      update: string,
      upsert: boolean = false
    ): Promise<MongoUpdateResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoUpdateResult>("mongodb_update_document", {
          connectionId,
          dbName,
          collectionName,
          filter,
          update,
          upsert,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Update multiple documents
   */
  const updateDocuments = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: string,
      update: string
    ): Promise<MongoUpdateResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoUpdateResult>("mongodb_update_documents", {
          connectionId,
          dbName,
          collectionName,
          filter,
          update,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Delete a single document
   */
  const deleteDocument = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: string
    ): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("mongodb_delete_document", {
          connectionId,
          dbName,
          collectionName,
          filter,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return 0;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Delete multiple documents
   */
  const deleteDocuments = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: string
    ): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("mongodb_delete_documents", {
          connectionId,
          dbName,
          collectionName,
          filter,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return 0;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Get a document by ID
   */
  const getDocumentById = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      id: string
    ): Promise<unknown | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<string | null>("mongodb_get_document_by_id", {
          connectionId,
          dbName,
          collectionName,
          id,
        });

        if (result) {
          return JSON.parse(result);
        }
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  /**
   * Replace a document entirely
   */
  const replaceDocument = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      filter: string,
      replacement: string
    ): Promise<MongoUpdateResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoUpdateResult>("mongodb_replace_document", {
          connectionId,
          dbName,
          collectionName,
          filter,
          replacement,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  // ===== Index Operations =====

  /**
   * List indexes on a collection
   */
  const listIndexes = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string
    ): Promise<MongoIndexInfo[] | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoIndexInfo[]>("mongodb_list_indexes", {
          connectionId,
          dbName,
          collectionName,
        });
        setIndexes(connectionId, dbName, collectionName, result);
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

  /**
   * Create an index
   */
  const createIndex = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      keys: string,
      unique: boolean = false,
      sparse: boolean = false,
      name?: string
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<string>("mongodb_create_index", {
          connectionId,
          dbName,
          collectionName,
          keys,
          unique,
          sparse,
          name,
        });

        // Refresh indexes list
        await listIndexes(connectionId, dbName, collectionName);

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, listIndexes]
  );

  /**
   * Drop an index
   */
  const dropIndex = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      indexName: string
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("mongodb_drop_index", {
          connectionId,
          dbName,
          collectionName,
          indexName,
        });

        if (result) {
          // Refresh indexes list
          await listIndexes(connectionId, dbName, collectionName);
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
    [setLoading, setError, listIndexes]
  );

  // ===== Aggregation Operations =====

  /**
   * Run an aggregation pipeline
   */
  const aggregate = useCallback(
    async (
      connectionId: string,
      dbName: string,
      collectionName: string,
      pipeline: string[]
    ): Promise<MongoAggregationResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoAggregationResult>("mongodb_aggregate", {
          connectionId,
          dbName,
          collectionName,
          pipeline,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  // ===== Server Operations =====

  /**
   * Get server information
   */
  const getServerInfo = useCallback(
    async (connectionId: string): Promise<MongoServerInfo | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<MongoServerInfo>("mongodb_get_server_info", {
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

  /**
   * Run an arbitrary MongoDB command
   */
  const runCommand = useCallback(
    async (
      connectionId: string,
      dbName: string,
      command: string
    ): Promise<MongoCommandResult | null> => {
      setLoading(true);
      setError(null);

      const startTime = Date.now();

      try {
        const result = await invoke<MongoCommandResult>("mongodb_run_command", {
          connectionId,
          dbName,
          command,
        });

        // Add to shell history
        const historyEntry: MongoShellHistoryEntry = {
          id: crypto.randomUUID(),
          command,
          output: result.output,
          executionTimeMs: result.executionTimeMs,
          error: result.error,
          timestamp: startTime,
        };
        addShellHistoryEntry(connectionId, historyEntry);

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);

        // Add failed command to history
        const historyEntry: MongoShellHistoryEntry = {
          id: crypto.randomUUID(),
          command,
          output: "",
          executionTimeMs: Date.now() - startTime,
          error: message,
          timestamp: startTime,
        };
        addShellHistoryEntry(connectionId, historyEntry);

        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, addShellHistoryEntry]
  );

  return {
    // Database operations
    listDatabases,
    getDatabaseStats,
    dropDatabase,

    // Collection operations
    listCollections,
    getCollectionStats,
    createCollection,
    dropCollection,
    renameCollection,

    // Document operations
    findDocuments,
    insertDocument,
    insertDocuments,
    updateDocument,
    updateDocuments,
    deleteDocument,
    deleteDocuments,
    getDocumentById,
    replaceDocument,

    // Index operations
    listIndexes,
    createIndex,
    dropIndex,

    // Aggregation operations
    aggregate,

    // Server operations
    getServerInfo,
    runCommand,

    // Store actions
    setSelectedDatabase,
    setSelectedCollection,
    setFilter,
    setSort,
    setSkip,
    setLimit,
    clearDatabases,
    clearCollections,
    clearDocuments,
    clearShellHistory,
  };
}
