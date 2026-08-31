import { Table, Code, Eye, Sparkle, MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUIStore, useCRUDStore, usePreviewStore, useConnectionsStore, selectActiveConnection } from "@/stores";
import { useRedisChangesStore } from "@/stores/redis-changes";
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
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "relative flex items-center justify-center w-8 h-8 rounded-md transition-colors",
            "hover:bg-muted/60",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            isActive
              ? "bg-[hsl(var(--sel))] text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 rounded-full bg-primary"
            />
          )}
          {icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 text-[9px] font-medium rounded-sm bg-primary text-primary-foreground">
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
  const redisPendingCount = useRedisChangesStore((state) => state.pendingChanges.length);

  const pendingCount = Object.keys(pendingChanges).length + redisPendingCount;
  const selectedCount = selectedRows.length;
  const isAIEnabled = aiSettings.aiEnabled ?? true;
  const isConnected = activeConnection?.connected ?? false;

  return (
    <div className="flex w-9 flex-col items-center gap-0.5 border-l border-border bg-[hsl(var(--sidebar-background))] py-1.5">
      <ActivityBarItem
        icon={<Table weight="regular" className="h-4 w-4" />}
        label="Fields"
        tab="fields"
        isActive={rightPanelTab === "fields"}
        badge={selectedCount}
        onClick={() => toggleRightPanelTab("fields")}
      />

      <ActivityBarItem
        icon={<Code weight="regular" className="h-4 w-4" />}
        label="Changes Preview"
        tab="changes"
        isActive={rightPanelTab === "changes"}
        badge={pendingCount}
        onClick={() => toggleRightPanelTab("changes")}
      />

      <ActivityBarItem
        icon={<Eye weight="regular" className="h-4 w-4" />}
        label="Query Preview"
        tab="preview"
        isActive={rightPanelTab === "preview"}
        badge={isPreviewOpen ? 1 : undefined}
        onClick={() => toggleRightPanelTab("preview")}
      />

      {isConnected && (
        <ActivityBarItem
          icon={<MagnifyingGlass weight="regular" className="h-4 w-4" />}
          label="Schema Search (Ctrl+Shift+F)"
          tab="schema-search"
          isActive={rightPanelTab === "schema-search"}
          onClick={() => toggleRightPanelTab("schema-search")}
        />
      )}

      {isAIEnabled && (
        <>
          <div className="flex-1" />
          <ActivityBarItem
            icon={<Sparkle weight="regular" className="h-4 w-4" />}
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
