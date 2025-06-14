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
  assigned_user?: {
    email: string;
    user_name: string | null;
  } | null;
  actual_completion_date: string | null;
};

// -------- CRUD Functions --------

// Fetch all tasks visible to current user, including assigned user's email and name
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assigned_user:assigned_to (
        email,
        user_name
      )
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]).map(task => ({
    ...task,
    assigned_user: task.assigned_user || null,
    actual_completion_date: task.actual_completion_date ?? null,
  })) as Task[];
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
  let query = supabase
    .from("tasks")
    .select(`
      *,
      assigned_user:assigned_to (
        email,
        user_name
      )
    `, { count: "exact" })
    .order("created_at", { ascending: false });

  // Filtering: created_at
  if (input.fromDate || input.toDate) {
    if (input.fromDate && input.toDate) {
      query = query.gte("created_at", input.fromDate).lte("created_at", input.toDate);
    } else if (input.fromDate) {
      query = query.gte("created_at", input.fromDate);
    } else if (input.toDate) {
      query = query.lte("created_at", input.toDate);
    }
  }
  // Other filters
  if (input.assignedTo) query = query.eq("assigned_to", input.assignedTo);
  if (input.teamId) query = query.eq("team_id", input.teamId);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.priority && input.priority !== -1) query = query.eq("priority", input.priority);

  // Limiting
  if (typeof input.offset === "number" && typeof input.limit === "number") {
    query = query.range(input.offset, input.offset + input.limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return {
    tasks: (data as any[]).map(task => ({
      ...task,
      assigned_user: task.assigned_user || null,
      actual_completion_date: task.actual_completion_date ?? null,
    })) as Task[],
    total: count ?? 0,
  };
}
