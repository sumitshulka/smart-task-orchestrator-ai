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
import { updateTask, Task } from "@/integrations/supabase/tasks";
import { toast } from "@/components/ui/use-toast";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { createTaskActivity } from "@/integrations/supabase/taskActivity";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import useSupabaseSession from "@/hooks/useSupabaseSession";

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

  // Permissions logic for admin/manager/user
  const { users } = useUsersAndTeams();
  const { user } = useSupabaseSession();
  const [userRole, setUserRole] = useState<string>("user");

  useEffect(() => {
    if (!user) return setUserRole("user");
    if (user?.email?.includes("admin")) setUserRole("admin");
    else if (user?.email?.includes("manager")) setUserRole("manager");
    else setUserRole("user");
  }, [user]);

  // Helper for permission: isAdminOrManager
  const isAdminOrManager = useMemo(() => userRole === "admin" || userRole === "manager", [userRole]);
  const isUser = userRole === "user";

  // New hooks for assignment permissions and users
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  // --- Assignment logic matching Create Task ---
  function getAssignableUsersEdit() {
    if (!user) return [];
    if (!users.length) return [];
    if (userRole === "admin") {
      return users;
    }
    if (userRole === "manager") {
      // Choose users who are subordinates, etc
      return users.filter((u) => u.user_name === user.user_name && u.id !== user.id);
    }
    // USER: show only their manager, if set
    if (userRole === "user") {
      const myManagerName = user.user_metadata?.manager || null;
      // If manager is also admin, preference manager
      let myManager = users.find((u) => u.user_name === myManagerName);
      if (myManager && myManager.email !== user.email) return [myManager];
      // fallback: if for instance manager is admin as well
      myManager = users.find((u) => u.user_name === myManagerName && u.email !== user.email);
      return myManager ? [myManager] : [];
    }
    return [];
  }

  // Assignment options logic:
  const allowedAssignUsers = useMemo(() => {
    // If admin/manager, allow all
    if (isAdminOrManager) return users;
    // If user, only allow assigning to their manager (logic replicated from prior code)
    if (isUser) {
      const myManagerName = user?.user_metadata?.manager || null;
      const myManager = users.find((u) => u.user_name === myManagerName);
      return myManager ? [myManager] : [];
    }
    return [];
  }, [users, user, isAdminOrManager, isUser]);

  // Used to enable/disable assignment section for UI
  const canShowAssign = allowedAssignUsers.length > 0;

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
      await updateTask(task!.id, updatePayload);
      await createTaskActivity({
        task_id: task!.id,
        action_type: "assigned",
        old_value: task!.assigned_to,
        new_value: newAssignee,
        acted_by: user?.id,
      });
      toast({ title: "Task assignee updated" });
      onOpenChange(false);
      onUpdated();
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

      await updateTask(task!.id, updatePayload);

      // 2. Log in activity for *all* changed fields
      for (const { name, old, new: nw } of changedFields) {
        await createTaskActivity({
          task_id: task!.id,
          action_type: "edit",
          old_value: String(old),
          new_value: String(nw),
          acted_by: user?.id
        });
      }
      toast({ title: "Task updated" });
      onOpenChange(false);
      onUpdated();
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
      <SheetContent side="right" className="max-w-4xl w-[75vw]">
        <form className="p-2 space-y-6" onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Edit Task</SheetTitle>
            <SheetDescription>
              Modify the fields below and click Update to save changes.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Task Title (editable if not restricted to user) */}
            <div>
              <label className="block mb-1 font-medium">Task Title</label>
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
              <label className="block mb-1 font-medium">Priority</label>
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
              <label className="block mb-1 font-medium">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border rounded p-2"
                disabled={statusesLoading || statuses.length === 0}
                required
              >
                {statusesLoading && (
                  <option value="">Loading...</option>
                )}
                {statuses.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
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
                disabled={isUser}
              />
            </div>
            {/* Due Date (only editable for admin/manager) */}
            <div>
              <label className="block mb-1 font-medium">Due Date</label>
              <Input
                name="due_date"
                type="date"
                value={form.due_date}
                onChange={handleChange}
                disabled={isUser}
              />
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
                disabled={isUser}
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
              {/* Only show Assign button if allowed (admins/managers or users allowed to assign to their manager) */}
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
