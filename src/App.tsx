import { useEffect, lazy, Suspense } from "react";
import { TooltipProvider, Toaster } from "@/components/ui";
import { IconRail, Sidebar, MainContent, SidePanel, StatusBar, RightActivityBar } from "@/components/layout";
import { useUIStore, useQueryStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { useKeyboardShortcuts, useFocusZoneEffect } from "@/hooks";
import { useCommandRegistration } from "@/lib/commands";
import { applyConnectionAccent } from "@/lib/connection-accent";

// Lazy-loaded dialogs - only loaded when opened
const SettingsDialog = lazy(() => import("@/components/settings").then(m => ({ default: m.SettingsDialog })));
const ConnectionModal = lazy(() => import("@/components/connections").then(m => ({ default: m.ConnectionModal })));
const RenameConnectionDialog = lazy(() => import("@/components/connections").then(m => ({ default: m.RenameConnectionDialog })));
const RenameTableDialog = lazy(() => import("@/components/table").then(m => ({ default: m.RenameTableDialog })));
const CreateTableDialog = lazy(() => import("@/components/table").then(m => ({ default: m.CreateTableDialog })));
const CreateSchemaDialog = lazy(() => import("@/components/database").then(m => ({ default: m.CreateSchemaDialog })));
const SchemaDiffDialog = lazy(() => import("@/components/diff").then(m => ({ default: m.SchemaDiffDialog })));
const DataCompareDialog = lazy(() => import("@/components/data-diff").then(m => ({ default: m.DataCompareDialog })));
const BookmarkDialogs = lazy(() => import("@/components/bookmarks").then(m => ({ default: m.BookmarkDialogs })));
const CreateUserDialog = lazy(() => import("@/components/users").then(m => ({ default: m.CreateUserDialog })));
const ChangePasswordDialog = lazy(() => import("@/components/users").then(m => ({ default: m.ChangePasswordDialog })));
const CreateRoleDialog = lazy(() => import("@/components/users").then(m => ({ default: m.CreateRoleDialog })));
const ManagePermissionsDialog = lazy(() => import("@/components/users").then(m => ({ default: m.ManagePermissionsDialog })));
const UpdateNotification = lazy(() => import("@/components/updater/UpdateNotification").then(m => ({ default: m.UpdateNotification })));
const CommandPalette = lazy(() => import("@/components/command-palette").then(m => ({ default: m.CommandPalette })));

function App() {
  const { theme, setTheme, appStyle, setAppStyle, density, setDensity } = useUIStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const groups = useConnectionsStore((s) => s.groups);
  const accentFollowsConnection = useUIStore(
    (s) => s.generalSettings.accentFollowsConnection ?? true
  );

  // Register all default commands (must come before useKeyboardShortcuts)
  useCommandRegistration();

  // Initialize keyboard shortcuts (registry-based dispatcher)
  useKeyboardShortcuts();

  // Watch focus zones and apply visual indicators
  useFocusZoneEffect();

  // Initialize theme and app style on mount
  useEffect(() => {
    setTheme(theme);
    setAppStyle(appStyle);
    setDensity(density);

    // Run query history cleanup on startup
    const { historySettings, cleanupOldHistory } = useQueryStore.getState();
    if (historySettings.autoCleanupEnabled) {
      cleanupOldHistory();
    }
  }, []);

  // Environment accent: tint the app accent to the active connection's group color
  useEffect(() => {
    const group =
      accentFollowsConnection && activeConnection?.groupId
        ? groups.find((g) => g.id === activeConnection.groupId)
        : null;
    applyConnectionAccent(group?.color ?? null);
  }, [accentFollowsConnection, activeConnection, groups]);

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
          <IconRail />
          <Sidebar />
          <MainContent />
          <SidePanel />
          <RightActivityBar />
        </div>

        {/* Status Bar */}
        <StatusBar />

        {/* Modals & Overlays - lazy loaded */}
        <Suspense fallback={null}>
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
          {/* Data Compare Dialog */}
          <DataCompareDialog />
          <UpdateNotification />
          {/* Command Palette */}
          <CommandPalette />
        </Suspense>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
