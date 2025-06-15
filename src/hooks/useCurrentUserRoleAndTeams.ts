
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the current user's roles and teams from Supabase,
 * looks up the user's UUID from the "users" table based on email.
 */
export function useCurrentUserRoleAndTeams() {
  const [roles, setRoles] = useState<string[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setRoles([]);
      setTeams([]);
      setUser(null);

      // Step 1: Get auth session (grab email)
      const sessionData = await supabase.auth.getUser();
      const authUser = sessionData?.data?.user;
      if (!authUser || !authUser.email) {
        setLoading(false);
        return;
      }

      // Step 2: Look up user UUID from the `users` table using the email
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("email", authUser.email)
        .limit(1);

      const userRow = usersData?.[0];
      if (!userRow) {
        // User row not found!
        setLoading(false);
        setUser(null);
        setTeams([]);
        setRoles([]);
        return;
      }
      setUser(userRow); // user is now the user table row with id, email, etc.

      // Step 3: Fetch user roles (by UUID)
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("*, role:roles(name)")
        .eq("user_id", userRow.id);

      setRoles(userRolesData?.map((r: any) => r.role?.name).filter(Boolean) || []);

      // Step 4: Fetch team memberships (by UUID)
      const { data: memberships } = await supabase
        .from("team_memberships")
        .select("team_id, team:teams(*)")
        .eq("user_id", userRow.id);

      setTeams(memberships?.map((m: any) => m.team).filter(Boolean) || []);
      setLoading(false);
    })();
  }, []);

  return { roles, teams, user, loading };
}

