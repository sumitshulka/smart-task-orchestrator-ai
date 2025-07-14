
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the current user's roles and teams from Supabase,
 * looks up the user's UUID from the "users" table based on email.
 * Logs debug statements at every stage.
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
      console.log("[useCurrentUserRoleAndTeams] Step 1: sessionData", sessionData);
      if (!authUser || !authUser.email) {
        console.warn("[useCurrentUserRoleAndTeams] No authenticated user found", { authUser });
        setLoading(false);
        return;
      }
      console.log("[useCurrentUserRoleAndTeams] Authenticated user:", authUser);

      // Step 2: Look up user UUID from the `users` table using the email
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("email", authUser.email)
        .limit(1);

      if (usersError) {
        console.error("[useCurrentUserRoleAndTeams] Error fetching from users table:", usersError);
      } else {
        console.log("[useCurrentUserRoleAndTeams] Fetched user(s) from users table:", usersData);
      }

      const userRow = usersData?.[0];
      if (!userRow) {
        // User row not found!
        console.warn("[useCurrentUserRoleAndTeams] No user row found for email:", authUser.email);
        setLoading(false);
        setUser(null);
        setTeams([]);
        setRoles([]);
        return;
      }
      setUser(userRow); // user is now the user table row with id, email, etc.
      console.log("[useCurrentUserRoleAndTeams] Using userRow:", userRow);

      // Step 3: Fetch user roles (by UUID)
      const { data: userRolesData, error: userRolesError } = await supabase
        .from("user_roles")
        .select("*, role:roles(name)")
        .eq("user_id", userRow.id);

      if (userRolesError) {
        console.error("[useCurrentUserRoleAndTeams] Error fetching user_roles:", userRolesError);
      } else {
        console.log("[useCurrentUserRoleAndTeams] User roles data:", userRolesData);
      }

      setRoles(userRolesData?.map((r: any) => r.role?.name).filter(Boolean) || []);

      // Step 4: Fetch team memberships (by UUID)
      const { data: memberships, error: membershipsError } = await supabase
        .from("team_memberships")
        .select("team_id, team:teams(*), role_within_team")
        .eq("user_id", userRow.id);

      if (membershipsError) {
        console.error("[useCurrentUserRoleAndTeams] Error fetching team_memberships:", membershipsError);
      } else {
        console.log("[useCurrentUserRoleAndTeams] Team memberships data:", memberships);
      }

      const filteredTeams = memberships?.map((m: any) => m.team).filter(Boolean) || [];
      console.log("[useCurrentUserRoleAndTeams] Final teams for user:", filteredTeams);

      setTeams(filteredTeams);
      setLoading(false);
    })();
  }, []);

  return { roles, teams, user, loading };
}

