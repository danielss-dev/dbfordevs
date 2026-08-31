import { useState } from "react";
import { Plus, CircleNotch, Trash, ArrowsClockwise, Shield, Users, UserGear, User, Key } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";
import { useUIStore, useUsersStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo } from "@/types";
import { showErrorToast } from "@/lib/toast-helpers";
import { TreeItem } from "../TreeItem";

export function SecuritySection({ connection }: { connection: ConnectionInfo }) {
  const openCreateUserDialog = useUIStore(state => state.openCreateUserDialog);
  const openChangePasswordDialog = useUIStore(state => state.openChangePasswordDialog);
  const openCreateRoleDialog = useUIStore(state => state.openCreateRoleDialog);
  const openManagePermissionsDialog = useUIStore(state => state.openManagePermissionsDialog);
  const usersByConnection = useUsersStore(state => state.usersByConnection);
  const rolesByConnection = useUsersStore(state => state.rolesByConnection);
  const setUsers = useUsersStore(state => state.setUsers);
  const setRoles = useUsersStore(state => state.setRoles);
  const {
    supportsUserManagement,
    getUsers,
    getRoles,
    deleteUser,
    deleteRole,
  } = useDatabase();
  const { toast } = useToast();

  // Security section state
  const [securityOpen, setSecurityOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ name: string; host?: string } | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [supportsUsers, setSupportsUsers] = useState<boolean | null>(null);

  // Security section handlers
  const handleSecurityClick = async () => {
    const isOpening = !securityOpen;
    setSecurityOpen(isOpening);

    if (isOpening && connection.connected) {
      // Check if user management is supported
      if (supportsUsers === null) {
        const supported = await supportsUserManagement(connection.id);
        setSupportsUsers(supported);
        if (!supported) return;
      } else if (!supportsUsers) {
        return;
      }

      // Load users and roles if not already loaded
      if (!usersByConnection[connection.id]) {
        loadSecurityUsers();
      }
      if (!rolesByConnection[connection.id]) {
        loadSecurityRoles();
      }
    }
  };

  const loadSecurityUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await getUsers(connection.id);
      setUsers(connection.id, users);
    } catch (error) {
      console.error("Failed to load users:", error);
      showErrorToast("Failed to load users", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadSecurityRoles = async () => {
    setIsLoadingRoles(true);
    try {
      const roles = await getRoles(connection.id);
      setRoles(connection.id, roles);
    } catch (error) {
      console.error("Failed to load roles:", error);
      showErrorToast("Failed to load roles", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const success = await deleteUser(connection.id, userToDelete.name, userToDelete.host);
      if (success) {
        // Refresh users list
        await loadSecurityUsers();
        toast({
          title: "User deleted",
          description: `User "${userToDelete.name}" has been deleted successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to delete user",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
    }
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      const success = await deleteRole(connection.id, roleToDelete);
      if (success) {
        // Refresh roles list
        await loadSecurityRoles();
        toast({
          title: "Role deleted",
          description: `Role "${roleToDelete}" has been deleted successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to delete role",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setRoleToDelete(null);
    }
  };

  // Get users and roles for this connection
  const connectionUsers = usersByConnection[connection.id] || [];
  const connectionRoles = rolesByConnection[connection.id] || [];
  const isMySQL = connection.databaseType === "mysql";

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Security"
              icon={<Shield weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
              level={1}
              onClick={handleSecurityClick}
              defaultOpen={false}
            >
              {supportsUsers === false ? (
                <div className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${2 * 14 + 6}px` }}>
                  User management not supported
                </div>
              ) : (
                <>
                  {/* Users */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label="Users"
                          icon={<Users weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
                          level={2}
                          defaultOpen={false}
                        >
                          {isLoadingUsers ? (
                            <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${3 * 14 + 6}px` }}>
                              <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />
                              <span>Loading...</span>
                            </div>
                          ) : connectionUsers.length > 0 ? (
                            connectionUsers.map((user) => {
                              const userDisplayName = isMySQL && user.host
                                ? `${user.name}@${user.host}`
                                : user.name;
                              return (
                                <ContextMenu key={userDisplayName}>
                                  <ContextMenuTrigger asChild>
                                    <div>
                                      <TreeItem
                                        label={userDisplayName}
                                        icon={<User weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
                                        level={3}
                                      />
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-56">
                                    <ContextMenuItem
                                      onSelect={() => openManagePermissionsDialog(connection.id, user.name, user.host ?? undefined)}
                                      className="gap-2"
                                    >
                                      <Shield weight="regular" className="h-4 w-4" />
                                      Manage Permissions
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onSelect={() => openChangePasswordDialog(connection.id, user.name, user.host ?? undefined)}
                                      className="gap-2"
                                    >
                                      <Key weight="regular" className="h-4 w-4" />
                                      Change Password
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onSelect={() => setUserToDelete({ name: user.name, host: user.host ?? undefined })}
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash weight="regular" className="h-4 w-4" />
                                      Delete User
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })
                          ) : securityOpen ? (
                            <div className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${3 * 14 + 6}px` }}>No users found</div>
                          ) : null}
                        </TreeItem>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={() => openCreateUserDialog(connection.id)} className="gap-2">
                        <Plus weight="regular" className="h-4 w-4" />
                        Create User
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={loadSecurityUsers} className="gap-2">
                        <ArrowsClockwise weight="regular" className={cn("h-4 w-4", isLoadingUsers && "animate-spin")} />
                        Refresh
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Roles */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label="Roles"
                          icon={<UserGear weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
                          level={2}
                          defaultOpen={false}
                        >
                          {isLoadingRoles ? (
                            <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${3 * 14 + 6}px` }}>
                              <CircleNotch weight="regular" className="h-3 w-3 animate-spin" />
                              <span>Loading...</span>
                            </div>
                          ) : connectionRoles.length > 0 ? (
                            connectionRoles.map((role) => (
                              <ContextMenu key={role.name}>
                                <ContextMenuTrigger asChild>
                                  <div>
                                    <TreeItem
                                      label={role.name}
                                      icon={<UserGear weight="regular" className="h-3.5 w-3.5 text-muted-foreground" />}
                                      level={3}
                                    />
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-48">
                                  {!role.isSystemRole && (
                                    <ContextMenuItem
                                      onSelect={() => setRoleToDelete(role.name)}
                                      className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash weight="regular" className="h-4 w-4" />
                                      Delete Role
                                    </ContextMenuItem>
                                  )}
                                  {role.isSystemRole && (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                      System role (cannot delete)
                                    </div>
                                  )}
                                </ContextMenuContent>
                              </ContextMenu>
                            ))
                          ) : securityOpen ? (
                            <div className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: `${3 * 14 + 6}px` }}>No roles found</div>
                          ) : null}
                        </TreeItem>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={() => openCreateRoleDialog(connection.id)} className="gap-2">
                        <Plus weight="regular" className="h-4 w-4" />
                        Create Role
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={loadSecurityRoles} className="gap-2">
                        <ArrowsClockwise weight="regular" className={cn("h-4 w-4", isLoadingRoles && "animate-spin")} />
                        Refresh
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => { loadSecurityUsers(); loadSecurityRoles(); }} className="gap-2">
            <ArrowsClockwise weight="regular" className={cn("h-4 w-4", (isLoadingUsers || isLoadingRoles) && "animate-spin")} />
            Refresh All
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user "{userToDelete?.name}{userToDelete?.host ? `@${userToDelete.host}` : ''}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation Dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete}"? Users assigned this role will lose associated permissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
