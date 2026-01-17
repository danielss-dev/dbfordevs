import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Edit, Check, X, ArrowUpDown } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import type { RedisZSetMember } from "@/types";

interface RedisZSetEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisZSetEditor({ connectionId, keyName }: RedisZSetEditorProps) {
  const { getZSet, zsetAdd, zsetRemove, zsetUpdateScore } = useRedis();
  const { toast } = useToast();
  const [members, setMembers] = useState<RedisZSetMember[]>([]);
  const [cardinality, setCardinality] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [newMember, setNewMember] = useState("");
  const [newScore, setNewScore] = useState("0");
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editScore, setEditScore] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [reverse, setReverse] = useState(false);

  const loadZSet = async () => {
    setIsLoading(true);
    try {
      const result = await getZSet(connectionId, keyName, 0, 99, reverse);
      if (result) {
        setMembers(result.members);
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

  const handleAdd = async () => {
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

    setIsSaving(true);
    try {
      await zsetAdd(connectionId, keyName, [{ member: newMember, score }]);
      setNewMember("");
      setNewScore("0");
      await loadZSet();
      toast({
        title: "Member added",
        description: `Member "${newMember}" added with score ${score}.`,
      });
    } catch (error) {
      toast({
        title: "Error adding member",
        description: error instanceof Error ? error.message : "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditScore = (member: RedisZSetMember) => {
    setEditingMember(member.member);
    setEditScore(member.score.toString());
  };

  const handleSaveScore = async () => {
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

    setIsSaving(true);
    try {
      await zsetUpdateScore(connectionId, keyName, editingMember, score);
      setEditingMember(null);
      await loadZSet();
      toast({
        title: "Score updated",
        description: `Score for "${editingMember}" updated to ${score}.`,
      });
    } catch (error) {
      toast({
        title: "Error updating score",
        description: error instanceof Error ? error.message : "Failed to update score",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setEditScore("");
  };

  const handleRemove = async (member: string) => {
    setIsSaving(true);
    try {
      await zsetRemove(connectionId, keyName, [member]);
      await loadZSet();
      toast({
        title: "Member removed",
        description: `Member "${member}" removed from sorted set.`,
      });
    } catch (error) {
      toast({
        title: "Error removing member",
        description: error instanceof Error ? error.message : "Failed to remove member",
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
          disabled={!newMember.trim() || isSaving}
        >
          <Plus className="h-4 w-4 mr-1" />
          ZADD
        </Button>
      </div>

      {/* Sorted set info and controls */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b">
        <span>{cardinality} members</span>
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
        {members.map((member, index) => (
          <div
            key={member.member}
            className="group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30"
          >
            <span className="text-xs text-muted-foreground w-8">{index + 1}</span>

            <span className="flex-1 font-mono text-sm truncate">{member.member}</span>

            {editingMember === member.member ? (
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
                  className="font-mono text-sm text-primary cursor-pointer hover:underline w-20 text-right"
                  onClick={() => handleEditScore(member)}
                >
                  {member.score}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleEditScore(member)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(member.member)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Sorted set is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
