import { useState, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, Input, Label } from "@/components/ui";
import { useDatabase, useAsyncOperation } from "@/hooks";
import { useUIStore, useConnectionsStore, useUsersStore } from "@/stores";

export function CreateUserDialog() {
  const {
    createUser,
    getUsers,
  } = useDatabase();
  const {
    showCreateUserDialog,
    creatingUserConnectionId,
    setShowCreateUserDialog,
  } = useUIStore();
  const { connections } = useConnectionsStore();
  const { setUsers } = useUsersStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [host, setHost] = useState("%"); // Default to any host for MySQL
  const { execute, isLoading, error, setError } = useAsyncOperation();

  // Get connection to determine if it's MySQL (needs host field)
  const connection = connections.find(c => c.id === creatingUserConnectionId);
  const isMySQL = connection?.databaseType === "mysql";

  // Reset form when dialog opens
  useEffect(() => {
    if (showCreateUserDialog) {
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setHost("%");
      setError(null);
    }
  }, [showCreateUserDialog, setError]);

  const handleCreate = async () => {
    if (!creatingUserConnectionId || !username.trim() || !password) return;

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate username
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username.trim())) {
      setError("Username must start with a letter or underscore and contain only alphanumeric characters and underscores");
      return;
    }

    await execute(async () => {
      const success = await createUser(creatingUserConnectionId, {
        username: username.trim(),
        password,
        host: isMySQL ? host.trim() : undefined,
      });

      if (success) {
        // Refresh users list
        const users = await getUsers(creatingUserConnectionId);
        setUsers(creatingUserConnectionId, users);
        setShowCreateUserDialog(false);
      } else {
        throw new Error("Failed to create user");
      }
    });
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      setShowCreateUserDialog(open);
    }
  };

  return (
    <Dialog open={showCreateUserDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create User
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="Enter username"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {isMySQL && (
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  setError(null);
                }}
                placeholder="% for any host, or specific host"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Use % to allow connections from any host
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Enter password"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="Confirm password"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && username.trim() && password && confirmPassword) {
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
            disabled={isLoading || !username.trim() || !password || !confirmPassword}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create User"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
