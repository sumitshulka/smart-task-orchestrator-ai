
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
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { format } from "date-fns";
import { Send, Pencil, X, Check } from "lucide-react";

interface Props {
  defect: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string;
  isAdmin: boolean;
  isManager: boolean;
  onUpdated: (d: any) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-800 border-orange-200",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  low:      "bg-green-100 text-green-800 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  resolved:    "bg-teal-100 text-teal-800 border-teal-200",
  verified:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed:      "bg-gray-100 text-gray-800 border-gray-200",
  reopened:    "bg-red-100 text-red-800 border-red-200",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open:        ["in_progress"],
  in_progress: ["resolved", "open"],
  resolved:    ["verified", "reopened"],
  verified:    ["closed"],
  closed:      ["reopened"],
  reopened:    ["in_progress"],
};

function formatDefectNumber(n: number) {
  return `DEF-${String(n).padStart(5, "0")}`;
}

export default function DefectDetailsSheet({
  defect,
  open,
  onOpenChange,
  currentUserId,
  isAdmin,
  isManager,
  onUpdated,
}: Props) {
  const queryClient = useQueryClient();
  const { users } = useUsersAndTeams();

  const canEdit = isAdmin || isManager || defect.reported_by === currentUserId;
  const canChangeStatus = isAdmin || isManager || defect.assigned_to === currentUserId;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [newComment, setNewComment] = useState("");

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

  const updateMutation = useMutation({
    mutationFn: (updates: any) => apiClient.patch(`/defects/${defect.id}`, updates),
    onSuccess: (updated) => {
      onUpdated(updated);
      queryClient.invalidateQueries({ queryKey: ["/api/defects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/defects", defect.id, "activity"] });
      toast({ title: "Defect updated" });
      setIsEditing(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update defect.", variant: "destructive" }),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient.post(`/defects/${defect.id}/comments`, { content, commented_by: currentUserId }),
    onSuccess: () => {
      setNewComment("");
      refetchComments();
    },
    onError: () => toast({ title: "Error", description: "Failed to post comment.", variant: "destructive" }),
  });

  const getUserName = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((u) => u.id === id);
    return u ? u.user_name || u.email : "—";
  };

  const startEdit = () => {
    setEditForm({
      title:             defect.title,
      description:       defect.description || "",
      steps_to_reproduce: defect.steps_to_reproduce || "",
      expected_behavior: defect.expected_behavior || "",
      actual_behavior:   defect.actual_behavior || "",
      severity:          defect.severity,
      priority:          defect.priority,
      type:              defect.type,
      environment:       defect.environment,
      assigned_to:       defect.assigned_to || "none",
      resolution:        defect.resolution || "",
      due_date:          defect.due_date ? defect.due_date.split("T")[0] : "",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const payload = {
      ...editForm,
      assigned_to: editForm.assigned_to === "none" ? null : editForm.assigned_to,
      due_date:    editForm.due_date || null,
    };
    updateMutation.mutate(payload);
  };

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate({ status: newStatus });
  };

  const nextStatuses = STATUS_TRANSITIONS[defect.status] || [];

  const statusLabel: Record<string, string> = {
    in_progress: "Start Progress",
    resolved:    "Mark Resolved",
    verified:    "Mark Verified",
    closed:      "Close",
    reopened:    "Reopen",
    open:        "Reopen",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
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
                ) : (
                  defect.title
                )}
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
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${SEVERITY_COLORS[defect.severity]}`}>
              {defect.severity}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[defect.status]}`}>
              {defect.status.replace("_", " ")}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 capitalize">
              {defect.type}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 capitalize">
              {defect.environment}
            </span>
          </div>
        </SheetHeader>

        {/* Status action buttons */}
        {canChangeStatus && !isEditing && nextStatuses.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {nextStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => handleStatusChange(s)}
              >
                {statusLabel[s] || s}
              </Button>
            ))}
          </div>
        )}

        {isEditing && (
          <div className="flex gap-2 mb-4">
            <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              <Check className="w-4 h-4 mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        )}

        <div className="space-y-5">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Reported By</p>
              <p className="font-medium">{getUserName(defect.reported_by)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Assigned To</p>
              {isEditing ? (
                <Select
                  value={editForm.assigned_to}
                  onValueChange={(v) => setEditForm((p: any) => ({ ...p, assigned_to: v }))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.user_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{getUserName(defect.assigned_to)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
              {isEditing ? (
                <Select
                  value={String(editForm.priority)}
                  onValueChange={(v) => setEditForm((p: any) => ({ ...p, priority: Number(v) }))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 – Critical</SelectItem>
                    <SelectItem value="2">2 – High</SelectItem>
                    <SelectItem value="3">3 – Medium</SelectItem>
                    <SelectItem value="4">4 – Low</SelectItem>
                    <SelectItem value="5">5 – Minimal</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">P{defect.priority}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Due Date</p>
              {isEditing ? (
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm((p: any) => ({ ...p, due_date: e.target.value }))}
                  className="h-8 text-sm"
                />
              ) : (
                <p className="font-medium">
                  {defect.due_date ? format(new Date(defect.due_date), "MMM d, yyyy") : "—"}
                </p>
              )}
            </div>
            {defect.severity && isEditing && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Severity</p>
                <Select
                  value={editForm.severity}
                  onValueChange={(v) => setEditForm((p: any) => ({ ...p, severity: v }))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {defect.type && isEditing && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                <Select
                  value={editForm.type}
                  onValueChange={(v) => setEditForm((p: any) => ({ ...p, type: v }))}
                >
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
            )}
            {defect.environment && isEditing && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Environment</p>
                <Select
                  value={editForm.environment}
                  onValueChange={(v) => setEditForm((p: any) => ({ ...p, environment: v }))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="qa">QA</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Created</p>
              <p className="font-medium">
                {defect.created_at ? format(new Date(defect.created_at), "MMM d, yyyy") : "—"}
              </p>
            </div>
            {defect.resolved_at && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Resolved</p>
                <p className="font-medium">{format(new Date(defect.resolved_at), "MMM d, yyyy")}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
            {isEditing ? (
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{defect.description || "—"}</p>
            )}
          </div>

          {/* Steps to Reproduce */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Steps to Reproduce</Label>
            {isEditing ? (
              <Textarea
                value={editForm.steps_to_reproduce}
                onChange={(e) => setEditForm((p: any) => ({ ...p, steps_to_reproduce: e.target.value }))}
                rows={3}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{defect.steps_to_reproduce || "—"}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Expected Behavior</Label>
              {isEditing ? (
                <Textarea
                  value={editForm.expected_behavior}
                  onChange={(e) => setEditForm((p: any) => ({ ...p, expected_behavior: e.target.value }))}
                  rows={2}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{defect.expected_behavior || "—"}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Actual Behavior</Label>
              {isEditing ? (
                <Textarea
                  value={editForm.actual_behavior}
                  onChange={(e) => setEditForm((p: any) => ({ ...p, actual_behavior: e.target.value }))}
                  rows={2}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{defect.actual_behavior || "—"}</p>
              )}
            </div>
          </div>

          {/* Resolution */}
          {(isEditing || defect.resolution) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Resolution</Label>
              {isEditing ? (
                <Textarea
                  placeholder="Describe how this was resolved…"
                  value={editForm.resolution}
                  onChange={(e) => setEditForm((p: any) => ({ ...p, resolution: e.target.value }))}
                  rows={2}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{defect.resolution}</p>
              )}
            </div>
          )}

          <Separator />

          {/* Activity log */}
          {activity.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Activity</Label>
              <div className="space-y-1.5">
                {activity.map((a: any) => (
                  <div key={a.id} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">
                      {a.created_at ? format(new Date(a.created_at), "MMM d, HH:mm") : ""}
                    </span>
                    <span>
                      <strong>{getUserName(a.acted_by)}</strong>{" "}
                      {a.action_type === "status_changed"
                        ? `changed status from "${a.old_value}" to "${a.new_value}"`
                        : a.action_type === "assigned"
                        ? `assigned to ${getUserName(a.new_value)}`
                        : a.action_type === "created"
                        ? "reported this defect"
                        : `${a.action_type}: ${a.new_value || ""}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Comments */}
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
                    <span className="text-xs text-muted-foreground">
                      {c.created_at ? format(new Date(c.created_at), "MMM d, HH:mm") : ""}
                    </span>
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
  );
}
