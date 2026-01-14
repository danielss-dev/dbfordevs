import { useState, useEffect } from "react";
import { Loader2, KeyRound } from "lucide-react";
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

export function ChangePasswordDialog() {
  const { changePassword } = useDatabase();
  const {
    showChangePasswordDialog,
    changingPasswordConnectionId,
    changingPasswordUser,
    changingPasswordHost,
    setShowChangePasswordDialog,
  } = useUIStore();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { execute, isLoading, error, setError } = useAsyncOperation();

  // Reset form when dialog opens
  useEffect(() => {
    if (showChangePasswordDialog) {
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    }
  }, [showChangePasswordDialog, setError]);

  const handleChange = async () => {
    if (!changingPasswordConnectionId || !changingPasswordUser || !newPassword) return;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    await execute(async () => {
      const success = await changePassword(changingPasswordConnectionId, {
        username: changingPasswordUser,
        host: changingPasswordHost ?? undefined,
        newPassword,
      });

      if (success) {
        setShowChangePasswordDialog(false);
      } else {
        throw new Error("Failed to change password");
      }
    });
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      setShowChangePasswordDialog(open);
    }
  };

  const displayUsername = changingPasswordHost
    ? `${changingPasswordUser}@${changingPasswordHost}`
    : changingPasswordUser;

  return (
    <Dialog open={showChangePasswordDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Change Password
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Change password for user: <strong>{displayUsername}</strong>
          </p>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError(null);
              }}
              placeholder="Enter new password"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm New Password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="Confirm new password"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && newPassword && confirmPassword) {
                  handleChange();
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
            onClick={handleChange}
            disabled={isLoading || !newPassword || !confirmPassword}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
