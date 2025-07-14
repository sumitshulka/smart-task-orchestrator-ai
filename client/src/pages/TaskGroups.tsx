
import React, { useState, useEffect } from "react";
import { fetchTaskGroups, createTaskGroup, deleteTaskGroup, fetchTaskGroupDetails, TaskGroup } from "@/integrations/supabase/taskGroups";
import TaskGroupCard from "@/components/TaskGroupCard";
import TaskGroupDetailsSheet from "@/components/TaskGroupDetailsSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useUserList } from "@/hooks/useUserList";
import { format, startOfMonth, endOfMonth } from "date-fns";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";

function defaultDateRange() {
  const now = new Date();
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

const visibilityOptions = [
  { value: "private", label: "Private" },
  { value: "managers_admin_only", label: "Managers & Admin Only" },
  { value: "all_team_members", label: "All Team Members" },
];

export default function TaskGroupsPage() {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    visibility: "private" | "managers_admin_only" | "all_team_members";
  }>({ name: "", description: "", visibility: "private" });
  const [detailsGroup, setDetailsGroup] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState(defaultDateRange());
  const [preset, setPreset] = useState<string>("This Month");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [createdByFilter, setCreatedByFilter] = useState<string>("all");
  
  const { user } = useSupabaseSession();
  const { users } = useUserList();

  async function load() {
    setLoading(true);
    try {
      const g = await fetchTaskGroups();
      setGroups(g);
    } catch (err: any) {
      toast({ title: "Failed to load groups", description: err.message });
      setGroups([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const newG = await createTaskGroup({
        name: form.name,
        description: form.description,
        visibility: form.visibility,
      });
      toast({ title: "Group created" });
      setForm({ name: "", description: "", visibility: "private" });
      setCreateOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Failed to create group", description: err.message });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this task group? Only possible if group has no tasks.")) return;
    try {
      await deleteTaskGroup(id);
      toast({ title: "Group deleted" });
      load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message });
    }
  }

  async function handleViewDetails(group: TaskGroup) {
    // Fetch group + attached tasks
    try {
      const details = await fetchTaskGroupDetails(group.id);
      setDetailsGroup(details);
      setDetailsOpen(true);
    } catch (err: any) {
      toast({ title: "Failed to fetch group details", description: err.message });
    }
  }

  const getOwnerInfo = (ownerId: string) => {
    const owner = users.find(u => u.id === ownerId);
    return {
      name: owner?.user_name || owner?.email || "Unknown",
      email: owner?.email || "No email"
    };
  };

  function handlePresetChange(range: { from: Date | null; to: Date | null }, p: string) {
    setPreset(p);
    if (p === "custom") return;
    setDateRange(range);
  }

  // Filter groups based on applied filters
  const filteredGroups = groups.filter(group => {
    // Search query filter
    if (searchQuery && !group.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !group.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Date range filter (based on created_at)
    if (dateRange.from && dateRange.to) {
      const groupDate = new Date(group.created_at);
      if (groupDate < dateRange.from || groupDate > dateRange.to) {
        return false;
      }
    }

    // Visibility filter
    if (visibilityFilter !== "all" && group.visibility !== visibilityFilter) {
      return false;
    }

    // Created by filter
    if (createdByFilter !== "all" && group.owner_id !== createdByFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="w-full p-4 mx-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Groups</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
          </Button>
          <Button onClick={() => setCreateOpen(v => !v)}>
            {createOpen ? "Cancel" : "Create Task Group"}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <Input
            placeholder="Search task groups by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <h3 className="text-lg font-medium mb-4">Advanced Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium mb-2">Created Date Range</label>
                <DateRangePresetSelector
                  dateRange={dateRange}
                  preset={preset}
                  onChange={handlePresetChange}
                />
              </div>

              {/* Visibility Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Visibility</label>
                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Visibility Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visibility Types</SelectItem>
                    {visibilityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Created By Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Created By</label>
                <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Creators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Creators</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.user_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
      {createOpen && (
        <form className="space-y-4 border rounded-lg p-4 mb-8 bg-white shadow" onSubmit={handleCreate}>
          <div>
            <label className="block font-medium mb-1">Group Name</label>
            <Input
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="Enter group name"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Description</label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Enter description"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Visibility</label>
            <select
              value={form.visibility}
              onChange={e => setForm(f => ({
                ...f,
                visibility: e.target.value as "private" | "managers_admin_only" | "all_team_members"
              }))}
              className="w-full border rounded p-2"
              required
            >
              {visibilityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Button type="submit">Create Group</Button>
        </form>
      )}
      {loading ? (
        <div className="text-muted-foreground">Loading groups...</div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredGroups.length} of {groups.length} task groups
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map(group => {
            const ownerInfo = getOwnerInfo(group.owner_id);
            return (
              <TaskGroupCard
                key={group.id}
                group={group}
                onView={() => handleViewDetails(group)}
                onDelete={() => handleDelete(group.id)}
                canDelete={!!user && group.task_count === 0 && group.owner_id === user.id}
                ownerName={ownerInfo.name}
                ownerEmail={ownerInfo.email}
              />
            );
            })}
          </div>
        </>
      )}
      <TaskGroupDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        group={detailsGroup}
      />
    </div>
  );
}
