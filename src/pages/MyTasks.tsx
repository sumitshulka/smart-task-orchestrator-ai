
import React, { useState, useEffect, useMemo, useCallback } from "react";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { fetchTasks, Task, updateTask } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import TaskCard from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Image, Kanban, List } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useDrop, useDrag, DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

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
  // For normalized comparison (e.g., "In Progress" → "in progress")
  return status.trim().toLowerCase().replace(/_/g, " ");
};

export default function MyTasksPage() {
  const { user } = useSupabaseSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("list");
  const { users, teams } = useUsersAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const allTasks = await fetchTasks();
      setTasks(allTasks.filter((t) => t.assigned_to === user.id));
    } catch (err: any) {
      toast({ title: "Failed to load tasks", description: err.message });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user?.id]);

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

  // Allow delete for new/pending statuses
  function canDelete(status: string) {
    const skey = getStatusKey(status);
    return skey === "pending" || skey === "new";
  }

  // Kanban drag-n-drop
  // React DnD item type
  const CARD_TYPE = "TASK_CARD";

  // For consistent column ordering (by status sequence)
  const sortedStatusKeys = useMemo(
    () =>
      statuses
        .slice()
        .sort((a, b) => a.sequence_order - b.sequence_order)
        .map((s) => getStatusKey(s.name)),
    [statuses]
  );

  // Drop target for Kanban columns
  const KanbanColumn = ({ statusKey, statusLabel, children, canDropHandler }: any) => {
    // Accept drops for this column/status
    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: CARD_TYPE,
      canDrop: (item: { id: string; status: string }) =>
        getStatusKey(item.status) !== statusKey,
      drop: (item: { id: string; status: string }) => {
        handleTaskDrop(item.id, statusKey);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    });

    return (
      <div
        ref={dropRef}
        className={`
          min-w-[320px] rounded-lg p-4 shadow-md transition-all
          ${KANBAN_COLORS[statusKey] || "bg-slate-50"}
          ${isOver && canDrop ? "ring-2 ring-primary" : ""}
        `}
      >
        <h3 className="font-semibold text-lg mb-4 capitalize">{statusLabel}</h3>
        <div className="flex flex-col gap-4 min-h-[40px]">
          {children}
        </div>
      </div>
    );
  };

  // Drag source: make task card draggable in Kanban mode
  function DraggableTaskCard({ task, onTaskUpdated, canDelete }: any) {
    const [{ isDragging }, dragRef] = useDrag({
      type: CARD_TYPE,
      item: { id: task.id, status: task.status },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });
    return (
      <div ref={dragRef} style={{ opacity: isDragging ? 0.5 : 1, cursor: "grab" }}>
        <TaskCard task={task} onTaskUpdated={onTaskUpdated} canDelete={canDelete} />
      </div>
    );
  }

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

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 py-8">
      <div className="flex w-full items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold flex-shrink-0">My Tasks</h1>
        <div className="ml-auto flex gap-2">
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
        </div>
      </div>
      {(loading || statusesLoading) && (
        <div className="text-muted-foreground mb-4 text-center">Loading...</div>
      )}

      {!loading && !statusesLoading && tasks.length === 0 && (
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

      {!loading && !statusesLoading && tasks.length > 0 && view === "list" && (
        <div className="grid grid-cols-1 gap-6">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onTaskUpdated={load} canDelete={canDelete} />
          ))}
        </div>
      )}

      {!loading && !statusesLoading && view === "kanban" && (
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
                >
                  {tasksByStatus[statusKey] && tasksByStatus[statusKey].length > 0 ? (
                    tasksByStatus[statusKey].map((task) => (
                      <DraggableTaskCard
                        key={task.id}
                        task={task}
                        onTaskUpdated={load}
                        canDelete={canDelete}
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
    </div>
  );
}
