import { useCallback } from "react";
import { Plus, Trash2, Link, AlertCircle } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  NewColumnDefinition,
  NewForeignKeyDefinition,
  NewCheckConstraintDefinition,
  ForeignKeyAction,
  TableReferenceInfo,
} from "@/types";

interface ConstraintEditorProps {
  columns: NewColumnDefinition[];
  foreignKeys: NewForeignKeyDefinition[];
  checkConstraints: NewCheckConstraintDefinition[];
  referenceTables: TableReferenceInfo[];
  onForeignKeysChange: (fks: NewForeignKeyDefinition[]) => void;
  onCheckConstraintsChange: (checks: NewCheckConstraintDefinition[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const FK_ACTIONS: { value: ForeignKeyAction; label: string }[] = [
  { value: "NO_ACTION", label: "No Action" },
  { value: "CASCADE", label: "Cascade" },
  { value: "SET_NULL", label: "Set Null" },
  { value: "SET_DEFAULT", label: "Set Default" },
  { value: "RESTRICT", label: "Restrict" },
];

export function ConstraintEditor({
  columns,
  foreignKeys,
  checkConstraints,
  referenceTables,
  onForeignKeysChange,
  onCheckConstraintsChange,
}: ConstraintEditorProps) {
  // Foreign Key handlers
  const addForeignKey = useCallback(() => {
    onForeignKeysChange([
      ...foreignKeys,
      {
        id: generateId(),
        columns: [],
        referencesTable: "",
        referencesColumns: [],
        onDelete: "NO_ACTION",
        onUpdate: "NO_ACTION",
      },
    ]);
  }, [foreignKeys, onForeignKeysChange]);

  const updateForeignKey = useCallback(
    (id: string, updates: Partial<NewForeignKeyDefinition>) => {
      onForeignKeysChange(
        foreignKeys.map((fk) => (fk.id === id ? { ...fk, ...updates } : fk))
      );
    },
    [foreignKeys, onForeignKeysChange]
  );

  const removeForeignKey = useCallback(
    (id: string) => {
      onForeignKeysChange(foreignKeys.filter((fk) => fk.id !== id));
    },
    [foreignKeys, onForeignKeysChange]
  );

  // Check constraint handlers
  const addCheckConstraint = useCallback(() => {
    onCheckConstraintsChange([
      ...checkConstraints,
      {
        id: generateId(),
        expression: "",
      },
    ]);
  }, [checkConstraints, onCheckConstraintsChange]);

  const updateCheckConstraint = useCallback(
    (id: string, updates: Partial<NewCheckConstraintDefinition>) => {
      onCheckConstraintsChange(
        checkConstraints.map((check) =>
          check.id === id ? { ...check, ...updates } : check
        )
      );
    },
    [checkConstraints, onCheckConstraintsChange]
  );

  const removeCheckConstraint = useCallback(
    (id: string) => {
      onCheckConstraintsChange(checkConstraints.filter((check) => check.id !== id));
    },
    [checkConstraints, onCheckConstraintsChange]
  );

  // Get primary key columns for a reference table
  const getPrimaryKeyColumnsForTable = useCallback(
    (tableName: string): string[] => {
      const table = referenceTables.find(
        (t) => t.tableName === tableName || `${t.schema}.${t.tableName}` === tableName
      );
      return table?.primaryKeyColumns.map((col) => col.name) ?? [];
    },
    [referenceTables]
  );

  const columnOptions = columns.filter((c) => c.name.trim() !== "");

  return (
    <div className="space-y-6">
      {/* Foreign Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Link className="h-4 w-4" />
            Foreign Keys
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addForeignKey}
            className="gap-1"
            disabled={columnOptions.length === 0}
          >
            <Plus className="h-4 w-4" />
            Add Foreign Key
          </Button>
        </div>

        {columnOptions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Define columns first to add foreign keys.
          </p>
        )}

        {foreignKeys.length === 0 && columnOptions.length > 0 && (
          <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
            No foreign keys defined. Click "Add Foreign Key" to create one.
          </p>
        )}

        <div className="space-y-3">
          {foreignKeys.map((fk) => {
            const refPkColumns = getPrimaryKeyColumnsForTable(fk.referencesTable);

            return (
              <div
                key={fk.id}
                className="border rounded-md p-3 space-y-3 bg-muted/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Input
                      value={fk.name ?? ""}
                      onChange={(e) =>
                        updateForeignKey(fk.id, { name: e.target.value || undefined })
                      }
                      placeholder="Constraint name (optional)"
                      className="h-8 text-sm w-48"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeForeignKey(fk.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Source Column */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Source Column(s)</Label>
                    <Select
                      value={fk.columns[0] ?? ""}
                      onValueChange={(value) =>
                        updateForeignKey(fk.id, { columns: [value] })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columnOptions.map((col) => (
                          <SelectItem key={col.id} value={col.name}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* References Table */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">References Table</Label>
                    <Select
                      value={fk.referencesTable}
                      onValueChange={(value) => {
                        const pkCols = getPrimaryKeyColumnsForTable(value);
                        updateForeignKey(fk.id, {
                          referencesTable: value,
                          referencesColumns: pkCols.length > 0 ? [pkCols[0]] : [],
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        {referenceTables.length === 0 ? (
                          <div className="py-2 px-2 text-sm text-muted-foreground">
                            No tables available
                          </div>
                        ) : (
                          referenceTables.map((table) => {
                            const fullName = table.schema
                              ? `${table.schema}.${table.tableName}`
                              : table.tableName;
                            return (
                              <SelectItem key={fullName} value={fullName}>
                                {fullName}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* References Column */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">References Column</Label>
                    <Select
                      value={fk.referencesColumns[0] ?? ""}
                      onValueChange={(value) =>
                        updateForeignKey(fk.id, { referencesColumns: [value] })
                      }
                      disabled={!fk.referencesTable}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {refPkColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* On Delete / On Update */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">On Delete</Label>
                      <Select
                        value={fk.onDelete ?? "NO_ACTION"}
                        onValueChange={(value) =>
                          updateForeignKey(fk.id, { onDelete: value as ForeignKeyAction })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FK_ACTIONS.map((action) => (
                            <SelectItem key={action.value} value={action.value}>
                              {action.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">On Update</Label>
                      <Select
                        value={fk.onUpdate ?? "NO_ACTION"}
                        onValueChange={(value) =>
                          updateForeignKey(fk.id, { onUpdate: value as ForeignKeyAction })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FK_ACTIONS.map((action) => (
                            <SelectItem key={action.value} value={action.value}>
                              {action.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Check Constraints Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Check Constraints
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCheckConstraint}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Check
          </Button>
        </div>

        {checkConstraints.length === 0 && (
          <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
            No check constraints defined. Click "Add Check" to create one.
          </p>
        )}

        <div className="space-y-3">
          {checkConstraints.map((check) => (
            <div
              key={check.id}
              className="flex items-start gap-2 border rounded-md p-3 bg-muted/20"
            >
              <div className="flex-1 space-y-2">
                <Input
                  value={check.name ?? ""}
                  onChange={(e) =>
                    updateCheckConstraint(check.id, { name: e.target.value || undefined })
                  }
                  placeholder="Constraint name (optional)"
                  className="h-8 text-sm"
                />
                <Input
                  value={check.expression}
                  onChange={(e) =>
                    updateCheckConstraint(check.id, { expression: e.target.value })
                  }
                  placeholder="e.g., age >= 0 AND age <= 150"
                  className="h-8 text-sm font-mono"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeCheckConstraint(check.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
