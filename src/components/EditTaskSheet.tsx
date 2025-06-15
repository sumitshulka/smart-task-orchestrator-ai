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
  task: Task;
  onUpdated: () => void;
  children: React.ReactNode;
};

const EditTaskSheet: React.FC<Props> = ({ task, onUpdated, children }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || "",
    priority: task.priority || 2,
    due_date: task.due_date ? task.due_date.slice(0, 10) : "",
    status: task.status || "",
    estimated_hours: task.estimated_hours || "",
    actual_completion_date: task.actual_completion_date || "",
  });
  const [loading, setLoading] = useState(false);

  // New hooks for assignment permissions and users
  const { users } = useUsersAndTeams();
  const { user } = useSupabaseSession();
  const [userRole, setUserRole] = useState<string>("user");

  const { statuses, loading: statusesLoading } = useTaskStatuses();

  useEffect(() => {
    if (!user) return;
    if (user?.email?.includes("admin")) setUserRole("admin");
    else if (user?.email?.includes("manager")) setUserRole("manager");
    else setUserRole("user");
  }, [user]);

  // Assignment options logic
  function getAssignableUsersEdit() {
    if (!user) return [];
    if (userRole === "admin") return users;
    if (userRole === "manager") return users;
    // User: can assign only to their manager
    if (userRole === "user") {
      const myManager = users.find(
        (u) => u.user_name === user?.user_metadata?.manager
      );
      return myManager ? [myManager] : [];
    }
    return [];
  }

  const canAssign =
    userRole === "admin" ||
    userRole === "manager" ||
    (userRole === "user" && users.some((u) => u.user_name === user?.user_metadata?.manager));

  // Main: Handle assignment change during edit
  const [newAssignee, setNewAssignee] = useState(task.assigned_to || "");

  useEffect(() => {
    if (open) {
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
    setNewAssignee(task.assigned_to || "");
  }, [task, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "priority") {
      setForm(f => ({ ...f, [name]: Number(value) }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAssignee === task.assigned_to) {
      toast({ title: "No changes to assignment." });
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      // Update task with new assignee
      const updatePayload: any = {
        ...form,
        assigned_to: newAssignee,
      };
      await updateTask(task.id, updatePayload);
      // Log in activity
      await createTaskActivity({
        task_id: task.id,
        action_type: "assigned",
        old_value: task.assigned_to,
        new_value: newAssignee,
        acted_by: user?.id,
      });
      toast({ title: "Task assignee updated" });
      setOpen(false);
      onUpdated();
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message });
    }
    setLoading(false);
  };

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
      await updateTask(task.id, updatePayload);
      toast({ title: "Task updated" });
      setOpen(false);
      onUpdated();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message });
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="right" className="max-w-4xl w-[75vw]">
        <form className="p-2 space-y-6" onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Edit Task</SheetTitle>
            <SheetDescription>
              Modify the fields below and click Update to save changes.
            </SheetDescription>
          </SheetHeader>
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
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Due Date</label>
              <Input
                name="due_date"
                type="date"
                value={form.due_date}
                onChange={handleChange}
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
                />
              </div>
            )}
          </div>
          {/* Assignment section (only show if canAssign) */}
          {canAssign && (
            <div className="my-6">
              <label className="block mb-1 font-medium">Assign To</label>
              <select
                name="assign_to"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full border rounded p-2"
              >
                <option value="">Unassigned</option>
                {getAssignableUsersEdit().map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.user_name ?? u.email}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                className="mt-2"
                disabled={loading || newAssignee === task.assigned_to}
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
                onClick={() => setOpen(false)}
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
