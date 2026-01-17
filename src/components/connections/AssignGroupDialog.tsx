import { useState, useEffect } from "react";
import { FolderTree, Tag, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { TagBadge } from "@/components/ui/tag-badge";
import { useConnectionsStore, useUIStore } from "@/stores";
import { showSuccessToast } from "@/lib/toast-helpers";

export function AssignGroupDialog() {
  const {
    showAssignGroupDialog,
    assigningGroupConnectionId,
    setShowAssignGroupDialog,
  } = useUIStore();

  const {
    connections,
    groups,
    tags,
    assignConnectionToGroup,
    addTagToConnection,
    removeTagFromConnection,
    addTag,
  } = useConnectionsStore();

  const connection = connections.find((c) => c.id === assigningGroupConnectionId);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");

  // Reset state when dialog opens
  useEffect(() => {
    if (showAssignGroupDialog && connection) {
      setSelectedGroupId(connection.groupId ?? null);
      setSelectedTagIds(connection.tagIds ?? []);
      setIsAddingTag(false);
      setNewTagName("");
      setNewTagColor("#3B82F6");
    }
  }, [showAssignGroupDialog, connection]);

  const handleSave = () => {
    if (!assigningGroupConnectionId) return;

    // Update group
    assignConnectionToGroup(assigningGroupConnectionId, selectedGroupId);

    // Update tags - remove old ones, add new ones
    const currentTagIds = connection?.tagIds ?? [];

    // Remove tags that are no longer selected
    currentTagIds.forEach((tagId) => {
      if (!selectedTagIds.includes(tagId)) {
        removeTagFromConnection(assigningGroupConnectionId, tagId);
      }
    });

    // Add newly selected tags
    selectedTagIds.forEach((tagId) => {
      if (!currentTagIds.includes(tagId)) {
        addTagToConnection(assigningGroupConnectionId, tagId);
      }
    });

    showSuccessToast(
      "Connection Updated",
      `Group and tags updated for "${connection?.name}".`
    );

    setShowAssignGroupDialog(false);
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    const newId = addTag({
      name: newTagName.trim(),
      color: newTagColor,
    });

    setSelectedTagIds([...selectedTagIds, newId]);
    setIsAddingTag(false);
    setNewTagName("");
    setNewTagColor("#3B82F6");
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleClose = (open: boolean) => {
    setShowAssignGroupDialog(open);
  };

  if (!connection) return null;

  return (
    <Dialog open={showAssignGroupDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Organize Connection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Connection Name */}
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{connection.name}</span>
          </div>

          {/* Group Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5" />
              Group
            </Label>
            <Select
              value={selectedGroupId ?? "none"}
              onValueChange={(value) =>
                setSelectedGroupId(value === "none" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No group (Ungrouped)</span>
                </SelectItem>
                {groups
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Tags
            </Label>

            {/* Selected Tags */}
            {selectedTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {selectedTagIds.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <TagBadge
                      key={tag.id}
                      name={tag.name}
                      color={tag.color}
                      onRemove={() => toggleTag(tag.id)}
                    />
                  );
                })}
              </div>
            )}

            {/* Available Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags
                  .filter((tag) => !selectedTagIds.includes(tag.id))
                  .map((tag) => (
                    <TagBadge
                      key={tag.id}
                      name={tag.name}
                      color={tag.color}
                      onClick={() => toggleTag(tag.id)}
                      className="opacity-60 hover:opacity-100"
                    />
                  ))}
              </div>
            )}

            {/* Add New Tag */}
            {isAddingTag ? (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag();
                    if (e.key === "Escape") setIsAddingTag(false);
                  }}
                />
                <ColorPicker value={newTagColor} onChange={setNewTagColor} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddTag} disabled={!newTagName.trim()}>
                    Add Tag
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddingTag(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setIsAddingTag(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New Tag
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
