import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare } from "lucide-react";
import WorkspaceTab from "./WorkspaceTab";

interface Props {
  entityType: "task" | "project" | "milestone" | "defect";
  entityId: string;
  label?: string;
  /** Render your own trigger element instead of the default button */
  trigger?: (open: () => void) => React.ReactNode;
}

const WorkspaceDialog: React.FC<Props> = ({ entityType, entityId, label, trigger }) => {
  const [open, setOpen] = useState(false);

  const defaultTrigger = (
    <button
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      title="Open Workspace"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
    >
      <MessageSquare className="w-3.5 h-3.5" />
      {label ?? "Workspace"}
    </button>
  );

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : defaultTrigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl w-full"
          style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="flex-shrink-0 pb-2 border-b border-gray-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              Workspace
              <span className="text-xs font-normal text-gray-400 ml-1">
                — messages, decisions &amp; files
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pt-3 min-h-0">
            <WorkspaceTab entityType={entityType} entityId={entityId} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkspaceDialog;
