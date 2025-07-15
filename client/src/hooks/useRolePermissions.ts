import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

export interface RolePermission {
  id: string;
  role_id: string;
  resource: string;
  permission_level: number;
  created_at: string;
  updated_at: string;
}

export function useRolePermissions() {
  const { user } = useAuth();
  const { roles } = useCurrentUserRoleAndTeams();

  // Fetch all role permissions for current user's roles
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["/api/role-permissions", roles],
    queryFn: async () => {
      if (!roles.length) return [];
      
      // Get all roles data to map role names to IDs
      const rolesResponse = await fetch("/api/roles", {
        headers: { "x-user-id": user?.id || "" }
      });
      
      if (!rolesResponse.ok) return [];
      const allRoles = await rolesResponse.json();
      
      // Get role IDs for current user's roles
      const roleIds = allRoles
        .filter((role: any) => roles.includes(role.name))
        .map((role: any) => role.id);
      
      if (!roleIds.length) return [];
      
      // Fetch permissions for all user roles
      const permissionPromises = roleIds.map(async (roleId: string) => {
        const response = await fetch(`/api/roles/${roleId}/permissions`, {
          headers: { "x-user-id": user?.id || "" }
        });
        return response.ok ? response.json() : [];
      });
      
      const allPermissions = await Promise.all(permissionPromises);
      return allPermissions.flat();
    },
    enabled: !!user?.id && roles.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Helper function to check if user has permission for a resource
  const hasPermission = (resource: string, minLevel: number = 1): boolean => {
    if (!permissions.length) return false;
    
    // Check if user has any permission for this resource that meets minimum level
    return permissions.some((perm: RolePermission) => 
      perm.resource === resource && perm.permission_level >= minLevel
    );
  };

  // Helper function to get permission level for a resource
  const getPermissionLevel = (resource: string): number => {
    const permission = permissions.find((perm: RolePermission) => 
      perm.resource === resource
    );
    return permission?.permission_level || 0;
  };

  // Common permission checks
  const canViewSettings = hasPermission("settings", 1);
  const canEditSettings = hasPermission("settings", 2);
  const canCreateSettings = hasPermission("settings", 3);
  const canDeleteSettings = hasPermission("settings", 4);

  return {
    permissions,
    isLoading,
    hasPermission,
    getPermissionLevel,
    canViewSettings,
    canEditSettings,
    canCreateSettings,
    canDeleteSettings,
  };
}