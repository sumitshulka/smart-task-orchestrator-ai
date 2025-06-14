import React from "react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { format } from "date-fns";

type TaskFiltersSidebarProps = {
  priorityFilter: string;
  statusFilter: string;
  userFilter: string;
  teamFilter: string;
  dateRange: { from: Date | null; to: Date | null };
  onPriorityChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onUserChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onDateRangeChange: (range: { from: Date | null; to: Date | null }) => void;
  users: { id: string; email: string; user_name?: string }[];
  teams: { id: string; name: string }[];
};

const priorities = [
  { label: "All", value: "all" },
  { label: "High", value: "1" },
  { label: "Medium", value: "2" },
  { label: "Low", value: "3" },
];

const statuses = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

export default function TaskFiltersSidebar({
  priorityFilter, statusFilter, userFilter, teamFilter,
  dateRange, onPriorityChange, onStatusChange,
  onUserChange, onTeamChange, onDateRangeChange,
  users, teams,
}: TaskFiltersSidebarProps) {
  return (
    <aside className="w-full sm:w-64 bg-background border-r border-muted px-4 py-6 flex-shrink-0">
      <h3 className="text-xl font-bold mb-6">Filters</h3>
      <div className="mb-4">
        <div className="text-sm font-semibold mb-1">Priority</div>
        <Select value={priorityFilter} onValueChange={onPriorityChange}>
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorities.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4">
        <div className="text-sm font-semibold mb-1">Status</div>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4">
        <div className="text-sm font-semibold mb-1">Assigned User</div>
        <Select value={userFilter} onValueChange={onUserChange}>
          <SelectTrigger>
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.user_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4">
        <div className="text-sm font-semibold mb-1">Team</div>
        <Select value={teamFilter} onValueChange={onTeamChange}>
          <SelectTrigger>
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="text-sm font-semibold mb-1">Creation Date Range</div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left">
              {dateRange.from && dateRange.to
                ? `${format(dateRange.from, "yyyy-MM-dd")} - ${format(dateRange.to, "yyyy-MM-dd")}`
                : "Select range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range: any) => onDateRangeChange(range)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}
