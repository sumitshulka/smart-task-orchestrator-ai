
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export interface StatusStat {
  status: string;
  count: number;
}

export function useStatusStats(taskFilter: any) {
  const [statusStats, setStatusStats] = useState<StatusStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatusStats() {
      setLoading(true);
      try {
        // Get all tasks from API
        const allTasks = await apiClient.getTasks();
        let filteredTasks = allTasks;
        
        // Apply filter if provided
        if (taskFilter && taskFilter.column) {
          if (taskFilter.op === "in") {
            filteredTasks = allTasks.filter((task: any) => 
              taskFilter.value.includes(task[taskFilter.column])
            );
          } else if (taskFilter.op === "eq") {
            filteredTasks = allTasks.filter((task: any) => 
              task[taskFilter.column] === taskFilter.value
            );
          }
        }
        
        // Count status occurrences
        const statusCounts: Record<string, number> = {};
        for (const task of filteredTasks) {
          statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
        }
        
        setStatusStats(
          Object.entries(statusCounts).map(([status, count]) => ({ status, count }))
        );
      } catch (error) {
        console.error('Failed to fetch status stats:', error);
        setStatusStats([]);
      }
      setLoading(false);
    }
    fetchStatusStats();
  }, [JSON.stringify(taskFilter)]);

  return { statusStats, loading };
}
