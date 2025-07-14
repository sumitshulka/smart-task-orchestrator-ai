
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";

/**
 * Fetches the current user's roles and teams using the new API client.
 * Uses AuthContext for user information instead of Supabase.
 */
export function useCurrentUserRoleAndTeams() {
  const [roles, setRoles] = useState<string[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setRoles([]);
      setTeams([]);

      if (!user) {
        console.warn("[useCurrentUserRoleAndTeams] No authenticated user found", { authUser: user });
        setLoading(false);
        return;
      }
      
      console.log("[useCurrentUserRoleAndTeams] Authenticated user:", user);

      try {
        // Step 1: Fetch user roles
        const userRolesData = await apiClient.getUserRoles(user.id);
        console.log("[useCurrentUserRoleAndTeams] User roles data:", userRolesData);
        
        // Step 1.5: Fetch all roles to map role_id to role names
        const allRoles = await apiClient.getRoles();
        console.log("[useCurrentUserRoleAndTeams] All roles:", allRoles);
        
        // Map role_ids to role names
        const roleNames = userRolesData?.map((userRole: any) => {
          const role = allRoles.find((r: any) => r.id === userRole.role_id);
          return role?.name;
        }).filter(Boolean) || [];
        
        console.log("[useCurrentUserRoleAndTeams] Extracted role names:", roleNames);
        setRoles(roleNames);

        // Step 2: Fetch team memberships
        const memberships = await apiClient.getTeamMembers(user.id);
        console.log("[useCurrentUserRoleAndTeams] Team memberships data:", memberships);
        
        // Get team details for each membership
        const teamPromises = memberships?.map(async (m: any) => {
          try {
            return await apiClient.getTeam(m.team_id);
          } catch (error) {
            console.error('Failed to fetch team details:', error);
            return null;
          }
        }) || [];
        
        const teams = await Promise.all(teamPromises);
        const filteredTeams = teams.filter(Boolean);
        console.log("[useCurrentUserRoleAndTeams] Final teams for user:", filteredTeams);

        setTeams(filteredTeams);
      } catch (error) {
        console.error("[useCurrentUserRoleAndTeams] Error fetching user data:", error);
        setRoles([]);
        setTeams([]);
      }

      setLoading(false);
    })();
  }, [user]);

  return { roles, teams, user, loading };
}

