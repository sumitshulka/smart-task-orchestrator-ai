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
import { useTaskStatuses } from "@/hooks/useTaskStatuses";

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
  children?: React.ReactNode;
  defaultAssignedTo?: string; // Add new prop for default assigned user
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

const CreateTaskSheet: React.FC<Props> = ({ onTaskCreated, children, defaultAssignedTo }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userOptionCount, setUserOptionCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const { user, loading: sessionLoading } = useSupabaseSession();
  const { statuses, loading: statusLoading } = useTaskStatuses();

  // New: Roles logic
  // For this demo, assume backend user has optional .role array or .role string
  const [userRole, setUserRole] = useState<string>("user");

  // Get user role & update state on mount (replace with your real role logic as needed)
  useEffect(() => {
    // For demo: set role based on admin/manager/email (use your backend method)
    if (!user) return;
    // This is placeholder. Replace with real RBAC logic/loading
    if (user?.email?.includes("admin")) setUserRole("admin");
    else if (user?.email?.includes("manager")) setUserRole("manager");
    else setUserRole("user");
  }, [user]);

  // NEW LOGIC: Type selection comes BEFORE assignee selection
  // and, based on type, restrict or autofill assignee
  useEffect(() => {
    // When type or open changes...
    if (form.type === "personal" && user?.id) {
      setForm((f) => ({ ...f, assigned_to: user.id }));
    } else if (form.type === "team") {
      setForm((f) => ({ ...f, assigned_to: "" }));
    }
  }, [form.type, open, user?.id]);

  // Helpers to determine allowed assignable users
  function getAssignableUsersForCreate() {
    if (form.type === "personal" && user?.id) {
      // Personal task: Can only assign to yourself (user)
      return usersWithCurrent.filter((u) => u.id === user.id);
    }
    if (form.type === "team") {
      if (userRole === "admin") return usersWithCurrent;
      // Manager: assign to team or reports
      if (userRole === "manager") {
        // For simplicity: allow all users (customize here per your org logic)
        return usersWithCurrent;
      }
      // Normal user: can only assign to manager
      if (userRole === "user") {
        // Show manager (simulate direct report by having "manager" field)
        const myManager = usersWithCurrent.find(
          (u) => u.user_name === user?.user_metadata?.manager
        );
        return myManager ? [myManager] : [];
      }
    }
    return [];
  }

  // Main render for assigned_to field
  const renderAssignedToInput = () => {
    // Always assign to self if personal (hidden input)
    if (form.type === "personal") {
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
    // If team, show appropriate select/dropdown
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
        {/* If children is provided, use it as the trigger. Otherwise, show the default button */}
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
