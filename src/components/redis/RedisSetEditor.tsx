import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisChangesStore } from "@/stores/redis-changes";
import { cn } from "@/lib/utils";

interface RedisSetEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisSetEditor({ connectionId, keyName }: RedisSetEditorProps) {
  const { getSetFull } = useRedis();
  const { toast } = useToast();
  const { addChange, removeChange } = useRedisChangesStore();
  const [originalMembers, setOriginalMembers] = useState<string[]>([]);
  const [cardinality, setCardinality] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [newMember, setNewMember] = useState("");
  const hadChangesRef = useRef(false);

  const loadSet = async () => {
    setIsLoading(true);
    try {
      const result = await getSetFull(connectionId, keyName);
      if (result) {
        setOriginalMembers(result.members);
        setCardinality(result.cardinality);
      }
    } catch (error) {
      toast({
        title: "Error loading set",
        description: error instanceof Error ? error.message : "Failed to load set",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSet();
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
      loadSet();
    }
  }, [pendingChanges.length]);

  // Compute virtual members: original + SADD - SREM
  const virtualMembers = useMemo(() => {
    const membersMap = new Map<string, "original" | "added" | "removed">();

    for (const m of originalMembers) {
      membersMap.set(m, "original");
    }

    for (const change of pendingChanges) {
      const op = change.operation;
      if (op.op === "SADD") {
        membersMap.set(op.member, "added");
      } else if (op.op === "SREM") {
        if (membersMap.has(op.member)) {
          membersMap.set(op.member, "removed");
        }
      }
    }

    return Array.from(membersMap.entries()).map(([member, status]) => ({
      member,
      status,
    }));
  }, [originalMembers, pendingChanges]);

  const handleAdd = () => {
    if (!newMember.trim()) return;

    addChange({
      connectionId,
      key: keyName,
      keyType: "set",
      operation: { op: "SADD", member: newMember },
    });
    setNewMember("");
  };

  const handleRemove = (member: string) => {
    const isOriginal = originalMembers.includes(member);

    if (isOriginal) {
      // Stage SREM for original members
      addChange({
        connectionId,
        key: keyName,
        keyType: "set",
        operation: { op: "SREM", member },
      });
    } else {
      // Remove the SADD change for newly added members
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "SADD" && c.operation.member === member
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }
    }
  };

  const handleUndoRemove = (member: string) => {
    const removeChangeItem = pendingChanges.find(
      (c) => c.operation.op === "SREM" && c.operation.member === member
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
      {/* Add new member */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Input
          placeholder="New member..."
          value={newMember}
          onChange={(e) => setNewMember(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newMember.trim()}
        >
          <Plus className="h-4 w-4 mr-1" />
          SADD
        </Button>
      </div>

      {/* Set info */}
      <div className="px-3 py-2 text-xs text-muted-foreground border-b">
        {cardinality} members
        {pendingChanges.length > 0 && (
          <span className="ml-2 text-warning">
            ({pendingChanges.length} staged)
          </span>
        )}
      </div>

      {/* Set members */}
      <div className="flex-1 overflow-auto">
        {virtualMembers.map((item) => (
          <div
            key={item.member}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30",
              item.status === "added" && "bg-success/5",
              item.status === "removed" && "bg-destructive/5 opacity-60"
            )}
          >
            <span className={cn(
              "flex-1 font-mono text-sm truncate",
              item.status === "added" && "text-success",
              item.status === "removed" && "line-through text-muted-foreground"
            )}>
              {item.member}
            </span>
            {item.status === "removed" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handleUndoRemove(item.member)}
              >
                Undo
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                onClick={() => handleRemove(item.member)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {virtualMembers.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Set is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
