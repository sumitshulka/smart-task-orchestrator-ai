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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  task: Task | null;
  onUpdated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

const EditTaskSheet: React.FC<Props> = ({
  task,
  onUpdated,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}) => {
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

  // Project linkage state
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [milestonesList, setMilestonesList] = useState<any[]>([]);
  const [featuresList, setFeaturesList] = useState<any[]>([]);
  const [linkProjectId, setLinkProjectId] = useState("");
  const [linkMilestoneId, setLinkMilestoneId] = useState("");
  const [linkFeatureId, setLinkFeatureId] = useState("");

  const { users } = useUsersAndTeams();
  const { roles: currentRoles, user: currentUser } = useCurrentUserRoleAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  const isAdmin = useMemo(() => currentRoles.includes("admin"), [currentRoles]);
  const isManager = useMemo(() => currentRoles.some(r => r === "manager" || r === "team manager"), [currentRoles]);
  const isAdminOrManager = isAdmin || isManager;
  const isUser = !isAdmin && !isManager;

  const allowedAssignUsers = useMemo(() => {
    if (isAdminOrManager) return users;
    if (isUser) {
      const myManagerName = currentUser?.user_metadata?.manager || null;
      const myManager = users.find((u) => u.user_name === myManagerName);
      return myManager ? [myManager] : [];
    }
    return [];
  }, [users, currentUser, isAdminOrManager, isUser]);

  const canShowAssign = (
    (isAdminOrManager && users.length > 0) ||
    (isUser && task && task.type !== "personal" && allowedAssignUsers.length > 0)
  );

  // Fetch projects on open
  useEffect(() => {
    if (!open) return;
    apiClient.get("/projects")
      .then(data => setProjectsList(Array.isArray(data) ? data : []))
      .catch(() => setProjectsList([]));
  }, [open]);

  // Fetch milestones + features when project changes
  const fetchMilestonesAndFeatures = (projectId: string) => {
    if (!projectId) {
      setMilestonesList([]);
      setFeaturesList([]);
      return;
    }
    apiClient.get(`/projects/${projectId}/milestones`)
      .then(data => setMilestonesList(Array.isArray(data) ? data : []))
      .catch(() => setMilestonesList([]));
    apiClient.get(`/projects/${projectId}/features`)
      .then(data => setFeaturesList(Array.isArray(data) ? data : []))
      .catch(() => setFeaturesList([]));
  };

  useEffect(() => {
    fetchMilestonesAndFeatures(linkProjectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkProjectId]);

  // Sync form and linkage state on open
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
      setLinkProjectId(task.project_id || "");
      setLinkMilestoneId(task.milestone_id || "");
      setLinkFeatureId(task.feature_id || "");
      if (task.project_id) fetchMilestonesAndFeatures(task.project_id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, statuses]);

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

  function getChangedFields(oldObj: any, newObj: any) {
    const CHK_KEYS = ["title", "description", "priority", "due_date", "status", "estimated_hours", "actual_completion_date"];
    const changes = [];
    for (const k of CHK_KEYS) {
      const oldVal = oldObj[k] ?? "";
      const newVal = newObj[k] ?? "";
      if (String(oldVal) !== String(newVal)) {
        changes.push({ name: k, old: oldVal, new: newVal });
      }
    }
    return changes;
  }

  const handleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAssignee === task?.assigned_to) {
      toast({ title: "No changes to assignment." });
      onOpenChange(false);
      return;
    }
    setLoading(true);
    try {
      await apiClient.updateTask(task!.id, { ...form, assigned_to: newAssignee });
      toast({ title: "Task assignee updated" });
      await queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks'] });
      onOpenChange(false);
      if (typeof onUpdated === 'function') onUpdated();
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
        // Project linkage
        project_id: linkProjectId || null,
        milestone_id: linkMilestoneId || null,
        feature_id: linkFeatureId || null,
      };

      await apiClient.updateTask(task!.id, updatePayload);
      toast({ title: "Task updated" });

      await queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['task-activity'] });
      await queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      await queryClient.refetchQueries({ queryKey: ['/api/tasks'] });

      onOpenChange(false);
      if (typeof onUpdated === 'function') onUpdated();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message });
    }
    setLoading(false);
  };

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

          {/* ── Project Linkage (admin/manager only) ── */}
          {isAdminOrManager && (
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Project Linkage</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">Project</label>
                  <Select
                    value={linkProjectId || "none"}
                    onValueChange={(v) => {
                      const val = v === "none" ? "" : v;
                      setLinkProjectId(val);
                      setLinkMilestoneId("");
                      setLinkFeatureId("");
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projectsList.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">Milestone</label>
                  <Select
                    value={linkMilestoneId || "none"}
                    onValueChange={(v) => {
                      setLinkMilestoneId(v === "none" ? "" : v);
                      setLinkFeatureId("");
                    }}
                    disabled={!linkProjectId || milestonesList.length === 0}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="No milestone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No milestone</SelectItem>
                      {milestonesList.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">Feature</label>
                  <Select
                    value={linkFeatureId || "none"}
                    onValueChange={(v) => setLinkFeatureId(v === "none" ? "" : v)}
                    disabled={!linkProjectId || featuresList.length === 0}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="No feature" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No feature</SelectItem>
                      {featuresList.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.tracking_number ? `[${f.tracking_number}] ` : ""}{f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {linkProjectId && !linkMilestoneId && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ A project-linked task requires a milestone to be completed.
                </p>
              )}
            </div>
          )}

          {/* ── Assignment ── */}
          {canShowAssign && (
            <div className="my-2">
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
