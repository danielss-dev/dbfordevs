import { create } from "zustand";
import type { TableSchema } from "@/types";

interface SchemaCacheEntry {
  schema: TableSchema;
  timestamp: number;
}

interface SchemaState {
  // Schemas cache per connection per table
  schemas: Record<string, Record<string, SchemaCacheEntry>>;
  // TTL in milliseconds (default: 15 minutes)
  ttl: number;
  
  // Actions
  setSchemas: (connectionId: string, tableName: string, schema: TableSchema) => void;
  getSchemas: (connectionId: string) => Record<string, TableSchema>;
  getSchema: (connectionId: string, tableName: string) => TableSchema | null;
  clearSchemas: (connectionId: string) => void;
  clearAll: () => void;
  isExpired: (connectionId: string, tableName: string) => boolean;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  schemas: {},
  ttl: 15 * 60 * 1000, // 15 minutes in milliseconds

  setSchemas: (connectionId, tableName, schema) =>
    set((state) => ({
      schemas: {
        ...state.schemas,
        [connectionId]: {
          ...(state.schemas[connectionId] || {}),
          [tableName]: {
            schema,
            timestamp: Date.now(),
          },
        },
      },
    })),

  getSchemas: (connectionId) => {
    const state = get();
    const connectionSchemas = state.schemas[connectionId] || {};
    const result: Record<string, TableSchema> = {};

    for (const [tableName, entry] of Object.entries(connectionSchemas)) {
      if (!state.isExpired(connectionId, tableName)) {
        result[tableName] = entry.schema;
      }
    }

    return result;
  },

  getSchema: (connectionId, tableName) => {
    const state = get();
    const entry = state.schemas[connectionId]?.[tableName];
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > state.ttl) {
      return null;
    }

    return entry.schema;
  },

  clearSchemas: (connectionId) =>
    set((state) => {
      const newSchemas = { ...state.schemas };
      delete newSchemas[connectionId];
      return { schemas: newSchemas };
    }),

  clearAll: () => set({ schemas: {} }),

  isExpired: (connectionId, tableName) => {
    const state = get();
    const entry = state.schemas[connectionId]?.[tableName];
    
    if (!entry) {
      return true; // No entry means it's "expired" or doesn't exist
    }

    return Date.now() - entry.timestamp > state.ttl;
  },
}));
