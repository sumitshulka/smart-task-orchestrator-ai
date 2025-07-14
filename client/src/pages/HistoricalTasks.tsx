
import React, { useState, useMemo } from "react";
import { fetchTasksPaginated, FetchTasksInput, Task } from "@/integrations/supabase/tasks";
import TaskCard from "@/components/TaskCard";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import TasksPagination from "@/components/TasksPagination";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { usePaginatedTasks } from "@/hooks/usePaginatedTasks";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";

function defaultDateRange() {
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  return {
    from: startOfMonth(lastMonth),
    to: endOfMonth(lastMonth),
  };
}

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

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [preset, setPreset] = useState<string>("Last Month");

  function handlePresetChange(range: { from: Date | null; to: Date | null }, p: string) {
    setPreset(p);
    if (p === "custom") return;
    filters.setDateRange(range);
  }

  return (
    <div className="w-full p-4 mx-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Historical Tasks</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Search historical tasks by title, description, or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <h3 className="text-lg font-medium mb-4">Advanced Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Date Range */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <DateRangePresetSelector
                  dateRange={filters.dateRange}
                  preset={preset}
                  onChange={handlePresetChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <Select value={filters.priorityFilter} onValueChange={filters.setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <Select value={filters.statusFilter} onValueChange={filters.setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statuses.map(status => (
                      <SelectItem key={status.id} value={status.name}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Assigned To</label>
                <Select value={filters.userFilter} onValueChange={filters.setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.user_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Team</label>
                <Select value={filters.teamFilter} onValueChange={filters.setTeamFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1">
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
            <div className="w-40 h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
              <Search className="w-16 h-16 text-gray-400" />
            </div>
            <div className="text-muted-foreground text-lg mb-2">No historical tasks found</div>
            <div className="text-sm text-gray-500">Try adjusting your filters or search criteria</div>
          </div>
        )}

        {!loading && searched && tasks.length > 0 && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Showing {tasks.length} of {totalTasks} historical tasks
            </div>
            <div className="grid gap-4">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} users={users} canDelete={() => false} />
              ))}
            </div>
            <TasksPagination
              page={page}
              pageSize={pageSize}
              total={totalTasks}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={pageSizeOptions}
            />
          </>
        )}
      </div>
    </div>
  );
}
