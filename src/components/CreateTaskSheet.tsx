
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";

// Simulated quick user record
type User = { id: string; email: string; user_name: string | null };

// Helper function to fetch users (simulate limit, you’ll want to extend to use paginated REST or similar)
async function fetchUsers(): Promise<User[]> {
  // This should be replaced with a proper Supabase call to your users table
  const res = await fetch("/rest/v1/users?select=id,email,user_name", { headers: { apikey: "anon", "Authorization": "" } });
  return await res.json();
}

interface Props {
  onTaskCreated: () => void;
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

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];

const priorityOptions = [
  { value: 1, label: "High" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Low" },
];

const typeOptions = [
  { value: "personal", label: "Personal" },
  { value: "team", label: "Team" },
];

const CreateTaskSheet: React.FC<Props> = ({ onTaskCreated }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userOptionCount, setUserOptionCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const { user, loading: sessionLoading } = useSupabaseSession();

  useEffect(() => {
    if (open) {
      fetchTasks().then(setTasks).catch(() => setTasks([]));
      fetchUsers()
        .then(us => {
          setUsers(us);
          setUserOptionCount(us.length);
        })
        .catch(() => setUsers([]));
    }
  }, [open]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setForm((f) => ({ ...f, [name]: checked }));
      // If toggling off subtask/dependency, clear values
      if (name === "isSubTask" && !checked) setForm((f) => ({ ...f, superTaskId: "" }));
      if (name === "isDependent" && !checked) setForm((f) => ({ ...f, dependencyTaskId: "" }));
    } else if (name === "priority") {
      setForm((f) => ({ ...f, [name]: Number(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const resetForm = () => setForm(initialForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast({ title: "You must be logged in to create a task." });
      return;
    }
    setCreating(true);

    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date || null,
        status: form.status,
        type: form.type,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        assigned_to: form.assigned_to || null,
        team_id: null,
        created_by: user.id,
        start_date: form.start_date || null, // optional, only if db supports
      };
      const newTask = await createTask(payload);
      if (form.isSubTask && form.superTaskId) {
        toast({ title: "Subtask link not implemented yet." });
      }
      if (form.isDependent && form.dependencyTaskId) {
        toast({ title: "Dependency link not implemented yet." });
      }
      toast({ title: "Task created" });
      resetForm();
      setOpen(false);
      onTaskCreated();
    } catch (err: any) {
      toast({ title: "Create failed", description: err.message });
    }
    setCreating(false);
  };

  // Filter selectable super/dependency tasks: no self, non-empty titles
  const selectableTasks = tasks.filter((t) => t.title && t.title.length > 0);

  // Render user display
  const renderAssignedToInput = () => {
    if (userOptionCount > 50) {
      const userDisplay = users.find(u => u.id === form.assigned_to);
      const label = userDisplay
        ? userDisplay.user_name || userDisplay.email
        : form.assigned_to
        ? "User Selected"
        : "Pick a user";
      return (
        <div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={() => setShowUserDialog(true)}
          >
            {label}
          </Button>
          <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Search and select user</DialogTitle>
              </DialogHeader>
              <Command>
                <CommandInput placeholder="Search users by name or email..." autoFocus />
                <CommandList>
                  {users.map((u) => (
                    <CommandItem
                      key={u.id}
                      onSelect={() => {
                        setForm(f => ({ ...f, assigned_to: u.id }));
                        setShowUserDialog(false);
                      }}
                    >
                      {u.user_name || u.email} <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                    </CommandItem>
                  ))}
                  <CommandEmpty>No users found.</CommandEmpty>
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>
      );
    } else {
      return (
        <select
          name="assigned_to"
          value={form.assigned_to}
          onChange={handleChange}
          className="w-full border rounded p-2"
        >
          <option value="">Select a user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.user_name ?? u.email}
            </option>
          ))}
        </select>
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="mb-6" variant="default">Add Task</Button>
      </SheetTrigger>
      <SheetContent side="right" className="max-w-4xl w-full overflow-y-auto"> 
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
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
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
          </div>
          {/* ADVANCED FIELDS ~ GROUPED VERTICALLY */}
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
