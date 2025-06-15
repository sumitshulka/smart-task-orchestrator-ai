
import React from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { TaskGroup } from "@/integrations/supabase/taskGroups";

type Props = {
  group: TaskGroup;
  onView?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
};

const visibilityText: Record<TaskGroup["visibility"], string> = {
  private: "Private",
  managers_admin_only: "Managers & Admin Only",
  all_team_members: "All Team Members",
};

export default function TaskGroupCard({ group, onView, onDelete, canDelete }: Props) {
  return (
    <div className="rounded-lg shadow bg-white p-4 flex flex-col gap-3 border border-muted">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">{group.name}</div>
        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">{visibilityText[group.visibility]}</span>
      </div>
      <div className="text-muted-foreground text-sm">{group.description}</div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-gray-700">Tasks: <b>{group.task_count ?? 0}</b></span>
        {onView && (
          <Button size="sm" variant="outline" onClick={onView} className="ml-auto">
            <Eye className="h-4 w-4 mr-1" /> View Details
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="destructive" onClick={onDelete}>
            Delete Group
          </Button>
        )}
      </div>
    </div>
  );
}
