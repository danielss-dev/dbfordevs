import { useState, useEffect, useMemo, useRef } from "react";
import { Trash2, Loader2, Edit, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisChangesStore } from "@/stores/redis-changes";
import { cn } from "@/lib/utils";

interface RedisListEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisListEditor({ connectionId, keyName }: RedisListEditorProps) {
  const { getList } = useRedis();
  const { toast } = useToast();
  const { addChange, removeChange } = useRedisChangesStore();
  const [originalValues, setOriginalValues] = useState<string[]>([]);
  const [totalLength, setTotalLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const hadChangesRef = useRef(false);

  const loadList = async () => {
    setIsLoading(true);
    try {
      const result = await getList(connectionId, keyName, 0, 99);
      if (result) {
        setOriginalValues(result.values);
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
      loadList();
    }
  }, [pendingChanges.length]);

  // Compute virtual list by applying pending changes
  const virtualList = useMemo(() => {
    type ListItem = { value: string; index: number; status: "original" | "modified" | "removed" | "pushed" };
    const items: ListItem[] = originalValues.map((v, i) => ({
      value: v,
      index: i,
      status: "original" as const,
    }));

    // Apply LSET and LREM changes to existing items
    for (const change of pendingChanges) {
      const op = change.operation;
      if (op.op === "LSET") {
        const item = items.find((it) => it.index === op.index && it.status !== "removed");
        if (item) {
          item.value = op.value;
          item.status = "modified";
        }
      } else if (op.op === "LREM") {
        const item = items.find((it) => it.value === op.value && it.status !== "removed");
        if (item) {
          item.status = "removed";
        }
      }
    }

    // Collect LPUSH/RPUSH items
    const lpushItems: ListItem[] = [];
    const rpushItems: ListItem[] = [];
    for (const change of pendingChanges) {
      const op = change.operation;
      if (op.op === "LPUSH") {
        lpushItems.unshift({ value: op.value, index: -1, status: "pushed" });
      } else if (op.op === "RPUSH") {
        rpushItems.push({ value: op.value, index: -1, status: "pushed" });
      }
    }

    return [...lpushItems, ...items, ...rpushItems];
  }, [originalValues, pendingChanges]);

  const handlePush = (left: boolean) => {
    if (!newValue.trim()) return;

    addChange({
      connectionId,
      key: keyName,
      keyType: "list",
      operation: left
        ? { op: "LPUSH", value: newValue }
        : { op: "RPUSH", value: newValue },
    });
    setNewValue("");
  };

  const handleEdit = (index: number, currentValue: string) => {
    setEditingIndex(index);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (originalIndex: number) => {
    if (editingIndex === null) return;

    // If reverting to original, remove the pending LSET change
    if (originalIndex >= 0 && editValue === originalValues[originalIndex]) {
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "LSET" && c.operation.index === originalIndex
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }
    } else if (originalIndex >= 0) {
      // Remove any existing LSET for this index first
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "LSET" && c.operation.index === originalIndex
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }

      addChange({
        connectionId,
        key: keyName,
        keyType: "list",
        operation: {
          op: "LSET",
          index: originalIndex,
          value: editValue,
          originalValue: originalValues[originalIndex],
        },
      });
    }
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const handleRemove = (item: { value: string; index: number; status: string }) => {
    if (item.status === "pushed") {
      // Remove the LPUSH/RPUSH change
      const pushChange = pendingChanges.find(
        (c) =>
          (c.operation.op === "LPUSH" || c.operation.op === "RPUSH") &&
          c.operation.value === item.value
      );
      if (pushChange) {
        removeChange(pushChange.id);
      }
    } else {
      // Stage LREM for original items
      addChange({
        connectionId,
        key: keyName,
        keyType: "list",
        operation: { op: "LREM", value: item.value },
      });
    }
  };

  const handleUndoRemove = (value: string) => {
    const removeChangeItem = pendingChanges.find(
      (c) => c.operation.op === "LREM" && c.operation.value === value
    );
    if (removeChangeItem) {
      removeChange(removeChangeItem.id);
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
              disabled={!newValue.trim()}
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
              disabled={!newValue.trim()}
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
        Showing {originalValues.length} of {totalLength} elements
        {pendingChanges.length > 0 && (
          <span className="ml-2 text-amber-500">
            ({pendingChanges.length} staged)
          </span>
        )}
      </div>

      {/* List values */}
      <div className="flex-1 overflow-auto">
        {virtualList.map((item, displayIndex) => (
          <div
            key={`${item.index}-${displayIndex}`}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30",
              item.status === "pushed" && "bg-green-500/5",
              item.status === "modified" && "bg-amber-500/5",
              item.status === "removed" && "bg-red-500/5 opacity-60"
            )}
          >
            <span className={cn(
              "text-xs text-muted-foreground w-8",
              item.status === "pushed" && "text-green-600 dark:text-green-400"
            )}>
              {item.status === "pushed" ? "new" : item.index}
            </span>

            {item.status === "removed" ? (
              <>
                <span className="flex-1 font-mono text-sm truncate line-through text-muted-foreground">
                  {item.value}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleUndoRemove(item.value)}
                >
                  Undo
                </Button>
              </>
            ) : editingIndex === displayIndex ? (
              <>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(item.index);
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleSaveEdit(item.index)}>
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            ) : (
              <>
                <span className={cn(
                  "flex-1 font-mono text-sm truncate",
                  item.status === "pushed" && "text-green-600 dark:text-green-400",
                  item.status === "modified" && "text-amber-600 dark:text-amber-400"
                )}>
                  {item.value}
                </span>
                {item.status !== "pushed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => handleEdit(displayIndex, item.value)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}

        {virtualList.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">List is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
