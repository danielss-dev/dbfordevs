import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Edit, Check, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import type { RedisHashField } from "@/types";

interface RedisHashEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisHashEditor({ connectionId, keyName }: RedisHashEditorProps) {
  const { getHashFull, hashSet, hashDelete } = useRedis();
  const { toast } = useToast();
  const [fields, setFields] = useState<RedisHashField[]>([]);
  const [totalFields, setTotalFields] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [newField, setNewField] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadHash = async () => {
    setIsLoading(true);
    try {
      const result = await getHashFull(connectionId, keyName);
      if (result) {
        setFields(result.fields);
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

  const handleAdd = async () => {
    if (!newField.trim() || !newValue.trim()) return;

    setIsSaving(true);
    try {
      await hashSet(connectionId, keyName, [{ field: newField, value: newValue }]);
      setNewField("");
      setNewValue("");
      await loadHash();
      toast({
        title: "Field added",
        description: `Field "${newField}" added to hash.`,
      });
    } catch (error) {
      toast({
        title: "Error adding field",
        description: error instanceof Error ? error.message : "Failed to add field",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (field: RedisHashField) => {
    setEditingField(field.field);
    setEditValue(field.value);
  };

  const handleSaveEdit = async () => {
    if (editingField === null) return;

    setIsSaving(true);
    try {
      await hashSet(connectionId, keyName, [{ field: editingField, value: editValue }]);
      setEditingField(null);
      await loadHash();
      toast({
        title: "Field updated",
        description: `Field "${editingField}" updated.`,
      });
    } catch (error) {
      toast({
        title: "Error updating field",
        description: error instanceof Error ? error.message : "Failed to update field",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleDelete = async (field: string) => {
    setIsSaving(true);
    try {
      await hashDelete(connectionId, keyName, [field]);
      await loadHash();
      toast({
        title: "Field deleted",
        description: `Field "${field}" deleted from hash.`,
      });
    } catch (error) {
      toast({
        title: "Error deleting field",
        description: error instanceof Error ? error.message : "Failed to delete field",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
          disabled={!newField.trim() || !newValue.trim() || isSaving}
        >
          <Plus className="h-4 w-4 mr-1" />
          HSET
        </Button>
      </div>

      {/* Hash info */}
      <div className="px-3 py-2 text-xs text-muted-foreground border-b">
        {totalFields} fields
      </div>

      {/* Hash fields */}
      <div className="flex-1 overflow-auto">
        {fields.map((field) => (
          <div
            key={field.field}
            className="group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30"
          >
            <span className="font-mono text-sm text-muted-foreground w-1/4 truncate">
              {field.field}
            </span>

            {editingField === field.field ? (
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
                  onClick={() => handleEdit(field)}
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

        {fields.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Hash is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
