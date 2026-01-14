import { useState, useEffect } from "react";
import { Loader2, UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, Input, Label } from "@/components/ui";
import { useDatabase, useAsyncOperation } from "@/hooks";
import { useUIStore, useUsersStore } from "@/stores";

export function CreateRoleDialog() {
  const { createRole, getRoles } = useDatabase();
  const {
    showCreateRoleDialog,
    creatingRoleConnectionId,
    setShowCreateRoleDialog,
  } = useUIStore();
  const { setRoles } = useUsersStore();

  const [roleName, setRoleName] = useState("");
  const { execute, isLoading, error, setError } = useAsyncOperation();

  // Reset form when dialog opens
  useEffect(() => {
    if (showCreateRoleDialog) {
      setRoleName("");
      setError(null);
    }
  }, [showCreateRoleDialog, setError]);

  const handleCreate = async () => {
    if (!creatingRoleConnectionId || !roleName.trim()) return;

    // Validate role name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(roleName.trim())) {
      setError("Role name must start with a letter or underscore and contain only alphanumeric characters and underscores");
      return;
    }

    await execute(async () => {
      const success = await createRole(creatingRoleConnectionId, {
        roleName: roleName.trim(),
      });

      if (success) {
        // Refresh roles list
        const roles = await getRoles(creatingRoleConnectionId);
        setRoles(creatingRoleConnectionId, roles);
        setShowCreateRoleDialog(false);
      } else {
        throw new Error("Failed to create role");
      }
    });
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      setShowCreateRoleDialog(open);
    }
  };

  return (
    <Dialog open={showCreateRoleDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Create Role
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role Name</Label>
            <Input
              id="role-name"
              value={roleName}
              onChange={(e) => {
                setRoleName(e.target.value);
                setError(null);
              }}
              placeholder="Enter role name"
              disabled={isLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && roleName.trim()) {
                  handleCreate();
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
            onClick={handleCreate}
            disabled={isLoading || !roleName.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Role"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
