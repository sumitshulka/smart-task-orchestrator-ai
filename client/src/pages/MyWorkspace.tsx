import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useNavigate, Link } from "react-router-dom";
import { format, isToday, isPast, isFuture, isThisWeek, formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sparkles, RefreshCw, ExternalLink, Play, Pause, CheckCircle2,
  MessageSquare, ChevronRight, Plus, FolderOpen, Bug, CalendarDays,
  Zap, Clock, TrendingUp, AlertTriangle, CheckSquare, BellDot,
  Target, Users, BarChart2, ArrowRight, MoreHorizontal, Star,
  FileText, Activity, Briefcase, ListTodo, Shield,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return (name ?? "?").split(" ").map(p => p[0]?.toUpperCase()).slice(0, 2).join("");
}

const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  2: { label: "High",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  3: { label: "Medium",   color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  4: { label: "Low",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  5: { label: "Minimal",  color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const SEV_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-blue-100 text-blue-700",
};

function statusDot(status: string) {
  const map: Record<string, string> = {
    pending:     "bg-gray-400",
    in_progress: "bg-indigo-500",
    review:      "bg-yellow-500",
    completed:   "bg-green-500",
    blocked:     "bg-red-500",
  };
  return map[status] ?? "bg-gray-400";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id: string; task_number: number; title: string; status: string;
  priority: number | null; due_date: string | null; project_id: string | null;
  assigned_to: string | null; created_at: string; actual_completion_date: string | null;
  estimated_hours: number | null; time_spent_minutes: number | null; timer_state: string | null;
  project?: { name: string };
}

interface Project {
  id: string; name: string; status: string; description: string | null;
  projected_end_date: string | null; color: string | null;
  created_by: string | null; is_confirmed: boolean;
}

interface Defect {
  id: string; defect_number: number; title: string; severity: string;
  priority: number | null; status: string; assigned_to: string | null;
  project_id: string | null; created_at: string;
}

interface ProjectMember {
  project_id: string; user_id: string | null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null);

  const uid = user?.id ?? "";
  const firstName = (user?.user_name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
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

  // ── Derived data ────────────────────────────────────────────────────────────
  const myTasks = tasks.filter(t => t.assigned_to === uid);

  const completedStatuses = taskStatuses
    .filter((s: any) => s.name?.toLowerCase().includes("complet") || s.is_completed)
    .map((s: any) => s.name);
  const isCompleted = (t: Task) =>
    completedStatuses.length > 0
      ? completedStatuses.includes(t.status)
      : t.status === "completed" || t.status === "done";

  const activeTasks   = myTasks.filter(t => !isCompleted(t));
  const todayTasks    = activeTasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const overdueTasks  = activeTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const upcomingTasks = activeTasks.filter(t => !t.due_date || isFuture(new Date(t.due_date)));
  const completedToday = myTasks.filter(t => isCompleted(t) && t.actual_completion_date && isToday(new Date(t.actual_completion_date)));

  const myProjectIds = new Set(members.filter(m => m.user_id === uid).map(m => m.project_id));
  const myProjects   = allProjects.filter(p => myProjectIds.has(p.id) || p.created_by === uid).slice(0, 6);
  const myDefects    = defects.filter(d => d.assigned_to === uid);
  const openDefects  = myDefects.filter(d => !["resolved", "closed", "verified"].includes(d.status));

  const recentActivity = decisions
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  // Notification groups
  const notifGroups = Object.values(
    recentActivity.reduce((acc: any, d: any) => {
      const key = `${d.entity_type}-${d.entity_id}`;
      if (!acc[key]) acc[key] = { key, entity_type: d.entity_type, entity_id: d.entity_id, items: [] };
      acc[key].items.push(d);
      return acc;
    }, {})
  ) as { key: string; entity_type: string; entity_id: string; items: any[] }[];

  // Calendar events
  const calendarItems = [
    ...todayTasks.map(t => ({ type: "task", title: t.title, time: t.due_date, color: "indigo" })),
    ...overdueTasks.slice(0, 2).map(t => ({ type: "overdue", title: t.title, time: t.due_date, color: "red" })),
    ...myProjects
      .filter(p => p.projected_end_date && isThisWeek(new Date(p.projected_end_date)))
      .map(p => ({ type: "milestone", title: `${p.name} deadline`, time: p.projected_end_date, color: "amber" })),
  ].sort((a, b) => new Date(a.time ?? 0).getTime() - new Date(b.time ?? 0).getTime());

  // Performance numbers
  const hoursLogged = Math.round((myTasks.reduce((s, t) => s + (t.time_spent_minutes ?? 0), 0)) / 60 * 10) / 10;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateTaskStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); },
    onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
  });

  const startTimer = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/tasks/${id}/timer/start`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    onError: () => toast({ title: "Failed to start timer", variant: "destructive" }),
  });

  const pauseTimer = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/tasks/${id}/timer/pause`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    onError: () => toast({ title: "Failed to pause timer", variant: "destructive" }),
  });

  // ── Tab task list ─────────────────────────────────────────────────────────
  const tabLists: Record<string, Task[]> = {
    today: todayTasks,
    upcoming: upcomingTasks.slice(0, 10),
    overdue: overdueTasks,
    completed: completedToday,
  };

  function completeStatus() {
    return (taskStatuses.find((s: any) =>
      s.name?.toLowerCase().includes("complet") || s.is_completed
    ) as any)?.name ?? "completed";
  }

  function inProgressStatus() {
    return (taskStatuses.find((s: any) =>
      s.name?.toLowerCase().includes("progress") || s.name?.toLowerCase() === "in progress"
    ) as any)?.name ?? "in_progress";
  }

  // ── Suggestions ───────────────────────────────────────────────────────────
  const suggestions = [
    ...(overdueTasks.length > 0
      ? [{ icon: AlertTriangle, text: `Resolve ${overdueTasks[0].title} — it's overdue`, color: "text-red-600" }]
      : []),
    ...(todayTasks.length > 0
      ? [{ icon: Target, text: `Complete "${todayTasks[0].title}" before end of day`, color: "text-indigo-600" }]
      : []),
    ...(openDefects.length > 0
      ? [{ icon: Bug, text: `Review Defect #${String(openDefects[0].defect_number).padStart(5, "0")} assigned to you`, color: "text-orange-600" }]
      : []),
    ...(myProjects.some(p => p.status === "on_hold")
      ? [{ icon: Briefcase, text: "A project you're on is on hold — check for blockers", color: "text-yellow-600" }]
      : []),
  ].slice(0, 3);

  // ── Task Card ─────────────────────────────────────────────────────────────
  const TaskCard = ({ task }: { task: Task }) => {
    const pInfo = PRIORITY_MAP[task.priority ?? 3] ?? PRIORITY_MAP[3];
    const isRunning = task.timer_state === "running";
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${statusDot(task.status)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug truncate">
              #{task.task_number} {task.title}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 transition-all flex-shrink-0">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(`/admin/tasks?open=${task.id}`)}>
                  <ExternalLink className="w-4 h-4 mr-2" /> Open Task
                </DropdownMenuItem>
                {!isCompleted(task) && (
                  <>
                    <DropdownMenuItem onClick={() => updateTaskStatus.mutate({ id: task.id, status: inProgressStatus() })}>
                      <Play className="w-4 h-4 mr-2" /> Mark In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateTaskStatus.mutate({ id: task.id, status: completeStatus() })}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Complete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pInfo.color}`}>{pInfo.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`}>
              {statusLabel(task.status)}
            </span>
            {task.due_date && (
              <span className={`text-[10px] flex items-center gap-0.5 ${isPast(new Date(task.due_date)) && !isCompleted(task) ? "text-red-500" : "text-gray-400"}`}>
                <CalendarDays className="w-2.5 h-2.5" />
                {isToday(new Date(task.due_date)) ? "Due today" : format(new Date(task.due_date), "MMM d")}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {!isCompleted(task) && (
            <button
              onClick={() => isRunning ? pauseTimer.mutate(task.id) : startTimer.mutate(task.id)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isRunning ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200" : "bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600"}`}
              title={isRunning ? "Pause timer" : "Start timer"}
            >
              {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          )}
          {isCompleted(task) && <CheckCircle2 className="w-5 h-5 text-green-500" />}
        </div>
      </div>
    );
  };

  // ── Project Card ─────────────────────────────────────────────────────────
  const ProjectCard = ({ project }: { project: Project }) => {
    const myTasksForProject = myTasks.filter(t => t.project_id === project.id);
    const pendingCount = myTasksForProject.filter(t => !isCompleted(t)).length;
    const statusColors: Record<string, string> = {
      active:    "bg-green-100 text-green-700",
      planning:  "bg-blue-100 text-blue-700",
      on_hold:   "bg-yellow-100 text-yellow-700",
      completed: "bg-gray-100 text-gray-600",
      cancelled: "bg-red-100 text-red-600",
    };
    return (
      <Link to={`/projects/${project.id}`}
        className="block p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all group">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: project.color ?? "#6366f1" }}>
              {project.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 transition-colors">
                {project.name}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{project.project_type?.replace(/_/g, " ") ?? "Project"}</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[project.status] ?? "bg-gray-100 text-gray-600"}`}>
            {statusLabel(project.status)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span className="flex items-center gap-1">
            <ListTodo className="w-3 h-3" /> {pendingCount} pending task{pendingCount !== 1 ? "s" : ""}
          </span>
          {project.projected_end_date && (
            <span className={`flex items-center gap-1 ${isPast(new Date(project.projected_end_date)) && project.status === "active" ? "text-red-500" : ""}`}>
              <CalendarDays className="w-3 h-3" /> {format(new Date(project.projected_end_date), "MMM d")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-2.5 text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
          Open project <ArrowRight className="w-3 h-3" />
        </div>
      </Link>
    );
  };

  // ── Defect Card ───────────────────────────────────────────────────────────
  const DefectCard = ({ defect }: { defect: Defect }) => (
    <Link to={`/defects?open=${defect.id}`}
      className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-orange-200 dark:hover:border-orange-800 transition-all group">
      <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
        <Bug className="w-4 h-4 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-0.5">
          DEF-{String(defect.defect_number).padStart(5, "0")}
        </p>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug truncate">{defect.title}</p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEV_COLOR[defect.severity] ?? "bg-gray-100 text-gray-600"}`}>
            {defect.severity}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {statusLabel(defect.status)}
          </span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 mt-1 flex-shrink-0 transition-colors" />
    </Link>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── AI Daily Brief ─────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-indigo-200" />
                  <span className="text-sm font-medium text-indigo-200">Daily Brief</span>
                </div>
                <h1 className="text-2xl font-bold mb-1">{greeting}, {firstName} 👋</h1>
                <p className="text-indigo-200 text-sm">Here's your workspace overview for {format(today, "EEEE, MMMM d")}</p>
              </div>
              <button
                onClick={() => { refetchTasks(); }}
                className="flex items-center gap-1.5 text-xs text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
              {[
                { label: "Active Tasks",   value: activeTasks.length,   icon: CheckSquare, color: "bg-white/10" },
                { label: "Due Today",      value: todayTasks.length,    icon: CalendarDays, color: todayTasks.length > 0 ? "bg-yellow-400/20" : "bg-white/10" },
                { label: "Overdue",        value: overdueTasks.length,  icon: AlertTriangle, color: overdueTasks.length > 0 ? "bg-red-400/20" : "bg-white/10" },
                { label: "Open Defects",   value: openDefects.length,   icon: Bug, color: openDefects.length > 0 ? "bg-orange-400/20" : "bg-white/10" },
                { label: "My Projects",    value: myProjects.length,    icon: Briefcase, color: "bg-white/10" },
                { label: "Hours Logged",   value: hoursLogged,          icon: Clock, color: "bg-white/10" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`${color} rounded-xl p-3 backdrop-blur-sm`}>
                  <Icon className="w-4 h-4 text-indigo-200 mb-1.5" />
                  <p className="text-2xl font-bold text-white leading-none">{value}</p>
                  <p className="text-xs text-indigo-200 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-gray-800 border-t-0 rounded-b-2xl px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Today's Suggestions</p>
              <div className="space-y-2">
                {suggestions.map(({ icon: Icon, text, color }, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
                    <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => document.getElementById("my-work-section")?.scrollIntoView({ behavior: "smooth" })}>
                  <Target className="w-3.5 h-3.5 mr-1.5" /> View My Work
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => navigate("/admin/my-tasks")}>
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Focus Mode
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Main Content Grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── My Work (2/3 width) ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6" id="my-work-section">
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
                      Today{todayTasks.length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-600 text-[10px] px-1 rounded-full">{todayTasks.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
                    <TabsTrigger value="overdue" className="text-xs">
                      Overdue{overdueTasks.length > 0 && <span className="ml-1 bg-red-100 text-red-600 text-[10px] px-1 rounded-full">{overdueTasks.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs">Done</TabsTrigger>
                  </TabsList>

                  {(["today", "upcoming", "overdue", "completed"] as const).map(tab => (
                    <TabsContent key={tab} value={tab} className="mt-0">
                      {tasksLoading ? (
                        <div className="space-y-2">
                          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
                        </div>
                      ) : tabLists[tab].length === 0 ? (
                        <div className="py-10 text-center">
                          <CheckCircle2 className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">
                            {tab === "today" && "No tasks due today"}
                            {tab === "upcoming" && "No upcoming tasks"}
                            {tab === "overdue" && "You're all caught up!"}
                            {tab === "completed" && "Nothing completed yet today"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                          {tabLists[tab].map(task => <TaskCard key={task.id} task={task} />)}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* ── Right Column: Performance + Calendar ─────────────────────── */}
          <div className="space-y-6">
            {/* Performance Snapshot */}
            <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" /> Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Completed Today",  value: completedToday.length, icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50 dark:bg-green-900/20" },
                    { label: "Hours Logged",      value: `${hoursLogged}h`,     icon: Clock,        color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
                    { label: "Open Defects",      value: openDefects.length,   icon: Bug,          color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
                    { label: "Active Projects",   value: myProjects.filter(p => p.status === "active").length, icon: Briefcase, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-3`}>
                      <Icon className={`w-4 h-4 ${color} mb-1`} />
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* My Calendar */}
            <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-500" /> Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider">
                  {format(today, "EEEE, MMM d")}
                </p>
                {calendarItems.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Nothing scheduled this week</p>
                ) : (
                  <div className="space-y-2">
                    {calendarItems.slice(0, 6).map((item, i) => {
                      const borderColors = { indigo: "border-indigo-300", red: "border-red-400", amber: "border-amber-400" };
                      const bgColors = { indigo: "bg-indigo-50 dark:bg-indigo-900/10", red: "bg-red-50 dark:bg-red-900/10", amber: "bg-amber-50 dark:bg-amber-900/10" };
                      return (
                        <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border-l-2 ${borderColors[item.color as keyof typeof borderColors]} ${bgColors[item.color as keyof typeof bgColors]}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{item.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {item.type === "overdue" ? "⚠️ Overdue" :
                               item.type === "milestone" ? "📌 Milestone" :
                               item.time ? format(new Date(item.time), "h:mm a") : "Due today"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── My Projects ──────────────────────────────────────────────────── */}
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
              {myProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}

        {/* ── Defects + Activity ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* My Defects */}
          <Card className="border border-gray-100 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-0 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bug className="w-4 h-4 text-orange-500" /> My Defects
                  {openDefects.length > 0 && (
                    <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5">{openDefects.length}</Badge>
                  )}
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

          {/* Workspace Activity */}
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
                    <Link
                      key={item.id}
                      to={item.entity_type === "task" ? `/admin/tasks?open=${item.entity_id}` : item.entity_type === "project" ? `/projects/${item.entity_id}` : "/decisions"}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-snug">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
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

        {/* ── Notifications (grouped) ───────────────────────────────────── */}
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
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          {group.entity_type === "project" ? <Briefcase className="w-3.5 h-3.5 text-indigo-600" /> :
                           group.entity_type === "task" ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> :
                           <Bug className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">
                            {group.entity_type} workspace
                          </p>
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

      {/* ── Quick Create FAB ──────────────────────────────────────────────── */}
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
