import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table as TableIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Columns,
  Link,
  ListOrdered,
  Code,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, useQueryStore, useConnectionsStore } from "@/stores";
import { useDatabase, useAsyncOperation } from "@/hooks";
import { ColumnEditor, createEmptyColumn } from "./ColumnEditor";
import { ConstraintEditor } from "./ConstraintEditor";
import { IndexEditor } from "./IndexEditor";
import { showSuccessToast } from "@/lib/toast-helpers";
import type {
  NewTableDefinition,
  NewColumnDefinition,
  NewForeignKeyDefinition,
  NewCheckConstraintDefinition,
  NewIndexDefinition,
  DatabaseType,
  TableReferenceInfo,
} from "@/types";

type WizardStep = "basics" | "columns" | "constraints" | "indexes" | "preview";

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: "basics", label: "Basics", icon: TableIcon },
  { id: "columns", label: "Columns", icon: Columns },
  { id: "constraints", label: "Constraints", icon: Link },
  { id: "indexes", label: "Indexes", icon: ListOrdered },
  { id: "preview", label: "Preview", icon: Code },
];

function getInitialTableDefinition(schemaName?: string | null): NewTableDefinition {
  return {
    name: "",
    schema: schemaName ?? undefined,
    columns: [createEmptyColumn()],
    primaryKeyColumns: [],
    foreignKeys: [],
    checkConstraints: [],
    indexes: [],
  };
}

export function CreateTableDialog() {
  const {
    showCreateTableDialog,
    creatingTableConnectionId,
    creatingTableSchemaName,
    setShowCreateTableDialog,
  } = useUIStore();

  const { connections } = useConnectionsStore();
  const { tablesByConnection } = useQueryStore();
  const { getTables, createTable, generateCreateTableDDL, getReferenceableTables } = useDatabase();
  const { execute, isLoading, error, setError } = useAsyncOperation();

  // Get the connection and its database type
  const connection = useMemo(
    () => connections.find((c) => c.id === creatingTableConnectionId),
    [connections, creatingTableConnectionId]
  );
  const databaseType: DatabaseType = connection?.databaseType ?? "postgresql";

  // Get available schemas for the connection
  const availableSchemas = useMemo(() => {
    if (!creatingTableConnectionId) return [];
    const tables = tablesByConnection[creatingTableConnectionId] ?? [];
    const schemas = new Set(tables.map((t) => t.schema).filter(Boolean));
    return Array.from(schemas) as string[];
  }, [creatingTableConnectionId, tablesByConnection]);

  // State
  const [step, setStep] = useState<WizardStep>("basics");
  const [tableDefinition, setTableDefinition] = useState<NewTableDefinition>(() =>
    getInitialTableDefinition(creatingTableSchemaName)
  );
  const [generatedDDL, setGeneratedDDL] = useState<string>("");
  const [isGeneratingDDL, setIsGeneratingDDL] = useState(false);
  const [referenceTables, setReferenceTables] = useState<TableReferenceInfo[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (showCreateTableDialog) {
      setStep("basics");
      setTableDefinition(getInitialTableDefinition(creatingTableSchemaName));
      setGeneratedDDL("");
      setError(null);

      // Load reference tables for FK picker
      if (creatingTableConnectionId) {
        getReferenceableTables(creatingTableConnectionId).then(setReferenceTables);
      }
    }
  }, [showCreateTableDialog, creatingTableSchemaName, creatingTableConnectionId, setError, getReferenceableTables]);

  // Regenerate DDL when step becomes preview or tableDefinition changes while on preview
  useEffect(() => {
    if (step !== "preview" || !creatingTableConnectionId) return;

    let cancelled = false;
    setIsGeneratingDDL(true);
    generateCreateTableDDL(creatingTableConnectionId, tableDefinition)
      .then((ddl) => {
        if (!cancelled) {
          setGeneratedDDL(ddl ?? "-- Failed to generate DDL");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setGeneratedDDL("-- Error generating DDL: " + (err instanceof Error ? err.message : String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeneratingDDL(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [step, tableDefinition, creatingTableConnectionId, generateCreateTableDDL]);

  // Update table definition helpers
  const updateTableDefinition = useCallback(
    (updates: Partial<NewTableDefinition>) => {
      setTableDefinition((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const setColumns = useCallback((columns: NewColumnDefinition[]) => {
    setTableDefinition((prev) => {
      // Update primary key columns based on column isPrimaryKey flags
      const pkColumns = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
      return { ...prev, columns, primaryKeyColumns: pkColumns };
    });
  }, []);

  const setForeignKeys = useCallback((foreignKeys: NewForeignKeyDefinition[]) => {
    updateTableDefinition({ foreignKeys });
  }, [updateTableDefinition]);

  const setCheckConstraints = useCallback(
    (checkConstraints: NewCheckConstraintDefinition[]) => {
      updateTableDefinition({ checkConstraints });
    },
    [updateTableDefinition]
  );

  const setIndexes = useCallback((indexes: NewIndexDefinition[]) => {
    updateTableDefinition({ indexes });
  }, [updateTableDefinition]);

  // Validation
  const validateBasics = useCallback((): string | null => {
    if (!tableDefinition.name.trim()) {
      return "Table name is required";
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableDefinition.name.trim())) {
      return "Table name must start with a letter or underscore and contain only alphanumeric characters and underscores";
    }
    return null;
  }, [tableDefinition.name]);

  const validateColumns = useCallback((): string | null => {
    if (tableDefinition.columns.length === 0) {
      return "At least one column is required";
    }
    const emptyNames = tableDefinition.columns.filter((c) => !c.name.trim());
    if (emptyNames.length > 0) {
      return "All columns must have a name";
    }
    const names = tableDefinition.columns.map((c) => c.name.toLowerCase());
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      return `Duplicate column name: ${duplicates[0]}`;
    }
    return null;
  }, [tableDefinition.columns]);

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case "basics":
        return validateBasics() === null;
      case "columns":
        return validateColumns() === null;
      case "constraints":
      case "indexes":
        return true;
      case "preview":
        return generatedDDL.trim() !== "";
      default:
        return true;
    }
  }, [step, validateBasics, validateColumns, generatedDDL]);

  // Navigation
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      const nextStep = STEPS[nextIndex].id;
      setStep(nextStep);
      // DDL generation is handled by useEffect when step becomes "preview"
    }
  }, [currentStepIndex]);

  const goToPreviousStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].id);
    }
  }, [currentStepIndex]);

  // Create table
  const handleCreateTable = useCallback(async () => {
    if (!creatingTableConnectionId) return;

    await execute(async () => {
      const result = await createTable(creatingTableConnectionId, tableDefinition);
      if (result) {
        showSuccessToast(`Table "${tableDefinition.name}" created successfully`);
        // Refresh tables list
        await getTables(creatingTableConnectionId);
        setShowCreateTableDialog(false);
      } else {
        throw new Error("Failed to create table");
      }
    });
  }, [creatingTableConnectionId, tableDefinition, execute, createTable, getTables, setShowCreateTableDialog]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!isLoading) {
        setShowCreateTableDialog(open);
      }
    },
    [isLoading, setShowCreateTableDialog]
  );

  return (
    <Dialog open={showCreateTableDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Create New Table
          </DialogTitle>
          <DialogDescription>
            Create a new table in {connection?.name ?? "database"}
            {creatingTableSchemaName && ` (schema: ${creatingTableSchemaName})`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 py-2 border-b">
          {STEPS.map((s, index) => {
            const isActive = s.id === step;
            const isCompleted = index < currentStepIndex;
            const Icon = s.icon;

            return (
              <div key={s.id} className="flex items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 mx-1",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted || isActive) {
                      setStep(s.id);
                    }
                  }}
                  disabled={!isCompleted && !isActive}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "text-primary cursor-pointer hover:bg-muted",
                    !isActive && !isCompleted && "text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-1">
          <div className="py-4 min-h-[400px]">
            {/* Step 1: Basics */}
            {step === "basics" && (
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="table-name">Table Name *</Label>
                  <Input
                    id="table-name"
                    value={tableDefinition.name}
                    onChange={(e) => updateTableDefinition({ name: e.target.value })}
                    placeholder="my_table"
                    autoFocus
                  />
                  {validateBasics() && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {validateBasics()}
                    </p>
                  )}
                </div>

                {availableSchemas.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="schema">Schema</Label>
                    <Select
                      value={tableDefinition.schema ?? "__default__"}
                      onValueChange={(value) =>
                        updateTableDefinition({ schema: value === "__default__" ? undefined : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select schema (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Default</SelectItem>
                        {availableSchemas.map((schema) => (
                          <SelectItem key={schema} value={schema}>
                            {schema}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (optional)</Label>
                  <Input
                    id="comment"
                    value={tableDefinition.comment ?? ""}
                    onChange={(e) =>
                      updateTableDefinition({ comment: e.target.value || undefined })
                    }
                    placeholder="Description of the table"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Columns */}
            {step === "columns" && (
              <div className="space-y-4">
                <ColumnEditor
                  columns={tableDefinition.columns}
                  databaseType={databaseType}
                  onChange={setColumns}
                />
                {validateColumns() && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validateColumns()}
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Constraints */}
            {step === "constraints" && (
              <ConstraintEditor
                columns={tableDefinition.columns}
                foreignKeys={tableDefinition.foreignKeys}
                checkConstraints={tableDefinition.checkConstraints}
                referenceTables={referenceTables}
                onForeignKeysChange={setForeignKeys}
                onCheckConstraintsChange={setCheckConstraints}
              />
            )}

            {/* Step 4: Indexes */}
            {step === "indexes" && (
              <IndexEditor
                columns={tableDefinition.columns}
                indexes={tableDefinition.indexes}
                onChange={setIndexes}
              />
            )}

            {/* Step 5: Preview */}
            {step === "preview" && (
              <div className="space-y-4">
                <Label>Generated DDL</Label>
                {isGeneratingDDL ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="border rounded-md bg-muted/30">
                    <pre className="p-4 text-sm overflow-x-auto font-mono whitespace-pre-wrap">
                      {generatedDDL || "-- No DDL generated"}
                    </pre>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Review the SQL above. Click "Create Table" to execute.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {currentStepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={goToPreviousStep}
                disabled={isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            {step === "preview" ? (
              <Button onClick={handleCreateTable} disabled={isLoading || !canProceed()}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Create Table
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goToNextStep} disabled={!canProceed()}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
