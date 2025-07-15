
import { useCallback, useEffect, useState } from "react";
import { fetchTaskActivity, createTaskActivity, TaskActivity } from "@/integrations/supabase/taskActivity";

export function useTaskActivity(task_id: string | null) {
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!task_id) {
      setActivity([]);
      return;
    }
    
    console.log("[DEBUG] Loading task activity for task:", task_id);
    setLoading(true);
    try {
      const logs = await fetchTaskActivity(task_id);
      console.log("[DEBUG] Task activity loaded:", logs);
      setActivity(logs);
    } catch (e) {
      console.error("[DEBUG] Error loading task activity:", e);
      setActivity([]);
    }
    setLoading(false);
  }, [task_id]);

  useEffect(() => {
    console.log("[DEBUG] useTaskActivity effect triggered for task:", task_id);
    load();
  }, [load, task_id]);

  return { activity, loading, reload: load, createTaskActivity };
}
