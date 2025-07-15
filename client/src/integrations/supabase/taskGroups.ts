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
    const response = await fetch(`/api/task-groups/${groupId}/details`);
    if (!response.ok) {
      throw new Error(`Failed to fetch group details: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(`Failed to fetch group details: ${error.message}`);
  }
}

export async function fetchTaskGroupMembers(groupId: string) {
  try {
    const response = await fetch(`/api/task-groups/${groupId}/members`);
    if (!response.ok) {
      throw new Error(`Failed to fetch group members: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(`Failed to fetch group members: ${error.message}`);
  }
}

export async function addTaskGroupMember(groupId: string, userId: string, role: string = 'member') {
  try {
    const response = await fetch(`/api/task-groups/${groupId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ userId, role }),
    });
    if (!response.ok) {
      throw new Error(`Failed to add group member: ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(`Failed to add group member: ${error.message}`);
  }
}

export async function removeTaskGroupMember(groupId: string, userId: string) {
  try {
    const response = await fetch(`/api/task-groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to remove group member: ${response.statusText}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to remove group member: ${error.message}`);
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
