import React, { useState, useEffect, useMemo, useCallback } from "react";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { fetchTasks, Task, updateTask } from "@/integrations/supabase/tasks";
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
import { fetchTasksPaginated, FetchTasksInput } from "@/integrations/supabase/tasks";
import EditTaskSheet from "@/components/EditTaskSheet";

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

  // Debug log: Show current user state as soon as possible in function body
  console.log("[DEBUG][MyTasksPage] useSupabaseSession user:", user);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("list");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageSizeOptions = [25, 50, 75, 100];
  const [showTooManyWarning, setShowTooManyWarning] = useState(false);

  const { users, teams } = useUsersAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  // Sheet (modal) state for Task Details
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function load() {
    if (!user?.id) {
      console.log("[DEBUG][MyTasksPage] No user or user.id present in session state!", user);
      return;
    }
    setLoading(true);
    setShowTooManyWarning(false);

    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 30);

    // --- Modified section: set toDate as tomorrow's date (exclusive), to fully include all of today ---
    const toDateObj = new Date(today);
    toDateObj.setDate(today.getDate() + 1); // tomorrow
    const fromDateStr = fromDate.toISOString().slice(0, 10);
    const toDateStr = toDateObj.toISOString().slice(0, 10);

    const input: FetchTasksInput = {
      fromDate: fromDateStr,
      toDate: toDateStr,
      assignedTo: user.id,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };
    // Log which user id we're passing and their type
    console.log("[DEBUG][MyTasksPage] Fetching tasks for user.id:", user.id, typeof user.id);
    console.log("[DEBUG][MyTasksPage] Input to fetchTasksPaginated:", input);
    try {
      const { tasks, total } = await fetchTasksPaginated(input);
      // Log the raw result and total
      console.log("[DEBUG][MyTasksPage] fetchTasksPaginated response:", tasks, "Total:", total);

      // Print all assigned_to and created_by for all returned tasks for debugging assignment policy
      if (tasks.length) {
        tasks.slice(0, 5).forEach((task, idx) => {
          console.log(`[DEBUG][MyTasksPage] Task[${idx}]: id=${task.id} assigned_to=${task.assigned_to} created_by=${task.created_by} status=${task.status} title=${task.title}`)
        });
        const allAssigned = tasks.map(t => t.assigned_to);
        const allCreated = tasks.map(t => t.created_by);
        console.log("[DEBUG][MyTasksPage] All assigned_to:", allAssigned);
        console.log("[DEBUG][MyTasksPage] All created_by:", allCreated);
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
  }, [user?.id, page, pageSize]);

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

  // Handler to update task status on drop
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

  // Handler to pass to KanbanColumn
  const onDropTask = (item: { id: string; status: string }, statusKey: string) => {
    handleTaskDrop(item.id, statusKey);
  };

  // --- Sheet handler for details ---
  const openDetailsForTask = (task: Task) => {
    setEditOpen(false);
    setEditTask(null);
    setDetailsTask(task);
    setDetailsOpen(true);
  };
  // Handler to trigger edit (direct from "Edit" action)
  const openEditForTask = (task: Task) => {
    setDetailsOpen(false);
    setDetailsTask(null);
    setEditTask(task);
    setEditOpen(true);
  };

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 py-8">
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
            You have no tasks assigned.
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
              onEdit={() => openEditForTask(task)}
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
  );
}

// Note: This file is getting quite large. You should consider refactoring it for easier maintenance!
