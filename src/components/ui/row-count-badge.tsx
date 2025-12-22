import { Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RowCountBadgeProps {
  rowCount?: number;
  affectedRows?: number;
  className?: string;
}

/**
 * Badge component that displays row count or affected rows with an icon
 */
export function RowCountBadge({ rowCount, affectedRows, className }: RowCountBadgeProps) {
  const label = affectedRows !== undefined && affectedRows !== null
    ? `${affectedRows} rows affected`
    : `${rowCount || 0} rows`;

  return (
    <span className={cn("badge badge-success", className)}>
      <Rows3 className="h-3 w-3 mr-1" />
      {label}
    </span>
  );
}
