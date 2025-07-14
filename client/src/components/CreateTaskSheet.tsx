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

import { useDependencyConstraintValidation } from "@/hooks/useDependencyConstraintValidation";
import { apiClient } from "@/lib/api";

// Simulated quick user record
type User = { id: string; email: string; user_name: string | null; manager: string | null };
type Role = { name: string };

// HELPER: fetch roles for a given user id from API
async function fetchUserRolesFromSupabase(userId: string): Promise<string[]> {
  try {
    const userRoles = await apiClient.getUserRoles(userId);
    const roles = await apiClient.getRoles();
    const userRoleIds = userRoles.map((ur: any) => ur.role_id);
    return roles
      .filter((role: any) => userRoleIds.includes(role.id))
      .map((role: any) => role.name);
  } catch (error) {
    console.error("Failed to fetch user roles", error);
    return [];
  }
}

// Helper function to fetch users (now using API)
async function fetchUsersSupabase(): Promise<User[]> {
  try {
    return await apiClient.getUsers();
  } catch (error) {
    console.error("Failed to fetch users", error);
    return [];
  }
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

  // Add these lines for dependency selection and inline search:
  const [selectedDependencyTask, setSelectedDependencyTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      if (value === "completed" && !canCompleteDependent()) {
        return;
      }
      setForm((f) => ({ ...f, status: value }));
    } else if (name === "start_date") {
      if (isInvalidStartDate(value)) {
        toast({
          title: "Invalid Start Date",
          description: dependencyDueDate
            ? `Start date must be on or after ${dependencyDueDate}.`
            : "Invalid dependency.",
          variant: "destructive",
        });
        return;
      }
      setForm((f) => ({
        ...f,
        [name]: value,
        due_date: f.due_date && value && f.due_date < value ? "" : f.due_date,
      }));
    } else if (name === "due_date") {
      if (form.start_date && value && value < form.start_date) {
        toast({
          title: "Invalid End Date",
          description: "End date must be on or after the start date.",
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
    if (isDueDateBeforeStartDate()) {
      toast({
        title: "Invalid End Date",
        description: "End date cannot be before the start date.",
        variant: "destructive",
      });
      return;
    }
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

  // Enhanced filter for dependency search - include title, description, and assigned user
  const filteredTasks = tasks.filter(task => {
    const query = searchQuery.toLowerCase();
    const assignedUser = users.find(u => u.id === task.assigned_to);
    const assignedUserName = assignedUser?.user_name?.toLowerCase() || assignedUser?.email?.toLowerCase() || '';
    
    return task.title.toLowerCase().includes(query) ||
           task.description?.toLowerCase().includes(query) ||
           assignedUserName.includes(query) ||
           task.status?.toLowerCase().includes(query);
  });

  // Reset form
  const resetForm = () => {
    setForm(initialForm);
    setSelectedDependencyTask(null);
    setSearchQuery("");
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

  // --- (dependency validation hook) ---
  const {
    isInvalidStartDate,
    canCompleteDependent,
    dependencyDueDate,
    loading: dependencyLoading,
  } = useDependencyConstraintValidation(form.isDependent ? form.dependencyTaskId : undefined);

  // --- NEW: Validate due_date >= start_date ---
  function isDueDateBeforeStartDate() {
    if (!form.start_date || !form.due_date) return false;
    return form.due_date < form.start_date;
  }

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
      <SheetContent side="right" className="w-[50vw] min-w-[800px] max-w-none overflow-y-auto">
        <form className="p-6 space-y-8" onSubmit={handleSubmit}>
          <SheetHeader className="space-y-4 pb-6 border-b border-gray-200">
            <SheetTitle className="text-3xl font-bold text-gray-900">Create New Task</SheetTitle>
            <SheetDescription className="text-lg text-gray-600">
              Fill in the details below to create a comprehensive task with all necessary information.
            </SheetDescription>
          </SheetHeader>
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Task Title *</label>
                  <Input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    placeholder="Enter a clear, descriptive task title"
                    className="text-base h-12"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <Textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Provide detailed information about the task objectives, requirements, and deliverables"
                    className="text-base min-h-[120px] resize-y"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: TASK SETTINGS */}
          <div className="space-y-6">
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
                Task Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Priority Level</label>
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                    className="w-full h-12 text-base border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {priorityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Status *</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full h-12 text-base border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={statusLoading || statuses.length === 0}
                    required
                  >
                    {statusLoading && (
                      <option value="">Loading statuses...</option>
                    )}
                    {statuses.map((opt) => (
                      <option key={opt.id} value={opt.name}>{opt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Hours</label>
                  <Input
                    name="estimated_hours"
                    value={form.estimated_hours}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g., 8.5"
                    className="text-base h-12"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: TIMELINE */}
          <div className="space-y-6">
            <div className="bg-purple-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-purple-100 text-purple-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
                Timeline & Scheduling
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                  <Input
                    name="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={handleChange}
                    min={dependencyDueDate || undefined}
                    disabled={dependencyLoading}
                    className={`text-base h-12 ${
                      isInvalidStartDate(form.start_date)
                        ? "border-red-500 focus:ring-red-500"
                        : ""
                    }`}
                  />
                  {form.isDependent && form.dependencyTaskId && isInvalidStartDate(form.start_date) && (
                    <div className="text-sm text-red-600 mt-2 flex items-center">
                      <span className="mr-1">⚠️</span>
                      Start date must be on or after the dependency's due date ({dependencyDueDate})
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Expected End Date</label>
                  <Input
                    name="due_date"
                    type="date"
                    value={form.due_date}
                    onChange={handleChange}
                    min={form.start_date || undefined}
                    className={`text-base h-12 ${
                      form.start_date && form.due_date && form.due_date < form.start_date
                        ? "border-red-500 focus:ring-red-500"
                        : ""
                    }`}
                  />
                  {form.start_date && form.due_date && form.due_date < form.start_date && (
                    <div className="text-sm text-red-600 mt-2 flex items-center">
                      <span className="mr-1">⚠️</span>
                      End date must be on or after start date
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: ASSIGNMENT */}
          <div className="space-y-6">
            <div className="bg-orange-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-orange-100 text-orange-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">4</span>
                Assignment & Responsibility
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Assignment Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full h-12 text-base border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned To</label>
                  {renderAssignedToInput()}
                </div>
              </div>
            </div>
          </div>
          {/* SECTION 5: ADVANCED OPTIONS */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-gray-100 text-gray-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">5</span>
                Advanced Options
              </h3>
              
              <div className="space-y-6">
                {/* Subtask Option */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <label className="flex items-center cursor-pointer text-base font-medium text-gray-700">
                    <input
                      type="checkbox"
                      name="isSubTask"
                      checked={form.isSubTask}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                    />
                    <span className="flex items-center">
                      <span className="mr-2">📋</span>
                      Mark as Subtask
                    </span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-8">This task will be grouped under a parent task collection</p>
                  
                  {form.isSubTask && (
                    <div className="mt-4 ml-8">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Select Task Group</label>
                      <select
                        name="task_group"
                        value={selectedTaskGroup}
                        onChange={e => setSelectedTaskGroup(e.target.value)}
                        className="w-full h-12 text-base border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    </div>
                  )}
                </div>

                {/* Dependency Option */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <label className="flex items-center cursor-pointer text-base font-medium text-gray-700">
                    <input
                      type="checkbox"
                      name="isDependent"
                      checked={form.isDependent}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                    />
                    <span className="flex items-center">
                      <span className="mr-2">🔗</span>
                      Add Task Dependency
                    </span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-8">This task cannot start until another task is completed</p>
                  
                  {form.isDependent && (
                    <div className="mt-4 ml-8 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Select Dependency Task</label>
                      {/* Inline Task Search */}
                      <div className="space-y-3">
                        <Input
                          type="text"
                          placeholder="🔍 Search by title, description, assignee, or status..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-12"
                        />
                        
                        {searchQuery && filteredTasks.length === 0 && (
                          <div className="p-4 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="text-sm">No tasks found matching "{searchQuery}"</div>
                            <div className="text-xs mt-1">Try searching by task title, description, assignee name, or status</div>
                          </div>
                        )}
                        
                        {searchQuery && filteredTasks.length > 0 && (
                          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                            {filteredTasks.slice(0, 8).map((task) => {
                              const assignedUser = users.find(u => u.id === task.assigned_to);
                              const priorityLabels = { 1: 'High', 2: 'Medium', 3: 'Low' };
                              const priorityColors = { 1: 'text-red-600 bg-red-50', 2: 'text-yellow-600 bg-yellow-50', 3: 'text-green-600 bg-green-50' };
                              const statusColors = { 
                                'pending': 'text-gray-600 bg-gray-100',
                                'in_progress': 'text-blue-600 bg-blue-100', 
                                'completed': 'text-green-600 bg-green-100',
                                'backlog': 'text-purple-600 bg-purple-100'
                              };
                              
                              return (
                                <button
                                  key={task.id}
                                  type="button"
                                  className="w-full p-4 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors group"
                                  onClick={() => {
                                    setSelectedDependencyTask(task);
                                    setForm(f => ({ ...f, dependencyTaskId: task.id }));
                                    setSearchQuery("");
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-gray-900 group-hover:text-blue-700 line-clamp-1">
                                        {task.title}
                                      </div>
                                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                                        {task.description || "No description provided"}
                                      </div>
                                      <div className="flex items-center gap-3 mt-2 text-xs">
                                        <span className={`px-2 py-1 rounded-full font-medium ${statusColors[task.status] || 'text-gray-600 bg-gray-100'}`}>
                                          {task.status?.replace('_', ' ').toUpperCase()}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full font-medium ${priorityColors[task.priority] || 'text-gray-600 bg-gray-100'}`}>
                                          {priorityLabels[task.priority] || 'Medium'} Priority
                                        </span>
                                        {assignedUser && (
                                          <span className="text-gray-500">
                                            👤 {assignedUser.user_name || assignedUser.email}
                                          </span>
                                        )}
                                        {task.due_date && (
                                          <span className="text-gray-500">
                                            📅 Due: {new Date(task.due_date).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            {filteredTasks.length > 8 && (
                              <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                                Showing 8 of {filteredTasks.length} results. Type more to refine search.
                              </div>
                            )}
                          </div>
                        )}
                        
                        {selectedDependencyTask && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-blue-800">🎯 {selectedDependencyTask.title}</div>
                                <div className="text-sm text-blue-700">{selectedDependencyTask.description}</div>
                              </div>
                              <button
                                type="button"
                                className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                                onClick={() => {
                                  setSelectedDependencyTask(null);
                                  setForm(f => ({ ...f, dependencyTaskId: "" }));
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <input
                        type="hidden"
                        name="dependencyTaskId"
                        value={form.dependencyTaskId}
                        readOnly
                      />
                      
                      {selectedDependencyTask && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="text-sm font-medium text-blue-800">Dependency Task Details:</div>
                          <div className="text-sm text-blue-700 mt-1">
                            {selectedDependencyTask.description || "No description provided"}
                          </div>
                        </div>
                      )}
                      
                      {form.status === "completed" && !canCompleteDependent() && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="text-sm text-red-800 flex items-center">
                            <span className="mr-2">⚠️</span>
                            Cannot complete this task until the dependency task is completed.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-10 pt-6 border-t border-gray-200 flex-col sm:flex-row gap-4">
            <div className="flex gap-4 w-full">
              <Button 
                type="submit" 
                disabled={creating || sessionLoading || !user}
                className="flex-1 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                {creating ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2">⏳</span>
                    Creating Task...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="mr-2">✨</span>
                    Create Task
                  </span>
                )}
              </Button>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-base font-semibold"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
              </SheetClose>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CreateTaskSheet;
