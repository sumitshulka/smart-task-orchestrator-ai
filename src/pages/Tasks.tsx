
import React, { useState, useEffect } from "react";
import { fetchTasks, deleteTask, Task } from "@/integrations/supabase/tasks";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import CreateTaskSheet from "@/components/CreateTaskSheet";

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, loading: sessionLoading } = useSupabaseSession();

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

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tasks</h1>
      <CreateTaskSheet onTaskCreated={load} />
      {loading && <div className="text-muted-foreground mb-4">Loading...</div>}
      <table className="w-full border text-sm rounded shadow bg-background">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">Title</th>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-left">Priority</th>
            <th className="p-2 text-left">Due Date</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-muted-foreground">
                No tasks found.
              </td>
            </tr>
          )}
          {tasks.map((task) => (
            <tr key={task.id} className="border-b last:border-b-0">
              <td className="p-2">{task.title}</td>
              <td className="p-2">{task.description}</td>
              <td className="p-2">
                {task.priority === 1
                  ? "High"
                  : task.priority === 2
                  ? "Medium"
                  : "Low"}
              </td>
              <td className="p-2">{task.due_date}</td>
              <td className="p-2 capitalize">{task.status}</td>
              <td className="p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTask(task.id)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TasksPage;

