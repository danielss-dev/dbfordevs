import { create } from "zustand";
import type {
  DatabaseUser,
  DatabaseRole,
  DatabasePermission,
  AvailablePrivileges,
} from "@/types";

interface UsersState {
  // Data by connection
  usersByConnection: Record<string, DatabaseUser[]>;
  rolesByConnection: Record<string, DatabaseRole[]>;
  permissionsByGrantee: Record<string, DatabasePermission[]>;
  availablePrivilegesByConnection: Record<string, AvailablePrivileges>;

  // Loading states
  loadingUsers: boolean;
  loadingRoles: boolean;
  loadingPermissions: boolean;

  // Error state
  error: string | null;

  // Selection state
  selectedUser: DatabaseUser | null;
  selectedRole: DatabaseRole | null;

  // Actions - Data setters
  setUsers: (connectionId: string, users: DatabaseUser[]) => void;
  setRoles: (connectionId: string, roles: DatabaseRole[]) => void;
  setPermissions: (granteeKey: string, permissions: DatabasePermission[]) => void;
  setAvailablePrivileges: (connectionId: string, privileges: AvailablePrivileges) => void;

  // Actions - Clear data
  clearUsersForConnection: (connectionId: string) => void;
  clearRolesForConnection: (connectionId: string) => void;
  clearPermissionsForGrantee: (granteeKey: string) => void;
  clearAllForConnection: (connectionId: string) => void;

  // Actions - Loading states
  setLoadingUsers: (loading: boolean) => void;
  setLoadingRoles: (loading: boolean) => void;
  setLoadingPermissions: (loading: boolean) => void;

  // Actions - Error state
  setError: (error: string | null) => void;

  // Actions - Selection
  setSelectedUser: (user: DatabaseUser | null) => void;
  setSelectedRole: (role: DatabaseRole | null) => void;
}

export const useUsersStore = create<UsersState>()((set) => ({
  // Initial state
  usersByConnection: {},
  rolesByConnection: {},
  permissionsByGrantee: {},
  availablePrivilegesByConnection: {},
  loadingUsers: false,
  loadingRoles: false,
  loadingPermissions: false,
  error: null,
  selectedUser: null,
  selectedRole: null,

  // Data setters
  setUsers: (connectionId, users) =>
    set((state) => ({
      usersByConnection: {
        ...state.usersByConnection,
        [connectionId]: users,
      },
    })),

  setRoles: (connectionId, roles) =>
    set((state) => ({
      rolesByConnection: {
        ...state.rolesByConnection,
        [connectionId]: roles,
      },
    })),

  setPermissions: (granteeKey, permissions) =>
    set((state) => ({
      permissionsByGrantee: {
        ...state.permissionsByGrantee,
        [granteeKey]: permissions,
      },
    })),

  setAvailablePrivileges: (connectionId, privileges) =>
    set((state) => ({
      availablePrivilegesByConnection: {
        ...state.availablePrivilegesByConnection,
        [connectionId]: privileges,
      },
    })),

  // Clear data
  clearUsersForConnection: (connectionId) =>
    set((state) => {
      const newUsers = { ...state.usersByConnection };
      delete newUsers[connectionId];
      return { usersByConnection: newUsers };
    }),

  clearRolesForConnection: (connectionId) =>
    set((state) => {
      const newRoles = { ...state.rolesByConnection };
      delete newRoles[connectionId];
      return { rolesByConnection: newRoles };
    }),

  clearPermissionsForGrantee: (granteeKey) =>
    set((state) => {
      const newPermissions = { ...state.permissionsByGrantee };
      delete newPermissions[granteeKey];
      return { permissionsByGrantee: newPermissions };
    }),

  clearAllForConnection: (connectionId) =>
    set((state) => {
      const newUsers = { ...state.usersByConnection };
      const newRoles = { ...state.rolesByConnection };
      const newPrivileges = { ...state.availablePrivilegesByConnection };
      delete newUsers[connectionId];
      delete newRoles[connectionId];
      delete newPrivileges[connectionId];

      // Clear permissions that belong to this connection
      const newPermissions = { ...state.permissionsByGrantee };
      for (const key of Object.keys(newPermissions)) {
        if (key.startsWith(`${connectionId}:`)) {
          delete newPermissions[key];
        }
      }

      return {
        usersByConnection: newUsers,
        rolesByConnection: newRoles,
        permissionsByGrantee: newPermissions,
        availablePrivilegesByConnection: newPrivileges,
      };
    }),

  // Loading states
  setLoadingUsers: (loadingUsers) => set({ loadingUsers }),
  setLoadingRoles: (loadingRoles) => set({ loadingRoles }),
  setLoadingPermissions: (loadingPermissions) => set({ loadingPermissions }),

  // Error state
  setError: (error) => set({ error }),

  // Selection
  setSelectedUser: (selectedUser) => set({ selectedUser }),
  setSelectedRole: (selectedRole) => set({ selectedRole }),
}));
