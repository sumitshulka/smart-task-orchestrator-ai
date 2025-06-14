
import React, { useState, useEffect } from "react";
import { fetchTasks, createTask, updateTask, deleteTask, Task } from "@/integrations/supabase/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

// TODO: Replace this with actual auth session user id
const CURRENT_USER_ID = "00000000-0000-0000-0000-000000000001";

const emptyTaskState = {
  title: "",
  description: "",
  priority: 2,
  due_date: "",
  estimated_hours: null,
  status: "pending",
  type: "personal",
  assigned_to: null,
  team_id: null,
};

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState<any>(emptyTaskState);
  const [creating, setCreating] = useState(false);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewTask({ ...newTask, [e.target.name]: e.target.value });
  };

  async function handleCreateTask() {
    setCreating(true);
    try {
      // Ensure required fields for the DB insert
      const requiredTask = {
        ...newTask,
        created_by: CURRENT_USER_ID,  // Set creator
      };
      await createTask(requiredTask);
      setNewTask(emptyTaskState);
      load();
      toast({ title: "Task created" });
    } catch (err: any) {
      toast({ title: "Create failed", description: err.message });
    }
    setCreating(false);
  }

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
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tasks</h1>
      {/* Create Task */}
      <div className="mb-6 border rounded p-4 bg-background flex flex-col sm:flex-row gap-2 items-end">
        <Input
          name="title"
          value={newTask.title}
          onChange={handleChange}
          placeholder="Task Title"
          className="mb-2 sm:mb-0"
        />
        <Input
          name="description"
          value={newTask.description}
          onChange={handleChange}
          placeholder="Description"
          className="mb-2 sm:mb-0"
        />
        <select
          name="priority"
          value={newTask.priority}
          onChange={handleChange}
          className="border rounded px-2 py-1 mb-2 sm:mb-0"
        >
          <option value={1}>High</option>
          <option value={2}>Medium</option>
          <option value={3}>Low</option>
        </select>
        <Input
          name="due_date"
          type="date"
          value={newTask.due_date}
          onChange={handleChange}
          className="mb-2 sm:mb-0"
        />
        <select
          name="type"
          value={newTask.type}
          onChange={handleChange}
          className="border rounded px-2 py-1 mb-2 sm:mb-0"
        >
          <option value="personal">Personal</option>
          <option value="team">Team</option>
        </select>
        <Button onClick={handleCreateTask} disabled={creating}>
          Add Task
        </Button>
      </div>

      {/* Task List */}
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
