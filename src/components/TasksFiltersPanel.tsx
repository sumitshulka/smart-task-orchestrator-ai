
import React from "react";
import TaskFiltersSidebar from "@/components/TaskFiltersSidebar";
import { TaskStatus } from "@/hooks/useTaskStatuses";

type TasksFiltersPanelProps = {
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  userFilter: string;
  setUserFilter: (v: string) => void;
  teamFilter: string;
  setTeamFilter: (v: string) => void;
  dateRange: { from: Date | null; to: Date | null };
  setDateRange: (v: { from: Date | null; to: Date | null }) => void;
  users: { id: string; email: string; user_name?: string }[];
  teams: { id: string; name: string }[];
  statuses: TaskStatus[];
  statusesLoading: boolean;
};
export default function TasksFiltersPanel({
  priorityFilter, setPriorityFilter,
  statusFilter, setStatusFilter,
  userFilter, setUserFilter,
  teamFilter, setTeamFilter,
  dateRange, setDateRange,
  users, teams, statuses, statusesLoading
}: TasksFiltersPanelProps) {
  return (
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
      statuses={statuses}
      statusesLoading={statusesLoading}
    />
  );
}
