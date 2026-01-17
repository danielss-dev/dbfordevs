import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionGroup } from "@/types";

interface ConnectionGroupItemProps {
  group: ConnectionGroup;
  count: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}

export function ConnectionGroupItem({
  group,
  count,
  isCollapsed,
  onToggleCollapse,
  children,
}: ConnectionGroupItemProps) {
  return (
    <div className="space-y-0.5">
      {/* Group Header */}
      <button
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors",
          "hover:bg-sidebar-accent/60 text-sidebar-foreground"
        )}
        onClick={onToggleCollapse}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.color }}
        />
        <span className="font-medium truncate flex-1 text-left">{group.name}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>

      {/* Group Contents */}
      {!isCollapsed && (
        <div className="pl-2 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
