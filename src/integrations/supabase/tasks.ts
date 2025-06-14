import { supabase } from "@/integrations/supabase/client";

// -------- Type Definitions --------
export type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: number | null;
  due_date: string | null;
  estimated_hours: number | null;
  status: string;
  type: string;
  created_by: string;
  assigned_to: string | null;
  team_id: string | null;
  created_at: string;
  updated_at: string;
};

// -------- CRUD Functions --------

// Fetch all tasks visible to current user
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Task[];
}

// Update: require created_by in new task input
export async function createTask(task: Omit<Task, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase
    .from("tasks")
    .insert([task])
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

// Update a task
export async function updateTask(id: string, updates: Partial<Task>) {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

// Delete a task
export async function deleteTask(id: string) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
