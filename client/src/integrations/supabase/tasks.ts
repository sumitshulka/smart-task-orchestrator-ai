import { apiClient } from "@/lib/api";

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
  assigned_user?: {
    email: string;
    user_name: string | null;
  } | null;
  actual_completion_date: string | null;
  // NEW FIELDS from tasks_with_extras
  group_ids?: string[];           // array of group_ids this task belongs to (subtasks)
  is_dependent?: boolean;         // true if this task is a dependent
};

// -------- CRUD Functions --------

// Fetch all tasks visible to current user, including assigned user's email and name
export async function fetchTasks(): Promise<Task[]> {
  const tasks = await apiClient.getTasks();
  return tasks.map((task: any) => ({
    ...task,
    assigned_user: task.assigned_user || null,
    actual_completion_date: task.actual_completion_date ?? null,
    group_ids: task.group_ids || [],
    is_dependent: !!task.is_dependent,
  }));
}

// Update: require created_by in new task input
export async function createTask(task: Omit<Task, "id" | "created_at" | "updated_at">) {
  return await apiClient.createTask(task);
}

// Update a task
export async function updateTask(id: string, updates: Partial<Task>) {
  return await apiClient.updateTask(id, updates);
}

// Delete a task
export async function deleteTask(id: string) {
  return await apiClient.deleteTask(id);
}

// New: Paginated and filterable fetch for tasks
export type FetchTasksInput = {
  fromDate?: string; // 'YYYY-MM-DD'
  toDate?: string;   // 'YYYY-MM-DD'
  assignedTo?: string; // user id
  teamId?: string;
  status?: string;
  priority?: number;
  offset?: number;
  limit?: number;
  // Add more filters as needed
};

export type FetchTasksResult = {
  tasks: Task[];
  total: number;
};

export async function fetchTasksPaginated(input: FetchTasksInput = {}): Promise<FetchTasksResult> {
  // For now, fetch all tasks and filter/paginate on client
  // In production, this should be implemented with server-side filtering
  const allTasks = await fetchTasks();
  let filteredTasks = allTasks;

  // Apply filters
  if (input.assignedTo) {
    filteredTasks = filteredTasks.filter(task => task.assigned_to === input.assignedTo);
  }
  if (input.teamId) {
    filteredTasks = filteredTasks.filter(task => task.team_id === input.teamId);
  }
  if (input.status && input.status !== "all") {
    filteredTasks = filteredTasks.filter(task => 
      task.status.toLowerCase().includes(input.status!.toLowerCase())
    );
  }
  if (input.priority && input.priority !== -1) {
    filteredTasks = filteredTasks.filter(task => task.priority === input.priority);
  }
  if (input.fromDate || input.toDate) {
    filteredTasks = filteredTasks.filter(task => {
      const taskDate = new Date(task.created_at);
      if (input.fromDate && taskDate < new Date(input.fromDate)) return false;
      if (input.toDate && taskDate > new Date(input.toDate)) return false;
      return true;
    });
  }

  // Apply pagination
  const offset = input.offset || 0;
  const limit = input.limit || filteredTasks.length;
  const paginatedTasks = filteredTasks.slice(offset, offset + limit);

  return {
    tasks: paginatedTasks,
    total: filteredTasks.length,
  };
}
