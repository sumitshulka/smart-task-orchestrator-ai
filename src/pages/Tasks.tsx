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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { fetchTasksPaginated, FetchTasksInput } from "@/integrations/supabase/tasks";

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

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showTooManyWarning, setShowTooManyWarning] = useState(false);

  async function load() {
    setLoading(true);
    setShowTooManyWarning(false);

    // Prepare fetch input: default view only tasks from last 30 days
    const today = new Date();
    const fromDateObj = new Date(today);
    fromDateObj.setDate(today.getDate() - 30);

    // --- CHANGED SECTION: set toDateObj as tomorrow for inclusive today ---
    const toDateObj = new Date(today);
    toDateObj.setDate(today.getDate() + 1); // tomorrow
    const fromDateStr = fromDateObj.toISOString().slice(0, 10);
    const toDateStr = toDateObj.toISOString().slice(0, 10);

    // Build filter query from current filters
    const input: FetchTasksInput = {
      fromDate: fromDateStr,
      toDate: toDateStr,
      priority: priorityFilter === "all" ? undefined : Number(priorityFilter),
      status: statusFilter === "all" ? undefined : statusFilter,
      assignedTo: userFilter === "all" ? undefined : userFilter,
      teamId: teamFilter === "all" ? undefined : teamFilter,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };
    console.log("[TASKS] Calling fetchTasksPaginated with input:", input);
    try {
      const { tasks, total } = await fetchTasksPaginated(input);
      console.log("[TASKS] fetchTasksPaginated response:", tasks, "Total:", total);
      // Print first 5 tasks for manual inspection
      if (tasks.length) {
        console.log("[TASKS] Example task:", tasks[0]);
        // Print all assigned_to user ids to check type
        console.log("[TASKS] All assigned_to:", tasks.map(t => t.assigned_to));
      }
      if (total > 100) {
        setShowTooManyWarning(true);
        setTasks([]);
        setTotalTasks(total);
      } else {
        setTasks(tasks);
        setTotalTasks(total);
      }
    } catch (err: any) {
      toast({ title: "Failed to load tasks", description: err.message });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [priorityFilter, statusFilter, userFilter, teamFilter, dateRange, page, pageSize]);

  // Restrict delete to status 'pending' or 'new'
  function canDelete(status: string) {
    return status === "pending" || status === "new";
  }

  // Filtering logic
  const filteredTasks = useMemo(() => {
    console.log("[LOVABLE DEBUG][Tasks.tsx] Raw Tasks:", tasks);
    // Only filter by dateRange if the user selected a range
    const result = tasks.filter((task) => {
      // Priority filter
      const priorityPass =
        !priorityFilter || priorityFilter === "all" || String(task.priority) === priorityFilter;
      // Status filter
      const statusPass =
        !statusFilter || statusFilter === "all" || task.status === statusFilter;
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
  }, [tasks, priorityFilter, statusFilter, userFilter, teamFilter, dateRange]);

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
          <div className="flex flex-col items-center justify-center mt-16">
            <img
              src={fallbackImage}
              alt="No data found"
              className="w-40 h-40 object-cover rounded-lg mb-4 shadow"
            />
            <div className="text-muted-foreground text-lg mb-2 flex items-center gap-2">
              <Image className="w-5 h-5" />
              No tasks found.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {!showTooManyWarning &&
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onTaskUpdated={load} canDelete={canDelete} />
            ))}
        </div>
        {/* Pagination controls */}
        {!showTooManyWarning && totalTasks > pageSize && (
          <Pagination className="my-6">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(page > 1 ? page - 1 : 1)}
                  aria-disabled={page <= 1}
                />
              </PaginationItem>
              {Array.from(
                { length: Math.ceil(totalTasks / pageSize) },
                (_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      isActive={i + 1 === page}
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setPage(
                      page < Math.ceil(totalTasks / pageSize)
                        ? page + 1
                        : page
                    )
                  }
                  aria-disabled={page >= Math.ceil(totalTasks / pageSize)}
                />
              </PaginationItem>
            </PaginationContent>
            {/* Page size selector */}
            <div className="flex items-center gap-2 ml-8">
              <span className="text-sm">Rows per page:</span>
              <select
                className="border rounded px-2 text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
              >
                {pageSizeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </Pagination>
        )}
      </div>
    </div>
  );
};

export default TasksPage;

// Note: The main page is now much shorter! Core card logic is refactored to TaskCard.tsx.
