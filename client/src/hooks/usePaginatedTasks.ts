import { useState, useMemo, useCallback, useEffect } from "react";
import { fetchTasksPaginated, Task, FetchTasksInput } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

async function fetchManagerTasksPaginated(input: FetchTasksInput = {}): Promise<{ tasks: Task[]; total: number }> {
  // Fetch from the manager report view only!
  const { supabase } = await import("@/integrations/supabase/client");
  let query = supabase
    .from("tasks_manager_report_view")
    .select("*", { count: "exact" })
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
  if (input.assignedTo) query = query.eq("assignee_email", input.assignedTo);
  if (input.teamId) query = query.eq("team_id", input.teamId);
  // Fix status filtering with case-insensitive comparison
  if (input.status && input.status !== "all") {
    query = query.ilike("status", input.status);
  }
  if (input.priority && input.priority !== -1) query = query.eq("priority", input.priority);

  // Limiting
  if (typeof input.offset === "number" && typeof input.limit === "number") {
    query = query.range(input.offset, input.offset + input.limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  // Remap to Task[]
  const tasks = (data as any[]).map(row => ({
    ...row,
    assigned_user: {
      user_name: row.assignee_name,
      email: row.assignee_email
    },
    assigned_to: row.assignee_email || null,
    actual_completion_date: row.actual_completion_date || null,
    group_ids: [],
    is_dependent: false,
    created_by: row.creator_email || null
  })) as Task[];

  return {
    tasks,
    total: count ?? 0,
  };
}

/**
 * Versatile paginated/queryable tasks logic (used for Tasks + HistoricalTasks)
 */
export function usePaginatedTasks(options: {
  isHistorical?: boolean;
  initialPageSize?: number;
}) {
  const { users, teams } = useUsersAndTeams();
  const { user } = useSupabaseSession();
  const { roles, teams: userTeams } = useCurrentUserRoleAndTeams();

  // Filters and pagination state
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  // Main paginated tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(options.initialPageSize ?? 25);
  const [showTooManyWarning, setShowTooManyWarning] = useState(false);
  const [searched, setSearched] = useState(false);

  // Get user team_ids
  const userTeamIds = useMemo(() => {
    return (userTeams ?? []).map((t: any) => t.id);
  }, [userTeams]);

  // Role logic for what a "user" can see (Task[] -> Task[])
  function tasksVisibleToUser(tasksArr: Task[]) {
    if (!user || !roles?.length) return [];
    if (roles.includes("user") && !roles.some(r => ["admin", "manager", "team_manager"].includes(r))) {
      return tasksArr.filter(
        task =>
          (task.type === "personal" && task.assigned_to === user.id) ||
          (task.assigned_to === user.id) ||
          (task.type === "team" && userTeamIds.includes(task.team_id ?? ""))
      );
    }
    return tasksArr;
  }

  // Memoize roles to prevent unnecessary re-renders
  const stableRoles = useMemo(() => roles || [], [roles]);

  // Modified paginated search with stable dependencies
  const handleSearch = useCallback(async () => {
    setSearched(true);

    setLoading(true);
    setShowTooManyWarning(false);

    let input: FetchTasksInput = {
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    if (options.isHistorical) {
      // For historical tasks, ALWAYS filter by completed status and date
      if (statusFilter === "all") {
        input.status = "completed";
      }
      
      if (dateRange.from && dateRange.to) {
        input.fromDate = dateRange.from.toISOString().slice(0, 10);
        const endBoundary = new Date(dateRange.to);
        endBoundary.setHours(23, 59, 59, 999);
        input.toDate = endBoundary.toISOString().slice(0, 10);
      } else {
        // For historical tasks without date range, show tasks completed before 30 days ago
        input.toDate = thirtyDaysAgo.toISOString().slice(0, 10);
      }
    } else {
      if (!dateRange.from && !dateRange.to) {
        const fromDateObj = new Date(today);
        fromDateObj.setDate(today.getDate() - 30);
        fromDateObj.setHours(0, 0, 0, 0);
        const toDateObj = new Date(today);
        toDateObj.setHours(23, 59, 59, 999);
        input.fromDate = fromDateObj.toISOString().slice(0, 10);
        input.toDate = toDateObj.toISOString().slice(0, 10);
      } else if (dateRange.from && dateRange.to) {
        const fromDateObj = new Date(dateRange.from);
        fromDateObj.setHours(0, 0, 0, 0);
        const toDateObj = new Date(dateRange.to);
        toDateObj.setHours(23, 59, 59, 999);
        input.fromDate = fromDateObj.toISOString().slice(0, 10);
        input.toDate = toDateObj.toISOString().slice(0, 10);
      }
    }

    if (priorityFilter !== "all") input.priority = Number(priorityFilter);
    if (statusFilter !== "all") input.status = statusFilter;
    if (userFilter !== "all") input.assignedTo = userFilter;
    if (teamFilter !== "all") input.teamId = teamFilter;

    try {
      // MANAGERS/TEAM_MANAGERS use the new view!
      if (stableRoles.includes("manager") || stableRoles.includes("team_manager")) {
        const { tasks: fetchedTasks, total } = await fetchManagerTasksPaginated(input);
        if (total > 100) {
          setShowTooManyWarning(true);
          setTasks([]);
          setTotalTasks(total);
        } else {
          setTasks(fetchedTasks);
          setTotalTasks(fetchedTasks.length);
        }
      } else {
        // Normal logic for admins/users
        const { tasks: fetchedTasks, total } = await fetchTasksPaginated(input);
        if (total > 100) {
          setShowTooManyWarning(true);
          setTasks([]);
          setTotalTasks(total);
        } else {
          setTasks(fetchedTasks);
          setTotalTasks(fetchedTasks.length);
        }
      }
    } catch (err) {
      setTasks([]);
      setTotalTasks(0);
    }
    setLoading(false);
  }, [
    options.isHistorical,
    priorityFilter,
    statusFilter,
    userFilter,
    teamFilter,
    dateRange.from,
    dateRange.to,
    page,
    pageSize,
    stableRoles
  ]);

  // Only trigger on manual search, not automatically
  const [shouldAutoSearch, setShouldAutoSearch] = useState(false);
  
  useEffect(() => {
    if (shouldAutoSearch) {
      handleSearch();
      setShouldAutoSearch(false);
    }
  }, [shouldAutoSearch, handleSearch]);

  // Trigger search when filters change
  useEffect(() => {
    setShouldAutoSearch(true);
  }, [page, pageSize, priorityFilter, statusFilter, userFilter, teamFilter, dateRange.from, dateRange.to]);

  return {
    tasks,
    totalTasks,
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    showTooManyWarning,
    searched,
    handleSearch,
    filters: {
      priorityFilter,
      setPriorityFilter,
      statusFilter,
      setStatusFilter,
      userFilter,
      setUserFilter,
      teamFilter,
      setTeamFilter,
      dateRange,
      setDateRange,
    },
    users,
    teams,
    roles: stableRoles,
    user,
  };
}
