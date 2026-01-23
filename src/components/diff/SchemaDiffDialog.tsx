import { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  GitCompare,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  TableProperties,
  Eye,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiffStore } from "@/stores";
import { useDatabase } from "@/hooks";
import { SourceSelectionStep } from "./SourceSelectionStep";
import { DiffVisualizationStep } from "./DiffVisualizationStep";
import { MigrationPreviewStep } from "./MigrationPreviewStep";

type WizardStep = 0 | 1 | 2;

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 0, label: "Select Tables", icon: TableProperties },
  { id: 1, label: "View Differences", icon: Eye },
  { id: 2, label: "Migration SQL", icon: FileCode2 },
];

export function SchemaDiffDialog() {
  const {
    showSchemaDiffDialog,
    wizardStep,
    comparisonMode,
    sourceConnectionId,
    sourceTableName,
    targetConnectionId,
    targetTableName,
    selectedSnapshotId,
    migrationDirection,
    diffResult,
    isComparing,
    error,
    closeSchemaDiffDialog,
    setWizardStep,
    setDiffResult,
    setIsComparing,
    setError,
    setSnapshots,
    setIsLoadingSnapshots,
  } = useDiffStore();

  const {
    compareTableSchemas,
    compareWithSnapshot,
    listSchemaSnapshots,
  } = useDatabase();

  // Load snapshots when dialog opens
  useEffect(() => {
    if (showSchemaDiffDialog) {
      setIsLoadingSnapshots(true);
      listSchemaSnapshots()
        .then((snapshots) => {
          setSnapshots(snapshots);
        })
        .catch((err) => {
          console.error("Failed to load snapshots:", err);
        })
        .finally(() => {
          setIsLoadingSnapshots(false);
        });
    }
  }, [showSchemaDiffDialog, listSchemaSnapshots, setSnapshots, setIsLoadingSnapshots]);

  // Check if we can proceed to next step
  const canProceedToStep1 = useCallback(() => {
    if (!sourceConnectionId || !sourceTableName) return false;

    if (comparisonMode === "snapshot") {
      return !!selectedSnapshotId;
    } else {
      return !!targetConnectionId && !!targetTableName;
    }
  }, [comparisonMode, sourceConnectionId, sourceTableName, targetConnectionId, targetTableName, selectedSnapshotId]);

  // Run comparison when moving to step 1
  const runComparison = useCallback(async () => {
    if (!sourceConnectionId || !sourceTableName) return;

    setIsComparing(true);
    setError(null);

    try {
      let result;

      if (comparisonMode === "snapshot" && selectedSnapshotId) {
        result = await compareWithSnapshot(
          sourceConnectionId,
          sourceTableName,
          selectedSnapshotId
        );
      } else if (targetConnectionId && targetTableName) {
        result = await compareTableSchemas({
          mode: comparisonMode,
          sourceConnectionId,
          sourceTableName,
          targetConnectionId,
          targetTableName,
          migrationDirection,
        });
      }

      if (result) {
        setDiffResult(result);
        setWizardStep(1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsComparing(false);
    }
  }, [
    comparisonMode,
    sourceConnectionId,
    sourceTableName,
    targetConnectionId,
    targetTableName,
    selectedSnapshotId,
    migrationDirection,
    compareTableSchemas,
    compareWithSnapshot,
    setDiffResult,
    setIsComparing,
    setError,
    setWizardStep,
  ]);

  const handleNext = useCallback(() => {
    if (wizardStep === 0) {
      runComparison();
    } else if (wizardStep === 1) {
      setWizardStep(2);
    }
  }, [wizardStep, runComparison, setWizardStep]);

  const handleBack = useCallback(() => {
    if (wizardStep > 0) {
      setWizardStep((wizardStep - 1) as WizardStep);
    }
  }, [wizardStep, setWizardStep]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!isComparing && !open) {
        closeSchemaDiffDialog();
      }
    },
    [isComparing, closeSchemaDiffDialog]
  );

  return (
    <Dialog open={showSchemaDiffDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Schema Diff & Migration
          </DialogTitle>
          <DialogDescription>
            Compare table structures and generate migration scripts
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-4 border-b">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = wizardStep === step.id;
            const isCompleted = wizardStep > step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-green-500/20 text-green-700 dark:text-green-300",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-hidden">
          {wizardStep === 0 && <SourceSelectionStep />}
          {wizardStep === 1 && diffResult && <DiffVisualizationStep result={diffResult} />}
          {wizardStep === 2 && diffResult && <MigrationPreviewStep result={diffResult} />}
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {wizardStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isComparing}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isComparing}
            >
              {wizardStep === 2 ? "Close" : "Cancel"}
            </Button>
            {wizardStep < 2 && (
              <Button
                onClick={handleNext}
                disabled={
                  isComparing ||
                  (wizardStep === 0 && !canProceedToStep1()) ||
                  (wizardStep === 1 && !diffResult)
                }
              >
                {isComparing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    {wizardStep === 0 ? "Compare" : "View Migration"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
