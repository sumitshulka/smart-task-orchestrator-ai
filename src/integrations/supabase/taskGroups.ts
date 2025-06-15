
import { supabase } from "@/integrations/supabase/client";

// Types
export type TaskGroup = {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "managers_admin_only" | "all_team_members";
  owner_id: string;
  created_at: string;
  task_count?: number;
};

export type TaskGroupTask = {
  id: string;
  group_id: string;
  task_id: string;
};

export async function fetchTaskGroups(): Promise<TaskGroup[]> {
  // Counts tasks per group
  const { data, error } = await supabase
    .from("task_groups")
    .select("*, task_group_tasks:task_group_tasks(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]).map(g => ({
    ...g,
    task_count: g.task_group_tasks?.length ?? 0,
  }));
}

export async function createTaskGroup(input: Pick<TaskGroup, "name" | "description" | "visibility">): Promise<TaskGroup> {
  const { data, error } = await supabase
    .from("task_groups")
    .insert([input])
    .select("*")
    .single();
  if (error) throw error;
  return data as TaskGroup;
}

export async function deleteTaskGroup(id: string) {
  const { error } = await supabase
    .from("task_groups")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchTaskGroupDetails(groupId: string) {
  // Get group, with attached tasks and their statuses/titles
  const { data, error } = await supabase
    .from("task_groups")
    .select(`
      *,
      tasks:task_group_tasks(
        task:task_id (
          id, title, status, priority
        )
      )
    `)
    .eq("id", groupId)
    .single();
  if (error) throw error;
  return data;
}

// For use in Create task/subtask dropdown (with filtering on visibility if needed)
export async function fetchAssignableTaskGroups(): Promise<TaskGroup[]> {
  // You may want to add filtering on backend, but this gets all visible to the user
  return fetchTaskGroups();
}

// For assigning a task to a group
export async function assignTaskToGroup({ group_id, task_id }: { group_id: string; task_id: string }) {
  const { data, error } = await supabase
    .from("task_group_tasks")
    .insert([{ group_id, task_id }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
