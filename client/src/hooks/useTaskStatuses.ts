
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export type TaskStatus = {
  id: string;
  name: string;
  description: string | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
};

export type StatusTransition = {
  id: string;
  from_status: string;
  to_status: string;
  created_at: string;
};

export function useTaskStatuses() {
  const { data: statuses = [], isLoading: loading } = useQuery({
    queryKey: ['/api/task-statuses'],
    queryFn: () => apiClient.getTaskStatuses(),
  });

  return { statuses, loading, setStatuses: () => {} };
}

export function useStatusTransitions() {
  // For now, return empty array since we don't have this endpoint yet
  const transitions: StatusTransition[] = [];
  const loading = false;

  return { transitions, loading, setTransitions: () => {} };
}
