import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Loader2, Edit, Check, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisChangesStore } from "@/stores/redis-changes";
import type { RedisHashField } from "@/types";
import { cn } from "@/lib/utils";

interface RedisHashEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisHashEditor({ connectionId, keyName }: RedisHashEditorProps) {
  const { getHashFull } = useRedis();
  const { toast } = useToast();
  const { addChange, removeChange } = useRedisChangesStore();
  const [originalFields, setOriginalFields] = useState<RedisHashField[]>([]);
  const [totalFields, setTotalFields] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [newField, setNewField] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const hadChangesRef = useRef(false);

  const loadHash = async () => {
    setIsLoading(true);
    try {
      const result = await getHashFull(connectionId, keyName);
      if (result) {
        setOriginalFields(result.fields);
        setTotalFields(result.totalFields);
      }
    } catch (error) {
      toast({
        title: "Error loading hash",
        description: error instanceof Error ? error.message : "Failed to load hash",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHash();
  }, [connectionId, keyName]);

  // Subscribe reactively to pending changes, derive filtered list with useMemo
  const allPendingChanges = useRedisChangesStore((state) => state.pendingChanges);
  const pendingChanges = useMemo(
    () => allPendingChanges.filter((c) => c.connectionId === connectionId && c.key === keyName),
    [allPendingChanges, connectionId, keyName]
  );

  // Reload data after commit/clear
  useEffect(() => {
    if (pendingChanges.length > 0) {
      hadChangesRef.current = true;
    } else if (hadChangesRef.current) {
      hadChangesRef.current = false;
      loadHash();
    }
  }, [pendingChanges.length]);

  // Compute virtual fields by applying pending changes on top of original
  const virtualFields = useMemo(() => {
    const fieldsMap = new Map<string, { field: string; value: string; status: "original" | "added" | "modified" | "deleted" }>();

    // Start with original fields
    for (const f of originalFields) {
      fieldsMap.set(f.field, { field: f.field, value: f.value, status: "original" });
    }

    // Apply pending changes
    for (const change of pendingChanges) {
      const op = change.operation;
      if (op.op === "HSET") {
        const existing = fieldsMap.get(op.field);
        if (existing && existing.status !== "deleted") {
          fieldsMap.set(op.field, { field: op.field, value: op.value, status: op.isNew ? "added" : "modified" });
        } else {
          fieldsMap.set(op.field, { field: op.field, value: op.value, status: "added" });
        }
      } else if (op.op === "HDEL") {
        const existing = fieldsMap.get(op.field);
        if (existing) {
          fieldsMap.set(op.field, { ...existing, status: "deleted" });
        }
      }
    }

    return Array.from(fieldsMap.values());
  }, [originalFields, pendingChanges]);

  const handleAdd = () => {
    if (!newField.trim() || !newValue.trim()) return;

    addChange({
      connectionId,
      key: keyName,
      keyType: "hash",
      operation: { op: "HSET", field: newField, value: newValue, isNew: true },
    });
    setNewField("");
    setNewValue("");
  };

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (editingField === null) return;

    // Find if this field exists in original data
    const originalField = originalFields.find((f) => f.field === editingField);
    const isNew = !originalField;

    // If editing back to original value, remove the pending change instead
    if (originalField && editValue === originalField.value) {
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "HSET" && c.operation.field === editingField
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }
    } else {
      // Remove any existing HSET for this field first
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "HSET" && c.operation.field === editingField
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }

      addChange({
        connectionId,
        key: keyName,
        keyType: "hash",
        operation: { op: "HSET", field: editingField, value: editValue, isNew },
      });
    }
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleDelete = (field: string) => {
    const originalField = originalFields.find((f) => f.field === field);

    if (originalField) {
      // Field exists in original data - stage a HDEL
      // Remove any existing HSET for this field
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "HSET" && c.operation.field === field
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }

      addChange({
        connectionId,
        key: keyName,
        keyType: "hash",
        operation: { op: "HDEL", field, originalValue: originalField.value },
      });
    } else {
      // Field was newly added - just remove the SADD change
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "HSET" && c.operation.field === field
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }
    }
  };

  const handleUndoDelete = (field: string) => {
    const deleteChange = pendingChanges.find(
      (c) => c.operation.op === "HDEL" && c.operation.field === field
    );
    if (deleteChange) {
      removeChange(deleteChange.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Add new field */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Input
          placeholder="Field name..."
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          className="w-1/3"
        />
        <Input
          placeholder="Field value..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newField.trim() || !newValue.trim()}
        >
          <Plus className="h-4 w-4 mr-1" />
          HSET
        </Button>
      </div>

      {/* Hash info */}
      <div className="px-3 py-2 text-xs text-muted-foreground border-b">
        {totalFields} fields
        {pendingChanges.length > 0 && (
          <span className="ml-2 text-amber-500">
            ({pendingChanges.length} staged)
          </span>
        )}
      </div>

      {/* Hash fields */}
      <div className="flex-1 overflow-auto">
        {virtualFields.map((field) => (
          <div
            key={field.field}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30",
              field.status === "added" && "bg-green-500/5",
              field.status === "modified" && "bg-amber-500/5",
              field.status === "deleted" && "bg-red-500/5 opacity-60"
            )}
          >
            <span className={cn(
              "font-mono text-sm text-muted-foreground w-1/4 truncate",
              field.status === "added" && "text-green-600 dark:text-green-400",
              field.status === "modified" && "text-amber-600 dark:text-amber-400",
              field.status === "deleted" && "line-through"
            )}>
              {field.field}
            </span>

            {field.status === "deleted" ? (
              <>
                <span className="flex-1 font-mono text-sm truncate line-through text-muted-foreground">
                  {field.value}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleUndoDelete(field.field)}
                >
                  Undo
                </Button>
              </>
            ) : editingField === field.field ? (
              <>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleSaveEdit}>
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 font-mono text-sm truncate">{field.value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleEdit(field.field, field.value)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(field.field)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}

        {virtualFields.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Hash is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
