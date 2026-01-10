import { useEffect } from "react";
import { TooltipProvider, Toaster } from "@/components/ui";
import { Sidebar, MainContent, SidePanel, StatusBar, RightActivityBar } from "@/components/layout";
import { SettingsDialog } from "@/components/settings";
import { ConnectionModal, RenameConnectionDialog } from "@/components/connections";
import { RenameTableDialog, CreateTableDialog } from "@/components/table";
import { CreateSchemaDialog } from "@/components/database";
import { UpdateNotification } from "@/components/updater/UpdateNotification";
import { useUIStore } from "@/stores";
import { useKeyboardShortcuts } from "@/hooks";

function App() {
  const { theme, setTheme, appStyle, setAppStyle } = useUIStore();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize theme and app style on mount
  useEffect(() => {
    setTheme(theme);
    setAppStyle(appStyle);
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
        <UpdateNotification />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
