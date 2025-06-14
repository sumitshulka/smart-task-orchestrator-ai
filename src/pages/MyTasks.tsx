
import React, { useState, useEffect, useMemo } from "react";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { fetchTasks, Task } from "@/integrations/supabase/tasks";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import TaskCard from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Image, Kanban, List } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Pastel color classes for Kanban columns
const KANBAN_COLORS: Record<string, string> = {
  new: "bg-fuchsia-50",
  assigned: "bg-blue-50",
  "in progress": "bg-green-50",
  pending: "bg-yellow-50",
  completed: "bg-emerald-50",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  assigned: "Assigned",
  pending: "Pending",
  "in_progress": "In Progress",
  completed: "Completed",
};

const fallbackImage =
  "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=400&q=80";

export default function MyTasksPage() {
  const { user } = useSupabaseSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("list");
  const { users, teams } = useUsersAndTeams();

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
    tasks.forEach((task) => {
      const status = (task.status || "new").toLowerCase();
      if (!columns[status]) columns[status] = [];
      columns[status].push(task);
    });
    return columns;
  }, [tasks]);

  // Delete permission as in TasksPage
  function canDelete(status: string) {
    return status === "pending" || status === "new";
  }

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
      {loading && (
        <div className="text-muted-foreground mb-4 text-center">Loading...</div>
      )}

      {!loading && tasks.length === 0 && (
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

      {!loading && tasks.length > 0 && view === "list" && (
        <div className="grid grid-cols-1 gap-6">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onTaskUpdated={load} canDelete={canDelete} />
          ))}
        </div>
      )}

      {!loading && tasks.length > 0 && view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {Object.entries(tasksByStatus).map(([status, tsks]) => (
            <div
              key={status}
              className={`min-w-[320px] rounded-lg p-4 shadow-md ${KANBAN_COLORS[status] || "bg-slate-50"}`}
            >
              <h3 className="font-semibold text-lg mb-4 capitalize">{STATUS_LABELS[status] || status}</h3>
              <div className="flex flex-col gap-4">
                {tsks.map((task) => (
                  <TaskCard key={task.id} task={task} onTaskUpdated={load} canDelete={canDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
