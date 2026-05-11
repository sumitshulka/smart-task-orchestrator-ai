import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiClient } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Folder, Calendar, Clock, DollarSign, Search, BarChart3,
  User, Users, CheckCircle2, Pencil, ChevronRight, AlertTriangle, Timer, Trash2, Building2
} from "lucide-react";
import type { Project, ProjectTemplate } from "@shared/schema";
import { format, differenceInDays } from "date-fns";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  planning:  "bg-blue-100   text-blue-800   dark:bg-blue-900   dark:text-blue-200",
  active:    "bg-green-100  text-green-800  dark:bg-green-900  dark:text-green-200",
  on_hold:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-gray-100   text-gray-700   dark:bg-gray-800   dark:text-gray-300",
  cancelled: "bg-red-100    text-red-800    dark:bg-red-900    dark:text-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  planning: "Planning", active: "Active", on_hold: "On Hold",
  completed: "Completed", cancelled: "Cancelled",
};
const PROJECT_TYPE_LABELS: Record<string, string> = {
  fixed_cost: "Fixed Cost", time_material: "Time & Material",
  milestone: "Milestone-Based", retainer: "Retainer",
};
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"];
const COLOR_SWATCHES = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4",
  "#10b981", "#22c55e", "#eab308", "#f97316",
  "#ef4444", "#ec4899", "#a855f7", "#64748b",
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface EditProjectForm {
  name: string; is_client_project: boolean; client_id: string; client_name: string; template_id: string;
  project_type: string; description: string; start_date: string;
  projected_end_date: string; total_effort_hours: string;
  budget_amount: string; currency: string; color: string;
}
interface MemberSummary {
  project_id: string; user_id: string; member_type: string;
  project_role: string | null; allocation_percentage: number; user_name: string;
}

const defaultForm: EditProjectForm = {
  name: "", is_client_project: false, client_id: "", client_name: "", template_id: "", project_type: "fixed_cost",
  description: "", start_date: "", projected_end_date: "",
  total_effort_hours: "", budget_amount: "", currency: "USD", color: "#6366f1",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function projectColor(p: Project) { return (p as any).color ?? "#6366f1"; }

function trafficLight(p: Project): { dot: string; label: string; labelColor: string } {
  if (p.status === "cancelled")  return { dot: "⚫", label: "Cancelled",         labelColor: "text-gray-400" };
  if (p.status === "completed")  return { dot: "🟢", label: "Completed",          labelColor: "text-green-600" };
  if (!p.projected_end_date)     return { dot: "⚪", label: "No deadline",        labelColor: "text-gray-400" };
  const days = differenceInDays(new Date(p.projected_end_date), new Date());
  if (days < 0)   return { dot: "🔴", label: `${Math.abs(days)}d overdue`, labelColor: "text-red-600" };
  if (days <= 14) return { dot: "🟡", label: `${days}d left`,              labelColor: "text-yellow-600" };
  return            { dot: "🟢", label: `${days}d left`,                   labelColor: "text-green-600" };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Projects() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen]               = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm]               = useState<EditProjectForm>(defaultForm);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [typeFilter, setTypeFilter]           = useState("all");
  const [confirmedFilter, setConfirmedFilter] = useState("all");
  const [deleteProject, setDeleteProject]     = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiClient.get("/projects"),
  });

  const { data: templates = [] } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
    queryFn: () => apiClient.get("/project-templates"),
  });

  const { data: allMembers = [] } = useQuery<MemberSummary[]>({
    queryKey: ["/api/projects-members-all"],
    queryFn: () => apiClient.get("/projects-members-all"),
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiClient.get("/clients"),
  });

  const activeClients = (clients as any[]).filter((c: any) => c.status === "active" || c.status === "prospect");

  const activeTemplates = templates.filter((t) => t.is_active);

  // PM lookup per project
  const pmByProject = (projectId: string): string => {
    const pm = allMembers.find(
      (m) => m.project_id === projectId && m.member_type === "pm"
    );
    return pm?.user_name ?? "—";
  };
  const memberCount = (projectId: string) =>
    allMembers.filter((m) => m.project_id === projectId).length;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project updated successfully" });
      setOpen(false); setEditProject(null);
    },
    onError: () => toast({ title: "Failed to update project", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted", description: "All associated data has been permanently removed." });
      setDeleteProject(null);
    },
    onError: () => toast({ title: "Failed to delete project", variant: "destructive" }),
  });

  const handleOpenEdit = (p: Project, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setEditProject(p);
    setForm({
      name: p.name,
      is_client_project: (p as any).is_client_project ?? false,
      client_id: (p as any).client_id ?? "",
      client_name: p.client_name ?? "",
      template_id: p.template_id ?? "",
      project_type: p.project_type,
      description: p.description ?? "",
      start_date:          p.start_date          ? format(new Date(p.start_date), "yyyy-MM-dd")          : "",
      projected_end_date:  p.projected_end_date  ? format(new Date(p.projected_end_date), "yyyy-MM-dd")  : "",
      total_effort_hours:  p.total_effort_hours?.toString() ?? "",
      budget_amount:       p.budget_amount ?? "",
      currency:            p.currency ?? "USD",
      color:               (p as any).color ?? "#6366f1",
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast({ title: "Project name is required", variant: "destructive" }); return; }
    if (form.is_client_project && !form.client_id) {
      toast({ title: "Please select a client for this project", variant: "destructive" }); return;
    }
    if (!editProject) return;
    const selectedClient = (clients as any[]).find((c: any) => c.id === form.client_id);
    updateMutation.mutate({
      id: editProject.id,
      data: {
        name:                form.name.trim(),
        is_client_project:   form.is_client_project,
        client_id:           form.is_client_project ? form.client_id || null : null,
        client_name:         form.is_client_project ? (selectedClient?.name || null) : (form.client_name || null),
        template_id:         form.template_id || null,
        project_type:        form.project_type,
        description:         form.description || null,
        start_date:          form.start_date || null,
        projected_end_date:  form.projected_end_date || null,
        total_effort_hours:  form.total_effort_hours ? parseInt(form.total_effort_hours) : null,
        budget_amount:       form.budget_amount || null,
        currency:            form.currency,
        color:               form.color,
      },
    });
  };

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.name.toLowerCase().includes(q) || (p.client_name ?? "").toLowerCase().includes(q);
    const matchStatus    = statusFilter    === "all" || p.status        === statusFilter;
    const matchType      = typeFilter      === "all" || p.project_type  === typeFilter;
    const matchConfirmed = confirmedFilter === "all" ||
      (confirmedFilter === "confirmed"   &&  p.is_confirmed) ||
      (confirmedFilter === "unconfirmed" && !p.is_confirmed);
    return matchSearch && matchStatus && matchType && matchConfirmed;
  });

  const getTemplateName = (id: string | null) =>
    id ? (templates.find((t) => t.id === id)?.name ?? null) : null;

  const hasFilters = search || statusFilter !== "all" || typeFilter !== "all" || confirmedFilter !== "all";

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/projects/reports")} className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Reports
          </Button>
          <Button onClick={() => navigate("/projects/new")} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={confirmedFilter} onValueChange={setConfirmedFilter}>
          <SelectTrigger className="w-38 h-9"><SelectValue placeholder="Confirmation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="unconfirmed">Unconfirmed</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="text-gray-400 text-xs h-9"
            onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); setConfirmedFilter("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Project list ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500 dark:text-gray-400">
            {hasFilters ? "No projects match your filters" : "No projects yet"}
          </p>
          {!hasFilters && (
            <p className="text-sm mt-1">Click <strong>New Project</strong> to get started</p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((project) => {
            const color  = projectColor(project);
            const tl     = trafficLight(project);
            const pm     = pmByProject(project.id);
            const count  = memberCount(project.id);
            const tplName = getTemplateName(project.template_id);
            return (
              <div
                key={project.id}
                className="group relative flex items-stretch rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-150 overflow-hidden"
              >
                {/* Colored left accent bar */}
                <div className="w-1.5 shrink-0 rounded-l-xl" style={{ backgroundColor: color }} />

                {/* Main content — click anywhere to open detail */}
                <Link
                  to={`/projects/${project.id}`}
                  className="flex flex-1 items-center gap-0 min-w-0 px-4 py-3.5"
                >
                  {/* ── Column 1: Name + Client + Badges ── */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {project.name}
                      </span>
                      {project.is_confirmed && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3" /> Confirmed
                        </span>
                      )}
                    </div>
                    {project.client_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{project.client_name}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal">
                        {PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}
                      </Badge>
                      {tplName && (
                        <Badge variant="secondary" className="text-xs h-5 px-1.5 font-normal">{tplName}</Badge>
                      )}
                    </div>
                  </div>

                  {/* ── Column 2: PM + Team ── */}
                  <div className="w-44 shrink-0 border-l border-gray-100 dark:border-gray-800 pl-4 pr-3 hidden sm:block">
                    <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate font-medium">{pm}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span>{count} member{count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* ── Column 3: Dates + Budget ── */}
                  <div className="w-52 shrink-0 border-l border-gray-100 dark:border-gray-800 pl-4 pr-3 hidden md:block">
                    {(project.start_date || project.projected_end_date) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span>
                          {project.start_date ? format(new Date(project.start_date), "d MMM yy") : "?"}
                          <span className="mx-1 text-gray-300">→</span>
                          {project.projected_end_date ? format(new Date(project.projected_end_date), "d MMM yy") : "?"}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {project.total_effort_hours ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Timer className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{project.total_effort_hours.toLocaleString()}h</span>
                        </div>
                      ) : null}
                      {project.budget_amount ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <DollarSign className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{project.currency} {parseFloat(project.budget_amount).toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* ── Column 4: Status + Traffic Light ── */}
                  <div className="w-44 shrink-0 border-l border-gray-100 dark:border-gray-800 pl-4 flex flex-col gap-1.5 justify-center hidden lg:flex">
                    <Badge className={`text-xs border-0 w-fit ${STATUS_COLORS[project.status]}`}>
                      {STATUS_LABELS[project.status]}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{tl.dot}</span>
                      <span className={`text-xs font-medium ${tl.labelColor}`}>{tl.label}</span>
                    </div>
                  </div>

                  {/* ── Chevron ── */}
                  <div className="pl-3 shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>

                {/* Action buttons — overlaid so they don't bubble to Link */}
                <div className="flex items-center pr-3 gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleOpenEdit(project, e)}
                    title="Edit project"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteProject(project); }}
                    title="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditProject(null); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0">

          {/* Colour accent bar + header */}
          <div
            className="h-1.5 w-full rounded-t-lg shrink-0"
            style={{ backgroundColor: form.color }}
          />
          <div className="px-6 pt-5 pb-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: form.color + "22" }}>
                  <Folder className="h-4 w-4" style={{ color: form.color }} />
                </div>
                Edit Project
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                {editProject?.name}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-6">

            {/* ── Section: Basic Information ─────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Basic Information</span>
                <Separator className="flex-1" />
              </div>

              {/* Project Name */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Project Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Customer Portal Redesign"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-9"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  placeholder="Project overview, goals, scope..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Project Color */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Project Color</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <div
                    className="w-7 h-7 rounded-md border border-white shadow-sm shrink-0 ring-1 ring-gray-200 dark:ring-gray-600"
                    style={{ backgroundColor: form.color }}
                  />
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {COLOR_SWATCHES.map((c) => (
                      <button key={c} type="button" title={c}
                        onClick={() => setForm((p) => ({ ...p, color: c }))}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
                        style={{
                          backgroundColor: c,
                          borderColor: form.color === c ? "#1d4ed8" : "transparent",
                          outline: form.color === c ? "2px solid #bfdbfe" : "none",
                        }}
                      />
                    ))}
                    <input
                      type="color" value={form.color}
                      onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                      className="w-5 h-5 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-0"
                      title="Custom color"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section: Project Scope ─────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Project Scope</span>
                <Separator className="flex-1" />
              </div>

              {/* Internal / Client toggle */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Scope Type <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, is_client_project: false, client_id: "" }))}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      !form.is_client_project
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-transparent"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                      !form.is_client_project ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"
                    }`}>
                      <Building2 className={`h-4 w-4 ${!form.is_client_project ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium leading-snug ${!form.is_client_project ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                        Internal
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">No external client</p>
                    </div>
                    {!form.is_client_project && (
                      <CheckCircle2 className="h-4 w-4 text-blue-500 ml-auto shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, is_client_project: true }))}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      form.is_client_project
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-transparent"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                      form.is_client_project ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"
                    }`}>
                      <Users className={`h-4 w-4 ${form.is_client_project ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium leading-snug ${form.is_client_project ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                        Client Project
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">External client linked</p>
                    </div>
                    {form.is_client_project && (
                      <CheckCircle2 className="h-4 w-4 text-blue-500 ml-auto shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* Client dropdown — only when Client Project */}
              {form.is_client_project && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Client <span className="text-red-500">*</span>
                  </Label>
                  {activeClients.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>No active clients found. Add clients in the Clients section first.</span>
                    </div>
                  ) : (
                    <>
                      <Select value={form.client_id} onValueChange={(v) => setForm((p) => ({ ...p, client_id: v }))}>
                        <SelectTrigger className={`h-9 ${!form.client_id ? "border-red-300 dark:border-red-700 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder="Select a client…" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeClients.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span>{c.name}</span>
                                {c.organization_type && (
                                  <span className="text-xs text-gray-400">· {c.organization_type}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!form.client_id && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Client selection is required for client projects.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Section: Template & Type ───────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Template & Type</span>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Template */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Project Template</Label>
                  <Select
                    value={form.template_id || "none"}
                    onValueChange={(v) => {
                      const tpl = activeTemplates.find((t) => t.id === v);
                      setForm((p) => ({
                        ...p,
                        template_id:  v === "none" ? "" : v,
                        project_type: tpl ? tpl.project_type : p.project_type,
                      }));
                    }}
                    disabled={!!(editProject?.is_confirmed)}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="No template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {activeTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {editProject?.is_confirmed ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Locked after confirmation
                    </p>
                  ) : null}
                </div>

                {/* Project Type */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">Project Type <span className="text-red-500">*</span></Label>
                    {form.template_id && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">· set by template</span>
                    )}
                  </div>
                  <Select
                    value={form.project_type}
                    onValueChange={(v) => setForm((p) => ({ ...p, project_type: v }))}
                    disabled={!!form.template_id}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Section: Schedule ──────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Schedule</span>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" /> Start Date
                  </Label>
                  <Input
                    type="date" value={form.start_date} className="h-9"
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" /> End Date
                  </Label>
                  <Input
                    type="date" value={form.projected_end_date} className="h-9"
                    onChange={(e) => setForm((p) => ({ ...p, projected_end_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" /> Effort (hrs)
                  </Label>
                  <Input
                    type="number" min={0} placeholder="e.g. 500" value={form.total_effort_hours} className="h-9"
                    onChange={(e) => setForm((p) => ({ ...p, total_effort_hours: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* ── Section: Budget ────────────────────────────────────── */}
            <div className="space-y-4 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Budget</span>
                <Separator className="flex-1" />
              </div>

              <div className="flex gap-3">
                <div className="space-y-1.5 w-28 shrink-0">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-gray-400" /> Currency
                  </Label>
                  <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex-1">
                  <Label className="text-sm font-medium">Budget Amount</Label>
                  <Input
                    placeholder="e.g. 50000" value={form.budget_amount} className="h-9"
                    onChange={(e) => setForm((p) => ({ ...p, budget_amount: e.target.value }))}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Sticky footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shrink-0 bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="text-xs text-gray-400">
              {editProject?.is_confirmed && (
                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Project confirmed — some fields are locked
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setEditProject(null); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={updateMutation.isPending || (form.is_client_project && !form.client_id)}
                className="min-w-28"
              >
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteProject} onOpenChange={(v) => { if (!v) setDeleteProject(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will <strong>permanently delete</strong> the project <strong>&ldquo;{deleteProject?.name}&rdquo;</strong> and all of its associated data:
              </span>
              <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                <li>All members and membership history</li>
                <li>All milestones and their stages</li>
                <li>All feature groups and features</li>
                <li>All tasks linked to this project</li>
              </ul>
              <span className="block mt-2 font-medium text-red-600">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={(e) => { e.preventDefault(); if (deleteProject) deleteMutation.mutate(deleteProject.id); }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Yes, Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
