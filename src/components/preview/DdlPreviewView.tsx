import { useMemo } from "react";
import { Plus, Minus, Edit3 } from "lucide-react";
import type { StatementPreview } from "@/types";
import { cn } from "@/lib/utils";

interface DdlPreviewViewProps {
  statements: StatementPreview[];
}

function computeDiffLines(before: string, after: string): { type: "added" | "removed" | "unchanged"; text: string }[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const result: { type: "added" | "removed" | "unchanged"; text: string }[] = [];

  // Simple line-by-line diff
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];

    if (beforeLine === undefined) {
      result.push({ type: "added", text: afterLine });
    } else if (afterLine === undefined) {
      result.push({ type: "removed", text: beforeLine });
    } else if (beforeLine === afterLine) {
      result.push({ type: "unchanged", text: beforeLine });
    } else {
      result.push({ type: "removed", text: beforeLine });
      result.push({ type: "added", text: afterLine });
    }
  }

  return result;
}

function getChangeType(stmt: StatementPreview): "create" | "drop" | "alter" {
  if (stmt.schemaBefore && !stmt.schemaAfter) return "drop";
  if (!stmt.schemaBefore && stmt.schemaAfter) return "create";
  return "alter";
}

export function DdlPreviewView({ statements }: DdlPreviewViewProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Edit3 className="h-4 w-4" />
        Schema Changes
      </h3>

      {statements.map((stmt, index) => {
        const changeType = getChangeType(stmt);

        return (
          <div key={index} className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-bold uppercase px-2 py-0.5 rounded",
                    changeType === "create" && "bg-success/20 text-success",
                    changeType === "drop" && "bg-destructive/20 text-destructive",
                    changeType === "alter" && "bg-info/20 text-info"
                  )}
                >
                  {changeType}
                </span>
                <span className="text-sm font-medium">
                  {stmt.tableName || "Unknown Table"}
                </span>
              </div>
            </div>

            <div className="p-4">
              {changeType === "create" && stmt.schemaAfter && (
                <div className="bg-success/10 p-3 rounded border border-success/20">
                  <pre className="text-xs font-mono text-success whitespace-pre-wrap overflow-x-auto">
                    {stmt.schemaAfter}
                  </pre>
                </div>
              )}

              {changeType === "drop" && stmt.schemaBefore && (
                <div className="bg-destructive/10 p-3 rounded border border-destructive/20">
                  <pre className="text-xs font-mono text-destructive whitespace-pre-wrap line-through opacity-75 overflow-x-auto">
                    {stmt.schemaBefore}
                  </pre>
                </div>
              )}

              {changeType === "alter" && stmt.schemaBefore && stmt.schemaAfter && (
                <DiffView before={stmt.schemaBefore} after={stmt.schemaAfter} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiffView({ before, after }: { before: string; after: string }) {
  const diffLines = useMemo(() => computeDiffLines(before, after), [before, after]);

  return (
    <div className="font-mono text-xs rounded border border-border overflow-hidden">
      {diffLines.map((line, idx) => (
        <div
          key={idx}
          className={cn(
            "px-3 py-0.5 flex items-start gap-2",
            line.type === "added" && "bg-success/10 text-success",
            line.type === "removed" && "bg-destructive/10 text-destructive",
            line.type === "unchanged" && "text-muted-foreground"
          )}
        >
          <span className="w-4 flex-shrink-0">
            {line.type === "added" && <Plus className="h-3 w-3" />}
            {line.type === "removed" && <Minus className="h-3 w-3" />}
          </span>
          <span className="whitespace-pre-wrap break-all">{line.text || " "}</span>
        </div>
      ))}
    </div>
  );
}
