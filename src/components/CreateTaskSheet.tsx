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
import { fetchAssignableTaskGroups, assignTaskToGroup, TaskGroup } from "@/integrations/supabase/taskGroups";
import TaskSearchDialog from "./TaskSearchDialog";
import { useDependencyConstraintValidation } from "@/hooks/useDependencyConstraintValidation";

// Simulated quick user record
type User = { id: string; email: string; user_name: string | null; manager: string | null };
type Role = { name: string };

// HELPER: fetch roles for a given user id from Supabase
async function fetchUserRolesFromSupabase(userId: string): Promise<string[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase
    .from("user_roles")
    .select(`role:role_id (name)`)
    .eq("user_id", userId);
  if (error) {
    console.error("Failed to fetch user roles", error);
    return [];
  }
  // The 'role' field comes as an object: { name: string }
  return (data || []).map((r: any) => r.role?.name).filter(Boolean);
}

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
  status: "", // Do NOT default; will pick from statuses as soon as loaded
  type: "personal",
  estimated_hours: "",
  assigned_to: "",
  isSubTask: false,
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
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { user, loading: sessionLoading } = useSupabaseSession();
  const { statuses, loading: statusLoading } = useTaskStatuses();
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [selectedTaskGroup, setSelectedTaskGroup] = useState<string>("");

  // Add these two lines for dependency dialog and task selection state:
  const [selectedDependencyTask, setSelectedDependencyTask] = useState<Task | null>(null);
  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);

  // Get user role: use fetched roles, fallback to email only if missing
  const [userRole, setUserRole] = useState<string>("user");

  // On open: fetch users and user roles afresh
  useEffect(() => {
    if (!open || !user?.id) return;
    // Fetch users
    fetchUsersSupabase().then((fetchedUsers) => {
      setUsers(fetchedUsers);
      console.log("[DEBUG] Users fetched:", fetchedUsers);
    });
    // Fetch roles for current user
    fetchUserRolesFromSupabase(user.id).then((roles) => {
      setUserRoles(roles);
      console.log("[DEBUG] Current user roles:", roles);
    });
    // Fetch tasks for subtasks/dependencies
    fetchTasks().then(setTasks);
  }, [open, user?.id]);

  // Get user role & update state on mount
  useEffect(() => {
    if (!user) return;
    let roleType: string = "user";
    if (userRoles.includes("admin")) roleType = "admin";
    else if (userRoles.includes("manager") || userRoles.includes("team manager")) roleType = "manager";
    else if (user?.email?.includes("admin")) roleType = "admin";
    else if (user?.email?.includes("manager")) roleType = "manager";
    setUserRole(roleType);
    console.log("[DEBUG] Effective User Role:", roleType);
  }, [user, userRoles]);

  // NEW LOGIC: Type selection comes BEFORE assignee selection
  useEffect(() => {
    // When type or open changes...
    if (form.type === "personal" && user?.id) {
      setForm((f) => ({ ...f, assigned_to: user.id }));
    } else if (form.type === "team") {
      setForm((f) => ({ ...f, assigned_to: "" }));
    }
  }, [form.type, open, user?.id]);

  // Core: Compute assignable users for create view, with debug logs
  function getAssignableUsersForCreate() {
    if (!user) return [];
    let list: User[] = [];
    if (form.type === "personal" && user?.id) {
      list = users.filter((u) => u.id === user.id);
    } else if (form.type === "team") {
      if (userRole === "admin") {
        list = users;
      } else if (userRole === "manager") {
        // Managers: users who report to me ("manager" field matches my user_name, cannot assign to self)
        list = users.filter(
          (u) => u.manager === user.user_name && u.id !== user.id
        );
      } else if (userRole === "user") {
        // Users: only assign to their manager (who's user_name matches in users list)
        const myManagerName = user.user_metadata?.manager || null;
        const myManager = users.find(
          (u) => u.user_name === myManagerName
        );
        list = myManager ? [myManager] : [];
      }
    }
    console.log("[DEBUG] Filtering users for role:", userRole, "Got list:", list);
    return list;
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
        ...(name === "isSubTask" && !checked ? {} : {}),
        ...(name === "isDependent" && !checked ? { dependencyTaskId: "" } : {}),
      }));
    } else if (name === "priority") {
      setForm((f) => ({ ...f, [name]: Number(value) }));
    } else if (name === "status") {
      // Prevent completed if dependency is not complete
      if (value === "completed" && !canCompleteDependent()) {
        return;
      }
      setForm((f) => ({ ...f, status: value }));
    } else if (name === "start_date") {
      // Prevent setting before dependencyDueDate
      if (isInvalidStartDate(value)) {
        // Optionally, show a toast or feedback here
        toast({
          title: "Invalid Start Date",
          description: dependencyDueDate
            ? `Start date must be on or after ${dependencyDueDate}.`
            : "Invalid dependency.",
          variant: "destructive",
        });
        return;
      }
      setForm((f) => ({ ...f, [name]: value }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  // In handleSubmit: assign to group if set and not empty
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const myUserId = user?.id;
      if (!myUserId) throw new Error("No current user!");

      if (!form.status) {
        throw new Error("Status is required.");
      }

      // Only require subtask+group validation if checkbox is set
      if (form.type === "personal" && form.isSubTask) {
        const group = taskGroups.find(g => g.id === selectedTaskGroup && g.visibility === "private");
        if (!group) throw new Error("Personal tasks marked as subtask must be added to a Private Task Group.");
      }

      // Build task (do not include superTaskId)
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
        team_id: null,
        actual_completion_date: null,
      };

      // Dependency support
      if (form.isDependent && form.dependencyTaskId) {
        taskInput.dependencyTaskId = form.dependencyTaskId;
      }

      // Create the task
      const newTask = await createTask(taskInput);

      // Only assign to group if group selected and Is Subtask checked
      if (form.isSubTask && selectedTaskGroup) {
        await assignTaskToGroup({ group_id: selectedTaskGroup, task_id: newTask.id });
      }

      // Log creation!
      await (await import("@/integrations/supabase/taskActivity")).createTaskActivity({
        task_id: newTask.id,
        action_type: "created",
        old_value: null,
        new_value: null,
        acted_by: myUserId,
      });

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
    setSelectedDependencyTask(null);
    setDependencyDialogOpen(false);
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
        className="w-full border rounded p-2 bg-white z-50"
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

  // Fetch eligible task groups when subtask mode is toggled or type changes
  useEffect(() => {
    if (!open || !form.isSubTask) return;
    async function loadGroups() {
      const groups = await fetchAssignableTaskGroups();
      let filtered: TaskGroup[] = [];
      if (form.type === "personal") {
        filtered = groups.filter(g => g.visibility === "private");
      } else if (form.type === "team") {
        filtered = groups.filter(g => g.visibility !== "private");
      }
      setTaskGroups(filtered);
      // Reset selection if invalid
      if (filtered.every(g => g.id !== selectedTaskGroup)) {
        setSelectedTaskGroup("");
      }
    }
    loadGroups();
    // eslint-disable-next-line
  }, [open, form.type, form.isSubTask]);

  // --- (dependency selection) ---
  // When dependency selected via dialog, update dependencyTaskId and remember the selected full task
  function handleDependencySelect(task: Task) {
    setSelectedDependencyTask(task);
    setForm(f => ({ ...f, dependencyTaskId: task.id }));
  }

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
      <SheetContent side="right" className="max-w-6xl w-[78vw] overflow-y-auto">
        <form className="p-2 space-y-6" onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Create Task</SheetTitle>
            <SheetDescription>
              Fill in the details below to create a new task.
            </SheetDescription>
          </SheetHeader>
          {/* MAIN FIELDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Row 1: Task Title - full width */}
            <div className="sm:col-span-2">
              <label className="block mb-1 font-medium">Task Title</label>
              <Input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="Enter task title"
              />
            </div>
            {/* Row 2: Description - full width */}
            <div className="sm:col-span-2">
              <label className="block mb-1 font-medium">Description</label>
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Task description"
              />
            </div>
            {/* Row 3: Priority & Status */}
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
            {/* Row 4: Start and End Dates (side-by-side) */}
            <div>
              <label className="block mb-1 font-medium">Start Date</label>
              <Input
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
                min={dependencyDueDate || undefined}
                disabled={dependencyLoading}
                className={
                  isInvalidStartDate(form.start_date)
                    ? "border-red-500"
                    : ""
                }
              />
              {/* Show real-time validation feedback if needed */}
              {form.isDependent && form.dependencyTaskId && isInvalidStartDate(form.start_date) && (
                <div className="text-xs text-red-600 mt-1">
                  Start date must be on or after the dependency's due date ({dependencyDueDate})
                </div>
              )}
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
            {/* Row 5: Assign Type (left) and Assigned To (right) */}
            <div>
              <label className="block mb-1 font-medium">Assign Type</label>
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
              <label className="block mb-1 font-medium">Assigned To</label>
              {renderAssignedToInput()}
            </div>
            {/* Row 6: Estimated Hours (full width below Assign Type + Assigned To) */}
            <div className="sm:col-span-2">
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
                  {/* Show TASK GROUP selection here, filtered */}
                  <label className="block mb-1 text-sm">Task Group</label>
                  <select
                    name="task_group"
                    value={selectedTaskGroup}
                    onChange={e => setSelectedTaskGroup(e.target.value)}
                    className="w-full border rounded p-2 bg-white z-50"
                    required={form.isSubTask}
                    disabled={taskGroups.length === 0}
                  >
                    <option value="">
                      {form.type === "personal"
                        ? "Select Private Task Group"
                        : "Select Team Task Group"}
                    </option>
                    {taskGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.visibility})</option>
                    ))}
                  </select>
                  {/* Super Task select has been fully removed */}
                </div>
              )}
            </div>
            {/* Dependency Section (unchanged except status feedback) */}
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
                  {/* --- REPLACE DROPDOWN WITH SEARCH DIALOG BUTTON + DIALOG --- */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="border rounded px-3 py-2 bg-muted/50 hover:bg-muted/70 transition"
                      onClick={() => setDependencyDialogOpen(true)}
                    >
                      {selectedDependencyTask
                        ? <>Selected: <span className="font-semibold">{selectedDependencyTask.title}</span> (Change)</>
                        : "Search & Select Task"}
                    </button>
                    {selectedDependencyTask && (
                      <button
                        type="button"
                        className="text-xs text-danger-600 underline ml-2"
                        onClick={() => {
                          setSelectedDependencyTask(null);
                          setForm(f => ({ ...f, dependencyTaskId: "" }));
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {/* Hidden input to preserve dependencyTaskId for submit */}
                  <input
                    type="hidden"
                    name="dependencyTaskId"
                    value={form.dependencyTaskId}
                    readOnly
                  />
                  <TaskSearchDialog
                    open={dependencyDialogOpen}
                    onOpenChange={setDependencyDialogOpen}
                    onSelect={handleDependencySelect}
                    excludeTaskId={undefined}
                  />
                  {/* Optionally, display a small summary below */}
                  {selectedDependencyTask && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Description: {selectedDependencyTask.description || "—"}
                    </div>
                  )}
                  {/* Dependency status warning */}
                  {form.status === "completed" && !canCompleteDependent() && (
                    <div className="text-xs text-red-600 mt-1">
                      Cannot complete this task until the dependency task is completed.
                    </div>
                  )}
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
