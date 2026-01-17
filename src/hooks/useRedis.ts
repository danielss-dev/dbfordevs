import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRedisStore } from "@/stores";
import type {
  RedisKeyInfo,
  RedisScanResult,
  RedisScanMembersResult,
  RedisScanHashResult,
  RedisStringValue,
  RedisListValue,
  RedisSetValue,
  RedisHashValue,
  RedisHashField,
  RedisZSetValue,
  RedisZSetMember,
  RedisStreamValue,
  RedisServerInfo,
  RedisMemoryStats,
  RedisCommandResult,
  RedisCliHistoryEntry,
} from "@/types";

/**
 * Hook for Redis operations via Tauri commands
 */
export function useRedis() {
  const {
    setKeys,
    appendKeys,
    clearKeys,
    removeKey,
    updateKeyTtl,
    setScanCursor,
    setKeyPattern,
    setTypeFilter,
    setSelectedKey,
    setServerInfo,
    clearPubSubMessages,
    setPubSubChannels,
    addCliHistoryEntry,
    clearCliHistory,
    setLoading,
    setLoadingKeys,
    setLoadingValue,
    setError,
  } = useRedisStore();

  // ===== Key Management =====

  /**
   * Scan keys with pattern matching
   */
  const scanKeys = useCallback(
    async (
      connectionId: string,
      pattern: string = "*",
      count: number = 100,
      cursor: number = 0,
      append: boolean = false
    ): Promise<RedisScanResult | null> => {
      setLoadingKeys(true);
      setError(null);

      try {
        const result = await invoke<RedisScanResult>("redis_scan_keys", {
          connectionId,
          pattern,
          count,
          cursor,
        });

        if (append) {
          appendKeys(connectionId, result.keys);
        } else {
          setKeys(connectionId, result.keys);
        }
        setScanCursor(connectionId, result.cursor);
        setKeyPattern(connectionId, pattern);

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingKeys(false);
      }
    },
    [setLoadingKeys, setError, setKeys, appendKeys, setScanCursor, setKeyPattern]
  );

  /**
   * Get info for a specific key
   */
  const getKeyInfo = useCallback(
    async (connectionId: string, key: string): Promise<RedisKeyInfo | null> => {
      setError(null);

      try {
        const result = await invoke<RedisKeyInfo>("redis_get_key_info", {
          connectionId,
          key,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      }
    },
    [setError]
  );

  /**
   * Delete a single key
   */
  const deleteKey = useCallback(
    async (connectionId: string, key: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("redis_delete_key", {
          connectionId,
          key,
        });

        if (result) {
          removeKey(connectionId, key);
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
    [setLoading, setError, removeKey]
  );

  /**
   * Delete multiple keys
   */
  const deleteKeys = useCallback(
    async (connectionId: string, keys: string[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_delete_keys", {
          connectionId,
          keys,
        });

        // Remove deleted keys from store
        for (const key of keys) {
          removeKey(connectionId, key);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return 0;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, removeKey]
  );

  /**
   * Set TTL on a key
   */
  const setTtl = useCallback(
    async (connectionId: string, key: string, ttlSeconds: number): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("redis_set_ttl", {
          connectionId,
          key,
          ttlSeconds,
        });

        if (result) {
          updateKeyTtl(connectionId, key, ttlSeconds);
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
    [setLoading, setError, updateKeyTtl]
  );

  /**
   * Rename a key
   */
  const renameKey = useCallback(
    async (connectionId: string, oldKey: string, newKey: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("redis_rename_key", {
          connectionId,
          oldKey,
          newKey,
        });

        if (result) {
          // Refresh keys list after rename
          const pattern = useRedisStore.getState().keyPatternByConnection[connectionId] || "*";
          await scanKeys(connectionId, pattern, 100, 0, false);
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
    [setLoading, setError, scanKeys]
  );

  // ===== String Operations =====

  /**
   * Get string value
   */
  const getString = useCallback(
    async (connectionId: string, key: string): Promise<RedisStringValue | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisStringValue>("redis_get_string", {
          connectionId,
          key,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Set string value
   */
  const setString = useCallback(
    async (
      connectionId: string,
      key: string,
      value: string,
      ttlSeconds?: number
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("redis_set_string", {
          connectionId,
          key,
          value,
          ttlSeconds,
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

  // ===== List Operations =====

  /**
   * Get list values
   */
  const getList = useCallback(
    async (
      connectionId: string,
      key: string,
      start: number = 0,
      stop: number = -1
    ): Promise<RedisListValue | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisListValue>("redis_get_list", {
          connectionId,
          key,
          start,
          stop,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Push values to a list
   */
  const listPush = useCallback(
    async (
      connectionId: string,
      key: string,
      values: string[],
      left: boolean = false
    ): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_list_push", {
          connectionId,
          key,
          values,
          left,
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
   * Set list element at index
   */
  const listSet = useCallback(
    async (connectionId: string, key: string, index: number, value: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("redis_list_set", {
          connectionId,
          key,
          index,
          value,
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

  /**
   * Remove elements from a list
   */
  const listRemove = useCallback(
    async (
      connectionId: string,
      key: string,
      count: number,
      value: string
    ): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_list_remove", {
          connectionId,
          key,
          count,
          value,
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

  // ===== Set Operations =====

  /**
   * Get set members with SSCAN
   */
  const getSet = useCallback(
    async (
      connectionId: string,
      key: string,
      cursor: number = 0,
      count: number = 100
    ): Promise<RedisScanMembersResult | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisScanMembersResult>("redis_get_set", {
          connectionId,
          key,
          cursor,
          count,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Get full set value
   */
  const getSetFull = useCallback(
    async (connectionId: string, key: string): Promise<RedisSetValue | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisSetValue>("redis_get_set_full", {
          connectionId,
          key,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Add members to a set
   */
  const setAdd = useCallback(
    async (connectionId: string, key: string, members: string[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_set_add", {
          connectionId,
          key,
          members,
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
   * Remove members from a set
   */
  const setRemove = useCallback(
    async (connectionId: string, key: string, members: string[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_set_remove", {
          connectionId,
          key,
          members,
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

  // ===== Hash Operations =====

  /**
   * Get hash fields with HSCAN
   */
  const getHash = useCallback(
    async (
      connectionId: string,
      key: string,
      cursor: number = 0,
      count: number = 100
    ): Promise<RedisScanHashResult | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisScanHashResult>("redis_get_hash", {
          connectionId,
          key,
          cursor,
          count,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Get full hash value
   */
  const getHashFull = useCallback(
    async (connectionId: string, key: string): Promise<RedisHashValue | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisHashValue>("redis_get_hash_full", {
          connectionId,
          key,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Set hash fields
   */
  const hashSet = useCallback(
    async (connectionId: string, key: string, fields: RedisHashField[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_hash_set", {
          connectionId,
          key,
          fields,
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
   * Delete hash fields
   */
  const hashDelete = useCallback(
    async (connectionId: string, key: string, fields: string[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_hash_delete", {
          connectionId,
          key,
          fields,
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

  // ===== Sorted Set Operations =====

  /**
   * Get sorted set members
   */
  const getZSet = useCallback(
    async (
      connectionId: string,
      key: string,
      start: number = 0,
      stop: number = -1,
      reverse: boolean = false
    ): Promise<RedisZSetValue | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisZSetValue>("redis_get_zset", {
          connectionId,
          key,
          start,
          stop,
          reverse,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Add members to a sorted set
   */
  const zsetAdd = useCallback(
    async (connectionId: string, key: string, members: RedisZSetMember[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_zset_add", {
          connectionId,
          key,
          members,
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
   * Remove members from a sorted set
   */
  const zsetRemove = useCallback(
    async (connectionId: string, key: string, members: string[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_zset_remove", {
          connectionId,
          key,
          members,
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
   * Update score for a sorted set member
   */
  const zsetUpdateScore = useCallback(
    async (
      connectionId: string,
      key: string,
      member: string,
      score: number
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("redis_zset_update_score", {
          connectionId,
          key,
          member,
          score,
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

  // ===== Stream Operations =====

  /**
   * Get stream entries
   */
  const getStream = useCallback(
    async (
      connectionId: string,
      key: string,
      start: string = "-",
      end: string = "+",
      count?: number
    ): Promise<RedisStreamValue | null> => {
      setLoadingValue(true);
      setError(null);

      try {
        const result = await invoke<RedisStreamValue>("redis_get_stream", {
          connectionId,
          key,
          start,
          end,
          count,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return null;
      } finally {
        setLoadingValue(false);
      }
    },
    [setLoadingValue, setError]
  );

  /**
   * Add entry to a stream
   */
  const streamAdd = useCallback(
    async (
      connectionId: string,
      key: string,
      fields: Record<string, string>,
      id?: string
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<string>("redis_stream_add", {
          connectionId,
          key,
          fields,
          id,
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
   * Delete entries from a stream
   */
  const streamDelete = useCallback(
    async (connectionId: string, key: string, ids: string[]): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_stream_delete", {
          connectionId,
          key,
          ids,
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

  // ===== CLI Operations =====

  /**
   * Execute arbitrary Redis command
   */
  const executeCommand = useCallback(
    async (connectionId: string, command: string): Promise<RedisCommandResult | null> => {
      setLoading(true);
      setError(null);

      const startTime = Date.now();

      try {
        const result = await invoke<RedisCommandResult>("redis_execute_command", {
          connectionId,
          command,
        });

        // Add to CLI history
        const historyEntry: RedisCliHistoryEntry = {
          id: crypto.randomUUID(),
          command,
          output: result.output,
          executionTimeMs: result.executionTimeMs,
          error: result.error,
          timestamp: startTime,
        };
        addCliHistoryEntry(connectionId, historyEntry);

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);

        // Add failed command to history
        const historyEntry: RedisCliHistoryEntry = {
          id: crypto.randomUUID(),
          command,
          output: "",
          executionTimeMs: Date.now() - startTime,
          error: message,
          timestamp: startTime,
        };
        addCliHistoryEntry(connectionId, historyEntry);

        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, addCliHistoryEntry]
  );

  // ===== Server Info Operations =====

  /**
   * Get Redis server info
   */
  const getServerInfo = useCallback(
    async (connectionId: string): Promise<RedisServerInfo | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<RedisServerInfo>("redis_get_info", {
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
   * Get memory statistics
   */
  const getMemoryStats = useCallback(
    async (connectionId: string): Promise<RedisMemoryStats | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<RedisMemoryStats>("redis_get_memory_stats", {
          connectionId,
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
   * Flush the current database
   */
  const flushDb = useCallback(
    async (connectionId: string, asyncMode: boolean = false): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<boolean>("redis_flush_db", {
          connectionId,
          asyncMode,
        });

        if (result) {
          clearKeys(connectionId);
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
    [setLoading, setError, clearKeys]
  );

  // ===== Pub/Sub Operations =====

  /**
   * Get list of active channels
   */
  const pubsubChannels = useCallback(
    async (connectionId: string, pattern?: string): Promise<string[]> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<string[]>("redis_pubsub_channels", {
          connectionId,
          pattern,
        });
        setPubSubChannels(connectionId, result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setPubSubChannels]
  );

  /**
   * Publish a message to a channel
   */
  const pubsubPublish = useCallback(
    async (connectionId: string, channel: string, message: string): Promise<number> => {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<number>("redis_pubsub_publish", {
          connectionId,
          channel,
          message,
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

  return {
    // Key management
    scanKeys,
    getKeyInfo,
    deleteKey,
    deleteKeys,
    setTtl,
    renameKey,

    // String operations
    getString,
    setString,

    // List operations
    getList,
    listPush,
    listSet,
    listRemove,

    // Set operations
    getSet,
    getSetFull,
    setAdd,
    setRemove,

    // Hash operations
    getHash,
    getHashFull,
    hashSet,
    hashDelete,

    // Sorted set operations
    getZSet,
    zsetAdd,
    zsetRemove,
    zsetUpdateScore,

    // Stream operations
    getStream,
    streamAdd,
    streamDelete,

    // CLI operations
    executeCommand,

    // Server info
    getServerInfo,
    getMemoryStats,
    flushDb,

    // Pub/Sub
    pubsubChannels,
    pubsubPublish,

    // Store actions
    setSelectedKey,
    setTypeFilter,
    clearCliHistory,
    clearPubSubMessages,
  };
}
