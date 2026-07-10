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
  // Timer fields
  is_time_managed?: boolean;
  timer_state?: string; // 'stopped', 'running', 'paused'
  time_spent_minutes?: number;
  timer_started_at?: string | null;
  timer_session_data?: string | null;
  // NEW FIELDS from tasks_with_extras
  group_ids?: string[];           // array of group_ids this task belongs to (subtasks)
  is_dependent?: boolean;         // true if this task is a dependent
  // Project linkage
  project_id?: string | null;
  milestone_id?: string | null;
  feature_id?: string | null;
  // AI creation flag
  is_ai_created?: boolean;
  needs_cf_review?: boolean;
  task_number?: number | null;
  start_date?: string | null;
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

// Timer functions
export async function getActiveTimers(userId: string): Promise<Task[]> {
  const response = await fetch(`/api/users/${userId}/active-timers`, {
    headers: {
      'x-user-id': userId,
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch active timers');
  }
  return response.json();
}

export async function startTaskTimer(taskId: string, userId: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${taskId}/timer/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start timer');
  }
  return response.json();
}

export async function pauseTaskTimer(taskId: string, userId: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${taskId}/timer/pause`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to pause timer');
  }
  return response.json();
}

export async function stopTaskTimer(taskId: string, userId: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${taskId}/timer/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to stop timer');
  }
  return response.json();
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
  /**
   * When true, tasks that are overdue (due_date < today, not completed) are
   * always included regardless of the created_at date range filter.
   * This prevents overdue tasks from disappearing when they were created
   * outside the selected date window.
   */
  includeOverdue?: boolean;
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

  console.log(`[DEBUG] fetchTasksPaginated filters:`, {
    assignedTo: input.assignedTo,
    teamId: input.teamId,
    status: input.status,
    priority: input.priority,
    fromDate: input.fromDate,
    toDate: input.toDate
  });
  console.log(`[DEBUG] Total tasks before filtering:`, allTasks.length);

  // Apply filters
  if (input.assignedTo) {
    console.log(`[DEBUG] Filtering by assignedTo: ${input.assignedTo}`);
    filteredTasks = filteredTasks.filter(task => task.assigned_to === input.assignedTo);
    console.log(`[DEBUG] Tasks after assignedTo filter:`, filteredTasks.length);
  }
  if (input.teamId) {
    console.log(`[DEBUG] Filtering by teamId: ${input.teamId}`);
    filteredTasks = filteredTasks.filter(task => task.team_id === input.teamId);
    console.log(`[DEBUG] Tasks after teamId filter:`, filteredTasks.length);
  }
  if (input.status && input.status !== "all") {
    console.log(`[DEBUG] Filtering by status: ${input.status}`);
    filteredTasks = filteredTasks.filter(task => 
      task.status.toLowerCase().includes(input.status!.toLowerCase())
    );
    console.log(`[DEBUG] Tasks after status filter:`, filteredTasks.length);
  }
  if (input.priority && input.priority !== -1) {
    console.log(`[DEBUG] Filtering by priority: ${input.priority}`);
    filteredTasks = filteredTasks.filter(task => task.priority === input.priority);
    console.log(`[DEBUG] Tasks after priority filter:`, filteredTasks.length);
  }
  if (input.fromDate || input.toDate) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    filteredTasks = filteredTasks.filter(task => {
      const taskDate = new Date(task.created_at);
      const fromDate = input.fromDate ? new Date(input.fromDate) : null;
      const toDate = input.toDate ? new Date(input.toDate) : null;

      // When includeOverdue is true, bypass the date filter for any task that is
      // currently overdue (due_date < today) and not in a completed/closed state.
      // This prevents old-but-still-active overdue tasks from disappearing when
      // the user's selected date range doesn't cover their creation date.
      if (input.includeOverdue) {
        const isDone = ["completed", "done", "verified", "closed", "resolved"].includes(
          (task.status ?? "").toLowerCase()
        );
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isOverdue = dueDate !== null && dueDate < new Date();
        if (isOverdue && !isDone) return true;
      }

      if (fromDate && taskDate < fromDate) return false;
      if (toDate && taskDate > toDate) return false;
      return true;
    });
  }

  // Apply pagination
  const offset = input.offset || 0;
  const limit = input.limit || filteredTasks.length;
  const paginatedTasks = filteredTasks.slice(offset, offset + limit);

  console.log(`[DEBUG] Final filtered tasks:`, filteredTasks.length);
  console.log(`[DEBUG] Paginated tasks:`, paginatedTasks.length);

  return {
    tasks: paginatedTasks,
    total: filteredTasks.length,
  };
}
