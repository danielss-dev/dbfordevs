import { useState } from "react";
import {
  FolderTree,
  Plus,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, Input, Label } from "@/components/ui";
import { ColorPicker } from "@/components/ui/color-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConnectionsStore, useUIStore } from "@/stores";
import { ENVIRONMENT_PRESETS, type EnvironmentType } from "@/types";
import { cn } from "@/lib/utils";

export function GroupManagerDialog() {
  const { showGroupManagerDialog, setShowGroupManagerDialog } = useUIStore();
  const {
    groups,
    connections,
    addGroup,
    updateGroup,
    removeGroup,
  } = useConnectionsStore();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("#3B82F6");
  const [editingDescription, setEditingDescription] = useState("");
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const groupToDelete = groups.find((g) => g.id === deleteGroupId);
  const connectionsInGroupToDelete = connections.filter(
    (c) => c.groupId === deleteGroupId
  ).length;

  const handleCreateGroup = () => {
    setIsCreating(true);
    setSelectedGroupId(null);
    setEditingName("");
    setEditingColor("#3B82F6");
    setEditingDescription("");
  };

  const handleSelectGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      setSelectedGroupId(groupId);
      setIsCreating(false);
      setEditingName(group.name);
      setEditingColor(group.color);
      setEditingDescription(group.description || "");
    }
  };

  const handleSave = () => {
    if (!editingName.trim()) return;

    if (isCreating) {
      const id = addGroup({
        name: editingName.trim(),
        color: editingColor,
        description: editingDescription.trim() || undefined,
        isCollapsed: false,
      });
      setSelectedGroupId(id);
      setIsCreating(false);
    } else if (selectedGroupId) {
      updateGroup(selectedGroupId, {
        name: editingName.trim(),
        color: editingColor,
        description: editingDescription.trim() || undefined,
      });
    }
  };

  const handleDelete = () => {
    if (deleteGroupId) {
      removeGroup(deleteGroupId);
      if (selectedGroupId === deleteGroupId) {
        setSelectedGroupId(null);
        setEditingName("");
        setEditingColor("#3B82F6");
        setEditingDescription("");
      }
      setDeleteGroupId(null);
    }
  };

  const handlePresetClick = (preset: EnvironmentType) => {
    const { name, color } = ENVIRONMENT_PRESETS[preset];
    setEditingName(name);
    setEditingColor(color);
  };

  const handleClose = (open: boolean) => {
    setShowGroupManagerDialog(open);
    if (!open) {
      setSelectedGroupId(null);
      setIsCreating(false);
      setEditingName("");
      setEditingColor("#3B82F6");
      setEditingDescription("");
    }
  };

  return (
    <>
      <Dialog open={showGroupManagerDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-[600px] max-h-[80vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Manage Connection Groups
            </DialogTitle>
          </DialogHeader>

          <div className="flex h-[400px]">
            {/* Left Panel - Group List */}
            <div className="w-[200px] border-r flex flex-col">
              <div className="p-2 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  onClick={handleCreateGroup}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Group
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {groups.length === 0 && !isCreating ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No groups yet
                    </p>
                  ) : (
                    groups
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((group) => {
                        const count = connections.filter(
                          (c) => c.groupId === group.id
                        ).length;
                        return (
                          <button
                            key={group.id}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2",
                              selectedGroupId === group.id && !isCreating
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50"
                            )}
                            onClick={() => handleSelectGroup(group.id)}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: group.color }}
                            />
                            <span className="truncate flex-1">{group.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {count}
                            </span>
                          </button>
                        );
                      })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Panel - Edit Form */}
            <div className="flex-1 p-4 overflow-auto">
              {isCreating || selectedGroupId ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Enter group name"
                      autoFocus
                    />
                  </div>

                  {isCreating && (
                    <div className="space-y-2">
                      <Label>Quick Presets</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          Object.keys(ENVIRONMENT_PRESETS) as EnvironmentType[]
                        )
                          .filter((k) => k !== "custom")
                          .map((preset) => (
                            <Button
                              key={preset}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => handlePresetClick(preset)}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    ENVIRONMENT_PRESETS[preset].color,
                                }}
                              />
                              {ENVIRONMENT_PRESETS[preset].name}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <ColorPicker
                      value={editingColor}
                      onChange={setEditingColor}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      placeholder="Enter description"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={!editingName.trim()}
                      className="gap-1"
                    >
                      <Check className="h-4 w-4" />
                      {isCreating ? "Create" : "Save"}
                    </Button>
                    {!isCreating && selectedGroupId && (
                      <Button
                        variant="destructive"
                        onClick={() => setDeleteGroupId(selectedGroupId)}
                        className="gap-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    )}
                    {isCreating && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingName("");
                          setEditingColor("#3B82F6");
                          setEditingDescription("");
                        }}
                        className="gap-1"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Select a group or create a new one
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteGroupId !== null}
        onOpenChange={(open) => !open && setDeleteGroupId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the group "{groupToDelete?.name}"?
              {connectionsInGroupToDelete > 0 && (
                <>
                  <br />
                  <br />
                  <span className="font-medium">
                    {connectionsInGroupToDelete} connection
                    {connectionsInGroupToDelete > 1 ? "s" : ""} will be moved to
                    "Ungrouped".
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
