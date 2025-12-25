import { useEffect } from "react";
import { useUIStore, useQueryStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { useExtensionStore, useAIStore } from "@/extensions";

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

  const { isEnabled } = useExtensionStore();
  const { panelOpen: aiPanelOpen, togglePanel: toggleAIPanel, setPanelOpen: setAIPanelOpen } = useAIStore();
  const isAIEnabled = isEnabled("ai-assistant");

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
        if (aiPanelOpen) setAIPanelOpen(false);
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

      // Mod + Alt + B: Toggle AI Assistant (Cmd+Option+B on Mac, Ctrl+Alt+B on Windows)
      if (isMod && e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (isAIEnabled) {
          toggleAIPanel();
        }
      }

      // Mod + Shift + D: View Changes Diff
      if (isMod && isShift && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setShowDiffModal(true);
      }

      // Mod + Alt + F: Focus Find and Replace in Editor
      if (isMod && e.altKey && e.key.toLowerCase() === "f") {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.type === "query") {
          const monacoEditor = document.querySelector(".monaco-editor");
          if (monacoEditor) {
            e.preventDefault();
            // If the editor doesn't have focus, focus it first
            if (!monacoEditor.contains(document.activeElement)) {
              const textarea = monacoEditor.querySelector("textarea");
              if (textarea) {
                textarea.focus();
              }
              
              // Trigger find/replace via a new event
              const event = new KeyboardEvent("keydown", {
                key: "f",
                code: "KeyF",
                keyCode: 70,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                altKey: true,
                bubbles: true,
                cancelable: true
              });
              textarea?.dispatchEvent(event);
            }

            // Robust polling to ensure the find widget opens with replace
            let attempts = 0;
            const focusReplaceInput = () => {
              const findWidget = document.querySelector(".monaco-editor .find-widget");
              if (findWidget) {
                // Check if replace is expanded, if not, try to click the toggle
                const replaceToggle = findWidget.querySelector(".monaco-button.expand") as HTMLElement;
                if (replaceToggle && !findWidget.classList.contains("replace-expanded")) {
                  replaceToggle.click();
                }

                const inputs = findWidget.querySelectorAll("input, textarea");
                const findInput = inputs[0] as HTMLElement;

                if (findInput) {
                  findInput.focus();
                  if (findInput instanceof HTMLInputElement || findInput instanceof HTMLTextAreaElement) {
                    findInput.select();
                  }
                }
              } else if (attempts < 10) {
                attempts++;
                setTimeout(focusReplaceInput, 50);
              }
            };
            
            setTimeout(focusReplaceInput, 50);
          }
        }
      }

      // Mod + F: Focus Find in Editor
      if (isMod && !isShift && !e.altKey && e.key.toLowerCase() === "f") {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab && activeTab.type === "query") {
          const monacoEditor = document.querySelector(".monaco-editor");
          if (monacoEditor) {
            // If the editor doesn't have focus, focus it first
            if (!monacoEditor.contains(document.activeElement)) {
              e.preventDefault();
              const textarea = monacoEditor.querySelector("textarea");
              if (textarea) {
                textarea.focus();
              }
              
              // Trigger find via a new event
              const event = new KeyboardEvent("keydown", {
                key: "f",
                code: "KeyF",
                keyCode: 70,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                bubbles: true,
                cancelable: true
              });
              textarea?.dispatchEvent(event);
            }

            // Robust polling to ensure the find widget input gets focus
            let attempts = 0;
            const focusFindInput = () => {
              const findWidget = document.querySelector(".monaco-editor .find-widget");
              const findInput = findWidget?.querySelector("input, textarea") as HTMLElement;
              
              if (findInput) {
                findInput.focus();
                if (findInput instanceof HTMLInputElement || findInput instanceof HTMLTextAreaElement) {
                  findInput.select();
                }
              } else if (attempts < 10) {
                attempts++;
                setTimeout(focusFindInput, 50);
              }
            };
            
            setTimeout(focusFindInput, 50);
          }
        }
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
    aiPanelOpen,
    isAIEnabled,
    activeConnection,
    tabs.length,
    activeTabId,
    pendingChanges,
    setShowConnectionModal,
    setShowSettingsDialog,
    setShowDiffModal,
    setShowMarketplace,
    setAIPanelOpen,
    toggleAIPanel,
    addTab,
    removeTab,
    toggleSidebar,
    removePendingChange,
  ]);
}

