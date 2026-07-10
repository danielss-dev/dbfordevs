import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeItemProps {
  label: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  level?: number;
  onClick?: () => void;
  isActive?: boolean;
  isConnected?: boolean;
  rightElement?: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  isHighlighted?: boolean;
}

export function TreeItem({
  label,
  icon,
  children,
  level = 0,
  onClick,
  isActive,
  isConnected,
  rightElement,
  defaultOpen = false,
  forceOpen = false,
  isHighlighted = false,
}: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = Boolean(children);

  // Force open when forceOpen prop changes to true
  useEffect(() => {
    if (forceOpen && !isOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const effectiveOpen = isOpen || forceOpen;

  return (
    <div className="group/tree relative">
      {/* Indentation guide lines for nested items */}
      {level > 0 && (
        <div
          className="tree-guide"
          style={{ left: `${(level - 1) * 16 + 18}px` }}
        />
      )}
      {/* Active indicator bar - grows in */}
      {level === 0 && (
        <div
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-primary z-10 transition-all duration-150 ease-swift",
            isActive ? "h-4 opacity-100" : "h-0 opacity-0"
          )}
        />
      )}
      <div
        className={cn(
          "group flex w-full items-center gap-2 rounded-md h-[var(--row-h)] text-sm transition-all duration-150 ease-swift",
          "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          isHighlighted && "bg-primary/20 ring-1 ring-primary/50 animate-pulse"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px`, paddingRight: '8px' }}
      >
        <button
          className="flex flex-1 items-center gap-2 overflow-hidden rounded focus-visible:outline-none focus-visible:shadow-[0_0_0_1.5px_hsl(var(--ring)),0_0_0_4px_var(--accent-glow)]"
          onClick={() => {
            if (hasChildren) setIsOpen(!isOpen);
            onClick?.();
          }}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                effectiveOpen && "rotate-90",
                isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"
              )}
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className={cn(
            "shrink-0 flex items-center justify-center w-5 h-5 rounded bg-sidebar-accent/30 transition-colors duration-150",
            isActive ? "text-primary bg-primary/15" : ""
          )}>{icon}</span>
          <span className="truncate flex-1 text-left">{label}</span>
          {isConnected !== undefined && (
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isConnected ? "bg-success" : "bg-muted-foreground/30"
            )} />
          )}
        </button>
        {rightElement && (
          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {rightElement}
          </div>
        )}
      </div>
      {effectiveOpen && children && (
        <div className="animate-slide-down">{children}</div>
      )}
    </div>
  );
}
