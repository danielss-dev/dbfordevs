import { useCallback } from "react";
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
  Rows3,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  TableProperties,
  Eye,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataDiffStore } from "@/stores";
import { useDatabase } from "@/hooks";
import { DataSourceSelectionStep } from "./DataSourceSelectionStep";
import { DataComparisonResultStep } from "./DataComparisonResultStep";
import { DataDiffExportStep } from "./DataDiffExportStep";

type WizardStep = 0 | 1 | 2;

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 0, label: "Select Sources", icon: TableProperties },
  { id: 1, label: "View Differences", icon: Eye },
  { id: 2, label: "Export Report", icon: Download },
];

export function DataCompareDialog() {
  const {
    showDataCompareDialog,
    wizardStep,
    sourceType,
    sourceConnectionId,
    sourceTableName,
    sourceSql,
    targetConnectionId,
    targetTableName,
    targetSql,
    options,
    compareResult,
    isComparing,
    error,
    closeDataCompareDialog,
    setWizardStep,
    setCompareResult,
    setIsComparing,
    setError,
  } = useDataDiffStore();

  const { compareTableData, compareQueryData } = useDatabase();

  const canProceedToStep1 = useCallback(() => {
    if (!sourceConnectionId || !targetConnectionId) return false;

    if (sourceType === "table") {
      return !!sourceTableName && !!targetTableName;
    } else {
      return !!sourceSql.trim() && !!targetSql.trim();
    }
  }, [sourceType, sourceConnectionId, sourceTableName, sourceSql, targetConnectionId, targetTableName, targetSql]);

  const runComparison = useCallback(async () => {
    if (!sourceConnectionId || !targetConnectionId) return;

    setIsComparing(true);
    setError(null);

    try {
      let result;

      if (sourceType === "table" && sourceTableName && targetTableName) {
        result = await compareTableData({
          sourceConnectionId,
          sourceTableName,
          targetConnectionId,
          targetTableName,
          options,
        });
      } else if (sourceType === "query" && sourceSql.trim() && targetSql.trim()) {
        result = await compareQueryData({
          sourceConnectionId,
          sourceSql,
          targetConnectionId,
          targetSql,
          options,
        });
      }

      if (result) {
        setCompareResult(result);
        setWizardStep(1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsComparing(false);
    }
  }, [
    sourceType,
    sourceConnectionId,
    sourceTableName,
    sourceSql,
    targetConnectionId,
    targetTableName,
    targetSql,
    options,
    compareTableData,
    compareQueryData,
    setCompareResult,
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
        closeDataCompareDialog();
      }
    },
    [isComparing, closeDataCompareDialog]
  );

  return (
    <Dialog open={showDataCompareDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rows3 className="h-5 w-5" />
            Data Comparison
          </DialogTitle>
          <DialogDescription>
            Compare data between tables or query results side-by-side
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
                    isCompleted && "bg-success/20 text-success",
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
        <div className="flex-1 overflow-auto min-h-0">
          {wizardStep === 0 && <DataSourceSelectionStep />}
          {wizardStep === 1 && compareResult && <DataComparisonResultStep result={compareResult} />}
          {wizardStep === 2 && compareResult && <DataDiffExportStep result={compareResult} />}
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
                  (wizardStep === 1 && !compareResult)
                }
              >
                {isComparing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    {wizardStep === 0 ? "Compare" : "Export"}
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
