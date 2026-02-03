import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PendingChange } from "@/types";
import type { KeywordCaseOption, IndentStyle } from "@/lib/sql-formatter";
import { applyCustomTheme, removeCustomTheme } from "@/lib/themes/utils";
import { useThemesStore } from "./themes";

/**
 * Built-in theme IDs
 */
type BuiltInTheme = "light" | "dark" | "system" | "classic-light" | "classic-dark" | "nordic-dark" | "nordic-light" | "solarized-dark" | "solarized-light" | "one-dark" | "high-contrast";

/**
 * Theme type - built-in themes or custom theme reference (custom:${id})
 * - "light": Default light theme
 * - "dark": Default dark theme
 * - "system": Follows OS preference
 * - "classic-light": Original blue accent light theme
 * - "classic-dark": Original blue accent dark theme
 * - "nordic-dark": Arctic, north-bluish dark theme based on Nord
 * - "nordic-light": Arctic, north-bluish light theme based on Nord
 * - "solarized-dark": Warm, precision-crafted dark theme
 * - "solarized-light": Warm, precision-crafted light theme
 * - "one-dark": Atom-inspired dark theme
 * - "high-contrast": WCAG AAA compliant accessibility theme
 * - "custom:${id}": Custom theme by ID
 */
type Theme = BuiltInTheme | `custom:${string}`;
type AppStyle = "developer" | "web";

interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  tabSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  showInvisibles: boolean;
}

interface FormatterSettings {
  keywordCase: KeywordCaseOption;
  tabWidth: number;
  useTabs: boolean;
  indentStyle: IndentStyle;
  denseOperators: boolean;
}

interface GeneralSettings {
  checkUpdatesOnStartup: boolean;
  sendAnalytics: boolean;
  enableAnimations: boolean;
}

export type RightPanelTab = "fields" | "changes" | "preview" | "explain" | "ai" | "schema-search" | null;

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
  // Right panel active tab
  rightPanelTab: RightPanelTab;
  // Pending changes for diff view
  pendingChanges: PendingChange[];
  // Settings
  editorSettings: EditorSettings;
  generalSettings: GeneralSettings;
  formatterSettings: FormatterSettings;
  // Modal states
  showConnectionModal: boolean;
  editingConnectionId: string | null; // ID of connection being edited, null for new
  showDiffModal: boolean;
  showSettingsDialog: boolean;
  settingsDialogTab: "general" | "editor" | "appearance" | "keybindings" | "advanced" | "about";
  showRenameTableDialog: boolean;
  renamingTableName: string | null;
  showRenameConnectionDialog: boolean;
  renamingConnectionId: string | null;
  renamingConnectionName: string | null;
  isDuplicatingConnection: boolean;
  showCreateSchemaDialog: boolean;
  creatingSchemaConnectionId: string | null;
  showCreateTableDialog: boolean;
  creatingTableConnectionId: string | null;
  creatingTableSchemaName: string | null;
  // Bookmark modal states
  showBookmarkManagerDialog: boolean;
  showSaveBookmarkDialog: boolean;
  savingBookmarkSql: string | null;
  savingBookmarkConnectionId: string | null;
  editingBookmarkId: string | null;
  showTemplateVariableDialog: boolean;
  templateVariableBookmarkId: string | null;
  // Edit mode for data grid
  editMode: boolean;
  // User management dialog states
  showCreateUserDialog: boolean;
  creatingUserConnectionId: string | null;
  showChangePasswordDialog: boolean;
  changingPasswordUser: string | null;
  changingPasswordHost: string | null;
  changingPasswordConnectionId: string | null;
  showCreateRoleDialog: boolean;
  creatingRoleConnectionId: string | null;
  showManagePermissionsDialog: boolean;
  managingPermissionsGrantee: string | null;
  managingPermissionsGranteeHost: string | null;
  managingPermissionsConnectionId: string | null;
  // Command palette
  showCommandPalette: boolean;

  // Connection group management dialog states
  showGroupManagerDialog: boolean;
  showAssignGroupDialog: boolean;
  assigningGroupConnectionId: string | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setAppStyle: (style: AppStyle) => void;
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
  updateFormatterSettings: (settings: Partial<FormatterSettings>) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleSidePanel: () => void;
  setSidePanelOpen: (open: boolean) => void;
  setSidePanelWidth: (width: number) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanelTab: (tab: RightPanelTab) => void;
  addPendingChange: (change: PendingChange) => void;
  removePendingChange: (id: string) => void;
  clearPendingChanges: () => void;
  setShowConnectionModal: (show: boolean) => void;
  openConnectionModal: (connectionId?: string) => void; // Open for new or edit
  setShowDiffModal: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;
  openSettingsWithTab: (tab: "general" | "editor" | "appearance" | "keybindings" | "advanced" | "about") => void;
  setShowRenameTableDialog: (show: boolean) => void;
  openRenameTableDialog: (tableName: string, connectionId: string) => void;
  setShowRenameConnectionDialog: (show: boolean) => void;
  openRenameConnectionDialog: (connectionId: string, name: string, isDuplicate?: boolean) => void;
  setShowCreateSchemaDialog: (show: boolean) => void;
  openCreateSchemaDialog: (connectionId: string) => void;
  setShowCreateTableDialog: (show: boolean) => void;
  openCreateTableDialog: (connectionId: string, schemaName?: string) => void;
  setEditMode: (editMode: boolean) => void;
  // Bookmark actions
  setShowBookmarkManagerDialog: (show: boolean) => void;
  openBookmarkManager: () => void;
  setShowSaveBookmarkDialog: (show: boolean) => void;
  openSaveBookmarkDialog: (sql: string, connectionId: string | null) => void;
  openEditBookmarkDialog: (bookmarkId: string) => void;
  setShowTemplateVariableDialog: (show: boolean) => void;
  openTemplateVariableDialog: (bookmarkId: string) => void;
  // User management dialog actions
  setShowCreateUserDialog: (show: boolean) => void;
  openCreateUserDialog: (connectionId: string) => void;
  setShowChangePasswordDialog: (show: boolean) => void;
  openChangePasswordDialog: (connectionId: string, username: string, host?: string) => void;
  setShowCreateRoleDialog: (show: boolean) => void;
  openCreateRoleDialog: (connectionId: string) => void;
  setShowManagePermissionsDialog: (show: boolean) => void;
  openManagePermissionsDialog: (connectionId: string, grantee: string, host?: string) => void;
  // Command palette
  setShowCommandPalette: (show: boolean) => void;
  // Connection group management dialog actions
  setShowGroupManagerDialog: (show: boolean) => void;
  setShowAssignGroupDialog: (show: boolean) => void;
  openAssignGroupDialog: (connectionId: string) => void;
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
      rightPanelTab: null,
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
      formatterSettings: {
        keywordCase: "upper",
        tabWidth: 2,
        useTabs: false,
        indentStyle: "standard",
        denseOperators: false,
      },
      showConnectionModal: false,
      editingConnectionId: null,
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
      showCreateTableDialog: false,
      creatingTableConnectionId: null,
      creatingTableSchemaName: null,
      showBookmarkManagerDialog: false,
      showSaveBookmarkDialog: false,
      savingBookmarkSql: null,
      savingBookmarkConnectionId: null,
      editingBookmarkId: null,
      showTemplateVariableDialog: false,
      templateVariableBookmarkId: null,
      editMode: true,
      // User management dialog initial states
      showCreateUserDialog: false,
      creatingUserConnectionId: null,
      showChangePasswordDialog: false,
      changingPasswordUser: null,
      changingPasswordHost: null,
      changingPasswordConnectionId: null,
      showCreateRoleDialog: false,
      creatingRoleConnectionId: null,
      showManagePermissionsDialog: false,
      managingPermissionsGrantee: null,
      managingPermissionsGranteeHost: null,
      managingPermissionsConnectionId: null,
      // Command palette
      showCommandPalette: false,
      // Connection group management dialog initial states
      showGroupManagerDialog: false,
      showAssignGroupDialog: false,
      assigningGroupConnectionId: null,

      setTheme: (theme) => {
        const root = document.documentElement;

        // Check if it's a custom theme
        if (theme.startsWith("custom:")) {
          const customThemeId = theme.replace("custom:", "");
          const customTheme = useThemesStore.getState().getThemeById(customThemeId);

          if (customTheme) {
            applyCustomTheme(customTheme);
            set({ theme });
            return;
          } else {
            // Custom theme not found, fall back to dark
            console.warn(`Custom theme ${customThemeId} not found, falling back to dark`);
            theme = "dark" as Theme;
          }
        }

        // Remove custom theme if switching to built-in
        removeCustomTheme();

        // Remove all theme classes
        root.classList.remove(
          "dark",
          "theme-classic-light",
          "theme-classic-dark",
          "theme-nordic-dark",
          "theme-nordic-light",
          "theme-solarized-dark",
          "theme-solarized-light",
          "theme-one-dark",
          "theme-high-contrast"
        );

        // Apply theme-specific class
        // Dark-based themes also get the "dark" class for Tailwind dark: variants
        if (theme === "classic-light") {
          root.classList.add("theme-classic-light");
        } else if (theme === "classic-dark") {
          root.classList.add("dark", "theme-classic-dark");
        } else if (theme === "nordic-dark") {
          root.classList.add("dark", "theme-nordic-dark");
        } else if (theme === "nordic-light") {
          root.classList.add("theme-nordic-light");
        } else if (theme === "solarized-dark") {
          root.classList.add("dark", "theme-solarized-dark");
        } else if (theme === "solarized-light") {
          root.classList.add("theme-solarized-light");
        } else if (theme === "one-dark") {
          root.classList.add("dark", "theme-one-dark");
        } else if (theme === "high-contrast") {
          root.classList.add("dark", "theme-high-contrast");
        } else if (theme === "system") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          root.classList.toggle("dark", prefersDark);
        } else if (theme === "dark") {
          root.classList.add("dark");
        }
        // "light" theme - no class needed (default)

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

      updateFormatterSettings: (settings) =>
        set((state) => ({
          formatterSettings: { ...state.formatterSettings, ...settings },
        })),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

      toggleSidePanel: () =>
        set((state) => ({ sidePanelOpen: !state.sidePanelOpen })),

      setSidePanelOpen: (sidePanelOpen) => set({ sidePanelOpen }),

      setSidePanelWidth: (sidePanelWidth) => set({ sidePanelWidth }),

      setRightPanelTab: (rightPanelTab) => set({
        rightPanelTab,
        sidePanelOpen: rightPanelTab !== null
      }),

      toggleRightPanelTab: (tab) => set((state) => {
        if (state.rightPanelTab === tab) {
          return { rightPanelTab: null, sidePanelOpen: false };
        }
        return { rightPanelTab: tab, sidePanelOpen: true };
      }),

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

      setShowCreateTableDialog: (show) =>
        set((state) => ({
          showCreateTableDialog: show,
          creatingTableConnectionId: show ? state.creatingTableConnectionId : null,
          creatingTableSchemaName: show ? state.creatingTableSchemaName : null,
        })),

      openCreateTableDialog: (connectionId, schemaName) =>
        set({
          showCreateTableDialog: true,
          creatingTableConnectionId: connectionId,
          creatingTableSchemaName: schemaName ?? null,
        }),

      setEditMode: (editMode) => set({ editMode }),

      // Bookmark modal actions
      setShowBookmarkManagerDialog: (show) =>
        set({ showBookmarkManagerDialog: show }),

      openBookmarkManager: () =>
        set({ showBookmarkManagerDialog: true }),

      setShowSaveBookmarkDialog: (show) =>
        set((state) => ({
          showSaveBookmarkDialog: show,
          savingBookmarkSql: show ? state.savingBookmarkSql : null,
          savingBookmarkConnectionId: show ? state.savingBookmarkConnectionId : null,
          editingBookmarkId: show ? state.editingBookmarkId : null,
        })),

      openSaveBookmarkDialog: (sql, connectionId) =>
        set({
          showSaveBookmarkDialog: true,
          savingBookmarkSql: sql,
          savingBookmarkConnectionId: connectionId,
          editingBookmarkId: null,
        }),

      openEditBookmarkDialog: (bookmarkId) =>
        set({
          showSaveBookmarkDialog: true,
          editingBookmarkId: bookmarkId,
          savingBookmarkSql: null,
          savingBookmarkConnectionId: null,
        }),

      setShowTemplateVariableDialog: (show) =>
        set((state) => ({
          showTemplateVariableDialog: show,
          templateVariableBookmarkId: show ? state.templateVariableBookmarkId : null,
        })),

      openTemplateVariableDialog: (bookmarkId) =>
        set({
          showTemplateVariableDialog: true,
          templateVariableBookmarkId: bookmarkId,
        }),

      // User management dialog actions
      setShowCreateUserDialog: (show) =>
        set((state) => ({
          showCreateUserDialog: show,
          creatingUserConnectionId: show ? state.creatingUserConnectionId : null,
        })),

      openCreateUserDialog: (connectionId) =>
        set({
          showCreateUserDialog: true,
          creatingUserConnectionId: connectionId,
        }),

      setShowChangePasswordDialog: (show) =>
        set((state) => ({
          showChangePasswordDialog: show,
          changingPasswordUser: show ? state.changingPasswordUser : null,
          changingPasswordHost: show ? state.changingPasswordHost : null,
          changingPasswordConnectionId: show ? state.changingPasswordConnectionId : null,
        })),

      openChangePasswordDialog: (connectionId, username, host) =>
        set({
          showChangePasswordDialog: true,
          changingPasswordConnectionId: connectionId,
          changingPasswordUser: username,
          changingPasswordHost: host ?? null,
        }),

      setShowCreateRoleDialog: (show) =>
        set((state) => ({
          showCreateRoleDialog: show,
          creatingRoleConnectionId: show ? state.creatingRoleConnectionId : null,
        })),

      openCreateRoleDialog: (connectionId) =>
        set({
          showCreateRoleDialog: true,
          creatingRoleConnectionId: connectionId,
        }),

      setShowManagePermissionsDialog: (show) =>
        set((state) => ({
          showManagePermissionsDialog: show,
          managingPermissionsGrantee: show ? state.managingPermissionsGrantee : null,
          managingPermissionsGranteeHost: show ? state.managingPermissionsGranteeHost : null,
          managingPermissionsConnectionId: show ? state.managingPermissionsConnectionId : null,
        })),

      openManagePermissionsDialog: (connectionId, grantee, host) =>
        set({
          showManagePermissionsDialog: true,
          managingPermissionsConnectionId: connectionId,
          managingPermissionsGrantee: grantee,
          managingPermissionsGranteeHost: host ?? null,
        }),

      // Command palette
      setShowCommandPalette: (show) => set({ showCommandPalette: show }),

      // Connection group management dialog actions
      setShowGroupManagerDialog: (show) =>
        set({ showGroupManagerDialog: show }),

      setShowAssignGroupDialog: (show) =>
        set((state) => ({
          showAssignGroupDialog: show,
          assigningGroupConnectionId: show ? state.assigningGroupConnectionId : null,
        })),

      openAssignGroupDialog: (connectionId) =>
        set({
          showAssignGroupDialog: true,
          assigningGroupConnectionId: connectionId,
        }),
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
        formatterSettings: state.formatterSettings,
      }),
    }
  )
);

