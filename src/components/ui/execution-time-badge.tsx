import { cn } from "@/lib/utils";

interface ExecutionTimeBadgeProps {
  timeMs: number;
  className?: string;
}

/**
 * Quiet meta for query execution time — not a bright badge.
 */
export function ExecutionTimeBadge({ timeMs, className }: ExecutionTimeBadgeProps) {
  return (
    <span
      className={cn(
        "text-[11px] font-medium tabular-nums text-success",
        className
      )}
    >
      {timeMs}ms
    </span>
  );
}
