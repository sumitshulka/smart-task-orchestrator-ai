import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/**
 * Returns a Set of task IDs that are linked to at least one defect.
 * Used to render the "Defect Fix" badge on task cards across the app.
 */
export function useDefectTaskIds(): Set<string> {
  const { data = [] } = useQuery<string[]>({
    queryKey: ["/api/defect-task-ids"],
    queryFn: () => apiClient.get("/defect-task-ids"),
    staleTime: 30_000,
  });
  return new Set(data);
}
