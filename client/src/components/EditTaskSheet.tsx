import React, { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Task } from "@/integrations/supabase/tasks";
import { toast } from "@/components/ui/use-toast";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { EditTaskStatusSelect } from "./EditTaskStatusSelect";
import { apiClient } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

// Additional statuses for select
const statusOptions = [
  { label: "New", value: "new" },
  { label: "Pending", value: "pending" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

type Props = {
  task: Task | null;
  onUpdated: () => void;
  // For controlled usage
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // For trigger-as-child pattern
  children?: React.ReactNode;
};

const EditTaskSheet: React.FC<Props> = ({
  task,
  onUpdated,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}) => {
  // Use controlled or uncontrolled open state
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  const [newAssignee, setNewAssignee] = useState(task?.assigned_to || "");
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || 2,
    due_date: task?.due_date ? task?.due_date?.slice(0, 10) : "",
    status: task?.status || "",
    estimated_hours: task?.estimated_hours || "",
    actual_completion_date: task?.actual_completion_date || "",
  });
  const [loading, setLoading] = useState(false);

  // Permissions: Use real roles via hook
  const { users } = useUsersAndTeams();
  // NEW: Use the current user's roles from Supabase
  const { roles: currentRoles, user: currentUser } = useCurrentUserRoleAndTeams();

  // Memoized role checks
  const isAdmin = useMemo(() => currentRoles.includes("admin"), [currentRoles]);
  const isManager = useMemo(() => currentRoles.some(r => r === "manager" || r === "team manager"), [currentRoles]);
  const isAdminOrManager = isAdmin || isManager;
  const isUser = !isAdmin && !isManager;

  // New hooks for assignment permissions and users
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  // --- Assignment logic matching Create Task ---
  function getAssignableUsersEdit() {
    if (!currentUser) return [];
    if (!users.length) return [];
    if (isAdmin) {
      return users;
    }
    if (isManager) {
      // Show all users except self (optionally filter for direct reports, etc)
      return users.filter((u) => u.id !== currentUser?.id);
    }
    // USER: show only their manager, if set
    if (isUser) {
      const myManagerName = currentUser.user_metadata?.manager || null;
      let myManager = users.find((u) => u.user_name === myManagerName);
      if (myManager && myManager.email !== currentUser.email) return [myManager];
      myManager = users.find((u) => u.user_name === myManagerName && u.email !== currentUser.email);
      return myManager ? [myManager] : [];
    }
    return [];
  }

  // Assignment options logic:
  const allowedAssignUsers = useMemo(() => {
    if (isAdminOrManager) {
      return users;
    }
    if (isUser) {
      const myManagerName = currentUser?.user_metadata?.manager || null;
      const myManager = users.find((u) => u.user_name === myManagerName);
      return myManager ? [myManager] : [];
    }
    return [];
  }, [users, currentUser, isAdminOrManager, isUser]);

  // Used to enable/disable assignment section for UI
  const canShowAssign = (
    (isAdminOrManager && users.length > 0) ||
    (isUser && task && task.type !== "personal" && allowedAssignUsers.length > 0)
  );

  useEffect(() => {
    if (open && task) {
      setForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority || 2,
        due_date: task.due_date ? task.due_date.slice(0, 10) : "",
        status: task.status && statuses.length > 0 && statuses.some(s => s.name === task.status) ? task.status : (statuses[0]?.name || ""),
        estimated_hours: task.estimated_hours || "",
        actual_completion_date: task.actual_completion_date || "",
      });
    }
  }, [open, statuses, task]);

  useEffect(() => {
    setNewAssignee(task?.assigned_to || "");
  }, [task, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "priority") {
      setForm(f => ({ ...f, [name]: Number(value) }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  // --- Utility: get changed fields for activity log (returns array of {name, old, new}) ---
  function getChangedFields(oldObj: any, newObj: any) {
    const CHK_KEYS = [
      "title",
      "description",
      "priority",
      "due_date",
      "status",
      "estimated_hours",
      "actual_completion_date",
    ];
    const changes = [];
    for (const k of CHK_KEYS) {
      const oldVal = oldObj[k] ?? "";
      const newVal = newObj[k] ?? "";
      // Loose comparison (dates might be strings/null etc)
      if (String(oldVal) !== String(newVal)) {
        changes.push({ name: k, old: oldVal, new: newVal });
      }
    }
    return changes;
  }

  // --- New: Log assignment change ---
  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAssignee === task?.assigned_to) {
      toast({ title: "No changes to assignment." });
      onOpenChange(false);
      return;
    }
    setLoading(true);
    try {
      const updatePayload: any = {
        ...form,
        assigned_to: newAssignee,
      };
      await apiClient.updateTask(task!.id, updatePayload);
      toast({ title: "Task assignee updated" });
      
      // Invalidate all task-related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task-activity'] });
      await queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      
      // Force refetch of tasks to ensure UI updates
      await queryClient.refetchQueries({ queryKey: ['/api/tasks'] });
      
      onOpenChange(false);
      if (typeof onUpdated === 'function') {
        onUpdated();
      }
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message });
    }
    setLoading(false);
  };

  // --- New: log edits of any field (except assignee), each field as its own activity entry ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatePayload: any = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date || null,
        status: form.status,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        actual_completion_date: form.status === "completed"
          ? (form.actual_completion_date || new Date().toISOString().slice(0, 10))
          : null,
      };

      // 1. Identify changed fields:
      const prevVals: any = {
        title: task!.title,
        description: task!.description || "",
        priority: task!.priority || 2,
        due_date: task!.due_date ? task!.due_date.slice(0, 10) : "",
        status: task!.status || "",
        estimated_hours: task!.estimated_hours || "",
        actual_completion_date: task!.actual_completion_date || "",
      };
      const changedFields = getChangedFields(prevVals, form);

      await apiClient.updateTask(task!.id, updatePayload);
      toast({ title: "Task updated" });
      
      // Invalidate all task-related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task-activity'] });
      await queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      
      // Force refetch of tasks to ensure UI updates
      await queryClient.refetchQueries({ queryKey: ['/api/tasks'] });
      
      onOpenChange(false);
      if (typeof onUpdated === 'function') {
        onUpdated();
      }
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message });
    }
    setLoading(false);
  };

  // Only show editable fields allowed by role
  // For admins/managers: all fields editable
  // For users: only allow status, comment, and assigning to their manager (not due_date or general assignment)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent side="right" className="w-full sm:w-[90vw] md:w-[70vw] lg:w-[50vw] lg:min-w-[800px] flex flex-col p-0">
        <form className="flex-1 flex flex-col p-3 sm:p-4 gap-3 sm:gap-4 overflow-y-auto" onSubmit={handleSubmit} style={{ minHeight: 0 }}>
          <SheetHeader>
            <SheetTitle className="text-base sm:text-lg">Edit Task</SheetTitle>
            <SheetDescription className="text-sm sm:text-base">
              Modify the fields below and click Update to save changes.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Task Title (editable if not restricted to user) */}
            <div>
              <label className="block mb-1 text-sm font-medium">Task Title</label>
              <Input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="Enter task title"
                disabled={isUser}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full border rounded p-2"
                disabled={isUser}
              >
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Status</label>
              <EditTaskStatusSelect
                currentStatus={form.status}
                onStatusChange={(newStatus) => setForm(f => ({ ...f, status: newStatus }))}
                disabled={statusesLoading || statuses.length === 0}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block mb-1 text-sm font-medium">Description</label>
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Task description"
                disabled={isUser}
              />
            </div>
            {/* Due Date (only editable for admin/manager) */}
            <div>
              <label className="block mb-1 text-sm font-medium">Due Date <span className="text-red-500">*</span></label>
              <Input
                name="due_date"
                type="date"
                value={form.due_date}
                onChange={handleChange}
                disabled={isUser}
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Estimated Hours <span className="text-red-500">*</span></label>
              <Input
                name="estimated_hours"
                value={form.estimated_hours}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.1"
                disabled={isUser}
                required
              />
            </div>
            {/* Show field for completion date only if status is completed */}
            {form.status === 'completed' && (
              <div>
                <label className="block mb-1 font-medium">Completion Date</label>
                <Input
                  name="actual_completion_date"
                  type="date"
                  value={form.actual_completion_date || new Date().toISOString().slice(0, 10)}
                  onChange={handleChange}
                  disabled={isUser}
                />
              </div>
            )}
          </div>
          {/* Assignment section: always show if possible per assignment logic */}
          {canShowAssign && (
            <div className="my-6">
              <label className="block mb-1 font-medium">Assign To</label>
              <select
                name="assign_to"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full border rounded p-2"
                disabled={isUser && allowedAssignUsers.length < 1}
              >
                <option value="">Unassigned</option>
                {allowedAssignUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.user_name ?? u.email}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                className="mt-2"
                disabled={loading || newAssignee === task?.assigned_to}
                onClick={handleAssignment}
              >
                {loading ? "Assigning..." : "Assign"}
              </Button>
            </div>
          )}
          <SheetFooter className="mt-8">
            <Button type="submit" disabled={loading || statusesLoading}>
              {loading ? "Updating..." : "Update Task"}
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
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

export default EditTaskSheet;
