
import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Bug } from "lucide-react";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import CreateDefectSheet from "@/components/CreateDefectSheet";
import DefectDetailsSheet from "@/components/DefectDetailsSheet";

const COLUMNS = [
  { key: "open",        label: "Open",        color: "border-t-blue-500"    },
  { key: "in_progress", label: "In Progress",  color: "border-t-purple-500"  },
  { key: "resolved",    label: "Resolved",     color: "border-t-teal-500"    },
  { key: "verified",    label: "Verified",     color: "border-t-emerald-500" },
  { key: "closed",      label: "Closed",       color: "border-t-gray-400"    },
  { key: "reopened",    label: "Reopened",     color: "border-t-red-500"     },
];

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-yellow-500",
  low:      "bg-green-500",
};

function formatDefectNumber(n: number) {
  return `DEF-${String(n).padStart(5, "0")}`;
}

export default function DefectBoardPage() {
  const { user } = useSupabaseSession();
  const { roles } = useCurrentUserRoleAndTeams();
  const { users } = useUsersAndTeams();
  const queryClient = useQueryClient();

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager") || roles.includes("team_manager");

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<any>(null);

  const { data: defects = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/defects"],
    queryFn: () => apiClient.get("/defects"),
  });

  const byStatus = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const d of defects) {
      if (map[d.status]) map[d.status].push(d);
      else map["open"].push(d);
    }
    return map;
  }, [defects]);

  const getUserName = (id: string | null) => {
    if (!id) return null;
    const u = users.find((u) => u.id === id);
    return u ? u.user_name || u.email : null;
  };

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bug className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-semibold">Defect Board</h1>
            <Badge variant="outline">{defects.length} total</Badge>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Report Defect
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading board…</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => {
              const cards = byStatus[col.key] || [];
              return (
                <div
                  key={col.key}
                  className={`flex-shrink-0 w-64 rounded-lg border bg-muted/30 border-t-4 ${col.color}`}
                >
                  {/* Column header */}
                  <div className="px-3 py-2 flex items-center justify-between border-b bg-card rounded-t-md">
                    <span className="text-sm font-semibold">{col.label}</span>
                    <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                  </div>

                  {/* Cards */}
                  <div className="p-2 flex flex-col gap-2 min-h-[120px]">
                    {cards.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">No defects</div>
                    ) : (
                      cards.map((defect) => (
                        <div
                          key={defect.id}
                          className="bg-card rounded-md border p-3 cursor-pointer hover:shadow-sm transition-shadow"
                          onClick={() => setSelectedDefect(defect)}
                        >
                          {/* Number + severity dot */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[defect.severity] || "bg-gray-400"}`}
                            />
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {formatDefectNumber(defect.defect_number)}
                            </span>
                            <span className="text-[10px] capitalize text-muted-foreground ml-auto">
                              {defect.type}
                            </span>
                          </div>

                          {/* Title */}
                          <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">
                            {defect.title}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="capitalize">{defect.environment}</span>
                            {getUserName(defect.assigned_to) && (
                              <span className="truncate ml-2 max-w-[90px]">
                                {getUserName(defect.assigned_to)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateDefectSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        currentUserId={user?.id || ""}
      />

      {selectedDefect && (
        <DefectDetailsSheet
          defect={selectedDefect}
          open={!!selectedDefect}
          onOpenChange={(open) => { if (!open) setSelectedDefect(null); }}
          currentUserId={user?.id || ""}
          isAdmin={isAdmin}
          isManager={isManager}
          onUpdated={(updated) => {
            setSelectedDefect(updated);
            queryClient.invalidateQueries({ queryKey: ["/api/defects"] });
          }}
        />
      )}
    </div>
  );
}
