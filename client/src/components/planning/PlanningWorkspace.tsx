import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiClient } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Settings2, FileDown, Sparkles, ChevronDown, ChevronRight,
  Pencil, Trash2, MoreHorizontal, Calendar, Clock, User, Flag,
  Layers, FolderOpen, BookOpen, CheckSquare, GitBranch, Target,
  BarChart2, AlertTriangle, X, Check, RefreshCw, Network,
  Link2, ArrowRight,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { User as UserType } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────
type PlanningStatus = "high_level" | "partially_planned" | "detailed" | "reviewed";
type NodeType = "phase" | "stage" | "milestone" | "feature_group" | "feature" | "user_story";

interface PlanningTree {
  phases: any[];
  stages: any[];
  milestones: any[];
  featureGroups: any[];
  features: any[];
  stories: any[];
  dependencies: any[];
  config: any | null;
}

interface CoverageData {
  coverage_pct: number;
  total_items: number;
  by_status: Record<string, number>;
  counts: Record<string, number>;
}

// ── Constants ──────────────────────────────────────────────────────────────
const PLANNING_STATUS_CONFIG: Record<PlanningStatus, { label: string; color: string; bg: string }> = {
  high_level:        { label: "High Level",        color: "text-gray-500",  bg: "bg-gray-100 dark:bg-gray-800" },
  partially_planned: { label: "Partially Planned",  color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
  detailed:          { label: "Detailed",           color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-950/30" },
  reviewed:          { label: "Reviewed",           color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
};

const METHODOLOGY_LABELS: Record<string, string> = {
  manual:           "Manual",
  complexity_based: "Complexity Based",
  component_based:  "Component Based",
  function_point:   "Function Point Analysis",
  story_point:      "Story Point Based",
  historical:       "Historical Data Based",
  custom:           "Custom",
};

const NODE_TYPE_CONFIG: Record<NodeType, { label: string; icon: any; color: string; singularLabel: string }> = {
  phase:         { label: "Phases",         icon: GitBranch,   color: "text-violet-600",  singularLabel: "Phase" },
  stage:         { label: "Stages",         icon: Layers,      color: "text-blue-600",    singularLabel: "Stage" },
  milestone:     { label: "Milestones",     icon: Flag,        color: "text-orange-500",  singularLabel: "Milestone" },
  feature_group: { label: "Feature Groups", icon: FolderOpen,  color: "text-teal-600",    singularLabel: "Feature Group" },
  feature:       { label: "Features",       icon: CheckSquare, color: "text-indigo-600",  singularLabel: "Feature" },
  user_story:    { label: "User Stories",   icon: BookOpen,    color: "text-pink-600",    singularLabel: "User Story" },
};

const EMPTY_FORM = {
  name: "", title: "", description: "", acceptance_criteria: "",
  start_date: "", end_date: "", estimated_hours: "",
  planning_status: "high_level" as PlanningStatus,
  owner_id: "", phase_id: "", stage_id: "", milestone_id: "",
  feature_group_id: "", feature_id: "", status: "draft",
  date_mode: "manual",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function PlanningStatusBadge({ status }: { status: string }) {
  const cfg = PLANNING_STATUS_CONFIG[status as PlanningStatus] ?? PLANNING_STATUS_CONFIG.high_level;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function DateRange({ start, end }: { start?: string | null; end?: string | null }) {
  if (!start && !end) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>;
  const fmt = (d: string) => format(new Date(d), "dd MMM");
  return (
    <span className="text-xs text-gray-400 tabular-nums">
      {start ? fmt(start) : "?"} → {end ? fmt(end) : "?"}
      {start && end && (
        <span className="ml-1 text-gray-300 dark:text-gray-600">
          ({differenceInDays(new Date(end), new Date(start))}d)
        </span>
      )}
    </span>
  );
}

function EffortBadge({ hours }: { hours?: number | null }) {
  if (!hours) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 tabular-nums">
      <Clock className="h-2.5 w-2.5" />{hours}h
    </span>
  );
}

// ── Dependency Section (inside NodeSheet when editing) ─────────────────────
const DEP_TYPE_LABELS: Record<string, string> = {
  finish_to_start: "Finish → Start",
  start_to_start:  "Start → Start",
};

function DependencySection({
  nodeId, nodeType, tree, projectId,
}: { nodeId: string; nodeType: NodeType; tree: PlanningTree; projectId: string }) {
  const { toast } = useToast();
  const [targetId, setTargetId] = useState("");
  const [depType, setDepType] = useState("finish_to_start");

  // Flat list of all items, excluding this node
  const allItems = useMemo<{ id: string; label: string; type: NodeType }[]>(() => [
    ...tree.phases.map((p: any) => ({ id: p.id, label: `Phase: ${p.name}`, type: "phase" as NodeType })),
    ...tree.stages.map((s: any) => ({ id: s.id, label: `Stage: ${s.name}`, type: "stage" as NodeType })),
    ...tree.milestones.map((m: any) => ({ id: m.id, label: `Milestone: ${m.name}`, type: "milestone" as NodeType })),
    ...tree.featureGroups.map((fg: any) => ({ id: fg.id, label: `FG: ${fg.name}`, type: "feature_group" as NodeType })),
    ...tree.features.map((f: any) => ({ id: f.id, label: `Feature: ${f.name}`, type: "feature" as NodeType })),
    ...tree.stories.map((s: any) => ({ id: s.id, label: `Story: ${s.title}`, type: "user_story" as NodeType })),
  ].filter(i => i.id !== nodeId), [tree, nodeId]);

  // Outgoing deps = this node is the source (this node depends on the target)
  const outgoing = (tree.dependencies ?? []).filter((d: any) => d.source_id === nodeId);

  const add = useMutation({
    mutationFn: () => {
      const target = allItems.find(i => i.id === targetId);
      if (!target) throw new Error("Select an item first");
      return apiClient.post(`/projects/${projectId}/planning/dependencies`, {
        source_type: nodeType, source_id: nodeId,
        target_type: target.type, target_id: targetId,
        dependency_type: depType,
      });
    },
    onSuccess: () => {
      toast({ title: "Dependency added" });
      setTargetId("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
    },
    onError: (e: any) => toast({ title: e.message ?? "Failed to add dependency", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (depId: string) => apiClient.delete(`/projects/${projectId}/planning/dependencies/${depId}`),
    onSuccess: () => {
      toast({ title: "Dependency removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
    },
    onError: () => toast({ title: "Failed to remove dependency", variant: "destructive" }),
  });

  const labelFor = (id: string) => allItems.find(i => i.id === id)?.label ?? id.slice(0, 8);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        <Link2 className="h-3 w-3" />Dependencies — this item starts after…
      </Label>

      {outgoing.map((d: any) => (
        <div key={d.id} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
          <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
          <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{labelFor(d.target_id)}</span>
          <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
            {DEP_TYPE_LABELS[d.dependency_type] ?? d.dependency_type}
          </span>
          <button onClick={() => remove.mutate(d.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <Select value={targetId || "none"} onValueChange={v => setTargetId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select predecessor…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select predecessor —</SelectItem>
              {allItems.map(i => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36 shrink-0">
          <Select value={depType} onValueChange={setDepType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="finish_to_start">Finish → Start</SelectItem>
              <SelectItem value="start_to_start">Start → Start</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 px-2 shrink-0" onClick={() => add.mutate()} disabled={!targetId || add.isPending}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {outgoing.length === 0 && (
        <p className="text-[11px] text-gray-400">No dependencies yet. Add a predecessor to enforce sequencing.</p>
      )}
    </div>
  );
}

// ── Coverage Bar ───────────────────────────────────────────────────────────
function CoverageBar({ coverage }: { coverage: CoverageData | undefined }) {
  if (!coverage) return null;
  const pct = coverage.coverage_pct;
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-gray-400";
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-1 min-w-[80px] max-w-[140px] bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{pct}%</span>
      <span className="text-[10px] text-gray-400">Planning Coverage</span>
    </div>
  );
}

// ── Node Row ───────────────────────────────────────────────────────────────
function NodeRow({
  node, type, depth, isExpanded, hasChildren,
  onToggle, onEdit, onDelete, onAddChild, users,
  childTypes, depCount, conflictWarning,
}: {
  node: any; type: NodeType; depth: number; isExpanded: boolean; hasChildren: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onAddChild: (childType: NodeType) => void;
  users: UserType[];
  childTypes: NodeType[];
  depCount?: number;
  conflictWarning?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = NODE_TYPE_CONFIG[type];
  const Icon = cfg.icon;
  const owner = node.owner_id ? users.find((u: any) => u.id === node.owner_id) : null;

  return (
    <div
      className={`group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors min-w-0 ${conflictWarning ? "ring-1 ring-amber-300 dark:ring-amber-700 bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
      style={{ paddingLeft: `${(depth * 20) + 8}px` }}
    >
      {/* Expand toggle */}
      <button
        className="shrink-0 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
        onClick={onToggle}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
        ) : <span className="w-3" />}
      </button>

      {/* Type icon */}
      <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />

      {/* Name */}
      <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate font-medium">
        {node.tracking_number && (
          <span className="font-mono text-[10px] text-gray-400 mr-1.5">{node.tracking_number}</span>
        )}
        {node.name ?? node.title}
      </span>

      {/* Conflict warning */}
      {conflictWarning && (
        <span
          title={conflictWarning}
          className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 cursor-help"
        >
          <AlertTriangle className="h-2.5 w-2.5" />Conflict
        </span>
      )}

      {/* Dep badge */}
      {(depCount ?? 0) > 0 && !conflictWarning && (
        <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
          <Link2 className="h-2.5 w-2.5" />{depCount}
        </span>
      )}

      {/* Metadata — always visible */}
      <div className="flex items-center gap-2.5 shrink-0">
        <DateRange start={node.start_date} end={node.end_date} />
        <EffortBadge hours={node.estimated_hours} />
        {owner && (
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5 max-w-[80px] truncate" title={owner.user_name ?? owner.email}>
            <User className="h-2.5 w-2.5 shrink-0" />{owner.user_name ?? owner.email}
          </span>
        )}
      </div>

      {/* Planning status badge — always visible */}
      <PlanningStatusBadge status={node.planning_status ?? "high_level"} />

      {/* Context menu */}
      <div className="relative shrink-0">
        <button
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          onClick={() => setMenuOpen(v => !v)}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-6 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
              {childTypes.map(ct => (
                <button
                  key={ct}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                  onClick={() => { onAddChild(ct); setMenuOpen(false); }}
                >
                  <Plus className="h-3 w-3" />Add {NODE_TYPE_CONFIG[ct].singularLabel}
                </button>
              ))}
              {childTypes.length > 0 && <div className="border-t border-gray-100 dark:border-gray-800 my-1" />}
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                onClick={() => { onEdit(); setMenuOpen(false); }}
              >
                <Pencil className="h-3 w-3" />Edit
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                onClick={() => { onDelete(); setMenuOpen(false); }}
              >
                <Trash2 className="h-3 w-3" />Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Settings Dialog ────────────────────────────────────────────────────────
function PlanningSettingsDialog({
  open, onClose, projectId, config, onSaved,
}: { open: boolean; onClose: () => void; projectId: string; config: any; onSaved: () => void }) {
  const { toast } = useToast();
  const [methodology, setMethodology] = useState(config?.methodology ?? "manual");
  const [notes, setNotes] = useState(config?.notes ?? "");

  const save = useMutation({
    mutationFn: () => apiClient.put(`/projects/${projectId}/planning/config`, { methodology, methodology_version: "1.0", notes }),
    onSuccess: () => { toast({ title: "Planning settings saved" }); onSaved(); onClose(); },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Planning Settings</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Planning Methodology</Label>
            <Select value={methodology} onValueChange={setMethodology}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(METHODOLOGY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">Determines how effort estimation is calculated. Only Manual is fully implemented; others are architecture-ready for future rollout.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Planning Notes</Label>
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes about the planning approach…" className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AI Panel ───────────────────────────────────────────────────────────────
function AiPlanningPanel({
  open, onClose, projectId, tree, onProposalReady,
}: { open: boolean; onClose: () => void; projectId: string; tree: PlanningTree; onProposalReady: (data: any) => void }) {
  const { toast } = useToast();
  const [scopeType, setScopeType] = useState("project");
  const [scopeId, setScopeId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const propose = async () => {
    if (!prompt.trim()) { toast({ title: "Please enter a prompt", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const data = await apiClient.post(`/projects/${projectId}/planning/ai-propose`, {
        scope_type: scopeType,
        scope_id: scopeId || null,
        prompt,
      });
      onProposalReady(data);
      onClose();
    } catch {
      toast({ title: "AI planning failed", description: "Check AI settings or try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const scopeOptions = [
    { value: "project", label: "Entire Project" },
    ...(tree.phases.map(p => ({ value: `phase:${p.id}`, label: `Phase: ${p.name}` }))),
    ...(tree.milestones.map(m => ({ value: `milestone:${m.id}`, label: `Milestone: ${m.name}` }))),
    ...(tree.features.map(f => ({ value: `feature:${f.id}`, label: `Feature: ${f.name}` }))),
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-md flex flex-col" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />AI Planning
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-3 text-xs text-violet-700 dark:text-violet-300">
            AI will analyze your project and propose planning items. You review and approve before anything is created.
          </div>
          <div className="space-y-1.5">
            <Label>Planning Scope</Label>
            <Select
              value={scopeType === "project" ? "project" : `${scopeType}:${scopeId}`}
              onValueChange={val => {
                if (val === "project") { setScopeType("project"); setScopeId(""); }
                else { const [t, ...id] = val.split(":"); setScopeType(t); setScopeId(id.join(":")); }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {scopeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Your Instruction</Label>
            <Textarea
              rows={5}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`e.g. "Break this feature into user stories with acceptance criteria" or "Plan Phase 2 - Development with realistic milestones"`}
              className="resize-none"
            />
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">AI Assistance Rules</p>
            <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5 list-disc list-inside">
              <li>AI proposes — you approve</li>
              <li>Existing items are never duplicated</li>
              <li>PM remains the final authority</li>
            </ul>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={propose} disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate Plan</>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── AI Proposal Review ─────────────────────────────────────────────────────
const PROPOSAL_STATUS_OPTIONS: { value: PlanningStatus; label: string }[] = [
  { value: "high_level", label: "High Level" },
  { value: "partially_planned", label: "Partially Planned" },
  { value: "detailed", label: "Detailed" },
  { value: "reviewed", label: "Reviewed" },
];

function AiProposalReview({
  proposal, items: initialItems, projectId, onClose, onCommitted,
}: { proposal: any; items: any[]; projectId: string; onClose: () => void; onCommitted: () => void }) {
  const { toast } = useToast();
  // Local mutable items so inline edits reflect immediately
  const [items, setItems] = useState<any[]>(initialItems ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set((initialItems ?? []).map((i: any) => i.id)));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const summary = proposal.summary_json as any;

  const toggleExpand = (id: string, data: any) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setDrafts(prev => ({
      ...prev,
      [id]: {
        name: data.name ?? data.title ?? "",
        description: data.description ?? "",
        estimated_hours: data.estimated_hours?.toString() ?? "",
        planning_status: data.planning_status ?? "high_level",
      },
    }));
  };

  const saveEdit = async (item: any) => {
    setSavingId(item.id);
    try {
      const draft = drafts[item.id] ?? {};
      const userStr = localStorage.getItem("user");
      const userId = userStr ? JSON.parse(userStr)?.id ?? "" : "";
      const resp = await fetch(
        `/api/projects/${projectId}/planning/ai-proposals/${proposal.id}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify(draft),
        }
      );
      if (!resp.ok) throw new Error("failed");
      const updated = await resp.json();
      setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
      setExpandedId(null);
      toast({ title: "Item updated" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const review = useMutation({
    mutationFn: (action: "accept_selected" | "reject") =>
      apiClient.put(`/projects/${projectId}/planning/ai-proposals/${proposal.id}/review`, {
        action, accepted_item_ids: Array.from(selected),
      }),
    onSuccess: (data: any, action) => {
      toast({ title: action === "reject" ? "Proposal rejected" : `${data.committed ?? 0} items added to plan` });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
      onCommitted();
    },
    onError: () => toast({ title: "Failed to process proposal", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">AI Planning Proposal</p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">{summary?.summary}</p>
          </div>
          <button onClick={onClose} className="text-violet-400 hover:text-violet-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-3 text-xs text-violet-700 dark:text-violet-300">
          <span><strong>{items.length}</strong> items proposed</span>
          <span><strong>{selected.size}</strong> selected</span>
          <span className="text-violet-400">Click <Pencil className="h-2.5 w-2.5 inline" /> to edit any item before accepting</span>
        </div>
      </div>

      <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-0.5">
        {items.map(item => {
          const data = item.item_data as any;
          const Icon = NODE_TYPE_CONFIG[item.item_type as NodeType]?.icon ?? Target;
          const cfg = NODE_TYPE_CONFIG[item.item_type as NodeType];
          const isExpanded = expandedId === item.id;
          const draft = drafts[item.id] ?? {};

          return (
            <div key={item.id}
              className={`rounded-lg border transition-colors ${isExpanded
                ? "border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20"
                : "border-gray-100 dark:border-gray-800"}`}
            >
              {/* Item header row */}
              <div className="flex items-start gap-2.5 p-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={e => {
                    const next = new Set(selected);
                    e.target.checked ? next.add(item.id) : next.delete(item.id);
                    setSelected(next);
                  }}
                  className="mt-0.5 shrink-0"
                />
                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg?.color ?? "text-gray-400"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{data.name ?? data.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{cfg?.singularLabel ?? item.item_type}</span>
                    {data.planning_status && data.planning_status !== "high_level" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                        {PROPOSAL_STATUS_OPTIONS.find(o => o.value === data.planning_status)?.label}
                      </span>
                    )}
                    {data.estimated_hours && (
                      <span className="text-[10px] text-gray-400">{data.estimated_hours}h</span>
                    )}
                  </div>
                  {data.description && !isExpanded && (
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{data.description}</p>
                  )}
                </div>
                {/* Edit toggle */}
                <button
                  onClick={() => toggleExpand(item.id, data)}
                  className={`shrink-0 p-1 rounded transition-colors ${isExpanded
                    ? "text-violet-600 bg-violet-100 dark:bg-violet-900/40"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                  title={isExpanded ? "Collapse" : "Edit this item"}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>

              {/* Inline edit form */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-violet-100 dark:border-violet-800 pt-2.5">
                  {/* Name */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      {item.item_type === "user_story" ? "Title" : "Name"}
                    </label>
                    <input
                      className="mt-0.5 w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      value={draft.name ?? ""}
                      onChange={e => setDrafts(prev => ({ ...prev, [item.id]: { ...prev[item.id], name: e.target.value } }))}
                      placeholder="Name"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                    <textarea
                      className="mt-0.5 w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
                      rows={2}
                      value={draft.description ?? ""}
                      onChange={e => setDrafts(prev => ({ ...prev, [item.id]: { ...prev[item.id], description: e.target.value } }))}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="flex gap-2">
                    {/* Estimated hours */}
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Est. Hours</label>
                      <input
                        type="number"
                        min="0"
                        className="mt-0.5 w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        value={draft.estimated_hours ?? ""}
                        onChange={e => setDrafts(prev => ({ ...prev, [item.id]: { ...prev[item.id], estimated_hours: e.target.value } }))}
                        placeholder="—"
                      />
                    </div>

                    {/* Planning status */}
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Planning Status</label>
                      <select
                        className="mt-0.5 w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        value={draft.planning_status ?? "high_level"}
                        onChange={e => setDrafts(prev => ({ ...prev, [item.id]: { ...prev[item.id], planning_status: e.target.value } }))}
                      >
                        {PROPOSAL_STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Save / Cancel */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => saveEdit(item)}
                      disabled={savingId === item.id}
                    >
                      {savingId === item.id ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setExpandedId(null)}
                      disabled={savingId === item.id}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => review.mutate("reject")}
          disabled={review.isPending}
        >
          <X className="h-3.5 w-3.5 mr-1" />Reject All
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => review.mutate("accept_selected")}
          disabled={review.isPending || selected.size === 0}
        >
          <Check className="h-3.5 w-3.5 mr-1" />Accept {selected.size} Items
        </Button>
      </div>
    </div>
  );
}

// ── Node Form Sheet ────────────────────────────────────────────────────────
function NodeSheet({
  open, onClose, type, node, projectId, tree, users, onSaved,
}: {
  open: boolean; onClose: () => void; type: NodeType; node: any | null;
  projectId: string; tree: PlanningTree; users: UserType[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const cfg = NODE_TYPE_CONFIG[type];
  const isEdit = !!node;

  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    name: node?.name ?? node?.title ?? "",
    title: node?.title ?? "",
    description: node?.description ?? "",
    acceptance_criteria: node?.acceptance_criteria ?? "",
    start_date: node?.start_date ? format(new Date(node.start_date), "yyyy-MM-dd") : "",
    end_date: node?.end_date ? format(new Date(node.end_date), "yyyy-MM-dd") : "",
    estimated_hours: node?.estimated_hours?.toString() ?? "",
    planning_status: (node?.planning_status ?? "high_level") as PlanningStatus,
    owner_id: node?.owner_id ?? "",
    phase_id: node?.phase_id ?? "",
    stage_id: node?.stage_id ?? "",
    milestone_id: node?.milestone_id ?? "",
    feature_group_id: node?.feature_group_id ?? "",
    feature_id: node?.feature_id ?? "",
    status: node?.status ?? "draft",
    date_mode: node?.date_mode ?? "manual",
  }));

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const buildPayload = () => ({
    name: type === "user_story" ? undefined : form.name,
    title: type === "user_story" ? form.name || form.title : undefined,
    description: form.description || null,
    acceptance_criteria: (type === "feature" || type === "user_story") ? form.acceptance_criteria || null : undefined,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
    planning_status: form.planning_status,
    owner_id: form.owner_id || null,
    phase_id: (type === "stage" || type === "milestone" || type === "feature_group" || type === "feature") ? form.phase_id || null : undefined,
    stage_id: (type === "milestone" || type === "feature_group" || type === "feature") ? form.stage_id || null : undefined,
    milestone_id: type === "feature_group" ? form.milestone_id || null : undefined,
    feature_id: type === "user_story" ? form.feature_id || null : undefined,
    feature_group_id: type === "feature" ? form.feature_group_id || null : undefined,
    status: (type === "user_story" || type === "feature") ? form.status : undefined,
    date_mode: (type === "feature" || type === "user_story") ? form.date_mode : undefined,
  });

  const getEndpoint = () => {
    const base = `/projects/${projectId}/planning`;
    if (type === "phase") return `${base}/phases`;
    if (type === "stage") return `${base}/stages`;
    if (type === "user_story") return `${base}/user-stories`;
    // milestones, feature_groups, features use patch for planning fields or existing endpoints
    if (type === "milestone") return isEdit ? `/projects/${projectId}/planning/milestones/${node.id}` : `/projects/${projectId}/milestones`;
    if (type === "feature_group") return isEdit ? `/projects/${projectId}/planning/feature-groups/${node.id}` : `/projects/${projectId}/feature-groups`;
    if (type === "feature") return isEdit ? `/projects/${projectId}/planning/features/${node.id}` : `/projects/${projectId}/features`;
    return base;
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      const endpoint = getEndpoint();
      if (isEdit) {
        if (type === "milestone" || type === "feature_group" || type === "feature") {
          return apiClient.patch(endpoint, payload);
        }
        const editEndpoint = endpoint + `/${node.id}`;
        return apiClient.put(editEndpoint, payload);
      }
      // For milestone/fg/feature creation, use the original endpoints but include planning fields
      if (type === "milestone") {
        return apiClient.post(`/projects/${projectId}/milestones`, {
          name: form.name, description: form.description || null,
          start_date: form.start_date || null, end_date: form.end_date || null,
          status: "not_started", planning_status: form.planning_status,
          estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
          owner_id: form.owner_id || null, phase_id: form.phase_id || null, stage_id: form.stage_id || null,
        });
      }
      if (type === "feature_group") {
        return apiClient.post(`/projects/${projectId}/feature-groups`, {
          name: form.name, description: form.description || null,
          planning_status: form.planning_status, estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
          owner_id: form.owner_id || null, phase_id: form.phase_id || null, stage_id: form.stage_id || null, milestone_id: form.milestone_id || null,
          start_date: form.start_date || null, end_date: form.end_date || null,
        });
      }
      if (type === "feature") {
        return apiClient.post(`/projects/${projectId}/features`, {
          name: form.name, description: form.description || null,
          feature_group_id: form.feature_group_id || null, status: form.status ?? "not_started",
          planning_status: form.planning_status, estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
          owner_id: form.owner_id || null, phase_id: form.phase_id || null, stage_id: form.stage_id || null,
          start_date: form.start_date || null, end_date: form.end_date || null, date_mode: form.date_mode, acceptance_criteria: form.acceptance_criteria || null,
        });
      }
      return apiClient.post(endpoint, payload);
    },
    onSuccess: () => {
      toast({ title: `${cfg.singularLabel} ${isEdit ? "updated" : "created"}` });
      // Invalidate both planning tree and individual caches
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "feature-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "features"] });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: `Failed to save ${cfg.singularLabel}`, variant: "destructive" }),
  });

  // Date warning
  const dateWarn = useMemo(() => {
    if (!form.start_date || !form.end_date) return null;
    if (new Date(form.end_date) < new Date(form.start_date)) return "End date is before start date.";
    return null;
  }, [form.start_date, form.end_date]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full max-w-lg flex flex-col" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
            {isEdit ? `Edit ${cfg.singularLabel}` : `New ${cfg.singularLabel}`}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          {/* Name / Title */}
          <div className="space-y-1.5">
            <Label>{type === "user_story" ? "Story Title" : "Name"} <span className="text-red-500">*</span></Label>
            <Input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder={
                type === "phase" ? "e.g. Discovery Phase" :
                type === "stage" ? "e.g. Requirements Gathering" :
                type === "milestone" ? "e.g. Requirements Complete" :
                type === "feature_group" ? "e.g. Employee Management" :
                type === "feature" ? "e.g. Employee Registration" :
                "e.g. As a user, I want to…"
              }
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} className="resize-none" />
          </div>

          {/* Acceptance Criteria (Feature & User Story) */}
          {(type === "feature" || type === "user_story") && (
            <div className="space-y-1.5">
              <Label>Acceptance Criteria</Label>
              <Textarea rows={4} value={form.acceptance_criteria} onChange={e => set("acceptance_criteria", e.target.value)} placeholder="Given… When… Then…" className="resize-none" />
            </div>
          )}

          {/* Parent selectors */}
          {type === "stage" && tree.phases.length > 0 && (
            <div className="space-y-1.5">
              <Label>Phase (optional)</Label>
              <Select value={form.phase_id || "none"} onValueChange={v => set("phase_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.phases.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {(type === "milestone" || type === "feature_group" || type === "feature") && tree.phases.length > 0 && (
            <div className="space-y-1.5">
              <Label>Phase (optional)</Label>
              <Select value={form.phase_id || "none"} onValueChange={v => set("phase_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.phases.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {(type === "milestone" || type === "feature_group" || type === "feature") && tree.stages.length > 0 && (
            <div className="space-y-1.5">
              <Label>Stage (optional)</Label>
              <Select value={form.stage_id || "none"} onValueChange={v => set("stage_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "feature_group" && tree.milestones.length > 0 && (
            <div className="space-y-1.5">
              <Label>Milestone (optional)</Label>
              <Select value={form.milestone_id || "none"} onValueChange={v => set("milestone_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.milestones.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "feature" && tree.featureGroups.length > 0 && (
            <div className="space-y-1.5">
              <Label>Feature Group (optional)</Label>
              <Select value={form.feature_group_id || "none"} onValueChange={v => set("feature_group_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.featureGroups.map((fg: any) => <SelectItem key={fg.id} value={fg.id}>{fg.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "user_story" && tree.features.length > 0 && (
            <div className="space-y-1.5">
              <Label>Feature (optional)</Label>
              <Select value={form.feature_id || "none"} onValueChange={v => set("feature_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.features.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.tracking_number} {f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" />Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" />End Date</Label>
              <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>
          {dateWarn && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{dateWarn}
            </div>
          )}

          {/* Effort */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><Clock className="h-3 w-3" />Estimated Hours</Label>
            <Input type="number" min="0" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value)} placeholder="e.g. 40" />
          </div>

          {/* Planning Status */}
          <div className="space-y-1.5">
            <Label>Planning Status</Label>
            <Select value={form.planning_status} onValueChange={v => set("planning_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PLANNING_STATUS_CONFIG).map(([v, c]) => (
                  <SelectItem key={v} value={v}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><User className="h-3 w-3" />Owner</Label>
            <Select value={form.owner_id || "none"} onValueChange={v => set("owner_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Unassigned —</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.user_name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dependencies — only shown when editing an existing node */}
          {isEdit && node?.id && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <DependencySection
                nodeId={node.id}
                nodeType={type}
                tree={tree}
                projectId={projectId}
              />
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()} className="flex-1">
            {save.isPending ? "Saving…" : isEdit ? `Update ${cfg.singularLabel}` : `Create ${cfg.singularLabel}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────
function DeleteConfirm({ node, type, projectId, onClose, onDeleted }: {
  node: any; type: NodeType; projectId: string; onClose: () => void; onDeleted: () => void;
}) {
  const { toast } = useToast();
  const cfg = NODE_TYPE_CONFIG[type];

  const getDeleteEndpoint = () => {
    if (type === "phase") return `/projects/${projectId}/planning/phases/${node.id}`;
    if (type === "stage") return `/projects/${projectId}/planning/stages/${node.id}`;
    if (type === "user_story") return `/projects/${projectId}/planning/user-stories/${node.id}`;
    if (type === "milestone") return `/projects/${projectId}/milestones/${node.id}`;
    if (type === "feature_group") return `/projects/${projectId}/feature-groups/${node.id}`;
    if (type === "feature") return `/projects/${projectId}/features/${node.id}`;
    return "";
  };

  const del = useMutation({
    mutationFn: () => apiClient.delete(getDeleteEndpoint()),
    onSuccess: () => {
      toast({ title: `${cfg.singularLabel} deleted` });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "feature-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "features"] });
      onDeleted();
      onClose();
    },
    onError: () => toast({ title: `Failed to delete ${cfg.singularLabel}`, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete {cfg.singularLabel}</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Delete <strong>{node.name ?? node.title}</strong>? This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tree View ──────────────────────────────────────────────────────────────
function TreeView({ tree, projectId, users, onEdit, onDelete, onAddChild }: {
  tree: PlanningTree; projectId: string; users: UserType[];
  onEdit: (node: any, type: NodeType) => void;
  onDelete: (node: any, type: NodeType) => void;
  onAddChild: (type: NodeType, defaults?: Partial<typeof EMPTY_FORM>) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const deps = tree.dependencies ?? [];

  // Flat lookup id → item (for date-based conflict checking)
  const itemById = useMemo(() => {
    const map = new Map<string, any>();
    [...tree.phases, ...tree.stages, ...tree.milestones,
      ...tree.featureGroups, ...tree.features, ...tree.stories
    ].forEach(item => map.set(item.id, item));
    return map;
  }, [tree]);

  // Per-node dep info: count of outgoing deps + first conflict message
  const depInfo = useMemo(() => {
    const info = new Map<string, { depCount: number; conflictWarning: string | null }>();
    for (const d of deps) {
      const cur = info.get(d.source_id) ?? { depCount: 0, conflictWarning: null };
      cur.depCount += 1;
      if (!cur.conflictWarning) {
        const src  = itemById.get(d.source_id);
        const tgt  = itemById.get(d.target_id);
        if (src && tgt) {
          const ss = src.start_date  ? new Date(src.start_date)  : null;
          const te = tgt.end_date    ? new Date(tgt.end_date)    : null;
          const ts = tgt.start_date  ? new Date(tgt.start_date)  : null;
          const tgtName = tgt.name ?? tgt.title ?? "predecessor";
          if (d.dependency_type === "finish_to_start" && ss && te && ss < te)
            cur.conflictWarning = `Starts before "${tgtName}" finishes (Finish→Start conflict)`;
          else if (d.dependency_type === "start_to_start" && ss && ts && ss < ts)
            cur.conflictWarning = `Starts before "${tgtName}" starts (Start→Start conflict)`;
        }
      }
      info.set(d.source_id, cur);
    }
    return info;
  }, [deps, itemById]);

  const di = (id: string) => depInfo.get(id) ?? { depCount: 0, conflictWarning: null };

  // Hierarchy helpers
  const stagesForPhase = (phaseId: string) => tree.stages.filter((s: any) => s.phase_id === phaseId);
  const milestonesForParent = (parentId: string | null, parentType: "phase" | "stage") =>
    tree.milestones.filter((m: any) => parentType === "stage" ? m.stage_id === parentId : (m.phase_id === parentId && !m.stage_id));
  const fgsForParent = (parentId: string | null, parentType: string) =>
    tree.featureGroups.filter((fg: any) =>
      parentType === "milestone" ? fg.milestone_id === parentId
      : parentType === "stage"   ? (fg.stage_id === parentId && !fg.milestone_id)
      : (fg.phase_id === parentId && !fg.stage_id && !fg.milestone_id));
  const featuresForFG  = (fgId: string) => tree.features.filter((f: any) => f.feature_group_id === fgId);
  const featuresUnassigned = () => tree.features.filter((f: any) => !f.feature_group_id);
  const storiesForFeature = (featureId: string) => tree.stories.filter((s: any) => s.feature_id === featureId);

  const orphanMilestones = tree.milestones.filter((m: any) => !m.phase_id && !m.stage_id);
  const orphanFGs = tree.featureGroups.filter((fg: any) => !fg.phase_id && !fg.stage_id && !fg.milestone_id);

  const renderStories = (featureId: string, depth: number) =>
    storiesForFeature(featureId).map((s: any) => (
      <NodeRow key={s.id} node={s} type="user_story" depth={depth} isExpanded={false} hasChildren={false}
        onToggle={() => {}} onEdit={() => onEdit(s, "user_story")} onDelete={() => onDelete(s, "user_story")}
        onAddChild={() => {}} users={users} childTypes={[]} {...di(s.id)} />
    ));

  const renderFeatures = (fgId: string, depth: number) =>
    featuresForFG(fgId).map((f: any) => {
      const children = storiesForFeature(f.id);
      const isExp = expanded.has(f.id);
      return (
        <div key={f.id}>
          <NodeRow node={f} type="feature" depth={depth} isExpanded={isExp} hasChildren={children.length > 0}
            onToggle={() => toggle(f.id)} onEdit={() => onEdit(f, "feature")} onDelete={() => onDelete(f, "feature")}
            onAddChild={ct => onAddChild(ct, { feature_id: f.id })} users={users} childTypes={["user_story"]} {...di(f.id)} />
          {isExp && renderStories(f.id, depth + 1)}
        </div>
      );
    });

  const renderFGs = (parentId: string | null, parentType: string, depth: number) =>
    fgsForParent(parentId, parentType).map((fg: any) => {
      const children = featuresForFG(fg.id);
      const isExp = expanded.has(fg.id);
      return (
        <div key={fg.id}>
          <NodeRow node={fg} type="feature_group" depth={depth} isExpanded={isExp} hasChildren={children.length > 0}
            onToggle={() => toggle(fg.id)} onEdit={() => onEdit(fg, "feature_group")} onDelete={() => onDelete(fg, "feature_group")}
            onAddChild={ct => onAddChild(ct, { feature_group_id: fg.id })} users={users} childTypes={["feature"]} {...di(fg.id)} />
          {isExp && renderFeatures(fg.id, depth + 1)}
        </div>
      );
    });

  const renderMilestones = (parentId: string | null, parentType: "phase" | "stage", depth: number) =>
    milestonesForParent(parentId, parentType).map((m: any) => {
      const fgChildren = fgsForParent(m.id, "milestone");
      const isExp = expanded.has(m.id);
      return (
        <div key={m.id}>
          <NodeRow node={m} type="milestone" depth={depth} isExpanded={isExp} hasChildren={fgChildren.length > 0}
            onToggle={() => toggle(m.id)} onEdit={() => onEdit(m, "milestone")} onDelete={() => onDelete(m, "milestone")}
            onAddChild={ct => onAddChild(ct, { milestone_id: m.id })} users={users} childTypes={["feature_group", "feature"]} {...di(m.id)} />
          {isExp && renderFGs(m.id, "milestone", depth + 1)}
        </div>
      );
    });

  const renderStages = (phaseId: string, depth: number) =>
    stagesForPhase(phaseId).map((s: any) => {
      const msChildren = milestonesForParent(s.id, "stage");
      const fgChildren = fgsForParent(s.id, "stage");
      const hasChildren = msChildren.length + fgChildren.length > 0;
      const isExp = expanded.has(s.id);
      return (
        <div key={s.id}>
          <NodeRow node={s} type="stage" depth={depth} isExpanded={isExp} hasChildren={hasChildren}
            onToggle={() => toggle(s.id)} onEdit={() => onEdit(s, "stage")} onDelete={() => onDelete(s, "stage")}
            onAddChild={ct => onAddChild(ct, { stage_id: s.id })} users={users}
            childTypes={["milestone", "feature_group", "feature"]} {...di(s.id)} />
          {isExp && (
            <>
              {renderMilestones(s.id, "stage", depth + 1)}
              {renderFGs(s.id, "stage", depth + 1)}
            </>
          )}
        </div>
      );
    });

  return (
    <div className="space-y-0.5">
      {/* Phases → Stages → Milestones → FGs → Features → Stories */}
      {tree.phases.map((p: any) => {
        const stageChildren = stagesForPhase(p.id);
        const msChildren = milestonesForParent(p.id, "phase");
        const fgChildren = fgsForParent(p.id, "phase");
        const hasChildren = stageChildren.length + msChildren.length + fgChildren.length > 0;
        const isExp = expanded.has(p.id);
        return (
          <div key={p.id}>
            <NodeRow node={p} type="phase" depth={0} isExpanded={isExp} hasChildren={hasChildren}
              onToggle={() => toggle(p.id)} onEdit={() => onEdit(p, "phase")} onDelete={() => onDelete(p, "phase")}
              onAddChild={ct => onAddChild(ct, { phase_id: p.id })} users={users}
              childTypes={["stage", "milestone", "feature_group", "feature"]} {...di(p.id)} />
            {isExp && (
              <>
                {renderStages(p.id, 1)}
                {renderMilestones(p.id, "phase", 1)}
                {renderFGs(p.id, "phase", 1)}
              </>
            )}
          </div>
        );
      })}

      {/* Orphan Stages */}
      {tree.stages.filter((s: any) => !s.phase_id).map((s: any) => {
        const msChildren = milestonesForParent(s.id, "stage");
        const fgChildren = fgsForParent(s.id, "stage");
        const hasChildren = msChildren.length + fgChildren.length > 0;
        const isExp = expanded.has(s.id);
        return (
          <div key={s.id}>
            <NodeRow node={s} type="stage" depth={0} isExpanded={isExp} hasChildren={hasChildren}
              onToggle={() => toggle(s.id)} onEdit={() => onEdit(s, "stage")} onDelete={() => onDelete(s, "stage")}
              onAddChild={ct => onAddChild(ct, { stage_id: s.id })} users={users}
              childTypes={["milestone", "feature_group", "feature"]} {...di(s.id)} />
            {isExp && (
              <>
                {renderMilestones(s.id, "stage", 1)}
                {renderFGs(s.id, "stage", 1)}
              </>
            )}
          </div>
        );
      })}

      {/* Orphan Milestones */}
      {orphanMilestones.map((m: any) => {
        const fgChildren = fgsForParent(m.id, "milestone");
        const isExp = expanded.has(m.id);
        return (
          <div key={m.id}>
            <NodeRow node={m} type="milestone" depth={0} isExpanded={isExp} hasChildren={fgChildren.length > 0}
              onToggle={() => toggle(m.id)} onEdit={() => onEdit(m, "milestone")} onDelete={() => onDelete(m, "milestone")}
              onAddChild={ct => onAddChild(ct, { milestone_id: m.id })} users={users} childTypes={["feature_group", "feature"]} {...di(m.id)} />
            {isExp && renderFGs(m.id, "milestone", 1)}
          </div>
        );
      })}

      {/* Orphan FGs */}
      {orphanFGs.map((fg: any) => {
        const children = featuresForFG(fg.id);
        const isExp = expanded.has(fg.id);
        return (
          <div key={fg.id}>
            <NodeRow node={fg} type="feature_group" depth={0} isExpanded={isExp} hasChildren={children.length > 0}
              onToggle={() => toggle(fg.id)} onEdit={() => onEdit(fg, "feature_group")} onDelete={() => onDelete(fg, "feature_group")}
              onAddChild={ct => onAddChild(ct, { feature_group_id: fg.id })} users={users} childTypes={["feature"]} {...di(fg.id)} />
            {isExp && renderFeatures(fg.id, 1)}
          </div>
        );
      })}

      {/* Unattached Features */}
      {featuresUnassigned().map((f: any) => {
        const children = storiesForFeature(f.id);
        const isExp = expanded.has(f.id);
        return (
          <div key={f.id}>
            <NodeRow node={f} type="feature" depth={0} isExpanded={isExp} hasChildren={children.length > 0}
              onToggle={() => toggle(f.id)} onEdit={() => onEdit(f, "feature")} onDelete={() => onDelete(f, "feature")}
              onAddChild={ct => onAddChild(ct, { feature_id: f.id })} users={users} childTypes={["user_story"]} {...di(f.id)} />
            {isExp && renderStories(f.id, 1)}
          </div>
        );
      })}

      {/* Empty state */}
      {tree.phases.length === 0 && tree.stages.length === 0 && tree.milestones.length === 0 &&
        tree.featureGroups.length === 0 && tree.features.length === 0 && tree.stories.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No planning items yet</p>
          <p className="text-xs mt-1 max-w-xs mx-auto">Start by adding a Phase, Milestone, or Feature using the + Add button above.</p>
        </div>
      )}
    </div>
  );
}

// ── Timeline / Gantt View ──────────────────────────────────────────────────
const ROW_H = 28;        // h-6 (24px bar) + space-y-1 (4px gap)
const BAR_CY = 12;       // top-1 (4px) + h-4/2 (8px) centre of bar

function TimelineView({ tree }: { tree: PlanningTree }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    setGridWidth(el.clientWidth);
    const obs = new ResizeObserver(entries => setGridWidth(entries[0].contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const allItems = useMemo(() => {
    const items: { id: string; name: string; type: NodeType; start_date?: string | null; end_date?: string | null; planning_status?: string }[] = [
      ...tree.phases.map((p: any) => ({ ...p, type: "phase" as NodeType })),
      ...tree.stages.map((s: any) => ({ ...s, type: "stage" as NodeType })),
      ...tree.milestones.map((m: any) => ({ ...m, type: "milestone" as NodeType })),
      ...tree.featureGroups.map((fg: any) => ({ ...fg, type: "feature_group" as NodeType })),
      ...tree.features.map((f: any) => ({ ...f, type: "feature" as NodeType })),
      ...tree.stories.map((s: any) => ({ ...s, name: s.title, type: "user_story" as NodeType })),
    ].filter(i => i.start_date || i.end_date);
    return items;
  }, [tree]);

  const itemIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    allItems.forEach((item, i) => m.set(item.id, i));
    return m;
  }, [allItems]);

  if (allItems.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No dated items yet</p>
        <p className="text-xs mt-1">Add start and end dates to planning items to see them on the timeline.</p>
      </div>
    );
  }

  // Timeline bounds
  const allDates = allItems.flatMap(i => [i.start_date, i.end_date].filter(Boolean) as string[]);
  const minDate  = new Date(Math.min(...allDates.map(d => new Date(d).getTime())));
  const maxDate  = new Date(Math.max(...allDates.map(d => new Date(d).getTime())));
  const totalDays = Math.max(1, differenceInDays(maxDate, minDate));

  const pct = (d: Date) => (differenceInDays(d, minDate) / totalDays) * 100;

  const getBarStyle = (item: typeof allItems[number]) => {
    if (!item.start_date && !item.end_date) return null;
    const start = item.start_date ? new Date(item.start_date) : minDate;
    const end   = item.end_date   ? new Date(item.end_date)   : start;
    return { left: `${pct(start)}%`, width: `${Math.max(0.5, pct(end) - pct(start))}%` };
  };

  const COLORS: Record<NodeType, string> = {
    phase: "bg-violet-400", stage: "bg-blue-400", milestone: "bg-orange-400",
    feature_group: "bg-teal-400", feature: "bg-indigo-400", user_story: "bg-pink-400",
  };
  const SVG_COLORS: Record<NodeType, string> = {
    phase: "#a78bfa", stage: "#60a5fa", milestone: "#fb923c",
    feature_group: "#2dd4bf", feature: "#818cf8", user_story: "#f472b6",
  };

  // Compute SVG arrows for each dependency whose both ends are in allItems
  const deps = tree.dependencies ?? [];
  type Arrow = { x1: number; y1: number; x2: number; y2: number; conflict: boolean; srcType: NodeType };
  const arrows: Arrow[] = [];
  if (gridWidth > 0) {
    for (const d of deps) {
      const srcIdx = itemIndexMap.get(d.source_id);
      const tgtIdx = itemIndexMap.get(d.target_id);
      if (srcIdx === undefined || tgtIdx === undefined) continue;
      const src = allItems[srcIdx];
      const tgt = allItems[tgtIdx];

      const srcStart = src.start_date ? new Date(src.start_date) : null;
      const tgtEnd   = tgt.end_date   ? new Date(tgt.end_date)   : null;
      const tgtStart = tgt.start_date ? new Date(tgt.start_date) : null;

      // x positions as pixel values within the grid
      let x1: number, x2: number;
      if (d.dependency_type === "finish_to_start") {
        if (!tgtEnd || !srcStart) continue;
        x1 = (pct(tgtEnd)   / 100) * gridWidth;
        x2 = (pct(srcStart) / 100) * gridWidth;
      } else {
        if (!tgtStart || !srcStart) continue;
        x1 = (pct(tgtStart) / 100) * gridWidth;
        x2 = (pct(srcStart) / 100) * gridWidth;
      }
      const y1 = tgtIdx * ROW_H + BAR_CY;
      const y2 = srcIdx * ROW_H + BAR_CY;

      const conflict = d.dependency_type === "finish_to_start"
        ? !!(srcStart && tgtEnd && srcStart < tgtEnd)
        : !!(srcStart && tgtStart && srcStart < tgtStart);

      arrows.push({ x1, y1, x2, y2, conflict, srcType: src.type });
    }
  }

  const svgH = allItems.length * ROW_H;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="flex items-center text-[10px] text-gray-400 mb-2 gap-2">
          <div className="w-52 shrink-0">Item</div>
          <div className="flex-1 relative h-4">
            <span className="absolute left-0">{format(minDate, "dd MMM yyyy")}</span>
            <span className="absolute right-0">{format(maxDate, "dd MMM yyyy")}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Label column */}
          <div className="w-52 shrink-0 space-y-1">
            {allItems.map(item => {
              const cfg = NODE_TYPE_CONFIG[item.type];
              const Icon = cfg.icon;
              return (
                <div key={item.id} className="h-6 flex items-center gap-1.5 min-w-0">
                  <Icon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                </div>
              );
            })}
          </div>

          {/* Bar grid with SVG overlay */}
          <div className="flex-1 relative" ref={gridRef} style={{ height: `${svgH}px` }}>
            {/* Row backgrounds */}
            <div className="absolute inset-0 space-y-1">
              {allItems.map(item => (
                <div key={item.id} className="h-6 bg-gray-50 dark:bg-gray-800/50 rounded" />
              ))}
            </div>

            {/* Bars */}
            <div className="absolute inset-0 space-y-1">
              {allItems.map(item => {
                const barStyle = getBarStyle(item);
                return (
                  <div key={item.id} className="h-6 relative">
                    {barStyle && (
                      <div
                        className={`absolute top-1 h-4 rounded ${COLORS[item.type]} opacity-80`}
                        style={barStyle}
                        title={`${item.name}: ${item.start_date ? format(new Date(item.start_date), "dd MMM") : "?"} → ${item.end_date ? format(new Date(item.end_date), "dd MMM") : "?"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* SVG dependency arrows */}
            {gridWidth > 0 && arrows.length > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none overflow-visible"
                width={gridWidth}
                height={svgH}
              >
                <defs>
                  <marker id="arr-ok"  viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0,1 L6,4 L0,7 Z" fill="#6366f1" />
                  </marker>
                  <marker id="arr-bad" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0,1 L6,4 L0,7 Z" fill="#f59e0b" />
                  </marker>
                </defs>
                {arrows.map((a, i) => {
                  const stroke = a.conflict ? "#f59e0b" : SVG_COLORS[a.srcType] ?? "#6366f1";
                  const marker = a.conflict ? "url(#arr-bad)" : "url(#arr-ok)";
                  // Elbow connector: x1,y1 → midX,y1 → midX,y2 → x2,y2
                  const midX = (a.x1 + a.x2) / 2;
                  const pathD = `M ${a.x1} ${a.y1} L ${midX} ${a.y1} L ${midX} ${a.y2} L ${a.x2} ${a.y2}`;
                  return (
                    <path
                      key={i}
                      d={pathD}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={a.conflict ? 1.5 : 1}
                      strokeDasharray={a.conflict ? "4 2" : undefined}
                      markerEnd={marker}
                      opacity={0.75}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Legend */}
        {deps.length > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-px bg-indigo-400" />Dependency
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-px bg-amber-400" style={{ backgroundImage: "repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 4px,transparent 4px,transparent 6px)" }} />Conflict
            </span>
            <span className="text-gray-300 dark:text-gray-600">Arrows: predecessor → dependent</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Planning Workspace ────────────────────────────────────────────────
export default function PlanningWorkspace({ projectId, users }: { projectId: string; users: UserType[] }) {
  const { toast } = useToast();
  const [view, setView] = useState<"tree" | "timeline">("tree");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [proposal, setProposal] = useState<{ proposal: any; items: any[] } | null>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<NodeType>("phase");
  const [sheetNode, setSheetNode] = useState<any | null>(null);
  const [sheetDefaults, setSheetDefaults] = useState<Partial<typeof EMPTY_FORM>>({});

  // Delete confirm state
  const [deleteNode, setDeleteNode] = useState<{ node: any; type: NodeType } | null>(null);

  // Add node button
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const { data: tree, isLoading, refetch: refetchTree } = useQuery<PlanningTree>({
    queryKey: ["/api/projects", projectId, "planning/tree"],
    queryFn: () => apiClient.get(`/projects/${projectId}/planning/tree`),
    enabled: !!projectId,
  });

  const { data: coverage } = useQuery<CoverageData>({
    queryKey: ["/api/projects", projectId, "planning/coverage"],
    queryFn: () => apiClient.get(`/projects/${projectId}/planning/coverage`),
    enabled: !!projectId,
  });

  const emptyTree: PlanningTree = { phases: [], stages: [], milestones: [], featureGroups: [], features: [], stories: [], dependencies: [], config: null };
  const t = tree ?? emptyTree;

  const openAdd = (type: NodeType, defaults?: Partial<typeof EMPTY_FORM>) => {
    setSheetType(type); setSheetNode(null); setSheetDefaults(defaults ?? {}); setSheetOpen(true);
  };
  const openEdit = (node: any, type: NodeType) => {
    setSheetType(type); setSheetNode(node); setSheetDefaults({}); setSheetOpen(true);
  };
  const openDelete = (node: any, type: NodeType) => setDeleteNode({ node, type });

  const totalItems = (coverage?.counts ?? {});
  const methodology = t.config?.methodology ?? "manual";
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const userStr = localStorage.getItem("user");
      const userId = userStr ? JSON.parse(userStr)?.id ?? "" : "";
      const resp = await fetch(`/api/projects/${projectId}/planning/export/pdf`, {
        headers: { "x-user-id": userId },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({ title: "Export failed", description: (err as any).error ?? "Unknown error", variant: "destructive" });
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = resp.headers.get("content-disposition") ?? "";
      const fnMatch = cd.match(/filename="([^"]+)"/);
      a.download = fnMatch ? fnMatch[1] : "project-plan.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF exported" });
    } catch {
      toast({ title: "Export failed", description: "Could not generate PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top summary bar ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-5 py-3 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Methodology */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <BarChart2 className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300">{METHODOLOGY_LABELS[methodology] ?? "Manual"}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span>Methodology</span>
          </div>

          {/* Coverage */}
          <CoverageBar coverage={coverage} />

          {/* Counts */}
          {coverage && (
            <div className="hidden lg:flex items-center gap-3 text-xs text-gray-400 divid divide-x divide-gray-100 dark:divide-gray-800">
              {[
                { label: "Phases", val: totalItems.phases },
                { label: "Milestones", val: totalItems.milestones },
                { label: "Features", val: totalItems.features },
                { label: "User Stories", val: totalItems.user_stories },
              ].filter(i => (i.val ?? 0) > 0).map(i => (
                <span key={i.label} className="px-2 first:pl-0">
                  <strong className="text-gray-700 dark:text-gray-300">{i.val}</strong> {i.label}
                </span>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* View switcher */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {(["tree", "timeline"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  view === v ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {v === "tree" ? "Tree" : "Timeline"}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="relative">
            <Button size="sm" className="h-8 text-xs" onClick={() => setAddMenuOpen(v => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                  {(["phase", "stage", "milestone", "feature_group", "feature", "user_story"] as NodeType[]).map(nt => {
                    const cfg = NODE_TYPE_CONFIG[nt];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={nt}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                        onClick={() => { openAdd(nt); setAddMenuOpen(false); }}
                      >
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />{cfg.singularLabel}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1 text-violet-500" />AI Plan
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportPdf} disabled={exporting} title="Export project plan as PDF">
            {exporting
              ? <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />Exporting…</>
              : <><FileDown className="h-3.5 w-3.5 mr-1" />Export PDF</>}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Planning Coverage detail row */}
        {coverage && coverage.total_items > 0 && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 dark:border-gray-800">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Coverage</span>
            {Object.entries(PLANNING_STATUS_CONFIG).map(([k, cfg]) => {
              const count = coverage.by_status[k] ?? 0;
              if (count === 0) return null;
              return (
                <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>
                  {count} {cfg.label}
                </span>
              );
            })}
            <span className="text-[10px] text-gray-300 dark:text-gray-600 italic">Planning Coverage ≠ Execution Progress</span>
          </div>
        )}
      </div>

      {/* ── AI Proposal Review Banner ────────────────────────────────────── */}
      {proposal && (
        <div className="shrink-0 bg-violet-50 dark:bg-violet-950/20 border-b border-violet-200 dark:border-violet-800 px-5 py-4">
          <AiProposalReview
            proposal={proposal.proposal}
            items={proposal.items}
            projectId={projectId}
            onClose={() => setProposal(null)}
            onCommitted={() => { setProposal(null); refetchTree(); }}
          />
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-4 lg:px-5 py-4">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-9 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
          </div>
        ) : view === "tree" ? (
          <TreeView
            tree={t} projectId={projectId} users={users}
            onEdit={openEdit} onDelete={openDelete}
            onAddChild={(type, defaults) => openAdd(type, defaults)}
          />
        ) : (
          <TimelineView tree={t} />
        )}
      </div>

      {/* ── Dialogs & Sheets ─────────────────────────────────────────────── */}
      <NodeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        type={sheetType}
        node={sheetNode}
        projectId={projectId}
        tree={t}
        users={users}
        onSaved={() => refetchTree()}
      />

      {deleteNode && (
        <DeleteConfirm
          node={deleteNode.node}
          type={deleteNode.type}
          projectId={projectId}
          onClose={() => setDeleteNode(null)}
          onDeleted={() => refetchTree()}
        />
      )}

      <PlanningSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        projectId={projectId}
        config={t.config}
        onSaved={() => refetchTree()}
      />

      <AiPlanningPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        projectId={projectId}
        tree={t}
        onProposalReady={data => { setProposal(data); setAiOpen(false); }}
      />
    </div>
  );
}
