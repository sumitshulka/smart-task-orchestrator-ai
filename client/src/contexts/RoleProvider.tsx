
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
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

      try {
        // Set user name from current user
        setUserName(user.user_name || user.email);

        // Fetch user roles from API
        const userRoles = await apiClient.getUserRoles(user.id);
        
        if (!userRoles || userRoles.length === 0) {
          // If no explicit roles, check if user is admin
          const userData = await apiClient.getUser(user.id);
          if (userData && userData.is_admin) {
            setHighestRole("admin");
          } else {
            setHighestRole("user"); // Default role
          }
          setLoading(false);
          return;
        }

        // Get role names and find highest priority
        const roles = await apiClient.getRoles();
        const userRoleIds = userRoles.map((ur: any) => ur.role_id);
        const roleNames: string[] = roles
          .filter((role: any) => userRoleIds.includes(role.id))
          .map((role: any) => role.name);

        let foundRole: HighestRole = null;
        for (const candidate of ROLE_PRIORITY) {
          if (roleNames.includes(candidate)) {
            foundRole = candidate;
            break;
          }
        }

        if (mounted) {
          setHighestRole(foundRole || "user");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user roles:", error);
        // Default to user role if there's an error
        if (mounted) {
          setHighestRole("user");
          setLoading(false);
        }
      }
    }

    fetchRoleAndName();
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <RoleContext.Provider value={{ highestRole, userName, loading }}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRole() {
  return useContext(RoleContext);
}
