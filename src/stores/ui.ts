import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PendingChange } from "@/types";

/**
 * Theme type:
 * - "light" | "dark" | "system": Built-in themes handled by UI store
 * - "ext:<id>": Extension theme, delegated to theme store (e.g., "ext:nordic-dark")
 */
type Theme = "light" | "dark" | "system" | `ext:${string}`;
type AppStyle = "developer" | "web";

interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  tabSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  showInvisibles: boolean;
}

interface GeneralSettings {
  checkUpdatesOnStartup: boolean;
  sendAnalytics: boolean;
  enableAnimations: boolean;
}

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
  // Settings
  editorSettings: EditorSettings;
  generalSettings: GeneralSettings;
  // Modal states
  showConnectionModal: boolean;
  editingConnectionId: string | null; // ID of connection being edited, null for new
  showMarketplace: boolean;
  showDiffModal: boolean;
  showSettingsDialog: boolean;
  settingsDialogTab: "general" | "editor" | "appearance" | "extensions" | "keybindings" | "advanced" | "about";
  showRenameTableDialog: boolean;
  renamingTableName: string | null;
  showRenameConnectionDialog: boolean;
  renamingConnectionId: string | null;
  renamingConnectionName: string | null;
  isDuplicatingConnection: boolean;
  showCreateSchemaDialog: boolean;
  creatingSchemaConnectionId: string | null;
  // Edit mode for data grid
  editMode: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  setAppStyle: (style: AppStyle) => void;
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
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
  openSettingsWithTab: (tab: "general" | "editor" | "appearance" | "extensions" | "keybindings" | "advanced" | "about") => void;
  setShowRenameTableDialog: (show: boolean) => void;
  openRenameTableDialog: (tableName: string, connectionId: string) => void;
  setShowRenameConnectionDialog: (show: boolean) => void;
  openRenameConnectionDialog: (connectionId: string, name: string, isDuplicate?: boolean) => void;
  setShowCreateSchemaDialog: (show: boolean) => void;
  openCreateSchemaDialog: (connectionId: string) => void;
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
      editorSettings: {
        fontFamily: "JetBrains Mono",
        fontSize: 14,
        tabSize: 2,
        lineNumbers: true,
        wordWrap: false,
        showInvisibles: false,
      },
      generalSettings: {
        checkUpdatesOnStartup: true,
        sendAnalytics: false,
        enableAnimations: true,
      },
      showConnectionModal: false,
      editingConnectionId: null,
      showMarketplace: false,
      showDiffModal: false,
      showSettingsDialog: false,
      settingsDialogTab: "general",
      showRenameTableDialog: false,
      renamingTableName: null,
      showRenameConnectionDialog: false,
      renamingConnectionId: null,
      renamingConnectionName: null,
      isDuplicatingConnection: false,
      showCreateSchemaDialog: false,
      creatingSchemaConnectionId: null,
      editMode: true,

      setTheme: (theme) => {
        const root = document.documentElement;
        
        // Check if this is an extension theme
        if (theme.startsWith("ext:")) {
          const extensionThemeId = theme.slice(4); // Remove "ext:" prefix
          
          // Dynamically import to avoid circular dependency
          import("@/extensions").then(({ useThemeStore }) => {
            const themeStore = useThemeStore.getState();
            themeStore.activateTheme(extensionThemeId);
          });
        } else {
          // Built-in theme - deactivate any extension theme first
          import("@/extensions").then(({ useThemeStore }) => {
            const themeStore = useThemeStore.getState();
            themeStore.activateTheme(null);
          });
          
          // Remove dark class (extension themes handle their own classes)
          root.classList.remove("dark");
          
          if (theme === "system") {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            root.classList.toggle("dark", prefersDark);
          } else if (theme === "dark") {
            root.classList.add("dark");
          }
          // "light" theme - no class needed (default)
        }
        
        set({ theme });
      },

      setAppStyle: (appStyle) => {
        const root = document.documentElement;
        root.classList.remove("style-developer", "style-web");
        root.classList.add(`style-${appStyle}`);
        set({ appStyle });
      },

      updateEditorSettings: (settings) =>
        set((state) => ({
          editorSettings: { ...state.editorSettings, ...settings },
        })),

      updateGeneralSettings: (settings) =>
        set((state) => ({
          generalSettings: { ...state.generalSettings, ...settings },
        })),

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

      openSettingsWithTab: (tab) =>
        set({
          showSettingsDialog: true,
          settingsDialogTab: tab,
        }),

      setShowRenameTableDialog: (showRenameTableDialog) =>
        set({ showRenameTableDialog, renamingTableName: showRenameTableDialog ? null : null, renamingConnectionId: showRenameTableDialog ? null : null }),

      openRenameTableDialog: (tableName, connectionId) =>
        set({ showRenameTableDialog: true, renamingTableName: tableName, renamingConnectionId: connectionId }),

      setShowRenameConnectionDialog: (show) =>
        set((state) => ({
          showRenameConnectionDialog: show,
          renamingConnectionId: show ? state.renamingConnectionId : null,
          renamingConnectionName: show ? state.renamingConnectionName : null,
          isDuplicatingConnection: show ? state.isDuplicatingConnection : false
        })),

      openRenameConnectionDialog: (connectionId, name, isDuplicate = false) =>
        set({
          showRenameConnectionDialog: true,
          renamingConnectionId: connectionId,
          renamingConnectionName: name,
          isDuplicatingConnection: isDuplicate
        }),

      setShowCreateSchemaDialog: (show) =>
        set((state) => ({
          showCreateSchemaDialog: show,
          creatingSchemaConnectionId: show ? state.creatingSchemaConnectionId : null,
        })),

      openCreateSchemaDialog: (connectionId) =>
        set({
          showCreateSchemaDialog: true,
          creatingSchemaConnectionId: connectionId,
        }),

      setEditMode: (editMode) => set({ editMode }),
    }),
    {
      name: "dbfordevs-ui",
      partialize: (state) => ({
        theme: state.theme,
        appStyle: state.appStyle,
        sidebarWidth: state.sidebarWidth,
        sidePanelWidth: state.sidePanelWidth,
        editorSettings: state.editorSettings,
        generalSettings: state.generalSettings,
      }),
    }
  )
);

