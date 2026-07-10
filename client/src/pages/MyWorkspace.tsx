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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  estimated_hours: number | null; time_spent_minutes: number | null; timer_state: string | null;
}
interface Project {
  id: string; name: string; status: string; description: string | null;
  projected_end_date: string | null; color: string | null;
  created_by: string | null; is_confirmed: boolean; project_type: string | null;
}
interface Defect {
  id: string; defect_number: number; title: string; severity: string;
  priority: number | null; status: string; assigned_to: string | null;
  project_id: string | null; created_at: string;
}
interface ProjectMember { project_id: string; user_id: string | null; }
interface AiBrief {
  focus_insight: string;
  priority_actions: string[];
  risk_alert: string | null;
  workload_status: "balanced" | "heavy" | "light";
  generated_at: string;
}
interface CalItem {
  type: string; title: string; subtitle: string; date: Date;
  color: string; borderColor: string; bgColor: string; link: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  2: { label: "High",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  3: { label: "Medium",   color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  4: { label: "Low",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  5: { label: "Minimal",  color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const SEV_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function statusDot(status: string) {
  const map: Record<string, string> = {
    pending: "bg-gray-400", in_progress: "bg-indigo-500",
    review: "bg-yellow-500", completed: "bg-green-500", done: "bg-green-500", blocked: "bg-red-500",
  };
  return map[status] ?? "bg-gray-400";
}

function statusLabel(s: string) {
  return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Card components (defined OUTSIDE main component to avoid hook rule violation) ──

interface TaskCardProps {
  task: Task;
  isCompleted: (t: Task) => boolean;
  onNavigate: (path: string) => void;
  onMarkInProgress: (id: string) => void;
  onMarkComplete: (id: string) => void;
  onStartTimer: (id: string) => void;
  onPauseTimer: (id: string) => void;
}

function TaskCard({ task, isCompleted, onNavigate, onMarkInProgress, onMarkComplete, onStartTimer, onPauseTimer }: TaskCardProps) {
  const pInfo = PRIORITY_MAP[task.priority ?? 3] ?? PRIORITY_MAP[3];
  const isRunning = task.timer_state === "running";
  const done = isCompleted(task);
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusDot(task.status)}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug truncate">
            #{task.task_number} {task.title}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onNavigate(`/admin/tasks?open=${task.id}`)}>
                <ExternalLink className="w-4 h-4 mr-2" /> Open Task
              </DropdownMenuItem>
              {!done && (
                <>
                  <DropdownMenuItem onClick={() => onMarkInProgress(task.id)}>
                    <Play className="w-4 h-4 mr-2" /> Mark In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMarkComplete(task.id)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Complete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pInfo.color}`}>{pInfo.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {statusLabel(task.status)}
          </span>
          {task.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isPast(new Date(task.due_date)) && !done ? "text-red-500" : "text-gray-400"}`}>
              <CalendarDays className="w-2.5 h-2.5" />
              {isToday(new Date(task.due_date)) ? "Due today" : format(new Date(task.due_date), "MMM d")}
            </span>
          )}
        </div>
      </div>
      {!done && (
        <button
          onClick={() => isRunning ? onPauseTimer(task.id) : onStartTimer(task.id)}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${isRunning ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200" : "bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600"}`}
          title={isRunning ? "Pause timer" : "Start timer"}
        >
          {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>
      )}
      {done && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  pendingTaskCount: number;
  today: Date;
}

function ProjectCard({ project, pendingTaskCount, today }: ProjectCardProps) {
  const statusColors: Record<string, string> = {
    active:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    planning:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    on_hold:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };
  const daysLeft = project.projected_end_date
    ? differenceInDays(new Date(project.projected_end_date), today) : null;

  return (
    <Link to={`/projects/${project.id}`}
      className="block p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: project.color ?? "#6366f1" }}>
            {project.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 transition-colors">{project.name}</p>
            <p className="text-[10px] text-gray-400">{(project.project_type ?? "project").replace(/_/g, " ")}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[project.status] ?? "bg-gray-100 text-gray-600"}`}>
          {statusLabel(project.status)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><ListTodo className="w-3 h-3" /> {pendingTaskCount} pending</span>
        {daysLeft !== null && (
          <span className={`flex items-center gap-1 ${project.status === "active" && daysLeft < 0 ? "text-red-500" : ""}`}>
            <CalendarDays className="w-3 h-3" />
            {daysLeft === 0 ? "Due today" : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </span>
        )}
      </div>
    </Link>
  );
}

function DefectCard({ defect }: { defect: Defect }) {
  return (
    <Link to={`/defects?open=${defect.id}`}
      className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-orange-200 dark:hover:border-orange-800 transition-all group">
      <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
        <Bug className="w-4 h-4 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 mb-0.5">DEF-{String(defect.defect_number).padStart(5, "0")}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug truncate">{defect.title}</p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEV_COLOR[defect.severity] ?? "bg-gray-100 text-gray-600"}`}>{defect.severity}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{statusLabel(defect.status)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 mt-1 flex-shrink-0 transition-colors" />
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

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: tasks = [], refetch: refetchTasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => apiRequest("/api/tasks"),
  });
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("/api/projects"),
  });
  const { data: defects = [] } = useQuery<Defect[]>({
    queryKey: ["/api/defects"],
    queryFn: () => apiRequest("/api/defects"),
  });
  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ["/api/projects-members-all"],
    queryFn: () => apiRequest("/api/projects-members-all"),
  });
  const { data: decisions = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/decisions/all"],
    queryFn: () => apiRequest("/api/workspace/decisions/all"),
  });
  const { data: taskStatuses = [] } = useQuery<any[]>({
    queryKey: ["/api/task-statuses"],
    queryFn: () => apiRequest("/api/task-statuses"),
  });
  const { data: aiAccess } = useQuery<{ can_use: boolean }>({
    queryKey: ["/api/ai/access"],
    queryFn: () => apiRequest("/api/ai/access"),
  });

  // ── AI brief mutation ────────────────────────────────────────────────────────
  const generateBrief = useMutation({
    mutationFn: () =>
      apiRequest("/api/my-workspace/ai-brief", { method: "POST", body: "{}" }),
    onSuccess: (data: AiBrief) => { setAiBrief(data); setBriefError(null); },
    onError: (err: any) => {
      setBriefError(err?.message ?? "AI brief failed. Check AI settings in Admin > Settings.");
    },
  });

  // ── Task status helpers ──────────────────────────────────────────────────────
  const completedStatuses = taskStatuses
    .filter((s: any) => s.name?.toLowerCase().includes("complet") || s.is_completed)
    .map((s: any) => s.name);
  const isCompleted = (t: Task) =>
    completedStatuses.length > 0
      ? completedStatuses.includes(t.status)
      : t.status === "completed" || t.status === "done";

  function inProgressStatus() {
    return (taskStatuses.find((s: any) =>
      s.name?.toLowerCase().includes("progress") || s.name?.toLowerCase() === "in progress"
    ) as any)?.name ?? "in_progress";
  }
  function completeStatus() {
    return (taskStatuses.find((s: any) =>
      s.name?.toLowerCase().includes("complet") || s.is_completed
    ) as any)?.name ?? "completed";
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateTaskStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
  });
  const startTimer = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/tasks/${id}/timer/start`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    onError: () => toast({ title: "Failed to start timer", variant: "destructive" }),
  });
  const pauseTimer = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/tasks/${id}/timer/pause`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    onError: () => toast({ title: "Failed to pause timer", variant: "destructive" }),
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const myTasks      = tasks.filter(t => t.assigned_to === uid);
  const activeTasks  = myTasks.filter(t => !isCompleted(t));
  const todayTasks   = activeTasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const overdueTasks = activeTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const upcomingTasks = activeTasks.filter(t => !t.due_date || isFuture(new Date(t.due_date)));
  const completedToday = myTasks.filter(t => isCompleted(t) && t.actual_completion_date && isToday(new Date(t.actual_completion_date)));

  const myProjectIds = new Set(members.filter(m => m.user_id === uid).map(m => m.project_id));
  const myProjects   = allProjects.filter(p => myProjectIds.has(p.id) || p.created_by === uid).slice(0, 6);
  const myDefects    = defects.filter(d => d.assigned_to === uid);
  const openDefects  = myDefects.filter(d => !["resolved", "closed", "verified"].includes(d.status));

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

  const hoursLogged = Math.round((myTasks.reduce((s, t) => s + (t.time_spent_minutes ?? 0), 0)) / 60 * 10) / 10;

  // ── Calendar items ────────────────────────────────────────────────────────────
  const calendarItems: CalItem[] = [];
  todayTasks.forEach(t => calendarItems.push({
    type: "task_due", title: t.title,
    subtitle: `Task #${t.task_number} · Due today`,
    date: new Date(t.due_date!),
    color: "text-indigo-700 dark:text-indigo-300", borderColor: "border-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-900/20", link: `/admin/tasks?open=${t.id}`,
  }));
  overdueTasks.slice(0, 3).forEach(t => {
    const d = differenceInDays(today, new Date(t.due_date!));
    calendarItems.push({
      type: "task_overdue", title: t.title,
      subtitle: `Task #${t.task_number} · ${d}d overdue`,
      date: new Date(t.due_date!),
      color: "text-red-700 dark:text-red-400", borderColor: "border-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20", link: `/admin/tasks?open=${t.id}`,
    });
  });
  upcomingTasks.filter(t => t.due_date && isThisWeek(new Date(t.due_date))).slice(0, 3).forEach(t => calendarItems.push({
    type: "task_upcoming", title: t.title,
    subtitle: `Task #${t.task_number} · Due ${format(new Date(t.due_date!), "EEE, MMM d")}`,
    date: new Date(t.due_date!),
    color: "text-amber-700 dark:text-amber-300", borderColor: "border-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20", link: `/admin/tasks?open=${t.id}`,
  }));
  myProjects.filter(p => p.projected_end_date && p.status === "active").forEach(p => {
    const deadline = new Date(p.projected_end_date!);
    const daysLeft = differenceInDays(deadline, today);
    if (daysLeft >= -7 && daysLeft <= 30) calendarItems.push({
      type: "project_deadline", title: p.name,
      subtitle: daysLeft < 0 ? `Project · Deadline passed ${Math.abs(daysLeft)}d ago`
               : daysLeft === 0 ? "Project · Deadline today"
               : `Project · ${daysLeft}d until deadline`,
      date: deadline,
      color: daysLeft <= 3 ? "text-red-700 dark:text-red-400" : "text-purple-700 dark:text-purple-300",
      borderColor: daysLeft <= 3 ? "border-red-400" : "border-purple-400",
      bgColor: daysLeft <= 3 ? "bg-red-50 dark:bg-red-900/20" : "bg-purple-50 dark:bg-purple-900/20",
      link: `/projects/${p.id}`,
    });
  });
  calendarItems.sort((a, b) => a.date.getTime() - b.date.getTime());

  // ── Tab lists ─────────────────────────────────────────────────────────────────
  const tabLists: Record<string, Task[]> = {
    today: todayTasks, upcoming: upcomingTasks.slice(0, 10),
    overdue: overdueTasks, completed: completedToday,
  };

  // ── Workload badge ────────────────────────────────────────────────────────────
  const workloadBadge = aiBrief ? ({
    heavy:    { label: "Heavy workload", color: "bg-red-400/20 text-red-200",    icon: TrendingUp },
    balanced: { label: "Balanced",       color: "bg-green-400/20 text-green-200", icon: CheckCheck },
    light:    { label: "Light workload", color: "bg-blue-400/20 text-blue-200",   icon: TrendingDown },
  } as const)[aiBrief.workload_status] : null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── AI Daily Brief ──────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-5 h-5 text-indigo-200" />
                  <span className="text-sm font-medium text-indigo-200">My Workspace</span>
                  {aiBrief && workloadBadge && (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1 ${workloadBadge.color}`}>
                      <workloadBadge.icon className="w-2.5 h-2.5" /> {workloadBadge.label}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold mb-0.5">{greeting}, {firstName} 👋</h1>
                <p className="text-indigo-200 text-sm">{format(today, "EEEE, MMMM d, yyyy")}</p>
              </div>
              <button
                onClick={() => { refetchTasks(); setAiBrief(null); setBriefError(null); }}
                className="flex items-center gap-1.5 text-xs text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
              {[
                { label: "Active Tasks",  value: activeTasks.length,  Icon: CheckSquare,  highlight: false },
                { label: "Due Today",     value: todayTasks.length,   Icon: CalendarDays, highlight: todayTasks.length > 0 },
                { label: "Overdue",       value: overdueTasks.length, Icon: AlertTriangle,highlight: overdueTasks.length > 0 },
                { label: "Open Defects",  value: openDefects.length,  Icon: Bug,          highlight: openDefects.length > 0 },
                { label: "My Projects",   value: myProjects.length,   Icon: Briefcase,    highlight: false },
                { label: "Hours Logged",  value: `${hoursLogged}h`,   Icon: Clock,        highlight: false },
              ].map(({ label, value, Icon, highlight }) => (
                <div key={label} className={`${highlight ? "bg-yellow-400/20" : "bg-white/10"} rounded-xl p-3 backdrop-blur-sm`}>
                  <Icon className="w-4 h-4 text-indigo-200 mb-1.5" />
                  <p className="text-2xl font-bold text-white leading-none">{value}</p>
                  <p className="text-xs text-indigo-200 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Brief panel */}
          <div className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-gray-800 border-t-0 rounded-b-2xl px-5 py-4">
            {/* Not yet generated */}
            {!aiBrief && !generateBrief.isPending && !briefError && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" /> AI Daily Brief
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {aiAccess?.can_use
                      ? "Get a personalised AI analysis of your workload and priorities for today."
                      : "AI access is not enabled for your role. Contact your admin."}
                  </p>
                </div>
                {aiAccess?.can_use && (
                  <Button size="sm" onClick={() => generateBrief.mutate()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                    <Brain className="w-3.5 h-3.5 mr-1.5" /> Generate Brief
                  </Button>
                )}
              </div>
            )}

            {/* Loading */}
            {generateBrief.isPending && (
              <div className="flex items-center gap-3 py-2">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Analysing your workload…</p>
                  <p className="text-xs text-gray-400">Reading your tasks, defects and projects</p>
                </div>
              </div>
            )}

            {/* Error */}
            {briefError && !generateBrief.isPending && (
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">AI brief unavailable</p>
                  <p className="text-xs text-gray-400 mt-0.5">{briefError}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setBriefError(null); generateBrief.mutate(); }}>Retry</Button>
              </div>
            )}

            {/* AI response */}
            {aiBrief && !generateBrief.isPending && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Target className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-0.5">Focus Insight</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{aiBrief.focus_insight}</p>
                  </div>
                </div>
                {aiBrief.risk_alert && (
                  <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-0.5">Risk Alert</p>
                      <p className="text-sm text-red-700 dark:text-red-300">{aiBrief.risk_alert}</p>
                    </div>
                  </div>
                )}
                {aiBrief.priority_actions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Today's Priority Actions</p>
                    <div className="space-y-1.5">
                      {aiBrief.priority_actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-400">Generated {formatDistanceToNow(new Date(aiBrief.generated_at), { addSuffix: true })}</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:text-indigo-600"
                    onClick={() => { setAiBrief(null); generateBrief.mutate(); }}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                  </Button>
                </div>
              </div>
            )}

            {/* Quick nav */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => document.getElementById("my-work-section")?.scrollIntoView({ behavior: "smooth" })}>
                <Target className="w-3.5 h-3.5 mr-1.5" /> View My Work
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/admin/my-tasks")}>
                <Zap className="w-3.5 h-3.5 mr-1.5" /> Focus Mode
              </Button>
            </div>
          </div>
        </div>

        {/* ── Main 2-column grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* My Work — 2/3 */}
          <div className="lg:col-span-2" id="my-work-section">
            <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-0 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-indigo-500" /> My Work
                  </CardTitle>
                  <Link to="/admin/my-tasks" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                    See all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-3">
                <Tabs defaultValue="today">
                  <TabsList className="w-full grid grid-cols-4 h-8 text-xs mb-3">
                    <TabsTrigger value="today" className="text-xs">
                      Today
                      {todayTasks.length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 text-[10px] px-1 rounded-full">{todayTasks.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
                    <TabsTrigger value="overdue" className="text-xs">
                      Overdue
                      {overdueTasks.length > 0 && <span className="ml-1 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-[10px] px-1 rounded-full">{overdueTasks.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs">Done</TabsTrigger>
                  </TabsList>

                  {(["today", "upcoming", "overdue", "completed"] as const).map(tab => (
                    <TabsContent key={tab} value={tab} className="mt-0">
                      {tasksLoading ? (
                        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
                      ) : tabLists[tab].length === 0 ? (
                        <div className="py-10 text-center">
                          <CheckCircle2 className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">
                            {tab === "today" && "No tasks due today — great!"}
                            {tab === "upcoming" && "No upcoming tasks with due dates"}
                            {tab === "overdue" && "Nothing overdue — you're all caught up!"}
                            {tab === "completed" && "Nothing marked complete yet today"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                          {tabLists[tab].map(task => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              isCompleted={isCompleted}
                              onNavigate={navigate}
                              onMarkInProgress={id => updateTaskStatus.mutate({ id, status: inProgressStatus() })}
                              onMarkComplete={id => updateTaskStatus.mutate({ id, status: completeStatus() })}
                              onStartTimer={id => startTimer.mutate(id)}
                              onPauseTimer={id => pauseTimer.mutate(id)}
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Performance + Schedule */}
          <div className="space-y-6">
            <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" /> Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Completed Today", value: completedToday.length, Icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50 dark:bg-green-900/20" },
                    { label: "Hours Logged",    value: `${hoursLogged}h`,     Icon: Clock,        color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
                    { label: "Open Defects",    value: openDefects.length,    Icon: Bug,          color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
                    { label: "Active Projects", value: myProjects.filter(p => p.status === "active").length, Icon: Briefcase, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
                  ].map(({ label, value, Icon, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-3`}>
                      <Icon className={`w-4 h-4 ${color} mb-1`} />
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-500" /> Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {calendarItems.length === 0 ? (
                  <div className="py-6 text-center">
                    <CalendarDays className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-400">Nothing coming up</p>
                    <p className="text-xs text-gray-400 mt-0.5">No tasks due today, nothing overdue, and no project deadlines nearby.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calendarItems.some(c => isToday(c.date)) && (
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Today · {format(today, "MMMM d")}</p>
                    )}
                    {calendarItems.map((item, i) => {
                      const prevIsToday = i > 0 && isToday(calendarItems[i - 1].date);
                      const showUpcomingHeader = prevIsToday && !isToday(item.date);
                      return (
                        <React.Fragment key={i}>
                          {showUpcomingHeader && (
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-1">Upcoming</p>
                          )}
                          <Link to={item.link}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border-l-2 ${item.borderColor} ${item.bgColor} hover:opacity-80 transition-opacity`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold leading-snug truncate ${item.color}`}>{item.title}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{item.subtitle}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                          </Link>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── My Projects ───────────────────────────────────────────────────── */}
        {myProjects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" /> My Projects
              </h2>
              <Link to="/projects" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                All projects <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {myProjects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  pendingTaskCount={myTasks.filter(t => t.project_id === p.id && !isCompleted(t)).length}
                  today={today}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Defects + Activity ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-0 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bug className="w-4 h-4 text-orange-500" /> My Defects
                  {openDefects.length > 0 && <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5">{openDefects.length}</Badge>}
                </CardTitle>
                <Link to="/defects/my" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                  See all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-3">
              {openDefects.length === 0 ? (
                <div className="py-8 text-center">
                  <Shield className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No open defects assigned to you</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {openDefects.slice(0, 6).map(d => <DefectCard key={d.id} defect={d} />)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-0 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" /> Workspace Activity
                </CardTitle>
                <Link to="/decisions" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                  Decisions <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-3">
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center">
                  <Activity className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {recentActivity.map((item: any) => (
                    <Link key={item.id}
                      to={item.entity_type === "task" ? `/admin/tasks?open=${item.entity_id}` : item.entity_type === "project" ? `/projects/${item.entity_id}` : "/decisions"}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                      <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-snug">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0 rounded ${
                            item.status === "approved" ? "bg-green-100 text-green-700" :
                            item.status === "rejected" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{item.status}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 mt-1 flex-shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Notifications (grouped) ─────────────────────────────────────── */}
        {notifGroups.length > 0 && (
          <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-0 pt-4 px-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BellDot className="w-4 h-4 text-indigo-500" /> Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-3">
              <div className="space-y-1.5">
                {notifGroups.slice(0, 5).map(group => (
                  <div key={group.key}>
                    <button
                      onClick={() => setExpandedNotif(expandedNotif === group.key ? null : group.key)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          {group.entity_type === "project" ? <Briefcase className="w-3.5 h-3.5 text-indigo-600" /> :
                           group.entity_type === "task"    ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> :
                           <Bug className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{group.entity_type} workspace</p>
                          <p className="text-xs text-gray-400">{group.items.length} update{group.items.length > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedNotif === group.key ? "rotate-90" : ""}`} />
                    </button>
                    {expandedNotif === group.key && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-indigo-100 dark:border-indigo-900 pl-3">
                        {group.items.map((item: any) => (
                          <div key={item.id} className="py-1.5">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{item.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Quick Create FAB ─────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95">
              <Plus className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 w-48">
            <DropdownMenuItem onClick={() => navigate("/admin/tasks")}>
              <CheckSquare className="w-4 h-4 mr-2 text-indigo-500" /> Create Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/projects/new")}>
              <FolderOpen className="w-4 h-4 mr-2 text-green-500" /> Create Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/defects")}>
              <Bug className="w-4 h-4 mr-2 text-orange-500" /> Report Defect
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/decisions")}>
              <MessageSquare className="w-4 h-4 mr-2 text-purple-500" /> Start Discussion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
