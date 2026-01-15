import * as React from "react";
import { BarChart3, Hash, Calendar, Type, Binary } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGridStore, calculateColumnStats } from "@/stores/grid";
import type { ColumnInfo, ColumnStats } from "@/types";
import { cn } from "@/lib/utils";

interface ColumnStatisticsDialogProps {
  columns: ColumnInfo[];
  data: Record<string, unknown>[];
}

export function ColumnStatisticsDialog({
  columns,
  data,
}: ColumnStatisticsDialogProps) {
  const { statisticsColumn, statisticsDialogOpen, closeStatisticsDialog } =
    useGridStore();

  const [stats, setStats] = React.useState<ColumnStats | null>(null);

  const columnInfo = React.useMemo(
    () => columns.find((c) => c.name === statisticsColumn),
    [columns, statisticsColumn]
  );

  // Calculate stats when dialog opens or column changes
  React.useEffect(() => {
    if (statisticsDialogOpen && statisticsColumn && columnInfo) {
      const calculated = calculateColumnStats(
        data,
        statisticsColumn,
        columnInfo.dataType
      );
      setStats(calculated);
    }
  }, [statisticsDialogOpen, statisticsColumn, columnInfo, data]);

  if (!statisticsColumn || !columnInfo || !stats) {
    return null;
  }

  const isNumeric = /int|float|double|decimal|numeric|real|money|serial|number/i.test(
    columnInfo.dataType
  );
  const isString = /char|text|varchar|string/i.test(columnInfo.dataType);
  const isDate = /date|time|timestamp/i.test(columnInfo.dataType);

  const getTypeIcon = () => {
    if (isNumeric) return <Hash className="h-4 w-4" />;
    if (isDate) return <Calendar className="h-4 w-4" />;
    if (isString) return <Type className="h-4 w-4" />;
    return <Binary className="h-4 w-4" />;
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return "-";
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };

  const nullPercentage =
    stats.totalCount > 0
      ? ((stats.nullCount / stats.totalCount) * 100).toFixed(1)
      : "0";

  const distinctPercentage =
    stats.totalCount - stats.nullCount > 0
      ? (
          (stats.distinctCount / (stats.totalCount - stats.nullCount)) *
          100
        ).toFixed(1)
      : "0";

  return (
    <Dialog open={statisticsDialogOpen} onOpenChange={closeStatisticsDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Column Statistics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Column Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="p-2 bg-background rounded">
              {getTypeIcon()}
            </div>
            <div>
              <div className="font-medium">{statisticsColumn}</div>
              <div className="text-sm text-muted-foreground">
                {columnInfo.dataType}
                {columnInfo.nullable ? " (nullable)" : " (not null)"}
              </div>
            </div>
          </div>

          {/* General Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Total Rows"
              value={formatNumber(stats.totalCount)}
            />
            <StatCard
              label="NULL Values"
              value={`${formatNumber(stats.nullCount)} (${nullPercentage}%)`}
            />
            <StatCard
              label="Distinct Values"
              value={`${formatNumber(stats.distinctCount)} (${distinctPercentage}%)`}
            />
            <StatCard
              label="Non-NULL"
              value={formatNumber(stats.totalCount - stats.nullCount)}
            />
          </div>

          {/* Numeric Stats */}
          {isNumeric && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Numeric Statistics
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Sum" value={formatNumber(stats.sum)} />
                <StatCard label="Average" value={formatNumber(stats.avg)} />
                <StatCard
                  label="Minimum"
                  value={
                    stats.min !== undefined ? formatNumber(Number(stats.min)) : "-"
                  }
                />
                <StatCard
                  label="Maximum"
                  value={
                    stats.max !== undefined ? formatNumber(Number(stats.max)) : "-"
                  }
                />
                {stats.stdDev !== undefined && (
                  <StatCard
                    label="Std Dev"
                    value={formatNumber(stats.stdDev)}
                    className="col-span-2"
                  />
                )}
              </div>
            </div>
          )}

          {/* String Stats */}
          {isString && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                String Statistics
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Min Length"
                  value={stats.minLength?.toString() ?? "-"}
                />
                <StatCard
                  label="Max Length"
                  value={stats.maxLength?.toString() ?? "-"}
                />
                <StatCard
                  label="Avg Length"
                  value={
                    stats.avgLength !== undefined
                      ? stats.avgLength.toFixed(1)
                      : "-"
                  }
                />
              </div>
            </div>
          )}

          {/* Date Stats */}
          {isDate && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Date Range
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Earliest"
                  value={
                    stats.earliestDate
                      ? new Date(stats.earliestDate).toLocaleDateString()
                      : "-"
                  }
                />
                <StatCard
                  label="Latest"
                  value={
                    stats.latestDate
                      ? new Date(stats.latestDate).toLocaleDateString()
                      : "-"
                  }
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  className?: string;
}

function StatCard({ label, value, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "p-3 border rounded-lg bg-background",
        className
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-mono font-medium mt-0.5">{value}</div>
    </div>
  );
}
