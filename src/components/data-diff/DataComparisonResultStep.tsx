import { useMemo, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  PlusCircle,
  MinusCircle,
  Pencil,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataDiffStore } from "@/stores";
import type { DataCompareResult, DiffFilterMode, RowDiff } from "@/types";

interface Props {
  result: DataCompareResult;
}

const FILTER_TABS: { mode: DiffFilterMode; label: string }[] = [
  { mode: "all", label: "All" },
  { mode: "differences", label: "Differences" },
  { mode: "matched", label: "Matched" },
  { mode: "added", label: "Added" },
  { mode: "removed", label: "Removed" },
  { mode: "modified", label: "Modified" },
];

export function DataComparisonResultStep({ result }: Props) {
  const { filterMode, setFilterMode } = useDataDiffStore();
  const sourceScrollRef = useRef<HTMLDivElement>(null);
  const targetScrollRef = useRef<HTMLDivElement>(null);

  const filteredRows = useMemo(() => {
    switch (filterMode) {
      case "differences":
        return result.rows.filter((r) => r.status !== "matched");
      case "matched":
        return result.rows.filter((r) => r.status === "matched");
      case "added":
        return result.rows.filter((r) => r.status === "added");
      case "removed":
        return result.rows.filter((r) => r.status === "removed");
      case "modified":
        return result.rows.filter((r) => r.status === "modified");
      default:
        return result.rows;
    }
  }, [result.rows, filterMode]);

  const handleSourceScroll = useCallback(() => {
    if (sourceScrollRef.current && targetScrollRef.current) {
      targetScrollRef.current.scrollTop = sourceScrollRef.current.scrollTop;
      targetScrollRef.current.scrollLeft = sourceScrollRef.current.scrollLeft;
    }
  }, []);

  const handleTargetScroll = useCallback(() => {
    if (sourceScrollRef.current && targetScrollRef.current) {
      sourceScrollRef.current.scrollTop = targetScrollRef.current.scrollTop;
      sourceScrollRef.current.scrollLeft = targetScrollRef.current.scrollLeft;
    }
  }, []);

  const diffColumnNames = useMemo(() => {
    const set = new Set<string>();
    for (const row of result.rows) {
      for (const cd of row.cellDiffs) {
        set.add(cd.columnName);
      }
    }
    return set;
  }, [result.rows]);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
        <Badge variant="secondary" className="gap-1">
          <CheckCircle className="h-3 w-3 text-success" />
          {result.summary.matchedRows} matched
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Pencil className="h-3 w-3 text-warning" />
          {result.summary.modifiedRows} modified
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <PlusCircle className="h-3 w-3 text-success" />
          {result.summary.addedRows} added
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <MinusCircle className="h-3 w-3 text-destructive" />
          {result.summary.removedRows} removed
        </Badge>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {result.summary.comparisonTimeMs}ms
        </span>
        {result.warnings.length > 0 && (
          <Badge variant="outline" className="gap-1 text-warning border-warning/40">
            <AlertTriangle className="h-3 w-3" />
            {result.warnings.length} warning{result.warnings.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="px-4 py-2 bg-warning/10 border-b">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-warning">{w}</p>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.mode}
            onClick={() => setFilterMode(tab.mode)}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              filterMode === tab.mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {tab.label}
            {tab.mode === "all" && ` (${result.rows.length})`}
            {tab.mode === "differences" && ` (${result.summary.modifiedRows + result.summary.addedRows + result.summary.removedRows})`}
            {tab.mode === "matched" && ` (${result.summary.matchedRows})`}
            {tab.mode === "added" && ` (${result.summary.addedRows})`}
            {tab.mode === "removed" && ` (${result.summary.removedRows})`}
            {tab.mode === "modified" && ` (${result.summary.modifiedRows})`}
          </button>
        ))}
      </div>

      {/* Side-by-side grids */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-2 h-full">
          {/* Source grid */}
          <div className="flex flex-col border-r overflow-hidden">
            <div className="px-3 py-2 bg-info/10 text-info text-xs font-medium border-b truncate">
              Source: {result.sourceLabel}
            </div>
            <div
              ref={sourceScrollRef}
              onScroll={handleSourceScroll}
              className="flex-1 overflow-auto"
            >
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted">
                    <th className="px-2 py-1.5 text-left font-medium border-b w-8">#</th>
                    {result.columns.map((col) => (
                      <th
                        key={col.name}
                        className={cn(
                          "px-2 py-1.5 text-left font-medium border-b whitespace-nowrap",
                          diffColumnNames.has(col.name) && "text-warning"
                        )}
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <SourceRow
                      key={idx}
                      row={row}
                      columns={result.columns.map((c) => c.name)}
                      formatValue={formatValue}
                    />
                  ))}
                </tbody>
              </table>
              {filteredRows.length === 0 && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No rows match the current filter
                </div>
              )}
            </div>
          </div>

          {/* Target grid */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-3 py-2 bg-success/10 text-success text-xs font-medium border-b truncate">
              Target: {result.targetLabel}
            </div>
            <div
              ref={targetScrollRef}
              onScroll={handleTargetScroll}
              className="flex-1 overflow-auto"
            >
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted">
                    <th className="px-2 py-1.5 text-left font-medium border-b w-8">#</th>
                    {result.columns.map((col) => (
                      <th
                        key={col.name}
                        className={cn(
                          "px-2 py-1.5 text-left font-medium border-b whitespace-nowrap",
                          diffColumnNames.has(col.name) && "text-warning"
                        )}
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <TargetRow
                      key={idx}
                      row={row}
                      columns={result.columns.map((c) => c.name)}
                      formatValue={formatValue}
                    />
                  ))}
                </tbody>
              </table>
              {filteredRows.length === 0 && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No rows match the current filter
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRow({
  row,
  columns,
  formatValue,
}: {
  row: RowDiff;
  columns: string[];
  formatValue: (v: unknown) => string;
}) {
  const diffCols = useMemo(
    () => new Set(row.cellDiffs.map((cd) => cd.columnName)),
    [row.cellDiffs]
  );

  if (row.status === "added") {
    // Added rows only exist in target - show empty placeholder
    return (
      <tr className="bg-success/5">
        <td className="px-2 py-1 border-b text-muted-foreground">-</td>
        {columns.map((col) => (
          <td key={col} className="px-2 py-1 border-b text-muted-foreground/40">
            -
          </td>
        ))}
      </tr>
    );
  }

  const rowBg =
    row.status === "removed"
      ? "bg-destructive/10"
      : row.status === "modified"
      ? "bg-warning/5"
      : "";

  return (
    <tr className={rowBg}>
      <td className="px-2 py-1 border-b text-muted-foreground">
        {row.rowIndex + 1}
      </td>
      {columns.map((col, colIdx) => {
        const value =
          row.sourceRow && colIdx < row.sourceRow.length
            ? row.sourceRow[colIdx]
            : null;
        const isDiff = diffCols.has(col);
        return (
          <td
            key={col}
            className={cn(
              "px-2 py-1 border-b whitespace-nowrap max-w-[200px] truncate",
              isDiff && "bg-warning/20 font-medium"
            )}
            title={formatValue(value)}
          >
            {formatValue(value)}
          </td>
        );
      })}
    </tr>
  );
}

function TargetRow({
  row,
  columns,
  formatValue,
}: {
  row: RowDiff;
  columns: string[];
  formatValue: (v: unknown) => string;
}) {
  const diffCols = useMemo(
    () => new Set(row.cellDiffs.map((cd) => cd.columnName)),
    [row.cellDiffs]
  );

  if (row.status === "removed") {
    // Removed rows only exist in source - show empty placeholder
    return (
      <tr className="bg-destructive/5">
        <td className="px-2 py-1 border-b text-muted-foreground">-</td>
        {columns.map((col) => (
          <td key={col} className="px-2 py-1 border-b text-muted-foreground/40">
            -
          </td>
        ))}
      </tr>
    );
  }

  const rowBg =
    row.status === "added"
      ? "bg-success/10"
      : row.status === "modified"
      ? "bg-warning/5"
      : "";

  return (
    <tr className={rowBg}>
      <td className="px-2 py-1 border-b text-muted-foreground">
        {row.rowIndex + 1}
      </td>
      {columns.map((col, colIdx) => {
        const value =
          row.targetRow && colIdx < row.targetRow.length
            ? row.targetRow[colIdx]
            : null;
        const isDiff = diffCols.has(col);
        return (
          <td
            key={col}
            className={cn(
              "px-2 py-1 border-b whitespace-nowrap max-w-[200px] truncate",
              isDiff && "bg-warning/20 font-medium"
            )}
            title={formatValue(value)}
          >
            {formatValue(value)}
          </td>
        );
      })}
    </tr>
  );
}
