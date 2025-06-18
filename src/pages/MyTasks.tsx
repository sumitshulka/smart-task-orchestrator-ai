
import React, { useState, useEffect, useMemo, useCallback } from "react";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { fetchTasks, Task, updateTask, fetchTasksPaginated, FetchTasksInput } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { Button } from "@/components/ui/button";
import { Image, Kanban, List, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
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
import TasksFiltersPanel from "@/components/TasksFiltersPanel";

// Pastel color classes for Kanban columns
const KANBAN_COLORS: Record<string, string> = {
  new: "bg-fuchsia-50",
  assigned: "bg-blue-50",
  "in progress": "bg-green-50",
  pending: "bg-yellow-50",
  completed: "bg-emerald-50",
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
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  const { users, teams } = useUsersAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  // Sheet (modal) state for Task Details
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      if (!user?.id) return setRoles([]);
      const { data, error } = await import("@/integrations/supabase/client").then(mod =>
        mod.supabase.from("user_roles").select("role:roles(name)").eq("user_id", user.id)
      );
      if (error) setRoles([]);
      else setRoles((data ?? []).map((r: any) => r.role?.name).filter(Boolean));
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
    
    // Use date range filters if provided, otherwise default to last 30 days to today
    if (dateRange.from && dateRange.to) {
      fromDateObj = new Date(dateRange.from);
      toDateObj = new Date(dateRange.to);
    } else {
      fromDateObj.setDate(today.getDate() - 30);
    }
    
    toDateObj.setDate(toDateObj.getDate() + 1); // Include current day
    const fromDateStr = fromDateObj.toISOString().slice(0, 10);
    const toDateStr = toDateObj.toISOString().slice(0, 10);

    const input: FetchTasksInput = {
      fromDate: fromDateStr,
      toDate: toDateStr,
      assignedTo: user.id,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };

    // Apply filters
    if (priorityFilter !== "all") input.priority = Number(priorityFilter);
    if (statusFilter !== "all") input.status = statusFilter;
    if (teamFilter !== "all") input.teamId = teamFilter;

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
  }, [user?.id, page, pageSize, priorityFilter, statusFilter, userFilter, teamFilter, dateRange]);

  // Grouped tasks for Kanban
  const tasksByStatus = useMemo(() => {
    const columns: Record<string, Task[]> = {};
    statuses.forEach(statusObj => {
      const key = getStatusKey(statusObj.name);
      columns[key] = [];
    });
    tasks.forEach((task) => {
      const key = getStatusKey(task.status || "new");
      if (!columns[key]) columns[key] = [];
      columns[key].push(task);
    });
    return columns;
  }, [tasks, statuses]);

  function canDelete(status: string) {
    const skey = getStatusKey(status);
    return skey === "pending" || skey === "new";
  }

  const CARD_TYPE = "TASK_CARD";
  const sortedStatusKeys = useMemo(
    () =>
      statuses
        .slice()
        .sort((a, b) => a.sequence_order - b.sequence_order)
        .map((s) => getStatusKey(s.name)),
    [statuses]
  );

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
    <div className="flex w-full max-w-7xl mx-auto px-4 py-8">
      {/* Filters Panel */}
      <TasksFiltersPanel
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        userFilter={userFilter}
        setUserFilter={setUserFilter}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        users={users}
        teams={teams}
        statuses={statuses}
        statusesLoading={statusesLoading}
      />

      {/* Main Content */}
      <div className="flex-1">
        <div className="flex w-full items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold flex-shrink-0">My Tasks</h1>
          <div className="ml-auto flex gap-2 items-center">
            <Button
              variant={view === "list" ? "default" : "outline"}
              className="px-3"
              onClick={() => setView("list")}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </Button>
            <Button
              variant={view === "kanban" ? "default" : "outline"}
              className="px-3"
              onClick={() => setView("kanban")}
            >
              <Kanban className="w-4 h-4 mr-1" />
              Kanban
            </Button>
            {user?.id && (
              <CreateTaskSheet
                onTaskCreated={load}
                defaultAssignedTo={user.id}
              >
                <Button variant="outline" className="flex items-center px-3">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Task
                </Button>
              </CreateTaskSheet>
            )}
          </div>
        </div>

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

        {!loading && !statusesLoading && !showTooManyWarning && tasks.length === 0 && (
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
                  You do not currently have access to any tasks as a manager or team manager. <br />
                  This may mean you do not manage any users, or none of your team members have tasks assigned.
                </>
              ) : (
                <>You have no tasks assigned.</>
              )}
            </div>
          </div>
        )}

        {!loading && !statusesLoading && !showTooManyWarning && tasks.length > 0 && view === "list" && (
          <div className="grid grid-cols-1 gap-6">
            {tasks.map((task) => (
              <TaskCardClickable
                key={task.id}
                task={task}
                onOpen={() => openDetailsForTask(task)}
                canDelete={canDelete}
                onTaskUpdated={load}
              />
            ))}
          </div>
        )}

        {!loading && !statusesLoading && !showTooManyWarning && view === "kanban" && (
          <DndProvider backend={HTML5Backend}>
            <div className="flex gap-4 overflow-x-auto pb-6">
              {sortedStatusKeys.map((statusKey) => {
                const statusObj = statuses.find(
                  (s) => getStatusKey(s.name) === statusKey
                );
                return (
                  <KanbanColumn
                    key={statusKey}
                    statusKey={statusKey}
                    statusLabel={statusObj ? statusObj.name : statusKey}
                    onDrop={onDropTask}
                    CARD_TYPE={CARD_TYPE}
                  >
                    {tasksByStatus[statusKey] && tasksByStatus[statusKey].length > 0 ? (
                      tasksByStatus[statusKey].map((task) => (
                        <KanbanTaskCard
                          key={task.id}
                          task={task}
                          CARD_TYPE={CARD_TYPE}
                          onClick={() => openDetailsForTask(task)}
                        />
                      ))
                    ) : (
                      <div className="text-muted-foreground text-sm py-4 text-center">
                        No tasks
                      </div>
                    )}
                  </KanbanColumn>
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
