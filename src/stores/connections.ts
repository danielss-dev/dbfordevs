import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnectionInfo, ConnectionGroup, ConnectionTag } from "@/types";

// ID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface ConnectionsState {
  // List of saved connections
  connections: ConnectionInfo[];
  // Currently active connection
  activeConnectionId: string | null;
  // Loading states
  isLoading: boolean;
  isConnecting: boolean;
  // Error state
  error: string | null;

  // Groups and Tags
  groups: ConnectionGroup[];
  tags: ConnectionTag[];

  // Filter state
  activeGroupFilter: string | null;      // null = show all
  activeTagFilters: string[];            // empty = no filter
  searchQuery: string;                   // Search filter
  showUngrouped: boolean;                // Show connections without groups

  // Connection Actions
  setConnections: (connections: ConnectionInfo[]) => void;
  addConnection: (connection: ConnectionInfo) => void;
  updateConnection: (id: string, updates: Partial<ConnectionInfo>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;

  // Group Actions
  addGroup: (group: Omit<ConnectionGroup, "id" | "createdAt" | "updatedAt" | "sortOrder">) => string;
  updateGroup: (id: string, updates: Partial<Omit<ConnectionGroup, "id" | "createdAt">>) => void;
  removeGroup: (id: string) => void;
  reorderGroups: (groupIds: string[]) => void;
  toggleGroupCollapse: (id: string) => void;

  // Tag Actions
  addTag: (tag: Omit<ConnectionTag, "id" | "createdAt">) => string;
  updateTag: (id: string, updates: Partial<Omit<ConnectionTag, "id" | "createdAt">>) => void;
  removeTag: (id: string) => void;

  // Connection-Group/Tag Assignment
  assignConnectionToGroup: (connectionId: string, groupId: string | null) => void;
  addTagToConnection: (connectionId: string, tagId: string) => void;
  removeTagFromConnection: (connectionId: string, tagId: string) => void;

  // Bulk Operations
  bulkAssignGroup: (connectionIds: string[], groupId: string | null) => void;
  bulkAddTag: (connectionIds: string[], tagId: string) => void;
  bulkRemoveTag: (connectionIds: string[], tagId: string) => void;
  bulkDeleteConnections: (connectionIds: string[]) => void;

  // Filter Actions
  setActiveGroupFilter: (groupId: string | null) => void;
  setActiveTagFilters: (tagIds: string[]) => void;
  toggleTagFilter: (tagId: string) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  setShowUngrouped: (show: boolean) => void;

  // Getters
  getConnectionsByGroup: (groupId: string | null) => ConnectionInfo[];
  getConnectionsByTag: (tagId: string) => ConnectionInfo[];
  getFilteredConnections: () => ConnectionInfo[];
  getGroupById: (id: string) => ConnectionGroup | undefined;
  getTagById: (id: string) => ConnectionTag | undefined;
  getTagsForConnection: (connectionId: string) => ConnectionTag[];
}

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,
      isLoading: false,
      isConnecting: false,
      error: null,
      groups: [],
      tags: [],
      activeGroupFilter: null,
      activeTagFilters: [],
      searchQuery: "",
      showUngrouped: true,

      // ========== Connection Actions ==========
      setConnections: (connections) =>
        set((state) => {
          // Preserve groupId and tagIds from existing connections when loading from backend
          const existingMap = new Map(
            state.connections.map((c) => [c.id, { groupId: c.groupId, tagIds: c.tagIds }])
          );
          const mergedConnections = connections.map((conn) => {
            const existing = existingMap.get(conn.id);
            return {
              ...conn,
              groupId: conn.groupId ?? existing?.groupId ?? null,
              tagIds: conn.tagIds ?? existing?.tagIds ?? [],
            };
          });
          return { connections: mergedConnections };
        }),

      addConnection: (connection) =>
        set((state) => ({
          connections: [
            ...state.connections,
            { ...connection, groupId: connection.groupId ?? null, tagIds: connection.tagIds ?? [] },
          ],
        })),

      updateConnection: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
        })),

      removeConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
          activeConnectionId:
            state.activeConnectionId === id ? null : state.activeConnectionId,
        })),

      setActiveConnection: (id) => set({ activeConnectionId: id }),

      setLoading: (isLoading) => set({ isLoading }),

      setConnecting: (isConnecting) => set({ isConnecting }),

      setError: (error) => set({ error }),

      // ========== Group Actions ==========
      addGroup: (group) => {
        const id = generateId();
        const now = Date.now();
        const state = get();
        const maxSortOrder = state.groups.reduce((max, g) => Math.max(max, g.sortOrder), -1);

        set((state) => ({
          groups: [
            ...state.groups,
            {
              ...group,
              id,
              sortOrder: maxSortOrder + 1,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },

      updateGroup: (id, updates) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === id
              ? { ...group, ...updates, updatedAt: Date.now() }
              : group
          ),
        })),

      removeGroup: (id) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
          // Move connections from deleted group to ungrouped
          connections: state.connections.map((conn) =>
            conn.groupId === id ? { ...conn, groupId: null } : conn
          ),
          // Clear filter if removed group was active
          activeGroupFilter:
            state.activeGroupFilter === id ? null : state.activeGroupFilter,
        })),

      reorderGroups: (groupIds) =>
        set((state) => ({
          groups: state.groups.map((group) => ({
            ...group,
            sortOrder: groupIds.indexOf(group.id),
            updatedAt: Date.now(),
          })),
        })),

      toggleGroupCollapse: (id) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === id
              ? { ...group, isCollapsed: !group.isCollapsed, updatedAt: Date.now() }
              : group
          ),
        })),

      // ========== Tag Actions ==========
      addTag: (tag) => {
        const id = generateId();
        set((state) => ({
          tags: [
            ...state.tags,
            {
              ...tag,
              id,
              createdAt: Date.now(),
            },
          ],
        }));
        return id;
      },

      updateTag: (id, updates) =>
        set((state) => ({
          tags: state.tags.map((tag) =>
            tag.id === id ? { ...tag, ...updates } : tag
          ),
        })),

      removeTag: (id) =>
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          // Remove tag from all connections
          connections: state.connections.map((conn) => ({
            ...conn,
            tagIds: (conn.tagIds ?? []).filter((tid) => tid !== id),
          })),
          // Remove from active filters
          activeTagFilters: state.activeTagFilters.filter((tid) => tid !== id),
        })),

      // ========== Assignment Actions ==========
      assignConnectionToGroup: (connectionId, groupId) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === connectionId ? { ...conn, groupId } : conn
          ),
        })),

      addTagToConnection: (connectionId, tagId) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === connectionId
              ? {
                  ...conn,
                  tagIds: [...new Set([...(conn.tagIds ?? []), tagId])],
                }
              : conn
          ),
        })),

      removeTagFromConnection: (connectionId, tagId) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === connectionId
              ? {
                  ...conn,
                  tagIds: (conn.tagIds ?? []).filter((tid) => tid !== tagId),
                }
              : conn
          ),
        })),

      // ========== Bulk Operations ==========
      bulkAssignGroup: (connectionIds, groupId) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            connectionIds.includes(conn.id) ? { ...conn, groupId } : conn
          ),
        })),

      bulkAddTag: (connectionIds, tagId) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            connectionIds.includes(conn.id)
              ? {
                  ...conn,
                  tagIds: [...new Set([...(conn.tagIds ?? []), tagId])],
                }
              : conn
          ),
        })),

      bulkRemoveTag: (connectionIds, tagId) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            connectionIds.includes(conn.id)
              ? {
                  ...conn,
                  tagIds: (conn.tagIds ?? []).filter((tid) => tid !== tagId),
                }
              : conn
          ),
        })),

      bulkDeleteConnections: (connectionIds) =>
        set((state) => ({
          connections: state.connections.filter(
            (conn) => !connectionIds.includes(conn.id)
          ),
          activeConnectionId: connectionIds.includes(state.activeConnectionId ?? "")
            ? null
            : state.activeConnectionId,
        })),

      // ========== Filter Actions ==========
      setActiveGroupFilter: (groupId) => set({ activeGroupFilter: groupId }),

      setActiveTagFilters: (tagIds) => set({ activeTagFilters: tagIds }),

      toggleTagFilter: (tagId) =>
        set((state) => ({
          activeTagFilters: state.activeTagFilters.includes(tagId)
            ? state.activeTagFilters.filter((id) => id !== tagId)
            : [...state.activeTagFilters, tagId],
        })),

      setSearchQuery: (query) => set({ searchQuery: query }),

      clearFilters: () =>
        set({
          activeGroupFilter: null,
          activeTagFilters: [],
          searchQuery: "",
        }),

      setShowUngrouped: (show) => set({ showUngrouped: show }),

      // ========== Getters ==========
      getConnectionsByGroup: (groupId) => {
        const state = get();
        return state.connections.filter((conn) =>
          groupId === null ? !conn.groupId : conn.groupId === groupId
        );
      },

      getConnectionsByTag: (tagId) => {
        const state = get();
        return state.connections.filter((conn) =>
          (conn.tagIds ?? []).includes(tagId)
        );
      },

      getFilteredConnections: () => {
        const state = get();
        let filtered = state.connections;

        // Filter by search query
        if (state.searchQuery.trim()) {
          const query = state.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (conn) =>
              conn.name.toLowerCase().includes(query) ||
              conn.database.toLowerCase().includes(query) ||
              (conn.host?.toLowerCase().includes(query) ?? false)
          );
        }

        // Filter by group
        if (state.activeGroupFilter !== null) {
          filtered = filtered.filter(
            (conn) => conn.groupId === state.activeGroupFilter
          );
        }

        // Filter by tags (AND logic - must have all selected tags)
        if (state.activeTagFilters.length > 0) {
          filtered = filtered.filter((conn) =>
            state.activeTagFilters.every((tagId) =>
              (conn.tagIds ?? []).includes(tagId)
            )
          );
        }

        return filtered;
      },

      getGroupById: (id) => {
        const state = get();
        return state.groups.find((g) => g.id === id);
      },

      getTagById: (id) => {
        const state = get();
        return state.tags.find((t) => t.id === id);
      },

      getTagsForConnection: (connectionId) => {
        const state = get();
        const conn = state.connections.find((c) => c.id === connectionId);
        if (!conn) return [];
        return state.tags.filter((tag) => (conn.tagIds ?? []).includes(tag.id));
      },
    }),
    {
      name: "dbfordevs-connections",
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // Migration from v1 to v2: Add grouping/tagging fields
          return {
            ...state,
            groups: [],
            tags: [],
            connections: ((state.connections as ConnectionInfo[]) || []).map(
              (conn) => ({
                ...conn,
                groupId: conn.groupId ?? null,
                tagIds: conn.tagIds ?? [],
              })
            ),
          };
        }
        return state;
      },
      partialize: (state) => ({
        connections: state.connections,
        activeConnectionId: state.activeConnectionId,
        groups: state.groups,
        tags: state.tags,
      }),
    }
  )
);

// Selectors
export const selectActiveConnection = (state: ConnectionsState) =>
  state.connections.find((c) => c.id === state.activeConnectionId) ?? null;
