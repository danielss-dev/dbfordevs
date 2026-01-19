import { create } from "zustand";
import type {
  RedisKeyInfo,
  RedisKeyType,
  RedisServerInfo,
  RedisPubSubMessage,
  RedisCliHistoryEntry,
} from "@/types";

interface RedisState {
  // Keys data by connection
  keysByConnection: Record<string, RedisKeyInfo[]>;

  // Current scan cursor per connection (for pagination)
  scanCursorByConnection: Record<string, number>;

  // Key pattern filter per connection
  keyPatternByConnection: Record<string, string>;

  // Type filter per connection (null = all types)
  typeFilterByConnection: Record<string, RedisKeyType | null>;

  // Selected key per connection
  selectedKeyByConnection: Record<string, string | null>;

  // Highlighted key per connection (for search navigation with animation)
  highlightedKeyByConnection: Record<string, string | null>;

  // Server info per connection
  serverInfoByConnection: Record<string, RedisServerInfo | null>;

  // Pub/Sub messages per connection (limited to last 100)
  pubsubMessagesByConnection: Record<string, RedisPubSubMessage[]>;

  // Pub/Sub subscriptions per connection
  pubsubChannelsByConnection: Record<string, string[]>;

  // CLI history per connection (limited to last 50)
  cliHistoryByConnection: Record<string, RedisCliHistoryEntry[]>;

  // Loading states
  loading: boolean;
  loadingKeys: boolean;
  loadingValue: boolean;

  // Error state
  error: string | null;

  // Actions - Keys
  setKeys: (connectionId: string, keys: RedisKeyInfo[]) => void;
  appendKeys: (connectionId: string, keys: RedisKeyInfo[]) => void;
  clearKeys: (connectionId: string) => void;
  removeKey: (connectionId: string, key: string) => void;
  updateKeyTtl: (connectionId: string, key: string, ttl: number) => void;

  // Actions - Scan cursor
  setScanCursor: (connectionId: string, cursor: number) => void;

  // Actions - Key pattern
  setKeyPattern: (connectionId: string, pattern: string) => void;

  // Actions - Type filter
  setTypeFilter: (connectionId: string, filter: RedisKeyType | null) => void;

  // Actions - Selected key
  setSelectedKey: (connectionId: string, key: string | null) => void;

  // Actions - Highlighted key (for search navigation)
  setHighlightedKey: (connectionId: string, key: string | null) => void;
  clearHighlightedKey: (connectionId: string) => void;

  // Actions - Server info
  setServerInfo: (connectionId: string, info: RedisServerInfo | null) => void;

  // Actions - Pub/Sub
  addPubSubMessage: (connectionId: string, message: RedisPubSubMessage) => void;
  clearPubSubMessages: (connectionId: string) => void;
  setPubSubChannels: (connectionId: string, channels: string[]) => void;

  // Actions - CLI history
  addCliHistoryEntry: (connectionId: string, entry: RedisCliHistoryEntry) => void;
  clearCliHistory: (connectionId: string) => void;

  // Actions - Loading states
  setLoading: (loading: boolean) => void;
  setLoadingKeys: (loading: boolean) => void;
  setLoadingValue: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Clear all data for a connection
  clearConnectionData: (connectionId: string) => void;
}

const MAX_PUBSUB_MESSAGES = 100;
const MAX_CLI_HISTORY = 50;

export const useRedisStore = create<RedisState>()((set) => ({
  // Initial state
  keysByConnection: {},
  scanCursorByConnection: {},
  keyPatternByConnection: {},
  typeFilterByConnection: {},
  selectedKeyByConnection: {},
  highlightedKeyByConnection: {},
  serverInfoByConnection: {},
  pubsubMessagesByConnection: {},
  pubsubChannelsByConnection: {},
  cliHistoryByConnection: {},
  loading: false,
  loadingKeys: false,
  loadingValue: false,
  error: null,

  // Keys
  setKeys: (connectionId, keys) =>
    set((state) => ({
      keysByConnection: {
        ...state.keysByConnection,
        [connectionId]: keys,
      },
    })),

  appendKeys: (connectionId, keys) =>
    set((state) => ({
      keysByConnection: {
        ...state.keysByConnection,
        [connectionId]: [...(state.keysByConnection[connectionId] || []), ...keys],
      },
    })),

  clearKeys: (connectionId) =>
    set((state) => {
      const newKeys = { ...state.keysByConnection };
      delete newKeys[connectionId];
      const newCursors = { ...state.scanCursorByConnection };
      delete newCursors[connectionId];
      return {
        keysByConnection: newKeys,
        scanCursorByConnection: newCursors,
      };
    }),

  removeKey: (connectionId, key) =>
    set((state) => ({
      keysByConnection: {
        ...state.keysByConnection,
        [connectionId]: (state.keysByConnection[connectionId] || []).filter(
          (k) => k.key !== key
        ),
      },
    })),

  updateKeyTtl: (connectionId, key, ttl) =>
    set((state) => ({
      keysByConnection: {
        ...state.keysByConnection,
        [connectionId]: (state.keysByConnection[connectionId] || []).map((k) =>
          k.key === key ? { ...k, ttl } : k
        ),
      },
    })),

  // Scan cursor
  setScanCursor: (connectionId, cursor) =>
    set((state) => ({
      scanCursorByConnection: {
        ...state.scanCursorByConnection,
        [connectionId]: cursor,
      },
    })),

  // Key pattern
  setKeyPattern: (connectionId, pattern) =>
    set((state) => ({
      keyPatternByConnection: {
        ...state.keyPatternByConnection,
        [connectionId]: pattern,
      },
    })),

  // Type filter
  setTypeFilter: (connectionId, filter) =>
    set((state) => ({
      typeFilterByConnection: {
        ...state.typeFilterByConnection,
        [connectionId]: filter,
      },
    })),

  // Selected key
  setSelectedKey: (connectionId, key) =>
    set((state) => ({
      selectedKeyByConnection: {
        ...state.selectedKeyByConnection,
        [connectionId]: key,
      },
    })),

  // Highlighted key (for search navigation)
  setHighlightedKey: (connectionId, key) =>
    set((state) => ({
      highlightedKeyByConnection: {
        ...state.highlightedKeyByConnection,
        [connectionId]: key,
      },
    })),

  clearHighlightedKey: (connectionId) =>
    set((state) => ({
      highlightedKeyByConnection: {
        ...state.highlightedKeyByConnection,
        [connectionId]: null,
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

  // Pub/Sub messages
  addPubSubMessage: (connectionId, message) =>
    set((state) => {
      const existing = state.pubsubMessagesByConnection[connectionId] || [];
      const updated = [...existing, message].slice(-MAX_PUBSUB_MESSAGES);
      return {
        pubsubMessagesByConnection: {
          ...state.pubsubMessagesByConnection,
          [connectionId]: updated,
        },
      };
    }),

  clearPubSubMessages: (connectionId) =>
    set((state) => ({
      pubsubMessagesByConnection: {
        ...state.pubsubMessagesByConnection,
        [connectionId]: [],
      },
    })),

  setPubSubChannels: (connectionId, channels) =>
    set((state) => ({
      pubsubChannelsByConnection: {
        ...state.pubsubChannelsByConnection,
        [connectionId]: channels,
      },
    })),

  // CLI history
  addCliHistoryEntry: (connectionId, entry) =>
    set((state) => {
      const existing = state.cliHistoryByConnection[connectionId] || [];
      const updated = [...existing, entry].slice(-MAX_CLI_HISTORY);
      return {
        cliHistoryByConnection: {
          ...state.cliHistoryByConnection,
          [connectionId]: updated,
        },
      };
    }),

  clearCliHistory: (connectionId) =>
    set((state) => ({
      cliHistoryByConnection: {
        ...state.cliHistoryByConnection,
        [connectionId]: [],
      },
    })),

  // Loading states
  setLoading: (loading) => set({ loading }),
  setLoadingKeys: (loadingKeys) => set({ loadingKeys }),
  setLoadingValue: (loadingValue) => set({ loadingValue }),

  // Error state
  setError: (error) => set({ error }),

  // Clear all data for a connection
  clearConnectionData: (connectionId) =>
    set((state) => {
      const newKeys = { ...state.keysByConnection };
      delete newKeys[connectionId];
      const newCursors = { ...state.scanCursorByConnection };
      delete newCursors[connectionId];
      const newPatterns = { ...state.keyPatternByConnection };
      delete newPatterns[connectionId];
      const newFilters = { ...state.typeFilterByConnection };
      delete newFilters[connectionId];
      const newSelected = { ...state.selectedKeyByConnection };
      delete newSelected[connectionId];
      const newHighlighted = { ...state.highlightedKeyByConnection };
      delete newHighlighted[connectionId];
      const newServerInfo = { ...state.serverInfoByConnection };
      delete newServerInfo[connectionId];
      const newPubSubMessages = { ...state.pubsubMessagesByConnection };
      delete newPubSubMessages[connectionId];
      const newPubSubChannels = { ...state.pubsubChannelsByConnection };
      delete newPubSubChannels[connectionId];
      const newCliHistory = { ...state.cliHistoryByConnection };
      delete newCliHistory[connectionId];

      return {
        keysByConnection: newKeys,
        scanCursorByConnection: newCursors,
        keyPatternByConnection: newPatterns,
        typeFilterByConnection: newFilters,
        selectedKeyByConnection: newSelected,
        highlightedKeyByConnection: newHighlighted,
        serverInfoByConnection: newServerInfo,
        pubsubMessagesByConnection: newPubSubMessages,
        pubsubChannelsByConnection: newPubSubChannels,
        cliHistoryByConnection: newCliHistory,
      };
    }),
}));
