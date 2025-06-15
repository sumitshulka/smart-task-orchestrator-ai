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

// Helper to safely parse visibility
function parseVisibility(val: string): TaskGroup["visibility"] {
  if (val === "private" || val === "managers_admin_only" || val === "all_team_members") return val;
  return "private";
}

export async function fetchTaskGroups(): Promise<TaskGroup[]> {
  // Supabase types don't know about task_groups table, so use 'as any'
  const { data, error } = await supabase
    .from("task_groups" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) throw error || new Error("No data");

  // For each group, count tasks separately
  const groups: TaskGroup[] = await Promise.all(
    data.map(async (g: any) => {
      const { count } = await supabase
        .from("task_group_tasks" as any)
        .select("*", { count: "exact", head: true })
        .eq("group_id", g.id);
      return {
        ...g,
        task_count: count ?? 0,
      } as TaskGroup;
    })
  );
  return groups;
}

export async function createTaskGroup(input: Pick<TaskGroup, "name" | "description" | "visibility">): Promise<TaskGroup> {
  // Explicitly cast visibility to valid type
  const safeInput = {
    ...input,
    visibility: parseVisibility(input.visibility as string),
  };
  const { data, error } = await supabase
    .from("task_groups" as any)
    .insert([safeInput])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as TaskGroup;
}

export async function deleteTaskGroup(id: string) {
  const { error } = await supabase
    .from("task_groups" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchTaskGroupDetails(groupId: string) {
  // get the group itself
  const { data: group, error } = await supabase
    .from("task_groups" as any)
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;

  // get all attached tasks with details
  const { data: links } = await supabase
    .from("task_group_tasks" as any)
    .select("task_id")
    .eq("group_id", groupId);

  let tasks: any[] = [];
  if (links && links.length > 0) {
    const ids = links.map((l: any) => l.task_id);
    const { data: taskData } = await supabase
      .from("tasks")
      .select("id, title, status, priority")
      .in("id", ids);
    tasks = taskData ?? [];
  }

  return { ...(group || {}), tasks: Array.isArray(tasks) ? tasks.map(t => ({ task: t })) : [] };
}

// For use in Create task/subtask dropdown (with filtering on visibility if needed)
export async function fetchAssignableTaskGroups(): Promise<TaskGroup[]> {
  // Just get all visible to the user
  return fetchTaskGroups();
}

// For assigning a task to a group
export async function assignTaskToGroup({ group_id, task_id }: { group_id: string; task_id: string }) {
  const { data, error } = await supabase
    .from("task_group_tasks" as any)
    .insert([{ group_id, task_id }])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}
