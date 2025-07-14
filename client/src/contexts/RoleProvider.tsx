
import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

  const totalLoading = rolesLoading || allRolesLoading;

  useEffect(() => {
    if (!user) {
      setHighestRole(null);
      setUserName("");
      setLoading(false);
      return;
    }

    // Set user name from current user
    setUserName(user.user_name || user.email);

    if (!totalLoading) {
      if (!userRolesData || userRolesData.length === 0) {
        // If no explicit roles, default to user role
        setHighestRole("user");
        setLoading(false);
        return;
      }

      // Map role_ids to role names
      const roleNames = userRolesData?.map((userRole: any) => {
        const role = allRoles.find((r: any) => r.id === userRole.role_id);
        return role?.name;
      }).filter(Boolean) || [];

      // Find highest priority role
      let foundRole: HighestRole = null;
      for (const candidate of ROLE_PRIORITY) {
        if (roleNames.includes(candidate)) {
          foundRole = candidate;
          break;
        }
      }

      setHighestRole(foundRole || "user");
      setLoading(false);
    }
  }, [user, userRolesData, allRoles, totalLoading]);

  return (
    <RoleContext.Provider value={{ highestRole, userName, loading }}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRole() {
  return useContext(RoleContext);
}
