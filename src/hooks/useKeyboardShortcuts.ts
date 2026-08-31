import { useEffect } from "react";
import { eventToKeybindingString, normalizeKeybinding } from "@/lib/commands/keys";
import { getCommand, executeCommand } from "@/lib/commands/registry";
import { evaluateCondition } from "@/lib/commands/conditions";
import { useKeybindingsStore } from "@/stores/keybindings";
import { useUIStore, useCRUDStore } from "@/stores";

/**
 * Global keyboard shortcut handler.
 * Converts KeyboardEvents into canonical binding strings and dispatches
 * to the command registry. Replaces the previous monolithic handler.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close modals on Escape (special handling, not registry-based)
      if (e.key === "Escape") {
        const ui = useUIStore.getState();
        if (ui.showCommandPalette) {
          ui.setShowCommandPalette(false);
          return;
        }
        if (ui.showConnectionModal) { ui.setShowConnectionModal(false); return; }
        if (ui.showSettingsDialog) { ui.setShowSettingsDialog(false); return; }
        if (ui.showDiffModal) { ui.setShowDiffModal(false); return; }

        if (useCRUDStore.getState().editingCell) return;

        const target = e.target as HTMLElement;
        const isEditingFocus =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          !!target.closest?.(".monaco-editor");
        if (isEditingFocus) return;

        if (ui.rightPanelTab) { ui.setRightPanelTab(null); return; }
        return;
      }

      // Don't intercept when typing in inputs (except for global shortcuts)
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Let Monaco handle its own shortcuts when it has focus
      const isInMonaco = !!target.closest?.(".monaco-editor");

      // Convert the event to a binding string
      const bindingString = eventToKeybindingString(e);
      if (!bindingString) return;

      const normalized = normalizeKeybinding(bindingString);

      // Look up which command this binding triggers
      const commandId = useKeybindingsStore.getState().getCommandForKeys(normalized);
      if (!commandId) return;

      const command = getCommand(commandId);
      if (!command) return;

      // Special handling: let Monaco-owned shortcuts pass through
      // when the editor is focused (Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+A, Ctrl+X, etc.)
      if (isInMonaco) {
        const monacoOwnedCommands = new Set([
          "query.execute", "query.format", "editor.find", "editor.findReplace",
        ]);
        // If the command is NOT one of our global overrides, let Monaco handle it
        if (!monacoOwnedCommands.has(commandId) && !commandId.startsWith("command.") &&
            !commandId.startsWith("sidebar.") && !commandId.startsWith("settings.") &&
            !commandId.startsWith("ai.") && !commandId.startsWith("diff.") &&
            !commandId.startsWith("schemaSearch.") && !commandId.startsWith("tabs.") &&
            !commandId.startsWith("query.closeTab") && !commandId.startsWith("query.closeAllTabs") &&
            !commandId.startsWith("query.pinTab") && !commandId.startsWith("query.newTab") &&
            !commandId.startsWith("navigation.") && !commandId.startsWith("bookmarks.") &&
            !commandId.startsWith("general.fullscreen") && !commandId.startsWith("general.help") &&
            !commandId.startsWith("theme.") && !commandId.startsWith("connection.")) {
          return;
        }
      }

      // If in a regular input and the shortcut doesn't have Ctrl/Meta, skip
      if (isInInput && !isInMonaco && !e.ctrlKey && !e.metaKey && !e.altKey &&
          !bindingString.startsWith("f")) {
        return;
      }

      // Evaluate when-condition
      if (command.when && !evaluateCondition(command.when)) return;

      e.preventDefault();
      executeCommand(commandId);
      useKeybindingsStore.getState().addRecentCommand(commandId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
