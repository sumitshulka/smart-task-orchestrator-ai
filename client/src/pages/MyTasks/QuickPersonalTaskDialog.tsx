import React, { useEffect, useState } from "react";
import { CalendarDays, Clock3, Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface QuickPersonalTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus: string;
  userId?: string;
  onTaskCreated: () => void | Promise<void>;
}

function getLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function QuickPersonalTaskDialog({
  open,
  onOpenChange,
  defaultStatus,
  userId,
  onTaskCreated,
}: QuickPersonalTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(getLocalDate);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setEstimatedHours("");
    setStartDate(getLocalDate());
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const hours = Number(estimatedHours);

    if (!title.trim()) {
      toast({
        title: "Task title required",
        description: "Enter a title before saving the task.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      toast({
        title: "Estimated hours required",
        description: "Enter a value greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Unable to create task",
        description: "Your user session is not available. Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const dailyHours = await apiClient.get(
        `/tasks/daily-hours?date=${encodeURIComponent(startDate)}`
      );

      if (
        dailyHours.enabled &&
        dailyHours.current_hours + hours > dailyHours.max_hours_per_day
      ) {
        toast({
          title: "Daily hour limit exceeded",
          description: `You have ${Number(dailyHours.remaining_hours).toFixed(1)} hours remaining for ${startDate}.`,
          variant: "destructive",
        });
        return;
      }

      await apiClient.createTask({
        title: title.trim(),
        description: description.trim() || null,
        status: defaultStatus || "New",
        priority: 2,
        start_date: startDate,
        due_date: startDate,
        estimated_hours: hours,
        type: "personal",
        created_by: userId,
        assigned_to: userId,
        team_id: null,
        is_time_managed: false,
        timer_state: "stopped",
        time_spent_minutes: 0,
      });

      toast({ title: "Personal task created", description: title.trim() });
      await onTaskCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Failed to create task",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick personal task</DialogTitle>
          <DialogDescription>
            Add a task to your Default column. You can add more details later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="quick-task-title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="quick-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="quick-task-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="quick-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a short note (optional)"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="quick-task-hours" className="text-sm font-medium">
              Estimated Hours <span className="text-destructive">*</span>
            </label>
            <Input
              id="quick-task-hours"
              type="number"
              min="1"
              step="1"
              value={estimatedHours}
              onChange={(event) => setEstimatedHours(event.target.value)}
              placeholder="e.g. 2"
              required
            />
          </div>

          <div className="rounded-lg border border-muted bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Defaults applied
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs text-foreground">
              <div className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                {defaultStatus || "New"}
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                Today
              </div>
              <div className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                Medium
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Start date and end date are both set to today. Priority is Medium.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}