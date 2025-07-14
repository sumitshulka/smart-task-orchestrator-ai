
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export interface SimpleUser {
  id: string;
  user_name?: string | null;
  email: string;
}

export function useUserList() {
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await apiClient.getUsers();
        setUsers(data || []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      }
      setLoading(false);
    }
    
    fetchUsers();
  }, []);

  return { users, loading };
}
