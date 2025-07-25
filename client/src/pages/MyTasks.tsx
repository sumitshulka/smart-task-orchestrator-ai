
import React, { useState, useEffect, useMemo, useCallback } from "react";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { fetchTasks, Task, updateTask, fetchTasksPaginated, FetchTasksInput } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search, Kanban, List, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useStatusTransitionValidation } from "@/hooks/useStatusTransitionValidation";
import { useDrop, useDrag, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import TaskDetailsSheet from "@/components/TaskDetailsSheet";
import TaskCard from "@/components/TaskCard";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import KanbanColumn from "./MyTasks/KanbanColumn";
import KanbanTaskCard from "./MyTasks/KanbanTaskCard";
import TaskCardClickable from "./MyTasks/TaskCardClickable";
import TasksPagination from "@/components/TasksPagination";
import EditTaskSheet from "@/components/EditTaskSheet";
import { apiClient } from "@/lib/api";
import { format, startOfMonth, endOfMonth } from "date-fns";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";
import ActiveTimersBar from "@/components/ActiveTimersBar";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

// Professional Kanban column styling with card backgrounds
const KANBAN_STYLES: Record<string, { bg: string; header: string; count: string; cardBg: string; cardBorder: string }> = {
  // Core task statuses
  backlog: {
    bg: "bg-gray-50/50",
    header: "text-gray-700 bg-gray-100/80 border-gray-200",
    count: "bg-gray-200 text-gray-700",
    cardBg: "bg-gray-50/40",
    cardBorder: "border-gray-100 hover:border-gray-200"
  },
  "in progress": {
    bg: "bg-blue-50/30",
    header: "text-blue-700 bg-blue-100/60 border-blue-200",
    count: "bg-blue-200 text-blue-700",
    cardBg: "bg-blue-50/40",
    cardBorder: "border-blue-100 hover:border-blue-200"
  }, 
  in_progress: {
    bg: "bg-blue-50/30",
    header: "text-blue-700 bg-blue-100/60 border-blue-200",
    count: "bg-blue-200 text-blue-700",
    cardBg: "bg-blue-50/40",
    cardBorder: "border-blue-100 hover:border-blue-200"
  },
  review: {
    bg: "bg-orange-50/30",
    header: "text-orange-700 bg-orange-100/60 border-orange-200",
    count: "bg-orange-200 text-orange-700",
    cardBg: "bg-orange-50/40",
    cardBorder: "border-orange-100 hover:border-orange-200"
  },
  completed: {
    bg: "bg-green-50/30",
    header: "text-green-700 bg-green-100/60 border-green-200",
    count: "bg-green-200 text-green-700",
    cardBg: "bg-green-50/40",
    cardBorder: "border-green-100 hover:border-green-200"
  },
  
  // Legacy statuses (for backward compatibility)
  new: {
    bg: "bg-purple-50/30",
    header: "text-purple-700 bg-purple-100/60 border-purple-200",
    count: "bg-purple-200 text-purple-700",
    cardBg: "bg-purple-50/40",
    cardBorder: "border-purple-100 hover:border-purple-200"
  },
  assigned: {
    bg: "bg-cyan-50/30",
    header: "text-cyan-700 bg-cyan-100/60 border-cyan-200",
    count: "bg-cyan-200 text-cyan-700",
    cardBg: "bg-cyan-50/40",
    cardBorder: "border-cyan-100 hover:border-cyan-200"
  },
  pending: {
    bg: "bg-yellow-50/30",
    header: "text-yellow-700 bg-yellow-100/60 border-yellow-200",
    count: "bg-yellow-200 text-yellow-700",
    cardBg: "bg-yellow-50/40",
    cardBorder: "border-yellow-100 hover:border-yellow-200"
  },
  planning: {
    bg: "bg-indigo-50/30",
    header: "text-indigo-700 bg-indigo-100/60 border-indigo-200",
    count: "bg-indigo-200 text-indigo-700",
    cardBg: "bg-indigo-50/40",
    cardBorder: "border-indigo-100 hover:border-indigo-200"
  },
};

// Helper function to convert hex color to RGB values
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Generate much lighter card background colors (2-3 shades lighter)
const getLighterCardColor = (statusColor: string | undefined) => {
  const color = statusColor || "#6b7280";
  const rgb = hexToRgb(color);
  
  if (!rgb) {
    return {
      backgroundColor: `rgba(107, 114, 128, 0.08)`, // Very light gray fallback
      borderColor: `rgba(107, 114, 128, 0.15)`
    };
  }

  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`, // Very light - 2-3 shades lighter
    borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` // Subtle border
  };
};

// Generate dynamic styles based on status color
const getStatusStyleFromColor = (statusColor: string | undefined) => {
  const color = statusColor || "#6b7280";
  const rgb = hexToRgb(color);
  
  if (!rgb) {
    return {
      bg: "bg-neutral-50/30",
      header: "text-neutral-700 bg-neutral-100/60 border-neutral-200",
      count: "bg-neutral-200 text-neutral-700",
      cardBg: "bg-neutral-50/40",
      cardBorder: "border-neutral-100 hover:border-neutral-200",
      customStyles: {},
      cardCustomStyles: getLighterCardColor(statusColor)
    };
  }

  return {
    bg: "bg-transparent",
    header: "text-white border-transparent",
    count: "text-white",
    cardBg: "bg-transparent",
    cardBorder: "border-transparent hover:border-gray-300",
    customStyles: {
      bg: { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` },
      header: { 
        backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
        color: color,
        borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`
      },
      count: { 
        backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`,
        color: color
      }
    },
    cardCustomStyles: getLighterCardColor(statusColor)
  };
};

// Helper function to get styling with fallback that uses status colors
const getStatusStyle = (statusKey: string, statusColor?: string) => {
  // First try to use the dynamic color-based styling
  if (statusColor) {
    return getStatusStyleFromColor(statusColor);
  }
  
  // Fallback to hardcoded styles for backward compatibility
  return KANBAN_STYLES[statusKey] || KANBAN_STYLES[statusKey.replace(/\s+/g, "_")] || {
    bg: "bg-neutral-50/30",
    header: "text-neutral-700 bg-neutral-100/60 border-neutral-200",
    count: "bg-neutral-200 text-neutral-700",
    cardBg: "bg-neutral-50/40",
    cardBorder: "border-neutral-100 hover:border-neutral-200",
    cardCustomStyles: getLighterCardColor(undefined)
  };
};

const fallbackImage =
  "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=400&q=80";

const getStatusKey = (status: string) => {
  return status.trim().toLowerCase().replace(/_/g, " ");
};

export default function MyTasksPage() {
  const { user } = useSupabaseSession();
  console.log("[DEBUG][MyTasksPage] useSupabaseSession user:", user);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("list");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageSizeOptions = [25, 50, 75, 100];
  const [showTooManyWarning, setShowTooManyWarning] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState(defaultDateRange());
  const [preset, setPreset] = useState<string>("This Month");
  
  // Sort states
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  function handlePresetChange(range: { from: Date | null; to: Date | null }, p: string) {
    setPreset(p);
    if (p === "custom") return;
    setDateRange(range);
  }

  const { users, teams } = useUsersAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();
  const { getStatusSequence } = useStatusTransitionValidation();

  // Sheet (modal) state for Task Details
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      if (!user?.id) return setRoles([]);
      try {
        const userRoles = await apiClient.getUserRoles(user.id);
        const allRoles = await apiClient.getRoles();
        const userRoleIds = userRoles.map((ur: any) => ur.role_id);
        const roleNames = allRoles
          .filter((role: any) => userRoleIds.includes(role.id))
          .map((role: any) => role.name);
        setRoles(roleNames);
      } catch (error) {
        setRoles([]);
      }
    })();
  }, [user?.id]);

  async function load() {
    if (!user?.id) {
      console.log("[DEBUG][MyTasksPage] No user or user.id present in session state!", user);
      return;
    }
    setLoading(true);
    setShowTooManyWarning(false);

    const today = new Date();
    let fromDateObj = new Date(today);
    let toDateObj = new Date(today);
    
    // For admin users, use a much wider date range to show all tasks
    if (dateRange.from && dateRange.to) {
      fromDateObj = new Date(dateRange.from);
      toDateObj = new Date(dateRange.to);
    } else if (roles.includes("admin")) {
      // Admin sees all tasks - use very wide date range
      fromDateObj = new Date('2020-01-01');
      toDateObj = new Date();
      toDateObj.setDate(toDateObj.getDate() + 365); // Future tasks too
    } else {
      fromDateObj.setDate(today.getDate() - 30);
    }
    
    toDateObj.setDate(toDateObj.getDate() + 1); // Include current day
    const fromDateStr = fromDateObj.toISOString().slice(0, 10);
    const toDateStr = toDateObj.toISOString().slice(0, 10);

    const input: FetchTasksInput = {
      fromDate: fromDateStr,
      toDate: toDateStr,
      // Admin users should see all tasks, not just assigned ones
      assignedTo: roles.includes("admin") ? undefined : user.id,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };

    // Apply filters
    if (priorityFilter !== "all") input.priority = Number(priorityFilter);
    if (statusFilter !== "all") input.status = statusFilter;
    if (teamFilter !== "all") input.teamId = teamFilter;

    console.log("[DEBUG][MyTasksPage] User roles:", roles);
    console.log("[DEBUG][MyTasksPage] Is admin:", roles.includes("admin"));
    console.log("[DEBUG][MyTasksPage] Date range - from:", fromDateStr, "to:", toDateStr);
    console.log("[DEBUG][MyTasksPage] Fetching tasks for user.id:", user.id, typeof user.id);
    console.log("[DEBUG][MyTasksPage] Input to fetchTasksPaginated:", input);
    
    try {
      const { tasks, total } = await fetchTasksPaginated(input);
      console.log("[DEBUG][MyTasksPage] fetchTasksPaginated response:", tasks, "Total:", total);

      if (tasks.length) {
        tasks.slice(0, 5).forEach((task, idx) => {
          console.log(`[DEBUG][MyTasksPage] Task[${idx}]: id=${task.id} assigned_to=${task.assigned_to} created_by=${task.created_by} status=${task.status} title=${task.title}`)
        });
      } else {
        console.log("[DEBUG][MyTasksPage] No tasks returned from fetchTasksPaginated for user.id:", user.id);
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
      console.error("[DEBUG][MyTasksPage] Error in fetchTasksPaginated:", err);
      toast({ title: "Failed to load tasks", description: err.message });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user?.id, page, pageSize, priorityFilter, statusFilter, userFilter, teamFilter, dateRange, sortBy, sortOrder]);

  // Sort tasks based on selected criteria
  const sortedTasks = useMemo(() => {
    if (!tasks.length) return tasks;
    
    const sorted = [...tasks].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "priority":
          // Priority: 1 = High, 2 = Medium, 3 = Low
          comparison = (a.priority || 999) - (b.priority || 999);
          break;
        case "due_date":
          const aDate = a.due_date ? new Date(a.due_date) : new Date(8640000000000000); // Far future
          const bDate = b.due_date ? new Date(b.due_date) : new Date(8640000000000000);
          comparison = aDate.getTime() - bDate.getTime();
          break;
        case "estimated_hours":
          comparison = (a.estimated_hours || 0) - (b.estimated_hours || 0);
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "created_at":
        default:
          const aCreated = new Date(a.created_at);
          const bCreated = new Date(b.created_at);
          comparison = aCreated.getTime() - bCreated.getTime();
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [tasks, sortBy, sortOrder]);

  // Grouped tasks for Kanban
  const tasksByStatus = useMemo(() => {
    const columns: Record<string, Task[]> = {};
    statuses.forEach(statusObj => {
      const key = getStatusKey(statusObj.name);
      columns[key] = [];
    });
    sortedTasks.forEach((task) => {
      const key = getStatusKey(task.status || "new");
      if (!columns[key]) columns[key] = [];
      columns[key].push(task);
    });
    return columns;
  }, [sortedTasks, statuses]);

  function canDelete(status: string) {
    // Find the status object and check its can_delete property
    const statusObj = statuses.find(s => s.name === status);
    return statusObj?.can_delete || false;
  }

  const CARD_TYPE = "TASK_CARD";
  
  // Sort statuses based on transition workflow order
  const sortedStatusKeys = useMemo(() => {
    const transitionSequence = getStatusSequence();
    const statusMap = new Map(statuses.map(s => [s.name, s]));
    
    // Start with default status first
    const defaultStatus = statuses.find(s => s.is_default);
    const orderedStatuses: string[] = [];
    
    if (defaultStatus) {
      orderedStatuses.push(defaultStatus.name);
    }
    
    // Add statuses following the transition sequence
    transitionSequence.forEach(statusName => {
      if (statusMap.has(statusName) && !orderedStatuses.includes(statusName)) {
        orderedStatuses.push(statusName);
      }
    });
    
    // Add any remaining statuses alphabetically (for merging cases)
    const remainingStatuses = statuses
      .filter(s => !orderedStatuses.includes(s.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => s.name);
    
    orderedStatuses.push(...remainingStatuses);
    
    return orderedStatuses.map(name => getStatusKey(name));
  }, [statuses, getStatusSequence]);

  const handleTaskDrop = async (taskId: string, newStatusKey: string) => {
    const statusObj = statuses.find(
      (s) => getStatusKey(s.name) === newStatusKey
    );
    if (!statusObj) {
      toast({ title: "Invalid status" });
      return;
    }
    try {
      await updateTask(taskId, { status: statusObj.name });
      load();
      toast({
        title: "Status updated",
        description: `Task moved to "${statusObj.name}"`,
      });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message });
    }
  };

  const onDropTask = (item: { id: string; status: string }, statusKey: string) => {
    handleTaskDrop(item.id, statusKey);
  };

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

  return (
    <div className="w-full p-4 mx-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            List
          </Button>
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            onClick={() => setView("kanban")}
            className="gap-2"
          >
            <Kanban className="w-4 h-4" />
            Kanban
          </Button>
          <CreateTaskSheet onTaskCreated={load}>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          </CreateTaskSheet>
        </div>
      </div>

      {/* Active Timers Bar */}
      <ActiveTimersBar onTaskUpdated={load} />

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar and Sort Controls */}
        <div className="flex gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              placeholder="Search my tasks by title, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Sort Controls */}
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="estimated_hours">Effort (Hours)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-3"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {(loading || statusesLoading) && (
          <div className="text-muted-foreground mb-4 text-center">Loading...</div>
        )}

        {!loading && !statusesLoading && !showTooManyWarning && sortedTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-16">
            <div className="w-40 h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
              <Search className="w-16 h-16 text-gray-400" />
            </div>
            <div className="text-muted-foreground text-lg mb-2">No tasks found</div>
            <div className="text-sm text-gray-500">Try adjusting your filters or search criteria</div>
          </div>
        )}

            {!loading && !statusesLoading && !showTooManyWarning && sortedTasks.length > 0 && view === "list" && (
              <div className="grid grid-cols-1 gap-6">
                {sortedTasks.map((task) => {
                  const statusObj = statuses.find(s => getStatusKey(s.name) === getStatusKey(task.status));
                  return (
                    <TaskCardClickable
                      key={task.id}
                      task={task}
                      onOpen={() => openDetailsForTask(task)}
                      canDelete={canDelete}
                      onTaskUpdated={load}
                      statusColor={statusObj?.color}
                    />
                  );
                })}
              </div>
            )}

            {!loading && !statusesLoading && !showTooManyWarning && view === "kanban" && (
              <DndProvider backend={HTML5Backend}>
                <div className="flex gap-6 overflow-x-auto pb-8 px-2">
                  {sortedStatusKeys.map((statusKey, index) => {
                    const statusObj = statuses.find(
                      (s) => getStatusKey(s.name) === statusKey
                    );
                    return (
                      <React.Fragment key={statusKey}>
                        <KanbanColumn
                          statusKey={statusKey}
                          statusLabel={statusObj ? statusObj.name : statusKey}
                          onDrop={onDropTask}
                          CARD_TYPE={CARD_TYPE}
                          statusStyle={getStatusStyle(statusKey, statusObj?.color)}
                          taskCount={tasksByStatus[statusKey]?.length || 0}
                        >
                          {tasksByStatus[statusKey] && tasksByStatus[statusKey].length > 0 ? (
                            tasksByStatus[statusKey].map((task) => (
                              <KanbanTaskCard
                                key={task.id}
                                task={task}
                                CARD_TYPE={CARD_TYPE}
                                onClick={() => openDetailsForTask(task)}
                                statusColor={statusObj?.color}
                              />
                            ))
                          ) : (
                            <div className="text-muted-foreground text-sm py-4 text-center">
                              No tasks
                            </div>
                          )}
                        </KanbanColumn>
                        
                        {/* Vertical divider between columns */}
                        {index < sortedStatusKeys.length - 1 && (
                          <div className="flex items-stretch py-4 px-2">
                            <div className="w-px bg-gradient-to-b from-transparent via-gray-300/60 to-transparent min-h-[400px] flex-shrink-0" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </DndProvider>
            )}

            <TaskDetailsSheet
              task={detailsTask}
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              currentUser={user}
              onUpdated={load}
              onEdit={openEditForTask}
            />
            <EditTaskSheet
              task={editTask}
              onUpdated={() => {
                setEditOpen(false);
                load();
              }}
              open={editOpen}
              onOpenChange={setEditOpen}
            />
            {!showTooManyWarning && totalTasks > pageSize && view === "list" && (
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
  }
