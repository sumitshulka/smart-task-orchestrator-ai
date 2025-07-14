
import { useCallback, useEffect, useState } from "react";
import { fetchTaskActivity, createTaskActivity, TaskActivity } from "@/integrations/supabase/taskActivity";

export function useTaskActivity(task_id: string | null) {
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!task_id) return;
    setLoading(true);
    try {
      const logs = await fetchTaskActivity(task_id);
      setActivity(logs);
    } catch (e) {
      // Optionally log or handle errors
    }
    setLoading(false);
  }, [task_id]);

  useEffect(() => {
    load();
  }, [load, task_id]);

  return { activity, loading, reload: load, createTaskActivity };
}
