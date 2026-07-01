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
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import TaskCustomFields, { TaskCustomFieldsRef } from "@/components/TaskCustomFields";
import { useRef } from "react";

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
  const cfRef = useRef<TaskCustomFieldsRef>(null);
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

  const isAdmin    = useMemo(() => currentRoles.includes("admin"), [currentRoles]);
  const isManager  = useMemo(() => currentRoles.some(r => r === "manager" || r === "team manager"), [currentRoles]);
  const isAdminOrManager = isAdmin || isManager;
  const isUser     = !isAdmin && !isManager;

  const allowedAssignUsers = useMemo(() => {
    if (isAdminOrManager) return users;
    if (isUser) {
      const myManagerName = currentUser?.user_metadata?.manager || null;
      const myManager = users.find(u => u.user_name === myManagerName);
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

  // Sync form + linkage on open
  useEffect(() => {
    if (open && task) {
      setForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority || 2,
        due_date: task.due_date ? task.due_date.slice(0, 10) : "",
        status: task.status && statuses.length > 0 && statuses.some(s => s.name === task.status)
          ? task.status
          : (statuses[0]?.name || ""),
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
    setForm(f => ({ ...f, [name]: name === "priority" ? Number(value) : value }));
  };

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics-tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['task-activity'] });
    await queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
    await queryClient.refetchQueries({ queryKey: ['/api/tasks'] });
  };

  const handleAssignment = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (newAssignee === task?.assigned_to) {
      toast({ title: "No changes to assignment." });
      return;
    }
    setLoading(true);
    try {
      await apiClient.updateTask(task!.id, { ...form, assigned_to: newAssignee });
      toast({ title: "Task assignee updated" });
      await invalidateAll();
      onOpenChange(false);
      if (typeof onUpdated === 'function') onUpdated();
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate custom fields before saving
    if (cfRef.current && !cfRef.current.validate()) {
      toast({
        title: "Required custom fields missing",
        description: "Please fill in all required custom fields before saving.",
        variant: "destructive",
      });
      return;
    }

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
        project_id:   linkProjectId   || null,
        milestone_id: linkMilestoneId || null,
        feature_id:   linkFeatureId   || null,
        // CF validation passed (line above), so all required fields will be filled — clear review flag
        ...(task?.needs_cf_review ? { needs_cf_review: false } : {}),
      };

      await apiClient.updateTask(task!.id, updatePayload);

      // Save custom field values (save all so cleared fields are persisted)
      if (cfRef.current && task?.id) {
        try {
          const cfPayload = cfRef.current.getPayload();
          if (cfPayload.length > 0) {
            await apiClient.put(`/custom-fields/values/task/${task.id}`, { values: cfPayload });
          }
        } catch (cfErr) {
          console.error("Failed to save custom field values:", cfErr);
        }
      }

      toast({ title: "Task updated successfully" });
      await invalidateAll();
      onOpenChange(false);
      if (typeof onUpdated === 'function') onUpdated();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message });
    }
    setLoading(false);
  };

  const priorityLabel = (p: number) => p === 1 ? "🔴 High" : p === 2 ? "🟡 Medium" : "🟢 Low";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent
        side="right"
        className="w-full sm:w-[90vw] md:w-[70vw] lg:w-[50vw] lg:min-w-[800px] max-w-none overflow-y-auto p-0"
      >
        <form className="p-3 sm:p-6 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>

          {/* ── Header ── */}
          <SheetHeader className="space-y-1 pb-4 border-b border-gray-200">
            <SheetTitle className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Edit Task</SheetTitle>
            <SheetDescription className="text-sm sm:text-base text-gray-600">
              Update the details below and click Save Changes to apply.
            </SheetDescription>
          </SheetHeader>

          {/* ── SECTION 1: Basic Information ── */}
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-4">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 flex items-center">
              <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
              Basic Information
            </h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Task Title <span className="text-red-500">*</span></label>
              <Input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="Enter a clear, descriptive task title"
                className="text-base h-12"
                disabled={isUser}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Provide detailed information about the task objectives, requirements, and deliverables"
                className="text-base min-h-[100px] resize-y"
                disabled={isUser}
              />
            </div>
          </div>

          {/* ── SECTION 2: Task Settings ── */}
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg space-y-4">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 flex items-center">
              <span className="bg-green-100 text-green-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold mr-2">2</span>
              Task Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Priority Level</label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  className="w-full h-12 text-base border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  disabled={isUser}
                >
                  <option value={1}>🔴 High</option>
                  <option value={2}>🟡 Medium</option>
                  <option value={3}>🟢 Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status <span className="text-red-500">*</span></label>
                <div className="h-12 flex items-center">
                  <div className="w-full">
                    <EditTaskStatusSelect
                      currentStatus={form.status}
                      onStatusChange={(s) => setForm(f => ({ ...f, status: s }))}
                      disabled={statusesLoading || statuses.length === 0}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Hours <span className="text-red-500">*</span></label>
                <Input
                  name="estimated_hours"
                  value={form.estimated_hours}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 8.5"
                  className="text-base h-12"
                  disabled={isUser}
                  required
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 3: Timeline ── */}
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg space-y-4">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 flex items-center">
              <span className="bg-purple-100 text-purple-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold mr-2">3</span>
              Timeline &amp; Scheduling
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date <span className="text-red-500">*</span></label>
                <Input
                  name="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={handleChange}
                  className="text-base h-12"
                  disabled={isUser}
                  required
                />
              </div>
              {form.status === "completed" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Actual Completion Date</label>
                  <Input
                    name="actual_completion_date"
                    type="date"
                    value={form.actual_completion_date || new Date().toISOString().slice(0, 10)}
                    onChange={handleChange}
                    className="text-base h-12"
                    disabled={isUser}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 4: Assignment ── */}
          {canShowAssign && (
            <div className="bg-orange-50 p-3 sm:p-4 rounded-lg space-y-4">
              <h3 className="text-sm sm:text-base font-medium text-gray-800 flex items-center">
                <span className="bg-orange-100 text-orange-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold mr-2">4</span>
                Assignment &amp; Responsibility
              </h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned To</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full h-12 text-base border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    disabled={isUser && allowedAssignUsers.length < 1}
                  >
                    <option value="">— Unassigned —</option>
                    {allowedAssignUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.user_name ?? u.email}</option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-5 shrink-0"
                  disabled={loading || newAssignee === task?.assigned_to}
                  onClick={handleAssignment}
                >
                  {loading ? "Saving…" : "Assign"}
                </Button>
              </div>
            </div>
          )}

          {/* ── SECTION 5: Project Linkage (admin/manager only) ── */}
          {isAdminOrManager && (
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 space-y-4">
              <h3 className="text-sm sm:text-base font-medium text-gray-800 flex items-center">
                <span className="bg-gray-200 text-gray-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold mr-2">
                  {canShowAssign ? "5" : "4"}
                </span>
                Advanced Options
              </h3>

              <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
                <div className="flex items-center mb-1 gap-2">
                  <span>🗂️</span>
                  <span className="text-base font-medium text-gray-700">Link to Project</span>
                </div>
                <p className="text-sm text-gray-500">
                  Associate this task with a project milestone or feature.
                </p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Project</label>
                  <select
                    value={linkProjectId}
                    onChange={e => {
                      setLinkProjectId(e.target.value);
                      setLinkMilestoneId("");
                      setLinkFeatureId("");
                    }}
                    className="w-full h-10 text-sm border border-gray-300 rounded-lg px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">— None —</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {linkProjectId && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Milestone
                        <span className="ml-1 text-xs font-normal text-amber-600">(required to complete this task)</span>
                      </label>
                      <select
                        value={linkMilestoneId}
                        onChange={e => { setLinkMilestoneId(e.target.value); setLinkFeatureId(""); }}
                        className="w-full h-10 text-sm border border-gray-300 rounded-lg px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        disabled={milestonesList.length === 0}
                      >
                        <option value="">— Select a milestone —</option>
                        {milestonesList.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Feature
                        <span className="ml-1 text-xs font-normal text-gray-500">(optional)</span>
                      </label>
                      <select
                        value={linkFeatureId}
                        onChange={e => setLinkFeatureId(e.target.value)}
                        className="w-full h-10 text-sm border border-gray-300 rounded-lg px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        disabled={featuresList.length === 0}
                      >
                        <option value="">— Select a feature —</option>
                        {featuresList.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.tracking_number ? `[${f.tracking_number}] ` : ""}{f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Custom Fields ── */}
          <TaskCustomFields ref={cfRef} open={open} taskId={task?.id} />

          {/* ── Footer ── */}
          <SheetFooter className="pt-6 border-t border-gray-200">
            <div className="flex gap-4 w-full">
              <Button
                type="submit"
                disabled={loading || statusesLoading}
                className="flex-1 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin mr-2">⏳</span> Saving…
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <span className="mr-2">💾</span> Save Changes
                  </span>
                )}
              </Button>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-base font-semibold"
                  onClick={() => onOpenChange(false)}
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

export default EditTaskSheet;
