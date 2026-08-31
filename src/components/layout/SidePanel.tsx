import { X, Table, Code, Eye, Sparkle, Plus, TreeStructure, MagnifyingGlass, ClockCounterClockwise, Gear } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button, ResizeHandle } from "@/components/ui";
import { useUIStore, useCRUDStore } from "@/stores";
import { useRedisChangesStore } from "@/stores/redis-changes";
import { useAIStore } from "@/lib/ai/store";
import { ExplainPanel } from "@/components/explain";
import { SchemaSearchPanel } from "@/components/schema-search";
import { FieldsPanel } from "./side-panel/FieldsPanel";
import { ChangesPreviewPanel } from "./side-panel/ChangesPreviewPanel";
import { QueryPreviewPanel } from "./side-panel/QueryPreviewPanel";
import { AIAssistantPanel } from "./side-panel/AIAssistantPanel";

const OPEN_AI_SETTINGS_EVENT = "dbfordevs:open-ai-settings";

export function SidePanel() {
  const sidePanelOpen = useUIStore(state => state.sidePanelOpen);
  const sidePanelWidth = useUIStore(state => state.sidePanelWidth);
  const setSidePanelWidth = useUIStore(state => state.setSidePanelWidth);
  const rightPanelTab = useUIStore(state => state.rightPanelTab);
  const setRightPanelTab = useUIStore(state => state.setRightPanelTab);
  const selectedRows = useCRUDStore(state => state.selectedRows);
  const pendingChanges = useCRUDStore(state => state.pendingChanges);
  const creatingNewRow = useCRUDStore(state => state.creatingNewRow);
  const toggleHistoryPanel = useAIStore(state => state.toggleHistoryPanel);
  const createNewChatSession = useAIStore(state => state.createNewChatSession);

  const pendingChangesList = Object.values(pendingChanges);
  const redisPendingChangesCount = useRedisChangesStore((state) => state.pendingChanges.length);
  const totalPendingCount = pendingChangesList.length + redisPendingChangesCount;

  if (!sidePanelOpen || !rightPanelTab) {
    return null;
  }

  const getPanelTitle = () => {
    switch (rightPanelTab) {
      case "fields":
        if (creatingNewRow) return "New Row";
        return selectedRows.length > 1
          ? `${selectedRows.length} Rows Selected`
          : selectedRows.length === 1
            ? "Edit Row"
            : "Fields";
      case "changes":
        return totalPendingCount > 0
          ? `Pending Changes (${totalPendingCount})`
          : "Changes Preview";
      case "preview":
        return "Query Preview";
      case "explain":
        return "Execution Plan";
      case "ai":
        return "AI Assistant";
      case "schema-search":
        return "Schema Search";
      default: {
        const _exhaustive: never = rightPanelTab;
        return _exhaustive;
      }
    }
  };

  const getPanelIcon = () => {
    switch (rightPanelTab) {
      case "fields":
        return creatingNewRow
          ? <Plus weight="regular" className="h-4 w-4" />
          : <Table weight="regular" className="h-4 w-4" />;
      case "changes":
        return <Code weight="regular" className="h-4 w-4" />;
      case "preview":
        return <Eye weight="regular" className="h-4 w-4" />;
      case "explain":
        return <TreeStructure weight="regular" className="h-4 w-4" />;
      case "ai":
        return <Sparkle weight="regular" className="h-4 w-4" />;
      case "schema-search":
        return <MagnifyingGlass weight="regular" className="h-4 w-4" />;
      default: {
        const _exhaustive: never = rightPanelTab;
        return _exhaustive;
      }
    }
  };

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-l border-border bg-card",
        "animate-slide-up"
      )}
      style={{ width: sidePanelWidth }}
    >
      {/* Resize Handle */}
      <ResizeHandle
        direction="left"
        currentWidth={sidePanelWidth}
        onResize={setSidePanelWidth}
        minWidth={280}
        maxWidth={600}
      />

      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b border-border px-3 bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded text-primary">
            {getPanelIcon()}
          </div>
          <span className="text-sm font-medium">{getPanelTitle()}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {rightPanelTab === "ai" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={toggleHistoryPanel}
                aria-label="History"
              >
                <ClockCounterClockwise weight="regular" className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_AI_SETTINGS_EVENT))}
                aria-label="Settings"
              >
                <Gear weight="regular" className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={createNewChatSession}
                aria-label="New Chat"
              >
                <Plus weight="regular" className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRightPanelTab(null)}
            aria-label="Close panel"
          >
            <X weight="regular" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {rightPanelTab === "fields" && <FieldsPanel />}
        {rightPanelTab === "changes" && <ChangesPreviewPanel />}
        {rightPanelTab === "preview" && <QueryPreviewPanel />}
        {rightPanelTab === "explain" && <ExplainPanel />}
        {rightPanelTab === "ai" && <AIAssistantPanel />}
        {rightPanelTab === "schema-search" && <SchemaSearchPanel />}
      </div>
    </aside>
  );
}
