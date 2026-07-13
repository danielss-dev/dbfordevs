import { cn } from "@/lib/utils";

interface ExecutionTimeBadgeProps {
  timeMs: number;
  className?: string;
}

/**
 * Badge component that displays query execution time with a success indicator
 */
export function ExecutionTimeBadge({ timeMs, className }: ExecutionTimeBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-0.5 rounded",
        "bg-success/5 border border-success/10",
        "text-[10px] font-mono text-success font-bold uppercase tracking-wider",
        className
      )}
    >
      <div className="h-1 w-1 rounded-full bg-success" />
      <span className="tabular-nums">{timeMs}ms</span>
    </div>
  );
}
