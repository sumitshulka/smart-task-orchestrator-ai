
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      let taskQuery = supabase.from("tasks").select("status");
      if (taskFilter && taskFilter.column) {
        if (taskFilter.op === "in") taskQuery = taskQuery.in(taskFilter.column, taskFilter.value);
        else if (taskFilter.op === "eq") taskQuery = taskQuery.eq(taskFilter.column, taskFilter.value);
      }
      // Use untyped data for simplicity
      const { data } = await taskQuery;
      const taskRows = Array.isArray(data) ? data : [];
      const statusCounts: Record<string, number> = {};
      for (const row of taskRows as any[]) {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      }
      setStatusStats(
        Object.entries(statusCounts).map(([status, count]) => ({ status, count }))
      );
      setLoading(false);
    }
    fetchStatusStats();
  }, [JSON.stringify(taskFilter)]);

  return { statusStats, loading };
}
