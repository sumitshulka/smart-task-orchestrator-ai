import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckSquare, CheckCircle, XCircle, Clock, Search,
  FolderKanban, ChevronRight, AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { NavLink } from "react-router-dom";

type Status = "all" | "pending" | "approved" | "rejected";
type EntityFilter = "all" | "task" | "project";

interface Decision {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  creator_name: string | null;
  creator_email: string | null;
  entity_title: string | null;
  entity_number: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  color: "bg-amber-100 text-amber-700 border-amber-200",  icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approved", color: "bg-green-100 text-green-700 border-green-200",  icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200",        icon: <XCircle className="w-3 h-3" /> },
};

const QUERY_KEY = ["/api/workspace/decisions/all"];

export default function DecisionsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [search, setSearch] = useState("");

  const { data: decisions = [], isLoading } = useQuery<Decision[]>({
    queryKey: QUERY_KEY,
    queryFn: () => apiRequest("/api/workspace/decisions/all"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/workspace/decisions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: status === "approved" ? "Decision approved" : status === "rejected" ? "Decision rejected" : "Status updated" });
    },
    onError: () => toast({ title: "Failed to update decision", variant: "destructive" }),
  });

  const filtered = decisions.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (entityFilter !== "all" && d.entity_type !== entityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q) ||
        (d.entity_title ?? "").toLowerCase().includes(q) ||
        (d.creator_name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: decisions.length,
    pending: decisions.filter(d => d.status === "pending").length,
    approved: decisions.filter(d => d.status === "approved").length,
    rejected: decisions.filter(d => d.status === "rejected").length,
  };

  const entityLink = (d: Decision) => {
    if (d.entity_type === "task") return `/admin/tasks`;
    if (d.entity_type === "project") return `/projects/${d.entity_id}`;
    return "#";
  };

  const entityLabel = (d: Decision) => {
    if (d.entity_type === "task" && d.entity_title)
      return `Task #${d.entity_number ?? ""} — ${d.entity_title}`;
    if (d.entity_type === "project" && d.entity_title)
      return `Project: ${d.entity_title}`;
    return d.entity_type.charAt(0).toUpperCase() + d.entity_type.slice(1);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-amber-600" />
            Decisions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and approve pending decisions across tasks and projects
          </p>
        </div>
        {counts.pending > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {counts.pending} pending approval
            </span>
          </div>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
          {(["all", "pending", "approved", "rejected"] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize flex items-center gap-1.5
                ${statusFilter === s ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              {s !== "all" && STATUS_CONFIG[s]?.icon}
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Entity type filter */}
        <div className="flex items-center gap-1">
          {(["all", "task", "project"] as EntityFilter[]).map(e => (
            <button
              key={e}
              onClick={() => setEntityFilter(e)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize
                ${entityFilter === e
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"}`}
            >
              {e === "all" ? "All Types" : e === "task" ? "Tasks" : "Projects"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search decisions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 w-56 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <CheckSquare className="w-12 h-12 opacity-20" />
          <p className="text-sm">
            {decisions.length === 0
              ? "No decisions recorded yet."
              : "No decisions match your current filters."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(d => {
            const sc = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.pending;
            const isPending = d.status === "pending";
            return (
              <div
                key={d.id}
                className={`bg-white border rounded-xl p-4 shadow-sm flex gap-4 transition-shadow hover:shadow-md
                  ${isPending ? "border-amber-200" : "border-gray-200"}`}
              >
                {/* Status indicator stripe */}
                <div className={`w-1 rounded-full flex-shrink-0 self-stretch
                  ${d.status === "approved" ? "bg-green-400" : d.status === "rejected" ? "bg-red-400" : "bg-amber-400"}`} />

                <div className="flex-1 min-w-0 space-y-2">
                  {/* Top row */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm flex-1 min-w-0">{d.title}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>
                      {sc.icon}{sc.label}
                    </span>
                  </div>

                  {/* Description */}
                  {d.description && (
                    <p className="text-xs text-gray-500 leading-relaxed">{d.description}</p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
                    {/* Entity link */}
                    <NavLink
                      to={entityLink(d)}
                      className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                    >
                      {d.entity_type === "task"
                        ? <CheckSquare className="w-3 h-3" />
                        : <FolderKanban className="w-3 h-3" />}
                      <span className="truncate max-w-[200px]">{entityLabel(d)}</span>
                      <ChevronRight className="w-3 h-3 opacity-50" />
                    </NavLink>

                    {/* Creator */}
                    <span>
                      By{" "}
                      <span className="font-medium text-gray-600">
                        {d.creator_name ?? d.creator_email ?? "Unknown"}
                      </span>
                    </span>

                    {/* Date */}
                    <span>{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                  </div>
                </div>

                {/* Action buttons */}
                {isPending && (
                  <div className="flex flex-col gap-2 flex-shrink-0 justify-center">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white h-8 px-4 text-xs"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: d.id, status: "approved" })}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-4 text-xs"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: d.id, status: "rejected" })}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
                {!isPending && (
                  <div className="flex flex-col gap-2 flex-shrink-0 justify-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-600 h-8 px-3 text-xs"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: d.id, status: "pending" })}
                    >
                      Reset to Pending
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
