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
  try {
    // For now, use the API client to get basic group info
    // In a real implementation, this would fetch group details with associated tasks
    const groups = await apiClient.getTaskGroups();
    const group = groups.find((g: any) => g.id === groupId);
    
    if (!group) {
      throw new Error("Group not found.");
    }

    // For now, return empty tasks array since we don't have task-group associations in API yet
    // In a real implementation, this would fetch associated tasks via API
    return {
      ...group,
      tasks: [], // TODO: implement task-group associations in API
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch group details: ${error.message}`);
  }
}

// For use in Create task/subtask dropdown (with filtering on visibility if needed)
export async function fetchAssignableTaskGroups(): Promise<TaskGroup[]> {
  // Just get all visible to the user
  return fetchTaskGroups();
}

// For assigning a task to a group
export async function assignTaskToGroup({ group_id, task_id }: { group_id: string; task_id: string }) {
  // For now, use localStorage-based management
  // In a real implementation, this would create task-group associations via API
  try {
    // Simulate successful assignment
    return {
      id: Date.now().toString(),
      group_id,
      task_id,
      created_at: new Date().toISOString(),
    };
  } catch (error: any) {
    throw new Error(`Failed to assign task to group: ${error.message}`);
  }
}
