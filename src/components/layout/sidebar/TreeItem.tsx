import { useState, useEffect } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  /** Small count chip after the label (e.g. keys in a folder, tables in a keyspace) */
  count?: number;
  /** Tiny mono annotation after the label (e.g. Cassandra replication settings) */
  badge?: string;
  /** Show the full label in a tooltip on hover — for trees with long, truncating names */
  labelTooltip?: boolean;
  /** Ref to the row's root element, for scroll-into-view on search highlight */
  itemRef?: React.RefObject<HTMLDivElement>;
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
  count,
  badge,
  labelTooltip = false,
  itemRef,
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

  const labelElement = (
    <span className="truncate flex-1 text-left min-w-0">{label}</span>
  );

  return (
    <div
      className={cn(
        "group/tree relative min-w-0",
        // Small gap after an expanded connection so the next peer isn't flush
        level === 0 && effectiveOpen && hasChildren && "mb-1.5"
      )}
      ref={itemRef}
    >
      {/* Indentation guide lines for nested items */}
      {level > 0 && (
        <div
          className="tree-guide"
          style={{ left: `${(level - 1) * 14 + 18}px` }}
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
          "group flex w-full items-center gap-1.5 rounded-sm min-h-[var(--row-h)] text-[12px] transition-colors min-w-0",
          "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          isActive && "bg-[hsl(var(--sel))] text-sidebar-accent-foreground font-medium",
          isHighlighted && "animate-highlight-blink"
        )}
        style={{ paddingLeft: `${level * 14 + 6}px`, paddingRight: '6px' }}
      >
        <button
          className="flex flex-1 items-center gap-1.5 overflow-hidden min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => {
            if (hasChildren) setIsOpen(!isOpen);
            onClick?.();
          }}
        >
          {hasChildren ? (
            <CaretRight
              weight="regular"
              className={cn(
                "h-3 w-3 shrink-0 transition-transform duration-150",
                effectiveOpen && "rotate-90",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            />
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span className={cn(
            "shrink-0 flex items-center justify-center text-muted-foreground",
            isActive && "text-primary"
          )}>{icon}</span>
          {labelTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>{labelElement}</TooltipTrigger>
              <TooltipContent side="right" align="start">
                {label}
              </TooltipContent>
            </Tooltip>
          ) : (
            labelElement
          )}
          {badge && (
            <span className="shrink-0 text-[10px] text-muted-foreground/70 font-mono">
              {badge}
            </span>
          )}
          {count !== undefined && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
          {isConnected !== undefined && (
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isConnected ? "bg-success" : "bg-muted-foreground/30"
            )} />
          )}
        </button>
        {rightElement && (
          <div className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
