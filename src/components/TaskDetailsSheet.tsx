
import React, { useState } from "react";
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
  const [comment, setComment] = useState("");
  const [assignTo, setAssignTo] = useState(task?.assigned_to || "");
  const { users } = useUsersAndTeams();
  const [loading, setLoading] = useState(false);

  if (!task) return null;

  const showAssign = hasManagerPermissions(currentUser);

  async function handleAssign() {
    setLoading(true);
    try {
      await updateTask(task.id, { assigned_to: assignTo });
      toast({ title: "Task assignee updated" });
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to re-assign", description: err.message });
    }
    setLoading(false);
  }

  function handleComment() {
    // Placeholder: Integration with comments backend would go here
    toast({ title: "Comment added (not yet implemented)" });
    setComment("");
  }

  // Make modal content scrollable
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-2xl w-[95vw] p-0">
        <form className="h-full flex flex-col" onSubmit={e => e.preventDefault()}>
          <ScrollArea className="flex-1 min-h-0 p-6">
            <SheetHeader>
              <SheetTitle>Task Details</SheetTitle>
              <SheetDescription>
                All task details and assignment.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Task Title</label>
                <div>{task.title}</div>
              </div>
              <div>
                <label className="block font-bold mb-1">Status</label>
                <div>{task.status}</div>
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
            {showAssign && (
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
