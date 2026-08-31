import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

/** Label widths cycled across skeleton rows so lists don't look stamped */
const LABEL_WIDTHS = ["w-32", "w-24", "w-40", "w-28", "w-36", "w-20"];

interface TreeRowsSkeletonProps {
  /** Number of shimmer rows */
  rows?: number;
  /** Tree indentation level, matches TreeItem's paddingLeft formula */
  level?: number;
  className?: string;
}

/**
 * Loading placeholder for sidebar tree sections. Renders rows at the density
 * row height with the same indentation as TreeItem, so the tree keeps its
 * shape while children load instead of collapsing to a spinner row.
 */
export function TreeRowsSkeleton({ rows = 4, level = 1, className }: TreeRowsSkeletonProps) {
  return (
    <div className={cn("min-w-0", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 h-[var(--row-h)]"
          style={{ paddingLeft: `${level * 14 + 6}px`, paddingRight: "6px" }}
        >
          <span className="w-3.5 shrink-0" />
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className={cn("h-3", LABEL_WIDTHS[i % LABEL_WIDTHS.length])} />
        </div>
      ))}
    </div>
  );
}

interface GridSkeletonProps {
  /** Number of body rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  className?: string;
}

/**
 * Loading placeholder for tabular result panes (query results, table viewer).
 * Mimics the data grid's header + row rhythm so the layout doesn't jump when
 * real data lands.
 */
export function GridSkeleton({ rows = 8, columns = 5, className }: GridSkeletonProps) {
  return (
    <div className={cn("w-full overflow-hidden p-2", className)} role="status" aria-label="Loading results">
      {/* Header row */}
      <div
        className="grid gap-3 border-b border-border pb-2 mb-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className={cn("h-2.5", i % 2 === 0 ? "w-16" : "w-12")} />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-3 items-center h-8"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton
              key={c}
              className={cn("h-3", LABEL_WIDTHS[(r + c) % LABEL_WIDTHS.length])}
              style={{ animationDelay: `${r * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
