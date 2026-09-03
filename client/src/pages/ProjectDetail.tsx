import { useState, type ComponentType } from "react";
import WorkspaceTab from "@/components/WorkspaceTab";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiClient } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import EditTaskSheet from "@/components/EditTaskSheet";
import CreateDefectSheet from "@/components/CreateDefectSheet";
import DefectDetailsSheet from "@/components/DefectDetailsSheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CheckCircle2, Users, Milestone, Layers, Plus, Pencil, Trash2,
  Calendar, Clock, DollarSign, History, UserCircle, Tag, Grip, ChevronDown, ChevronUp,
  Search, ListTodo, ExternalLink, Flag, Bug, Building2, MessageSquare,
  LayoutDashboard, Menu, X, ChevronLeft, ChevronRight, TrendingUp,
  BarChart3, FileText, FolderOpen, ArrowRight, Target, Network, Settings2,
} from "lucide-react";
import PlanningWorkspace from "@/components/planning/PlanningWorkspace";
import { format, differenceInDays } from "date-fns";
import type {
  Project, ProjectTemplate, ProjectMember, ProjectMemberHistory,
  ProjectMilestone, MilestoneStage, ProjectTemplateStage,
  ProjectFeatureGroup, ProjectFeature, User, Task, TaskStatus,
} from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  on_hold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  fixed_cost: "Fixed Cost",
  time_material: "Time & Material",
  milestone: "Milestone-Based",
  retainer: "Retainer",
};

const MILESTONE_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  on_hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

const STAGE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900",
  completed: "bg-green-100 text-green-700 dark:bg-green-900",
};

const FEATURE_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600 dark:bg-gray-800",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900",
  completed: "bg-green-100 text-green-700 dark:bg-green-900",
};

function LaunchingSoonSection({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Card className="w-full max-w-2xl border-dashed">
        <CardContent className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Icon className="h-7 w-7" />
          </div>
          <Badge variant="secondary" className="mb-3 text-[10px] uppercase tracking-wider">
            Launching soon
          </Badge>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ==============================
// SUB-COMPONENT: MilestonePanel
// ==============================
function MilestonePanel({ milestone, project, templateId }: {
  milestone: ProjectMilestone;
  project: Project;
  templateId: string | null;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [stageDialog, setStageDialog] = useState(false);
  const [editStage, setEditStage] = useState<MilestoneStage | null>(null);
  const [stageForm, setStageForm] = useState({ name: "", description: "", color: "#6b7280", status: "pending" });

  const { data: stages = [] } = useQuery<MilestoneStage[]>({
    queryKey: ["/api/milestones", milestone.id, "stages"],
    queryFn: () => apiClient.get(`/milestones/${milestone.id}/stages`),
  });

  const { data: templateStages = [] } = useQuery<ProjectTemplateStage[]>({
    queryKey: ["/api/project-templates", templateId, "stages"],
    queryFn: () => apiClient.get(`/project-templates/${templateId}/stages`),
    enabled: !!templateId,
  });

  const createStage = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post(`/milestones/${milestone.id}/stages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones", milestone.id, "stages"] });
      toast({ title: "Stage added" });
      setStageDialog(false);
      setStageForm({ name: "", description: "", color: "#6b7280", status: "pending" });
    },
  });

  const updateStage = useMutation({
    mutationFn: ({ stageId, data }: { stageId: string; data: Record<string, unknown> }) =>
      apiClient.put(`/milestones/${milestone.id}/stages/${stageId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones", milestone.id, "stages"] });
      toast({ title: "Stage updated" });
      setStageDialog(false);
      setEditStage(null);
    },
  });

  const deleteStage = useMutation({
    mutationFn: (stageId: string) =>
      apiClient.delete(`/milestones/${milestone.id}/stages/${stageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones", milestone.id, "stages"] });
      toast({ title: "Stage deleted" });
    },
  });

  const inheritStages = useMutation({
    mutationFn: () =>
      apiClient.post(`/milestones/${milestone.id}/inherit-stages`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones", milestone.id, "stages"] });
      toast({ title: "Stages inherited from template" });
    },
    onError: () => toast({ title: "Failed to inherit stages", variant: "destructive" }),
  });

  const openEditStage = (stage: MilestoneStage) => {
    setEditStage(stage);
    setStageForm({ name: stage.name, description: stage.description ?? "", color: stage.color ?? "#6b7280", status: stage.status });
    setStageDialog(true);
  };

  const handleSubmitStage = () => {
    if (!stageForm.name.trim()) return;
    const data = { name: stageForm.name, description: stageForm.description || null, color: stageForm.color, status: stageForm.status };
    if (editStage) {
      updateStage.mutate({ stageId: editStage.id, data });
    } else {
      createStage.mutate(data);
    }
  };

  return (
    <div className="border rounded-xl dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{milestone.name}</span>
            <Badge className={`text-xs border-0 ${MILESTONE_STATUS_COLORS[milestone.status]}`}>
              {milestone.status.replace("_", " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {milestone.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(milestone.start_date), "d MMM yy")}</span>}
            {milestone.end_date && <span className="flex items-center gap-1"><Flag className="h-3 w-3" />{format(new Date(milestone.end_date), "d MMM yy")}</span>}
            <span>{stages.length} stage{stages.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
      </div>

      {/* Stages (expanded) */}
      {expanded && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stages</span>
            <div className="flex gap-2">
              {templateId && stages.length === 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => inheritStages.mutate()}>
                  Inherit from Template
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs gap-1"
                onClick={() => { setEditStage(null); setStageForm({ name: "", description: "", color: "#6b7280", status: "pending" }); setStageDialog(true); }}>
                <Plus className="h-3 w-3" /> Add Stage
              </Button>
            </div>
          </div>

          {stages.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No stages yet. {templateId ? "Inherit from template or add manually." : "Add stages manually."}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border"
                  style={{ borderColor: stage.color ?? "#6b7280", backgroundColor: `${stage.color ?? "#6b7280"}15` }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color ?? "#6b7280" }} />
                  <span className="font-medium">{stage.name}</span>
                  <Badge className={`text-xs border-0 h-4 px-1 ${STAGE_STATUS_COLORS[stage.status]}`} style={{ fontSize: "9px" }}>
                    {stage.status}
                  </Badge>
                  <button onClick={() => openEditStage(stage)} className="text-gray-400 hover:text-gray-600 ml-1">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => deleteStage.mutate(stage.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stage dialog */}
      <Dialog open={stageDialog} onOpenChange={(v) => { setStageDialog(v); if (!v) setEditStage(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editStage ? "Edit Stage" : "Add Stage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Stage Name *</Label>
              <Input value={stageForm.name} onChange={(e) => setStageForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={stageForm.description} onChange={(e) => setStageForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={stageForm.color} onChange={(e) => setStageForm(p => ({ ...p, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border" />
                  <span className="text-xs text-gray-500">{stageForm.color}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={stageForm.status} onValueChange={(v) => setStageForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitStage} disabled={!stageForm.name.trim()}>
              {editStage ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================
// MAIN PAGE
// ==========================
export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Project data
  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    queryFn: () => apiClient.get(`/projects/${id}`),
    enabled: !!id,
  });

  const { data: templates = [] } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
    queryFn: () => apiClient.get("/project-templates"),
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiClient.get("/clients"),
  });

  const linkedClient = (project as any)?.client_id
    ? (clients as any[]).find((c: any) => c.id === (project as any).client_id)
    : null;

  const { data: clientContacts = [] } = useQuery<any[]>({
    queryKey: ["/api/clients", (project as any)?.client_id, "contacts"],
    queryFn: () => apiClient.get(`/clients/${(project as any).client_id}/contacts`),
    enabled: !!(project as any)?.client_id,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiClient.get("/users"),
  });

  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ["/api/projects", id, "members"],
    queryFn: () => apiClient.get(`/projects/${id}/members`),
    enabled: !!id,
  });

  const { data: memberHistory = [] } = useQuery<ProjectMemberHistory[]>({
    queryKey: ["/api/projects", id, "members", "history"],
    queryFn: () => apiClient.get(`/projects/${id}/members/history`),
    enabled: !!id,
  });

  const { data: milestones = [] } = useQuery<ProjectMilestone[]>({
    queryKey: ["/api/projects", id, "milestones"],
    queryFn: () => apiClient.get(`/projects/${id}/milestones`),
    enabled: !!id,
  });

  const { data: featureGroups = [] } = useQuery<ProjectFeatureGroup[]>({
    queryKey: ["/api/projects", id, "feature-groups"],
    queryFn: () => apiClient.get(`/projects/${id}/feature-groups`),
    enabled: !!id,
  });

  const { data: features = [] } = useQuery<ProjectFeature[]>({
    queryKey: ["/api/projects", id, "features"],
    queryFn: () => apiClient.get(`/projects/${id}/features`),
    enabled: !!id,
  });

  const { data: projectTasks = [], refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ["/api/projects", id, "tasks"],
    queryFn: () => apiClient.get(`/projects/${id}/tasks`),
    enabled: !!id,
  });

  const { data: taskStatuses = [] } = useQuery<TaskStatus[]>({
    queryKey: ["/api/task-statuses"],
    queryFn: () => apiClient.get("/task-statuses"),
  });

  // Task tab filters
  const [taskSearch, setTaskSearch]         = useState("");
  const [taskMilestoneFilter, setTaskMilestoneFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter]       = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter]   = useState("all");
  const [editingTask, setEditingTask]       = useState<Task | null>(null);
  const [editTaskOpen, setEditTaskOpen]     = useState(false);

  // Defects tab state
  const [createDefectOpen, setCreateDefectOpen] = useState(false);
  const [selectedDefect, setSelectedDefect]     = useState<any>(null);
  const [defectSearch, setDefectSearch]         = useState("");
  const [defectStatusFilter, setDefectStatusFilter] = useState("all");
  const [defectSeverityFilter, setDefectSeverityFilter] = useState("all");

  const { data: projectDefects = [], refetch: refetchDefects } = useQuery<any[]>({
    queryKey: ["/api/projects", id, "defects"],
    queryFn: () => apiClient.get(`/projects/${id}/defects`),
    enabled: !!id,
  });

  const filteredDefects = projectDefects.filter((d: any) => {
    const q = defectSearch.toLowerCase();
    const matchesSearch = !q || d.title.toLowerCase().includes(q);
    const matchesStatus   = defectStatusFilter   === "all" || d.status   === defectStatusFilter;
    const matchesSeverity = defectSeverityFilter === "all" || d.severity === defectSeverityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // State for dialogs
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [deleteDialog, setDeleteDialog]   = useState(false);
  const [memberDialog, setMemberDialog]   = useState(false);
  const [editMember, setEditMember]       = useState<ProjectMember | null>(null);
  const [memberForm, setMemberForm]       = useState({ user_id: "", contact_id: "", member_user_type: "internal", member_type: "member", project_role: "", allocation_percentage: 100 });
  const [milestoneDialog, setMilestoneDialog] = useState(false);
  const [editMilestone, setEditMilestone]     = useState<ProjectMilestone | null>(null);
  const [msForm, setMsForm] = useState({ name: "", description: "", start_date: "", end_date: "", status: "not_started", inherit_stages: true });
  const [featureGroupDialog, setFeatureGroupDialog]   = useState(false);
  const [editFeatureGroup, setEditFeatureGroup]       = useState<ProjectFeatureGroup | null>(null);
  const [fgForm, setFgForm] = useState({ name: "", description: "" });
  const [featureDialog, setFeatureDialog] = useState(false);
  const [editFeature, setEditFeature]     = useState<ProjectFeature | null>(null);
  const [featureForm, setFeatureForm]     = useState({ name: "", description: "", feature_group_id: "", status: "not_started" });
  const [showHistory, setShowHistory]     = useState(false);

  // ── Sidebar / section state ────────────────────────────────────────────────
  const [activeSection, setActiveSection]         = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed]   = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Mutations
  const confirmMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project confirmed and marked as Active" });
      setConfirmDialog(false);
    },
    onError: () => toast({ title: "Failed to confirm project", variant: "destructive" }),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => apiClient.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted", description: "All associated data has been permanently removed." });
      navigate("/projects");
    },
    onError: () => toast({ title: "Failed to delete project", variant: "destructive" }),
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post(`/projects/${id}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members", "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects-members-all"] });
      toast({ title: editMember ? "Member updated" : "Member added" });
      setMemberDialog(false);
      setEditMember(null);
      setMemberForm({ user_id: "", contact_id: "", member_user_type: "internal", member_type: "member", project_role: "", allocation_percentage: 100 });
    },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: Record<string, unknown> }) =>
      apiClient.put(`/projects/${id}/members/${memberId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members", "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects-members-all"] });
      toast({ title: "Member updated" });
      setMemberDialog(false);
      setEditMember(null);
    },
    onError: () => toast({ title: "Failed to update member", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiClient.delete(`/projects/${id}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members", "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects-members-all"] });
      toast({ title: "Member removed" });
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post(`/projects/${id}/milestones`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "milestones"] });
      toast({ title: "Milestone created" });
      setMilestoneDialog(false);
      setMsForm({ name: "", description: "", start_date: "", end_date: "", status: "not_started", inherit_stages: true });
    },
    onError: () => toast({ title: "Failed to create milestone", variant: "destructive" }),
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ msId, data }: { msId: string; data: Record<string, unknown> }) =>
      apiClient.put(`/projects/${id}/milestones/${msId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "milestones"] });
      toast({ title: "Milestone updated" });
      setMilestoneDialog(false);
      setEditMilestone(null);
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (msId: string) => apiClient.delete(`/projects/${id}/milestones/${msId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "milestones"] });
      toast({ title: "Milestone deleted" });
    },
  });

  const createFGMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post(`/projects/${id}/feature-groups`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "feature-groups"] });
      toast({ title: "Feature group created" });
      setFeatureGroupDialog(false);
      setFgForm({ name: "", description: "" });
    },
  });

  const updateFGMutation = useMutation({
    mutationFn: ({ fgId, data }: { fgId: string; data: Record<string, unknown> }) =>
      apiClient.put(`/projects/${id}/feature-groups/${fgId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "feature-groups"] });
      toast({ title: "Feature group updated" });
      setFeatureGroupDialog(false);
      setEditFeatureGroup(null);
    },
  });

  const deleteFGMutation = useMutation({
    mutationFn: (fgId: string) => apiClient.delete(`/projects/${id}/feature-groups/${fgId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "feature-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "features"] });
      toast({ title: "Feature group deleted" });
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post(`/projects/${id}/features`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "features"] });
      toast({ title: "Feature created" });
      setFeatureDialog(false);
      setFeatureForm({ name: "", description: "", feature_group_id: "", status: "not_started" });
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: ({ fId, data }: { fId: string; data: Record<string, unknown> }) =>
      apiClient.put(`/projects/${id}/features/${fId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "features"] });
      toast({ title: "Feature updated" });
      setFeatureDialog(false);
      setEditFeature(null);
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: (fId: string) => apiClient.delete(`/projects/${id}/features/${fId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "features"] });
      toast({ title: "Feature deleted" });
    },
  });

  // Filtered tasks for Tasks tab
  const filteredProjectTasks = projectTasks.filter((t) => {
    if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase())) return false;
    if (taskMilestoneFilter !== "all") {
      if (taskMilestoneFilter === "none" && t.milestone_id) return false;
      if (taskMilestoneFilter !== "none" && t.milestone_id !== taskMilestoneFilter) return false;
    }
    if (taskStatusFilter !== "all" && t.status !== taskStatusFilter) return false;
    if (taskAssigneeFilter !== "all" && t.assigned_to !== taskAssigneeFilter) return false;
    return true;
  });

  // Group tasks by milestone for Tasks tab
  const tasksByMilestone: { milestoneId: string | null; milestoneName: string; tasks: Task[] }[] = [];
  const milestonesWithTasks = milestones.filter((ms) => filteredProjectTasks.some((t) => t.milestone_id === ms.id));
  milestonesWithTasks.forEach((ms) => {
    tasksByMilestone.push({
      milestoneId: ms.id,
      milestoneName: ms.name,
      tasks: filteredProjectTasks.filter((t) => t.milestone_id === ms.id),
    });
  });
  const unlinkedTasks = filteredProjectTasks.filter((t) => !t.milestone_id);
  if (unlinkedTasks.length > 0) {
    tasksByMilestone.push({ milestoneId: null, milestoneName: "No Milestone", tasks: unlinkedTasks });
  }

  const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
    1: { label: "Critical", color: "text-red-600"    },
    2: { label: "High",     color: "text-orange-500" },
    3: { label: "Medium",   color: "text-yellow-500" },
    4: { label: "Low",      color: "text-blue-400"   },
    5: { label: "Minimal",  color: "text-gray-400"   },
  };

  // Helpers
  const getUserName = (userId: string | null) => {
    if (!userId) return "Unknown";
    const u = users.find(u => u.id === userId);
    return u?.user_name ?? u?.email ?? "Unknown";
  };

  const getMemberDisplayName = (m: any): string => {
    if ((m.member_user_type === "client_contact" || m.contact_id) && !m.user_id) {
      const contact = (clientContacts as any[]).find((c: any) => c.id === m.contact_id);
      return contact?.name ?? "Client Contact";
    }
    return getUserName(m.user_id);
  };

  const getMemberTypeLabel = (m: any): "internal" | "client_contact" =>
    m.member_user_type === "client_contact" || (m.contact_id && !m.user_id) ? "client_contact" : "internal";

  const getTemplateName = () => {
    if (!project?.template_id) return null;
    return templates.find(t => t.id === project.template_id)?.name ?? null;
  };

  const pm = members.find(m => m.member_type === "project_manager");
  const teamMembers = members.filter(m => m.member_type === "member");

  const openEditMember = (m: ProjectMember) => {
    setEditMember(m);
    setMemberForm({
      user_id: m.user_id ?? "",
      contact_id: (m as any).contact_id ?? "",
      member_user_type: (m as any).member_user_type ?? "internal",
      member_type: m.member_type,
      project_role: m.project_role ?? "",
      allocation_percentage: m.allocation_percentage ?? 100,
    });
    setMemberDialog(true);
  };

  const openEditMilestone = (ms: ProjectMilestone) => {
    setEditMilestone(ms);
    setMsForm({
      name: ms.name,
      description: ms.description ?? "",
      start_date: ms.start_date ? format(new Date(ms.start_date), "yyyy-MM-dd") : "",
      end_date: ms.end_date ? format(new Date(ms.end_date), "yyyy-MM-dd") : "",
      status: ms.status,
      inherit_stages: false,
    });
    setMilestoneDialog(true);
  };

  // ── Overview computed stats ────────────────────────────────────────────────
  const doneStatusIds = taskStatuses
    .filter(s => { const n = (s.name ?? "").toLowerCase(); return n.includes("done") || n.includes("complet") || n.includes("closed") || n.includes("resolved"); })
    .map(s => s.id);
  const inProgStatusIds = taskStatuses
    .filter(s => { const n = (s.name ?? "").toLowerCase(); return n.includes("progress") || n.includes("review") || n.includes("test") || n.includes("doing"); })
    .map(s => s.id);

  const doneTaskCount    = projectTasks.filter(t => doneStatusIds.includes(t.status)).length;
  const inProgTaskCount  = projectTasks.filter(t => inProgStatusIds.includes(t.status)).length;
  const overdueTaskCount = projectTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !doneStatusIds.includes(t.status)).length;
  const todoTaskCount    = Math.max(0, projectTasks.length - doneTaskCount - inProgTaskCount);
  const completionPct    = projectTasks.length > 0 ? Math.round((doneTaskCount / projectTasks.length) * 100) : 0;

  const today     = new Date();
  const startDate = project?.start_date ? new Date(project.start_date) : null;
  const endDate   = project?.projected_end_date ? new Date(project.projected_end_date) : null;
  const daysElapsed   = startDate ? Math.max(0, differenceInDays(today, startDate)) : null;
  const daysRemaining = endDate ? differenceInDays(endDate, today) : null;
  const totalDays     = startDate && endDate ? differenceInDays(endDate, startDate) : null;

  const isOverdue  = daysRemaining !== null && daysRemaining < 0;
  const healthScore = isOverdue ? Math.max(5, completionPct - 20) : completionPct;
  const healthLabel = isOverdue ? "Overdue" : completionPct >= 70 ? "On Track" : completionPct >= 40 ? "At Risk" : projectTasks.length === 0 ? "No Tasks" : "Needs Attention";
  const healthColor = isOverdue ? "text-red-600 dark:text-red-400" : completionPct >= 70 ? "text-green-600 dark:text-green-400" : completionPct >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-orange-600 dark:text-orange-400";
  const healthBg    = isOverdue ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : completionPct >= 70 ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : completionPct >= 40 ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800";
  const healthBarColor = isOverdue ? "bg-red-500" : completionPct >= 70 ? "bg-green-500" : completionPct >= 40 ? "bg-yellow-500" : "bg-orange-400";

  // Upcoming tasks (due in next 14 days, not done)
  const upcomingTasks = projectTasks
    .filter(t => {
      if (!t.due_date || doneStatusIds.includes(t.status)) return false;
      const days = differenceInDays(new Date(t.due_date), today);
      return days >= 0 && days <= 14;
    })
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  // ── Sidebar nav items ──────────────────────────────────────────────────────
  const navItems = [
    { id: "overview",    label: "Overview",    icon: LayoutDashboard },
    { id: "planning",    label: "Planning",    icon: Network },
    { id: "members",     label: "Members",     icon: Users,     count: members.length },
    { id: "milestones",  label: "Milestones",  icon: Milestone, count: milestones.length },
    { id: "features",    label: "Features",    icon: Layers,    count: features.length },
    { id: "tasks",       label: "Tasks",       icon: ListTodo,  count: projectTasks.length },
    { id: "defects",     label: "Defects",     icon: Bug,       count: projectDefects.length, badge: projectDefects.length > 0 },
    { id: "meetings",    label: "Meetings",    icon: Calendar },
    { id: "finance",     label: "Finance",     icon: DollarSign },
    { id: "documents",   label: "Documents",   icon: FileText },
    { id: "settings",    label: "Settings",    icon: Settings2 },
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Project not found.</p>
        <Button variant="outline" onClick={() => navigate("/projects")} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  const projectColor = (project as any).color ?? "#6366f1";

  return (
    <>
      {/* ── Full-width flex layout ──────────────────────────────────────────── */}
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">

        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ── Left Sub-Sidebar ─────────────────────────────────────────────── */}
        <aside
          className={[
            "flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shrink-0 transition-all duration-200",
            // Mobile: fixed slide-in
            "fixed inset-y-0 left-0 z-50 lg:relative lg:inset-auto lg:z-auto",
            mobileSidebarOpen ? "translate-x-0 w-52" : "-translate-x-full lg:translate-x-0",
            // Desktop: collapsed vs expanded
            sidebarCollapsed ? "lg:w-14" : "lg:w-52",
          ].join(" ")}
        >
          {/* Project identity header */}
          <div className="flex items-center h-14 px-3 border-b border-gray-100 dark:border-gray-800 shrink-0 gap-2">
            <div
              className="h-7 w-7 rounded-md shrink-0 flex items-center justify-center"
              style={{ backgroundColor: projectColor }}
            >
              <FolderOpen className="h-3.5 w-3.5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">{project.name}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                  {PROJECT_TYPE_LABELS[project.project_type] ?? "Project"}
                </p>
              </div>
            )}
            <button
              className="ml-auto lg:hidden text-gray-400 hover:text-gray-600 shrink-0"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => { setActiveSection(item.id); setMobileSidebarOpen(false); }}
                  className={[
                    "relative w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                  ].join(" ")}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {(item as any).count !== undefined && (item as any).count > 0 && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${isActive ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                          {(item as any).count}
                        </span>
                      )}
                      {(item as any).badge && (item as any).count === 0 ? null : null}
                    </>
                  )}
                  {sidebarCollapsed && (item as any).count !== undefined && (item as any).count > 0 && (
                    <span className="absolute right-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom: Workspace + collapse toggle */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-2 space-y-1">
            <button
              title={sidebarCollapsed ? "Project Workspace" : undefined}
              onClick={() => { setActiveSection("workspace"); setMobileSidebarOpen(false); }}
              className={[
                "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors",
                activeSection === "workspace"
                  ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              <MessageSquare className={`h-4 w-4 shrink-0 ${activeSection === "workspace" ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`} />
              {!sidebarCollapsed && <span className="truncate">Project Workspace</span>}
            </button>

            {/* Desktop collapse toggle */}
            <button
              className="hidden lg:flex w-full items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={() => setSidebarCollapsed(v => !v)}
            >
              {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <><ChevronLeft className="h-3.5 w-3.5" /><span>Collapse</span></>}
            </button>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Project Header Bar */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 lg:px-5 py-3 flex items-center gap-2.5 flex-wrap shrink-0">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb */}
            <button
              onClick={() => navigate("/projects")}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Projects</span>
            </button>
            <span className="text-gray-200 dark:text-gray-700 text-sm">/</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{project.name}</span>

            {/* Status + confirmation badges */}
            <Badge className={`text-xs border-0 ${STATUS_COLORS[project.status]}`}>
              {project.status.replace("_", " ")}
            </Badge>
            {project.is_confirmed && (
              <Badge className="text-xs border-0 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmed
              </Badge>
            )}

            {/* Scope + type (hidden on small) */}
            <div className="hidden md:flex items-center gap-1.5">
              {(project as any).is_client_project && project.client_name ? (
                linkedClient ? (
                  <Link
                    to={`/clients/${linkedClient.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 hover:bg-orange-100 transition-colors"
                  >
                    <Building2 className="h-3 w-3" />{project.client_name}<ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
                    <Building2 className="h-3 w-3" />{project.client_name}
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                  <Building2 className="h-3 w-3" />Internal
                </span>
              )}
              <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal">
                {PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {!project.is_confirmed && (
                <Button size="sm" onClick={() => setConfirmDialog(true)} className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                onClick={() => setDeleteDialog(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>

          {/* Section Content */}
          <div className={`flex-1 min-h-0 ${activeSection === "planning" ? "overflow-visible flex flex-col" : "overflow-auto p-4 lg:p-6"}`}>

            {/* ══════════════════ PLANNING ══════════════════ */}
            {activeSection === "planning" && (
              <PlanningWorkspace projectId={id!} users={users as User[]} />
            )}

            {/* ══════════════════ COMING SOON MODULES ══════════════════ */}
            {activeSection === "finance" && (
              <LaunchingSoonSection
                icon={DollarSign}
                title="Project Finance"
                description="This module will contain project-related finance items and will ultimately help determine project profitability."
              />
            )}
            {activeSection === "meetings" && (
              <LaunchingSoonSection
                icon={Calendar}
                title="Project Meetings"
                description="This advanced module will store project meeting details, action plans, and related items so progress can be tracked from the project level."
              />
            )}
            {activeSection === "documents" && (
              <LaunchingSoonSection
                icon={FileText}
                title="Project Documents"
                description="This module will store project-related documents and act as the project document repository."
              />
            )}
            {activeSection === "settings" && (
              <LaunchingSoonSection
                icon={Settings2}
                title="Project Settings"
                description="This area will contain project-related configuration and settings."
              />
            )}

            {/* ══════════════════ OVERVIEW ══════════════════ */}
            {activeSection === "overview" && (
              <div className="space-y-5 max-w-7xl">

                {/* Row 1: Health + Progress + Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Project Health */}
                  <div className={`rounded-xl border p-4 ${healthBg}`}>
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Project Health</p>
                    <div className="flex items-end gap-3 mb-2">
                      <span className={`text-5xl font-bold leading-none ${healthColor}`}>{healthScore}%</span>
                      <span className={`text-sm font-bold mb-1 ${healthColor}`}>{healthLabel}</span>
                    </div>
                    <div className="w-full bg-white/60 dark:bg-gray-800/60 rounded-full h-2 mb-3">
                      <div
                        className={`h-2 rounded-full transition-all ${healthBarColor}`}
                        style={{ width: `${Math.min(100, Math.max(0, healthScore))}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {completionPct}% of tasks completed
                      {daysRemaining !== null && daysRemaining > 0 ? ` · ${daysRemaining}d remaining` : ""}
                      {isOverdue ? ` · ${Math.abs(daysRemaining!)}d overdue` : ""}
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Progress</p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">{completionPct}%</span>
                      <span className="text-xs text-gray-400">Overall Completion</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-4">
                      <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${completionPct}%` }} />
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      {[
                        { label: "Done",        count: doneTaskCount,    color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30" },
                        { label: "In Progress", count: inProgTaskCount,  color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30" },
                        { label: "To Do",       count: todoTaskCount,    color: "text-gray-600 dark:text-gray-300",    bg: "bg-gray-50 dark:bg-gray-800/50" },
                        { label: "Overdue",     count: overdueTaskCount, color: "text-red-600 dark:text-red-400",      bg: "bg-red-50 dark:bg-red-950/30" },
                      ].map(s => (
                        <div key={s.label} className={`rounded-lg p-2 ${s.bg}`}>
                          <p className={`text-xl font-bold leading-none ${s.color}`}>{s.count}</p>
                          <p className="text-[9px] text-gray-400 mt-1 leading-tight">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Timeline</p>
                    <div className="space-y-3">
                      {[
                        { label: "Start Date",      value: startDate ? format(startDate, "dd MMM yyyy") : "—",                                                      icon: Calendar,    color: "text-blue-500" },
                        { label: "Planned End",     value: endDate ? format(endDate, "dd MMM yyyy") : "—",                                                          icon: Flag,        color: "text-orange-500" },
                        { label: "Days Elapsed",    value: daysElapsed !== null ? `${daysElapsed} days` : "—",                                                      icon: Clock,       color: "text-gray-400" },
                        { label: "Days Remaining",  value: daysRemaining !== null ? (daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining} days`) : "—", icon: TrendingUp, color: daysRemaining !== null && daysRemaining < 0 ? "text-red-500" : "text-green-500" },
                      ].map(row => {
                        const Icon = row.icon;
                        return (
                          <div key={row.label} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                              <Icon className={`h-3.5 w-3.5 shrink-0 ${row.color}`} />
                              <span className="text-xs">{row.label}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{row.value}</span>
                          </div>
                        );
                      })}
                    </div>
                    {totalDays && totalDays > 0 && daysElapsed !== null && (
                      <div className="mt-3">
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${isOverdue ? "bg-red-400" : "bg-blue-400"} transition-all`}
                            style={{ width: `${Math.min(100, Math.round((daysElapsed / totalDays) * 100))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>Start</span><span>End</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Team Workload + Upcoming Tasks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Team & Workload */}
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Team & Workload</p>
                      <button
                        onClick={() => setActiveSection("members")}
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
                      >
                        View all <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    {members.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No team members yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {members.slice(0, 6).map(m => {
                          const name = getMemberDisplayName(m);
                          const role = m.member_type === "project_manager" ? "PM" : (m.project_role || "Member");
                          const alloc = m.allocation_percentage ?? 100;
                          const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                          return (
                            <div key={m.id} className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{initials}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{name}</span>
                                  <span className="text-[10px] text-gray-400 ml-2 shrink-0">{alloc}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1">
                                    <div
                                      className={`h-1 rounded-full ${m.member_type === "project_manager" ? "bg-blue-500" : "bg-indigo-400"}`}
                                      style={{ width: `${alloc}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] text-gray-400 shrink-0 min-w-[36px] text-right">{role}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {members.length > 6 && (
                          <p className="text-xs text-gray-400 text-center pt-1">+{members.length - 6} more members</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Upcoming Deadlines */}
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Upcoming Deadlines</p>
                      <button
                        onClick={() => setActiveSection("tasks")}
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
                      >
                        View all <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    {upcomingTasks.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No tasks due in the next 14 days</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {upcomingTasks.map(t => {
                          const daysLeft = differenceInDays(new Date(t.due_date!), today);
                          return (
                            <div key={t.id} className="flex items-center gap-3">
                              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${daysLeft <= 2 ? "bg-red-500" : daysLeft <= 5 ? "bg-yellow-500" : "bg-green-500"}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</p>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${daysLeft <= 2 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : daysLeft <= 5 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                                {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: Project Modules */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Project Modules</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      {
                        id: "milestones", label: "Milestones", desc: "Track project milestones",
                        count: milestones.length, countLabel: "Total Milestones",
                        icon: Milestone, iconBg: "bg-purple-100 dark:bg-purple-900/40", iconColor: "text-purple-600 dark:text-purple-400", countColor: "text-purple-700 dark:text-purple-300",
                      },
                      {
                        id: "features", label: "Features", desc: "Manage project features",
                        count: features.length, countLabel: "Total Features",
                        icon: Layers, iconBg: "bg-blue-100 dark:bg-blue-900/40", iconColor: "text-blue-600 dark:text-blue-400", countColor: "text-blue-700 dark:text-blue-300",
                      },
                      {
                        id: "tasks", label: "Tasks", desc: "Manage project tasks",
                        count: projectTasks.length, countLabel: "Total Tasks",
                        icon: ListTodo, iconBg: "bg-indigo-100 dark:bg-indigo-900/40", iconColor: "text-indigo-600 dark:text-indigo-400", countColor: "text-indigo-700 dark:text-indigo-300",
                      },
                      {
                        id: "defects", label: "Defects", desc: "Track project defects",
                        count: projectDefects.length, countLabel: "Total Defects",
                        icon: Bug, iconBg: "bg-orange-100 dark:bg-orange-900/40", iconColor: "text-orange-600 dark:text-orange-400", countColor: "text-orange-700 dark:text-orange-300",
                      },
                      {
                        id: "members", label: "Team", desc: "Members & roles",
                        count: members.length, countLabel: "Members",
                        icon: Users, iconBg: "bg-teal-100 dark:bg-teal-900/40", iconColor: "text-teal-600 dark:text-teal-400", countColor: "text-teal-700 dark:text-teal-300",
                      },
                      {
                        id: "features", label: "Feature Groups", desc: "Feature modules",
                        count: featureGroups.length, countLabel: "Groups",
                        icon: Tag, iconBg: "bg-cyan-100 dark:bg-cyan-900/40", iconColor: "text-cyan-600 dark:text-cyan-400", countColor: "text-cyan-700 dark:text-cyan-300",
                      },
                      {
                        id: "milestones", label: "Active Milestones", desc: "Currently in progress",
                        count: milestones.filter(m => m.status === "in_progress").length, countLabel: "In Progress",
                        icon: Target, iconBg: "bg-green-100 dark:bg-green-900/40", iconColor: "text-green-600 dark:text-green-400", countColor: "text-green-700 dark:text-green-300",
                      },
                      {
                        id: "workspace", label: "Workspace", desc: "Project discussion & notes",
                        count: 0, countLabel: "Messages",
                        icon: MessageSquare, iconBg: "bg-pink-100 dark:bg-pink-900/40", iconColor: "text-pink-600 dark:text-pink-400", countColor: "text-pink-700 dark:text-pink-300",
                      },
                    ].map((mod, idx) => {
                      const Icon = mod.icon;
                      return (
                        <button
                          key={`${mod.id}-${idx}`}
                          onClick={() => setActiveSection(mod.id)}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-left hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all group"
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${mod.iconBg}`}>
                            <Icon className={`h-4.5 w-4.5 ${mod.iconColor}`} style={{ width: "18px", height: "18px" }} />
                          </div>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">{mod.label}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 mb-2 leading-snug">{mod.desc}</p>
                          <div className="flex items-end justify-between">
                            <div>
                              <span className={`text-2xl font-bold ${mod.countColor}`}>{mod.count}</span>
                              <p className="text-[9px] text-gray-400 leading-tight">{mod.countLabel}</p>
                            </div>
                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                              View <ArrowRight className="h-2.5 w-2.5" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════ MEMBERS ══════════════════ */}
            {activeSection === "members" && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Project Team</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
                      <History className="h-3.5 w-3.5 mr-1" /> {showHistory ? "Hide" : "Show"} History
                    </Button>
                    <Button size="sm" onClick={() => { setEditMember(null); setMemberForm({ user_id: "", contact_id: "", member_user_type: "internal", member_type: "member", project_role: "", allocation_percentage: 100 }); setMemberDialog(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
                    </Button>
                  </div>
                </div>

                {pm && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Project Manager</p>
                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardContent className="flex items-center gap-3 p-4">
                        {getMemberTypeLabel(pm) === "client_contact"
                          ? <Building2 className="h-10 w-10 text-orange-400 shrink-0" />
                          : <UserCircle className="h-10 w-10 text-blue-500 shrink-0" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{getMemberDisplayName(pm)}</p>
                            {getMemberTypeLabel(pm) === "client_contact"
                              ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"><Building2 className="h-2.5 w-2.5" />Client</span>
                              : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">Internal</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {pm.project_role && <Badge variant="outline" className="text-xs">{pm.project_role}</Badge>}
                            <span className="text-xs text-gray-400">{pm.allocation_percentage}% allocation</span>
                            {pm.joined_at && <span className="text-xs text-gray-400">Since {format(new Date(pm.joined_at), "MMM d, yyyy")}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditMember(pm)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => removeMemberMutation.mutate(pm.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {teamMembers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Team Members ({teamMembers.length})</p>
                    <div className="space-y-2">
                      {teamMembers.map((m) => (
                        <Card key={m.id}>
                          <CardContent className="flex items-center gap-3 p-3">
                            {getMemberTypeLabel(m) === "client_contact"
                              ? <Building2 className="h-8 w-8 text-orange-400 shrink-0" />
                              : <UserCircle className="h-8 w-8 text-gray-400 shrink-0" />}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{getMemberDisplayName(m)}</p>
                                {getMemberTypeLabel(m) === "client_contact"
                                  ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"><Building2 className="h-2.5 w-2.5" />Client</span>
                                  : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">Internal</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {m.project_role && <Badge variant="outline" className="text-xs">{m.project_role}</Badge>}
                                <span className="text-xs text-gray-400">{m.allocation_percentage}% allocation</span>
                                {m.joined_at && <span className="text-xs text-gray-400">Since {format(new Date(m.joined_at), "MMM d, yyyy")}</span>}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditMember(m)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => removeMemberMutation.mutate(m.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {members.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No members yet. Add a Project Manager first.</p>
                  </div>
                )}

                {showHistory && memberHistory.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Allocation History</p>
                    <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="text-left p-3 text-gray-500">Member</th>
                            <th className="text-left p-3 text-gray-500">Action</th>
                            <th className="text-left p-3 text-gray-500">Role</th>
                            <th className="text-left p-3 text-gray-500">Allocation</th>
                            <th className="text-left p-3 text-gray-500">Date</th>
                            <th className="text-left p-3 text-gray-500">By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberHistory.map((h: any) => {
                            const isContact = h.member_user_type === "client_contact" || (h.contact_id && !h.user_id);
                            const displayName = isContact
                              ? ((clientContacts as any[]).find((c: any) => c.id === h.contact_id)?.name ?? "Client Contact")
                              : getUserName(h.user_id);
                            return (
                              <tr key={h.id} className="border-t dark:border-gray-700">
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5">
                                    {isContact ? <Building2 className="h-3 w-3 text-orange-400 shrink-0" /> : null}
                                    <span>{displayName}</span>
                                    {isContact && <span className="text-[10px] px-1 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400">Client</span>}
                                  </div>
                                </td>
                                <td className="p-3"><Badge variant="outline" className="text-xs">{h.action.replace("_", " ")}</Badge></td>
                                <td className="p-3">{h.project_role ?? "-"}</td>
                                <td className="p-3">{h.allocation_percentage != null ? `${h.allocation_percentage}%` : "-"}</td>
                                <td className="p-3">{h.action_date ? format(new Date(h.action_date), "MMM d, yyyy") : "-"}</td>
                                <td className="p-3">{h.acted_by ? getUserName(h.acted_by) : "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ MILESTONES ══════════════════ */}
            {activeSection === "milestones" && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Milestones</h3>
                  <Button size="sm" onClick={() => { setEditMilestone(null); setMsForm({ name: "", description: "", start_date: "", end_date: "", status: "not_started", inherit_stages: true }); setMilestoneDialog(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Milestone
                  </Button>
                </div>
                {milestones.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Milestone className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No milestones yet. Every project needs milestones.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {milestones.map((ms) => (
                      <div key={ms.id} className="relative">
                        <div className="absolute top-4 right-4 flex gap-1 z-10">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
                            onClick={() => openEditMilestone(ms)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-60 hover:opacity-100 text-red-500"
                            onClick={() => deleteMilestoneMutation.mutate(ms.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <MilestonePanel
                          milestone={ms}
                          project={project}
                          templateId={project.template_id ?? null}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ FEATURES ══════════════════ */}
            {activeSection === "features" && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Feature Groups & Features</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditFeatureGroup(null); setFgForm({ name: "", description: "" }); setFeatureGroupDialog(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Group
                    </Button>
                    <Button size="sm" onClick={() => { setEditFeature(null); setFeatureForm({ name: "", description: "", feature_group_id: "", status: "not_started" }); setFeatureDialog(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Feature
                    </Button>
                  </div>
                </div>
                {featureGroups.length === 0 && features.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No features yet. Add feature groups (modules) and features to track scope.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {features.filter(f => !f.feature_group_id).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Ungrouped Features</p>
                        <div className="space-y-2">
                          {features.filter(f => !f.feature_group_id).map((f) => (
                            <FeatureRow key={f.id} feature={f} projectId={id!}
                              onEdit={() => { setEditFeature(f); setFeatureForm({ name: f.name, description: f.description ?? "", feature_group_id: f.feature_group_id ?? "", status: f.status }); setFeatureDialog(true); }}
                              onDelete={() => deleteFeatureMutation.mutate(f.id)}
                              onStatusChange={(status) => updateFeatureMutation.mutate({ fId: f.id, data: { status } })} />
                          ))}
                        </div>
                      </div>
                    )}
                    {featureGroups.map((fg) => (
                      <div key={fg.id} className="border rounded-lg dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50">
                          <Tag className="h-4 w-4 text-purple-500" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{fg.name}</span>
                              <Badge variant="outline" className="text-xs font-mono">{fg.tracking_number}</Badge>
                            </div>
                            {fg.description && <p className="text-xs text-gray-400">{fg.description}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => { setEditFeatureGroup(fg); setFgForm({ name: fg.name, description: fg.description ?? "" }); setFeatureGroupDialog(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                              onClick={() => deleteFGMutation.mutate(fg.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
                              onClick={() => { setEditFeature(null); setFeatureForm({ name: "", description: "", feature_group_id: fg.id, status: "not_started" }); setFeatureDialog(true); }}>
                              <Plus className="h-3 w-3 mr-1" /> Feature
                            </Button>
                          </div>
                        </div>
                        {features.filter(f => f.feature_group_id === fg.id).length > 0 ? (
                          <div className="p-3 space-y-2">
                            {features.filter(f => f.feature_group_id === fg.id).map((f) => (
                              <FeatureRow key={f.id} feature={f} projectId={id!}
                                onEdit={() => { setEditFeature(f); setFeatureForm({ name: f.name, description: f.description ?? "", feature_group_id: f.feature_group_id ?? "", status: f.status }); setFeatureDialog(true); }}
                                onDelete={() => deleteFeatureMutation.mutate(f.id)}
                                onStatusChange={(status) => updateFeatureMutation.mutate({ fId: f.id, data: { status } })} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 p-3">No features in this group yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ TASKS ══════════════════ */}
            {activeSection === "tasks" && (
              <div className="space-y-4 max-w-5xl">
                {/* Filter bar */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search tasks..."
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <Select value={taskMilestoneFilter} onValueChange={setTaskMilestoneFilter}>
                    <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Milestone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Milestones</SelectItem>
                      <SelectItem value="none">No Milestone</SelectItem>
                      {milestones.map((ms) => <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                    <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {taskStatuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
                    <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Assignee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.user_id ?? m.id} value={m.user_id ?? m.id}>
                          {getMemberDisplayName(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="ml-auto gap-1 h-9"
                    onClick={() => {
                      const el = document.querySelector("[data-create-task-trigger]") as HTMLButtonElement;
                      el?.click();
                    }}>
                    <Plus className="h-4 w-4" /> Add Task
                  </Button>
                </div>

                <CreateTaskSheet
                  trigger={<button data-create-task-trigger className="hidden" />}
                  defaultProjectId={id}
                  defaultProjectName={project.name}
                  onCreated={() => refetchTasks()}
                />

                {filteredProjectTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No tasks match your filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasksByMilestone.map(({ milestoneId, milestoneName, tasks }) => (
                      <div key={milestoneId ?? "unlinked"}>
                        <div className="flex items-center gap-2 mb-2">
                          <Milestone className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{milestoneName}</span>
                          <span className="text-xs text-gray-400">({tasks.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {tasks.map((task) => {
                            const statusObj = taskStatuses.find(s => s.id === task.status);
                            const assigneeName = task.assigned_to ? getUserName(task.assigned_to) : null;
                            const priorityInfo = task.priority ? PRIORITY_MAP[task.priority as number] : null;
                            return (
                              <div
                                key={task.id}
                                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer group transition-colors"
                                onClick={() => { setEditingTask(task); setEditTaskOpen(true); }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">{task.title}</span>
                                    {task.tracking_number && (
                                      <span className="text-xs font-mono text-gray-400 shrink-0">{task.tracking_number}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {statusObj && (
                                      <Badge className="text-[10px] border-0 h-4 px-1.5" style={{ backgroundColor: `${statusObj.color}20`, color: statusObj.color }}>
                                        {statusObj.name}
                                      </Badge>
                                    )}
                                    {priorityInfo && (
                                      <span className={`text-[10px] font-medium ${priorityInfo.color}`}>{priorityInfo.label}</span>
                                    )}
                                    {assigneeName && (
                                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                        <UserCircle className="h-3 w-3" />{assigneeName}
                                      </span>
                                    )}
                                    {task.due_date && (
                                      <span className={`text-[10px] flex items-center gap-0.5 ${new Date(task.due_date) < new Date() ? "text-red-500" : "text-gray-400"}`}>
                                        <Calendar className="h-3 w-3" />{format(new Date(task.due_date), "d MMM")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Pencil className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ DEFECTS ══════════════════ */}
            {activeSection === "defects" && (
              <div className="max-w-5xl">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search defects…"
                      value={defectSearch}
                      onChange={(e) => setDefectSearch(e.target.value)}
                      className="pl-8 pr-3 h-9 w-full rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <select
                    value={defectSeverityFilter}
                    onChange={(e) => setDefectSeverityFilter(e.target.value)}
                    className="h-9 text-sm border border-input bg-background rounded-md px-2"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={defectStatusFilter}
                    onChange={(e) => setDefectStatusFilter(e.target.value)}
                    className="h-9 text-sm border border-input bg-background rounded-md px-2"
                  >
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="verified">Verified</option>
                    <option value="closed">Closed</option>
                    <option value="reopened">Reopened</option>
                  </select>
                  <Button size="sm" className="ml-auto gap-1" onClick={() => setCreateDefectOpen(true)}>
                    <Plus className="h-4 w-4" /> Report Defect
                  </Button>
                </div>

                {filteredDefects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                    <Bug className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No defects found</p>
                    <p className="text-sm">Click "Report Defect" to log the first one for this project.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-[110px]">#</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Title</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-[100px]">Severity</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-[110px]">Status</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-[130px]">Assignee</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-[80px]">Tasks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredDefects.map((defect: any) => {
                          const sevColors: Record<string, string> = {
                            critical: "bg-red-100 text-red-700 border-red-200",
                            high:     "bg-orange-100 text-orange-700 border-orange-200",
                            medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
                            low:      "bg-blue-100 text-blue-700 border-blue-200",
                            trivial:  "bg-gray-100 text-gray-600 border-gray-200",
                          };
                          const statusColors: Record<string, string> = {
                            draft:       "bg-gray-100 text-gray-600",
                            submitted:   "bg-blue-100 text-blue-700",
                            approved:    "bg-emerald-100 text-emerald-700",
                            rejected:    "bg-red-100 text-red-700",
                            in_progress: "bg-purple-100 text-purple-700",
                            resolved:    "bg-teal-100 text-teal-700",
                            verified:    "bg-emerald-100 text-emerald-700",
                            closed:      "bg-gray-200 text-gray-600",
                            reopened:    "bg-red-100 text-red-700",
                          };
                          const assignee = (users as User[]).find((u) => u.id === defect.assigned_to);
                          return (
                            <tr
                              key={defect.id}
                              className="hover:bg-muted/30 cursor-pointer transition-colors"
                              onClick={() => setSelectedDefect(defect)}
                            >
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{defect.defect_number ?? "—"}</td>
                              <td className="px-4 py-3 font-medium max-w-[280px] truncate">{defect.title}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${sevColors[defect.severity] ?? "bg-gray-100 text-gray-600"}`}>
                                  {defect.severity}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[defect.status] ?? "bg-gray-100 text-gray-600"}`}>
                                  {defect.status.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {assignee ? (assignee.user_name || assignee.email) : "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{defect.linked_task_count ?? 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════ WORKSPACE ══════════════════ */}
            {activeSection === "workspace" && (
              <div className="max-w-4xl">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <WorkspaceTab entityType="project" entityId={project.id} />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Sheets & Dialogs (outside layout) ─────────────────────────────────── */}

      <CreateDefectSheet
        open={createDefectOpen}
        onOpenChange={(v) => {
          setCreateDefectOpen(v);
          if (!v) queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "defects"] });
        }}
        defaultProjectId={id}
        defaultProjectName={(project as any)?.name}
      />

      {selectedDefect && (
        <DefectDetailsSheet
          defect={selectedDefect}
          open={!!selectedDefect}
          onOpenChange={(v) => {
            if (!v) {
              setSelectedDefect(null);
              queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "defects"] });
              queryClient.invalidateQueries({ queryKey: ["/api/defect-task-ids"] });
            }
          }}
        />
      )}

      <EditTaskSheet
        task={editingTask}
        open={editTaskOpen}
        onOpenChange={(v) => {
          setEditTaskOpen(v);
          if (!v) setEditingTask(null);
        }}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "tasks"] });
        }}
      />

      {/* Confirm dialog */}
      <AlertDialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Once confirmed, the project status will change to <strong>Active</strong> and the template cannot be changed.
              Ensure all details are correct before confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmMutation.mutate()} className="bg-green-600 hover:bg-green-700">
              Confirm Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete project dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will <strong>permanently delete</strong> the project <strong>&ldquo;{project?.name}&rdquo;</strong> and all of its associated data:
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
            <AlertDialogCancel disabled={deleteProjectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteProjectMutation.isPending}
              onClick={(e) => { e.preventDefault(); deleteProjectMutation.mutate(); }}
            >
              {deleteProjectMutation.isPending ? "Deleting…" : "Yes, Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Member Dialog */}
      <Dialog open={memberDialog} onOpenChange={(v) => { setMemberDialog(v); if (!v) setEditMember(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? "Edit Member" : "Add Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editMember && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Member Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "internal", label: "Internal User", icon: UserCircle, desc: "Team staff member" },
                    { value: "client_contact", label: "Client Contact", icon: Building2, desc: "External client stakeholder", disabled: (clientContacts as any[]).length === 0 },
                  ].map(({ value, label, icon: Icon, desc, disabled }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setMemberForm(p => ({ ...p, member_user_type: value, user_id: "", contact_id: "", member_type: value === "client_contact" ? "member" : p.member_type }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${disabled ? "opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700" : memberForm.member_user_type === value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                    >
                      <Icon className={`h-4 w-4 mb-1 ${memberForm.member_user_type === value ? "text-blue-600" : "text-gray-400"}`} />
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{disabled ? "No contacts on this client" : desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!editMember && memberForm.member_user_type === "internal" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">User *</Label>
                <Select value={memberForm.user_id || "none"} onValueChange={(v) => setMemberForm(p => ({ ...p, user_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select user...</SelectItem>
                    {users.filter(u => !members.find(m => m.user_id === u.id)).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.user_name ?? u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editMember && memberForm.member_user_type === "client_contact" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Client Contact *</Label>
                <Select value={memberForm.contact_id || "none"} onValueChange={(v) => setMemberForm(p => ({ ...p, contact_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a contact" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select contact...</SelectItem>
                    {(clientContacts as any[])
                      .filter((c: any) => !(members as any[]).find(m => m.contact_id === c.id))
                      .map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-orange-400" />
                            {c.name}
                            {c.job_title && <span className="text-xs text-gray-400">({c.job_title})</span>}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editMember && (
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                {getMemberTypeLabel(editMember) === "client_contact"
                  ? <Building2 className="h-4 w-4 text-orange-400 shrink-0" />
                  : <UserCircle className="h-4 w-4 text-blue-500 shrink-0" />}
                <span className="font-medium">{getMemberDisplayName(editMember)}</span>
                {getMemberTypeLabel(editMember) === "client_contact"
                  ? <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Client Contact</span>
                  : <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Internal</span>}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Role in Project *</Label>
              <Select
                value={memberForm.member_type}
                onValueChange={(v) => setMemberForm(p => ({ ...p, member_type: v }))}
                disabled={memberForm.member_user_type === "client_contact"}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_manager">Project Manager</SelectItem>
                  <SelectItem value="member">Team Member</SelectItem>
                </SelectContent>
              </Select>
              {memberForm.member_user_type === "client_contact" && (
                <p className="text-[10px] text-gray-400">Client contacts are added as Team Members only.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Project-Specific Title</Label>
              <Input placeholder="e.g. Project Sponsor, Reviewer..." value={memberForm.project_role}
                onChange={(e) => setMemberForm(p => ({ ...p, project_role: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Allocation % (0–100)</Label>
              <Input type="number" min={0} max={100} value={memberForm.allocation_percentage}
                onChange={(e) => setMemberForm(p => ({ ...p, allocation_percentage: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMemberDialog(false); setEditMember(null); }}>Cancel</Button>
            <Button onClick={() => {
              if (!editMember) {
                if (memberForm.member_user_type === "internal" && !memberForm.user_id) { toast({ title: "Select a user", variant: "destructive" }); return; }
                if (memberForm.member_user_type === "client_contact" && !memberForm.contact_id) { toast({ title: "Select a client contact", variant: "destructive" }); return; }
                addMemberMutation.mutate({
                  user_id: memberForm.member_user_type === "internal" ? memberForm.user_id : null,
                  contact_id: memberForm.member_user_type === "client_contact" ? memberForm.contact_id : null,
                  member_user_type: memberForm.member_user_type,
                  member_type: memberForm.member_type,
                  project_role: memberForm.project_role || null,
                  allocation_percentage: memberForm.allocation_percentage,
                } as any);
              } else {
                updateMemberMutation.mutate({ memberId: editMember.id, data: { member_type: memberForm.member_type, project_role: memberForm.project_role || null, allocation_percentage: memberForm.allocation_percentage } });
              }
            }}>
              {editMember ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Milestone Dialog */}
      <Dialog open={milestoneDialog} onOpenChange={(v) => { setMilestoneDialog(v); if (!v) setEditMilestone(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMilestone ? "Edit Milestone" : "Add Milestone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Milestone Name *</Label>
              <Input value={msForm.name} onChange={(e) => setMsForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={msForm.description} onChange={(e) => setMsForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={msForm.start_date} onChange={(e) => setMsForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={msForm.end_date} onChange={(e) => setMsForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={msForm.status} onValueChange={(v) => setMsForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editMilestone && project.template_id && (
              <div className="flex items-center gap-2 text-sm">
                <input type="checkbox" id="inherit" checked={msForm.inherit_stages}
                  onChange={(e) => setMsForm(p => ({ ...p, inherit_stages: e.target.checked }))}
                  className="rounded" />
                <label htmlFor="inherit" className="text-gray-600 dark:text-gray-400">
                  Inherit stages from project template
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMilestoneDialog(false); setEditMilestone(null); }}>Cancel</Button>
            <Button onClick={() => {
              if (!msForm.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
              const payload = {
                name: msForm.name,
                description: msForm.description || null,
                start_date: msForm.start_date || null,
                end_date: msForm.end_date || null,
                status: msForm.status,
                inherit_stages: msForm.inherit_stages,
              };
              if (editMilestone) {
                updateMilestoneMutation.mutate({ msId: editMilestone.id, data: payload });
              } else {
                createMilestoneMutation.mutate(payload);
              }
            }}>
              {editMilestone ? "Save Changes" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Group Dialog */}
      <Dialog open={featureGroupDialog} onOpenChange={(v) => { setFeatureGroupDialog(v); if (!v) setEditFeatureGroup(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editFeatureGroup ? "Edit Feature Group" : "Add Feature Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Group Name (Module) *</Label>
              <Input value={fgForm.name} onChange={(e) => setFgForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={fgForm.description} onChange={(e) => setFgForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFeatureGroupDialog(false); setEditFeatureGroup(null); }}>Cancel</Button>
            <Button onClick={() => {
              if (!fgForm.name.trim()) return;
              if (editFeatureGroup) {
                updateFGMutation.mutate({ fgId: editFeatureGroup.id, data: fgForm });
              } else {
                createFGMutation.mutate(fgForm);
              }
            }}>
              {editFeatureGroup ? "Save" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Dialog */}
      <Dialog open={featureDialog} onOpenChange={(v) => { setFeatureDialog(v); if (!v) setEditFeature(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editFeature ? "Edit Feature" : "Add Feature"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Feature Name *</Label>
              <Input value={featureForm.name} onChange={(e) => setFeatureForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Feature Group</Label>
              <Select value={featureForm.feature_group_id || "none"} onValueChange={(v) => setFeatureForm(p => ({ ...p, feature_group_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="No group (ungrouped)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {featureGroups.map(fg => (
                    <SelectItem key={fg.id} value={fg.id}>{fg.name} ({fg.tracking_number})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={featureForm.status} onValueChange={(v) => setFeatureForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={featureForm.description} onChange={(e) => setFeatureForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFeatureDialog(false); setEditFeature(null); }}>Cancel</Button>
            <Button onClick={() => {
              if (!featureForm.name.trim()) return;
              const payload = {
                name: featureForm.name,
                description: featureForm.description || null,
                feature_group_id: featureForm.feature_group_id || null,
                status: featureForm.status,
              };
              if (editFeature) {
                updateFeatureMutation.mutate({ fId: editFeature.id, data: payload });
              } else {
                createFeatureMutation.mutate(payload);
              }
            }}>
              {editFeature ? "Save" : "Add Feature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================
// FEATURE ROW COMPONENT
// =============================
function FeatureRow({ feature, projectId, onEdit, onDelete, onStatusChange }: {
  feature: ProjectFeature;
  projectId: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <span className="font-mono text-xs text-gray-400 min-w-[60px]">{feature.tracking_number}</span>
      <span className="flex-1 text-sm">{feature.name}</span>
      {feature.description && <span className="text-xs text-gray-400 hidden md:block">{feature.description}</span>}
      <Select value={feature.status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-28 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="not_started">Not Started</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
