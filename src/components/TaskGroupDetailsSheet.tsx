import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { TaskGroup } from "@/integrations/supabase/taskGroups";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: any | null;
};

export default function TaskGroupDetailsSheet({ open, onOpenChange, group }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[108rem] w-[98vw]">
        <SheetHeader>
          <SheetTitle>{group?.name || "Task Group"}</SheetTitle>
          <SheetDescription>
            {group?.description || "No description provided."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <h2 className="font-bold mb-3">Tasks in Group ({group?.tasks?.length || 0}):</h2>
          <div className="space-y-2">
            {group?.tasks?.length ? (
              group.tasks.map((taskItem: any) => (
                <div
                  key={taskItem.task?.id}
                  className="p-3 rounded-lg border flex items-center justify-between bg-gray-50"
                >
                  <div>
                    <span className="font-medium">{taskItem.task.title}</span>
                    <span className="ml-3 text-xs px-2 py-1 rounded bg-slate-200">
                      {taskItem.task.status}
                    </span>
                  </div>
                  {/* Add more details/status if needed */}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">No tasks in this group.</div>
            )}
          </div>
        </div>
        <SheetFooter className="mt-8">
          <SheetClose asChild>
            <Button variant="ghost">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
