
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useTaskActivity } from "@/hooks/useTaskActivity";
import TaskActivityTimeline from "./TaskActivityTimeline";
import { createTaskActivity } from "@/integrations/supabase/taskActivity";

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
};
const TaskDetailsSheet: React.FC<Props> = ({
  task,
  open,
  onOpenChange,
  currentUser,
  onUpdated,
}) => {
  // Always run hooks regardless of task
  const [comment, setComment] = useState("");
  const [assignTo, setAssignTo] = useState(task?.assigned_to || "");
  const [status, setStatus] = useState(task?.status || "");
  const [loading, setLoading] = useState(false);
  const { users } = useUsersAndTeams();
  const { statuses, loading: statusesLoading } = useTaskStatuses();
  const { activity, reload: reloadActivity, loading: activityLoading } = useTaskActivity(task?.id || null);

  // new: reload usersById for activity log
  const usersById = useMemo(() => {
    const obj: Record<string, { email: string; user_name: string | null }> = {};
    users.forEach(u => obj[u.id] = u);
    return obj;
  }, [users]);

  const showAssign = hasManagerPermissions(currentUser);

  // Status change logic
  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
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
    // Debug: check the value in devtools
    console.log("Dropdown status set to:", statusToSet);
  }, [task, statuses, open]);

  // Reset assignTo if task changes
  useEffect(() => {
    setAssignTo(task?.assigned_to || "");
  }, [task]);

  // Make modal content scrollable
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-2xl w-[95vw] p-0">
        <form className="h-full flex flex-col" onSubmit={e => e.preventDefault()}>
          <ScrollArea className="flex-1 min-h-0 p-6">
            <SheetHeader>
              <SheetTitle>Task Details</SheetTitle>
              <SheetDescription>
                All task details and actions.
              </SheetDescription>
            </SheetHeader>
            {!task ? (
              <div className="text-center text-muted-foreground py-20">
                No task selected.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block font-bold mb-1">Task Title</label>
                  <div>{task.title}</div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Status</label>
                  {/* Status change for manager, assigned, or creator */}
                  {(hasManagerPermissions(currentUser) || task.assigned_to === currentUser.id || task.created_by === currentUser.id) ? (
                    <select
                      className="w-full border rounded p-2"
                      value={status}
                      onChange={handleStatusChange}
                      disabled={statusesLoading}
                    >
                      {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  ) : (
                    <div>{task.status}</div>
                  )}
                </div>
                <div>
                  <label className="block font-bold mb-1">Description</label>
                  <div>{task.description || <span className="text-muted-foreground">No description</span>}</div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Priority</label>
                  <div>
                    {task.priority === 1 ? "High" : task.priority === 2 ? "Medium" : "Low"}
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Assigned To</label>
                  <div>
                    {task.assigned_user
                      ? task.assigned_user.user_name || task.assigned_user.email
                      : task.assigned_to
                      ? `(${task.assigned_to})`
                      : "-"}
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Due Date</label>
                  <div>
                    {task.status === "completed"
                      ? (
                        <span>
                          Completion: {task.actual_completion_date || "-"}
                        </span>
                      ) : (
                        <span>
                          {task.due_date || "-"}
                        </span>
                      )
                    }
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Estimated Hours</label>
                  <div>{task.estimated_hours || "-"}</div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Created At</label>
                  <div>{task.created_at ? task.created_at.slice(0, 10) : "-"}</div>
                </div>
              </div>
            )}
            {/* Actions & Comments: only if task */}
            {task && (
              <div className="border-t pt-4 mt-6">
                <label className="block font-bold mb-1">Actions &amp; Comments</label>
                <div className="flex flex-col gap-3">
                  <Textarea
                    placeholder="Add comment or update made..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleComment}
                    disabled={!comment}
                  >Add Comment</Button>
                </div>
              </div>
            )}
            {/* Assignment: only if task */}
            {task && showAssign && (
              <div className="border-t pt-4 mt-6">
                <label className="block font-bold mb-1">Assign To</label>
                <div className="flex gap-2 items-center">
                  <select
                    className="w-full border rounded p-2"
                    value={assignTo}
                    onChange={e => setAssignTo(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users?.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.user_name || u.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={handleAssign}
                    disabled={assignTo === task.assigned_to || loading}
                  >
                    {loading ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            )}
            {/* Activity log/timeline */}
            {task && (
              <div className="border-t pt-4 mt-6">
                <label className="block font-bold mb-1">Activity Log</label>
                {activityLoading ? (
                  <div className="text-muted-foreground text-sm">Loading activity log...</div>
                ) : (
                  <TaskActivityTimeline activity={activity} usersById={usersById} />
                )}
              </div>
            )}
          </ScrollArea>
          <SheetFooter className="mt-4 p-6">
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

