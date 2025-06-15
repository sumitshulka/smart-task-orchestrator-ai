
import { useState, useMemo, useCallback } from "react";
import { fetchTasksPaginated, Task, FetchTasksInput } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

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

  // Paginated search
  const handleSearch = useCallback(async () => {
    setSearched(true);

    // For historical: block search if no filters set
    if (
      options.isHistorical &&
      priorityFilter === "all" &&
      statusFilter === "all" &&
      userFilter === "all" &&
      teamFilter === "all" &&
      (!dateRange.from || !dateRange.to)
    ) {
      setTasks([]);
      setTotalTasks(0);
      return;
    }

    setLoading(true);
    setShowTooManyWarning(false);

    let input: FetchTasksInput = {
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // --- Fix: use endOfDay for filter boundaries ---
    if (options.isHistorical) {
      if (dateRange.from && dateRange.to) {
        input.fromDate = dateRange.from.toISOString().slice(0, 10);
        // Always use endOfDay for filter upper bound
        const endBoundary = new Date(dateRange.to);
        endBoundary.setHours(23, 59, 59, 999);
        input.toDate = endBoundary.toISOString().slice(0, 10);
      } else {
        const endBoundary = new Date(thirtyDaysAgo);
        endBoundary.setHours(23, 59, 59, 999);
        input.toDate = endBoundary.toISOString().slice(0, 10);
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
      const { tasks: fetchedTasks, total } = await fetchTasksPaginated(input);
      let visibleTasks: Task[];
      if (roles && roles.includes("user") && !roles.some(r => ["admin", "manager", "team_manager"].includes(r))) {
        visibleTasks = tasksVisibleToUser(fetchedTasks);
      } else {
        visibleTasks = fetchedTasks;
      }
      if (total > 100) {
        setShowTooManyWarning(true);
        setTasks([]);
        setTotalTasks(total);
      } else {
        setTasks(visibleTasks);
        setTotalTasks(visibleTasks.length);
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
    dateRange,
    page,
    pageSize,
    roles,
    user,
    userTeamIds,
  ]);

  // Auto re-search on paginate/filter change once search done
  // New search pattern: run search when a dependency changes, if "searched"
  // Not for first render
  // The page can control when handleSearch is run
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
    roles,
    user,
  };
}
