
import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import useSupabaseSession from "@/hooks/useSupabaseSession";
import { Paperclip, X, FileText, Image, File } from "lucide-react";

const MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2 MB

interface AttachmentFile {
  name: string;
  type: string;
  size: number;
  data: string; // base64
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string;
  defaultProjectId?: string;
  defaultProjectName?: string;
}

const defaultForm = {
  title: "",
  description: "",
  steps_to_reproduce: "",
  expected_behavior: "",
  actual_behavior: "",
  severity: "medium",
  priority: 3,
  type: "bug",
  environment: "production",
  assigned_to: "",
  team_id: "",
  project_id: "",
  milestone_id: "",
  feature_group_id: "",
  feature_id: "",
  due_date: "",
};

export default function CreateDefectSheet({ open, onOpenChange, currentUserId, defaultProjectId, defaultProjectName }: Props) {
  const queryClient = useQueryClient();
  const { users, teams } = useUsersAndTeams();
  const { user } = useSupabaseSession();

  const [form, setForm] = useState({ ...defaultForm, project_id: defaultProjectId || "" });
  const [milestonesList, setMilestonesList] = useState<any[]>([]);
  const [featureGroupsList, setFeatureGroupsList] = useState<any[]>([]);
  const [featuresList, setFeaturesList] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [attachSizeError, setAttachSizeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiClient.get("/projects"),
    enabled: open,
  });

  const set = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Cascade: when project changes, reset & fetch milestones + feature groups
  useEffect(() => {
    if (!form.project_id || !user?.id) {
      setMilestonesList([]);
      setFeatureGroupsList([]);
      setFeaturesList([]);
      setForm((f) => ({ ...f, milestone_id: "", feature_group_id: "", feature_id: "" }));
      return;
    }
    const h = { "x-user-id": user.id };
    fetch(`/api/projects/${form.project_id}/milestones`, { headers: h })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setMilestonesList(Array.isArray(d) ? d : []))
      .catch(() => setMilestonesList([]));
    fetch(`/api/projects/${form.project_id}/feature-groups`, { headers: h })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setFeatureGroupsList(Array.isArray(d) ? d : []))
      .catch(() => setFeatureGroupsList([]));
    setForm((f) => ({ ...f, milestone_id: "", feature_group_id: "", feature_id: "" }));
  }, [form.project_id, user?.id]);

  // Cascade: when feature group changes, fetch features
  useEffect(() => {
    if (!form.project_id || !form.feature_group_id || !user?.id) {
      setFeaturesList([]);
      setForm((f) => ({ ...f, feature_id: "" }));
      return;
    }
    fetch(`/api/projects/${form.project_id}/feature-groups/${form.feature_group_id}/features`, {
      headers: { "x-user-id": user.id },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setFeaturesList(Array.isArray(d) ? d : []))
      .catch(() => setFeaturesList([]));
    setForm((f) => ({ ...f, feature_id: "" }));
  }, [form.feature_group_id, form.project_id, user?.id]);

  // ── File attachment helpers ──────────────────────────────────────────────
  const totalSize = attachments.reduce((s, f) => s + f.size, 0);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachSizeError(null);

    const incoming = Array.from(files);
    const newTotal = totalSize + incoming.reduce((s, f) => s + f.size, 0);
    if (newTotal > MAX_TOTAL_BYTES) {
      setAttachSizeError(
        `Adding these files would exceed the 2 MB limit. Current: ${formatBytes(totalSize)}, trying to add: ${formatBytes(incoming.reduce((s, f) => s + f.size, 0))}.`
      );
      return;
    }

    incoming.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = (e.target?.result as string).split(",")[1]; // strip data URL prefix
        setAttachments((prev) => [
          ...prev,
          { name: file.name, type: file.type, size: file.size, data },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // reset input so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setAttachSizeError(null);
  };

  // ── Submission ───────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post("/defects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/defects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/defect-task-ids"] });
      toast({ title: "Defect reported", description: "Saved as draft. Submit it for manager approval when ready." });
      setForm({ ...defaultForm, project_id: defaultProjectId || "" });
      setMilestonesList([]);
      setFeatureGroupsList([]);
      setFeaturesList([]);
      setAttachments([]);
      setAttachSizeError(null);
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to create defect.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const payload: any = {
      title: form.title,
      description: form.description || null,
      steps_to_reproduce: form.steps_to_reproduce || null,
      expected_behavior: form.expected_behavior || null,
      actual_behavior: form.actual_behavior || null,
      severity: form.severity,
      priority: form.priority,
      type: form.type,
      environment: form.environment,
      status: "draft",
      reported_by: currentUserId,
      assigned_to: form.assigned_to || null,
      team_id: form.team_id || null,
      project_id: form.project_id || null,
      milestone_id: form.milestone_id || null,
      feature_group_id: form.feature_group_id || null,
      feature_id: form.feature_id || null,
      due_date: form.due_date || null,
      attachments,
    };
    createMutation.mutate(payload);
  };

  const sectionBadge = (n: number, color: string) => (
    <span className={`${color} rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold mr-2 shrink-0`}>
      {n}
    </span>
  );

  const fileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
    if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[90vw] md:w-[70vw] lg:w-[55vw] lg:min-w-[820px] max-w-none overflow-y-auto"
      >
        <form className="p-3 sm:p-6 space-y-5 sm:space-y-7" onSubmit={handleSubmit}>
          <SheetHeader className="space-y-2 pb-4 border-b border-gray-200 dark:border-gray-700">
            <SheetTitle className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Report a Defect
            </SheetTitle>
            <SheetDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Fill in the details below to log a new defect. It will be saved as a draft — submit it for approval when ready.
            </SheetDescription>
          </SheetHeader>

          {/* ── SECTION 1: Basic Information ── */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              {sectionBadge(1, "bg-blue-100 text-blue-800")}
              Basic Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Defect Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Concise description of the defect"
                  className="h-12 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Detailed context about the defect, its impact, and any relevant background"
                  className="min-h-[100px] resize-y text-base"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Project Linkage ── */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 sm:p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 mb-1 flex items-center">
              {sectionBadge(2, "bg-indigo-100 text-indigo-800")}
              Project Linkage
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 ml-8">
              Link this defect to a project so it can be tracked against milestones and features
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Project</label>
                {defaultProjectId ? (
                  <div className="h-10 flex items-center px-3 text-sm rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 gap-2">
                    <span className="text-emerald-500">🔒</span>
                    <span className="font-medium truncate">
                      {defaultProjectName || (projects as any[]).find((p: any) => p.id === defaultProjectId)?.name || "Current project"}
                    </span>
                    <span className="ml-auto text-xs opacity-60">auto-linked</span>
                  </div>
                ) : (
                  <select
                    value={form.project_id}
                    onChange={(e) => set("project_id", e.target.value)}
                    className="w-full h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— None —</option>
                    {(projects as any[]).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {form.project_id && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Milestone / Release
                    </label>
                    <select
                      value={form.milestone_id}
                      onChange={(e) => set("milestone_id", e.target.value)}
                      className="w-full h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— No milestone —</option>
                      {milestonesList.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Feature Group
                    </label>
                    <select
                      value={form.feature_group_id}
                      onChange={(e) => set("feature_group_id", e.target.value)}
                      className="w-full h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— No group —</option>
                      {featureGroupsList.map((fg: any) => (
                        <option key={fg.id} value={fg.id}>{fg.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Feature
                    </label>
                    <select
                      value={form.feature_id}
                      onChange={(e) => set("feature_id", e.target.value)}
                      disabled={!form.feature_group_id}
                      className="w-full h-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">— No feature —</option>
                      {featuresList.map((f: any) => (
                        <option key={f.id} value={f.id}>
                          {f.tracking_number ? `[${f.tracking_number}] ` : ""}{f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 3: Classification ── */}
          <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              {sectionBadge(3, "bg-green-100 text-green-800")}
              Classification
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => set("severity", e.target.value)}
                  className="w-full h-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="critical">🔴 Critical</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => set("priority", Number(e.target.value))}
                  className="w-full h-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>P1 – Critical</option>
                  <option value={2}>P2 – High</option>
                  <option value={3}>P3 – Medium</option>
                  <option value={4}>P4 – Low</option>
                  <option value={5}>P5 – Minimal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Defect Type</label>
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  className="w-full h-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bug">Bug</option>
                  <option value="regression">Regression</option>
                  <option value="performance">Performance</option>
                  <option value="ui">UI / Visual</option>
                  <option value="security">Security</option>
                  <option value="data">Data</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Environment</label>
                <select
                  value={form.environment}
                  onChange={(e) => set("environment", e.target.value)}
                  className="w-full h-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="qa">QA</option>
                  <option value="development">Development</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── SECTION 4: Reproduction Details ── */}
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              {sectionBadge(4, "bg-purple-100 text-purple-800")}
              Reproduction Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Steps to Reproduce
                </label>
                <Textarea
                  value={form.steps_to_reproduce}
                  onChange={(e) => set("steps_to_reproduce", e.target.value)}
                  placeholder={"1. Navigate to...\n2. Click on...\n3. Observe that..."}
                  className="min-h-[90px] resize-y text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Expected Behavior
                  </label>
                  <Textarea
                    value={form.expected_behavior}
                    onChange={(e) => set("expected_behavior", e.target.value)}
                    placeholder="What should have happened"
                    className="min-h-[80px] resize-y text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Actual Behavior
                  </label>
                  <Textarea
                    value={form.actual_behavior}
                    onChange={(e) => set("actual_behavior", e.target.value)}
                    placeholder="What actually happened"
                    className="min-h-[80px] resize-y text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 5: Assignment & Timeline ── */}
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
              {sectionBadge(5, "bg-orange-100 text-orange-800")}
              Assignment &amp; Timeline
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => set("assigned_to", e.target.value)}
                  className="w-full h-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Unassigned —</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.user_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Team</label>
                <select
                  value={form.team_id}
                  onChange={(e) => set("team_id", e.target.value)}
                  className="w-full h-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No team —</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 6: Attachments ── */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200 mb-1 flex items-center">
              {sectionBadge(6, "bg-slate-200 text-slate-700")}
              Attachments
              <span className="ml-2 text-xs font-normal text-gray-500">(optional)</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 ml-8">
              Attach screenshots or supporting documents. Total size limit: <span className="font-semibold">2 MB</span>.
              Accepted: images (PNG, JPG, GIF, WebP), PDF, Word, Excel, text files.
            </p>

            {/* Drop zone / file picker */}
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <Paperclip className="h-6 w-6 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Click to browse or drag &amp; drop files here
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {/* Size bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalSize / MAX_TOTAL_BYTES > 0.85 ? "bg-red-500" : totalSize / MAX_TOTAL_BYTES > 0.6 ? "bg-amber-400" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(100, (totalSize / MAX_TOTAL_BYTES) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                {formatBytes(totalSize)} / 2 MB
              </span>
            </div>

            {/* Error */}
            {attachSizeError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{attachSizeError}</p>
            )}

            {/* File list */}
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((att, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                  >
                    {fileIcon(att.type)}
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{att.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatBytes(att.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Footer ── */}
          <SheetFooter className="pt-4 border-t border-gray-200 dark:border-gray-700 flex-col sm:flex-row gap-3">
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? (
                <span className="flex items-center"><span className="animate-spin mr-2">⏳</span>Saving…</span>
              ) : (
                <span className="flex items-center"><span className="mr-2">🐛</span>Save as Draft</span>
              )}
            </Button>
            <SheetClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-6 text-base font-semibold"
                onClick={() => {
                  setForm({ ...defaultForm, project_id: defaultProjectId || "" });
                  setAttachments([]);
                  setAttachSizeError(null);
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
