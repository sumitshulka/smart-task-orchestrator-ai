import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, TrendingUp, Users,
  Milestone, BarChart3, FileText, RefreshCw, Activity, Search,
  Filter, X, ChevronDown, ChevronUp, Download,
} from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import * as XLSX from "xlsx";

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
  planning:  "bg-blue-100   text-blue-800   dark:bg-blue-900   dark:text-blue-200",
  active:    "bg-green-100  text-green-800  dark:bg-green-900  dark:text-green-200",
  on_hold:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-gray-100   text-gray-800   dark:bg-gray-800   dark:text-gray-200",
  cancelled: "bg-red-100    text-red-800    dark:bg-red-900    dark:text-red-200",
};
const MS_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100  text-gray-700  dark:bg-gray-800  dark:text-gray-300",
  in_progress: "bg-blue-100  text-blue-700  dark:bg-blue-900  dark:text-blue-300",
  completed:   "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  on_hold:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  cancelled:   "bg-red-100   text-red-700   dark:bg-red-900   dark:text-red-300",
};
const TYPE_LABELS: Record<string, string> = {
  fixed_cost: "Fixed Cost", time_material: "T&M",
  milestone: "Milestone-Based", retainer: "Retainer",
};
const DELAY_LABELS: Record<string, string> = {
  all: "All Health", on_track: "🟢 On Track", at_risk: "🟡 At Risk",
  overdue: "🔴 Overdue", no_deadline: "⚪ No Deadline",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function isCompleted(status: string) { return status.toLowerCase().includes("complet"); }

function delayBucket(p: ReportProject): "completed" | "no_deadline" | "overdue" | "at_risk" | "on_track" {
  if (isCompleted(p.status)) return "completed";
  if (!p.projected_end_date) return "no_deadline";
  const days = differenceInDays(new Date(p.projected_end_date), new Date());
  if (days < 0)   return "overdue";
  if (days <= 14) return "at_risk";
  return "on_track";
}

function delayTrafficLight(p: ReportProject): { icon: string; label: string; color: string } {
  if (p.status === "cancelled")  return { icon: "⚫", label: "Cancelled",   color: "text-gray-400" };
  if (isCompleted(p.status))     return { icon: "🟢", label: "Completed",   color: "text-green-600" };
  if (!p.projected_end_date)     return { icon: "⚪", label: "No deadline", color: "text-gray-400" };
  const days = differenceInDays(new Date(p.projected_end_date), new Date());
  if (days < 0)   return { icon: "🔴", label: `${Math.abs(days)}d overdue`, color: "text-red-600 font-semibold" };
  if (days <= 14) return { icon: "🟡", label: `${days}d left`,              color: "text-yellow-600 font-medium" };
  return            { icon: "🟢", label: `${days}d left`,                   color: "text-green-600" };
}

function pct(num: number, den: number) { return den ? Math.round((num / den) * 100) : 0; }

function completionPct(project: ReportProject) {
  const ms  = pct(project.milestones.filter((m) => isCompleted(m.status)).length, project.milestones.length || 1);
  const tsk = pct(project.tasks.filter((t) => isCompleted(t.status)).length,      project.tasks.length || 1);
  const ft  = pct(project.features.filter((f) => isCompleted(f.status)).length,   project.features.length || 1);
  if (project.milestones.length && project.tasks.length && project.features.length) return Math.round((ms + tsk + ft) / 3);
  if (project.milestones.length && project.tasks.length) return Math.round((ms + tsk) / 2);
  if (project.milestones.length) return ms;
  if (project.tasks.length) return tsk;
  return 0;
}
function timeSpentHours(tasks: ProjectTask[]) {
  return tasks.reduce((s, t) => s + (t.time_spent_minutes ?? 0), 0) / 60;
}
function estimatedHours(tasks: ProjectTask[]) {
  return tasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0);
}

// ── Sub-components ─────────────────────────────────────────────────────────
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
  const cls = score >= 75
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    : score >= 40
    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{score}%</span>;
}
function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return <tr><td colSpan={cols} className="text-center py-10 text-gray-400 text-sm">{message}</td></tr>;
}
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 dark:hover:text-blue-100">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ── Excel export helper ────────────────────────────────────────────────────
function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  metaRows?: string[][]
) {
  const wb = XLSX.utils.book_new();
  const sheetData: (string | number | null | undefined)[][] = [];

  // Optional metadata rows at top
  if (metaRows) {
    metaRows.forEach((r) => sheetData.push(r));
    sheetData.push([]);
  }

  sheetData.push(headers);
  rows.forEach((r) => sheetData.push(r));

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto-fit columns (rough approximation)
  const colWidths = headers.map((h, ci) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[ci] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  ws["!cols"] = colWidths;

  // Style the header row (bold) via a simple comment — xlsx-light doesn't support full styles
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ProjectReports() {
  const [activeTab, setActiveTab]         = useState("status");
  const [showFilters, setShowFilters]     = useState(true);

  // Global filters (apply to all tabs)
  const [fSearch,    setFSearch]    = useState("");
  const [fStatus,    setFStatus]    = useState("all");
  const [fType,      setFType]      = useState("all");
  const [fDelay,     setFDelay]     = useState("all");
  const [fConfirmed, setFConfirmed] = useState("all");
  const [fStartFrom, setFStartFrom] = useState("");
  const [fStartTo,   setFStartTo]   = useState("");
  const [fEndFrom,   setFEndFrom]   = useState("");
  const [fEndTo,     setFEndTo]     = useState("");

  // Resource tab extra filter
  const [fResource, setFResource] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<ReportData>({
    queryKey: ["/api/reports/project-summary"],
    queryFn: () => apiClient.get("/reports/project-summary"),
    staleTime: 30_000,
  });

  // ── Compute filtered project list ──────────────────────────────────────
  const projects = useMemo(() => {
    if (!data) return [];
    return data.projects.filter((p) => {
      // Search: name or client
      if (fSearch) {
        const q = fSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.client_name ?? "").toLowerCase().includes(q)) return false;
      }
      // Status
      if (fStatus !== "all" && p.status !== fStatus) return false;
      // Type
      if (fType !== "all" && p.project_type !== fType) return false;
      // Delay bucket
      if (fDelay !== "all") {
        const bucket = delayBucket(p);
        if (fDelay === "on_track" && bucket !== "on_track") return false;
        if (fDelay === "at_risk"  && bucket !== "at_risk")  return false;
        if (fDelay === "overdue"  && bucket !== "overdue")   return false;
        if (fDelay === "no_deadline" && bucket !== "no_deadline") return false;
      }
      // Confirmed
      if (fConfirmed === "confirmed"   && !p.is_confirmed) return false;
      if (fConfirmed === "unconfirmed" &&  p.is_confirmed) return false;
      // Start date range
      if (fStartFrom && p.start_date && p.start_date < fStartFrom) return false;
      if (fStartTo   && p.start_date && p.start_date > fStartTo)   return false;
      // End date range
      if (fEndFrom && p.projected_end_date && p.projected_end_date < fEndFrom) return false;
      if (fEndTo   && p.projected_end_date && p.projected_end_date > fEndTo)   return false;
      return true;
    });
  }, [data, fSearch, fStatus, fType, fDelay, fConfirmed, fStartFrom, fStartTo, fEndFrom, fEndTo]);

  const users = data?.users ?? [];
  const userName = (id: string | null) =>
    id ? (users.find((u) => u.id === id)?.user_name ?? "Unknown") : "Unassigned";

  // Active filter chips
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (fSearch)          activeFilters.push({ label: `"${fSearch}"`,                  clear: () => setFSearch("") });
  if (fStatus !== "all") activeFilters.push({ label: STATUS_LABELS[fStatus],         clear: () => setFStatus("all") });
  if (fType   !== "all") activeFilters.push({ label: TYPE_LABELS[fType],             clear: () => setFType("all") });
  if (fDelay  !== "all") activeFilters.push({ label: DELAY_LABELS[fDelay],           clear: () => setFDelay("all") });
  if (fConfirmed !== "all") activeFilters.push({ label: fConfirmed === "confirmed" ? "Confirmed" : "Unconfirmed", clear: () => setFConfirmed("all") });
  if (fStartFrom) activeFilters.push({ label: `Start ≥ ${fStartFrom}`,              clear: () => setFStartFrom("") });
  if (fStartTo)   activeFilters.push({ label: `Start ≤ ${fStartTo}`,                clear: () => setFStartTo("") });
  if (fEndFrom)   activeFilters.push({ label: `End ≥ ${fEndFrom}`,                  clear: () => setFEndFrom("") });
  if (fEndTo)     activeFilters.push({ label: `End ≤ ${fEndTo}`,                    clear: () => setFEndTo("") });

  const clearAllFilters = () => {
    setFSearch(""); setFStatus("all"); setFType("all"); setFDelay("all");
    setFConfirmed("all"); setFStartFrom(""); setFStartTo(""); setFEndFrom(""); setFEndTo("");
    setFResource("all");
  };

  // Resource utilization rows (with resource filter)
  const resourceRows = useMemo(() =>
    projects.flatMap((p) =>
      p.members
        .filter((m) => fResource === "all" || m.user_id === fResource)
        .map((m) => {
          const memberTasks = p.tasks.filter((t) => t.assigned_to === m.user_id);
          const doneTasks   = memberTasks.filter((t) => isCompleted(t.status)).length;
          const estHrs      = memberTasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0);
          const trackedHrs  = memberTasks.reduce((s, t) => s + (t.time_spent_minutes ?? 0), 0) / 60;
          return { p, m, memberTasks, doneTasks, estHrs, trackedHrs };
        })
    ),
  [projects, fResource]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/projects"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Projects</Button></Link>
          <h1 className="text-2xl font-bold">Project Reports</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/projects">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Projects</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Project Reports</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {projects.length} of {data?.projects.length ?? 0} projects · {format(new Date(), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilters.length > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {activeFilters.length}
              </span>
            )}
            {showFilters ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 h-8">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ═══ FILTER PANEL ═══ */}
      {showFilters && (
        <Card className="border border-gray-200 dark:border-gray-700 shadow-none">
          <CardContent className="p-4 space-y-3">
            {/* Row 1: Search + Status + Type + Delay + Confirmed */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="lg:col-span-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Project or client..."
                  value={fSearch}
                  onChange={(e) => setFSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Status */}
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Type */}
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Project Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Delay Health */}
              <Select value={fDelay} onValueChange={setFDelay}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Health" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DELAY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Confirmed */}
              <Select value={fConfirmed} onValueChange={setFConfirmed}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Confirmation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  <SelectItem value="confirmed">Confirmed Only</SelectItem>
                  <SelectItem value="unconfirmed">Unconfirmed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Date ranges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500">Start Date — From</Label>
                <Input type="date" value={fStartFrom} onChange={(e) => setFStartFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500">Start Date — To</Label>
                <Input type="date" value={fStartTo} onChange={(e) => setFStartTo(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500">Target End — From</Label>
                <Input type="date" value={fEndFrom} onChange={(e) => setFEndFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-gray-500">Target End — To</Label>
                <Input type="date" value={fEndTo} onChange={(e) => setFEndTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>

            {/* Active filter chips + clear */}
            {activeFilters.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400 mr-1">Active:</span>
                {activeFilters.map((f) => (
                  <FilterChip key={f.label} label={f.label} onRemove={f.clear} />
                ))}
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gray-400 hover:text-red-500 underline ml-1 transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ SUMMARY STAT CARDS ═══ */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Showing",   value: projects.length,                                                                                                                                icon: FileText,       color: "text-blue-600" },
            { label: "Active",    value: projects.filter((p) => p.status === "active").length,                                                                                          icon: Activity,       color: "text-green-600" },
            { label: "Overdue",   value: projects.filter((p) => p.projected_end_date && isPast(new Date(p.projected_end_date)) && !isCompleted(p.status) && p.status !== "cancelled").length, icon: AlertTriangle,  color: "text-red-600" },
            { label: "Completed", value: projects.filter((p) => isCompleted(p.status)).length,                                                                                         icon: CheckCircle2,   color: "text-gray-600" },
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

      {/* ═══ TABS ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="status"      className="gap-1.5 text-xs"><BarChart3   className="h-3.5 w-3.5" />Status Report</TabsTrigger>
          <TabsTrigger value="resource"    className="gap-1.5 text-xs"><Users       className="h-3.5 w-3.5" />Resource Utilization</TabsTrigger>
          <TabsTrigger value="milestones"  className="gap-1.5 text-xs"><Milestone   className="h-3.5 w-3.5" />Milestone Status</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs"><TrendingUp  className="h-3.5 w-3.5" />Performance Analysis</TabsTrigger>
          <TabsTrigger value="time"        className="gap-1.5 text-xs"><Clock       className="h-3.5 w-3.5" />Time Utilization</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════
            REPORT 1: PROJECT STATUS
        ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                Project Status Report
                <span className="text-gray-400 font-normal">({projects.length} project{projects.length !== 1 ? "s" : ""})</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs shrink-0"
                onClick={() => {
                  const meta = [["Project Status Report"], [`Generated: ${format(new Date(), "PPP")}`], [`Filters: ${activeFilters.length ? activeFilters.map((f) => f.label).join(", ") : "None"}`]];
                  const headers = ["Project", "Client", "Type", "Status", "Start Date", "Target End Date", "Milestones Done", "Milestones Total", "Tasks Done", "Tasks Total", "Features Done", "Features Total", "% Complete", "Schedule Health"];
                  const rows = projects.map((p) => {
                    const delay = delayTrafficLight(p);
                    return [
                      p.name,
                      p.client_name ?? "",
                      TYPE_LABELS[p.project_type] ?? p.project_type,
                      STATUS_LABELS[p.status] ?? p.status,
                      p.start_date ? format(new Date(p.start_date), "d MMM yyyy") : "",
                      p.projected_end_date ? format(new Date(p.projected_end_date), "d MMM yyyy") : "",
                      p.milestones.filter((m) => isCompleted(m.status)).length,
                      p.milestones.length,
                      p.tasks.filter((t) => isCompleted(t.status)).length,
                      p.tasks.length,
                      p.features.filter((f) => isCompleted(f.status)).length,
                      p.features.length,
                      completionPct(p),
                      `${delay.icon} ${delay.label}`,
                    ];
                  });
                  downloadExcel("Project_Status_Report", "Status Report", headers, rows, meta);
                }}
              >
                <Download className="h-3.5 w-3.5" /> Download Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-900/50">
                      {["Project", "Client", "Type", "Status", "Start Date", "Target End", "Milestones", "Tasks", "Features", "% Complete", "Health"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.length === 0
                      ? <EmptyRow cols={11} message="No projects match the current filters" />
                      : projects.map((p) => {
                          const delay = delayTrafficLight(p);
                          const completion = completionPct(p);
                          const doneMilestones = p.milestones.filter((m) => isCompleted(m.status)).length;
                          const doneTasks      = p.tasks.filter((t) => isCompleted(t.status)).length;
                          const doneFeatures   = p.features.filter((f) => isCompleted(f.status)).length;
                          return (
                            <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                              <td className="px-4 py-3">
                                <Link to={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400 line-clamp-1 max-w-[180px] block">{p.name}</Link>
                                {p.is_confirmed && <span className="text-xs text-purple-600 dark:text-purple-400">✓ Confirmed</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate">{p.client_name ?? "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap"><Badge variant="outline" className="text-xs">{TYPE_LABELS[p.project_type] ?? p.project_type}</Badge></td>
                              <td className="px-4 py-3 whitespace-nowrap"><Badge className={`text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge></td>
                              <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.start_date ? format(new Date(p.start_date), "d MMM yy") : "—"}</td>
                              <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.projected_end_date ? format(new Date(p.projected_end_date), "d MMM yy") : "—"}</td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">{p.milestones.length ? <>{doneMilestones}/{p.milestones.length}</> : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">{p.tasks.length ? <>{doneTasks}/{p.tasks.length}</> : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">{p.features.length ? <>{doneFeatures}/{p.features.length}</> : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 min-w-[110px]">
                                <PctBar value={completion} color={completion >= 75 ? "bg-green-500" : completion >= 40 ? "bg-yellow-500" : "bg-red-500"} />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`text-sm ${delay.color}`}>{delay.icon} {delay.label}</span>
                              </td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            REPORT 2: RESOURCE UTILIZATION
        ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="resource" className="mt-4 space-y-3">
          {/* Resource-specific extra filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Users className="h-4 w-4" />
              <span className="font-medium">Filter by Resource:</span>
            </div>
            <Select value={fResource} onValueChange={setFResource}>
              <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="All Resources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.user_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {fResource !== "all" && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-400" onClick={() => setFResource("all")}>
                <X className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
            )}
            <span className="text-xs text-gray-400">{resourceRows.length} row{resourceRows.length !== 1 ? "s" : ""}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs ml-auto"
              onClick={() => {
                const meta = [["Resource Utilization Report"], [`Generated: ${format(new Date(), "PPP")}`], [`Filters: ${activeFilters.length ? activeFilters.map((f) => f.label).join(", ") : "None"}`]];
                const headers = ["Resource", "Project", "Client", "Member Type", "Project Role", "Allocation %", "Tasks Assigned", "Tasks Done", "Est. Hours", "Hours Tracked", "Utilization %"];
                const rows = resourceRows.map(({ p, m, memberTasks, doneTasks, estHrs, trackedHrs }) => [
                  userName(m.user_id),
                  p.name,
                  p.client_name ?? "",
                  m.member_type === "pm" ? "Project Manager" : "Team Member",
                  m.project_role ?? "",
                  m.allocation_percentage,
                  memberTasks.length,
                  doneTasks,
                  estHrs > 0 ? estHrs : "",
                  trackedHrs > 0 ? parseFloat(trackedHrs.toFixed(1)) : "",
                  estHrs > 0 ? pct(trackedHrs, estHrs) : "",
                ]);
                downloadExcel("Resource_Utilization_Report", "Resource Utilization", headers, rows, meta);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download Excel
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-900/50">
                      {["Resource", "Project", "Member Type", "Role", "Allocation", "Tasks Assigned", "Tasks Done", "Est. Hours", "Hrs Tracked", "Utilization"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resourceRows.length === 0 && (
                      <EmptyRow cols={10} message="No resource data for the selected filters" />
                    )}
                    {resourceRows.map(({ p, m, memberTasks, doneTasks, estHrs, trackedHrs }) => {
                      const utilizationPct = estHrs > 0 ? pct(trackedHrs, estHrs) : 0;
                      return (
                        <tr key={`${p.id}-${m.id}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{userName(m.user_id)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Link to={`/projects/${p.id}`} className="text-blue-600 hover:underline dark:text-blue-400 text-sm line-clamp-1 max-w-[150px] block">{p.name}</Link>
                            {p.client_name && <span className="text-xs text-gray-400">{p.client_name}</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge variant="outline" className="text-xs">{m.member_type === "pm" ? "Project Manager" : "Team Member"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{m.project_role ?? "—"}</td>
                          <td className="px-4 py-3 min-w-[90px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 w-14">
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
                            {estHrs > 0
                              ? <PctBar value={utilizationPct} color={utilizationPct > 100 ? "bg-red-500" : utilizationPct >= 70 ? "bg-green-500" : "bg-yellow-500"} />
                              : <span className="text-xs text-gray-300">No estimates</span>
                            }
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

        {/* ══════════════════════════════════════════════════════════
            REPORT 3: MILESTONE STATUS
        ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="milestones" className="mt-4 space-y-4">
          {/* Header row with download button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {projects.filter((p) => p.milestones.length > 0).length} project{projects.filter((p) => p.milestones.length > 0).length !== 1 ? "s" : ""} with milestones
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => {
                const meta = [["Milestone Status Report"], [`Generated: ${format(new Date(), "PPP")}`], [`Filters: ${activeFilters.length ? activeFilters.map((f) => f.label).join(", ") : "None"}`]];
                const headers = ["Project", "Client", "Project Status", "Milestone", "Milestone Status", "Start Date", "End Date", "Days Remaining", "Stages Done", "Stages Total", "Health"];
                const rows: (string | number)[][] = [];
                projects.forEach((p) => {
                  p.milestones.forEach((ms) => {
                    let health = "—";
                    let daysRemaining: string | number = "";
                    if (ms.end_date) {
                      const daysLeft = differenceInDays(new Date(ms.end_date), new Date());
                      if (isCompleted(ms.status)) { health = "🟢 Done"; daysRemaining = "Completed"; }
                      else if (daysLeft < 0) { health = `🔴 ${Math.abs(daysLeft)}d overdue`; daysRemaining = daysLeft; }
                      else if (daysLeft <= 7) { health = `🟡 ${daysLeft}d left`; daysRemaining = daysLeft; }
                      else { health = `🟢 ${daysLeft}d left`; daysRemaining = daysLeft; }
                    }
                    const doneStages = ms.stages.filter((s) => isCompleted(s.status)).length;
                    rows.push([
                      p.name, p.client_name ?? "",
                      STATUS_LABELS[p.status] ?? p.status,
                      ms.name,
                      ms.status.replace(/_/g, " "),
                      ms.start_date ? format(new Date(ms.start_date), "d MMM yyyy") : "",
                      ms.end_date   ? format(new Date(ms.end_date), "d MMM yyyy") : "",
                      daysRemaining,
                      doneStages, ms.stages.length,
                      health,
                    ]);
                  });
                });
                downloadExcel("Milestone_Status_Report", "Milestone Status", headers, rows, meta);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download Excel
            </Button>
          </div>
          {projects.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Milestone className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No projects match the current filters</p>
            </div>
          )}
          {projects.map((p) => {
            if (p.milestones.length === 0) return null;
            return (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                    <div>
                      <Link to={`/projects/${p.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">{p.name}</Link>
                      {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[p.project_type] ?? p.project_type}</Badge>
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge>
                    </div>
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
                        let healthIcon = "⚪"; let healthLabel = "—"; let healthColor = "text-gray-400";
                        if (ms.end_date) {
                          const daysLeft = differenceInDays(new Date(ms.end_date), new Date());
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
                                {ms.status.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{ms.start_date ? format(new Date(ms.start_date), "d MMM yy") : "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{ms.end_date ? format(new Date(ms.end_date), "d MMM yy") : "—"}</td>
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
          {projects.length > 0 && projects.every((p) => p.milestones.length === 0) && (
            <div className="text-center py-16 text-gray-400">
              <Milestone className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No milestones found for the filtered projects</p>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            REPORT 4: PERFORMANCE ANALYSIS
        ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="performance" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => {
                const meta = [["Performance Analysis Report"], [`Generated: ${format(new Date(), "PPP")}`], [`Filters: ${activeFilters.length ? activeFilters.map((f) => f.label).join(", ") : "None"}`]];
                const headers = ["Project", "Client", "Type", "Status", "Milestone Completion %", "Task Completion %", "Feature Completion %", "Effort Burn %", "Overall Score %", "Schedule Health", "Team Size", "Avg Allocation %", "Budget (hrs)", "Budget Amount"];
                const rows = projects.map((p) => {
                  const delay          = delayTrafficLight(p);
                  const msCompletion   = pct(p.milestones.filter((m) => isCompleted(m.status)).length, p.milestones.length || 1);
                  const taskCompletion = pct(p.tasks.filter((t) => isCompleted(t.status)).length, p.tasks.length || 1);
                  const ftCompletion   = pct(p.features.filter((f) => isCompleted(f.status)).length, p.features.length || 1);
                  const totalEstHrs   = estimatedHours(p.tasks);
                  const totalSpentHrs = timeSpentHours(p.tasks);
                  const effortBurn    = totalEstHrs > 0 ? pct(totalSpentHrs, totalEstHrs) : "";
                  const memberCount   = p.members.length;
                  const avgAlloc      = memberCount > 0 ? Math.round(p.members.reduce((s, m) => s + m.allocation_percentage, 0) / memberCount) : "";
                  let scheduleHealth  = 100;
                  if (p.projected_end_date) {
                    const d = differenceInDays(new Date(p.projected_end_date), new Date());
                    if (d < 0) scheduleHealth = 0; else if (d <= 7) scheduleHealth = 20; else if (d <= 14) scheduleHealth = 50;
                  }
                  if (isCompleted(p.status)) scheduleHealth = 100;
                  if (p.status === "cancelled") scheduleHealth = 0;
                  const overall = Math.round((msCompletion + taskCompletion + ftCompletion + scheduleHealth) / 4);
                  return [
                    p.name, p.client_name ?? "",
                    TYPE_LABELS[p.project_type] ?? p.project_type,
                    STATUS_LABELS[p.status] ?? p.status,
                    msCompletion, taskCompletion, ftCompletion,
                    effortBurn, overall,
                    `${delay.icon} ${delay.label}`,
                    memberCount, avgAlloc,
                    p.total_effort_hours ?? "",
                    p.budget_amount ? `${p.currency} ${parseFloat(p.budget_amount).toLocaleString()}` : "",
                  ];
                });
                downloadExcel("Performance_Analysis_Report", "Performance Analysis", headers, rows, meta);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download Excel
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {projects.length === 0 && (
              <div className="col-span-2 text-center py-16 text-gray-400">No projects match the current filters</div>
            )}
            {projects.map((p) => {
              const delay          = delayTrafficLight(p);
              const msCompletion   = pct(p.milestones.filter((m) => isCompleted(m.status)).length, p.milestones.length || 1);
              const taskCompletion = pct(p.tasks.filter((t) => isCompleted(t.status)).length,      p.tasks.length || 1);
              const ftCompletion   = pct(p.features.filter((f) => isCompleted(f.status)).length,   p.features.length || 1);
              const totalEstHrs    = estimatedHours(p.tasks);
              const totalSpentHrs  = timeSpentHours(p.tasks);
              const effortBurn     = totalEstHrs > 0 ? pct(totalSpentHrs, totalEstHrs) : 0;
              const memberCount    = p.members.length;
              const avgAllocation  = memberCount > 0 ? Math.round(p.members.reduce((s, m) => s + m.allocation_percentage, 0) / memberCount) : 0;

              let scheduleHealth = 100;
              if (p.projected_end_date) {
                const daysLeft = differenceInDays(new Date(p.projected_end_date), new Date());
                if (daysLeft < 0)   scheduleHealth = 0;
                else if (daysLeft <= 7)  scheduleHealth = 20;
                else if (daysLeft <= 14) scheduleHealth = 50;
              }
              if (isCompleted(p.status)) scheduleHealth = 100;
              if (p.status === "cancelled") scheduleHealth = 0;
              const overall = Math.round((msCompletion + taskCompletion + ftCompletion + scheduleHealth) / 4);

              return (
                <Card key={p.id} className="overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={`/projects/${p.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">{p.name}</Link>
                        {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-xs">{TYPE_LABELS[p.project_type] ?? p.project_type}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <Badge className={`text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge>
                        <ScoreBadge score={overall} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: "Milestones", value: `${p.milestones.filter((m) => isCompleted(m.status)).length}/${p.milestones.length}` },
                        { label: "Tasks",      value: `${p.tasks.filter((t) => isCompleted(t.status)).length}/${p.tasks.length}` },
                        { label: "Features",   value: `${p.features.filter((f) => isCompleted(f.status)).length}/${p.features.length}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{value || "—"}</div>
                          <div className="text-xs text-gray-400">{label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Milestone Completion", score: msCompletion },
                        { label: "Task Completion",      score: taskCompletion },
                        { label: "Feature Completion",   score: ftCompletion },
                      ].map(({ label, score }) => (
                        <div key={label}>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
                            <span>{label}</span><ScoreBadge score={score} />
                          </div>
                          <PctBar value={score} color={score >= 75 ? "bg-green-500" : score >= 40 ? "bg-blue-500" : "bg-red-500"} />
                        </div>
                      ))}
                      {effortBurn > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
                            <span>Effort Burn ({totalSpentHrs.toFixed(1)}h / {totalEstHrs}h)</span>
                            <ScoreBadge score={effortBurn} />
                          </div>
                          <PctBar value={effortBurn} color={effortBurn > 110 ? "bg-red-500" : effortBurn > 80 ? "bg-yellow-500" : "bg-indigo-500"} />
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">Schedule</span><span className={`font-medium ${delay.color}`}>{delay.icon} {delay.label}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Team</span><span className="font-medium text-gray-800 dark:text-gray-200">{memberCount} member{memberCount !== 1 ? "s" : ""} · avg {avgAllocation}% alloc.</span></div>
                      {p.total_effort_hours && <div className="flex justify-between"><span className="text-gray-500">Budget (hrs)</span><span className="font-medium text-gray-800 dark:text-gray-200">{p.total_effort_hours.toLocaleString()}h</span></div>}
                      {p.budget_amount      && <div className="flex justify-between"><span className="text-gray-500">Budget</span><span className="font-medium text-gray-800 dark:text-gray-200">{p.currency} {parseFloat(p.budget_amount).toLocaleString()}</span></div>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            REPORT 5: TIME UTILIZATION
        ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="time" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Project Time Utilization
                <span className="text-gray-400 font-normal">({projects.length} project{projects.length !== 1 ? "s" : ""})</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs shrink-0"
                onClick={() => {
                  const meta = [["Time Utilization Report"], [`Generated: ${format(new Date(), "PPP")}`], [`Filters: ${activeFilters.length ? activeFilters.map((f) => f.label).join(", ") : "None"}`]];
                  const headers = ["Project", "Client", "Type", "Status", "Allocated (hrs)", "Estimated (task hrs)", "Hours Tracked", "Hours Remaining", "% Used", "Remark"];
                  const rows = projects.map((p) => {
                    const allocated  = p.total_effort_hours ?? 0;
                    const estimated  = estimatedHours(p.tasks);
                    const tracked    = timeSpentHours(p.tasks);
                    const baseline   = allocated || estimated;
                    const remaining  = Math.max(0, baseline - tracked);
                    const usedPct    = baseline > 0 ? pct(tracked, baseline) : "";
                    const completion = completionPct(p);
                    let remark = "";
                    if (isCompleted(p.status))  remark = "Project Complete";
                    else if (!baseline)          remark = "No time budget set";
                    else if (tracked > baseline) remark = `Overrun by ${(tracked - baseline).toFixed(1)}h`;
                    else {
                      const pctTimeLeft = pct(remaining, baseline);
                      const pctWorkLeft = 100 - completion;
                      if (pctTimeLeft >= pctWorkLeft + 15) remark = "Time appears sufficient";
                      else if (pctTimeLeft >= pctWorkLeft)  remark = "Time is tight";
                      else                                   remark = "At risk — insufficient time";
                    }
                    return [
                      p.name, p.client_name ?? "",
                      TYPE_LABELS[p.project_type] ?? p.project_type,
                      STATUS_LABELS[p.status] ?? p.status,
                      allocated > 0 ? allocated : "",
                      estimated > 0 ? estimated : "",
                      tracked   > 0 ? parseFloat(tracked.toFixed(1)) : "",
                      baseline  > 0 ? parseFloat(remaining.toFixed(1)) : "",
                      usedPct,
                      remark,
                    ];
                  });
                  downloadExcel("Time_Utilization_Report", "Time Utilization", headers, rows, meta);
                }}
              >
                <Download className="h-3.5 w-3.5" /> Download Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-900/50">
                      {["Project", "Type", "Status", "Allocated (hrs)", "Estimated (tasks)", "Hrs Tracked", "Hrs Remaining", "% Used", "Remark"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.length === 0 && <EmptyRow cols={9} message="No projects match the current filters" />}
                    {projects.map((p) => {
                      const allocated  = p.total_effort_hours ?? 0;
                      const estimated  = estimatedHours(p.tasks);
                      const tracked    = timeSpentHours(p.tasks);
                      const baseline   = allocated || estimated;
                      const remaining  = Math.max(0, baseline - tracked);
                      const usedPct    = baseline > 0 ? pct(tracked, baseline) : 0;
                      const completion = completionPct(p);

                      let remark = "—"; let remarkColor = "text-gray-400";
                      if (isCompleted(p.status))  { remark = "Project Complete";           remarkColor = "text-green-600 font-medium"; }
                      else if (!baseline)          { remark = "No time budget set";         remarkColor = "text-gray-400"; }
                      else if (tracked > baseline) { remark = `⚠ Overrun by ${(tracked - baseline).toFixed(1)}h`; remarkColor = "text-red-600 font-semibold"; }
                      else {
                        const pctTimeLeft = pct(remaining, baseline);
                        const pctWorkLeft = 100 - completion;
                        if (pctTimeLeft >= pctWorkLeft + 15) { remark = "Time appears sufficient"; remarkColor = "text-green-600"; }
                        else if (pctTimeLeft >= pctWorkLeft)  { remark = "Time is tight";           remarkColor = "text-yellow-600 font-medium"; }
                        else                                   { remark = "At risk — insufficient time"; remarkColor = "text-red-600 font-medium"; }
                      }

                      return (
                        <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link to={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400 line-clamp-1 max-w-[180px] block">{p.name}</Link>
                            {p.client_name && <span className="text-xs text-gray-400">{p.client_name}</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap"><Badge variant="outline" className="text-xs">{TYPE_LABELS[p.project_type] ?? p.project_type}</Badge></td>
                          <td className="px-4 py-3 whitespace-nowrap"><Badge className={`text-xs border-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</Badge></td>
                          <td className="px-4 py-3 text-xs">{allocated > 0 ? `${allocated.toLocaleString()}h` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs">{estimated > 0 ? `${estimated}h`                 : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs">{tracked   > 0 ? `${tracked.toFixed(1)}h`       : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs">{baseline  > 0 ? `${remaining.toFixed(1)}h`     : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 min-w-[110px]">
                            {baseline > 0
                              ? <PctBar value={usedPct} color={usedPct > 100 ? "bg-red-500" : usedPct > 80 ? "bg-yellow-500" : "bg-blue-500"} />
                              : <span className="text-xs text-gray-300">—</span>
                            }
                          </td>
                          <td className={`px-4 py-3 text-xs ${remarkColor}`}>{remark}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 dark:bg-gray-900/30 flex flex-wrap gap-4 text-xs text-gray-500">
                <span><strong>Allocated hrs</strong>: Project-level effort budget</span>
                <span><strong>Estimated hrs</strong>: Sum of task estimates</span>
                <span><strong>Hrs Tracked</strong>: Actual time logged via task timers</span>
                <span><strong>% Used</strong>: Tracked ÷ Allocated (or Estimated if no budget set)</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
