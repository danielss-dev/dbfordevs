import type { WhenCondition } from "./types";
import { useConnectionsStore, useQueryStore, useUIStore } from "@/stores";
import { useAIStore } from "@/lib/ai/store";

/**
 * Evaluate a WhenCondition against current app state.
 * Uses getState() to read store state synchronously (no hooks).
 */
export function evaluateCondition(condition: WhenCondition): boolean {
  switch (condition) {
    case "always":
      return true;

    case "connected": {
      const { activeConnectionId, connections } = useConnectionsStore.getState();
      const conn = connections.find((c) => c.id === activeConnectionId);
      return !!conn?.connected;
    }

    case "hasActiveTab": {
      const { activeTabId } = useQueryStore.getState();
      return !!activeTabId;
    }

    case "editorFocused": {
      const monacoEditor = document.querySelector(".monaco-editor");
      return !!monacoEditor?.contains(document.activeElement);
    }

    case "gridFocused": {
      const gridContainer = document.querySelector("[data-grid-container]");
      return !!gridContainer?.contains(document.activeElement);
    }

    case "hasSelectedRows":
      return false; // Could be expanded with selection store

    case "hasPendingChanges": {
      const { pendingChanges } = useUIStore.getState();
      return pendingChanges.length > 0;
    }

    case "aiEnabled": {
      const { settings } = useAIStore.getState();
      return settings.aiEnabled ?? true;
    }

    default:
      return true;
  }
}
