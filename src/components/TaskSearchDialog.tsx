
import React, { useState, useCallback } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useDebounce } from "use-debounce";
import { fetchTasksPaginated, Task } from "@/integrations/supabase/tasks";
import { Badge } from "@/components/ui/badge";

// Props:
// - open: boolean
// - onOpenChange: function(bool)
// - onSelect: function(Task)
// - excludeTaskId?: string (optional; exclude this task from the results, e.g. current new form task)
interface TaskSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (task: Task) => void;
  excludeTaskId?: string;
}

const DEFAULT_PAGE_SIZE = 15;

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

const TaskSearchDialog: React.FC<TaskSearchDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
  excludeTaskId,
}) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Search tasks using Supabase, with pagination & filters
  const doSearch = useCallback(async () => {
    setLoading(true);
    const filters: any = {
      limit: DEFAULT_PAGE_SIZE,
      offset: (page - 1) * DEFAULT_PAGE_SIZE,
    };
    if (statusFilter && statusFilter !== "all") {
      filters.status = statusFilter;
    }
    // If query is non-empty, use as full-text (title/desc) search (lowercase includes)
    if (debouncedQuery) {
      filters.query = debouncedQuery;
    }
    // NOTE: If the codebase or Supabase API supports direct text search, use that. Otherwise, filter client-side below.
    let { tasks: allFound, total: foundTotal } = await fetchTasksPaginated(filters);
    // If query provided, filter on title/desc on client if needed
    if (debouncedQuery) {
      const keyword = debouncedQuery.toLowerCase();
      allFound = allFound.filter(
        t =>
          (t.title && t.title.toLowerCase().includes(keyword)) ||
          (t.description && t.description.toLowerCase().includes(keyword))
      );
      foundTotal = allFound.length;
    }
    // Exclude current (new) task if excludeTaskId is given
    let filtered = excludeTaskId
      ? allFound.filter(t => t.id !== excludeTaskId)
      : allFound;
    setTasks(filtered);
    setTotal(foundTotal);
    setLoading(false);
  }, [debouncedQuery, statusFilter, page, excludeTaskId]);

  // Run search when filters/query/etc change
  React.useEffect(() => {
    if (open) {
      doSearch();
    }
    // eslint-disable-next-line
  }, [debouncedQuery, statusFilter, page, open]);

  // Reset state when closed
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setStatusFilter("all");
      setPage(1);
      setTasks([]);
    }
  }, [open]);

  const handleSelect = (task: Task) => {
    onSelect(task);
    onOpenChange(false);
  };

  // Pagination logic (simple "Next"/"Prev" for now)
  const hasNext = page * DEFAULT_PAGE_SIZE < total;
  const hasPrev = page > 1;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex p-2 gap-2 border-b items-center">
        <CommandInput
          placeholder="Search tasks by title or description..."
          value={query}
          onValueChange={setQuery}
          autoFocus
        />
        <select
          className="ml-2 border rounded px-2 py-1 bg-white text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <CommandList>
        {loading && <div className="text-center text-muted-foreground py-6">Loading...</div>}
        <CommandEmpty>No tasks found.</CommandEmpty>
        <CommandGroup heading="Tasks">
          {tasks.map(task => (
            <CommandItem key={task.id} onSelect={() => handleSelect(task)}>
              <div>
                <div className="font-semibold">{task.title}</div>
                <div className="text-xs text-muted-foreground">{task.description}</div>
                <Badge variant="outline" className="mt-1">{task.status}</Badge>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <div className="flex justify-between px-4 py-2">
          <button
            className="text-xs px-2 py-1 border rounded disabled:opacity-60"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!hasPrev || loading}
          >
            Previous
          </button>
          <span className="text-xs">Page {page}</span>
          <button
            className="text-xs px-2 py-1 border rounded disabled:opacity-60"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext || loading}
          >
            Next
          </button>
        </div>
      </CommandList>
    </CommandDialog>
  );
};

export default TaskSearchDialog;
