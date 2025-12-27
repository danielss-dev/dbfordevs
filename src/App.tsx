import { useEffect } from "react";
import { TooltipProvider, Toaster } from "@/components/ui";
import { Sidebar, MainContent, SidePanel, StatusBar } from "@/components/layout";
import { SettingsDialog } from "@/components/settings";
import { ConnectionModal, RenameConnectionDialog } from "@/components/connections";
import { RenameTableDialog } from "@/components/table";
import { CreateSchemaDialog } from "@/components/database";
import { AIPanel } from "@/components/ai";
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
        </div>

        {/* Status Bar */}
        <StatusBar />

        {/* Modals & Overlays */}
        <SettingsDialog />
        <ConnectionModal />
        <RenameTableDialog />
        <RenameConnectionDialog />
        <CreateSchemaDialog />
        <AIPanel />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
