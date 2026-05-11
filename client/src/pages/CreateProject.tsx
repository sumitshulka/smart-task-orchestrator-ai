import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Folder, Calendar, DollarSign, Clock, FileText, Layers, Palette, Building2, Users } from "lucide-react";
import type { ProjectTemplate } from "@shared/schema";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  fixed_cost: "Fixed Cost",
  time_material: "Time & Material",
  milestone: "Milestone-Based",
  retainer: "Retainer",
};

const PROJECT_TYPE_DESCRIPTIONS: Record<string, string> = {
  fixed_cost: "A fixed scope and price agreed upfront",
  time_material: "Billed based on hours worked and materials used",
  milestone: "Payments tied to project milestones",
  retainer: "Ongoing engagement billed periodically",
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"];

const COLOR_SWATCHES = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4",
  "#10b981", "#22c55e", "#eab308", "#f97316",
  "#ef4444", "#ec4899", "#a855f7", "#64748b",
];

interface CreateProjectForm {
  name: string;
  is_client_project: boolean;
  client_id: string;
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

const defaultForm: CreateProjectForm = {
  name: "",
  is_client_project: false,
  client_id: "",
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

export default function CreateProject() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<CreateProjectForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
    queryFn: () => apiClient.get("/project-templates"),
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiClient.get("/clients"),
  });

  const activeTemplates = templates.filter((t) => t.is_active);
  const activeClients = (clients as any[]).filter((c: any) => c.status === "active" || c.status === "prospect");

  const handleTemplateChange = (templateId: string) => {
    if (templateId === "none") {
      setForm((p) => ({ ...p, template_id: "" }));
      return;
    }
    const tpl = activeTemplates.find((t) => t.id === templateId);
    setForm((p) => ({
      ...p,
      template_id: templateId,
      project_type: tpl ? tpl.project_type : p.project_type,
    }));
  };

  const selectedClient = (clients as any[]).find((c: any) => c.id === form.client_id);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Project name is required", variant: "destructive" });
      return;
    }
    if (form.is_client_project && !form.client_id) {
      toast({ title: "Please select a client for this project", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        is_client_project: form.is_client_project,
        client_id: form.is_client_project ? form.client_id : null,
        client_name: form.is_client_project
          ? (selectedClient?.name || null)
          : (form.client_name || null),
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
      const project = await apiClient.post("/projects", payload);
      toast({ title: "Project created successfully" });
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      toast({ title: "Failed to create project", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const selectedTemplate = activeTemplates.find((t) => t.id === form.template_id);

  return (
    <div className="max-w-3xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="gap-1.5 text-gray-600">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </div>

      <div className="flex items-center gap-3 pb-2">
        <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
          <Folder className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Project</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fill in the details below to set up your project</p>
        </div>
      </div>

      {/* Section 1: Basic Information */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-base">Basic Information</CardTitle>
          </div>
          <CardDescription>Core details that identify this project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Name */}
          <div className="space-y-1.5">
            <Label htmlFor="project-name">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="e.g. Customer Portal Redesign"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Project Scope Toggle */}
          <div className="space-y-2">
            <Label>Project Scope <span className="text-red-500">*</span></Label>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 gap-1 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, is_client_project: false, client_id: "" }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                  !form.is_client_project
                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Building2 className={`h-4 w-4 ${!form.is_client_project ? "text-blue-600" : "text-gray-400"}`} />
                Internal Project
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, is_client_project: true }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                  form.is_client_project
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Users className={`h-4 w-4 ${form.is_client_project ? "text-blue-100" : "text-gray-400"}`} />
                Client Project
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {form.is_client_project
                ? "This project is being done for an external client — a client must be selected."
                : "This is an internal project with no external client relationship."}
            </p>
          </div>

          {/* Client selector — only when Client Project */}
          {form.is_client_project && (
            <div className="space-y-1.5 rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4">
              <Label htmlFor="client-select">
                Client <span className="text-red-500">*</span>
              </Label>
              {activeClients.length === 0 ? (
                <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2 mt-1">
                  <span>No active clients found.</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-blue-600"
                    onClick={() => navigate("/clients")}
                  >
                    Go to Clients →
                  </Button>
                </div>
              ) : (
                <>
                  <Select value={form.client_id} onValueChange={(v) => setForm((p) => ({ ...p, client_id: v }))}>
                    <SelectTrigger id="client-select" className={`bg-white dark:bg-gray-800 ${!form.client_id ? "border-red-300 dark:border-red-700" : ""}`}>
                      <SelectValue placeholder="Select a client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeClients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
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
                    <p className="text-xs text-red-500 mt-1">Client selection is required for client projects.</p>
                  )}
                  {form.client_id && selectedClient && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      {selectedClient.primary_contact_name && (
                        <span>Contact: <strong>{selectedClient.primary_contact_name}</strong></span>
                      )}
                      {selectedClient.email && <span>· {selectedClient.email}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Briefly describe the project goals, scope, and expected outcomes..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Project Color */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-gray-500" />
              <Label>Project Color</Label>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 shrink-0"
                style={{ backgroundColor: form.color }}
              />
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setForm((p) => ({ ...p, color: c }))}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
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
                  className="w-6 h-6 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-0"
                  title="Custom color"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Shown as a color stripe on the project card</p>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Template & Project Type */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-base">Template & Project Type</CardTitle>
          </div>
          <CardDescription>
            Choose a template to pre-configure milestone stages, or set the project type manually
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template picker */}
          <div className="space-y-2">
            <Label>Project Template</Label>
            {activeTemplates.length === 0 ? (
              <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center text-sm text-gray-400">
                No templates available. You can configure templates in Settings.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTemplateChange("none")}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    !form.template_id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="font-medium text-sm text-gray-700 dark:text-gray-300">No Template</div>
                  <div className="text-xs text-gray-400 mt-0.5">Set everything manually</div>
                </button>
                {activeTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleTemplateChange(tpl.id)}
                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                      form.template_id === tpl.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{tpl.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {PROJECT_TYPE_LABELS[tpl.project_type] ?? tpl.project_type}
                      </Badge>
                    </div>
                    {tpl.description && (
                      <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{tpl.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Project type */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="project-type">Project Type</Label>
              {selectedTemplate && (
                <span className="text-xs text-blue-600 dark:text-blue-400">Set by template</span>
              )}
            </div>
            <Select
              value={form.project_type}
              onValueChange={(v) => setForm((p) => ({ ...p, project_type: v }))}
              disabled={!!selectedTemplate}
            >
              <SelectTrigger id="project-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    <div>
                      <div>{l}</div>
                      <div className="text-xs text-gray-400">{PROJECT_TYPE_DESCRIPTIONS[v]}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-base">Timeline</CardTitle>
          </div>
          <CardDescription>Set the project schedule and effort estimate</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-date">Projected End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={form.projected_end_date}
              onChange={(e) => setForm((p) => ({ ...p, projected_end_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="effort-hours">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Total Effort (hrs)
              </div>
            </Label>
            <Input
              id="effort-hours"
              type="number"
              min={0}
              placeholder="e.g. 500"
              value={form.total_effort_hours}
              onChange={(e) => setForm((p) => ({ ...p, total_effort_hours: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Budget */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-base">Budget</CardTitle>
          </div>
          <CardDescription>Optional budget for tracking and reporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="space-y-1.5 w-32 shrink-0">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="budget">Budget Amount</Label>
              <Input
                id="budget"
                placeholder="e.g. 50000"
                value={form.budget_amount}
                onChange={(e) => setForm((p) => ({ ...p, budget_amount: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <Button variant="outline" onClick={() => navigate("/projects")}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving || (form.is_client_project && !form.client_id)}
          className="min-w-36"
        >
          {saving ? "Creating..." : "Create Project"}
        </Button>
      </div>
    </div>
  );
}
