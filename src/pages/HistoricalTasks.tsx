
import React, { useState } from "react";
import { fetchTasksPaginated, FetchTasksInput, Task } from "@/integrations/supabase/tasks";
import TaskCard from "@/components/TaskCard";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import TaskFiltersSidebar from "@/components/TaskFiltersSidebar";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

const pageSizeOptions = [25, 50, 75, 100];

export default function HistoricalTasksPage() {
  const { users, teams } = useUsersAndTeams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showTooManyWarning, setShowTooManyWarning] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setSearched(true);

    // Only allow search if there is at least one filter filled (beyond all "all")
    if (
      priorityFilter === "all" &&
      statusFilter === "all" &&
      userFilter === "all" &&
      teamFilter === "all" &&
      (!dateRange.from || !dateRange.to)
    ) {
      setTasks([]);
      setTotalTasks(0);
      return;
    }

    setLoading(true);
    setShowTooManyWarning(false);

    // Compute date filter for historical (older than 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    let input: FetchTasksInput = {
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };

    // Date range logic: restrict to only tasks older than 30 days
    if (dateRange.from && dateRange.to) {
      // But only for tasks until up to 30 days ago
      // Clamp to max end as 30 days ago
      const maxHistoricalEnd = thirtyDaysAgo.toISOString().slice(0, 10);
      const toDateStr = dateRange.to.toISOString().slice(0, 10);
      input.fromDate = dateRange.from.toISOString().slice(0, 10);
      input.toDate = toDateStr > maxHistoricalEnd ? maxHistoricalEnd : toDateStr;
    } else {
      // If no custom range filled, limit to any task created before 30 days ago
      input.toDate = thirtyDaysAgo.toISOString().slice(0, 10);
    }

    if (priorityFilter !== "all") input.priority = Number(priorityFilter);
    if (statusFilter !== "all") input.status = statusFilter;
    if (userFilter !== "all") input.assignedTo = userFilter;
    if (teamFilter !== "all") input.teamId = teamFilter;

    try {
      const { tasks, total } = await fetchTasksPaginated(input);
      if (total > 100) {
        setShowTooManyWarning(true);
        setTasks([]);
        setTotalTasks(total);
      } else {
        setTasks(tasks);
        setTotalTasks(total);
      }
    } catch (err) {
      setTasks([]);
      setTotalTasks(0);
    }
    setLoading(false);
  };

  // Page size/page change effect
  React.useEffect(() => {
    if (searched) handleSearch();
    // eslint-disable-next-line
  }, [page, pageSize]);

  return (
    <div className="flex w-full max-w-7xl mx-auto px-4 py-8">
      <TaskFiltersSidebar
        priorityFilter={priorityFilter}
        statusFilter={statusFilter}
        userFilter={userFilter}
        teamFilter={teamFilter}
        dateRange={dateRange}
        onPriorityChange={setPriorityFilter}
        onStatusChange={setStatusFilter}
        onUserChange={setUserFilter}
        onTeamChange={setTeamFilter}
        onDateRangeChange={setDateRange}
        users={users}
        teams={teams}
      />
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Historical Tasks</h1>
          <Button className="ml-auto" onClick={handleSearch}>
            Search
          </Button>
        </div>
        {showTooManyWarning && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded mb-4 text-center">
            <strong>
              Too many results ({totalTasks}). Please refine your filters to narrow down the results. Only up to 100 can be loaded at a time.
            </strong>
          </div>
        )}

        {loading && (
          <div className="text-muted-foreground mb-4 text-center">Loading...</div>
        )}
        {!loading && searched && tasks.length === 0 && !showTooManyWarning && (
          <div className="flex flex-col items-center justify-center mt-16">
            <div className="text-muted-foreground text-lg mb-2">
              No historical tasks found for given filters.
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-6">
          {!showTooManyWarning &&
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onTaskUpdated={handleSearch} canDelete={() => false} />
            ))}
        </div>
        {!!tasks.length && !showTooManyWarning && (
          <Pagination className="my-6">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(page > 1 ? page - 1 : 1)}
                  aria-disabled={page <= 1}
                />
              </PaginationItem>
              {Array.from(
                { length: Math.ceil(totalTasks / pageSize) },
                (_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      isActive={i + 1 === page}
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setPage(
                      page < Math.ceil(totalTasks / pageSize) ? page + 1 : page
                    )
                  }
                  aria-disabled={page >= Math.ceil(totalTasks / pageSize)}
                />
              </PaginationItem>
            </PaginationContent>
            <div className="flex items-center gap-2 ml-8">
              <span className="text-sm">Rows per page:</span>
              <select
                className="border rounded px-2 text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
              >
                {pageSizeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </Pagination>
        )}
      </div>
    </div>
  );
}
