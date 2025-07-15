import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  role: {
    id: string;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
}

interface UseUserRolesResult {
  userRoles: Record<string, UserRole[]>;
  loading: boolean;
  error: string | null;
  refreshUserRoles: () => Promise<void>;
}

export const useUserRoles = (userIds: string[]): UseUserRolesResult => {
  const [userRoles, setUserRoles] = useState<Record<string, UserRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRoles = async () => {
    if (userIds.length === 0) {
      setUserRoles({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rolePromises = userIds.map(async (userId) => {
        try {
          const roles = await apiClient.getUserRoles(userId);
          return { userId, roles };
        } catch (err) {
          console.error(`Failed to fetch roles for user ${userId}:`, err);
          return { userId, roles: [] };
        }
      });

      const results = await Promise.all(rolePromises);
      const rolesMap: Record<string, UserRole[]> = {};
      
      results.forEach(({ userId, roles }) => {
        rolesMap[userId] = roles;
      });

      setUserRoles(rolesMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user roles');
      console.error('Error fetching user roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRoles();
  }, [userIds.join(',')]);

  return {
    userRoles,
    loading,
    error,
    refreshUserRoles: fetchUserRoles,
  };
};