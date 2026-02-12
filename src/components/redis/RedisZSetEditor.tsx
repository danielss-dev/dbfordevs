import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Loader2, Edit, Check, X, ArrowUpDown } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisChangesStore } from "@/stores/redis-changes";
import type { RedisZSetMember } from "@/types";
import { cn } from "@/lib/utils";

interface RedisZSetEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisZSetEditor({ connectionId, keyName }: RedisZSetEditorProps) {
  const { getZSet } = useRedis();
  const { toast } = useToast();
  const { addChange, removeChange } = useRedisChangesStore();
  const [originalMembers, setOriginalMembers] = useState<RedisZSetMember[]>([]);
  const [cardinality, setCardinality] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [newMember, setNewMember] = useState("");
  const [newScore, setNewScore] = useState("0");
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editScore, setEditScore] = useState("");
  const [reverse, setReverse] = useState(false);
  const hadChangesRef = useRef(false);

  const loadZSet = async () => {
    setIsLoading(true);
    try {
      const result = await getZSet(connectionId, keyName, 0, 99, reverse);
      if (result) {
        setOriginalMembers(result.members);
        setCardinality(result.cardinality);
      }
    } catch (error) {
      toast({
        title: "Error loading sorted set",
        description: error instanceof Error ? error.message : "Failed to load sorted set",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadZSet();
  }, [connectionId, keyName, reverse]);

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
      loadZSet();
    }
  }, [pendingChanges.length]);

  // Compute virtual members: original + ZADD changes - ZREM
  const virtualMembers = useMemo(() => {
    const membersMap = new Map<string, { member: string; score: number; status: "original" | "added" | "modified" | "removed" }>();

    for (const m of originalMembers) {
      membersMap.set(m.member, { member: m.member, score: m.score, status: "original" });
    }

    for (const change of pendingChanges) {
      const op = change.operation;
      if (op.op === "ZADD") {
        const existing = membersMap.get(op.member);
        if (existing && existing.status !== "removed") {
          membersMap.set(op.member, { member: op.member, score: op.score, status: op.isNew ? "added" : "modified" });
        } else {
          membersMap.set(op.member, { member: op.member, score: op.score, status: "added" });
        }
      } else if (op.op === "ZREM") {
        const existing = membersMap.get(op.member);
        if (existing) {
          membersMap.set(op.member, { ...existing, status: "removed" });
        }
      }
    }

    return Array.from(membersMap.values());
  }, [originalMembers, pendingChanges]);

  const handleAdd = () => {
    if (!newMember.trim()) return;

    const score = parseFloat(newScore);
    if (isNaN(score)) {
      toast({
        title: "Invalid score",
        description: "Score must be a valid number.",
        variant: "destructive",
      });
      return;
    }

    addChange({
      connectionId,
      key: keyName,
      keyType: "zset",
      operation: { op: "ZADD", member: newMember, score, isNew: true },
    });
    setNewMember("");
    setNewScore("0");
  };

  const handleEditScore = (member: string, currentScore: number) => {
    setEditingMember(member);
    setEditScore(currentScore.toString());
  };

  const handleSaveScore = () => {
    if (editingMember === null) return;

    const score = parseFloat(editScore);
    if (isNaN(score)) {
      toast({
        title: "Invalid score",
        description: "Score must be a valid number.",
        variant: "destructive",
      });
      return;
    }

    const originalMember = originalMembers.find((m) => m.member === editingMember);
    const isNew = !originalMember;

    // If reverting to original score, remove the pending change
    if (originalMember && score === originalMember.score) {
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "ZADD" && c.operation.member === editingMember
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }
    } else {
      // Remove any existing ZADD for this member first
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "ZADD" && c.operation.member === editingMember
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }

      addChange({
        connectionId,
        key: keyName,
        keyType: "zset",
        operation: { op: "ZADD", member: editingMember, score, isNew },
      });
    }
    setEditingMember(null);
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setEditScore("");
  };

  const handleRemove = (member: string) => {
    const isOriginal = originalMembers.some((m) => m.member === member);

    if (isOriginal) {
      // Remove any existing ZADD for this member
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "ZADD" && c.operation.member === member
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }

      addChange({
        connectionId,
        key: keyName,
        keyType: "zset",
        operation: { op: "ZREM", member },
      });
    } else {
      // Remove the ZADD change for newly added members
      const existingChange = pendingChanges.find(
        (c) => c.operation.op === "ZADD" && c.operation.member === member
      );
      if (existingChange) {
        removeChange(existingChange.id);
      }
    }
  };

  const handleUndoRemove = (member: string) => {
    const removeChangeItem = pendingChanges.find(
      (c) => c.operation.op === "ZREM" && c.operation.member === member
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
          placeholder="Member..."
          value={newMember}
          onChange={(e) => setNewMember(e.target.value)}
          className="flex-1"
        />
        <Input
          type="number"
          placeholder="Score..."
          value={newScore}
          onChange={(e) => setNewScore(e.target.value)}
          className="w-24"
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
          ZADD
        </Button>
      </div>

      {/* Sorted set info and controls */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b">
        <span>
          {cardinality} members
          {pendingChanges.length > 0 && (
            <span className="ml-2 text-amber-500">
              ({pendingChanges.length} staged)
            </span>
          )}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setReverse(!reverse)}
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              {reverse ? "High to Low" : "Low to High"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle sort order</TooltipContent>
        </Tooltip>
      </div>

      {/* Sorted set members */}
      <div className="flex-1 overflow-auto">
        {virtualMembers.map((item, index) => (
          <div
            key={item.member}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30",
              item.status === "added" && "bg-green-500/5",
              item.status === "modified" && "bg-amber-500/5",
              item.status === "removed" && "bg-red-500/5 opacity-60"
            )}
          >
            <span className="text-xs text-muted-foreground w-8">{index + 1}</span>

            <span className={cn(
              "flex-1 font-mono text-sm truncate",
              item.status === "added" && "text-green-600 dark:text-green-400",
              item.status === "modified" && "text-amber-600 dark:text-amber-400",
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
            ) : editingMember === item.member ? (
              <>
                <Input
                  type="number"
                  value={editScore}
                  onChange={(e) => setEditScore(e.target.value)}
                  className="w-24 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveScore();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleSaveScore}>
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "font-mono text-sm cursor-pointer hover:underline w-20 text-right",
                    item.status === "modified" ? "text-amber-600 dark:text-amber-400" : "text-primary"
                  )}
                  onClick={() => handleEditScore(item.member, item.score)}
                >
                  {item.score}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleEditScore(item.member, item.score)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(item.member)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}

        {virtualMembers.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Sorted set is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
