import { useEffect } from "react";
import {
  Terminal,
  Plus,
  X,
  XCircle,
  Pin,
  Play,
  AlignLeft,
  Settings,
  PanelLeft,
  Bot,
  GitCompare,
  Search,
  Undo2,
  HelpCircle,
  Maximize,
  ArrowRightLeft,
  Bookmark,
  Sun,
  Pencil,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { registerCommand, unregisterCommand } from "./registry";
import type { CommandDefinition } from "./types";
import { useConnectionsStore, useQueryStore, useUIStore } from "@/stores";
import { useFocusStore } from "@/stores/focus";

function getDefaultCommands(): CommandDefinition[] {
  return [
    // General
    {
      id: "command.palette",
      label: "Command Palette",
      icon: Terminal,
      category: "general",
      defaultKeybinding: "mod+k",
      execute: () => {
        useUIStore.getState().setShowCommandPalette(true);
      },
    },
    {
      id: "general.undo",
      label: "Undo Change",
      icon: Undo2,
      category: "general",
      defaultKeybinding: "mod+z",
      when: "hasPendingChanges",
      execute: () => {
        const { pendingChanges, removePendingChange } = useUIStore.getState();
        if (pendingChanges.length > 0) {
          removePendingChange(pendingChanges[pendingChanges.length - 1].id);
        }
      },
    },
    {
      id: "general.help",
      label: "Help",
      icon: HelpCircle,
      category: "general",
      defaultKeybinding: "f1",
      execute: () => {
        useUIStore.getState().setShowSettingsDialog(true);
      },
    },
    {
      id: "general.fullscreen",
      label: "Toggle Fullscreen",
      icon: Maximize,
      category: "general",
      defaultKeybinding: "f11",
      execute: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      },
    },

    // Connections
    {
      id: "connection.new",
      label: "New Connection",
      icon: Plus,
      category: "connections",
      defaultKeybinding: "mod+n",
      execute: () => {
        useUIStore.getState().setShowConnectionModal(true);
      },
    },

    // Queries
    {
      id: "query.newTab",
      label: "New Query Tab",
      icon: Plus,
      category: "queries",
      defaultKeybinding: "mod+t",
      when: "connected",
      execute: () => {
        const { activeConnectionId, connections } = useConnectionsStore.getState();
        const conn = connections.find((c) => c.id === activeConnectionId);
        if (conn) {
          const { tabs, addTab } = useQueryStore.getState();
          addTab({
            id: crypto.randomUUID(),
            title: `Query ${tabs.length + 1}`,
            type: "query",
            connectionId: conn.id,
            content: "",
          });
        }
      },
    },
    {
      id: "query.execute",
      label: "Execute Query",
      description: "Run the current query",
      icon: Play,
      category: "queries",
      defaultKeybinding: "mod+enter",
      when: "hasActiveTab",
      execute: () => {
        // Execute query is handled by Monaco/editor component directly
        // This command is registered for discoverability in the palette
      },
    },
    {
      id: "query.format",
      label: "Format SQL",
      icon: AlignLeft,
      category: "editor",
      defaultKeybinding: "shift+alt+f",
      when: "hasActiveTab",
      execute: () => {
        // Format is handled by Monaco/editor component directly
      },
    },
    {
      id: "bookmarks.manager",
      label: "Bookmark Manager",
      icon: Bookmark,
      category: "queries",
      defaultKeybinding: "mod+shift+b",
      execute: () => {
        useUIStore.getState().openBookmarkManager();
      },
    },

    // Tabs
    {
      id: "query.closeTab",
      label: "Close Tab",
      icon: X,
      category: "tabs",
      defaultKeybinding: "mod+w",
      when: "hasActiveTab",
      execute: () => {
        const { activeTabId, removeTab } = useQueryStore.getState();
        if (activeTabId) removeTab(activeTabId);
      },
    },
    {
      id: "query.closeAllTabs",
      label: "Close All Tabs",
      icon: XCircle,
      category: "tabs",
      defaultKeybinding: "mod+shift+w",
      execute: () => {
        useQueryStore.getState().closeAllTabs();
      },
    },
    {
      id: "query.pinTab",
      label: "Pin/Unpin Tab",
      icon: Pin,
      category: "tabs",
      defaultKeybinding: "mod+shift+p",
      when: "hasActiveTab",
      execute: () => {
        const { activeTabId, togglePinTab } = useQueryStore.getState();
        if (activeTabId) togglePinTab(activeTabId);
      },
    },
    {
      id: "tabs.next",
      label: "Next Tab",
      icon: ChevronRight,
      category: "tabs",
      defaultKeybinding: "ctrl+tab",
      when: "hasActiveTab",
      execute: () => {
        const { tabs, activeTabId, setActiveTab } = useQueryStore.getState();
        if (tabs.length === 0) return;
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
      },
    },
    {
      id: "tabs.previous",
      label: "Previous Tab",
      icon: ChevronLeft,
      category: "tabs",
      defaultKeybinding: "ctrl+shift+tab",
      when: "hasActiveTab",
      execute: () => {
        const { tabs, activeTabId, setActiveTab } = useQueryStore.getState();
        if (tabs.length === 0) return;
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
      },
    },
    // Tab go-to 1-9
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `tabs.goTo${i + 1}`,
      label: `Go to Tab ${i + 1}`,
      category: "tabs" as const,
      defaultKeybinding: `alt+${i + 1}`,
      execute: () => {
        const { tabs, setActiveTab } = useQueryStore.getState();
        if (tabs[i]) setActiveTab(tabs[i].id);
      },
    })),

    // Navigation
    {
      id: "sidebar.toggle",
      label: "Toggle Sidebar",
      icon: PanelLeft,
      category: "navigation",
      defaultKeybinding: "mod+b",
      execute: () => {
        useUIStore.getState().toggleSidebar();
      },
    },
    {
      id: "schemaSearch.toggle",
      label: "Schema Search",
      icon: Search,
      category: "navigation",
      defaultKeybinding: "mod+shift+f",
      when: "connected",
      execute: () => {
        useUIStore.getState().toggleRightPanelTab("schema-search");
      },
    },
    {
      id: "navigation.cycleForward",
      label: "Cycle Focus Forward",
      icon: ArrowRightLeft,
      category: "navigation",
      defaultKeybinding: "f6",
      execute: () => {
        useFocusStore.getState().cycleZone("forward");
      },
    },
    {
      id: "navigation.cycleBackward",
      label: "Cycle Focus Backward",
      icon: ArrowRightLeft,
      category: "navigation",
      defaultKeybinding: "shift+f6",
      execute: () => {
        useFocusStore.getState().cycleZone("backward");
      },
    },

    // Panels
    {
      id: "ai.toggle",
      label: "Toggle AI Panel",
      icon: Bot,
      category: "panels",
      defaultKeybinding: "mod+shift+a",
      when: "aiEnabled",
      execute: () => {
        useUIStore.getState().toggleRightPanelTab("ai");
      },
    },

    // Database
    {
      id: "diff.open",
      label: "View Changes Diff",
      icon: GitCompare,
      category: "database",
      defaultKeybinding: "mod+shift+d",
      execute: () => {
        useUIStore.getState().setShowDiffModal(true);
      },
    },

    // Settings
    {
      id: "settings.open",
      label: "Open Settings",
      icon: Settings,
      category: "settings",
      defaultKeybinding: "mod+,",
      execute: () => {
        useUIStore.getState().setShowSettingsDialog(true);
      },
    },
    {
      id: "theme.toggle",
      label: "Toggle Dark/Light",
      icon: Sun,
      category: "settings",
      execute: () => {
        const { theme, setTheme } = useUIStore.getState();
        const isDark =
          theme === "dark" ||
          theme === "nordic-dark" ||
          theme === "solarized-dark" ||
          theme === "classic-dark" ||
          theme === "one-dark" ||
          theme === "high-contrast" ||
          (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        setTheme(isDark ? "light" : "dark");
      },
    },

    // Editor
    {
      id: "editor.find",
      label: "Find in Editor",
      icon: Search,
      category: "editor",
      defaultKeybinding: "mod+f",
      when: "hasActiveTab",
      execute: () => {
        // Find is handled natively by Monaco when editor is focused.
        // When editor isn't focused, we focus it and trigger find.
        const monacoEditor = document.querySelector(".monaco-editor");
        if (monacoEditor && !monacoEditor.contains(document.activeElement)) {
          const textarea = monacoEditor.querySelector("textarea");
          if (textarea) {
            textarea.focus();
            const event = new KeyboardEvent("keydown", {
              key: "f",
              code: "KeyF",
              keyCode: 70,
              ctrlKey: true,
              bubbles: true,
              cancelable: true,
            });
            textarea.dispatchEvent(event);
          }
          // Poll for find widget
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
      },
    },
    {
      id: "editor.findReplace",
      label: "Find and Replace",
      icon: Search,
      category: "editor",
      defaultKeybinding: "mod+alt+f",
      when: "hasActiveTab",
      execute: () => {
        const monacoEditor = document.querySelector(".monaco-editor");
        if (monacoEditor) {
          if (!monacoEditor.contains(document.activeElement)) {
            const textarea = monacoEditor.querySelector("textarea");
            if (textarea) {
              textarea.focus();
              const event = new KeyboardEvent("keydown", {
                key: "f",
                code: "KeyF",
                keyCode: 70,
                ctrlKey: true,
                altKey: true,
                bubbles: true,
                cancelable: true,
              });
              textarea.dispatchEvent(event);
            }
          }
          let attempts = 0;
          const focusReplaceInput = () => {
            const findWidget = document.querySelector(".monaco-editor .find-widget");
            if (findWidget) {
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
      },
    },

    // Grid
    {
      id: "editMode.toggle",
      label: "Toggle Edit Mode",
      icon: Pencil,
      category: "grid",
      execute: () => {
        const { editMode, setEditMode } = useUIStore.getState();
        setEditMode(!editMode);
      },
    },
  ];
}

/**
 * Hook to register all default commands on mount and unregister on unmount.
 */
export function useCommandRegistration(): void {
  useEffect(() => {
    const commands = getDefaultCommands();
    for (const cmd of commands) {
      registerCommand(cmd);
    }
    return () => {
      for (const cmd of commands) {
        unregisterCommand(cmd.id);
      }
    };
  }, []);
}
