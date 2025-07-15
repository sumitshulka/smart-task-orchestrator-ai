
import { supabase } from "@/integrations/supabase/client";

export type TaskActivity = {
  id: string;
  task_id: string;
  action_type: "created" | "status_changed" | "assigned" | "assignment_changed" | "comment" | "edit" | "timer_started" | "timer_paused" | "timer_stopped" | "priority_changed" | "due_date_changed" | "title_changed" | "description_changed";
  old_value: string | null;
  new_value: string | null;
  acted_by: string | null; // User id
  created_at: string;
};

// Fetch activities (sorted by created_at asc)
export async function fetchTaskActivity(task_id: string): Promise<TaskActivity[]> {
  try {
    const response = await fetch(`/api/tasks/${task_id}/activity`);
    if (!response.ok) {
      throw new Error(`Failed to fetch task activity: ${response.statusText}`);
    }
    const data = await response.json();
    return data as TaskActivity[];
  } catch (error) {
    console.error("Error fetching task activity:", error);
    return [];
  }
}

// Create an activity log entry (status change, comment, or assignment)
export async function createTaskActivity(log: Omit<TaskActivity, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("task_activity")
    .insert([log])
    .select()
    .single();
  if (error) throw error;
  return data as TaskActivity;
}
