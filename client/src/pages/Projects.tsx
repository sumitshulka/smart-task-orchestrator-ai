import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiClient } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Folder, Calendar, Clock, ChevronRight, Search } from "lucide-react";
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

interface CreateProjectForm {
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
}

const defaultForm: CreateProjectForm = {
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
};

export default function Projects() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState<CreateProjectForm>(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
    });
    setOpen(true);
  };

  const handleTemplateChange = (templateId: string) => {
    const tpl = activeTemplates.find((t) => t.id === templateId);
    setForm((prev) => ({
      ...prev,
      template_id: templateId,
      project_type: tpl ? tpl.project_type : prev.project_type,
    }));
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
    };
    updateMutation.mutate({ id: editProject.id, data: payload });
  };

  const filtered = projects.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getTemplateName = (templateId: string | null) => {
    if (!templateId) return null;
    return templates.find((t) => t.id === templateId)?.name ?? null;
  };

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
        <Button onClick={() => navigate("/projects/new")} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
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
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {search || statusFilter !== "all" ? "No projects match your filters" : "No projects yet"}
          </p>
          {!search && statusFilter === "all" && (
            <p className="text-sm mt-1">Click "New Project" to get started</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border hover:border-blue-300 dark:hover:border-blue-600">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
                      {project.name}
                    </CardTitle>
                    <Badge className={`text-xs shrink-0 border-0 ${STATUS_COLORS[project.status]}`}>
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </div>
                  {project.client_name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{project.client_name}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}
                    </Badge>
                    {getTemplateName(project.template_id) && (
                      <Badge variant="secondary" className="text-xs">
                        {getTemplateName(project.template_id)}
                      </Badge>
                    )}
                    {project.is_confirmed && (
                      <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-0">
                        Confirmed
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {project.start_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>Start: {format(new Date(project.start_date), "MMM d, yyyy")}</span>
                      </div>
                    )}
                    {project.projected_end_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>Due: {format(new Date(project.projected_end_date), "MMM d, yyyy")}</span>
                      </div>
                    )}
                    {project.total_effort_hours && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>{project.total_effort_hours}h estimated</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={(e) => handleOpenEdit(project, e)}
                    >
                      Edit
                    </Button>
                    <div className="flex items-center text-blue-600 dark:text-blue-400">
                      <span className="text-xs font-medium">View details</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
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
                onValueChange={(v) => handleTemplateChange(v === "none" ? "" : v)}
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
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
