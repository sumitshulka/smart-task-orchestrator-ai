import type { FetchTasksInput } from "../integrations/supabase/tasks";

export type AdminTaskView = "mine" | "all";

export type BuildMyTasksInputOptions = {
  userId: string;
  isAdmin: boolean;
  adminTaskView: AdminTaskView;
  assigneeFilter: string;
  filters: Omit<FetchTasksInput, "assignedTo">;
};

/**
 * Build the task query for My Tasks without allowing an admin-only view to
 * weaken the assignment boundary for regular users.
 */
export function buildMyTasksInput({
  userId,
  isAdmin,
  adminTaskView,
  assigneeFilter,
  filters,
}: BuildMyTasksInputOptions): FetchTasksInput {
  const assignedTo =
    !isAdmin || adminTaskView === "mine"
      ? userId
      : assigneeFilter === "all"
        ? undefined
        : assigneeFilter;

  return {
    ...filters,
    assignedTo,
  };
}