import React, { useState, useEffect, useMemo } from "react";
import { fetchTasks, Task } from "@/integrations/supabase/tasks";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import TaskCard from "@/components/TaskCard";
import { Image } from "lucide-react";
import TaskFiltersSidebar from "@/components/TaskFiltersSidebar";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { fetchTasksPaginated, FetchTasksInput } from "@/integrations/supabase/tasks";
import TasksList from "@/components/TasksList";
import TasksNoResults from "@/components/TasksNoResults";
import TasksPagination from "@/components/TasksPagination";

// Priorities filter dropdown
const priorities = [
  { label: "All", value: "all" },
  { label: "High", value: "1" },
  { label: "Medium", value: "2" },
  { label: "Low", value: "3" },
];

// Status filter dropdown
const statuses = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

// Add logic to filter/group by Task Group if needed (future extension)

const fallbackImage =
  "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=400&q=80";

const pageSizeOptions = [25, 50, 75, 100];

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user, loading: sessionLoading } = useSupabaseSession();
  // filters
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const { users, teams } = useUsersAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showTooManyWarning, setShowTooManyWarning] = useState(false);

  // New: allTasks for "latest" fallback
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  async function load(fetchAll: boolean = false) {
    setLoading(true);
    setShowTooManyWarning(false);

    // Prepare fetch input: default view only tasks from last 30 days
    const today = new Date();
    const fromDateObj = new Date(today);
    fromDateObj.setDate(today.getDate() - 30);

    // Set toDateObj as tomorrow for inclusive today
    const toDateObj = new Date(today);
    toDateObj.setDate(today.getDate() + 1); // tomorrow
    const fromDateStr = fromDateObj.toISOString().slice(0, 10);
    const toDateStr = toDateObj.toISOString().slice(0, 10);

    // Build filter query from current filters
    const input: FetchTasksInput = {
      fromDate: (fetchAll ? fromDateStr : fromDateStr),
      toDate: (fetchAll ? toDateStr : toDateStr),
      priority: (fetchAll || priorityFilter === "all") ? undefined : Number(priorityFilter),
      status: (fetchAll || statusFilter === "all") ? undefined : statusFilter,
      assignedTo: (fetchAll || userFilter === "all") ? undefined : userFilter,
      teamId: (fetchAll || teamFilter === "all") ? undefined : teamFilter,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };
    if (fetchAll) {
      // Remove date filter, just get last 30 days
      delete input.priority;
      delete input.status;
      delete input.assignedTo;
      delete input.teamId;
      // keep fromDate/toDate as last 30 days
    }
    console.log("[TASKS] Calling fetchTasksPaginated with input:", input);
    try {
      const { tasks, total } = await fetchTasksPaginated(input);
      if (fetchAll) {
        setAllTasks(tasks);
      } else {
        if (tasks.length) {
          setTasks(tasks);
          setTotalTasks(total);
        } else {
          setTasks([]);
          setTotalTasks(total);
        }
        if (total > 100) {
          setShowTooManyWarning(true);
          setTasks([]);
          setTotalTasks(total);
        }
      }
    } catch (err: any) {
      toast({ title: "Failed to load tasks", description: err.message });
      if (fetchAll) setAllTasks([]);
    }
    setLoading(false);
  }

  // Modified: load both filtered and unfiltered data if no result
  useEffect(() => {
    // Load filtered data
    load(false).then(() => {
      // Only fetch allTasks if filtered resulted in no tasks and not loading latest already
      if (!tasks.length && !loading) {
        load(true); // load latest tasks for fallback
      }
    });
    // eslint-disable-next-line
  }, [priorityFilter, statusFilter, userFilter, teamFilter, dateRange, page, pageSize]);

  // Restrict delete to status 'pending' or 'new'
  function canDelete(status: string) {
    return status === "pending" || status === "new";
  }

  // Filtering logic
  const filteredTasks = useMemo(() => {
    // Log all status filter values and all unique task.status values
    console.log("[DEBUG] Status filter available options:", statuses.map(s => s.name));
    console.log("[DEBUG] All statuses in fetched tasks:", Array.from(new Set(tasks.map(t => t.status))));

    // Only filter by dateRange if the user selected a range
    const result = tasks.filter((task) => {
      // Priority filter
      const priorityPass =
        !priorityFilter || priorityFilter === "all" || String(task.priority) === priorityFilter;
      // Status filter: compare case-insensitive, trimmed
      const statusPass =
        !statusFilter ||
        statusFilter === "all" ||
        (task.status && task.status.toLowerCase().trim() === statusFilter.toLowerCase().trim());
      // User filter
      const userPass =
        !userFilter || userFilter === "all" || (task.assigned_to && task.assigned_to === userFilter);
      // Team filter
      const teamPass =
        !teamFilter || teamFilter === "all" || (task.team_id && task.team_id === teamFilter);

      // Date filter: only if the user selected a custom range
      let datePass = true;
      if (dateRange.from && dateRange.to) {
        // task.created_at is string (ISO date)
        const createdDate = new Date(task.created_at);
        // To make the date range inclusive, compare using timestamp
        datePass = createdDate >= dateRange.from && createdDate <= dateRange.to;
      }
      return priorityPass && statusPass && userPass && teamPass && datePass;
    });
    console.log("[LOVABLE DEBUG][Tasks.tsx] Filtered Tasks:", result);
    return result;
  }, [tasks, priorityFilter, statusFilter, userFilter, teamFilter, dateRange, statuses]);
  
  return (
    <div className="flex w-full max-w-6xl mx-auto px-4 py-8">
      {/* Sidebar filters */}
      <TaskFiltersSidebar
        priorityFilter={priorityFilter}
        statusFilter={statusFilter}
        userFilter={userFilter}
        teamFilter={teamFilter}
        dateRange={dateRange}
        onPriorityChange={setPriorityFilter}
        onStatusChange={setStatusFilter}
        onUserChange={setUserFilter}
        onTeamChange={setTeamFilter}
        onDateRangeChange={setDateRange}
        users={users}
        teams={teams}
        statuses={statuses}
        statusesLoading={statusesLoading}
      />

      {/* Main content */}
      <div className="flex-1">
        <div className="flex w-full items-center gap-4 mb-6">
          {/* Heading */}
          <h1 className="text-2xl font-bold flex-shrink-0">Tasks</h1>
          {/* Add Task button */}
          <div className="ml-auto flex-shrink-0">
            <CreateTaskSheet onTaskCreated={load}>
              <Button className="h-11 px-8 rounded-xl text-lg font-semibold bg-[#0c1221] text-white hover:bg-[#202942] flex items-center">
                Add Task
              </Button>
            </CreateTaskSheet>
          </div>
        </div>

        {showTooManyWarning && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded mb-4 text-center">
            <strong>
              Too many results ({totalTasks}). Please refine your filters to narrow down the results. Only up to 100 can be loaded at a time.
            </strong>
          </div>
        )}

        {loading && (
          <div className="text-muted-foreground mb-4 text-center">Loading...</div>
        )}

        {!loading && !showTooManyWarning && filteredTasks.length === 0 && (
          <TasksNoResults allTasks={allTasks} onTaskUpdated={load} canDelete={canDelete} />
        )}

        {!showTooManyWarning && filteredTasks.length > 0 && (
          <TasksList tasks={filteredTasks} onTaskUpdated={load} canDelete={canDelete} />
        )}

        {!showTooManyWarning && (
          <TasksPagination
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalTasks={totalTasks}
            pageSizeOptions={pageSizeOptions}
          />
        )}
      </div>
    </div>
  );
};

export default TasksPage;

// Note: The main page is now much shorter! Core card logic is refactored to TaskCard.tsx.
