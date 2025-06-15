
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
    .from("task_groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) throw new Error("No data");

  // For each group, count tasks separately
  const groups: TaskGroup[] = await Promise.all(
    data.map(async (g: any) => {
      const { count, error: countError } = await supabase
        .from("task_group_tasks")
        .select("*", { count: "exact", head: true })
        .eq("group_id", g.id);
      if (countError) throw countError;
      return {
        ...g,
        task_count: count ?? 0,
      } as TaskGroup;
    })
  );
  return groups;
}

export async function createTaskGroup(
  input: Pick<TaskGroup, "name" | "description" | "visibility">
): Promise<TaskGroup> {
  // Get user id for owner_id, fallback null for SSR
  let user_id = null;
  if (typeof window !== "undefined" && (window as any).supabase) {
    const { data: sessionData } = await (window as any).supabase.auth.getSession();
    user_id = sessionData.session?.user?.id ?? null;
  }
  // If user_id not found, just insert as is (frontend will catch error) -- real logic should set owner_id
  const insertObj: any = {
    ...input,
    visibility: parseVisibility(input.visibility as string),
    owner_id: user_id,
  };
  const { data, error } = await supabase
    .from("task_groups")
    .insert([insertObj])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Failed to create task group");
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
  // get the group itself
  const { data: group, error } = await supabase
    .from("task_groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw error;
  if (!group || typeof group !== "object") {
    throw new Error("Group not found or invalid group data.");
  }

  // get all attached tasks with details
  const { data: links } = await supabase
    .from("task_group_tasks")
    .select("task_id")
    .eq("group_id", groupId);

  let tasks: any[] = [];
  if (Array.isArray(links) && links.length > 0) {
    const ids = links.map((l: any) => l.task_id);
    const { data: taskData } = await supabase
      .from("tasks")
      .select("id, title, status, priority")
      .in("id", ids);
    tasks = taskData ?? [];
  }

  return {
    ...group,
    tasks: Array.isArray(tasks) ? tasks.map(t => ({ task: t })) : [],
  };
}

// For use in Create task/subtask dropdown (with filtering on visibility if needed)
export async function fetchAssignableTaskGroups(): Promise<TaskGroup[]> {
  // Just get all visible to the user
  return fetchTaskGroups();
}

// For assigning a task to a group
export async function assignTaskToGroup({ group_id, task_id }: { group_id: string; task_id: string }) {
  const { data, error } = await supabase
    .from("task_group_tasks")
    .insert([{ group_id, task_id }])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

