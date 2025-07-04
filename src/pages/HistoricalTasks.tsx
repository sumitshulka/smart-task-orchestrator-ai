
import React, { useState, useMemo } from "react";
import { fetchTasksPaginated, FetchTasksInput, Task } from "@/integrations/supabase/tasks";
import TaskCard from "@/components/TaskCard";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import TaskFiltersSidebar from "@/components/TaskFiltersSidebar";
import { Button } from "@/components/ui/button";
import TasksPagination from "@/components/TasksPagination";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { usePaginatedTasks } from "@/hooks/usePaginatedTasks";
import TasksFiltersPanel from "@/components/TasksFiltersPanel";

const pageSizeOptions = [25, 50, 75, 100];

export default function HistoricalTasksPage() {
  const {
    tasks,
    totalTasks,
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    showTooManyWarning,
    searched,
    handleSearch,
    filters,
    users,
    teams,
    roles,
    user,
  } = usePaginatedTasks({ isHistorical: true, initialPageSize: 25 });
  const { statuses, loading: statusesLoading } = useTaskStatuses();

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="w-full max-w-none px-6 py-6">
        <div className="flex w-full max-w-none">
          <TasksFiltersPanel
            priorityFilter={filters.priorityFilter}
            setPriorityFilter={filters.setPriorityFilter}
            statusFilter={filters.statusFilter}
            setStatusFilter={filters.setStatusFilter}
            userFilter={filters.userFilter}
            setUserFilter={filters.setUserFilter}
            teamFilter={filters.teamFilter}
            setTeamFilter={filters.setTeamFilter}
            dateRange={filters.dateRange}
            setDateRange={filters.setDateRange}
            users={users}
            teams={teams}
            statuses={statuses}
            statusesLoading={statusesLoading}
          />
          <div className="flex-1 ml-6">
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
              <TasksPagination
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                totalTasks={totalTasks}
                pageSizeOptions={pageSizeOptions}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
