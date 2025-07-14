
import React from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { TaskGroup } from "@/integrations/supabase/taskGroups";

type Props = {
  group: TaskGroup;
  onView?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  ownerName?: string;
  ownerEmail?: string;
};

const visibilityText: Record<TaskGroup["visibility"], string> = {
  private: "Private",
  managers_admin_only: "Managers & Admin Only",
  all_team_members: "All Team Members",
};

const getBorderColor = (visibility: TaskGroup["visibility"]) => {
  switch (visibility) {
    case "private":
      return "border-l-blue-800";
    case "all_team_members":
      return "border-l-green-800";
    default:
      return "border-l-gray-400";
  }
};

export default function TaskGroupCard({ group, onView, onDelete, canDelete, ownerName, ownerEmail }: Props) {
  const borderColorClass = getBorderColor(group.visibility);
  
  return (
    <div className={`rounded-lg shadow bg-white p-4 flex flex-col gap-3 border border-muted border-l-4 ${borderColorClass}`}>
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">{group.name}</div>
        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">{visibilityText[group.visibility]}</span>
      </div>
      <div className="text-muted-foreground text-sm">{group.description}</div>
      
      {/* Owner information */}
      <div className="text-xs text-gray-600">
        <span className="font-medium">Owner:</span> {ownerName || "Unknown"} 
        <span className="text-gray-400 ml-1">({ownerEmail || "No email"})</span>
      </div>
      
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
