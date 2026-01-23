import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Copy,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showSuccessToast, showErrorToast } from "@/lib/toast-helpers";
import type { SchemaDiffResult } from "@/types";

interface MigrationPreviewStepProps {
  result: SchemaDiffResult;
}

export function MigrationPreviewStep({ result }: MigrationPreviewStepProps) {
  const [selectedStatements, setSelectedStatements] = useState<Set<number>>(
    () => new Set(result.migrationSql.map((_, i) => i))
  );

  // Sort statements by order
  const sortedStatements = useMemo(
    () => [...result.migrationSql].sort((a, b) => a.order - b.order),
    [result.migrationSql]
  );

  // Get the combined SQL for selected statements
  const combinedSql = useMemo(() => {
    return sortedStatements
      .filter((_, i) => selectedStatements.has(i))
      .map((stmt) => `-- ${stmt.description}\n${stmt.sql};`)
      .join("\n\n");
  }, [sortedStatements, selectedStatements]);

  const toggleStatement = (index: number) => {
    setSelectedStatements((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStatements(new Set(sortedStatements.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelectedStatements(new Set());
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(combinedSql);
      showSuccessToast("Migration SQL copied to clipboard");
    } catch {
      showErrorToast("Failed to copy to clipboard");
    }
  };

  const downloadSql = () => {
    const blob = new Blob([combinedSql], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration_${result.sourceTable}_to_${result.targetTable}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccessToast("Migration SQL downloaded");
  };

  if (result.isIdentical || result.migrationSql.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">No migration needed</h3>
        <p className="text-muted-foreground">
          The schemas are identical or no changes require migration.
        </p>
      </div>
    );
  }

  const destructiveCount = sortedStatements.filter(
    (s, i) => s.isDestructive && selectedStatements.has(i)
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header with actions */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5" />
            <span className="font-medium">Migration Script</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>
              Select None
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            disabled={selectedStatements.size === 0}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSql}
            disabled={selectedStatements.size === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Warnings banner */}
      {destructiveCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {destructiveCount} destructive{" "}
            {destructiveCount === 1 ? "statement" : "statements"} selected.
            Review carefully before execution.
          </span>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {sortedStatements.map((stmt, index) => (
            <div
              key={index}
              className={cn(
                "border rounded-lg overflow-hidden transition-opacity",
                !selectedStatements.has(index) && "opacity-50"
              )}
            >
              {/* Statement header */}
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 bg-muted/50",
                  stmt.isDestructive && "bg-red-500/10"
                )}
              >
                <Checkbox
                  id={`stmt-${index}`}
                  checked={selectedStatements.has(index)}
                  onCheckedChange={() => toggleStatement(index)}
                />
                <label
                  htmlFor={`stmt-${index}`}
                  className="flex-1 text-sm cursor-pointer"
                >
                  {stmt.description}
                </label>
                <div className="flex items-center gap-2">
                  {stmt.isDestructive && (
                    <Badge
                      variant="outline"
                      className="bg-red-500/10 text-red-700 dark:text-red-300 border-transparent"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Destructive
                    </Badge>
                  )}
                  <Badge variant="secondary" className="font-mono text-xs">
                    #{stmt.order + 1}
                  </Badge>
                </div>
              </div>

              {/* SQL code */}
              <pre
                className={cn(
                  "p-3 text-sm font-mono overflow-x-auto",
                  "bg-muted/30 text-foreground"
                )}
              >
                <code>{stmt.sql};</code>
              </pre>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Summary footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
        <div className="text-sm text-muted-foreground">
          {selectedStatements.size} of {sortedStatements.length} statements
          selected
        </div>
        {result.warnings.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {result.warnings.length} warning{result.warnings.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
