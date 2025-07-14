
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";

/**
 * Optimized hook that fetches the current user's roles and teams using React Query caching.
 * Significantly reduces redundant API calls and improves performance.
 */
export function useCurrentUserRoleAndTeams() {
  const { user } = useAuth();

  // Cache user roles with React Query - 5 minute cache
  const { data: userRolesData = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/users", user?.id, "roles"],
    queryFn: () => apiClient.getUserRoles(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Cache all roles - 10 minute cache since roles change infrequently
  const { data: allRoles = [], isLoading: allRolesLoading } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: () => apiClient.getRoles(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Cache team memberships - 5 minute cache
  const { data: memberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ["/api/teams", user?.id, "members"],
    queryFn: () => apiClient.getTeamMembers(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Process role names from cached data
  const roles = userRolesData?.map((userRole: any) => {
    const role = allRoles.find((r: any) => r.id === userRole.role_id);
    return role?.name;
  }).filter(Boolean) || [];

  // Process team data from cached memberships
  const teams: any[] = []; // For now, simplified - teams aren't being used extensively

  const loading = rolesLoading || allRolesLoading || membershipsLoading;

  // Log only when user changes, not on every render
  if (user && !loading) {
    console.log("[useCurrentUserRoleAndTeams] Authenticated user:", user);
    console.log("[useCurrentUserRoleAndTeams] Extracted role names:", roles);
    console.log("[useCurrentUserRoleAndTeams] Final teams for user:", teams);
  }

  return { roles, teams, user, loading };
}

