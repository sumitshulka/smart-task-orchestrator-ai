import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, TrendingUp, Users,
  Milestone, Layers, BarChart3, FileText, RefreshCw, Calendar,
  AlertCircle, Activity, Target
} from "lucide-react";
import { format, differenceInDays, isPast, isFuture } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────
interface MilestoneStage { id: string; name: string; status: string; }
interface MilestoneWithStages {
  id: string; name: string; status: string;
  start_date: string | null; end_date: string | null;
  project_id: string; stages: MilestoneStage[];
}
interface ProjectMember {
  id: string; user_id: string; project_id: string;
  member_type: string; project_role: string | null; allocation_percentage: number;
}
interface ProjectFeature { id: string; name: string; status: string; project_id: string; }
interface ProjectTask {
  id: string; title: string; status: string; assigned_to: string | null;
  project_id: string | null; estimated_hours: number | null;
  time_spent_minutes: number | null;
}
interface ReportProject {
  id: string; name: string; client_name: string | null; status: string;
  project_type: string; start_date: string | null; projected_end_date: string | null;
  actual_end_date: string | null; total_effort_hours: number | null;
  is_confirmed: boolean; color: string | null; budget_amount: string | null; currency: string | null;
  milestones: MilestoneWithStages[];
  members: ProjectMember[];
  features: ProjectFeature[];
  tasks: ProjectTask[];
}
interface ReportUser { id: string; user_name: string; email: string; department: string | null; }
interface ReportData { projects: ReportProject[]; users: ReportUser[]; }

// ── Constants ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  planning: "Planning", active: "Active", on_hold: "On Hold",
  completed: "Completed", cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  on_hold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const MS_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};
const TYPE_LABELS: Record<string, string> = {
  fixed_cost: "Fixed Cost", time_material: "T&M", milestone: "Milestone", retainer: "Retainer",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function isCompleted(status: string) {
  return status.toLowerCase().includes("complet");
}

function delayTrafficLight(project: ReportProject): { icon: string; label: string; color: string } {
  if (project.status === "cancelled") return { icon: "⚫", label: "Cancelled", color: "text-gray-400" };
  if (project.status === "completed") return { icon: "🟢", label: "Completed", color: "text-green-600" };
  if (!project.projected_end_date) return { icon: "⚪", label: "No deadline", color: "text-gray-400" };
  const endDate = new Date(project.projected_end_date);
  const daysLeft = differenceInDays(endDate, new Date());
  if (daysLeft < 0) return { icon: "🔴", label: `Overdue ${Math.abs(daysLeft)}d`, color: "text-red-600 font-semibold" };
  if (daysLeft <= 14) return { icon: "🟡", label: `${daysLeft}d left`, color: "text-yellow-600 font-medium" };
  return { icon: "🟢", label: `${daysLeft}d left`, color: "text-green-600" };
}

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function completionPct(project: ReportProject) {
  const milestoneScore = pct(
    project.milestones.filter((m) => isCompleted(m.status)).length,
    project.milestones.length || 1
  );
  const taskScore = pct(
    project.tasks.filter((t) => isCompleted(t.status)).length,
    project.tasks.length || 1
  );
  const featureScore = pct(
    project.features.filter((f) => isCompleted(f.status)).length,
    project.features.length || 1
  );
  if (project.milestones.length && project.tasks.length && project.features.length)
    return Math.round((milestoneScore + taskScore + featureScore) / 3);
  if (project.milestones.length && project.tasks.length)
    return Math.round((milestoneScore + taskScore) / 2);
  if (project.milestones.length) return milestoneScore;
  if (project.tasks.length) return taskScore;
  return 0;
}

function timeSpentHours(tasks: ProjectTask[]) {
  return tasks.reduce((sum, t) => sum + (t.time_spent_minutes ?? 0), 0) / 60;
}

function estimatedHours(tasks: ProjectTask[]) {
  return tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
}

function PctBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{value}%</span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    : score >= 40 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{score}%</span>;
}

// ── Main Component ────────────────────────────────────────────────────────
export default function ProjectReports() {
  const [activeTab, setActiveTab] = useState("status");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<ReportData>({
    queryKey: ["/api/reports/project-summary"],
    queryFn: () => apiClient.get("/reports/project-summary"),
    staleTime: 30_000,
  });

  const projects = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data.projects;
    return data.projects.filter((p) => p.status === statusFilter);
  }, [data, statusFilter]);

  const users = data?.users ?? [];
  const userName = (id: string | null) => {
    if (!id) return "Unassigned";
    return users.find((u) => u.id === id)?.user_name ?? "Unknown";
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/projects">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Projects</Button>
          </Link>
          <h1 className="text-2xl font-bold">Project Reports</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/projects">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Projects</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Project Reports</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data?.projects.length ?? 0} project{(data?.projects.length ?? 0) !== 1 ? "s" : ""} · as of {format(new Date(), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-8">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Projects", value: data.projects.length, icon: FileText, color: "text-blue-600" },
            { label: "Active", value: data.projects.filter((p) => p.status === "active").length, icon: Activity, color: "text-green-600" },
            { label: "Overdue", value: data.projects.filter((p) => p.projected_end_date && isPast(new Date(p.projected_end_date)) && !isCompleted(p.status) && p.status !== "cancelled").length, icon: AlertTriangle, color: "text-red-600" },
            { label: "Completed", value: data.projects.filter((p) => isCompleted(p.status)).length, icon: CheckCircle2, color: "text-gray-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="py-0">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`${color} shrink-0`}><Icon className="h-5 w-5" /></div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="status" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" />Status Report</TabsTrigger>
          <TabsTrigger value="resource" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Resource Utilization</TabsTrigger>
          <TabsTrigger value="milestones" className="gap-1.5 text-xs"><Milestone className="h-3.5 w-3.5" />Milestone Status</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Performance Analysis</TabsTrigger>
          <TabsTrigger value="time" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" />Time Utilization</TabsTrigger>
        </TabsList>

        {/* ═══ REPORT 1: PROJECT STATUS ═══ */}
        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                Project Status Report — All Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-900/50">
                      {["Project", "Client", "Type", "Status", "Start Date", "Target End", "Milestones", "Tasks", "Features", "% Complete", "Delay Status"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.length === 0 && (
                      <tr><td colSpan={11} className="text-center py-10 text-gray-400">No projects found</td></tr>
                    )}
                    {projects.map((p) => {
                      const delay = delayTrafficLight(p);
                      const completion = completionPct(p);
                      const doneMilestones = p.milestones.filter((m) => isCompleted(m.status)).length;
                      const doneTasks = p.tasks.filter((t) => isCompleted(t.status)).length;
                      const doneFeatures = p.features.filter((f) => isCompleted(f.status)).length;
                      return (
                        <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link to={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400 line-clamp-1 max-w-[180px] block">
                              {p.name}
                            </Link>
                            {p.is_confirmed && <span className="text-xs text-purple-600 dark:text-purple-400">✓ Confirmed</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-[120px]">{p.client_name ?? "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap"><Badge variant="outline" className="text-xs">{TYPE_LABELS[p.project_type] ?? p.project_type}</Badge></td>
                          <td className="px-4 py-3 whitespace-nowrap"><Badge className={`text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge></td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.start_date ? format(new Date(p.start_date), "MMM d, yy") : "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.projected_end_date ? format(new Date(p.projected_end_date), "MMM d, yy") : "—"}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {p.milestones.length ? <>{doneMilestones}/{p.milestones.length}</> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {p.tasks.length ? <>{doneTasks}/{p.tasks.length}</> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {p.features.length ? <>{doneFeatures}/{p.features.length}</> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 min-w-[110px]">
                            <PctBar value={completion} color={completion >= 75 ? "bg-green-500" : completion >= 40 ? "bg-yellow-500" : "bg-red-500"} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-sm ${delay.color}`}>{delay.icon} {delay.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ REPORT 2: RESOURCE UTILIZATION ═══ */}
        <TabsContent value="resource" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                Resource Utilization Report — Resource × Project
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-900/50">
                      {["Resource", "Project", "Role", "Allocation %", "Tasks Assigned", "Tasks Done", "Est. Hours", "Hrs Tracked", "Utilization"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-10 text-gray-400">No projects found</td></tr>
                    )}
                    {projects.flatMap((p) =>
                      p.members.map((m) => {
                        const memberTasks = p.tasks.filter((t) => t.assigned_to === m.user_id);
                        const doneTasks = memberTasks.filter((t) => isCompleted(t.status)).length;
                        const estHrs = memberTasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0);
                        const trackedHrs = memberTasks.reduce((s, t) => s + (t.time_spent_minutes ?? 0), 0) / 60;
                        const utilizationPct = estHrs > 0 ? pct(trackedHrs, estHrs) : 0;
                        return (
                          <tr key={`${p.id}-${m.id}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">{userName(m.user_id)}</div>
                              <div className="text-xs text-gray-400">{m.member_type === "pm" ? "Project Manager" : "Team Member"}</div>
                            </td>
                            <td className="px-4 py-3">
                              <Link to={`/projects/${p.id}`} className="text-blue-600 hover:underline dark:text-blue-400 text-sm line-clamp-1 max-w-[160px] block">{p.name}</Link>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{m.project_role ?? "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 w-16">
                                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${m.allocation_percentage}%` }} />
                                </div>
                                <span className="text-xs">{m.allocation_percentage}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-center">{memberTasks.length}</td>
                            <td className="px-4 py-3 text-xs text-center">
                              <span className={doneTasks === memberTasks.length && memberTasks.length > 0 ? "text-green-600 font-medium" : ""}>{doneTasks}</span>
                            </td>
                            <td className="px-4 py-3 text-xs">{estHrs > 0 ? `${estHrs}h` : "—"}</td>
                            <td className="px-4 py-3 text-xs">{trackedHrs > 0 ? `${trackedHrs.toFixed(1)}h` : "—"}</td>
                            <td className="px-4 py-3 min-w-[110px]">
                              {estHrs > 0 ? (
                                <PctBar value={utilizationPct} color={utilizationPct > 100 ? "bg-red-500" : utilizationPct >= 70 ? "bg-green-500" : "bg-yellow-500"} />
                              ) : <span className="text-xs text-gray-300">No estimates</span>}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {projects.every((p) => p.members.length === 0) && (
                      <tr><td colSpan={9} className="text-center py-10 text-gray-400">No members assigned to any project</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ REPORT 3: MILESTONE STATUS ═══ */}
        <TabsContent value="milestones" className="mt-4 space-y-4">
          {projects.length === 0 && (
            <div className="text-center py-16 text-gray-400">No projects found</div>
          )}
          {projects.map((p) => {
            if (p.milestones.length === 0) return null;
            return (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                    <div>
                      <Link to={`/projects/${p.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
                        {p.name}
                      </Link>
                      {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
                    </div>
                    <Badge className={`ml-auto text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 dark:bg-gray-900/50">
                        {["Milestone", "Status", "Start Date", "End Date", "Days Remaining", "Stages Done", "Health"].map((h) => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {p.milestones.map((ms) => {
                        const doneStages = ms.stages.filter((s) => isCompleted(s.status)).length;
                        let daysInfo = <span className="text-gray-300 text-xs">—</span>;
                        let healthIcon = "⚪";
                        let healthLabel = "—";
                        let healthColor = "text-gray-400";
                        if (ms.end_date) {
                          const endDate = new Date(ms.end_date);
                          const daysLeft = differenceInDays(endDate, new Date());
                          if (isCompleted(ms.status)) {
                            healthIcon = "🟢"; healthLabel = "Done"; healthColor = "text-green-600";
                            daysInfo = <span className="text-xs text-green-600">Completed</span>;
                          } else if (daysLeft < 0) {
                            healthIcon = "🔴"; healthLabel = `${Math.abs(daysLeft)}d overdue`; healthColor = "text-red-600 font-semibold";
                            daysInfo = <span className="text-xs text-red-600 font-semibold">{Math.abs(daysLeft)}d overdue</span>;
                          } else if (daysLeft <= 7) {
                            healthIcon = "🟡"; healthLabel = `${daysLeft}d left`; healthColor = "text-yellow-600";
                            daysInfo = <span className="text-xs text-yellow-600 font-medium">{daysLeft}d left</span>;
                          } else {
                            healthIcon = "🟢"; healthLabel = `${daysLeft}d left`; healthColor = "text-green-600";
                            daysInfo = <span className="text-xs text-gray-600 dark:text-gray-400">{daysLeft}d left</span>;
                          }
                        }
                        return (
                          <tr key={ms.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/30">
                            <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{ms.name}</td>
                            <td className="px-4 py-2.5">
                              <Badge className={`text-xs border-0 ${MS_STATUS_COLORS[ms.status] ?? "bg-gray-100 text-gray-700"}`}>
                                {ms.status.replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{ms.start_date ? format(new Date(ms.start_date), "MMM d, yy") : "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{ms.end_date ? format(new Date(ms.end_date), "MMM d, yy") : "—"}</td>
                            <td className="px-4 py-2.5">{daysInfo}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {ms.stages.length > 0 ? (
                                <div className="flex items-center gap-2">
                                  <span>{doneStages}/{ms.stages.length}</span>
                                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 w-12">
                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct(doneStages, ms.stages.length)}%` }} />
                                  </div>
                                </div>
                              ) : <span className="text-gray-300">No stages</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-sm ${healthColor}`}>{healthIcon} {healthLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
          {projects.every((p) => p.milestones.length === 0) && (
            <div className="text-center py-16 text-gray-400">
              <Milestone className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No milestones found across any project</p>
            </div>
          )}
        </TabsContent>

        {/* ═══ REPORT 4: PERFORMANCE ANALYSIS ═══ */}
        <TabsContent value="performance" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {projects.length === 0 && (
              <div className="col-span-2 text-center py-16 text-gray-400">No projects found</div>
            )}
            {projects.map((p) => {
              const delay = delayTrafficLight(p);
              const msCompletion = pct(p.milestones.filter((m) => isCompleted(m.status)).length, p.milestones.length || 1);
              const taskCompletion = pct(p.tasks.filter((t) => isCompleted(t.status)).length, p.tasks.length || 1);
              const featureCompletion = pct(p.features.filter((f) => isCompleted(f.status)).length, p.features.length || 1);
              const totalEstHrs = estimatedHours(p.tasks);
              const totalSpentHrs = timeSpentHours(p.tasks);
              const effortBurn = totalEstHrs > 0 ? pct(totalSpentHrs, totalEstHrs) : 0;
              const memberCount = p.members.length;
              const avgAllocation = memberCount > 0
                ? Math.round(p.members.reduce((s, m) => s + m.allocation_percentage, 0) / memberCount)
                : 0;

              // Schedule health
              let scheduleHealth = 100;
              if (p.projected_end_date) {
                const daysLeft = differenceInDays(new Date(p.projected_end_date), new Date());
                if (daysLeft < 0) scheduleHealth = 0;
                else if (daysLeft <= 7) scheduleHealth = 20;
                else if (daysLeft <= 14) scheduleHealth = 50;
              }
              if (p.status === "completed") scheduleHealth = 100;
              if (p.status === "cancelled") scheduleHealth = 0;

              // Overall score
              const overall = Math.round((msCompletion + taskCompletion + featureCompletion + scheduleHealth) / 4);

              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={`/projects/${p.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
                          {p.name}
                        </Link>
                        {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge>
                        <ScoreBadge score={overall} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Key metrics grid */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: "Milestones", value: `${p.milestones.filter((m) => isCompleted(m.status)).length}/${p.milestones.length}` },
                        { label: "Tasks", value: `${p.tasks.filter((t) => isCompleted(t.status)).length}/${p.tasks.length}` },
                        { label: "Features", value: `${p.features.filter((f) => isCompleted(f.status)).length}/${p.features.length}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{value || "—"}</div>
                          <div className="text-xs text-gray-400">{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress bars */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500 justify-between">
                        <span>Milestone Completion</span><ScoreBadge score={msCompletion} />
                      </div>
                      <PctBar value={msCompletion} color={msCompletion >= 75 ? "bg-green-500" : msCompletion >= 40 ? "bg-blue-500" : "bg-red-500"} />

                      <div className="flex items-center gap-2 text-xs text-gray-500 justify-between mt-1">
                        <span>Task Completion</span><ScoreBadge score={taskCompletion} />
                      </div>
                      <PctBar value={taskCompletion} color={taskCompletion >= 75 ? "bg-green-500" : taskCompletion >= 40 ? "bg-blue-500" : "bg-red-500"} />

                      <div className="flex items-center gap-2 text-xs text-gray-500 justify-between mt-1">
                        <span>Feature Completion</span><ScoreBadge score={featureCompletion} />
                      </div>
                      <PctBar value={featureCompletion} color={featureCompletion >= 75 ? "bg-green-500" : featureCompletion >= 40 ? "bg-blue-500" : "bg-red-500"} />

                      {effortBurn > 0 && (
                        <>
                          <div className="flex items-center gap-2 text-xs text-gray-500 justify-between mt-1">
                            <span>Effort Burn ({totalSpentHrs.toFixed(1)}h / {totalEstHrs}h)</span>
                            <ScoreBadge score={effortBurn} />
                          </div>
                          <PctBar value={effortBurn} color={effortBurn > 110 ? "bg-red-500" : effortBurn > 80 ? "bg-yellow-500" : "bg-indigo-500"} />
                        </>
                      )}
                    </div>

                    {/* Insights */}
                    <div className="border-t pt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Schedule</span>
                        <span className={`font-medium ${delay.color}`}>{delay.icon} {delay.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Team Size</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{memberCount} member{memberCount !== 1 ? "s" : ""} · avg {avgAllocation}% allocation</span>
                      </div>
                      {p.total_effort_hours && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Project Budget (hrs)</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{p.total_effort_hours.toLocaleString()}h total</span>
                        </div>
                      )}
                      {p.budget_amount && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Budget</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{p.currency} {parseFloat(p.budget_amount).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ═══ REPORT 5: TIME UTILIZATION ═══ */}
        <TabsContent value="time" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Project Time Utilization Report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-900/50">
                      {["Project", "Status", "Allocated (hrs)", "Estimated (tasks)", "Hrs Tracked", "Hrs Remaining", "% Used", "Remark"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-10 text-gray-400">No projects found</td></tr>
                    )}
                    {projects.map((p) => {
                      const allocated = p.total_effort_hours ?? 0;
                      const estimated = estimatedHours(p.tasks);
                      const tracked = timeSpentHours(p.tasks);
                      const remaining = Math.max(0, allocated - tracked);
                      const usedPct = allocated > 0 ? pct(tracked, allocated) : estimated > 0 ? pct(tracked, estimated) : 0;
                      const baseline = allocated || estimated;

                      // Remark logic
                      let remark = "—";
                      let remarkColor = "text-gray-400";
                      const completion = completionPct(p);
                      if (isCompleted(p.status)) {
                        remark = "Project Complete";
                        remarkColor = "text-green-600 font-medium";
                      } else if (baseline === 0) {
                        remark = "No time budget set";
                        remarkColor = "text-gray-400";
                      } else if (tracked > baseline) {
                        remark = `⚠ Overrun by ${(tracked - baseline).toFixed(1)}h`;
                        remarkColor = "text-red-600 font-semibold";
                      } else {
                        // Check if remaining time is sufficient: if % time left ≥ % work left
                        const pctTimeLeft = pct(remaining, baseline);
                        const pctWorkLeft = 100 - completion;
                        if (pctTimeLeft >= pctWorkLeft + 15) {
                          remark = "Time appears sufficient";
                          remarkColor = "text-green-600";
                        } else if (pctTimeLeft >= pctWorkLeft) {
                          remark = "Time is tight";
                          remarkColor = "text-yellow-600 font-medium";
                        } else {
                          remark = "At risk — insufficient time";
                          remarkColor = "text-red-600 font-medium";
                        }
                      }

                      return (
                        <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link to={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400 line-clamp-1 max-w-[180px] block">{p.name}</Link>
                            {p.client_name && <span className="text-xs text-gray-400">{p.client_name}</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge className={`text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs">{allocated > 0 ? `${allocated.toLocaleString()}h` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs">{estimated > 0 ? `${estimated}h` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs">{tracked > 0 ? `${tracked.toFixed(1)}h` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs">{baseline > 0 ? `${remaining.toFixed(1)}h` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 min-w-[110px]">
                            {baseline > 0 ? (
                              <PctBar value={usedPct} color={usedPct > 100 ? "bg-red-500" : usedPct > 80 ? "bg-yellow-500" : "bg-blue-500"} />
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-xs ${remarkColor}`}>{remark}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Legend */}
              <div className="px-4 py-3 border-t bg-gray-50 dark:bg-gray-900/30 flex flex-wrap gap-4 text-xs text-gray-500">
                <span><strong>Allocated hrs</strong>: Project-level effort budget</span>
                <span><strong>Estimated hrs</strong>: Sum of task estimates</span>
                <span><strong>Hrs Tracked</strong>: Actual time logged via task timers</span>
                <span><strong>% Used</strong>: Tracked ÷ Allocated (or Estimated)</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
