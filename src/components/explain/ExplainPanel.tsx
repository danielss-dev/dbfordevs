import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
  Code,
  TreeDeciduous,
  Clock,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Badge, ScrollArea } from "@/components/ui";
import { useExplainStore } from "@/stores/explain";
import { useDatabase } from "@/hooks";
import { PlanTree } from "./PlanTree";
import type { ExplainWarning } from "@/types";

const getSeverityIcon = (severity: ExplainWarning["severity"]) => {
  switch (severity) {
    case "critical":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

export function ExplainPanel() {
  const {
    isExplainLoading,
    explainResult,
    explainSql,
    explainConnectionId,
    isAnalyzeMode,
    error,
    closeExplain,
    toggleAnalyzeMode,
    openExplain,
    setExplainResult,
    setExplainError,
  } = useExplainStore();

  const { explainQuery } = useDatabase();
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");

  const handleRerun = async () => {
    if (!explainSql || !explainConnectionId) return;

    openExplain(explainSql, explainConnectionId, isAnalyzeMode);

    try {
      const result = await explainQuery({
        connectionId: explainConnectionId,
        sql: explainSql,
        analyze: isAnalyzeMode,
      });

      if (result) {
        setExplainResult(result);
      } else {
        setExplainError("Failed to get execution plan");
      }
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!explainResult && !isExplainLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
          <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-sm">
            <TreeDeciduous className="h-10 w-10 text-muted-foreground/30" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground/60 mb-2">
          No execution plan
        </p>
        <p className="text-xs text-muted-foreground/60 max-w-[200px]">
          Click "Explain" in a query tab to visualize the execution plan
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle & Analyze mode */}
      {(explainResult || isExplainLoading) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 shrink-0">
          <div className="flex bg-muted rounded-md p-1 border border-border w-fit">
            <Button
              variant={viewMode === "tree" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-[11px] gap-1.5 font-medium transition-all",
                viewMode === "tree" && "shadow-sm"
              )}
              onClick={() => setViewMode("tree")}
            >
              <TreeDeciduous className="h-3.5 w-3.5" />
              Tree
            </Button>
            <Button
              variant={viewMode === "raw" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-[11px] gap-1.5 font-medium transition-all",
                viewMode === "raw" && "shadow-sm"
              )}
              onClick={() => setViewMode("raw")}
            >
              <Code className="h-3.5 w-3.5" />
              Raw
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isAnalyzeMode ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={toggleAnalyzeMode}
            >
              <Clock className="h-3.5 w-3.5" />
              ANALYZE
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={handleRerun}
              disabled={isExplainLoading}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rerun
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isExplainLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <span className="text-sm text-muted-foreground">
                {isAnalyzeMode
                  ? "Running query and analyzing..."
                  : "Analyzing query plan..."}
              </span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          ) : explainResult ? (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="flex items-center gap-4 text-sm flex-wrap">
                {explainResult.totalCost != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Total Cost:</span>
                    <Badge variant="secondary">
                      {explainResult.totalCost.toFixed(2)}
                    </Badge>
                  </div>
                )}
                {explainResult.planningTime != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Planning:</span>
                    <Badge variant="outline">
                      {explainResult.planningTime.toFixed(3)}ms
                    </Badge>
                  </div>
                )}
                {explainResult.executionTime != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Execution:</span>
                    <Badge variant="outline">
                      {explainResult.executionTime.toFixed(3)}ms
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Database:</span>
                  <Badge variant="outline">{explainResult.databaseType}</Badge>
                </div>
              </div>

              {/* Warnings */}
              {explainResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Warnings & Suggestions
                  </span>
                  {explainResult.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border",
                        warning.severity === "critical" &&
                          "bg-red-500/10 border-red-500/20",
                        warning.severity === "warning" &&
                          "bg-amber-500/10 border-amber-500/20",
                        warning.severity === "info" &&
                          "bg-blue-500/10 border-blue-500/20"
                      )}
                    >
                      {getSeverityIcon(warning.severity)}
                      <div className="flex-1">
                        <p className="text-sm">{warning.message}</p>
                        {warning.suggestion && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {warning.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Plan view */}
              {viewMode === "tree" ? (
                <div className="bg-muted/30 rounded-lg border border-border p-2">
                  <PlanTree node={explainResult.plan} />
                </div>
              ) : (
                <pre className="bg-muted/50 p-4 rounded-lg border border-border text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {explainResult.rawOutput}
                </pre>
              )}
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* Footer */}
      {(explainResult || isExplainLoading || error) && (
        <div className="border-t border-border p-3 bg-gradient-to-t from-muted/40 to-muted/20 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5 h-9"
            onClick={closeExplain}
          >
            <X className="h-3.5 w-3.5" />
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
