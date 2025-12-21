import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PendingChange } from "@/types";

type Theme = "light" | "dark" | "system";
type AppStyle = "developer" | "web";

interface UIState {
  // Theme
  theme: Theme;
  appStyle: AppStyle;
  // Sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;
  // Side panel (row editor)
  sidePanelOpen: boolean;
  sidePanelWidth: number;
  // Pending changes for diff view
  pendingChanges: PendingChange[];
  // Modal states
  showConnectionModal: boolean;
  editingConnectionId: string | null; // ID of connection being edited, null for new
  showMarketplace: boolean;
  showDiffModal: boolean;
  showSettingsDialog: boolean;
  showRenameTableDialog: boolean;
  renamingTableName: string | null;
  renamingConnectionId: string | null;
  // Edit mode for data grid
  editMode: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  setAppStyle: (style: AppStyle) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleSidePanel: () => void;
  setSidePanelWidth: (width: number) => void;
  addPendingChange: (change: PendingChange) => void;
  removePendingChange: (id: string) => void;
  clearPendingChanges: () => void;
  setShowConnectionModal: (show: boolean) => void;
  openConnectionModal: (connectionId?: string) => void; // Open for new or edit
  setShowMarketplace: (show: boolean) => void;
  setShowDiffModal: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;
  setShowRenameTableDialog: (show: boolean) => void;
  openRenameTableDialog: (tableName: string, connectionId: string) => void;
  setEditMode: (editMode: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      appStyle: "developer",
      sidebarOpen: true,
      sidebarWidth: 260,
      sidePanelOpen: false,
      sidePanelWidth: 400,
      pendingChanges: [],
      showConnectionModal: false,
      editingConnectionId: null,
      showMarketplace: false,
      showDiffModal: false,
      showSettingsDialog: false,
      showRenameTableDialog: false,
      renamingTableName: null,
      renamingConnectionId: null,
      editMode: false,

      setTheme: (theme) => {
        const root = document.documentElement;
        if (theme === "system") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          root.classList.toggle("dark", prefersDark);
        } else {
          root.classList.toggle("dark", theme === "dark");
        }
        set({ theme });
      },

      setAppStyle: (appStyle) => {
        const root = document.documentElement;
        root.classList.remove("style-developer", "style-web");
        root.classList.add(`style-${appStyle}`);
        set({ appStyle });
      },

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

      toggleSidePanel: () =>
        set((state) => ({ sidePanelOpen: !state.sidePanelOpen })),

      setSidePanelWidth: (sidePanelWidth) => set({ sidePanelWidth }),

      addPendingChange: (change) =>
        set((state) => {
          // Check if there's already a change for this row
          const existingIndex = state.pendingChanges.findIndex(
            (c) =>
              c.tableName === change.tableName &&
              JSON.stringify(c.primaryKey) === JSON.stringify(change.primaryKey)
          );

          if (existingIndex >= 0) {
            // Update existing change
            const newChanges = [...state.pendingChanges];
            newChanges[existingIndex] = change;
            return { pendingChanges: newChanges };
          }

          return { pendingChanges: [...state.pendingChanges, change] };
        }),

      removePendingChange: (id) =>
        set((state) => ({
          pendingChanges: state.pendingChanges.filter((c) => c.id !== id),
        })),

      clearPendingChanges: () => set({ pendingChanges: [] }),

      setShowConnectionModal: (showConnectionModal) =>
        set({ showConnectionModal, editingConnectionId: showConnectionModal ? null : null }),

      openConnectionModal: (connectionId) =>
        set({ showConnectionModal: true, editingConnectionId: connectionId ?? null }),

      setShowMarketplace: (showMarketplace) =>
        set({ showMarketplace }),

      setShowDiffModal: (showDiffModal) => set({ showDiffModal }),

      setShowSettingsDialog: (showSettingsDialog) => set({ showSettingsDialog }),

      setShowRenameTableDialog: (showRenameTableDialog) =>
        set({ showRenameTableDialog, renamingTableName: showRenameTableDialog ? null : null, renamingConnectionId: showRenameTableDialog ? null : null }),

      openRenameTableDialog: (tableName, connectionId) =>
        set({ showRenameTableDialog: true, renamingTableName: tableName, renamingConnectionId: connectionId }),

      setEditMode: (editMode) => set({ editMode }),
    }),
    {
      name: "dbfordevs-ui",
      partialize: (state) => ({
        theme: state.theme,
        appStyle: state.appStyle,
        sidebarWidth: state.sidebarWidth,
        sidePanelWidth: state.sidePanelWidth,
      }),
    }
  )
);

