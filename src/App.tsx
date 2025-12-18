import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui";
import { Sidebar, MainContent, SidePanel, StatusBar } from "@/components/layout";
import { useUIStore } from "@/stores";

function App() {
  const { theme, setTheme } = useUIStore();

  // Initialize theme on mount
  useEffect(() => {
    setTheme(theme);
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
      </div>
    </TooltipProvider>
  );
}

export default App;
