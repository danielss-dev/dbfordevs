import { create } from "zustand";
import type { RedisPendingChange, RedisOperation } from "@/types";

interface RedisChangesState {
  pendingChanges: RedisPendingChange[];

  // Actions
  addChange: (change: Omit<RedisPendingChange, "id" | "timestamp">) => void;
  updateChange: (id: string, operation: RedisOperation) => void;
  removeChange: (id: string) => void;
  clearChanges: () => void;
  clearChangesForKey: (connectionId: string, key: string) => void;
  getChangesForKey: (connectionId: string, key: string) => RedisPendingChange[];
}

export const useRedisChangesStore = create<RedisChangesState>()((set, get) => ({
  pendingChanges: [],

  addChange: (change) =>
    set((state) => ({
      pendingChanges: [
        ...state.pendingChanges,
        {
          ...change,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      ],
    })),

  updateChange: (id, operation) =>
    set((state) => ({
      pendingChanges: state.pendingChanges.map((c) =>
        c.id === id ? { ...c, operation, timestamp: Date.now() } : c
      ),
    })),

  removeChange: (id) =>
    set((state) => ({
      pendingChanges: state.pendingChanges.filter((c) => c.id !== id),
    })),

  clearChanges: () => set({ pendingChanges: [] }),

  clearChangesForKey: (connectionId, key) =>
    set((state) => ({
      pendingChanges: state.pendingChanges.filter(
        (c) => !(c.connectionId === connectionId && c.key === key)
      ),
    })),

  getChangesForKey: (connectionId, key) =>
    get().pendingChanges.filter(
      (c) => c.connectionId === connectionId && c.key === key
    ),
}));
