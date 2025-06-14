
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Try to maintain the same shape as used in filters
export function useUsersAndTeams() {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      // Fetch users
      const { data: users } = await supabase
        .from("users")
        .select("id, email, user_name");
      setUsers(users || []);
      // Fetch teams
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name");
      setTeams(teams || []);
    })();
  }, []);
  return { users, teams };
}
