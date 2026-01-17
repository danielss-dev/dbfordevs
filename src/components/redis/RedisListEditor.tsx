import { useState, useEffect } from "react";
import { Trash2, Loader2, Edit, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";

interface RedisListEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisListEditor({ connectionId, keyName }: RedisListEditorProps) {
  const { getList, listPush, listSet, listRemove } = useRedis();
  const { toast } = useToast();
  const [values, setValues] = useState<string[]>([]);
  const [totalLength, setTotalLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadList = async () => {
    setIsLoading(true);
    try {
      const result = await getList(connectionId, keyName, 0, 99);
      if (result) {
        setValues(result.values);
        setTotalLength(result.totalLength);
      }
    } catch (error) {
      toast({
        title: "Error loading list",
        description: error instanceof Error ? error.message : "Failed to load list",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [connectionId, keyName]);

  const handlePush = async (left: boolean) => {
    if (!newValue.trim()) return;

    setIsSaving(true);
    try {
      await listPush(connectionId, keyName, [newValue], left);
      setNewValue("");
      await loadList();
      toast({
        title: "Value added",
        description: `Value added to ${left ? "left" : "right"} of list.`,
      });
    } catch (error) {
      toast({
        title: "Error adding value",
        description: error instanceof Error ? error.message : "Failed to add value",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(values[index]);
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null) return;

    setIsSaving(true);
    try {
      await listSet(connectionId, keyName, editingIndex, editValue);
      setEditingIndex(null);
      await loadList();
      toast({
        title: "Value updated",
        description: `List value at index ${editingIndex} updated.`,
      });
    } catch (error) {
      toast({
        title: "Error updating value",
        description: error instanceof Error ? error.message : "Failed to update value",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const handleRemove = async (value: string) => {
    setIsSaving(true);
    try {
      await listRemove(connectionId, keyName, 1, value);
      await loadList();
      toast({
        title: "Value removed",
        description: "Value removed from list.",
      });
    } catch (error) {
      toast({
        title: "Error removing value",
        description: error instanceof Error ? error.message : "Failed to remove value",
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
      {/* Add new value */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Input
          placeholder="New value..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePush(false);
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePush(true)}
              disabled={!newValue.trim() || isSaving}
            >
              <ArrowUp className="h-4 w-4 mr-1" />
              LPUSH
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add to left (head)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={() => handlePush(false)}
              disabled={!newValue.trim() || isSaving}
            >
              <ArrowDown className="h-4 w-4 mr-1" />
              RPUSH
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add to right (tail)</TooltipContent>
        </Tooltip>
      </div>

      {/* List info */}
      <div className="px-3 py-2 text-xs text-muted-foreground border-b">
        Showing {values.length} of {totalLength} elements
      </div>

      {/* List values */}
      <div className="flex-1 overflow-auto">
        {values.map((value, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30"
          >
            <span className="text-xs text-muted-foreground w-8">{index}</span>

            {editingIndex === index ? (
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
                <span className="flex-1 font-mono text-sm truncate">{value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleEdit(index)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(value)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}

        {values.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">List is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
