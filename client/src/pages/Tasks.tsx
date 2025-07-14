
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTasks, Task } from "@/integrations/supabase/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import TaskCard from "@/components/TaskCard";
import TaskDetailsSheet from "@/components/TaskDetailsSheet";
import EditTaskSheet from "@/components/EditTaskSheet";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { fetchTasksPaginated, FetchTasksInput } from "@/integrations/supabase/tasks";
import TasksList from "@/components/TasksList";
import TasksNoResults from "@/components/TasksNoResults";
import TasksPagination from "@/components/TasksPagination";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { format, startOfMonth, endOfMonth } from "date-fns";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

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
  const { session, user, loading: sessionLoading } = useSupabaseSession();
  const { users, teams } = useUsersAndTeams();
  const { roles, loading: rolesLoading } = useCurrentUserRoleAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Task Details Modal States
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [dateRange, setDateRange] = useState(defaultDateRange());
  const [preset, setPreset] = useState<string>("This Month");
  
  function handlePresetChange(range: { from: Date | null; to: Date | null }, p: string) {
    setPreset(p);
    if (p === "custom") return;
    setDateRange(range);
  }

  const filters = useMemo(() => ({
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
  }), [priorityFilter, statusFilter, userFilter, teamFilter, dateRange]);

  // Use React Query for tasks with stable key
  const { data: tasksResult, isLoading: loading, refetch: handleSearch } = useQuery({
    queryKey: ["/api/tasks", "paginated", page, pageSize, priorityFilter, statusFilter, userFilter, teamFilter, dateRange, user?.id],
    queryFn: async () => {
      if (!user) return { tasks: [], total: 0, showTooManyWarning: false };
      
      const fetchInput: FetchTasksInput = {
        // Map filter values to expected field names
        assignedTo: userFilter !== "all" ? userFilter : undefined,
        teamId: teamFilter !== "all" ? teamFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? parseInt(priorityFilter) : undefined,
        fromDate: dateRange.from ? dateRange.from.toISOString().split('T')[0] : undefined,
        toDate: dateRange.to ? dateRange.to.toISOString().split('T')[0] : undefined,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      };
      
      const result = await fetchTasksPaginated(fetchInput);
      return {
        tasks: result.tasks,
        total: result.total,
        showTooManyWarning: false
      };
    },
    enabled: !!user && !rolesLoading,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });

  const tasks = tasksResult?.tasks || [];
  const totalTasks = tasksResult?.total || 0;
  const showTooManyWarning = tasksResult?.showTooManyWarning || false;

  // Restrict delete to status 'pending' or 'new'
  function canDelete(status: string) {
    // Allow deletion for tasks in initial states (not started or in progress)
    return status === "New" || status === "backlog" || status === "planning";
  }

  // Task Details Modal Functions
  const openDetailsForTask = (task: Task) => {
    setEditOpen(false);
    setEditTask(null);
    setDetailsTask(task);
    setDetailsOpen(true);
  };

  const openEditForTask = (task: Task) => {
    setDetailsOpen(false);
    setDetailsTask(null);
    setEditTask(task);
    setEditOpen(true);
  };



  // --- Removed duplicate roles state and side-effect ---

  return (
    <div className="w-full p-4 mx-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Tasks</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
          </Button>
          <CreateTaskSheet onTaskCreated={handleSearch}>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          </CreateTaskSheet>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Search tasks by title, description, or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <h3 className="text-lg font-medium mb-4">Advanced Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Date Range */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <DateRangePresetSelector
                  dateRange={dateRange}
                  preset={preset}
                  onChange={handlePresetChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statuses.map(status => (
                      <SelectItem key={status.id} value={status.name}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Assigned To</label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.user_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Team</label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1">
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

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-16">
            <div className="w-40 h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
              <Search className="w-16 h-16 text-gray-400" />
            </div>
            <div className="text-muted-foreground text-lg mb-2">No tasks found</div>
            <div className="text-sm text-gray-500">Try adjusting your filters or search criteria</div>
          </div>
        )}

        {!loading && tasks.length > 0 && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Showing {tasks.length} of {totalTasks} tasks
            </div>
            <TasksList 
              tasks={tasks} 
              onTaskUpdated={handleSearch} 
              canDelete={canDelete} 
              statuses={statuses} 
              onOpenDetails={openDetailsForTask} 
            />
            <TasksPagination
              page={page}
              pageSize={pageSize}
              total={totalTasks}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={pageSizeOptions}
            />
          </>
        )}
      </div>

      {/* Task Details Modal */}
      <TaskDetailsSheet
        task={detailsTask}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        currentUser={user}
        onUpdated={handleSearch}
        onEdit={openEditForTask}
      />

      {/* Edit Task Modal */}
      <EditTaskSheet
        task={editTask}
        onUpdated={() => {
          setEditOpen(false);
          handleSearch();
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
};

export default TasksPage;
