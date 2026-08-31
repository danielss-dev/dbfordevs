import { cn } from "@/lib/utils";

interface RowCountBadgeProps {
  rowCount?: number;
  affectedRows?: number;
  className?: string;
}

/**
 * Quiet meta for row counts — not a badge chip.
 */
export function RowCountBadge({ rowCount, affectedRows, className }: RowCountBadgeProps) {
  const label = affectedRows !== undefined && affectedRows !== null
    ? `${affectedRows} rows affected`
    : `${rowCount || 0} rows`;

  return (
    <span className={cn("text-[11px] tabular-nums text-muted-foreground", className)}>
      {label}
    </span>
  );
}
