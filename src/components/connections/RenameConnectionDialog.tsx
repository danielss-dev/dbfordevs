import { useState, useEffect } from "react";
import { Loader2, Database } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, Input, Label } from "@/components/ui";
import { useDatabase, useAsyncOperation } from "@/hooks";
import { useUIStore } from "@/stores";
import { showSuccessToast } from "@/lib/toast-helpers";

export function RenameConnectionDialog() {
  const { getConnection, saveConnection, loadConnections } = useDatabase();
  const {
    showRenameConnectionDialog,
    renamingConnectionId,
    renamingConnectionName,
    isDuplicatingConnection,
    setShowRenameConnectionDialog,
  } = useUIStore();

  const [newName, setNewName] = useState("");
  const { execute, isLoading, error, setError } = useAsyncOperation();

  useEffect(() => {
    if (showRenameConnectionDialog && renamingConnectionName) {
      setNewName(isDuplicatingConnection ? `${renamingConnectionName} (Copy)` : renamingConnectionName);
      setError(null);
    }
  }, [showRenameConnectionDialog, renamingConnectionName, isDuplicatingConnection]);

  const handleAction = async () => {
    if (!renamingConnectionId || !newName.trim()) return;

    await execute(async () => {
      const config = await getConnection(renamingConnectionId);
      if (!config) {
        throw new Error("Connection configuration not found");
      }

      if (isDuplicatingConnection) {
        const { id, ...duplicateConfig } = config;
        duplicateConfig.name = newName.trim();
        const result = await saveConnection(duplicateConfig);
        if (result) {
          showSuccessToast(
            "Connection Duplicated",
            `Successfully duplicated "${renamingConnectionName}" as "${newName.trim()}".`
          );
          // Refresh connections list to show new connection in sidebar
          await loadConnections();
          setShowRenameConnectionDialog(false);
        } else {
          throw new Error("Failed to duplicate connection");
        }
      } else {
        const updatedConfig = { ...config, name: newName.trim() };
        const result = await saveConnection(updatedConfig);
        if (result) {
          showSuccessToast(
            "Connection Renamed",
            `Successfully renamed connection to "${newName.trim()}".`
          );
          // Refresh connections list to show new name in sidebar
          await loadConnections();
          setShowRenameConnectionDialog(false);
        } else {
          throw new Error("Failed to rename connection");
        }
      }
    });
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      setShowRenameConnectionDialog(open);
      if (!open) {
        setNewName("");
        setError(null);
      }
    }
  };

  return (
    <Dialog open={showRenameConnectionDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {isDuplicatingConnection ? "Duplicate Connection" : "Rename Connection"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="current-name">Current Name</Label>
            <Input
              id="current-name"
              value={renamingConnectionName || ""}
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
              placeholder={isDuplicatingConnection ? "Enter name for duplicate" : "Enter new connection name"}
              disabled={isLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) {
                  handleAction();
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
            onClick={handleAction}
            disabled={isLoading || !newName.trim() || (!isDuplicatingConnection && newName.trim() === renamingConnectionName)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isDuplicatingConnection ? "Duplicating..." : "Renaming..."}
              </>
            ) : (
              isDuplicatingConnection ? "Duplicate" : "Rename"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

