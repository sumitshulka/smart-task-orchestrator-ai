import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiClient } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Folder, Calendar, Clock, ChevronRight, Search, DollarSign, CheckCircle2, BarChart3 } from "lucide-react";
import type { Project, ProjectTemplate } from "@shared/schema";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  on_hold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  fixed_cost: "Fixed Cost",
  time_material: "Time & Material",
  milestone: "Milestone-Based",
  retainer: "Retainer",
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"];

const COLOR_SWATCHES = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4",
  "#10b981", "#22c55e", "#eab308", "#f97316",
  "#ef4444", "#ec4899", "#a855f7", "#64748b",
];

interface EditProjectForm {
  name: string;
  client_name: string;
  template_id: string;
  project_type: string;
  description: string;
  start_date: string;
  projected_end_date: string;
  total_effort_hours: string;
  budget_amount: string;
  currency: string;
  color: string;
}

const defaultForm: EditProjectForm = {
  name: "",
  client_name: "",
  template_id: "",
  project_type: "fixed_cost",
  description: "",
  start_date: "",
  projected_end_date: "",
  total_effort_hours: "",
  budget_amount: "",
  currency: "USD",
  color: "#6366f1",
};

export default function Projects() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState<EditProjectForm>(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [confirmedFilter, setConfirmedFilter] = useState("all");

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiClient.get("/projects"),
  });

  const { data: templates = [] } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
    queryFn: () => apiClient.get("/project-templates"),
  });

  const activeTemplates = templates.filter((t) => t.is_active);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project updated successfully" });
      setOpen(false);
      setEditProject(null);
    },
    onError: () => toast({ title: "Failed to update project", variant: "destructive" }),
  });

  const handleOpenEdit = (p: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditProject(p);
    setForm({
      name: p.name,
      client_name: p.client_name ?? "",
      template_id: p.template_id ?? "",
      project_type: p.project_type,
      description: p.description ?? "",
      start_date: p.start_date ? format(new Date(p.start_date), "yyyy-MM-dd") : "",
      projected_end_date: p.projected_end_date ? format(new Date(p.projected_end_date), "yyyy-MM-dd") : "",
      total_effort_hours: p.total_effort_hours?.toString() ?? "",
      budget_amount: p.budget_amount ?? "",
      currency: p.currency ?? "USD",
      color: (p as any).color ?? "#6366f1",
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Project name is required", variant: "destructive" });
      return;
    }
    if (!editProject) return;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      client_name: form.client_name || null,
      template_id: form.template_id || null,
      project_type: form.project_type,
      description: form.description || null,
      start_date: form.start_date || null,
      projected_end_date: form.projected_end_date || null,
      total_effort_hours: form.total_effort_hours ? parseInt(form.total_effort_hours) : null,
      budget_amount: form.budget_amount || null,
      currency: form.currency,
      color: form.color,
    };
    updateMutation.mutate({ id: editProject.id, data: payload });
  };

  const filtered = projects.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchType = typeFilter === "all" || p.project_type === typeFilter;
    const matchConfirmed =
      confirmedFilter === "all" ||
      (confirmedFilter === "confirmed" && p.is_confirmed) ||
      (confirmedFilter === "unconfirmed" && !p.is_confirmed);
    return matchSearch && matchStatus && matchType && matchConfirmed;
  });

  const getTemplateName = (templateId: string | null) => {
    if (!templateId) return null;
    return templates.find((t) => t.id === templateId)?.name ?? null;
  };

  const projectColor = (p: Project) => (p as any).color ?? "#6366f1";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/projects/reports")} className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Reports
          </Button>
          <Button onClick={() => navigate("/projects/new")} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={confirmedFilter} onValueChange={setConfirmedFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Confirmation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="unconfirmed">Unconfirmed</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== "all" || typeFilter !== "all" || confirmedFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 text-xs"
            onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); setConfirmedFilter("all"); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Project grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {search || statusFilter !== "all" || typeFilter !== "all" || confirmedFilter !== "all"
              ? "No projects match your filters"
              : "No projects yet"}
          </p>
          {!search && statusFilter === "all" && typeFilter === "all" && confirmedFilter === "all" && (
            <p className="text-sm mt-1">Click "New Project" to get started</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const color = projectColor(project);
            return (
              <Link key={project.id} to={`/projects/${project.id}`} className="block group">
                <Card
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden border border-gray-200 dark:border-gray-700"
                  style={{ borderLeft: `5px solid ${color}` }}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    {/* Status row */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[project.status]}`}>
                        {STATUS_LABELS[project.status]}
                      </Badge>
                      {project.is_confirmed && (
                        <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Confirmed
                        </span>
                      )}
                    </div>

                    {/* Project name */}
                    <h3 className="font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>
                    {project.client_name && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{project.client_name}</p>
                    )}
                  </CardHeader>

                  <CardContent className="pt-0 pb-4 px-4 space-y-3">
                    {/* Type & template badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}
                      </Badge>
                      {getTemplateName(project.template_id) && (
                        <Badge variant="secondary" className="text-xs">
                          {getTemplateName(project.template_id)}
                        </Badge>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
                      {project.start_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>
                            {format(new Date(project.start_date), "MMM d, yyyy")}
                            {project.projected_end_date && (
                              <> → {format(new Date(project.projected_end_date), "MMM d, yyyy")}</>
                            )}
                          </span>
                        </div>
                      )}
                      {project.total_effort_hours && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{project.total_effort_hours.toLocaleString()} hrs estimated</span>
                        </div>
                      )}
                      {project.budget_amount && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3 w-3 shrink-0" />
                          <span>{project.currency ?? "USD"} {parseFloat(project.budget_amount).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer row */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-gray-500 hover:text-gray-700"
                        onClick={(e) => handleOpenEdit(project, e)}
                      >
                        Edit
                      </Button>
                      <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
                        View details <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditProject(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Name */}
            <div className="col-span-2 space-y-1">
              <Label>Project Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Enter project name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* Client */}
            <div className="space-y-1">
              <Label>Client Name</Label>
              <Input
                placeholder="Client or organization"
                value={form.client_name}
                onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))}
              />
            </div>

            {/* Template */}
            <div className="space-y-1">
              <Label>Project Template</Label>
              <Select
                value={form.template_id || "none"}
                onValueChange={(v) => {
                  const tpl = activeTemplates.find((t) => t.id === v);
                  setForm((p) => ({
                    ...p,
                    template_id: v === "none" ? "" : v,
                    project_type: tpl ? tpl.project_type : p.project_type,
                  }));
                }}
                disabled={!!(editProject?.is_confirmed)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {activeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editProject?.is_confirmed && (
                <p className="text-xs text-amber-600">Template locked after confirmation</p>
              )}
            </div>

            {/* Project Type */}
            <div className="space-y-1">
              <Label>Project Type <span className="text-red-500">*</span></Label>
              <Select
                value={form.project_type}
                onValueChange={(v) => setForm((p) => ({ ...p, project_type: v }))}
                disabled={!!form.template_id}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.template_id && (
                <p className="text-xs text-gray-400">Set by template</p>
              )}
            </div>

            {/* Project Color */}
            <div className="space-y-1.5">
              <Label>Project Color</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 shrink-0"
                  style={{ backgroundColor: form.color }}
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setForm((p) => ({ ...p, color: c }))}
                      className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? "#1d4ed8" : "transparent",
                        outline: form.color === c ? "2px solid #bfdbfe" : "none",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                    className="w-5 h-5 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-0"
                    title="Custom color"
                  />
                </div>
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>

            {/* Projected End Date */}
            <div className="space-y-1">
              <Label>Projected End Date</Label>
              <Input
                type="date"
                value={form.projected_end_date}
                onChange={(e) => setForm((p) => ({ ...p, projected_end_date: e.target.value }))}
              />
            </div>

            {/* Total Effort */}
            <div className="space-y-1">
              <Label>Total Effort (hours)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 500"
                value={form.total_effort_hours}
                onChange={(e) => setForm((p) => ({ ...p, total_effort_hours: e.target.value }))}
              />
            </div>

            {/* Budget */}
            <div className="space-y-1">
              <Label>Budget Amount</Label>
              <div className="flex gap-2">
                <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="e.g. 50000"
                  value={form.budget_amount}
                  onChange={(e) => setForm((p) => ({ ...p, budget_amount: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea
                placeholder="Project overview, goals, scope..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditProject(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
