
import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, Search, Plus } from "lucide-react";
import { format } from "date-fns";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import CreateDefectSheet from "@/components/CreateDefectSheet";
import DefectDetailsSheet from "@/components/DefectDetailsSheet";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-800 border-orange-200",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  low:      "bg-green-100 text-green-800 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  draft:       "bg-gray-100 text-gray-600 border-gray-200",
  submitted:   "bg-blue-100 text-blue-800 border-blue-200",
  approved:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected:    "bg-red-100 text-red-800 border-red-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  resolved:    "bg-teal-100 text-teal-800 border-teal-200",
  verified:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed:      "bg-gray-200 text-gray-700 border-gray-300",
  reopened:    "bg-red-100 text-red-800 border-red-200",
};

function formatDefectNumber(n: number) {
  return `DEF-${String(n).padStart(5, "0")}`;
}

export default function MyDefectsPage() {
  const { user } = useSupabaseSession();
  const { roles } = useCurrentUserRoleAndTeams();
  const { users } = useUsersAndTeams();
  const queryClient = useQueryClient();

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager") || roles.includes("team_manager");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<any>(null);

  const { data: allDefects = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/defects"],
    queryFn: () => apiClient.get("/defects"),
  });

  const myDefects = useMemo(() => {
    if (!user?.id) return [];
    return allDefects.filter(
      (d) => d.reported_by === user.id || d.assigned_to === user.id
    );
  }, [allDefects, user?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return myDefects.filter((d) => {
      const matchesSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        formatDefectNumber(d.defect_number).toLowerCase().includes(q);
      const matchesStatus = filterStatus === "all" || d.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [myDefects, search, filterStatus]);

  const getUserName = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((u) => u.id === id);
    return u ? u.user_name || u.email : "—";
  };

  const reportedByMe = myDefects.filter((d) => d.reported_by === user?.id).length;
  const assignedToMe = myDefects.filter((d) => d.assigned_to === user?.id).length;
  const openCount    = myDefects.filter((d) => ["draft","submitted","approved","in_progress","reopened"].includes(d.status)).length;

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bug className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-semibold">My Defects</h1>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Report Defect
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Reported by Me</p>
            <p className="text-2xl font-bold mt-1">{reportedByMe}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Assigned to Me</p>
            <p className="text-2xl font-bold mt-1">{assignedToMe}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Open / Active</p>
            <p className="text-2xl font-bold mt-1 text-orange-600">{openCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search my defects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="reopened">Reopened</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bug className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{myDefects.length === 0 ? "You haven't reported or been assigned any defects yet." : "No defects match your filters."}</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground w-28">ID</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left p-3 font-medium text-muted-foreground w-24">Severity</th>
                  <th className="text-left p-3 font-medium text-muted-foreground w-28">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground w-32">Role</th>
                  <th className="text-left p-3 font-medium text-muted-foreground w-28">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((defect) => (
                  <tr
                    key={defect.id}
                    className="border-b last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedDefect(defect)}
                  >
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {formatDefectNumber(defect.defect_number)}
                    </td>
                    <td className="p-3 font-medium max-w-xs truncate">{defect.title}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${SEVERITY_COLORS[defect.severity] || ""}`}>
                        {defect.severity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[defect.status] || ""}`}>
                        {defect.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {defect.reported_by === user?.id && defect.assigned_to === user?.id
                        ? "Reporter & Assignee"
                        : defect.reported_by === user?.id
                        ? "Reporter"
                        : "Assignee"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {defect.created_at ? format(new Date(defect.created_at), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
