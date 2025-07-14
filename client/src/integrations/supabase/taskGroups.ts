import { apiClient } from "@/lib/api";

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
  const groups = await apiClient.getTaskGroups();
  return groups.map((g: any) => ({
    ...g,
    task_count: 0, // TODO: implement task count in API
  }));
}

export async function createTaskGroup(
  input: Pick<TaskGroup, "name" | "description" | "visibility">
): Promise<TaskGroup> {
  // For now, use a mock user ID
  // In production, this would come from the authenticated user context
  const groupData = {
    ...input,
    visibility: parseVisibility(input.visibility as string),
    owner_id: '12345678-1234-5678-9012-123456789012', // Mock user ID
  };
  return await apiClient.createTaskGroup(groupData);
}

export async function deleteTaskGroup(id: string) {
  return await apiClient.deleteTaskGroup(id);
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
