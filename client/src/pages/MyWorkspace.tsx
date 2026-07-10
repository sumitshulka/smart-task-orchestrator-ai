import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useNavigate, Link } from "react-router-dom";
import {
  format, isToday, isPast, isFuture, isThisWeek,
  formatDistanceToNow, differenceInDays,
} from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles, RefreshCw, ExternalLink, Play, Pause, CheckCircle2,
  MessageSquare, ChevronRight, Plus, FolderOpen, Bug, CalendarDays,
  Zap, Clock, AlertTriangle, CheckSquare, BellDot,
  Target, BarChart2, ArrowRight, MoreHorizontal,
  Activity, Briefcase, ListTodo, Shield, Brain, Loader2,
  AlertCircle, CheckCheck, TrendingDown, TrendingUp,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id: string; task_number: number; title: string; status: string;
  priority: number | null; due_date: string | null; project_id: string | null;
  assigned_to: string | null; created_at: string; actual_completion_date: string | null;
  time_spent_minutes: number | null; timer_state: string | null;
}
interface Project {
  id: string; name: string; status: string;
  projected_end_date: string | null; color: string | null;
  created_by: string | null; project_type: string | null;
}
interface Defect {
  id: string; defect_number: number; title: string; severity: string;
  priority: number | null; status: string; assigned_to: string | null;
  created_at: string;
}
interface ProjectMember { project_id: string; user_id: string | null; }
interface AiBrief {
  focus_insight: string; priority_actions: string[];
  risk_alert: string | null; workload_status: "balanced" | "heavy" | "light";
  generated_at: string;
}
interface CalItem {
  title: string; subtitle: string; date: Date;
  color: string; borderColor: string; bgColor: string; link: string;
}

// ── Static lookups ────────────────────────────────────────────────────────────
const PRIORITY_MAP: Record<number, { label: string; pill: string }> = {
  1: { label: "Critical", pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  2: { label: "High",     pill: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  3: { label: "Medium",   pill: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  4: { label: "Low",      pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  5: { label: "Minimal",  pill: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};
const SEV_PILL: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  medium:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};
const STATUS_DOT: Record<string, string> = {
  pending: "bg-slate-400", in_progress: "bg-indigo-500",
  review: "bg-amber-400", completed: "bg-emerald-500",
  done: "bg-emerald-500", blocked: "bg-red-500",
};
function sl(s: string) { return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

// ── Section wrapper with coloured header ─────────────────────────────────────
function Section({
  icon: Icon, title, accent, children, action,
}: {
  icon: React.ElementType; title: string;
  accent: string; // tailwind gradient classes
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <div className={`${accent} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white tracking-wide">{title}</span>
        </div>
        {action && <div className="text-white/80 hover:text-white text-xs">{action}</div>}
      </div>
      <div className="bg-white dark:bg-gray-900">{children}</div>
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, isCompleted, onNavigate, onMarkInProgress, onMarkComplete, onStartTimer, onPauseTimer }: {
  task: Task; isCompleted: (t: Task) => boolean;
  onNavigate: (p: string) => void;
  onMarkInProgress: (id: string) => void; onMarkComplete: (id: string) => void;
  onStartTimer: (id: string) => void; onPauseTimer: (id: string) => void;
}) {
  const p = PRIORITY_MAP[task.priority ?? 3] ?? PRIORITY_MAP[3];
  const running = task.timer_state === "running";
  const done = isCompleted(task);
  const overdue = !done && task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));

  return (
    <div className={`group flex items-start gap-3 p-3 rounded-xl border transition-all ${overdue ? "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10" : "border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-200 dark:hover:border-indigo-700"}`}>
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] ?? "bg-slate-400"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate leading-snug">
            <span className="text-slate-400 text-xs mr-1">#{task.task_number}</span>{task.title}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-600 flex-shrink-0">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onNavigate(`/admin/tasks?open=${task.id}`)}>
                <ExternalLink className="w-4 h-4 mr-2" /> Open Task
              </DropdownMenuItem>
              {!done && <>
                <DropdownMenuItem onClick={() => onMarkInProgress(task.id)}><Play className="w-4 h-4 mr-2" /> In Progress</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMarkComplete(task.id)}><CheckCircle2 className="w-4 h-4 mr-2" /> Complete</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.pill}`}>{p.label}</span>
          {task.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 font-medium ${overdue ? "text-red-600" : "text-slate-400"}`}>
              <CalendarDays className="w-2.5 h-2.5" />
              {isToday(new Date(task.due_date)) ? "Due today" : overdue ? `${differenceInDays(new Date(), new Date(task.due_date))}d overdue` : format(new Date(task.due_date), "MMM d")}
            </span>
          )}
        </div>
      </div>
      {done
        ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        : <button onClick={() => running ? onPauseTimer(task.id) : onStartTimer(task.id)}
            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${running ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600"}`}>
            {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
      }
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, pending, today }: { project: Project; pending: number; today: Date }) {
  const daysLeft = project.projected_end_date ? differenceInDays(new Date(project.projected_end_date), today) : null;
  const STATUS: Record<string, { pill: string; dot: string }> = {
    active:    { pill: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
    planning:  { pill: "bg-blue-100 text-blue-700",       dot: "bg-blue-400" },
    on_hold:   { pill: "bg-amber-100 text-amber-700",     dot: "bg-amber-400" },
    completed: { pill: "bg-slate-100 text-slate-600",     dot: "bg-slate-400" },
    cancelled: { pill: "bg-red-100 text-red-600",         dot: "bg-red-400" },
  };
  const st = STATUS[project.status] ?? STATUS.planning;
  return (
    <Link to={`/projects/${project.id}`}
      className="group flex flex-col gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-base font-bold shadow-sm"
          style={{ backgroundColor: project.color ?? "#6366f1" }}>
          {project.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 transition-colors">{project.name}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{(project.project_type ?? "project").replace(/_/g, " ")}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.pill}`}>{sl(project.status)}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-500"><ListTodo className="w-3.5 h-3.5" /> {pending} pending task{pending !== 1 ? "s" : ""}</span>
        {daysLeft !== null && (
          <span className={`flex items-center gap-1 font-medium ${daysLeft < 0 && project.status === "active" ? "text-red-500" : daysLeft <= 3 ? "text-amber-600" : "text-slate-400"}`}>
            <CalendarDays className="w-3 h-3" />
            {daysLeft === 0 ? "Due today" : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Defect card ───────────────────────────────────────────────────────────────
function DefectCard({ defect }: { defect: Defect }) {
  return (
    <Link to={`/defects?open=${defect.id}`}
      className="group flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-sm hover:border-orange-200 dark:hover:border-orange-700 transition-all">
      <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
        <Bug className="w-4 h-4 text-orange-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 tracking-wide mb-0.5">DEF-{String(defect.defect_number).padStart(5, "0")}</p>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{defect.title}</p>
        <div className="flex gap-1.5 mt-1">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${SEV_PILL[defect.severity] ?? "bg-slate-100 text-slate-600"}`}>{defect.severity}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{sl(defect.status)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState<AiBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  const uid = user?.id ?? "";
  const firstName = (user?.user_name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const today = new Date();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: tasks = [], refetch: refetchTasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"], queryFn: () => apiRequest("/api/tasks"),
  });
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"], queryFn: () => apiRequest("/api/projects"),
  });
  const { data: defects = [] } = useQuery<Defect[]>({
    queryKey: ["/api/defects"], queryFn: () => apiRequest("/api/defects"),
  });
  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ["/api/projects-members-all"], queryFn: () => apiRequest("/api/projects-members-all"),
  });
  const { data: decisions = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/decisions/all"], queryFn: () => apiRequest("/api/workspace/decisions/all"),
  });
  const { data: taskStatuses = [] } = useQuery<any[]>({
    queryKey: ["/api/task-statuses"], queryFn: () => apiRequest("/api/task-statuses"),
  });
  const { data: aiAccess } = useQuery<{ can_use: boolean }>({
    queryKey: ["/api/ai/access"], queryFn: () => apiRequest("/api/ai/access"),
  });

  // ── AI brief ─────────────────────────────────────────────────────────────────
  const generateBrief = useMutation({
    mutationFn: () => apiRequest("/api/my-workspace/ai-brief", { method: "POST", body: "{}" }),
    onSuccess: (data: AiBrief) => { setAiBrief(data); setBriefError(null); },
    onError: (err: any) => setBriefError(err?.message ?? "AI brief failed. Check AI settings."),
  });

  // ── Status helpers ────────────────────────────────────────────────────────────
  const completedStatuses = taskStatuses
    .filter((s: any) => s.name?.toLowerCase().includes("complet") || s.is_completed)
    .map((s: any) => s.name);
  const isCompleted = (t: Task) =>
    completedStatuses.length > 0 ? completedStatuses.includes(t.status) : t.status === "completed" || t.status === "done";
  const inProgressStatus = () => (taskStatuses.find((s: any) => s.name?.toLowerCase().includes("progress")) as any)?.name ?? "in_progress";
  const completeStatus   = () => (taskStatuses.find((s: any) => s.name?.toLowerCase().includes("complet") || s.is_completed) as any)?.name ?? "completed";

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
  });
  const startTimer = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/tasks/${id}/timer/start`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });
  const pauseTimer = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/tasks/${id}/timer/pause`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  // ── Derived data ──────────────────────────────────────────────────────────────
  const myTasks      = tasks.filter(t => t.assigned_to === uid);
  const activeTasks  = myTasks.filter(t => !isCompleted(t));
  const todayTasks   = activeTasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const overdueTasks = activeTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const upcomingTasks = activeTasks.filter(t => !t.due_date || isFuture(new Date(t.due_date)));
  const completedToday = myTasks.filter(t => isCompleted(t) && t.actual_completion_date && isToday(new Date(t.actual_completion_date)));

  const myProjectIds = new Set(members.filter(m => m.user_id === uid).map(m => m.project_id));
  const myProjects   = allProjects.filter(p => myProjectIds.has(p.id) || p.created_by === uid).slice(0, 6);
  const openDefects  = defects.filter(d => d.assigned_to === uid && !["resolved", "closed", "verified"].includes(d.status));

  const recentActivity = [...decisions]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const notifGroups = Object.values(
    recentActivity.reduce((acc: any, d: any) => {
      const key = `${d.entity_type}-${d.entity_id}`;
      if (!acc[key]) acc[key] = { key, entity_type: d.entity_type, entity_id: d.entity_id, items: [] };
      acc[key].items.push(d);
      return acc;
    }, {})
  ) as { key: string; entity_type: string; entity_id: string; items: any[] }[];

  const hoursLogged = Math.round(myTasks.reduce((s, t) => s + (t.time_spent_minutes ?? 0), 0) / 60 * 10) / 10;

  // ── Calendar items ────────────────────────────────────────────────────────────
  const calItems: CalItem[] = [];
  todayTasks.forEach(t => calItems.push({ title: t.title, subtitle: `Task #${t.task_number} · Due today`, date: new Date(t.due_date!), color: "text-indigo-700 dark:text-indigo-300", borderColor: "border-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-900/20", link: `/admin/tasks?open=${t.id}` }));
  overdueTasks.slice(0, 3).forEach(t => { const d = differenceInDays(today, new Date(t.due_date!)); calItems.push({ title: t.title, subtitle: `Task #${t.task_number} · ${d}d overdue`, date: new Date(t.due_date!), color: "text-red-700 dark:text-red-400", borderColor: "border-red-500", bgColor: "bg-red-50 dark:bg-red-900/20", link: `/admin/tasks?open=${t.id}` }); });
  upcomingTasks.filter(t => t.due_date && isThisWeek(new Date(t.due_date))).slice(0, 3).forEach(t => calItems.push({ title: t.title, subtitle: `Task #${t.task_number} · Due ${format(new Date(t.due_date!), "EEE, MMM d")}`, date: new Date(t.due_date!), color: "text-amber-700 dark:text-amber-300", borderColor: "border-amber-400", bgColor: "bg-amber-50 dark:bg-amber-900/20", link: `/admin/tasks?open=${t.id}` }));
  myProjects.filter(p => p.projected_end_date && p.status === "active").forEach(p => { const dl = differenceInDays(new Date(p.projected_end_date!), today); if (dl >= -7 && dl <= 30) calItems.push({ title: p.name, subtitle: dl < 0 ? `Project · ${Math.abs(dl)}d past deadline` : dl === 0 ? "Project · Deadline today" : `Project · ${dl}d until deadline`, date: new Date(p.projected_end_date!), color: dl <= 3 ? "text-red-700 dark:text-red-400" : "text-purple-700 dark:text-purple-300", borderColor: dl <= 3 ? "border-red-500" : "border-purple-400", bgColor: dl <= 3 ? "bg-red-50 dark:bg-red-900/20" : "bg-purple-50 dark:bg-purple-900/20", link: `/projects/${p.id}` }); });
  calItems.sort((a, b) => a.date.getTime() - b.date.getTime());

  const workloadBadge = aiBrief ? ({
    heavy:    { label: "Heavy", color: "bg-red-500/20 text-red-100",    Icon: TrendingUp },
    balanced: { label: "Balanced", color: "bg-emerald-500/20 text-emerald-100", Icon: CheckCheck },
    light:    { label: "Light", color: "bg-sky-500/20 text-sky-100",    Icon: TrendingDown },
  } as const)[aiBrief.workload_status] : null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ══ HERO BRIEF ══════════════════════════════════════════════════════ */}
        <div className="rounded-2xl overflow-hidden shadow-lg">
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 px-6 pt-6 pb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-indigo-200 tracking-wide">My Workspace</span>
                  {aiBrief && workloadBadge && (
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${workloadBadge.color}`}>
                      <workloadBadge.Icon className="w-3 h-3" /> {workloadBadge.label}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-white">{greeting}, {firstName} 👋</h1>
                <p className="text-indigo-200 text-sm mt-1">{format(today, "EEEE, MMMM d, yyyy")}</p>
              </div>
              <button onClick={() => { refetchTasks(); setAiBrief(null); setBriefError(null); }}
                className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* Stat cards pulled down into the overlap zone */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-6">
              {[
                { label: "Active",    value: activeTasks.length,  Icon: CheckSquare,  bg: "bg-white/10",           hi: false },
                { label: "Due Today", value: todayTasks.length,   Icon: CalendarDays, bg: todayTasks.length  > 0 ? "bg-amber-400/30"  : "bg-white/10", hi: todayTasks.length  > 0 },
                { label: "Overdue",   value: overdueTasks.length, Icon: AlertTriangle,bg: overdueTasks.length > 0 ? "bg-red-400/30"    : "bg-white/10", hi: overdueTasks.length > 0 },
                { label: "Defects",   value: openDefects.length,  Icon: Bug,          bg: openDefects.length  > 0 ? "bg-orange-400/30" : "bg-white/10", hi: openDefects.length  > 0 },
                { label: "Projects",  value: myProjects.length,   Icon: Briefcase,    bg: "bg-white/10",           hi: false },
                { label: "Hours",     value: `${hoursLogged}h`,   Icon: Clock,        bg: "bg-white/10",           hi: false },
              ].map(({ label, value, Icon, bg }) => (
                <div key={label} className={`${bg} backdrop-blur-sm rounded-2xl p-3 text-center`}>
                  <Icon className="w-4 h-4 text-white/70 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white leading-none">{value}</p>
                  <p className="text-[10px] text-white/60 mt-0.5 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI brief body — white panel with slight lift from the gradient */}
          <div className="bg-white dark:bg-slate-900 px-6 py-5 border-t-0">
            {!aiBrief && !generateBrief.isPending && !briefError && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI Daily Brief</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {aiAccess?.can_use
                        ? "Generate a smart analysis of your workload and today's priorities."
                        : "AI not enabled for your role — contact your admin."}
                    </p>
                  </div>
                </div>
                {aiAccess?.can_use && (
                  <Button size="sm" onClick={() => generateBrief.mutate()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-900/30">
                    <Brain className="w-3.5 h-3.5 mr-1.5" /> Generate Brief
                  </Button>
                )}
              </div>
            )}
            {generateBrief.isPending && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Analysing your workload…</p>
                  <p className="text-xs text-slate-400">Reading tasks, defects and projects</p>
                </div>
              </div>
            )}
            {briefError && !generateBrief.isPending && (
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl p-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">AI brief unavailable</p>
                  <p className="text-xs text-slate-500 mt-0.5">{briefError}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setBriefError(null); generateBrief.mutate(); }}>Retry</Button>
              </div>
            )}
            {aiBrief && !generateBrief.isPending && (
              <div className="space-y-4">
                {/* Focus insight */}
                <div className="flex items-start gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-3">
                  <Target className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Focus Insight</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{aiBrief.focus_insight}</p>
                  </div>
                </div>
                {/* Risk alert */}
                {aiBrief.risk_alert && (
                  <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Risk Alert</p>
                      <p className="text-sm text-red-700 dark:text-red-300">{aiBrief.risk_alert}</p>
                    </div>
                  </div>
                )}
                {/* Priority actions */}
                {aiBrief.priority_actions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Today's Priority Actions</p>
                    <div className="space-y-2">
                      {aiBrief.priority_actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400">Generated {formatDistanceToNow(new Date(aiBrief.generated_at), { addSuffix: true })}</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-400 hover:text-indigo-600"
                    onClick={() => { setAiBrief(null); generateBrief.mutate(); }}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                  </Button>
                </div>
              </div>
            )}
            {/* Quick actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => document.getElementById("work-section")?.scrollIntoView({ behavior: "smooth" })}>
                <Target className="w-3.5 h-3.5 mr-1.5" /> View My Work
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/admin/my-tasks")}>
                <Zap className="w-3.5 h-3.5 mr-1.5" /> Focus Mode
              </Button>
            </div>
          </div>
        </div>

        {/* ══ ROW: My Work + Right Column ═════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" id="work-section">

          {/* My Work — 2/3 */}
          <div className="lg:col-span-2">
            <Section icon={ListTodo} title="My Work" accent="bg-gradient-to-r from-indigo-500 to-blue-600"
              action={<Link to="/admin/my-tasks" className="flex items-center gap-1 hover:text-white font-medium">All tasks <ArrowRight className="w-3 h-3" /></Link>}>
              <div className="p-4">
                <Tabs defaultValue="today">
                  <TabsList className="w-full grid grid-cols-4 h-9 mb-4 bg-slate-100 dark:bg-slate-800">
                    <TabsTrigger value="today" className="text-xs font-semibold">
                      Today {todayTasks.length > 0 && <span className="ml-1 bg-indigo-600 text-white text-[10px] px-1.5 py-0 rounded-full">{todayTasks.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="upcoming" className="text-xs font-semibold">Upcoming</TabsTrigger>
                    <TabsTrigger value="overdue" className="text-xs font-semibold">
                      Overdue {overdueTasks.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0 rounded-full">{overdueTasks.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs font-semibold">Done</TabsTrigger>
                  </TabsList>
                  {([
                    { key: "today",     list: todayTasks,              empty: "No tasks due today — you're clear! 🎉" },
                    { key: "upcoming",  list: upcomingTasks.slice(0,10), empty: "No upcoming tasks with due dates" },
                    { key: "overdue",   list: overdueTasks,            empty: "Nothing overdue — well done! ✅" },
                    { key: "completed", list: completedToday,          empty: "Nothing marked complete yet today" },
                  ] as const).map(({ key, list, empty }) => (
                    <TabsContent key={key} value={key} className="mt-0">
                      {tasksLoading
                        ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
                        : list.length === 0
                          ? <div className="py-12 text-center"><CheckCircle2 className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" /><p className="text-sm text-slate-400">{empty}</p></div>
                          : <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                              {list.map(t => (
                                <TaskCard key={t.id} task={t} isCompleted={isCompleted} onNavigate={navigate}
                                  onMarkInProgress={id => updateStatus.mutate({ id, status: inProgressStatus() })}
                                  onMarkComplete={id => updateStatus.mutate({ id, status: completeStatus() })}
                                  onStartTimer={id => startTimer.mutate(id)}
                                  onPauseTimer={id => pauseTimer.mutate(id)} />
                              ))}
                            </div>
                      }
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </Section>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Performance */}
            <Section icon={BarChart2} title="Performance" accent="bg-gradient-to-r from-violet-500 to-purple-600">
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Completed Today", value: completedToday.length, Icon: CheckCircle2, from: "from-emerald-400", to: "to-teal-500" },
                  { label: "Hours Logged",    value: `${hoursLogged}h`,     Icon: Clock,        from: "from-indigo-400", to: "to-blue-500" },
                  { label: "Open Defects",    value: openDefects.length,    Icon: Bug,          from: "from-orange-400", to: "to-rose-500" },
                  { label: "Active Projects", value: myProjects.filter(p => p.status === "active").length, Icon: Briefcase, from: "from-violet-400", to: "to-purple-500" },
                ].map(({ label, value, Icon, from, to }) => (
                  <div key={label} className={`rounded-xl bg-gradient-to-br ${from} ${to} p-3 text-white shadow-sm`}>
                    <Icon className="w-4 h-4 text-white/80 mb-1.5" />
                    <p className="text-2xl font-bold leading-none">{value}</p>
                    <p className="text-[10px] text-white/70 mt-1 leading-tight font-medium">{label}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Schedule */}
            <Section icon={CalendarDays} title="Schedule" accent="bg-gradient-to-r from-amber-500 to-orange-500">
              <div className="p-4">
                {calItems.length === 0 ? (
                  <div className="py-6 text-center">
                    <CalendarDays className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">Nothing coming up</p>
                    <p className="text-xs text-slate-400 mt-1">No tasks due today, nothing overdue, and no project deadlines soon.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calItems.some(c => isToday(c.date)) && (
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Today · {format(today, "MMMM d")}</p>
                    )}
                    {calItems.map((item, i) => {
                      const prevIsToday = i > 0 && isToday(calItems[i - 1].date);
                      const showHeader  = prevIsToday && !isToday(item.date);
                      return (
                        <React.Fragment key={i}>
                          {showHeader && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 mb-2">Upcoming</p>}
                          <Link to={item.link}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border-l-[3px] ${item.borderColor} ${item.bgColor} hover:opacity-80 transition-opacity`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold truncate ${item.color}`}>{item.title}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.subtitle}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          </Link>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </Section>
          </div>
        </div>

        {/* ══ MY PROJECTS ═════════════════════════════════════════════════════ */}
        {myProjects.length > 0 && (
          <Section icon={Briefcase} title="My Projects" accent="bg-gradient-to-r from-violet-600 to-indigo-600"
            action={<Link to="/projects" className="flex items-center gap-1 hover:text-white font-medium">All projects <ArrowRight className="w-3 h-3" /></Link>}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {myProjects.map(p => (
                <ProjectCard key={p.id} project={p}
                  pending={myTasks.filter(t => t.project_id === p.id && !isCompleted(t)).length}
                  today={today} />
              ))}
            </div>
          </Section>
        )}

        {/* ══ DEFECTS + ACTIVITY ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Defects */}
          <Section icon={Bug} title={`My Defects${openDefects.length > 0 ? ` (${openDefects.length})` : ""}`}
            accent="bg-gradient-to-r from-orange-500 to-rose-500"
            action={<Link to="/defects/my" className="flex items-center gap-1 hover:text-white font-medium">See all <ArrowRight className="w-3 h-3" /></Link>}>
            <div className="p-4">
              {openDefects.length === 0 ? (
                <div className="py-8 text-center">
                  <Shield className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No open defects assigned to you</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {openDefects.slice(0, 6).map(d => <DefectCard key={d.id} defect={d} />)}
                </div>
              )}
            </div>
          </Section>

          {/* Workspace Activity */}
          <Section icon={Activity} title="Workspace Activity" accent="bg-gradient-to-r from-purple-500 to-violet-600"
            action={<Link to="/decisions" className="flex items-center gap-1 hover:text-white font-medium">Decisions <ArrowRight className="w-3 h-3" /></Link>}>
            <div className="p-4">
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center">
                  <Activity className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {recentActivity.map((item: any) => (
                    <Link key={item.id}
                      to={item.entity_type === "task" ? `/admin/tasks?open=${item.entity_id}` : item.entity_type === "project" ? `/projects/${item.entity_id}` : "/decisions"}
                      className="group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Shield className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0 rounded-full ${item.status === "approved" ? "bg-emerald-100 text-emerald-700" : item.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{item.status}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 shrink-0 mt-1 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* ══ NOTIFICATIONS ═══════════════════════════════════════════════════ */}
        {notifGroups.length > 0 && (
          <Section icon={BellDot} title="Notifications" accent="bg-gradient-to-r from-sky-500 to-cyan-500">
            <div className="p-4 space-y-2">
              {notifGroups.slice(0, 5).map(group => (
                <div key={group.key} className="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                  <button onClick={() => setExpandedNotif(expandedNotif === group.key ? null : group.key)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                        {group.entity_type === "project" ? <Briefcase className="w-3.5 h-3.5 text-sky-600" /> :
                         group.entity_type === "task"    ? <CheckSquare className="w-3.5 h-3.5 text-sky-600" /> :
                         <Bug className="w-3.5 h-3.5 text-sky-600" />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">{group.entity_type} workspace</p>
                        <p className="text-xs text-slate-400">{group.items.length} update{group.items.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedNotif === group.key ? "rotate-90" : ""}`} />
                  </button>
                  {expandedNotif === group.key && (
                    <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/60">
                      {group.items.map((item: any) => (
                        <div key={item.id} className="px-4 py-2.5">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* ══ FAB ═════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-6 right-6 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-13 h-13 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-xl shadow-indigo-900/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95">
              <Plus className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 w-48 shadow-xl">
            <DropdownMenuItem onClick={() => navigate("/admin/tasks")}><CheckSquare className="w-4 h-4 mr-2 text-indigo-500" /> Create Task</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/projects/new")}><FolderOpen className="w-4 h-4 mr-2 text-emerald-500" /> Create Project</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/defects")}><Bug className="w-4 h-4 mr-2 text-orange-500" /> Report Defect</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/decisions")}><MessageSquare className="w-4 h-4 mr-2 text-violet-500" /> Start Discussion</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
