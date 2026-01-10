import { useCallback } from "react";
import { Plus, Trash2, ListOrdered } from "lucide-react";
import { Button, Input, Label, Checkbox } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NewColumnDefinition, NewIndexDefinition } from "@/types";

interface IndexEditorProps {
  columns: NewColumnDefinition[];
  indexes: NewIndexDefinition[];
  onChange: (indexes: NewIndexDefinition[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function IndexEditor({ columns, indexes, onChange }: IndexEditorProps) {
  const addIndex = useCallback(() => {
    onChange([
      ...indexes,
      {
        id: generateId(),
        columns: [],
        isUnique: false,
      },
    ]);
  }, [indexes, onChange]);

  const updateIndex = useCallback(
    (id: string, updates: Partial<NewIndexDefinition>) => {
      onChange(indexes.map((idx) => (idx.id === id ? { ...idx, ...updates } : idx)));
    },
    [indexes, onChange]
  );

  const removeIndex = useCallback(
    (id: string) => {
      onChange(indexes.filter((idx) => idx.id !== id));
    },
    [indexes, onChange]
  );

  const addColumnToIndex = useCallback(
    (indexId: string, columnName: string) => {
      const index = indexes.find((idx) => idx.id === indexId);
      if (index && !index.columns.includes(columnName)) {
        updateIndex(indexId, { columns: [...index.columns, columnName] });
      }
    },
    [indexes, updateIndex]
  );

  const removeColumnFromIndex = useCallback(
    (indexId: string, columnName: string) => {
      const index = indexes.find((idx) => idx.id === indexId);
      if (index) {
        updateIndex(indexId, {
          columns: index.columns.filter((c) => c !== columnName),
        });
      }
    },
    [indexes, updateIndex]
  );

  const columnOptions = columns.filter((c) => c.name.trim() !== "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ListOrdered className="h-4 w-4" />
          Indexes
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addIndex}
          className="gap-1"
          disabled={columnOptions.length === 0}
        >
          <Plus className="h-4 w-4" />
          Add Index
        </Button>
      </div>

      {columnOptions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Define columns first to add indexes.
        </p>
      )}

      {indexes.length === 0 && columnOptions.length > 0 && (
        <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
          No additional indexes defined. Primary key index is created automatically.
          Click "Add Index" to create additional indexes.
        </p>
      )}

      <div className="space-y-3">
        {indexes.map((index) => {
          const availableColumns = columnOptions.filter(
            (c) => !index.columns.includes(c.name)
          );

          return (
            <div
              key={index.id}
              className="border rounded-md p-3 space-y-3 bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Input
                    value={index.name ?? ""}
                    onChange={(e) =>
                      updateIndex(index.id, { name: e.target.value || undefined })
                    }
                    placeholder="Index name (auto-generated if empty)"
                    className="h-8 text-sm w-64"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`unique-${index.id}`}
                      checked={index.isUnique}
                      onCheckedChange={(checked) =>
                        updateIndex(index.id, { isUnique: checked === true })
                      }
                    />
                    <Label
                      htmlFor={`unique-${index.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Unique
                    </Label>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeIndex(index.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Columns</Label>

                {/* Selected columns */}
                <div className="flex flex-wrap gap-2">
                  {index.columns.map((colName, colIndex) => (
                    <div
                      key={colName}
                      className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                    >
                      <span className="text-xs text-muted-foreground mr-1">
                        {colIndex + 1}.
                      </span>
                      <span>{colName}</span>
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removeColumnFromIndex(index.id, colName)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {index.columns.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No columns selected
                    </span>
                  )}
                </div>

                {/* Add column dropdown */}
                {availableColumns.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(value) => addColumnToIndex(index.id, value)}
                  >
                    <SelectTrigger className="h-8 text-sm w-48">
                      <SelectValue placeholder="Add column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map((col) => (
                        <SelectItem key={col.id} value={col.name}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {indexes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Note: Column order in indexes matters. The first column should be the one most
          frequently used in WHERE clauses.
        </p>
      )}
    </div>
  );
}
