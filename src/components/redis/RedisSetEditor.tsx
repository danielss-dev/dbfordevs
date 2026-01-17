import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";

interface RedisSetEditorProps {
  connectionId: string;
  keyName: string;
}

export function RedisSetEditor({ connectionId, keyName }: RedisSetEditorProps) {
  const { getSetFull, setAdd, setRemove } = useRedis();
  const { toast } = useToast();
  const [members, setMembers] = useState<string[]>([]);
  const [cardinality, setCardinality] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [newMember, setNewMember] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadSet = async () => {
    setIsLoading(true);
    try {
      const result = await getSetFull(connectionId, keyName);
      if (result) {
        setMembers(result.members);
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

  const handleAdd = async () => {
    if (!newMember.trim()) return;

    setIsSaving(true);
    try {
      await setAdd(connectionId, keyName, [newMember]);
      setNewMember("");
      await loadSet();
      toast({
        title: "Member added",
        description: `Member added to set.`,
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

  const handleRemove = async (member: string) => {
    setIsSaving(true);
    try {
      await setRemove(connectionId, keyName, [member]);
      await loadSet();
      toast({
        title: "Member removed",
        description: "Member removed from set.",
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
          disabled={!newMember.trim() || isSaving}
        >
          <Plus className="h-4 w-4 mr-1" />
          SADD
        </Button>
      </div>

      {/* Set info */}
      <div className="px-3 py-2 text-xs text-muted-foreground border-b">
        {cardinality} members
      </div>

      {/* Set members */}
      <div className="flex-1 overflow-auto">
        {members.map((member, index) => (
          <div
            key={index}
            className="group flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30"
          >
            <span className="flex-1 font-mono text-sm truncate">{member}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
              onClick={() => handleRemove(member)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {members.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Set is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
