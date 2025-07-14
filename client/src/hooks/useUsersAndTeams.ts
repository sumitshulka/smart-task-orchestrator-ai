
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Try to maintain the same shape as used in filters
export function useUsersAndTeams() {
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiClient.getUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: () => apiClient.getTeams(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { users, teams };
}
