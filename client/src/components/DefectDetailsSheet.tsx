
import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";
import { format } from "date-fns";
import {
  Send, Pencil, X, Check, ThumbsUp, ThumbsDown, ArrowUpCircle,
  ListTodo, Unlink, Zap, Link2, Search,
} from "lucide-react";

interface Props {
  defect: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId?: string;
  isAdmin?: boolean;
  isManager?: boolean;
  onUpdated?: (d: any) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300",
  high:     "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300",
  low:      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  draft:       "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  submitted:   "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
  approved:    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected:    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300",
  resolved:    "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300",
  verified:    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed:      "bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300",
  reopened:    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  in_progress: ["resolved"],
  resolved:    ["verified", "reopened"],
  verified:    ["closed"],
  closed:      ["reopened"],
  reopened:    ["in_progress"],
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "Mark In Progress",
  resolved:    "Mark Resolved",
  verified:    "Mark Verified",
  closed:      "Close Defect",
  reopened:    "Reopen",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed:   "bg-green-100 text-green-700",
  blocked:     "bg-red-100 text-red-700",
};

function formatDefectNumber(n: number) {
  return `DEF-${String(n).padStart(5, "0")}`;
}

export default function DefectDetailsSheet({
  defect,
  open,
  onOpenChange,
  currentUserId: currentUserIdProp,
  isAdmin: isAdminProp,
  isManager: isManagerProp,
  onUpdated,
}: Props) {
  const queryClient = useQueryClient();
  const { users } = useUsersAndTeams();

  // Derive role internally so callers that don't pass props still work
  const { roles: currentRoles, user: currentUser } = useCurrentUserRoleAndTeams();
  const currentUserId = currentUserIdProp ?? currentUser?.id ?? "";
  const isAdmin   = isAdminProp   ?? currentRoles.includes("admin");
  const isManager = isManagerProp ?? currentRoles.some(r => r === "manager" || r === "team manager");

  const isPrivileged = isAdmin || isManager;
  const isReporter = defect.reported_by === currentUserId;
  const canEdit = isPrivileged || isReporter;
  const canChangeStatus = isPrivileged || defect.assigned_to === currentUserId;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [newComment, setNewComment] = useState("");
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [convertDialog, setConvertDialog] = useState(false);
  const [convertForm, setConvertForm] = useState({
    title: "",
    assigned_to: "",
    start_date: "",
    due_date: "",
    estimated_hours: "",
    status: "",
  });
  const [linkTaskDialog, setLinkTaskDialog] = useState(false);
  const [linkTaskSearch, setLinkTaskSearch] = useState("");

  // Fetch linked tasks
  const { data: linkedTasks = [], refetch: refetchLinkedTasks } = useQuery<any[]>({
    queryKey: ["/api/defects", defect.id, "tasks"],
    queryFn: () => apiClient.get(`/defects/${defect.id}/tasks`),
    enabled: open,
  });

  // Fetch all tasks for link-task picker
  const { data: allTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => apiClient.get("/tasks"),
    enabled: linkTaskDialog,
  });

  // Fetch task statuses for convert dialog
  const { data: taskStatuses = [] } = useQuery<any[]>({
    queryKey: ["/api/task-statuses"],
    enabled: convertDialog,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["/api/defects", defect.id, "comments"],
    queryFn: () => apiClient.get(`/defects/${defect.id}/comments`),
    enabled: open,
  });

  const { data: activity = [] } = useQuery<any[]>({
    queryKey: ["/api/defects", defect.id, "activity"],
    queryFn: () => apiClient.get(`/defects/${defect.id}/activity`),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/defects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/defects", defect.id, "activity"] });
  };

  const updateMutation = useMutation({
    mutationFn: (updates: any) => apiClient.patch(`/defects/${defect.id}`, updates),
    onSuccess: (updated) => {
      if (onUpdated) onUpdated(updated);
      invalidate();
      toast({ title: "Defect updated" });
      setIsEditing(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update defect.", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: () => apiClient.post(`/defects/${defect.id}/submit`, {}),
    onSuccess: (updated) => {
      if (onUpdated) onUpdated(updated);
      invalidate();
      toast({ title: "Submitted for approval", description: "A manager will review your defect." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to submit.", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: () => apiClient.post(`/defects/${defect.id}/approve`, {}),
    onSuccess: (updated) => {
      if (onUpdated) onUpdated(updated);
      invalidate();
      toast({ title: "Defect approved", description: "It can now be converted to a task." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to approve.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => apiClient.post(`/defects/${defect.id}/reject`, { reason }),
    onSuccess: (updated) => {
      if (onUpdated) onUpdated(updated);
      invalidate();
      toast({ title: "Defect rejected" });
      setRejectDialog(false);
      setRejectReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to reject.", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: (data: any) => apiClient.post(`/defects/${defect.id}/convert-to-task`, data),
    onSuccess: (result: any) => {
      if (onUpdated) onUpdated(result.defect);
      invalidate();
      refetchLinkedTasks();
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task created", description: "Defect is now in tracking mode." });
      setConvertDialog(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to convert.", variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.delete(`/defects/${defect.id}/tasks/${taskId}`),
    onSuccess: () => {
      refetchLinkedTasks();
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/defect-task-ids"] });
      toast({ title: "Task unlinked" });
    },
    onError: () => toast({ title: "Error", description: "Failed to unlink task.", variant: "destructive" }),
  });

  const linkTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(`/defects/${defect.id}/tasks`, { task_id: taskId }),
    onSuccess: () => {
      refetchLinkedTasks();
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/defect-task-ids"] });
      toast({ title: "Task linked" });
      setLinkTaskDialog(false);
      setLinkTaskSearch("");
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to link task.", variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient.post(`/defects/${defect.id}/comments`, { content, commented_by: currentUserId }),
    onSuccess: () => { setNewComment(""); refetchComments(); },
    onError: () => toast({ title: "Error", description: "Failed to post comment.", variant: "destructive" }),
  });

  const getUserName = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((u: any) => u.id === id);
    return u ? u.user_name || u.email : "—";
  };

  const startEdit = () => {
    setEditForm({
      title:              defect.title,
      description:        defect.description || "",
      steps_to_reproduce: defect.steps_to_reproduce || "",
      expected_behavior:  defect.expected_behavior || "",
      actual_behavior:    defect.actual_behavior || "",
      severity:           defect.severity,
      priority:           defect.priority,
      type:               defect.type,
      environment:        defect.environment,
      assigned_to:        defect.assigned_to || "none",
      resolution:         defect.resolution || "",
      due_date:           defect.due_date ? defect.due_date.split("T")[0] : "",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      ...editForm,
      assigned_to: editForm.assigned_to === "none" ? null : editForm.assigned_to,
      due_date: editForm.due_date || null,
    });
  };

  const openConvertDialog = () => {
    setConvertForm({
      title: `[Defect Fix] ${defect.title}`,
      assigned_to: defect.assigned_to || "",
      start_date: "",
      due_date: defect.due_date ? defect.due_date.split("T")[0] : "",
      estimated_hours: "",
      status: (taskStatuses as any[])[0]?.name || "",
    });
    setConvertDialog(true);
  };

  const nextStatuses = STATUS_TRANSITIONS[defect.status] || [];

  // Linked task IDs for filtering
  const linkedTaskIds = new Set(linkedTasks.map((lt: any) => lt.task_id));

  // Filtered tasks for the link-task picker
  const filteredPickerTasks = (allTasks as any[]).filter((t: any) => {
    if (linkedTaskIds.has(t.id)) return false;
    if (!linkTaskSearch.trim()) return true;
    const q = linkTaskSearch.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      String(t.task_number || "").includes(q)
    );
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
          <SheetHeader className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-muted-foreground mb-1">
                  {formatDefectNumber(defect.defect_number)}
                </p>
                <SheetTitle className="text-lg leading-snug">
                  {isEditing ? (
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm((p: any) => ({ ...p, title: e.target.value }))}
                      className="text-base"
                    />
                  ) : defect.title}
                </SheetTitle>
              </div>
              {canEdit && !isEditing && (
                <Button variant="ghost" size="sm" onClick={startEdit} className="shrink-0">
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[defect.status]}`}>
                {defect.status.replace(/_/g, " ")}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${SEVERITY_COLORS[defect.severity]}`}>
                {defect.severity}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800 capitalize">
                {defect.type}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800 capitalize">
                {defect.environment}
              </span>
            </div>
          </SheetHeader>

          {/* ── APPROVAL WORKFLOW ── */}
          <div className="space-y-2 mb-4">
            {/* Reporter: Submit for Approval */}
            {(defect.status === "draft" || defect.status === "rejected") && isReporter && !isEditing && (
              <div className={`rounded-lg p-3 border ${defect.status === "rejected" ? "bg-red-50 border-red-200 dark:bg-red-900/20" : "bg-blue-50 border-blue-200 dark:bg-blue-900/20"}`}>
                {defect.status === "rejected" && defect.rejection_reason && (
                  <p className="text-xs text-red-700 dark:text-red-400 mb-2">
                    <strong>Rejection reason:</strong> {defect.rejection_reason}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex-1">
                    {defect.status === "draft"
                      ? "This defect is a draft. Submit it for manager approval to proceed."
                      : "This defect was rejected. Update it and resubmit for approval."}
                  </p>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                  >
                    <ArrowUpCircle className="w-3 h-3 mr-1" />
                    Submit for Approval
                  </Button>
                </div>
              </div>
            )}

            {/* Manager/Admin: Approve or Reject */}
            {defect.status === "submitted" && isPrivileged && !isEditing && (
              <div className="rounded-lg p-3 border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-amber-800 dark:text-amber-300 flex-1">
                    This defect is awaiting your approval.
                  </p>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                  >
                    <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectDialog(true)}
                    disabled={rejectMutation.isPending}
                  >
                    <ThumbsDown className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            )}

            {/* Manager/Admin: Convert to Task (approved defects) */}
            {defect.status === "approved" && isPrivileged && !isEditing && (
              <div className="rounded-lg p-3 border bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 flex-1">
                    Defect approved. Convert it to a task to start tracking the fix.
                  </p>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    onClick={openConvertDialog}
                  >
                    <ListTodo className="w-3 h-3 mr-1" /> Convert to Task
                  </Button>
                </div>
              </div>
            )}

            {/* Normal status transitions */}
            {canChangeStatus && !isEditing && nextStatuses.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {nextStatuses.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ status: s })}
                  >
                    {STATUS_LABELS[s] || s}
                  </Button>
                ))}
              </div>
            )}

            {/* Edit save/cancel */}
            {isEditing && (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                  <Check className="w-4 h-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* ── Meta grid ── */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Reported By</p>
                <p className="font-medium">{getUserName(defect.reported_by)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Assigned To</p>
                {isEditing ? (
                  <Select value={editForm.assigned_to} onValueChange={(v) => setEditForm((p: any) => ({ ...p, assigned_to: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.user_name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <p className="font-medium">{getUserName(defect.assigned_to)}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
                {isEditing ? (
                  <Select value={String(editForm.priority)} onValueChange={(v) => setEditForm((p: any) => ({ ...p, priority: Number(v) }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">P1 – Critical</SelectItem>
                      <SelectItem value="2">P2 – High</SelectItem>
                      <SelectItem value="3">P3 – Medium</SelectItem>
                      <SelectItem value="4">P4 – Low</SelectItem>
                      <SelectItem value="5">P5 – Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                ) : <p className="font-medium">P{defect.priority}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Due Date</p>
                {isEditing ? (
                  <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm((p: any) => ({ ...p, due_date: e.target.value }))} className="h-8 text-sm" />
                ) : <p className="font-medium">{defect.due_date ? format(new Date(defect.due_date), "MMM d, yyyy") : "—"}</p>}
              </div>
              {isEditing && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Severity</p>
                    <Select value={editForm.severity} onValueChange={(v) => setEditForm((p: any) => ({ ...p, severity: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                    <Select value={editForm.type} onValueChange={(v) => setEditForm((p: any) => ({ ...p, type: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bug">Bug</SelectItem>
                        <SelectItem value="regression">Regression</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="ui">UI</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="data">Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Environment</p>
                    <Select value={editForm.environment} onValueChange={(v) => setEditForm((p: any) => ({ ...p, environment: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="qa">QA</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                <p className="font-medium">{defect.created_at ? format(new Date(defect.created_at), "MMM d, yyyy") : "—"}</p>
              </div>
              {defect.approved_by && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Approved By</p>
                  <p className="font-medium">{getUserName(defect.approved_by)}</p>
                </div>
              )}
              {defect.resolved_at && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Resolved</p>
                  <p className="font-medium">{format(new Date(defect.resolved_at), "MMM d, yyyy")}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* ── Description ── */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
              {isEditing ? (
                <Textarea value={editForm.description} onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{defect.description || "—"}</p>
              )}
            </div>

            {/* ── Steps / Expected / Actual ── */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Steps to Reproduce</Label>
              {isEditing ? (
                <Textarea value={editForm.steps_to_reproduce} onChange={(e) => setEditForm((p: any) => ({ ...p, steps_to_reproduce: e.target.value }))} rows={3} className="font-mono text-sm" />
              ) : (
                <p className="text-sm whitespace-pre-wrap font-mono">{defect.steps_to_reproduce || "—"}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Expected</Label>
                {isEditing ? (
                  <Textarea value={editForm.expected_behavior} onChange={(e) => setEditForm((p: any) => ({ ...p, expected_behavior: e.target.value }))} rows={2} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{defect.expected_behavior || "—"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Actual</Label>
                {isEditing ? (
                  <Textarea value={editForm.actual_behavior} onChange={(e) => setEditForm((p: any) => ({ ...p, actual_behavior: e.target.value }))} rows={2} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{defect.actual_behavior || "—"}</p>
                )}
              </div>
            </div>

            {(isEditing || defect.resolution) && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Resolution</Label>
                {isEditing ? (
                  <Textarea placeholder="Describe how this was resolved…" value={editForm.resolution} onChange={(e) => setEditForm((p: any) => ({ ...p, resolution: e.target.value }))} rows={2} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{defect.resolution}</p>
                )}
              </div>
            )}

            <Separator />

            {/* ── Linked Tasks ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <ListTodo className="w-3 h-3" /> Linked Tasks {linkedTasks.length > 0 && `(${linkedTasks.length})`}
                </Label>
                {isPrivileged && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setLinkTaskSearch(""); setLinkTaskDialog(true); }}
                  >
                    <Link2 className="w-3 h-3" /> Link Task
                  </Button>
                )}
              </div>
              {linkedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {defect.status === "approved"
                    ? "No tasks yet. Convert to a task or link an existing one."
                    : "No tasks linked to this defect."}
                </p>
              ) : (
                <div className="space-y-2">
                  {linkedTasks.map((lt: any) => (
                    <div key={lt.id} className="flex items-center justify-between gap-2 p-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate text-gray-900 dark:text-gray-100">
                          {lt.task?.task_number ? `#${lt.task.task_number} ` : ""}{lt.task?.title || "Task"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TASK_STATUS_COLORS[lt.task?.status] || "bg-gray-100 text-gray-600"}`}>
                            {(lt.task?.status || "").replace(/_/g, " ")}
                          </span>
                          {lt.linked_at && (
                            <span className="text-xs text-muted-foreground">
                              Linked {format(new Date(lt.linked_at), "MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isPrivileged && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => unlinkMutation.mutate(lt.task_id)}
                            disabled={unlinkMutation.isPending}
                            title="Unlink task"
                          >
                            <Unlink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Activity ── */}
            {activity.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Activity</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {activity.map((a: any) => (
                    <div key={a.id} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">{a.created_at ? format(new Date(a.created_at), "MMM d, HH:mm") : ""}</span>
                      <span>
                        <strong>{getUserName(a.acted_by)}</strong>{" "}
                        {a.action_type === "status_changed"
                          ? `changed status from "${a.old_value}" to "${a.new_value}"`
                          : a.action_type === "assigned"
                          ? `assigned to ${getUserName(a.new_value)}`
                          : a.action_type === "created"
                          ? "reported this defect"
                          : a.action_type === "converted_to_task"
                          ? "converted to a task"
                          : a.action_type === "task_linked"
                          ? "linked a task"
                          : a.action_type === "task_unlinked"
                          ? "unlinked a task"
                          : `${a.action_type}: ${a.new_value || ""}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* ── Comments ── */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Comments {comments.length > 0 && `(${comments.length})`}
              </Label>
              {comments.map((c: any) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {getUserName(c.commented_by).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">{getUserName(c.commented_by)}</span>
                      <span className="text-xs text-muted-foreground">{c.created_at ? format(new Date(c.created_at), "MMM d, HH:mm") : ""}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && newComment.trim()) {
                      commentMutation.mutate(newComment.trim());
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="self-end"
                  disabled={!newComment.trim() || commentMutation.isPending}
                  onClick={() => commentMutation.mutate(newComment.trim())}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Reject Dialog ── */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Defect</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Provide a reason so the reporter knows what to fix before resubmitting.
            </p>
            <Textarea
              placeholder="Rejection reason (optional but recommended)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={rejectMutation.isPending}
            >
              <ThumbsDown className="w-4 h-4 mr-1" /> Reject Defect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Convert to Task Dialog ── */}
      <Dialog open={convertDialog} onOpenChange={setConvertDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" /> Convert Defect to Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              A new task will be created and linked to this defect. The defect will move to "In Progress".
            </p>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Task Title <span className="text-red-500">*</span></Label>
              <Input
                value={convertForm.title}
                onChange={(e) => setConvertForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Assign To</Label>
                <select
                  value={convertForm.assigned_to}
                  onChange={(e) => setConvertForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full h-10 text-sm border rounded-lg px-3 bg-white dark:bg-gray-800"
                >
                  <option value="">— Unassigned —</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.user_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Estimated Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={convertForm.estimated_hours}
                  onChange={(e) => setConvertForm((f) => ({ ...f, estimated_hours: e.target.value }))}
                  placeholder="e.g. 8"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Start Date</Label>
                <Input
                  type="date"
                  value={convertForm.start_date}
                  onChange={(e) => setConvertForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Due Date</Label>
                <Input
                  type="date"
                  value={convertForm.due_date}
                  onChange={(e) => setConvertForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
            {(taskStatuses as any[]).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Initial Status</Label>
                <select
                  value={convertForm.status}
                  onChange={(e) => setConvertForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full h-10 text-sm border rounded-lg px-3 bg-white dark:bg-gray-800"
                >
                  {(taskStatuses as any[]).map((s: any) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConvertDialog(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => convertMutation.mutate({
                title: convertForm.title,
                assigned_to: convertForm.assigned_to || null,
                start_date: convertForm.start_date || null,
                due_date: convertForm.due_date || null,
                estimated_hours: convertForm.estimated_hours || null,
                status: convertForm.status || null,
              })}
              disabled={convertMutation.isPending || !convertForm.title.trim()}
            >
              <Zap className="w-4 h-4 mr-1" />
              {convertMutation.isPending ? "Creating…" : "Create Task & Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link Existing Task Dialog ── */}
      <Dialog open={linkTaskDialog} onOpenChange={(v) => { setLinkTaskDialog(v); if (!v) setLinkTaskSearch(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" /> Link Existing Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Search and select a task to link to this defect. Already-linked tasks are excluded.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or task number…"
                value={linkTaskSearch}
                onChange={(e) => setLinkTaskSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {filteredPickerTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 italic">
                  {linkTaskSearch ? "No matching tasks found." : "No tasks available to link."}
                </p>
              ) : (
                filteredPickerTasks.slice(0, 50).map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                    onClick={() => linkTaskMutation.mutate(t.id)}
                    disabled={linkTaskMutation.isPending}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.task_number ? <span className="text-muted-foreground font-mono text-xs mr-1.5">#{t.task_number}</span> : null}
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {(t.status || "").replace(/_/g, " ")} · {t.type || "task"}
                      </p>
                    </div>
                    <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTaskDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
