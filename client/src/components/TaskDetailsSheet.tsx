import React, { useState, useMemo, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { updateTask, Task } from "@/integrations/supabase/tasks";
import { toast } from "@/components/ui/use-toast";

import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useTaskActivity } from "@/hooks/useTaskActivity";
import TaskActivityTimeline from "./TaskActivityTimeline";
import { createTaskActivity } from "@/integrations/supabase/taskActivity";
import { EditTaskStatusSelect } from "./EditTaskStatusSelect";


// Dummy role check! Replace with real logic if user roles are exposed
const hasManagerPermissions = (user: any) =>
  user?.role === "admin" || user?.role?.includes("manager");

// Determines whether current user can assign to the given candidate
function canAssign(user: any, candidate: any) {
  if (hasManagerPermissions(user)) return true;
  // Assuming candidate.role ("manager" or "team_manager")
  return candidate?.role?.includes("manager");
}

type Props = {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: any;
  onUpdated: () => void;
  onEdit?: (task: Task) => void;
};
const TaskDetailsSheet: React.FC<Props> = ({
  task,
  open,
  onOpenChange,
  currentUser,
  onUpdated,
  onEdit
}) => {
  // Always run hooks regardless of task
  const [comment, setComment] = useState("");
  const [assignTo, setAssignTo] = useState(task?.assigned_to || "");
  const [status, setStatus] = useState(task?.status || "");
  const [loading, setLoading] = useState(false);
  const { users } = useUsersAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();
  const { activity, reload: reloadActivity, loading: activityLoading } = useTaskActivity(task?.id || null);

  // Reload activity when task changes or when modal opens/closes
  useEffect(() => {
    if (open && task?.id) {
      console.log("[DEBUG] TaskDetailsSheet opened for task:", task.id);
      reloadActivity();
    }
  }, [open, task?.id, reloadActivity]);

  // new: reload usersById for activity log
  const usersById = useMemo(() => {
    const obj: Record<string, { email: string; user_name: string | null }> = {};
    users.forEach(u => obj[u.id] = u);
    return obj;
  }, [users]);

  const showAssign = hasManagerPermissions(currentUser);

  // Status change logic: ensure dropdown is always populated
  // In UI where you present status <select>, update this:
  // status select fallback logic
  // <select ...>
  //   {statusesLoading && (
  //     <option value="">Loading...</option>
  //   )}
  //   {statuses.map((s) => (
  //     <option key={s.id} value={s.name}>{s.name}</option>
  //   ))}
  // </select>

  // Add an Edit button, if permitted, to launch parent-provided onEdit
  // Place this in your info/details block:
  // {onEdit && <Button onClick={() => onEdit(task!)}>Edit</Button>}

  // Status change logic
  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!currentUser?.id) return;
    
    const newStatus = e.target.value;
    // Block completion for project-linked tasks without a milestone
    if (task?.project_id && !task?.milestone_id && newStatus.toLowerCase().includes("complet")) {
      toast({
        title: "Cannot complete task",
        description: "This task is linked to a project but has no milestone assigned. Please attach a milestone before completing it.",
        variant: "destructive",
      });
      return;
    }
    setStatus(newStatus);
    try {
      await updateTask(task!.id, { status: newStatus });
      await createTaskActivity({
        task_id: task!.id,
        action_type: "status_changed",
        old_value: task!.status,
        new_value: newStatus,
        acted_by: currentUser.id,
      });
      toast({ title: "Task status updated" });
      onUpdated();
      reloadActivity();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to change status", description: err.message });
    }
  }

  // Assign handler
  async function handleAssign() {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      await updateTask(task!.id, { assigned_to: assignTo });
      await createTaskActivity({
        task_id: task!.id,
        action_type: "assigned",
        old_value: task!.assigned_to,
        new_value: assignTo,
        acted_by: currentUser.id,
      });
      toast({ title: "Task assignee updated" });
      onUpdated();
      reloadActivity();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to re-assign", description: err.message });
    }
    setLoading(false);
  }

  // Comment handler
  async function handleComment() {
    if (!currentUser?.id) return;
    
    try {
      await createTaskActivity({
        task_id: task!.id,
        action_type: "comment",
        old_value: null,
        new_value: comment,
        acted_by: currentUser.id,
      });
      toast({ title: "Comment added" });
      setComment("");
      reloadActivity();
    } catch (err: any) {
      toast({ title: "Failed to add comment", description: err.message });
    }
  }

  // Properly sync dropdown value to true current task status on open and task change
  useEffect(() => {
    if (!task) return;
    if (!statuses.length) {
      setStatus(task.status);
      return;
    }
    const found = statuses.find(
      s => s.name.trim().toLowerCase() === (task.status || "").trim().toLowerCase()
    );
    const statusToSet = found ? found.name : task.status;
    setStatus(statusToSet);

  }, [task, statuses, open]);

  // Reset assignTo if task changes
  useEffect(() => {
    setAssignTo(task?.assigned_to || "");
  }, [task]);

  // Project linkage state
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [milestonesList, setMilestonesList] = useState<any[]>([]);
  const [featuresList, setFeaturesList] = useState<any[]>([]);
  const [editingLinkage, setEditingLinkage] = useState(false);
  const [linkProjectId, setLinkProjectId] = useState("");
  const [linkMilestoneId, setLinkMilestoneId] = useState("");
  const [linkFeatureId, setLinkFeatureId] = useState("");
  const [savingLinkage, setSavingLinkage] = useState(false);

  // Fetch confirmed projects on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/projects")
      .then(r => r.ok ? r.json() : [])
      .then(data => setProjectsList(Array.isArray(data) ? data.filter((p: any) => p.is_confirmed) : []))
      .catch(() => setProjectsList([]));
  }, [open]);

  // Fetch milestones + features when a project is chosen for editing
  useEffect(() => {
    if (!linkProjectId) {
      setMilestonesList([]);
      setFeaturesList([]);
      return;
    }
    fetch(`/api/projects/${linkProjectId}/milestones`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMilestonesList(Array.isArray(data) ? data : []))
      .catch(() => setMilestonesList([]));
    fetch(`/api/projects/${linkProjectId}/features`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setFeaturesList(Array.isArray(data) ? data : []))
      .catch(() => setFeaturesList([]));
  }, [linkProjectId]);

  // Resolve names for currently linked milestone/feature
  const linkedMilestoneName = useMemo(() => {
    if (!task?.milestone_id) return null;
    // search in milestonesList (if already loaded) or show id
    const found = milestonesList.find(m => m.id === task.milestone_id);
    return found ? found.name : task.milestone_id;
  }, [task?.milestone_id, milestonesList]);

  const linkedFeatureName = useMemo(() => {
    if (!task?.feature_id) return null;
    const found = featuresList.find(f => f.id === task.feature_id);
    if (found) return `${found.tracking_number ? `[${found.tracking_number}] ` : ""}${found.name}`;
    return task.feature_id;
  }, [task?.feature_id, featuresList]);

  // Load milestone + feature names for the task's current project when open
  useEffect(() => {
    if (!open || !task) { setEditingLinkage(false); return; }
    setLinkProjectId(task.project_id || "");
    setLinkMilestoneId(task.milestone_id || "");
    setLinkFeatureId(task.feature_id || "");
  }, [open, task]);

  async function handleSaveLinkage() {
    if (!task || !currentUser?.id) return;
    setSavingLinkage(true);
    try {
      await updateTask(task.id, {
        project_id: linkProjectId || null,
        milestone_id: linkMilestoneId || null,
        feature_id: linkFeatureId || null,
      } as any);
      toast({ title: "Project linkage updated" });
      setEditingLinkage(false);
      onUpdated();
    } catch (err: any) {
      toast({ title: "Failed to update linkage", description: err.message, variant: "destructive" });
    }
    setSavingLinkage(false);
  }

  // Get assigned user name
  const assignedUser = users.find(u => u.id === task?.assigned_to);
  const assignedUserName = assignedUser ? (assignedUser.user_name || assignedUser.email) : "Unassigned";
  
  // Get created by user name
  const createdByUser = users.find(u => u.id === task?.created_by);
  const createdByUserName = createdByUser ? (createdByUser.user_name || createdByUser.email) : "Unknown";

  // Format dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return "High";
      case 2: return "Medium";
      case 3: return "Low";
      default: return "Medium";
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "bg-red-100 text-red-800";
      case 2: return "bg-yellow-100 text-yellow-800";
      case 3: return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[90vw] md:w-[70vw] lg:w-[50vw] lg:min-w-[800px] max-w-none overflow-y-auto">
        <form className="p-3 sm:p-6 space-y-4 sm:space-y-8" onSubmit={e => e.preventDefault()}>
          <SheetHeader className="space-y-2 sm:space-y-4 pb-4 sm:pb-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {task?.task_number && (
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded border w-fit">
                      #{task.task_number}
                    </span>
                  )}
                  <SheetTitle className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {task?.title || "Task Details"}
                  </SheetTitle>
                </div>
                <SheetDescription className="text-sm sm:text-base lg:text-lg text-gray-600">
                  View and manage all task information, status, and activity.
                </SheetDescription>
              </div>
              {onEdit && (
                <Button onClick={() => onEdit(task!)} variant="outline" className="sm:ml-4 w-full sm:w-auto">
                  Edit Task
                </Button>
              )}
            </div>
          </SheetHeader>

          {!task ? (
            <div className="text-center text-muted-foreground py-20">
              No task selected.
            </div>
          ) : (
            <>
              {/* SECTION 1: BASIC INFORMATION */}
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                  <h3 className="text-sm sm:text-base font-medium text-gray-800 mb-3 flex items-center">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
                    Task Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                      <div className="bg-white p-3 rounded border min-h-[80px]">
                        {task.description || <span className="text-gray-500 italic">No description provided</span>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                      <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                        {task.type?.charAt(0).toUpperCase() + task.type?.slice(1) || "Task"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: STATUS & ASSIGNMENT */}
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-base font-medium text-gray-800 mb-3 flex items-center">
                    <span className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">2</span>
                    Status & Assignment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Current Status</label>
                      {(hasManagerPermissions(currentUser) || task.assigned_to === currentUser?.id || task.created_by === currentUser?.id) ? (
                        <EditTaskStatusSelect
                          currentStatus={status}
                          onStatusChange={(newStatus) => {
                            setStatus(newStatus);
                            handleStatusChange({ target: { value: newStatus } } as React.ChangeEvent<HTMLSelectElement>);
                          }}
                          disabled={statusesLoading}
                        />
                      ) : (
                        <div className="bg-white p-2 border rounded">
                          {task.status}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned To</label>
                      {showAssign ? (
                        <div className="space-y-2">
                          <select
                            value={assignTo}
                            onChange={(e) => setAssignTo(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Unassigned</option>
                            {users.map(user => (
                              <option key={user.id} value={user.id}>
                                {user.user_name || user.email}
                              </option>
                            ))}
                          </select>
                          {assignTo !== task.assigned_to && (
                            <Button
                              onClick={handleAssign}
                              disabled={loading}
                              size="sm"
                              className="w-full"
                            >
                              {loading ? "Updating..." : "Update Assignment"}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white p-2 border rounded">
                          {assignedUserName}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Created By</label>
                      <div className="bg-white p-2 border rounded">
                        {createdByUserName}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Created Date</label>
                      <div className="bg-white p-2 border rounded">
                        {formatDate(task.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: TIMELINE & EFFORT */}
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="text-base font-medium text-gray-800 mb-3 flex items-center">
                    <span className="bg-orange-100 text-orange-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">3</span>
                    Timeline & Effort
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                      <div className="bg-white p-2 border rounded">
                        {formatDate(task.start_date)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                      <div className="bg-white p-2 border rounded">
                        {formatDate(task.due_date)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Hours</label>
                      <div className="bg-white p-2 border rounded">
                        {task.estimated_hours || "Not specified"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Completion Date</label>
                      <div className="bg-white p-2 border rounded">
                        {formatDate(task.actual_completion_date)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3b: PROJECT LINKAGE */}
              <div className="space-y-4">
                <div className="bg-teal-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-medium text-gray-800 flex items-center">
                      <span className="bg-teal-100 text-teal-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">P</span>
                      Project Linkage
                    </h3>
                    {showAssign && !editingLinkage && (
                      <button
                        type="button"
                        onClick={() => setEditingLinkage(true)}
                        className="text-xs text-teal-700 underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {!editingLinkage ? (
                    <div className="space-y-2">
                      {!task?.project_id && !task?.milestone_id && !task?.feature_id ? (
                        <p className="text-sm text-gray-400 italic">No project linkage set.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Project</label>
                            <div className="bg-white p-2 border rounded text-sm">
                              {task?.project_id
                                ? (projectsList.find(p => p.id === task.project_id)?.name || task.project_id)
                                : <span className="text-gray-400 italic">Not linked</span>}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Milestone</label>
                            <div className="bg-white p-2 border rounded text-sm">
                              {task?.milestone_id ? (linkedMilestoneName || task.milestone_id) : <span className="text-gray-400 italic">Not linked</span>}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Feature</label>
                            <div className="bg-white p-2 border rounded text-sm">
                              {task?.feature_id ? (linkedFeatureName || task.feature_id) : <span className="text-gray-400 italic">Not linked</span>}
                            </div>
                          </div>
                        </div>
                      )}
                      {task?.project_id && !task?.milestone_id && (
                        <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          <span>⚠️</span> This task is project-linked but has no milestone — it cannot be completed until a milestone is attached.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Project</label>
                        <select
                          value={linkProjectId}
                          onChange={e => { setLinkProjectId(e.target.value); setLinkMilestoneId(""); setLinkFeatureId(""); }}
                          className="w-full h-9 text-sm border border-gray-300 rounded-md px-2 focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">— None (remove linkage) —</option>
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
                              <span className="ml-1 text-xs font-normal text-amber-600">(required to close/complete)</span>
                            </label>
                            <select
                              value={linkMilestoneId}
                              onChange={e => setLinkMilestoneId(e.target.value)}
                              className="w-full h-9 text-sm border border-gray-300 rounded-md px-2 focus:ring-2 focus:ring-teal-500"
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
                              className="w-full h-9 text-sm border border-gray-300 rounded-md px-2 focus:ring-2 focus:ring-teal-500"
                            >
                              <option value="">— Select a feature —</option>
                              {featuresList.map(f => (
                                <option key={f.id} value={f.id}>{f.tracking_number ? `[${f.tracking_number}] ` : ""}{f.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveLinkage} disabled={savingLinkage}>
                          {savingLinkage ? "Saving..." : "Save Linkage"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingLinkage(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: COMMENTS */}
              <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="text-base font-medium text-gray-800 mb-3 flex items-center">
                    <span className="bg-purple-100 text-purple-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">4</span>
                    Add Comment
                  </h3>
                  <div className="space-y-3">
                    <textarea
                      placeholder="Add a comment about this task..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                    />
                    <Button
                      onClick={handleComment}
                      disabled={!comment.trim()}
                      size="sm"
                    >
                      Add Comment
                    </Button>
                  </div>
                </div>
              </div>

              {/* SECTION 5: ACTIVITY LOG */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-base font-medium text-gray-800 mb-3 flex items-center">
                    <span className="bg-gray-100 text-gray-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">5</span>
                    Activity Log
                  </h3>
                  {activityLoading ? (
                    <div className="text-muted-foreground text-sm py-4">Loading activity log...</div>
                  ) : (
                    <TaskActivityTimeline activity={activity} usersById={usersById} />
                  )}
                </div>
              </div>
            </>
          )}

          <SheetFooter className="pt-6 border-t border-gray-200">
            <SheetClose asChild>
              <Button type="button" variant="ghost">Close</Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
export default TaskDetailsSheet;
