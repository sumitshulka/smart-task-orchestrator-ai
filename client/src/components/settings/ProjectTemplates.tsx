import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, GripVertical, Layers, Settings2 } from "lucide-react";
import { apiClient } from "@/lib/api";

type ProjectTemplate = {
  id: string;
  name: string;
  description: string | null;
  project_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProjectTemplateStage = {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  color: string;
  stage_order: number;
  created_at: string;
  updated_at: string;
};

const PROJECT_TYPES = [
  {
    value: "fixed_cost",
    label: "Fixed Cost",
    description: "Budget and scope are agreed upfront. The price doesn't change regardless of hours worked.",
  },
  {
    value: "time_material",
    label: "Time & Material",
    description: "Client is billed based on actual hours worked and materials used.",
  },
  {
    value: "milestone",
    label: "Milestone-Based",
    description: "Work is divided into defined milestones, each with its own deliverable and/or payment.",
  },
  {
    value: "retainer",
    label: "Retainer / Support",
    description: "Ongoing work on a subscription cycle (monthly/quarterly).",
  },
];

const STAGE_COLORS = [
  "#6b7280", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

const DEFAULT_STAGES: Record<string, { name: string; color: string }[]> = {
  fixed_cost: [
    { name: "Discovery", color: "#3b82f6" },
    { name: "Design", color: "#8b5cf6" },
    { name: "Development", color: "#f59e0b" },
    { name: "Testing", color: "#ec4899" },
    { name: "Delivery", color: "#10b981" },
    { name: "Closed", color: "#6b7280" },
  ],
  time_material: [
    { name: "Kickoff", color: "#3b82f6" },
    { name: "Active Development", color: "#f59e0b" },
    { name: "Review", color: "#ec4899" },
    { name: "Invoicing", color: "#10b981" },
    { name: "Closed", color: "#6b7280" },
  ],
  milestone: [
    { name: "Planning", color: "#3b82f6" },
    { name: "Milestone 1", color: "#8b5cf6" },
    { name: "Milestone 2", color: "#f59e0b" },
    { name: "Final Delivery", color: "#10b981" },
    { name: "Closed", color: "#6b7280" },
  ],
  retainer: [
    { name: "Setup", color: "#3b82f6" },
    { name: "Active", color: "#10b981" },
    { name: "On Hold", color: "#f59e0b" },
    { name: "Terminated", color: "#6b7280" },
  ],
};

function getProjectTypeBadgeColor(type: string) {
  switch (type) {
    case "fixed_cost": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "time_material": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "milestone": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "retainer": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    default: return "bg-gray-100 text-gray-800";
  }
}

function getProjectTypeLabel(type: string) {
  return PROJECT_TYPES.find(t => t.value === type)?.label ?? type;
}

// Sub-component that renders stages for a single template (allows proper hook usage)
function TemplateStagesPanel({
  template,
  userId,
  onAddStage,
  onEditStage,
  onDeleteStage,
}: {
  template: ProjectTemplate;
  userId: string;
  onAddStage: (templateId: string) => void;
  onEditStage: (templateId: string, stage: ProjectTemplateStage) => void;
  onDeleteStage: (templateId: string, stageId: string) => void;
}) {
  const { data: stages = [] } = useQuery<ProjectTemplateStage[]>({
    queryKey: ["/api/project-templates", template.id, "stages"],
    queryFn: () => apiClient.get(`/project-templates/${template.id}/stages`, { headers: { "x-user-id": userId } }),
  });

  return (
    <CardContent className="pt-0">
      <Separator className="mb-4" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Project Stages</span>
          <span className="text-xs text-muted-foreground">({stages.length} stages)</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => onAddStage(template.id)}>
          <Plus className="w-3 h-3 mr-1" />
          Add Stage
        </Button>
      </div>

      {stages.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-md">
          No stages defined yet. Add stages to define the project lifecycle.
        </div>
      ) : (
        <div className="space-y-2">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-3 p-2.5 rounded-md border bg-background hover:bg-muted/30 transition-colors group">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-mono text-muted-foreground w-5 text-center shrink-0">{stage.stage_order}</span>
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color ?? "#6b7280" }}
                />
                <span className="text-sm font-medium truncate">{stage.name}</span>
                {stage.description && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">— {stage.description}</span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEditStage(template.id, stage)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDeleteStage(template.id, stage.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  );
}

export default function ProjectTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; mode: "create" | "edit"; template?: ProjectTemplate }>({ open: false, mode: "create" });
  const [stageDialog, setStageDialog] = useState<{ open: boolean; mode: "create" | "edit"; templateId?: string; stage?: ProjectTemplateStage }>({ open: false, mode: "create" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "template" | "stage"; templateId: string; stageId?: string } | null>(null);

  const [templateForm, setTemplateForm] = useState({ name: "", description: "", project_type: "fixed_cost", is_active: true });
  const [stageForm, setStageForm] = useState({ name: "", description: "", color: "#6b7280" });

  const { data: templates = [], isLoading } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
    queryFn: () => apiClient.get("/project-templates", { headers: { "x-user-id": userId } }),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiClient.post("/project-templates", data, { headers: { "x-user-id": userId } }),
    onSuccess: async (newTemplate: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates"] });
      toast({ title: "Success", description: "Project template created with default stages" });
      setTemplateDialog({ open: false, mode: "create" });
      const defaults = DEFAULT_STAGES[templateForm.project_type] ?? [];
      for (let i = 0; i < defaults.length; i++) {
        await apiClient.post(`/project-templates/${newTemplate.id}/stages`, {
          name: defaults[i].name, color: defaults[i].color, stage_order: i + 1, description: ""
        }, { headers: { "x-user-id": userId } });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates", newTemplate.id, "stages"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to create template", variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.put(`/project-templates/${id}`, data, { headers: { "x-user-id": userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates"] });
      toast({ title: "Success", description: "Template updated" });
      setTemplateDialog({ open: false, mode: "create" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update template", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/project-templates/${id}`, { headers: { "x-user-id": userId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates"] });
      toast({ title: "Success", description: "Template deleted" });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete template", variant: "destructive" }),
  });

  const createStageMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: any }) =>
      apiClient.post(`/project-templates/${templateId}/stages`, data, { headers: { "x-user-id": userId } }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates", vars.templateId, "stages"] });
      toast({ title: "Success", description: "Stage added" });
      setStageDialog({ open: false, mode: "create" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add stage", variant: "destructive" }),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ templateId, stageId, data }: { templateId: string; stageId: string; data: any }) =>
      apiClient.put(`/project-templates/${templateId}/stages/${stageId}`, data, { headers: { "x-user-id": userId } }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates", vars.templateId, "stages"] });
      toast({ title: "Success", description: "Stage updated" });
      setStageDialog({ open: false, mode: "create" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update stage", variant: "destructive" }),
  });

  const deleteStageMutation = useMutation({
    mutationFn: ({ templateId, stageId }: { templateId: string; stageId: string }) =>
      apiClient.delete(`/project-templates/${templateId}/stages/${stageId}`, { headers: { "x-user-id": userId } }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates", vars.templateId, "stages"] });
      toast({ title: "Success", description: "Stage deleted" });
      setDeleteConfirm(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete stage", variant: "destructive" }),
  });

  function openCreateTemplate() {
    setTemplateForm({ name: "", description: "", project_type: "fixed_cost", is_active: true });
    setTemplateDialog({ open: true, mode: "create" });
  }

  function openEditTemplate(t: ProjectTemplate) {
    setTemplateForm({ name: t.name, description: t.description ?? "", project_type: t.project_type, is_active: t.is_active });
    setTemplateDialog({ open: true, mode: "edit", template: t });
  }

  function handleSaveTemplate() {
    if (!templateForm.name.trim()) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }
    if (templateDialog.mode === "create") {
      createTemplateMutation.mutate(templateForm);
    } else if (templateDialog.template) {
      updateTemplateMutation.mutate({ id: templateDialog.template.id, data: templateForm });
    }
  }

  function handleAddStage(templateId: string) {
    setStageForm({ name: "", description: "", color: "#6b7280" });
    setStageDialog({ open: true, mode: "create", templateId });
  }

  function handleEditStage(templateId: string, stage: ProjectTemplateStage) {
    setStageForm({ name: stage.name, description: stage.description ?? "", color: stage.color ?? "#6b7280" });
    setStageDialog({ open: true, mode: "edit", templateId, stage });
  }

  function handleDeleteStage(templateId: string, stageId: string) {
    setDeleteConfirm({ type: "stage", templateId, stageId });
  }

  function handleSaveStage() {
    if (!stageForm.name.trim()) {
      toast({ title: "Error", description: "Stage name is required", variant: "destructive" });
      return;
    }
    if (stageDialog.mode === "create" && stageDialog.templateId) {
      createStageMutation.mutate({ templateId: stageDialog.templateId, data: stageForm });
    } else if (stageDialog.mode === "edit" && stageDialog.templateId && stageDialog.stage) {
      updateStageMutation.mutate({ templateId: stageDialog.templateId, stageId: stageDialog.stage.id, data: stageForm });
    }
  }

  function handleConfirmDelete() {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "template") {
      deleteTemplateMutation.mutate(deleteConfirm.templateId);
    } else if (deleteConfirm.type === "stage" && deleteConfirm.stageId) {
      deleteStageMutation.mutate({ templateId: deleteConfirm.templateId, stageId: deleteConfirm.stageId });
    }
  }

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Templates</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Define templates for different types of projects. Each template has a type and a set of stages that projects follow from start to completion.
          </p>
        </div>
        <Button onClick={openCreateTemplate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* Project Type Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROJECT_TYPES.map(pt => (
          <div key={pt.value} className="rounded-md border p-3 bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getProjectTypeBadgeColor(pt.value)}`}>{pt.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{pt.description}</p>
          </div>
        ))}
      </div>

      <Separator />

      {templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">Create your first project template to get started.</p>
          <Button onClick={openCreateTemplate} className="mt-4" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(template => {
            const isExpanded = expandedTemplate === template.id;

            return (
              <Card key={template.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getProjectTypeBadgeColor(template.project_type)}`}>
                            {getProjectTypeLabel(template.project_type)}
                          </span>
                          {!template.is_active && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                          )}
                        </div>
                        {template.description && (
                          <CardDescription className="mt-0.5 text-sm">{template.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEditTemplate(template)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm({ type: "template", templateId: template.id })}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <TemplateStagesPanel
                    template={template}
                    userId={userId}
                    onAddStage={handleAddStage}
                    onEditStage={handleEditStage}
                    onDeleteStage={handleDeleteStage}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Template Dialog */}
      <Dialog open={templateDialog.open} onOpenChange={(open) => setTemplateDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{templateDialog.mode === "create" ? "Create Project Template" : "Edit Project Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Template Name *</Label>
              <Input
                id="tpl-name"
                value={templateForm.name}
                onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Standard Fixed Cost Project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                value={templateForm.description}
                onChange={e => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe when to use this template..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-type">Project Type *</Label>
              <Select
                value={templateForm.project_type}
                onValueChange={(v) => setTemplateForm(prev => ({ ...prev, project_type: v }))}
                disabled={templateDialog.mode === "edit"}
              >
                <SelectTrigger id="tpl-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map(pt => (
                    <SelectItem key={pt.value} value={pt.value}>
                      <div>
                        <div className="font-medium">{pt.label}</div>
                        <div className="text-xs text-muted-foreground">{pt.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateDialog.mode === "create" && (
                <p className="text-xs text-muted-foreground">
                  Default stages for the selected type will be pre-populated. You can edit them afterwards.
                </p>
              )}
              {templateDialog.mode === "edit" && (
                <p className="text-xs text-amber-600">Project type cannot be changed after creation.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog({ open: false, mode: "create" })}>Cancel</Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending)
                ? "Saving..."
                : templateDialog.mode === "create" ? "Create Template" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Dialog */}
      <Dialog open={stageDialog.open} onOpenChange={(open) => setStageDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{stageDialog.mode === "create" ? "Add Stage" : "Edit Stage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Stage Name *</Label>
              <Input
                id="stage-name"
                value={stageForm.name}
                onChange={e => setStageForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Discovery, Development..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-desc">Description</Label>
              <Input
                id="stage-desc"
                value={stageForm.description}
                onChange={e => setStageForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What happens in this stage?"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {STAGE_COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${stageForm.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setStageForm(prev => ({ ...prev, color: c }))}
                  />
                ))}
                <input
                  type="color"
                  value={stageForm.color}
                  onChange={e => setStageForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-7 h-7 rounded-full cursor-pointer border border-input"
                  title="Custom color"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog({ open: false, mode: "create" })}>Cancel</Button>
            <Button
              onClick={handleSaveStage}
              disabled={createStageMutation.isPending || updateStageMutation.isPending}
            >
              {(createStageMutation.isPending || updateStageMutation.isPending)
                ? "Saving..."
                : stageDialog.mode === "create" ? "Add Stage" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === "template" ? "Delete Template?" : "Delete Stage?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "template"
                ? "This will permanently delete the template and all its stages. This action cannot be undone."
                : "This will permanently remove this stage from the template."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirmDelete}
            >
              {deleteConfirm?.type === "template" ? "Delete Template" : "Delete Stage"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
