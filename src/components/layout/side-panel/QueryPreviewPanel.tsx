import { useMemo } from "react";
import { X, Eye, WarningCircle, CircleNotch, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { useQueryStore, usePreviewStore } from "@/stores";
import { useDatabase } from "@/hooks";
import { DdlPreviewView } from "@/components/preview/DdlPreviewView";
import { DmlPreviewView } from "@/components/preview/DmlPreviewView";

// Query Preview Panel
export function QueryPreviewPanel() {
  const { isPreviewLoading, previewResult, previewSql, previewConnectionId, closePreview } = usePreviewStore();
  const { activeTabId } = useQueryStore();
  const { executeQuery } = useDatabase();

  const hasDdlStatements = useMemo(() => {
    return previewResult?.statements.some((s) => s.statementType === "ddl") ?? false;
  }, [previewResult]);

  const hasDmlStatements = useMemo(() => {
    return previewResult?.statements.some((s) => s.statementType === "dml") ?? false;
  }, [previewResult]);

  const handleApply = async () => {
    if (!previewSql || !previewConnectionId || !activeTabId) return;

    await executeQuery(
      {
        connectionId: previewConnectionId,
        sql: previewSql,
        limit: undefined,
        offset: undefined,
      },
      activeTabId
    );
    closePreview();
  };

  if (!previewResult && !isPreviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
          <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-elev-1">
            <Eye weight="regular" className="h-10 w-10 text-muted-foreground/30" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground/60 mb-2">No preview</p>
        <p className="text-xs text-muted-foreground/60 max-w-[200px]">
          Click "Preview Changes" in a query tab to see DDL/DML preview
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {isPreviewLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CircleNotch weight="regular" className="h-8 w-8 animate-spin text-primary mb-4" />
              <span className="text-sm text-muted-foreground">Analyzing query...</span>
            </div>
          ) : previewResult?.error ? (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <WarningCircle weight="regular" className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <span className="text-sm text-destructive">{previewResult.error}</span>
            </div>
          ) : previewResult ? (
            <div className="space-y-6">
              {previewResult.warning && (
                <div className="flex items-start gap-3 p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <WarningCircle weight="regular" className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-warning">
                    {previewResult.warning}
                  </span>
                </div>
              )}
              {previewResult.success && previewResult.statements.length === 0 && !previewResult.warning && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <p className="text-sm font-medium text-foreground/60 mb-2">No changes to preview</p>
                  <p className="text-xs text-muted-foreground/60 max-w-[200px] text-center">
                    The query doesn't contain any DDL or DML statements
                  </p>
                </div>
              )}

              {hasDdlStatements && (
                <DdlPreviewView
                  statements={previewResult.statements.filter((s) => s.statementType === "ddl")}
                />
              )}

              {hasDmlStatements && (
                <DmlPreviewView
                  statements={previewResult.statements.filter((s) => s.statementType === "dml")}
                />
              )}

              {previewResult.executionTimeMs > 0 && (
                <div className="text-xs text-muted-foreground text-right pt-2">
                  Preview completed in {previewResult.executionTimeMs}ms
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions Footer */}
      {(previewResult || isPreviewLoading) && (
        <div className="border-t border-border p-3 bg-gradient-to-t from-muted/40 to-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5 h-9"
              onClick={closePreview}
            >
              <X weight="regular" className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs gap-1.5 h-9 font-medium shadow-elev-1"
              onClick={handleApply}
              disabled={isPreviewLoading || !previewResult?.success}
            >
              <Check weight="regular" className="h-3.5 w-3.5" />
              Apply Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
