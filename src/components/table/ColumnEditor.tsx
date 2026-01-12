import { useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Key } from "lucide-react";
import { Button, Input, Checkbox, Label } from "@/components/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTypeCombobox } from "./DataTypeCombobox";
import type { NewColumnDefinition, DatabaseType } from "@/types";
import { findDataType } from "@/lib/data-types";

interface ColumnEditorProps {
  columns: NewColumnDefinition[];
  databaseType: DatabaseType;
  onChange: (columns: NewColumnDefinition[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyColumn(): NewColumnDefinition {
  return {
    id: generateId(),
    name: "",
    dataType: "VARCHAR",
    length: 255,
    nullable: true,
    isPrimaryKey: false,
    isAutoIncrement: false,
    isUnique: false,
  };
}

export function ColumnEditor({ columns, databaseType, onChange }: ColumnEditorProps) {

  const updateColumn = useCallback(
    (id: string, updates: Partial<NewColumnDefinition>) => {
      onChange(
        columns.map((col) =>
          col.id === id ? { ...col, ...updates } : col
        )
      );
    },
    [columns, onChange]
  );

  const addColumn = useCallback(() => {
    onChange([...columns, createEmptyColumn()]);
  }, [columns, onChange]);

  const removeColumn = useCallback(
    (id: string) => {
      onChange(columns.filter((col) => col.id !== id));
    },
    [columns, onChange]
  );

  const moveColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= columns.length) return;
      const newColumns = [...columns];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      onChange(newColumns);
    },
    [columns, onChange]
  );

  const handleTypeChange = useCallback(
    (id: string, newType: string) => {
      const typeInfo = findDataType(databaseType, newType);
      const updates: Partial<NewColumnDefinition> = {
        dataType: newType,
      };

      // Set default length/precision based on type
      if (typeInfo?.requiresLength) {
        updates.length = typeInfo.defaultLength ?? 255;
        updates.precision = undefined;
        updates.scale = undefined;
      } else if (typeInfo?.requiresPrecision) {
        updates.precision = typeInfo.defaultPrecision ?? 10;
        updates.scale = typeInfo.defaultScale ?? 2;
        updates.length = undefined;
      } else {
        updates.length = undefined;
        updates.precision = undefined;
        updates.scale = undefined;
      }

      // Handle auto-increment types (e.g., SERIAL in PostgreSQL)
      if (typeInfo?.supportsAutoIncrement && newType.includes("SERIAL")) {
        updates.isAutoIncrement = true;
      }

      updateColumn(id, updates);
    },
    [databaseType, updateColumn]
  );

  const handlePrimaryKeyChange = useCallback(
    (id: string, isPrimaryKey: boolean) => {
      const updates: Partial<NewColumnDefinition> = { isPrimaryKey };
      if (isPrimaryKey) {
        updates.nullable = false; // Primary keys cannot be nullable
      }
      updateColumn(id, updates);
    },
    [updateColumn]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Columns</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addColumn}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Column
        </Button>
      </div>

      <div className="border rounded-md">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_180px_70px_70px_70px_70px_auto] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
          <div className="w-6" />
          <div>Name</div>
          <div>Type</div>
          <div className="text-center">PK</div>
          <div className="text-center">AI</div>
          <div className="text-center">Null</div>
          <div className="text-center">Unique</div>
          <div className="w-8" />
        </div>

        {/* Rows */}
        <div className="divide-y">
          {columns.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No columns defined. Click "Add Column" to start.
            </div>
          ) : (
            columns.map((column, index) => {
              const typeInfo = findDataType(databaseType, column.dataType);
              const showLengthInput = typeInfo?.requiresLength;
              const showPrecisionInput = typeInfo?.requiresPrecision;
              const canAutoIncrement = typeInfo?.supportsAutoIncrement ?? false;

              return (
                <div
                  key={column.id}
                  className="grid grid-cols-[auto_1fr_180px_70px_70px_70px_70px_auto] gap-2 px-3 py-2 items-center hover:bg-muted/30"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                            onClick={() => moveColumn(index, index - 1)}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Move up</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                            onClick={() => moveColumn(index, index + 1)}
                            disabled={index === columns.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Move down</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Name */}
                  <div className="flex items-center gap-1">
                    {column.isPrimaryKey && (
                      <Key className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    )}
                    <Input
                      value={column.name}
                      onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                      placeholder="column_name"
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Type */}
                  <div className="flex items-center gap-1">
                    <DataTypeCombobox
                      value={column.dataType}
                      onChange={(value) => handleTypeChange(column.id, value)}
                      databaseType={databaseType}
                    />
                    {showLengthInput && (
                      <Input
                        type="number"
                        value={column.length ?? ""}
                        onChange={(e) =>
                          updateColumn(column.id, {
                            length: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        placeholder="Len"
                        className="h-8 w-16 text-sm"
                        min={1}
                      />
                    )}
                    {showPrecisionInput && (
                      <>
                        <Input
                          type="number"
                          value={column.precision ?? ""}
                          onChange={(e) =>
                            updateColumn(column.id, {
                              precision: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            })
                          }
                          placeholder="P"
                          className="h-8 w-12 text-sm"
                          min={1}
                        />
                        <Input
                          type="number"
                          value={column.scale ?? ""}
                          onChange={(e) =>
                            updateColumn(column.id, {
                              scale: e.target.value ? parseInt(e.target.value, 10) : undefined,
                            })
                          }
                          placeholder="S"
                          className="h-8 w-12 text-sm"
                          min={0}
                        />
                      </>
                    )}
                  </div>

                  {/* Primary Key */}
                  <div className="flex justify-center">
                    <Checkbox
                      checked={column.isPrimaryKey}
                      onCheckedChange={(checked) =>
                        handlePrimaryKeyChange(column.id, checked === true)
                      }
                    />
                  </div>

                  {/* Auto Increment */}
                  <div className="flex justify-center">
                    <Checkbox
                      checked={column.isAutoIncrement}
                      onCheckedChange={(checked) =>
                        updateColumn(column.id, { isAutoIncrement: checked === true })
                      }
                      disabled={!canAutoIncrement && !column.isAutoIncrement}
                    />
                  </div>

                  {/* Nullable */}
                  <div className="flex justify-center">
                    <Checkbox
                      checked={column.nullable}
                      onCheckedChange={(checked) =>
                        updateColumn(column.id, { nullable: checked === true })
                      }
                      disabled={column.isPrimaryKey}
                    />
                  </div>

                  {/* Unique */}
                  <div className="flex justify-center">
                    <Checkbox
                      checked={column.isUnique}
                      onCheckedChange={(checked) =>
                        updateColumn(column.id, { isUnique: checked === true })
                      }
                    />
                  </div>

                  {/* Delete */}
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeColumn(column.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column summary */}
      {columns.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {columns.length} column{columns.length !== 1 ? "s" : ""} defined
          {columns.filter((c) => c.isPrimaryKey).length > 0 && (
            <span className="ml-2">
              | Primary key: {columns.filter((c) => c.isPrimaryKey).map((c) => c.name || "(unnamed)").join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { createEmptyColumn, generateId };
