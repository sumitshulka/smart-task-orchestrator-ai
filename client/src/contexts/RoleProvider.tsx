
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import useSupabaseSession from "@/hooks/useSupabaseSession";

// Define priorities
const ROLE_PRIORITY = ["admin", "manager", "user"] as const;
type HighestRole = typeof ROLE_PRIORITY[number] | null;

type RoleContextType = {
  highestRole: HighestRole;
  userName: string;
  loading: boolean;
};

const RoleContext = createContext<RoleContextType>({
  highestRole: null,
  userName: "",
  loading: true,
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useSupabaseSession();
  const [highestRole, setHighestRole] = useState<HighestRole>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchRoleAndName() {
      setLoading(true);
      if (!user) {
        setHighestRole(null);
        setUserName("");
        setLoading(false);
        return;
      }

      // Use email to get user row in 'users' table
      const { data: userRows, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email)
        .limit(1);

      if (userError || !userRows || userRows.length === 0) {
        setHighestRole(null);
        setUserName(user.email || "");
        setLoading(false);
        return;
      }

      const dbUser = userRows[0];
      setUserName(dbUser.user_name || user.email);

      // Now fetch all roles for this user id
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role:roles(name)")
        .eq("user_id", dbUser.id);

      if (rolesError || !userRoles || userRoles.length === 0) {
        setHighestRole(null);
        setLoading(false);
        return;
      }

      // Find highest priority role
      const roleNames: string[] = userRoles.map((r: any) => r.role?.name).filter(Boolean);
      let foundRole: HighestRole = null;
      for (const candidate of ROLE_PRIORITY) {
        if (roleNames.includes(candidate)) {
          foundRole = candidate;
          break;
        }
      }
      setHighestRole(foundRole);
      setLoading(false);
    }

    fetchRoleAndName();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.id]);

  return (
    <RoleContext.Provider value={{ highestRole, userName, loading }}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRole() {
  return useContext(RoleContext);
}
