import { useEffect } from "react";
import { useUIStore, useQueryStore, useConnectionsStore, selectActiveConnection } from "@/stores";

export function useKeyboardShortcuts() {
  const {
    setShowConnectionModal,
    toggleSidebar,
    setShowSettingsDialog,
    setShowDiffModal,
    showConnectionModal,
    showSettingsDialog,
    showDiffModal,
    showMarketplace,
    setShowMarketplace,
    pendingChanges,
    removePendingChange,
  } = useUIStore();

  const {
    tabs,
    activeTabId,
    addTab,
    removeTab,
  } = useQueryStore();

  const activeConnection = useConnectionsStore(selectActiveConnection);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Close all modals on Escape
      if (e.key === "Escape") {
        if (showConnectionModal) setShowConnectionModal(false);
        if (showSettingsDialog) setShowSettingsDialog(false);
        if (showDiffModal) setShowDiffModal(false);
        if (showMarketplace) setShowMarketplace(false);
        return;
      }

      // Mod + K: New Connection
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowConnectionModal(true);
      }

      // Mod + T: New Query Tab
      if (isMod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (activeConnection) {
          addTab({
            id: crypto.randomUUID(),
            title: `Query ${tabs.length + 1}`,
            type: "query",
            connectionId: activeConnection.id,
            content: "",
          });
        }
      }

      // Mod + W: Close Current Tab
      if (isMod && e.key.toLowerCase() === "w") {
        if (activeTabId) {
          e.preventDefault();
          removeTab(activeTabId);
        }
      }

      // Mod + ,: Open Settings
      if (isMod && e.key === ",") {
        e.preventDefault();
        setShowSettingsDialog(true);
      }

      // Mod + B: Toggle Sidebar
      if (isMod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }

      // Mod + Shift + D: View Changes Diff
      if (isMod && isShift && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setShowDiffModal(true);
      }

      // Mod + Z: Undo Pending Change
      if (isMod && !isShift && e.key.toLowerCase() === "z") {
        if (pendingChanges.length > 0) {
          e.preventDefault();
          const lastChange = pendingChanges[pendingChanges.length - 1];
          removePendingChange(lastChange.id);
        }
      }

      // F1: Open Help (Settings -> About or just Settings)
      if (e.key === "F1") {
        e.preventDefault();
        setShowSettingsDialog(true);
      }

      // F11: Toggle Fullscreen
      if (e.key === "F11") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      }

      // Alt + Up/Down: Navigate Results (Scroll)
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const resultsArea = document.querySelector(".overflow-auto");
        if (resultsArea) {
          e.preventDefault();
          const scrollAmount = e.key === "ArrowUp" ? -40 : 40;
          resultsArea.scrollBy({ top: scrollAmount, behavior: "smooth" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showConnectionModal,
    showSettingsDialog,
    showDiffModal,
    showMarketplace,
    activeConnection,
    tabs.length,
    activeTabId,
    pendingChanges,
    setShowConnectionModal,
    setShowSettingsDialog,
    setShowDiffModal,
    setShowMarketplace,
    addTab,
    removeTab,
    toggleSidebar,
    removePendingChange,
  ]);
}

