import { useState, useEffect } from "react";
import { Loader2, Table as TableIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, Input, Label } from "@/components/ui";
import { useDatabase, useAsyncOperation } from "@/hooks";
import { useUIStore, useQueryStore } from "@/stores";

export function RenameTableDialog() {
  const { renameTable, getTables } = useDatabase();
  const { renameTableInTabs } = useQueryStore();
  const {
    showRenameTableDialog,
    renamingTableName,
    renamingConnectionId,
    setShowRenameTableDialog,
  } = useUIStore();

  const [newName, setNewName] = useState("");
  const { execute, isLoading, error, setError } = useAsyncOperation();

  // Get display name (strip schema prefix for display)
  const displayName = renamingTableName?.includes(".")
    ? renamingTableName.split(".").pop()
    : renamingTableName;

  useEffect(() => {
    if (showRenameTableDialog && displayName) {
      setNewName(displayName);
      setError(null);
    }
  }, [showRenameTableDialog, displayName]);

  const handleRename = async () => {
    if (!renamingTableName || !renamingConnectionId || !newName.trim()) return;

    // Validate new name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName.trim())) {
      setError("Table name must start with a letter or underscore and contain only alphanumeric characters and underscores");
      return;
    }

    await execute(async () => {
      const result = await renameTable(renamingConnectionId, renamingTableName, newName.trim());
      if (result) {
        // Update all open tabs that refer to this table
        renameTableInTabs(renamingConnectionId, renamingTableName, newName.trim());
        // Refresh tables list
        await getTables(renamingConnectionId);
        setShowRenameTableDialog(false);
      } else {
        throw new Error("Failed to rename table");
      }
    });
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      setShowRenameTableDialog(open);
      if (!open) {
        setNewName("");
        setError(null);
      }
    }
  };

  return (
    <Dialog open={showRenameTableDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Rename Table
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="current-name">Current Name</Label>
            <Input
              id="current-name"
              value={displayName || ""}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-name">New Name</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(null);
              }}
              placeholder="Enter new table name"
              disabled={isLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleRename();
                }
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={isLoading || !newName.trim() || newName.trim() === displayName}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Renaming...
              </>
            ) : (
              "Rename"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
