
import { supabase } from "@/integrations/supabase/client";

export type TaskActivity = {
  id: string;
  task_id: string;
  action_type: "created" | "status_changed" | "assigned" | "comment";
  old_value: string | null;
  new_value: string | null;
  acted_by: string | null; // User id
  created_at: string;
};

// Fetch activities (sorted by created_at asc)
export async function fetchTaskActivity(task_id: string): Promise<TaskActivity[]> {
  const { data, error } = await supabase
    .from("task_activity")
    .select("*")
    .eq("task_id", task_id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as TaskActivity[];
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
