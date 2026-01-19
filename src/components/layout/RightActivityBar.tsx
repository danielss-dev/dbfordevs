import { Table, Code, Eye, Sparkles, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, useCRUDStore, usePreviewStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { useAIStore } from "@/lib/ai/store";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { RightPanelTab } from "@/stores/ui";

interface ActivityBarItemProps {
  icon: React.ReactNode;
  label: string;
  tab: RightPanelTab;
  isActive: boolean;
  badge?: number;
  onClick: () => void;
}

function ActivityBarItem({ icon, label, isActive, badge, onClick }: ActivityBarItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all",
            "hover:bg-muted/80",
            isActive
              ? "bg-primary/10 text-primary border-r-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-primary text-primary-foreground">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function RightActivityBar() {
  const { rightPanelTab, toggleRightPanelTab } = useUIStore();
  const { selectedRows, pendingChanges } = useCRUDStore();
  const { isPreviewOpen } = usePreviewStore();
  const { settings: aiSettings } = useAIStore();
  const activeConnection = useConnectionsStore(selectActiveConnection);

  const pendingCount = Object.keys(pendingChanges).length;
  const selectedCount = selectedRows.length;
  const isAIEnabled = aiSettings.aiEnabled ?? true;
  const isConnected = activeConnection?.connected ?? false;

  return (
    <div className="flex flex-col items-center py-2 px-1 border-l border-border bg-muted/30 gap-1">
      {/* Fields - Row Editor */}
      <ActivityBarItem
        icon={<Table className="h-4 w-4" />}
        label="Fields"
        tab="fields"
        isActive={rightPanelTab === "fields"}
        badge={selectedCount}
        onClick={() => toggleRightPanelTab("fields")}
      />

      {/* Changes Preview */}
      <ActivityBarItem
        icon={<Code className="h-4 w-4" />}
        label="Changes Preview"
        tab="changes"
        isActive={rightPanelTab === "changes"}
        badge={pendingCount}
        onClick={() => toggleRightPanelTab("changes")}
      />

      {/* Query Preview */}
      <ActivityBarItem
        icon={<Eye className="h-4 w-4" />}
        label="Query Preview"
        tab="preview"
        isActive={rightPanelTab === "preview"}
        badge={isPreviewOpen ? 1 : undefined}
        onClick={() => toggleRightPanelTab("preview")}
      />

      {/* Schema Search - only show when connected */}
      {isConnected && (
        <ActivityBarItem
          icon={<Search className="h-4 w-4" />}
          label="Schema Search (Ctrl+Shift+F)"
          tab="schema-search"
          isActive={rightPanelTab === "schema-search"}
          onClick={() => toggleRightPanelTab("schema-search")}
        />
      )}

      {isAIEnabled && (
        <>
          <div className="flex-1" />

          {/* AI Assistant */}
          <ActivityBarItem
            icon={<Sparkles className="h-4 w-4" />}
            label="AI Assistant"
            tab="ai"
            isActive={rightPanelTab === "ai"}
            onClick={() => toggleRightPanelTab("ai")}
          />
        </>
      )}
    </div>
  );
}
