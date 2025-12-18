import { useEffect } from "react";
import { TooltipProvider, Toaster } from "@/components/ui";
import { Sidebar, MainContent, SidePanel, StatusBar } from "@/components/layout";
import { SettingsDialog } from "@/components/settings";
import { ConnectionModal } from "@/components/connections";
import { useUIStore } from "@/stores";

function App() {
  const { theme, setTheme, appStyle, setAppStyle } = useUIStore();

  // Initialize theme on mount
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

        {/* Modals */}
        <SettingsDialog />
        <ConnectionModal />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
