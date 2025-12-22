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
        "bg-[hsl(var(--success)/0.05)] border border-[hsl(var(--success)/0.1)]",
        "text-[10px] font-mono text-[hsl(var(--success))] font-bold uppercase tracking-wider",
        className
      )}
    >
      <div className="h-1 w-1 rounded-full bg-[hsl(var(--success))]" />
      <span className="tabular-nums">{timeMs}ms</span>
    </div>
  );
}
