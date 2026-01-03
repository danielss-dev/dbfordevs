import { useMemo } from "react";
import { AlertCircle, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePreviewStore } from "@/stores/preview";
import { DdlPreviewView } from "./DdlPreviewView";
import { DmlPreviewView } from "./DmlPreviewView";

interface PreviewDialogProps {
  onApply: (sql?: string) => void;
}

export function PreviewDialog({ onApply }: PreviewDialogProps) {
  const {
    isPreviewOpen,
    isPreviewLoading,
    previewResult,
    previewSql,
    closePreview,
  } = usePreviewStore();

  const hasDdlStatements = useMemo(() => {
    return previewResult?.statements.some((s) => s.statementType === "ddl") ?? false;
  }, [previewResult]);

  const hasDmlStatements = useMemo(() => {
    return previewResult?.statements.some((s) => s.statementType === "dml") ?? false;
  }, [previewResult]);

  const handleApply = () => {
    onApply(previewSql || undefined);
    closePreview();
  };

  return (
    <Dialog open={isPreviewOpen} onOpenChange={(open) => !open && closePreview()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Preview Changes</DialogTitle>
          <DialogDescription>
            Review the changes before applying them to your database.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-4 pr-4">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Analyzing query...</span>
              </div>
            ) : previewResult?.error ? (
              <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <span className="text-sm text-destructive">{previewResult.error}</span>
              </div>
            ) : previewResult ? (
              <div className="space-y-6">
                {previewResult.success && previewResult.statements.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No changes to preview.
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
                  <div className="text-xs text-muted-foreground text-right">
                    Preview completed in {previewResult.executionTimeMs}ms
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={closePreview}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={isPreviewLoading || !previewResult?.success}
          >
            <Check className="h-4 w-4 mr-2" />
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
