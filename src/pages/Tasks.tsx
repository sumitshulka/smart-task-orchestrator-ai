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

  // Restrict delete to status 'pending' or 'new'
  function canDelete(status: string) {
    return status === "pending" || status === "new";
  }

  // Filtering logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
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
            <TaskCard
              key={task.id}
              task={task}
              onTaskUpdated={load}
              canDelete={canDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TasksPage;

// Note: The main page is now much shorter! Core card logic is refactored to TaskCard.tsx.
