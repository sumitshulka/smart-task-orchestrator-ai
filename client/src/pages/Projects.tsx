import React from "react";
import { FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Projects() {
  return (
    <div className="w-full min-h-screen bg-background">
      <div className="w-full max-w-none px-6 py-6">
        <h2 className="text-2xl font-semibold mb-2">Projects</h2>
        <p className="text-muted-foreground mb-6">Manage your projects here.</p>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <FolderKanban className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Project Management</p>
            <p className="text-sm mt-1">Full project creation and tracking will be available in Step 2.</p>
            <p className="text-sm mt-1">Go to <strong>Settings → Project Templates</strong> to set up your templates first.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
