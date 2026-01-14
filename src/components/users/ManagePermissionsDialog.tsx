import { useState, useEffect } from "react";
import { Loader2, Shield, Plus, Trash2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDatabase, useAsyncOperation } from "@/hooks";
import { useUIStore, useUsersStore } from "@/stores";
import type { DatabasePermission, DatabaseRole } from "@/types";

export function ManagePermissionsDialog() {
  const {
    getPermissions,
    getAvailablePrivileges,
    grantPermission,
    revokePermission,
    getRoles,
    grantRole,
    revokeRole,
  } = useDatabase();
  const {
    showManagePermissionsDialog,
    managingPermissionsConnectionId,
    managingPermissionsGrantee,
    managingPermissionsGranteeHost,
    setShowManagePermissionsDialog,
  } = useUIStore();
  const {
    permissionsByGrantee,
    rolesByConnection,
    availablePrivilegesByConnection,
    setPermissions,
    setRoles,
    setAvailablePrivileges,
  } = useUsersStore();

  const [activeTab, setActiveTab] = useState("permissions");
  const [selectedPrivilege, setSelectedPrivilege] = useState<string>("");
  const [withGrantOption, setWithGrantOption] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const { execute, isLoading, error, setError } = useAsyncOperation();

  // Generate grantee key for permissions lookup
  const granteeKey = managingPermissionsConnectionId && managingPermissionsGrantee
    ? `${managingPermissionsConnectionId}:${managingPermissionsGrantee}${managingPermissionsGranteeHost ? `@${managingPermissionsGranteeHost}` : ""}`
    : "";

  // Get current data
  const permissions = granteeKey ? (permissionsByGrantee[granteeKey] || []) : [];
  const roles = managingPermissionsConnectionId ? (rolesByConnection[managingPermissionsConnectionId] || []) : [];
  const availablePrivileges = managingPermissionsConnectionId
    ? availablePrivilegesByConnection[managingPermissionsConnectionId]
    : null;

  // Load data when dialog opens
  useEffect(() => {
    if (showManagePermissionsDialog && managingPermissionsConnectionId && managingPermissionsGrantee) {
      loadData();
    }
  }, [showManagePermissionsDialog, managingPermissionsConnectionId, managingPermissionsGrantee]);

  const loadData = async () => {
    if (!managingPermissionsConnectionId || !managingPermissionsGrantee) return;

    setError(null);
    try {
      // Load permissions, roles, and available privileges in parallel
      const [perms, rolesList, privileges] = await Promise.all([
        getPermissions(managingPermissionsConnectionId, managingPermissionsGrantee, managingPermissionsGranteeHost ?? undefined),
        getRoles(managingPermissionsConnectionId),
        getAvailablePrivileges(managingPermissionsConnectionId),
      ]);

      setPermissions(granteeKey, perms);
      setRoles(managingPermissionsConnectionId, rolesList);
      if (privileges) {
        setAvailablePrivileges(managingPermissionsConnectionId, privileges);
      }
    } catch {
      // Errors handled by individual calls
    }
  };

  const handleGrantPermission = async () => {
    if (!managingPermissionsConnectionId || !managingPermissionsGrantee || !selectedPrivilege) return;

    await execute(async () => {
      const success = await grantPermission(managingPermissionsConnectionId, {
        grantee: managingPermissionsGrantee,
        host: managingPermissionsGranteeHost ?? undefined,
        privilege: selectedPrivilege,
        withGrantOption,
      });

      if (success) {
        // Refresh permissions
        const perms = await getPermissions(
          managingPermissionsConnectionId,
          managingPermissionsGrantee,
          managingPermissionsGranteeHost ?? undefined
        );
        setPermissions(granteeKey, perms);
        setSelectedPrivilege("");
        setWithGrantOption(false);
      } else {
        throw new Error("Failed to grant permission");
      }
    });
  };

  const handleRevokePermission = async (permission: DatabasePermission) => {
    if (!managingPermissionsConnectionId || !managingPermissionsGrantee) return;

    await execute(async () => {
      const success = await revokePermission(managingPermissionsConnectionId, {
        grantee: managingPermissionsGrantee,
        host: managingPermissionsGranteeHost ?? undefined,
        privilege: permission.privilege,
        withGrantOption: false,
      });

      if (success) {
        // Refresh permissions
        const perms = await getPermissions(
          managingPermissionsConnectionId,
          managingPermissionsGrantee,
          managingPermissionsGranteeHost ?? undefined
        );
        setPermissions(granteeKey, perms);
      } else {
        throw new Error("Failed to revoke permission");
      }
    });
  };

  const handleGrantRole = async () => {
    if (!managingPermissionsConnectionId || !managingPermissionsGrantee || !selectedRole) return;

    await execute(async () => {
      const success = await grantRole(managingPermissionsConnectionId, {
        roleName: selectedRole,
        memberName: managingPermissionsGrantee,
        memberHost: managingPermissionsGranteeHost ?? undefined,
      });

      if (success) {
        // Refresh roles and permissions (roles affect effective permissions)
        await loadData();
        setSelectedRole("");
      } else {
        throw new Error("Failed to grant role");
      }
    });
  };

  const handleRevokeRole = async (role: DatabaseRole) => {
    if (!managingPermissionsConnectionId || !managingPermissionsGrantee) return;

    await execute(async () => {
      const success = await revokeRole(managingPermissionsConnectionId, {
        roleName: role.name,
        memberName: managingPermissionsGrantee,
        memberHost: managingPermissionsGranteeHost ?? undefined,
      });

      if (success) {
        // Refresh roles
        await loadData();
      } else {
        throw new Error("Failed to revoke role");
      }
    });
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      setShowManagePermissionsDialog(open);
      if (!open) {
        setActiveTab("permissions");
        setSelectedPrivilege("");
        setWithGrantOption(false);
        setSelectedRole("");
        setError(null);
      }
    }
  };

  const displayGrantee = managingPermissionsGranteeHost
    ? `${managingPermissionsGrantee}@${managingPermissionsGranteeHost}`
    : managingPermissionsGrantee;

  // Get roles that the user is currently a member of
  const userRoles = roles.filter(r => r.members.includes(managingPermissionsGrantee || ""));

  // Get available privileges that haven't been granted yet
  const availableToGrant = availablePrivileges?.databasePrivileges.filter(
    p => !permissions.some(perm => perm.privilege === p)
  ) || [];

  // Get roles that the user is NOT a member of (available to grant)
  const availableRolesToGrant = roles.filter(r => !r.members.includes(managingPermissionsGrantee || ""));

  return (
    <Dialog open={showManagePermissionsDialog} onOpenChange={handleClose}>
      <DialogContent className="max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Permissions: {displayGrantee}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="space-y-4">
            {/* Grant new permission */}
            <div className="space-y-3 p-3 border rounded-lg">
              <Label className="text-sm font-medium">Grant Permission</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Select value={selectedPrivilege} onValueChange={setSelectedPrivilege}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select privilege..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToGrant.map(priv => (
                        <SelectItem key={priv} value={priv}>
                          {priv}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={handleGrantPermission}
                  disabled={isLoading || !selectedPrivilege}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="with-grant-option"
                  checked={withGrantOption}
                  onCheckedChange={(checked) => setWithGrantOption(checked === true)}
                />
                <Label htmlFor="with-grant-option" className="text-sm">
                  With grant option
                </Label>
              </div>
            </div>

            {/* Current permissions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Current Permissions</Label>
                <Button variant="ghost" size="sm" onClick={loadData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded-lg">
                {permissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    No permissions granted
                  </p>
                ) : (
                  <div className="p-2 space-y-1">
                    {permissions.map((perm, idx) => (
                      <div
                        key={`${perm.privilege}-${idx}`}
                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{perm.privilege}</span>
                          {perm.isGrantable && (
                            <span className="text-xs text-muted-foreground">(with grant)</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokePermission(perm)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            {/* Grant role */}
            <div className="space-y-3 p-3 border rounded-lg">
              <Label className="text-sm font-medium">Assign Role</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRolesToGrant.map(role => (
                        <SelectItem key={role.name} value={role.name}>
                          {role.name}
                          {role.isSystemRole && " (system)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={handleGrantRole}
                  disabled={isLoading || !selectedRole}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Current role memberships */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Assigned Roles</Label>
                <Button variant="ghost" size="sm" onClick={loadData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded-lg">
                {userRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    No roles assigned
                  </p>
                ) : (
                  <div className="p-2 space-y-1">
                    {userRoles.map((role) => (
                      <div
                        key={role.name}
                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{role.name}</span>
                          {role.isSystemRole && (
                            <span className="text-xs text-muted-foreground">(system)</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeRole(role)}
                          disabled={isLoading || role.isSystemRole}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
