import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PendingChange } from "@/types";

type Theme = "light" | "dark" | "system";

interface UIState {
  // Theme
  theme: Theme;
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
  showValidatorModal: boolean;
  showDiffModal: boolean;
  showSettingsDialog: boolean;
  // Edit mode for data grid
  editMode: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleSidePanel: () => void;
  setSidePanelWidth: (width: number) => void;
  addPendingChange: (change: PendingChange) => void;
  removePendingChange: (id: string) => void;
  clearPendingChanges: () => void;
  setShowConnectionModal: (show: boolean) => void;
  setShowValidatorModal: (show: boolean) => void;
  setShowDiffModal: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;
  setEditMode: (editMode: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      sidebarOpen: true,
      sidebarWidth: 260,
      sidePanelOpen: false,
      sidePanelWidth: 400,
      pendingChanges: [],
      showConnectionModal: false,
      showValidatorModal: false,
      showDiffModal: false,
      showSettingsDialog: false,
      editMode: false,

      setTheme: (theme) => {
        // Apply theme to document
        const root = document.documentElement;
        if (theme === "system") {
          const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)"
          ).matches;
          root.classList.toggle("dark", prefersDark);
        } else {
          root.classList.toggle("dark", theme === "dark");
        }
        set({ theme });
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
        set({ showConnectionModal }),

      setShowValidatorModal: (showValidatorModal) =>
        set({ showValidatorModal }),

      setShowDiffModal: (showDiffModal) => set({ showDiffModal }),

      setShowSettingsDialog: (showSettingsDialog) => set({ showSettingsDialog }),

      setEditMode: (editMode) => set({ editMode }),
    }),
    {
      name: "dbfordevs-ui",
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        sidePanelWidth: state.sidePanelWidth,
      }),
    }
  )
);

