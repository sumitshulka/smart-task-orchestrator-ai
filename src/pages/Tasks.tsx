
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
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { usePaginatedTasks } from "@/hooks/usePaginatedTasks"; // NEW HOOK
import TasksFiltersPanel from "@/components/TasksFiltersPanel"; // NEW COMPONENT

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
  // Use new hook for all main interactions
  const {
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
    filters,
    users,
    teams,
    roles,   // <-- FROM usePaginatedTasks
    user,
  } = usePaginatedTasks({ isHistorical: false, initialPageSize: 25 });
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  // New: allTasks for "latest" fallback
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  // Restrict delete to status 'pending' or 'new'
  function canDelete(status: string) {
    return status === "pending" || status === "new";
  }

  React.useEffect(() => {
    handleSearch();
    // eslint-disable-next-line
  }, [page, pageSize, filters.priorityFilter, filters.statusFilter, filters.userFilter, filters.teamFilter, filters.dateRange]);

  // --- Removed duplicate roles state and side-effect ---

  return (
    <div className="flex w-full max-w-6xl mx-auto px-4 py-8">
      {/* Sidebar filters */}
      <TasksFiltersPanel
        priorityFilter={filters.priorityFilter}
        setPriorityFilter={filters.setPriorityFilter}
        statusFilter={filters.statusFilter}
        setStatusFilter={filters.setStatusFilter}
        userFilter={filters.userFilter}
        setUserFilter={filters.setUserFilter}
        teamFilter={filters.teamFilter}
        setTeamFilter={filters.setTeamFilter}
        dateRange={filters.dateRange}
        setDateRange={filters.setDateRange}
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
            <CreateTaskSheet onTaskCreated={handleSearch}>
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

        {!loading && !showTooManyWarning && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-16">
            <img
              src={fallbackImage}
              alt="No tasks found"
              className="w-40 h-40 object-cover rounded-lg mb-4 shadow"
            />
            <div className="text-muted-foreground text-lg mb-2 flex items-center gap-2">
              <Image className="w-5 h-5" />
              {roles.includes("manager") || roles.includes("team_manager") ? (
                <>
                  No tasks are currently visible to you as a manager/team manager. <br />
                  You may not manage any users or teams with tasks right now.
                </>
              ) : (
                <>No tasks found.</>
              )}
            </div>
          </div>
        )}

        {!showTooManyWarning && tasks.length > 0 && (
          <TasksList tasks={tasks} onTaskUpdated={handleSearch} canDelete={canDelete} />
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

