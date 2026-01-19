import { create } from "zustand";
import type {
  MongoDatabaseInfo,
  MongoCollectionInfo,
  MongoIndexInfo,
  MongoServerInfo,
  MongoShellHistoryEntry,
  MongoAggregationStage,
} from "@/types";

interface MongoDBState {
  // Databases by connection
  databasesByConnection: Record<string, MongoDatabaseInfo[]>;

  // Collections by database (key = `${connectionId}:${dbName}`)
  collectionsByDb: Record<string, MongoCollectionInfo[]>;

  // Selected database per connection
  selectedDatabaseByConnection: Record<string, string | null>;

  // Selected collection per connection
  selectedCollectionByConnection: Record<string, string | null>;

  // Highlighted item for search navigation (key = connectionId, value = {type, dbName?, collName?, name})
  highlightedItemByConnection: Record<string, { type: "database" | "collection" | "index"; dbName?: string; collName?: string; name: string } | null>;

  // Documents by collection (key = `${connectionId}:${dbName}:${collectionName}`)
  documentsByCollection: Record<string, unknown[]>;

  // Total document count by collection (for pagination)
  documentCountByCollection: Record<string, number>;

  // Indexes by collection (key = `${connectionId}:${dbName}:${collectionName}`)
  indexesByCollection: Record<string, MongoIndexInfo[]>;

  // Server info per connection
  serverInfoByConnection: Record<string, MongoServerInfo | null>;

  // Shell history per connection (limited to last 50)
  shellHistoryByConnection: Record<string, MongoShellHistoryEntry[]>;

  // Aggregation pipeline per connection (key = `${connectionId}:${dbName}:${collectionName}`)
  aggregationPipelineByKey: Record<string, MongoAggregationStage[]>;

  // Query filter per collection (key = `${connectionId}:${dbName}:${collectionName}`)
  filterByCollection: Record<string, string>;

  // Sort by collection (key = `${connectionId}:${dbName}:${collectionName}`)
  sortByCollection: Record<string, string>;

  // Pagination state per collection
  skipByCollection: Record<string, number>;
  limitByCollection: Record<string, number>;

  // Loading states
  loading: boolean;
  loadingDatabases: boolean;
  loadingCollections: boolean;
  loadingDocuments: boolean;

  // Error state
  error: string | null;

  // Actions - Databases
  setDatabases: (connectionId: string, databases: MongoDatabaseInfo[]) => void;
  clearDatabases: (connectionId: string) => void;

  // Actions - Collections
  setCollections: (connectionId: string, dbName: string, collections: MongoCollectionInfo[]) => void;
  clearCollections: (connectionId: string, dbName: string) => void;

  // Actions - Selected database/collection
  setSelectedDatabase: (connectionId: string, dbName: string | null) => void;
  setSelectedCollection: (connectionId: string, collectionName: string | null) => void;

  // Actions - Highlighted item (for search navigation)
  setHighlightedItem: (connectionId: string, item: { type: "database" | "collection" | "index"; dbName?: string; collName?: string; name: string } | null) => void;
  clearHighlightedItem: (connectionId: string) => void;

  // Actions - Documents
  setDocuments: (connectionId: string, dbName: string, collectionName: string, documents: unknown[], totalCount: number) => void;
  clearDocuments: (connectionId: string, dbName: string, collectionName: string) => void;

  // Actions - Indexes
  setIndexes: (connectionId: string, dbName: string, collectionName: string, indexes: MongoIndexInfo[]) => void;

  // Actions - Server info
  setServerInfo: (connectionId: string, info: MongoServerInfo | null) => void;

  // Actions - Shell history
  addShellHistoryEntry: (connectionId: string, entry: MongoShellHistoryEntry) => void;
  clearShellHistory: (connectionId: string) => void;

  // Actions - Aggregation pipeline
  setAggregationPipeline: (connectionId: string, dbName: string, collectionName: string, stages: MongoAggregationStage[]) => void;
  addAggregationStage: (connectionId: string, dbName: string, collectionName: string, stage: MongoAggregationStage) => void;
  updateAggregationStage: (connectionId: string, dbName: string, collectionName: string, stageId: string, updates: Partial<MongoAggregationStage>) => void;
  removeAggregationStage: (connectionId: string, dbName: string, collectionName: string, stageId: string) => void;
  clearAggregationPipeline: (connectionId: string, dbName: string, collectionName: string) => void;

  // Actions - Filter/Sort
  setFilter: (connectionId: string, dbName: string, collectionName: string, filter: string) => void;
  setSort: (connectionId: string, dbName: string, collectionName: string, sort: string) => void;

  // Actions - Pagination
  setSkip: (connectionId: string, dbName: string, collectionName: string, skip: number) => void;
  setLimit: (connectionId: string, dbName: string, collectionName: string, limit: number) => void;

  // Actions - Loading states
  setLoading: (loading: boolean) => void;
  setLoadingDatabases: (loading: boolean) => void;
  setLoadingCollections: (loading: boolean) => void;
  setLoadingDocuments: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Clear all data for a connection
  clearConnectionData: (connectionId: string) => void;
}

const MAX_SHELL_HISTORY = 50;

// Helper to create collection key
const collectionKey = (connectionId: string, dbName: string, collectionName: string) =>
  `${connectionId}:${dbName}:${collectionName}`;

const dbKey = (connectionId: string, dbName: string) =>
  `${connectionId}:${dbName}`;

export const useMongoDBStore = create<MongoDBState>()((set) => ({
  // Initial state
  databasesByConnection: {},
  collectionsByDb: {},
  selectedDatabaseByConnection: {},
  selectedCollectionByConnection: {},
  highlightedItemByConnection: {},
  documentsByCollection: {},
  documentCountByCollection: {},
  indexesByCollection: {},
  serverInfoByConnection: {},
  shellHistoryByConnection: {},
  aggregationPipelineByKey: {},
  filterByCollection: {},
  sortByCollection: {},
  skipByCollection: {},
  limitByCollection: {},
  loading: false,
  loadingDatabases: false,
  loadingCollections: false,
  loadingDocuments: false,
  error: null,

  // Databases
  setDatabases: (connectionId, databases) =>
    set((state) => ({
      databasesByConnection: {
        ...state.databasesByConnection,
        [connectionId]: databases,
      },
    })),

  clearDatabases: (connectionId) =>
    set((state) => {
      const newDatabases = { ...state.databasesByConnection };
      delete newDatabases[connectionId];
      return { databasesByConnection: newDatabases };
    }),

  // Collections
  setCollections: (connectionId, dbName, collections) =>
    set((state) => ({
      collectionsByDb: {
        ...state.collectionsByDb,
        [dbKey(connectionId, dbName)]: collections,
      },
    })),

  clearCollections: (connectionId, dbName) =>
    set((state) => {
      const newCollections = { ...state.collectionsByDb };
      delete newCollections[dbKey(connectionId, dbName)];
      return { collectionsByDb: newCollections };
    }),

  // Selected database/collection
  setSelectedDatabase: (connectionId, dbName) =>
    set((state) => ({
      selectedDatabaseByConnection: {
        ...state.selectedDatabaseByConnection,
        [connectionId]: dbName,
      },
    })),

  setSelectedCollection: (connectionId, collectionName) =>
    set((state) => ({
      selectedCollectionByConnection: {
        ...state.selectedCollectionByConnection,
        [connectionId]: collectionName,
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

  // Documents
  setDocuments: (connectionId, dbName, collectionName, documents, totalCount) =>
    set((state) => {
      const key = collectionKey(connectionId, dbName, collectionName);
      return {
        documentsByCollection: {
          ...state.documentsByCollection,
          [key]: documents,
        },
        documentCountByCollection: {
          ...state.documentCountByCollection,
          [key]: totalCount,
        },
      };
    }),

  clearDocuments: (connectionId, dbName, collectionName) =>
    set((state) => {
      const key = collectionKey(connectionId, dbName, collectionName);
      const newDocs = { ...state.documentsByCollection };
      delete newDocs[key];
      const newCounts = { ...state.documentCountByCollection };
      delete newCounts[key];
      return {
        documentsByCollection: newDocs,
        documentCountByCollection: newCounts,
      };
    }),

  // Indexes
  setIndexes: (connectionId, dbName, collectionName, indexes) =>
    set((state) => ({
      indexesByCollection: {
        ...state.indexesByCollection,
        [collectionKey(connectionId, dbName, collectionName)]: indexes,
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

  // Aggregation pipeline
  setAggregationPipeline: (connectionId, dbName, collectionName, stages) =>
    set((state) => ({
      aggregationPipelineByKey: {
        ...state.aggregationPipelineByKey,
        [collectionKey(connectionId, dbName, collectionName)]: stages,
      },
    })),

  addAggregationStage: (connectionId, dbName, collectionName, stage) =>
    set((state) => {
      const key = collectionKey(connectionId, dbName, collectionName);
      const existing = state.aggregationPipelineByKey[key] || [];
      return {
        aggregationPipelineByKey: {
          ...state.aggregationPipelineByKey,
          [key]: [...existing, stage],
        },
      };
    }),

  updateAggregationStage: (connectionId, dbName, collectionName, stageId, updates) =>
    set((state) => {
      const key = collectionKey(connectionId, dbName, collectionName);
      const existing = state.aggregationPipelineByKey[key] || [];
      return {
        aggregationPipelineByKey: {
          ...state.aggregationPipelineByKey,
          [key]: existing.map((s) => (s.id === stageId ? { ...s, ...updates } : s)),
        },
      };
    }),

  removeAggregationStage: (connectionId, dbName, collectionName, stageId) =>
    set((state) => {
      const key = collectionKey(connectionId, dbName, collectionName);
      const existing = state.aggregationPipelineByKey[key] || [];
      return {
        aggregationPipelineByKey: {
          ...state.aggregationPipelineByKey,
          [key]: existing.filter((s) => s.id !== stageId),
        },
      };
    }),

  clearAggregationPipeline: (connectionId, dbName, collectionName) =>
    set((state) => {
      const key = collectionKey(connectionId, dbName, collectionName);
      const newPipelines = { ...state.aggregationPipelineByKey };
      delete newPipelines[key];
      return { aggregationPipelineByKey: newPipelines };
    }),

  // Filter/Sort
  setFilter: (connectionId, dbName, collectionName, filter) =>
    set((state) => ({
      filterByCollection: {
        ...state.filterByCollection,
        [collectionKey(connectionId, dbName, collectionName)]: filter,
      },
    })),

  setSort: (connectionId, dbName, collectionName, sort) =>
    set((state) => ({
      sortByCollection: {
        ...state.sortByCollection,
        [collectionKey(connectionId, dbName, collectionName)]: sort,
      },
    })),

  // Pagination
  setSkip: (connectionId, dbName, collectionName, skip) =>
    set((state) => ({
      skipByCollection: {
        ...state.skipByCollection,
        [collectionKey(connectionId, dbName, collectionName)]: skip,
      },
    })),

  setLimit: (connectionId, dbName, collectionName, limit) =>
    set((state) => ({
      limitByCollection: {
        ...state.limitByCollection,
        [collectionKey(connectionId, dbName, collectionName)]: limit,
      },
    })),

  // Loading states
  setLoading: (loading) => set({ loading }),
  setLoadingDatabases: (loadingDatabases) => set({ loadingDatabases }),
  setLoadingCollections: (loadingCollections) => set({ loadingCollections }),
  setLoadingDocuments: (loadingDocuments) => set({ loadingDocuments }),

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
        databasesByConnection: filterByConnectionId(state.databasesByConnection),
        collectionsByDb: filterByConnectionId(state.collectionsByDb),
        selectedDatabaseByConnection: filterByConnectionId(state.selectedDatabaseByConnection),
        selectedCollectionByConnection: filterByConnectionId(state.selectedCollectionByConnection),
        highlightedItemByConnection: filterByConnectionId(state.highlightedItemByConnection),
        documentsByCollection: filterByConnectionId(state.documentsByCollection),
        documentCountByCollection: filterByConnectionId(state.documentCountByCollection),
        indexesByCollection: filterByConnectionId(state.indexesByCollection),
        serverInfoByConnection: filterByConnectionId(state.serverInfoByConnection),
        shellHistoryByConnection: filterByConnectionId(state.shellHistoryByConnection),
        aggregationPipelineByKey: filterByConnectionId(state.aggregationPipelineByKey),
        filterByCollection: filterByConnectionId(state.filterByCollection),
        sortByCollection: filterByConnectionId(state.sortByCollection),
        skipByCollection: filterByConnectionId(state.skipByCollection),
        limitByCollection: filterByConnectionId(state.limitByCollection),
      };
    }),
}));
