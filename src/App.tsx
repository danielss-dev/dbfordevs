import { useEffect } from "react";
import { TooltipProvider, Toaster } from "@/components/ui";
import { Sidebar, MainContent, SidePanel, StatusBar, RightActivityBar } from "@/components/layout";
import { SettingsDialog } from "@/components/settings";
import { ConnectionModal, RenameConnectionDialog } from "@/components/connections";
import { RenameTableDialog, CreateTableDialog } from "@/components/table";
import { CreateSchemaDialog } from "@/components/database";
import { SchemaDiffDialog } from "@/components/diff";
import { BookmarkDialogs } from "@/components/bookmarks";
import {
  CreateUserDialog,
  ChangePasswordDialog,
  CreateRoleDialog,
  ManagePermissionsDialog,
} from "@/components/users";
import { UpdateNotification } from "@/components/updater/UpdateNotification";
import { useUIStore, useQueryStore } from "@/stores";
import { useKeyboardShortcuts } from "@/hooks";

function App() {
  const { theme, setTheme, appStyle, setAppStyle } = useUIStore();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize theme and app style on mount
  useEffect(() => {
    setTheme(theme);
    setAppStyle(appStyle);

    // Run query history cleanup on startup
    const { historySettings, cleanupOldHistory } = useQueryStore.getState();
    if (historySettings.autoCleanupEnabled) {
      cleanupOldHistory();
    }
  }, []);

  // Disable native context menu on non-editable elements (allow custom context menus)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Allow native context menu on editable elements
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest(".monaco-editor")
      ) {
        return;
      }

      // Prevent native context menu to allow custom context menus
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Main Layout */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <MainContent />
          <SidePanel />
          <RightActivityBar />
        </div>

        {/* Status Bar */}
        <StatusBar />

        {/* Modals & Overlays */}
        <SettingsDialog />
        <ConnectionModal />
        <RenameTableDialog />
        <RenameConnectionDialog />
        <CreateSchemaDialog />
        <CreateTableDialog />
        <BookmarkDialogs />
        {/* User Management Dialogs */}
        <CreateUserDialog />
        <ChangePasswordDialog />
        <CreateRoleDialog />
        <ManagePermissionsDialog />
        {/* Schema Diff Dialog */}
        <SchemaDiffDialog />
        <UpdateNotification />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
