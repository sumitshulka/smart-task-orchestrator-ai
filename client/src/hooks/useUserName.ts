import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Hook to get user name by ID
export function useUserName(userId: string | null | undefined) {
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiClient.getUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (!userId) return "Unassigned";
  
  const user = users.find((u: any) => u.id === userId);
  return user?.user_name || user?.email || "Unknown User";
}

// Hook to get multiple user names
export function useUserNames() {
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiClient.getUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getUserName = (userId: string | null | undefined) => {
    if (!userId) return "Unassigned";
    const user = users.find((u: any) => u.id === userId);
    return user?.user_name || user?.email || "Unknown User";
  };

  return { getUserName, users };
}