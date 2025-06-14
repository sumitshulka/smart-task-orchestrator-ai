import React, { useState, useEffect, useMemo } from "react";
import { fetchTasks, deleteTask, updateTask, Task } from "@/integrations/supabase/tasks";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import EditTaskSheet from "@/components/EditTaskSheet";
import { format } from "date-fns";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Image, Edit, Trash2, Check } from "lucide-react";
import TaskFiltersSidebar from "@/components/TaskFiltersSidebar";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";

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
  const [userFilter, setUserFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const { users, teams } = useUsersAndTeams();

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

  // Mark Complete function
  async function handleCompleteTask(task: Task) {
    if (task.status === "completed") {
      toast({ title: "Task is already completed" });
      return;
    }
    try {
      await updateTask(task.id, {
        status: "completed",
        actual_completion_date: new Date().toISOString().slice(0, 10),
      });
      load();
      toast({ title: "Task marked as completed" });
    } catch (err: any) {
      toast({ title: "Completion failed", description: err.message });
    }
  }

  // Restrict delete to status 'pending' or 'new'
  function canDelete(status: string) {
    return status === "pending" || status === "new";
  }

  // new filtering logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Priority filter
      const priorityPass = !priorityFilter || priorityFilter === "all" || String(task.priority) === priorityFilter;
      // Status filter
      const statusPass = !statusFilter || statusFilter === "all" || task.status === statusFilter;
      // User filter
      const userPass = !userFilter || userFilter === "all" || (task.assigned_to && task.assigned_to === userFilter);
      // Team filter
      const teamPass = !teamFilter || teamFilter === "all" || (task.team_id && task.team_id === teamFilter);
      // Date filter (created_at)
      let datePass = true;
      if (dateRange.from && dateRange.to) {
        const createdDate = new Date(task.created_at);
        datePass = createdDate >= dateRange.from && createdDate <= dateRange.to;
      }
      return priorityPass && statusPass && userPass && teamPass && datePass;
    });
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

        {/* Grid layout: single card per row */}
        <div className="grid grid-cols-1 gap-6">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="relative group transition hover:shadow-lg">
              {/* TOP CENTER ICONS */}
              <div className="absolute left-1/2 top-2 -translate-x-1/2 z-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                {/* Edit icon */}
                <EditTaskSheet task={task} onUpdated={load}>
                  <Button size="icon" variant="ghost" className="text-gray-400 hover:text-blue-600" title="Edit Task">
                    <Edit size={20} />
                  </Button>
                </EditTaskSheet>

                {/* Delete icon */}
                <Button
                  size="icon"
                  variant="ghost"
                  className={`text-gray-400 ${canDelete(task.status) ? "hover:text-red-600" : "opacity-60 cursor-not-allowed"}`}
                  title={canDelete(task.status) ? "Delete Task" : "Can only delete New or Pending tasks"}
                  onClick={() => canDelete(task.status) && handleDeleteTask(task.id)}
                  disabled={!canDelete(task.status)}
                >
                  <Trash2 size={20} />
                </Button>

                {/* Complete icon */}
                <Button
                  size="icon"
                  variant="ghost"
                  className={`text-gray-400 hover:text-green-700`}
                  title={task.status === "completed" ? "Already completed" : "Mark as Complete"}
                  onClick={() => handleCompleteTask(task)}
                  disabled={task.status === "completed"}
                >
                  <Check size={20} />
                </Button>
              </div>
              {/* Card Header and Content */}
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
                        {task.due_date}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No due date</span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold">Created:</span>{" "}
                    {task.created_at
                      ? task.created_at.slice(0, 10)
                      : "-"}
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
                  {task.status === "completed" && task.actual_completion_date && (
                    <div>
                      <span className="font-semibold">Completion Date:</span>{" "}
                      {task.actual_completion_date}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TasksPage;

// Note: This file has grown quite long (>228 lines). Please consider refactoring this file into smaller, focused components for better maintainability!
