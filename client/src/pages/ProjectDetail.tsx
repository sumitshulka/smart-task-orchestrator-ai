import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiClient } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CreateTaskSheet from "@/components/CreateTaskSheet";
import EditTaskSheet from "@/components/EditTaskSheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CheckCircle2, Users, Milestone, Layers, Plus, Pencil, Trash2,
  Calendar, Clock, DollarSign, History, UserCircle, Tag, Grip, ChevronDown, ChevronUp,
  Search, ListTodo, ExternalLink, Flag,
} from "lucide-react";
import { format } from "date-fns";
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
    enabled: expanded,
  });

  const { data: templateStages = [] } = useQuery<ProjectTemplateStage[]>({
    queryKey: ["/api/project-templates", templateId, "stages"],
    enabled: !!templateId && expanded,
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
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`/milestones/${milestone.id}/stages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones", milestone.id, "stages"] });
      toast({ title: "Stage updated" });
      setStageDialog(false);
      setEditStage(null);
    },
  });

  const deleteStage = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/milestones/${milestone.id}/stages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones", milestone.id, "stages"] });
      toast({ title: "Stage removed" });
    },
  });

  const inheritStages = useMutation({
    mutationFn: () =>
      apiClient.post(`/milestones/${milestone.id}/stages/inherit/${templateId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones", milestone.id, "stages"] });
      toast({ title: "Template stages inherited" });
    },
  });

  const updateMilestoneStatus = useMutation({
    mutationFn: (status: string) =>
      apiClient.put(`/projects/${project.id}/milestones/${milestone.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "milestones"] });
    },
  });

  const openEditStage = (s: MilestoneStage) => {
    setEditStage(s);
    setStageForm({ name: s.name, description: s.description ?? "", color: s.color ?? "#6b7280", status: s.status });
    setStageDialog(true);
  };

  const handleSubmitStage = () => {
    if (!stageForm.name.trim()) return;
    if (editStage) {
      updateStage.mutate({ id: editStage.id, data: stageForm });
    } else {
      createStage.mutate(stageForm);
    }
  };

  return (
    <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
      {/* Milestone header */}
      <div
        className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{milestone.name}</span>
            <Badge className={`text-xs border-0 ${MILESTONE_STATUS_COLORS[milestone.status]}`}>
              {milestone.status.replace("_", " ")}
            </Badge>
          </div>
          {milestone.description && (
            <p className="text-xs text-gray-500 mt-0.5">{milestone.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            {milestone.start_date && (
              <span>{format(new Date(milestone.start_date), "MMM d, yyyy")} →</span>
            )}
            {milestone.end_date && (
              <span>{format(new Date(milestone.end_date), "MMM d, yyyy")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={milestone.status}
            onValueChange={(v) => { updateMilestoneStatus.mutate(v); }}
          >
            <SelectTrigger className="w-32 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
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

  // State for dialogs
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [editMember, setEditMember] = useState<ProjectMember | null>(null);
  const [memberForm, setMemberForm] = useState({ user_id: "", member_type: "member", project_role: "", allocation_percentage: 100 });
  const [milestoneDialog, setMilestoneDialog] = useState(false);
  const [editMilestone, setEditMilestone] = useState<ProjectMilestone | null>(null);
  const [msForm, setMsForm] = useState({ name: "", description: "", start_date: "", end_date: "", status: "not_started", inherit_stages: true });
  const [featureGroupDialog, setFeatureGroupDialog] = useState(false);
  const [editFeatureGroup, setEditFeatureGroup] = useState<ProjectFeatureGroup | null>(null);
  const [fgForm, setFgForm] = useState({ name: "", description: "" });
  const [featureDialog, setFeatureDialog] = useState(false);
  const [editFeature, setEditFeature] = useState<ProjectFeature | null>(null);
  const [featureForm, setFeatureForm] = useState({ name: "", description: "", feature_group_id: "", status: "not_started" });
  const [showHistory, setShowHistory] = useState(false);

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

  const addMemberMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post(`/projects/${id}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members", "history"] });
      toast({ title: editMember ? "Member updated" : "Member added" });
      setMemberDialog(false);
      setEditMember(null);
      setMemberForm({ user_id: "", member_type: "member", project_role: "", allocation_percentage: 100 });
    },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: Record<string, unknown> }) =>
      apiClient.put(`/projects/${id}/members/${memberId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "members", "history"] });
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

  const getTemplateName = () => {
    if (!project?.template_id) return null;
    return templates.find(t => t.id === project.template_id)?.name ?? null;
  };

  const pm = members.find(m => m.member_type === "project_manager");
  const teamMembers = members.filter(m => m.member_type === "member");

  const openEditMember = (m: ProjectMember) => {
    setEditMember(m);
    setMemberForm({
      user_id: m.user_id,
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

  return (
    <div className="p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="mt-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Projects
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
            <Badge className={`text-sm border-0 ${STATUS_COLORS[project.status]}`}>
              {project.status.replace("_", " ")}
            </Badge>
            {project.is_confirmed && (
              <Badge className="text-sm border-0 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmed
              </Badge>
            )}
          </div>
          {project.client_name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.client_name}</p>
          )}
        </div>
        {!project.is_confirmed && (
          <Button onClick={() => setConfirmDialog(true)} className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm Project
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-3.5 w-3.5 mr-1" />Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="milestones">
            <Milestone className="h-3.5 w-3.5 mr-1" />Milestones ({milestones.length})
          </TabsTrigger>
          <TabsTrigger value="features">
            <Layers className="h-3.5 w-3.5 mr-1" />Features ({features.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="h-3.5 w-3.5 mr-1" />Tasks ({projectTasks.length})
          </TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span>{PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}</span>
                </div>
                {getTemplateName() && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Template</span>
                    <span>{getTemplateName()}</span>
                  </div>
                )}
                {project.start_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Start Date</span>
                    <span>{format(new Date(project.start_date), "MMM d, yyyy")}</span>
                  </div>
                )}
                {project.projected_end_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Projected End</span>
                    <span>{format(new Date(project.projected_end_date), "MMM d, yyyy")}</span>
                  </div>
                )}
                {project.total_effort_hours && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Effort</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{project.total_effort_hours}h</span>
                  </div>
                )}
                {project.budget_amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Budget</span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />{project.currency} {project.budget_amount}
                    </span>
                  </div>
                )}
                {project.description && (
                  <div className="pt-2 border-t dark:border-gray-700">
                    <p className="text-gray-500 text-xs mb-1">Description</p>
                    <p className="text-sm">{project.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Team Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pm ? (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <UserCircle className="h-8 w-8 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{getUserName(pm.user_id)}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">Project Manager {pm.allocation_percentage}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No Project Manager assigned</p>
                )}
                {teamMembers.length > 0 && (
                  <div className="space-y-2">
                    {teamMembers.slice(0, 4).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <span>{getUserName(m.user_id)}</span>
                        <div className="flex items-center gap-2">
                          {m.project_role && <Badge variant="outline" className="text-xs">{m.project_role}</Badge>}
                          <span className="text-xs text-gray-400">{m.allocation_percentage}%</span>
                        </div>
                      </div>
                    ))}
                    {teamMembers.length > 4 && (
                      <p className="text-xs text-gray-400">+{teamMembers.length - 4} more members</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-blue-600">{milestones.length}</p>
                <p className="text-xs text-gray-500">Milestones</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-purple-600">{featureGroups.length}</p>
                <p className="text-xs text-gray-500">Feature Groups</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-green-600">{features.length}</p>
                <p className="text-xs text-gray-500">Features</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== MEMBERS TAB ===== */}
        <TabsContent value="members" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Project Team</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
                <History className="h-3.5 w-3.5 mr-1" /> {showHistory ? "Hide" : "Show"} History
              </Button>
              <Button size="sm" onClick={() => { setEditMember(null); setMemberForm({ user_id: "", member_type: "member", project_role: "", allocation_percentage: 100 }); setMemberDialog(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
              </Button>
            </div>
          </div>

          {/* PM first */}
          {pm && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Project Manager</p>
              <Card className="border-blue-200 dark:border-blue-800">
                <CardContent className="flex items-center gap-3 p-4">
                  <UserCircle className="h-10 w-10 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium">{getUserName(pm.user_id)}</p>
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

          {/* Team members */}
          {teamMembers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Team Members ({teamMembers.length})</p>
              <div className="space-y-2">
                {teamMembers.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <UserCircle className="h-8 w-8 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getUserName(m.user_id)}</p>
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

          {/* History */}
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
                    {memberHistory.map((h) => (
                      <tr key={h.id} className="border-t dark:border-gray-700">
                        <td className="p-3">{getUserName(h.user_id)}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{h.action.replace("_", " ")}</Badge></td>
                        <td className="p-3">{h.project_role ?? "-"}</td>
                        <td className="p-3">{h.allocation_percentage != null ? `${h.allocation_percentage}%` : "-"}</td>
                        <td className="p-3">{h.action_date ? format(new Date(h.action_date), "MMM d, yyyy") : "-"}</td>
                        <td className="p-3">{h.acted_by ? getUserName(h.acted_by) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== MILESTONES TAB ===== */}
        <TabsContent value="milestones" className="mt-4 space-y-4">
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
        </TabsContent>

        {/* ===== FEATURES TAB ===== */}
        <TabsContent value="features" className="mt-4 space-y-4">
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
              {/* Ungrouped features */}
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

              {/* Feature Groups */}
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
        </TabsContent>

        {/* ===== TASKS TAB ===== */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {/* Milestone filter */}
            <Select value={taskMilestoneFilter} onValueChange={setTaskMilestoneFilter}>
              <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="All Milestones" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Milestones</SelectItem>
                <SelectItem value="none">No Milestone</SelectItem>
                {milestones.map((ms) => (
                  <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Status filter */}
            <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {taskStatuses.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Assignee filter */}
            <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
              <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="All Assignees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{getUserName(m.user_id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Clear filters */}
            {(taskSearch || taskMilestoneFilter !== "all" || taskStatusFilter !== "all" || taskAssigneeFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-gray-400" onClick={() => {
                setTaskSearch(""); setTaskMilestoneFilter("all"); setTaskStatusFilter("all"); setTaskAssigneeFilter("all");
              }}>Clear filters</Button>
            )}
            <CreateTaskSheet
              defaultProjectId={id}
              onTaskCreated={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "tasks"] });
              }}
            >
              <Button size="sm" className="h-9 text-xs ml-auto gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Task
              </Button>
            </CreateTaskSheet>
          </div>

          {/* Tasks grouped by milestone */}
          {filteredProjectTasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {projectTasks.length === 0
                  ? "No tasks linked to this project yet. Click \"New Task\" to create one."
                  : "No tasks match the current filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasksByMilestone.map(({ milestoneId, milestoneName, tasks: groupTasks }) => {
                const doneTasks = groupTasks.filter((t) => t.status.toLowerCase().includes("complet")).length;
                return (
                  <div key={milestoneId ?? "none"} className="border rounded-lg overflow-hidden">
                    {/* Milestone group header */}
                    <div className={`px-4 py-2.5 flex items-center justify-between text-sm font-medium ${
                      milestoneId
                        ? "bg-blue-50 text-blue-800 border-b border-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900"
                        : "bg-gray-50 text-gray-600 border-b border-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                    }`}>
                      <div className="flex items-center gap-2">
                        {milestoneId ? (
                          <Milestone className="h-3.5 w-3.5" />
                        ) : (
                          <Tag className="h-3.5 w-3.5" />
                        )}
                        <span>{milestoneName}</span>
                        <span className="font-normal text-xs opacity-70">
                          {doneTasks}/{groupTasks.length} done
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${groupTasks.length > 0 ? Math.round((doneTasks / groupTasks.length) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs opacity-70">
                          {groupTasks.length > 0 ? Math.round((doneTasks / groupTasks.length) * 100) : 0}%
                        </span>
                      </div>
                    </div>

                    {/* Task rows */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {groupTasks.map((task) => {
                        const statusObj = taskStatuses.find((s) => s.name === task.status);
                        const priorityInfo = task.priority ? PRIORITY_MAP[task.priority] : null;
                        const featureName = features.find((f) => f.id === task.feature_id)?.name;
                        return (
                          <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm">
                            {/* Task number */}
                            <span className="text-xs text-gray-400 font-mono shrink-0 w-14">
                              #{task.task_number}
                            </span>

                            {/* Status dot */}
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30 shadow-sm"
                              style={{ backgroundColor: statusObj?.color ?? "#9ca3af" }}
                              title={task.status}
                            />

                            {/* Title */}
                            <span className="flex-1 font-medium text-gray-800 dark:text-gray-200 truncate">
                              {task.title}
                            </span>

                            {/* Feature tag */}
                            {featureName && (
                              <Badge variant="outline" className="text-xs shrink-0 gap-1 hidden md:flex">
                                <Layers className="h-2.5 w-2.5" />{featureName}
                              </Badge>
                            )}

                            {/* Status badge */}
                            <Badge
                              className="text-xs shrink-0 border-0"
                              style={{
                                backgroundColor: statusObj?.color ? `${statusObj.color}22` : undefined,
                                color: statusObj?.color ?? undefined,
                              }}
                            >
                              {task.status}
                            </Badge>

                            {/* Priority */}
                            {priorityInfo && (
                              <span className={`text-xs shrink-0 hidden sm:flex items-center gap-1 ${priorityInfo.color}`}>
                                <Flag className="h-3 w-3" />{priorityInfo.label}
                              </span>
                            )}

                            {/* Assignee */}
                            <span className="text-xs text-gray-400 shrink-0 hidden lg:block w-24 truncate">
                              {task.assigned_to ? getUserName(task.assigned_to) : "Unassigned"}
                            </span>

                            {/* Due date */}
                            {task.due_date && (
                              <span className="text-xs text-gray-400 shrink-0 hidden sm:flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(task.due_date), "d MMM")}
                              </span>
                            )}

                            {/* Edit task */}
                            <button
                              title="Edit task"
                              className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
                              onClick={() => { setEditingTask(task); setEditTaskOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {/* Open task link — navigate to tasks page */}
                            <Link
                              to="/tasks"
                              title="Open in Tasks"
                              className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== EDIT TASK SHEET ===== */}
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

      {/* ===== CONFIRM DIALOG ===== */}
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

      {/* ===== ADD/EDIT MEMBER DIALOG ===== */}
      <Dialog open={memberDialog} onOpenChange={(v) => { setMemberDialog(v); if (!v) setEditMember(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? "Edit Member" : "Add Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editMember && (
              <div className="space-y-1">
                <Label>User *</Label>
                <Select value={memberForm.user_id || "none"} onValueChange={(v) => setMemberForm(p => ({ ...p, user_id: v === "none" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select user...</SelectItem>
                    {users.filter(u => !members.find(m => m.user_id === u.id)).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.user_name ?? u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editMember && (
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                <span className="text-gray-500">Member: </span>
                <span className="font-medium">{getUserName(editMember.user_id)}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label>Role in Project *</Label>
              <Select value={memberForm.member_type} onValueChange={(v) => setMemberForm(p => ({ ...p, member_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_manager">Project Manager</SelectItem>
                  <SelectItem value="member">Team Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Project-Specific Title</Label>
              <Input placeholder="e.g. Lead Developer, UI Designer..." value={memberForm.project_role}
                onChange={(e) => setMemberForm(p => ({ ...p, project_role: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Allocation % (0–100)</Label>
              <Input type="number" min={0} max={100} value={memberForm.allocation_percentage}
                onChange={(e) => setMemberForm(p => ({ ...p, allocation_percentage: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMemberDialog(false); setEditMember(null); }}>Cancel</Button>
            <Button onClick={() => {
              if (!memberForm.user_id && !editMember) { toast({ title: "Select a user", variant: "destructive" }); return; }
              if (editMember) {
                updateMemberMutation.mutate({ memberId: editMember.id, data: { member_type: memberForm.member_type, project_role: memberForm.project_role || null, allocation_percentage: memberForm.allocation_percentage } });
              } else {
                addMemberMutation.mutate({ user_id: memberForm.user_id, member_type: memberForm.member_type, project_role: memberForm.project_role || null, allocation_percentage: memberForm.allocation_percentage });
              }
            }}>
              {editMember ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MILESTONE DIALOG ===== */}
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

      {/* ===== FEATURE GROUP DIALOG ===== */}
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

      {/* ===== FEATURE DIALOG ===== */}
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
    </div>
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
