import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnectionInfo } from "@/types";

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

  // Actions
  setConnections: (connections: ConnectionInfo[]) => void;
  addConnection: (connection: ConnectionInfo) => void;
  updateConnection: (id: string, updates: Partial<ConnectionInfo>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
}

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set) => ({
      connections: [],
      activeConnectionId: null,
      isLoading: false,
      isConnecting: false,
      error: null,

      setConnections: (connections) => set({ connections }),
      
      addConnection: (connection) =>
        set((state) => ({
          connections: [...state.connections, connection],
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
    }),
    {
      name: "dbfordevs-connections",
      partialize: (state) => ({
        connections: state.connections,
        activeConnectionId: state.activeConnectionId,
      }),
    }
  )
);

// Selectors
export const selectActiveConnection = (state: ConnectionsState) =>
  state.connections.find((c) => c.id === state.activeConnectionId) ?? null;

