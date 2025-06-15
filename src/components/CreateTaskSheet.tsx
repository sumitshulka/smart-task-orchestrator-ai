import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchTasks, createTask, Task } from "@/integrations/supabase/tasks";
import { toast } from "@/components/ui/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";

// Simulated quick user record
type User = { id: string; email: string; user_name: string | null };

// Helper function to fetch users (now using Supabase)
async function fetchUsersSupabase(): Promise<User[]> {
  // Uses Supabase client to fetch all users with manager field
  // Assumes client imported (already in codebase)
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase
    .from("users")
    .select("id, email, user_name, manager");
  if (error) throw error;
  return data as User[];
}

interface Props {
  onTaskCreated: () => void;
  children?: React.ReactNode;
  defaultAssignedTo?: string;
}

const initialForm = {
  title: "",
  description: "",
  start_date: "",
  due_date: "",
  priority: 2,
  status: "pending",
  type: "personal",
  estimated_hours: "",
  assigned_to: "",
  isSubTask: false,
  superTaskId: "",
  isDependent: false,
  dependencyTaskId: "",
};

const priorityOptions = [
  { value: 1, label: "High" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Low" },
];

const typeOptions = [
  { value: "personal", label: "Personal" },
  { value: "team", label: "Team" },
];

const CreateTaskSheet: React.FC<Props> = ({ onTaskCreated, children, defaultAssignedTo }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const { user, loading: sessionLoading } = useSupabaseSession();
  const { statuses, loading: statusLoading } = useTaskStatuses();

  // New: Roles logic
  const [userRole, setUserRole] = useState<string>("user");

  // Get user role & update state on mount
  useEffect(() => {
    if (!user) return;
    if (user?.email?.includes("admin")) setUserRole("admin");
    else if (user?.email?.includes("manager")) setUserRole("manager");
    else setUserRole("user");
  }, [user]);

  // Fetch users on open, now from supabase and including manager field
  useEffect(() => {
    if (!open) return;
    fetchUsersSupabase().then(setUsers);
    fetchTasks().then(setTasks);
  }, [open]);

  // NEW LOGIC: Type selection comes BEFORE assignee selection
  useEffect(() => {
    // When type or open changes...
    if (form.type === "personal" && user?.id) {
      setForm((f) => ({ ...f, assigned_to: user.id }));
    } else if (form.type === "team") {
      setForm((f) => ({ ...f, assigned_to: "" }));
    }
  }, [form.type, open, user?.id]);

  // Compute assignable users for create view
  function getAssignableUsersForCreate() {
    if (!user) return [];
    if (form.type === "personal" && user?.id) {
      // Only assign to yourself
      return users.filter((u) => u.id === user.id);
    }
    if (form.type === "team") {
      if (userRole === "admin") {
        // Admin can assign to anyone
        return users;
      }
      if (userRole === "manager") {
        // Managers: users who report to me ("manager" field matches my user_name)
        // (user.user_name assumed set)
        return users.filter(
          (u) => u.manager === user.user_name && u.id !== user.id // Cannot assign tasks to yourself
        );
      }
      if (userRole === "user") {
        // Users: only assign to their manager (who's user_name matches in users list)
        const myManagerName = user.user_metadata?.manager || null;
        const myManager = users.find(
          (u) => u.user_name === myManagerName
        );
        return myManager ? [myManager] : [];
      }
    }
    return [];
  }

  // Handle form changes (typed fix)
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox" && "checked" in e.target) {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((f) => ({
        ...f,
        [name]: checked,
        ...(name === "isSubTask" && !checked ? { superTaskId: "" } : {}),
        ...(name === "isDependent" && !checked ? { dependencyTaskId: "" } : {}),
      }));
    } else if (name === "priority") {
      setForm((f) => ({ ...f, [name]: Number(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const myUserId = user?.id;
      if (!myUserId) throw new Error("No current user!");
      // Build task
      const taskInput: any = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        start_date: form.start_date || null,
        type: form.type,
        created_by: myUserId,
        assigned_to: form.assigned_to ? form.assigned_to : null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        team_id: null, // Extend if you want team-assignment logic
        actual_completion_date: null,
      };

      // SubTask support
      if (form.isSubTask && form.superTaskId) {
        taskInput.superTaskId = form.superTaskId;
      }

      // Dependency support
      if (form.isDependent && form.dependencyTaskId) {
        taskInput.dependencyTaskId = form.dependencyTaskId;
      }

      await createTask(taskInput);
      toast({ title: "Task Created", description: form.title });
      resetForm();
      setOpen(false);
      onTaskCreated();
    } catch (err: any) {
      toast({ title: "Failed to create task", description: err.message });
    }
    setCreating(false);
  };

  // Compute selectable tasks for subtasks/dependencies
  const selectableTasks = tasks;

  // Reset form
  const resetForm = () => {
    setForm(initialForm);
  };

  // Assigned To dropdown (unchanged, uses getAssignableUsersForCreate)
  const renderAssignedToInput = () => {
    if (form.type === "personal" && user?.id) {
      return (
        <Input
          type="text"
          value={user?.user_name || user?.email || user?.id}
          disabled
          readOnly
          className="w-full border rounded p-2 bg-muted/40"
        />
      );
    }
    const assignableUsers = getAssignableUsersForCreate();
    return (
      <select
        name="assigned_to"
        value={form.assigned_to}
        onChange={handleChange}
        className="w-full border rounded p-2"
        required={form.type === "team"}
      >
        <option value="">Select a user</option>
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.user_name ?? u.email}
          </option>
        ))}
      </select>
    );
  };

  // --- UI ---
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ? (
          children
        ) : (
          <Button className="mb-6" variant="default">
            Add Task
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="max-w-5xl w-[60vw] overflow-y-auto">
        <form className="p-2 space-y-6" onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Create Task</SheetTitle>
            <SheetDescription>
              Fill in the details below to create a new task.
            </SheetDescription>
          </SheetHeader>
          {/* MAIN FIELDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Type</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full border rounded p-2"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium">Task Title</label>
              <Input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="Enter task title"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full border rounded p-2"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block mb-1 font-medium">Description</label>
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Task description"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Start Date</label>
              <Input
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Expected End Date</label>
              <Input
                name="due_date"
                type="date"
                value={form.due_date}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Assigned To</label>
              {renderAssignedToInput()}
            </div>
            <div>
              <label className="block mb-1 font-medium">Estimated Hours</label>
              <Input
                name="estimated_hours"
                value={form.estimated_hours}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border rounded p-2"
                disabled={statusLoading || statuses.length === 0}
                required
              >
                {statusLoading && (
                  <option value="">Loading...</option>
                )}
                {statuses.map((opt) => (
                  <option key={opt.id} value={opt.name}>{opt.name}</option>
                ))}
              </select>
            </div>
          </div>
          {/* ADVANCED FIELDS */}
          <div className="space-y-6 pt-2">
            <div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="isSubTask"
                  checked={form.isSubTask}
                  onChange={handleChange}
                  className="mr-2"
                />
                Is Subtask?
              </label>
              {form.isSubTask && (
                <div className="mt-2">
                  <label className="block mb-1 text-sm">Super Task</label>
                  <select
                    name="superTaskId"
                    value={form.superTaskId}
                    onChange={handleChange}
                    className="w-full border rounded p-2"
                    required
                  >
                    <option value="">Select Super Task</option>
                    {selectableTasks
                      .filter((t) => t.id !== undefined && t.id !== form.superTaskId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="isDependent"
                  checked={form.isDependent}
                  onChange={handleChange}
                  className="mr-2"
                />
                Is Dependent?
              </label>
              {form.isDependent && (
                <div className="mt-2">
                  <label className="block mb-1 text-sm">Dependency Task</label>
                  <select
                    name="dependencyTaskId"
                    value={form.dependencyTaskId}
                    onChange={handleChange}
                    className="w-full border rounded p-2"
                    required
                  >
                    <option value="">Select Dependency Task</option>
                    {selectableTasks
                      .filter((t) => t.id !== undefined && t.id !== form.dependencyTaskId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <SheetFooter className="mt-8">
            <Button type="submit" disabled={creating || sessionLoading || !user}>
              {creating ? "Creating..." : "Create Task"}
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CreateTaskSheet;
