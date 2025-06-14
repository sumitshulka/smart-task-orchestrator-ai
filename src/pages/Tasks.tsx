import React, { useState, useEffect, useMemo } from "react";
import { fetchTasks, deleteTask, Task } from "@/integrations/supabase/tasks";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import { format } from "date-fns";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Image } from "lucide-react";

const priorities = [
  { label: "All", value: "all" },
  { label: "High", value: "1" },
  { label: "Medium", value: "2" },
  { label: "Low", value: "3" },
];

const statuses = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

const fallbackImage =
  "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=400&q=80";

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, loading: sessionLoading } = useSupabaseSession();
  // filters
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (err: any) {
      toast({ title: "Failed to load tasks", description: err.message });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDeleteTask(id: string) {
    if (!window.confirm("Delete this task?")) return;
    setLoading(true);
    try {
      await deleteTask(id);
      load();
      toast({ title: "Task deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message });
    }
    setLoading(false);
  }

  // filtering logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const priorityPass =
        !priorityFilter || priorityFilter === "all" || String(task.priority) === priorityFilter;
      const statusPass = !statusFilter || statusFilter === "all" || task.status === statusFilter;
      return priorityPass && statusPass;
    });
  }, [tasks, priorityFilter, statusFilter]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="flex w-full items-center gap-4 mb-6">
        {/* Heading */}
        <h1 className="text-2xl font-bold flex-shrink-0">Tasks</h1>

        {/* Filters */}
        <div className="flex flex-1 justify-center gap-4">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger
              className="h-11 w-[160px] border-2 border-muted bg-background rounded-xl text-base font-semibold px-6 flex items-center"
            >
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="h-11 w-[160px] border-2 border-muted bg-background rounded-xl text-base font-semibold px-6 flex items-center"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Add Task button */}
        <div className="flex-shrink-0">
          <CreateTaskSheet onTaskCreated={load}>
            <Button className="h-11 px-8 rounded-xl text-lg font-semibold bg-[#0c1221] text-white hover:bg-[#202942] flex items-center">
              Add Task
            </Button>
          </CreateTaskSheet>
        </div>
      </div>

      {loading && (
        <div className="text-muted-foreground mb-4 text-center">Loading...</div>
      )}

      {!loading && filteredTasks.length === 0 && (
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

      {/* Grid layout update: now single card per row */}
      <div className="grid grid-cols-1 gap-6">
        {filteredTasks.map((task) => (
          <Card key={task.id} className="relative group transition hover:shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-lg truncate">
                  {task.title}
                </h2>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    task.priority === 1
                      ? "bg-red-100 text-red-700"
                      : task.priority === 2
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {task.priority === 1
                    ? "High"
                    : task.priority === 2
                    ? "Medium"
                    : "Low"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {task.description}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center md:gap-6 gap-2 text-sm">
                <div>
                  <span className="font-semibold">Status:</span>{" "}
                  <span className="capitalize">{task.status}</span>
                </div>
                <div>
                  <span className="font-semibold">Due:</span>{" "}
                  {task.due_date ? (
                    <span>
                      {format(new Date(task.due_date), "yyyy-MM-dd")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No due date</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Assigned To:</span>{" "}
                  {task.assigned_user
                    ? task.assigned_user.user_name ||
                      task.assigned_user.email
                    : task.assigned_to
                    ? `(${task.assigned_to})`
                    : "-"}
                </div>
                <div>
                  <span className="font-semibold">Created:</span>{" "}
                  {task.created_at
                    ? format(new Date(task.created_at), "yyyy-MM-dd HH:mm")
                    : "-"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition"
                onClick={() => handleDeleteTask(task.id)}
              >
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TasksPage;
