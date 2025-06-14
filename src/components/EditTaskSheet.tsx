
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
    status: task.status,
    estimated_hours: task.estimated_hours || "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority || 2,
        due_date: task.due_date ? task.due_date.slice(0, 10) : "",
        status: task.status,
        estimated_hours: task.estimated_hours || "",
      });
    }
  }, [open, task]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === "priority") {
      setForm(f => ({ ...f, [name]: Number(value) }));
    } else if (name === "estimated_hours") {
      setForm(f => ({ ...f, [name]: value }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
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
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
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
          </div>
          <SheetFooter className="mt-8">
            <Button type="submit" disabled={loading}>
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
