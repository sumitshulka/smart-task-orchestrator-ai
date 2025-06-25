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
import TaskDetailsInfo from "./TaskDetailsInfo";
import TaskDetailsComments from "./TaskDetailsComments";
import TaskDetailsAssign from "./TaskDetailsAssign";

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

  // Make modal content always scrollable on overflow
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[108rem] w-[98vw] p-0 flex flex-col">
        <form className="h-full flex flex-col" onSubmit={e => e.preventDefault()} style={{ minHeight: 0 }}>
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
              <>
                <TaskDetailsInfo
                  task={task}
                  status={status}
                  statuses={statuses}
                  statusesLoading={statusesLoading}
                  canChangeStatus={
                    hasManagerPermissions(currentUser) ||
                    task.assigned_to === currentUser.id ||
                    task.created_by === currentUser.id
                  }
                  onStatusChange={handleStatusChange}
                />
                <TaskDetailsComments
                  comment={comment}
                  setComment={setComment}
                  handleComment={handleComment}
                />
                {showAssign && (
                  <TaskDetailsAssign
                    users={users}
                    assignTo={assignTo}
                    setAssignTo={setAssignTo}
                    handleAssign={handleAssign}
                    disabled={assignTo === task.assigned_to || loading}
                    loading={loading}
                  />
                )}
                {/* Activity log/timeline */}
                <div className="border-t pt-4 mt-6">
                  <label className="block font-bold mb-1">Activity Log</label>
                  {activityLoading ? (
                    <div className="text-muted-foreground text-sm">Loading activity log...</div>
                  ) : (
                    <TaskActivityTimeline activity={activity} usersById={usersById} />
                  )}
                </div>
              </>
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
