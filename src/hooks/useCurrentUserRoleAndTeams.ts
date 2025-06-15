
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the current user's roles and teams from Supabase
 */
export function useCurrentUserRoleAndTeams() {
  const [roles, setRoles] = useState<string[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Get user
      const sessionData = await supabase.auth.getUser();
      const u = sessionData?.data?.user;
      setUser(u);
      if (u && u.id) {
        // Fetch user_roles
        const { data: userRolesData } = await supabase
          .from("user_roles")
          .select("*, role:roles(name)")
          .eq("user_id", u.id);
        setRoles(userRolesData?.map((r: any) => r.role?.name).filter(Boolean) || []);
        // Fetch team memberships
        const { data: memberships } = await supabase
          .from("team_memberships")
          .select("team_id, team:teams(*)")
          .eq("user_id", u.id);
        setTeams(memberships?.map((m: any) => m.team).filter(Boolean) || []);
      } else {
        setRoles([]);
        setTeams([]);
      }
      setLoading(false);
    })();
  }, []);

  return { roles, teams, user, loading };
}
