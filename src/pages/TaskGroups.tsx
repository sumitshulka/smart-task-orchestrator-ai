import React, { useState, useEffect } from "react";
import { fetchTaskGroups, createTaskGroup, deleteTaskGroup, fetchTaskGroupDetails, TaskGroup } from "@/integrations/supabase/taskGroups";
import TaskGroupCard from "@/components/TaskGroupCard";
import TaskGroupDetailsSheet from "@/components/TaskGroupDetailsSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import useSupabaseSession from "@/hooks/useSupabaseSession";

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
  const { user } = useSupabaseSession();

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

  return (
    <div className="max-w-4xl w-full p-4 mx-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Groups</h1>
        <Button onClick={() => setCreateOpen(v => !v)}>
          {createOpen ? "Cancel" : "Create Task Group"}
        </Button>
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
        <div className="flex flex-col gap-6">
          {groups.map(group => (
            <TaskGroupCard
              key={group.id}
              group={group}
              onView={() => handleViewDetails(group)}
              onDelete={() => handleDelete(group.id)}
              canDelete={!!user && group.task_count === 0 && group.owner_id === user.id}
            />
          ))}
        </div>
      )}
      <TaskGroupDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        group={detailsGroup}
      />
    </div>
  );
}
