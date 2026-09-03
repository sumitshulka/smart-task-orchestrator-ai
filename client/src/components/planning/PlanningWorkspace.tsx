import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiClient } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Settings2, FileDown, Sparkles, ChevronDown, ChevronRight, ChevronUp,
  Pencil, Trash2, MoreHorizontal, Calendar, Clock, User, Flag,
  Layers, FolderOpen, BookOpen, CheckSquare, GitBranch, Target,
  BarChart2, AlertTriangle, X, Check, RefreshCw, Network,
  Link2, ArrowRight, FileText, Upload,
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

// ── Phase-rank helper (client-side mirror of server logic) ─────────────────
function buildPhaseRankFn(tree: PlanningTree) {
  const phaseMap  = new Map(tree.phases.map((p: any) => [p.id, p]));
  const stageMap  = new Map(tree.stages.map((s: any) => [s.id, s]));
  const msMap     = new Map(tree.milestones.map((m: any) => [m.id, m]));
  const fgMap     = new Map(tree.featureGroups.map((fg: any) => [fg.id, fg]));
  const featMap   = new Map(tree.features.map((f: any) => [f.id, f]));
  const storyMap  = new Map(tree.stories.map((s: any) => [s.id, s]));

  function rank(id: string, type: string): number | null {
    if (type === "phase") return (phaseMap.get(id) as any)?.sort_order ?? null;
    if (type === "stage") {
      const s = stageMap.get(id) as any;
      if (!s?.phase_id) return null;
      return (phaseMap.get(s.phase_id) as any)?.sort_order ?? null;
    }
    if (type === "milestone") {
      const m = msMap.get(id) as any;
      if (!m) return null;
      if (m.phase_id) return (phaseMap.get(m.phase_id) as any)?.sort_order ?? null;
      if (m.stage_id) { const st = stageMap.get(m.stage_id) as any; return st?.phase_id ? (phaseMap.get(st.phase_id) as any)?.sort_order ?? null : null; }
      return null;
    }
    if (type === "feature_group") {
      const fg = fgMap.get(id) as any;
      if (!fg) return null;
      if (fg.milestone_id) return rank(fg.milestone_id, "milestone");
      if (fg.stage_id)     return rank(fg.stage_id, "stage");
      if (fg.phase_id)     return (phaseMap.get(fg.phase_id) as any)?.sort_order ?? null;
      return null;
    }
    if (type === "feature") {
      const f = featMap.get(id) as any;
      if (!f) return null;
      if (f.feature_group_id) return rank(f.feature_group_id, "feature_group");
      if (f.stage_id)         return rank(f.stage_id, "stage");
      if (f.phase_id)         return (phaseMap.get(f.phase_id) as any)?.sort_order ?? null;
      return null;
    }
    if (type === "user_story") {
      const s = storyMap.get(id) as any;
      return s?.feature_id ? rank(s.feature_id, "feature") : null;
    }
    return null;
  }

  // Phase name for display
  function phaseName(id: string, type: string): string | null {
    const r = rank(id, type);
    if (r === null) return null;
    const ph = (tree.phases as any[]).find((p: any) => p.sort_order === r);
    return ph?.name ?? null;
  }

  return { rank, phaseName };
}

// ── Date conflict check (client-side) ──────────────────────────────────────
function detectDateConflict(
  srcItem: any, tgtItem: any, depType: string,
): string | null {
  const srcStart = srcItem?.start_date ? new Date(srcItem.start_date) : null;
  const srcEnd   = srcItem?.end_date   ? new Date(srcItem.end_date)   : null;
  const tgtStart = tgtItem?.start_date ? new Date(tgtItem.start_date) : null;
  const tgtEnd   = tgtItem?.end_date   ? new Date(tgtItem.end_date)   : null;
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (depType === "finish_to_start" && srcStart && tgtEnd && srcStart < tgtEnd)
    return `Starts ${fmt(srcStart)} before predecessor finishes ${fmt(tgtEnd)}`;
  if (depType === "start_to_start" && srcStart && tgtStart && srcStart < tgtStart)
    return `Starts ${fmt(srcStart)} before predecessor starts ${fmt(tgtStart)}`;
  if (depType === "finish_to_finish" && srcEnd && tgtEnd && srcEnd < tgtEnd)
    return `Finishes ${fmt(srcEnd)} before predecessor finishes ${fmt(tgtEnd)}`;
  return null;
}

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

function checkDepConflict(dep: any, sourceNode: any, targetNode: any): string | null {
  if (!targetNode) return null;
  if (dep.dependency_type === "finish_to_start") {
    if (sourceNode.start_date && targetNode.end_date &&
        new Date(sourceNode.start_date) < new Date(targetNode.end_date)) {
      return `starts before predecessor ends (${format(new Date(targetNode.end_date), "dd MMM")})`;
    }
  } else if (dep.dependency_type === "start_to_start") {
    if (sourceNode.start_date && targetNode.start_date &&
        new Date(sourceNode.start_date) < new Date(targetNode.start_date)) {
      return `starts before predecessor starts (${format(new Date(targetNode.start_date), "dd MMM")})`;
    }
  }
  return null;
}
const TYPE_TO_ENTITY: Record<NodeType, string> = {
  phase: "phase", stage: "stage", milestone: "milestone",
  feature_group: "feature_group", feature: "feature", user_story: "user_story",
};

function NodeRow({
  node, type, depth, isExpanded, hasChildren,
  onToggle, onEdit, onDelete, onAddChild, users,
  childTypes, nodeDeps, itemsById, projectId, parentNode,
}: {
  node: any; type: NodeType; depth: number; isExpanded: boolean; hasChildren: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onAddChild: (childType: NodeType) => void;
  users: UserType[];
  childTypes: NodeType[];
  nodeDeps?: any[];
  itemsById?: Map<string, any>;
  projectId: string;
  parentNode?: any;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [qOpen, setQOpen] = useState(false);
  const [qDraft, setQDraft] = useState({ start_date: "", end_date: "", estimated_hours: "", owner_id: "" });
  const [qError, setQError] = useState<string | null>(null);
  const [qSaving, setQSaving] = useState(false);

  const cfg = NODE_TYPE_CONFIG[type];
  const Icon = cfg.icon;
  const owner = node.owner_id ? users.find((u: any) => u.id === node.owner_id) : null;

  // ── Dep conflict computation ──────────────────────────────────────────────
  const deps = nodeDeps ?? [];
  const depConflicts = deps.map(dep => {
    const target = itemsById?.get(dep.target_id);
    return { dep, target, conflict: checkDepConflict(dep, node, target) };
  });
  const hasDepConflict = depConflicts.some(c => c.conflict);

  // ── Quick-edit helpers ────────────────────────────────────────────────────
  const fmtDisplay = (d: string | null | undefined) =>
    d ? format(new Date(d), "dd MMM") : null;
  const fmtIso = (d: string | null | undefined) =>
    d ? format(new Date(d), "yyyy-MM-dd") : "";

  const openQuickEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQDraft({
      start_date: fmtIso(node.start_date),
      end_date: fmtIso(node.end_date),
      estimated_hours: node.estimated_hours?.toString() ?? "",
      owner_id: node.owner_id ?? "",
    });
    setQError(null);
    setQOpen(true);
  };

  const saveQuickEdit = async () => {
    const { start_date, end_date, estimated_hours, owner_id } = qDraft;
    if (start_date && end_date && end_date < start_date) {
      setQError("End date cannot be before start date.");
      return;
    }
    if (parentNode?.start_date && start_date && start_date < fmtIso(parentNode.start_date)) {
      setQError(`Start date cannot be before parent's start (${fmtDisplay(parentNode.start_date)}).`);
      return;
    }
    if (parentNode?.end_date && end_date && end_date > fmtIso(parentNode.end_date)) {
      setQError(`End date cannot be after parent's end (${fmtDisplay(parentNode.end_date)}).`);
      return;
    }
    setQSaving(true);
    try {
      const userStr = localStorage.getItem("user");
      const userId = userStr ? JSON.parse(userStr)?.id ?? "" : "";
      const resp = await fetch(
        `/api/projects/${projectId}/planning/quick-edit/${TYPE_TO_ENTITY[type]}/${node.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({
            start_date: start_date || null,
            end_date: end_date || null,
            estimated_hours: estimated_hours ? parseInt(estimated_hours) : null,
            owner_id: owner_id || null,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setQError((err as any).error ?? "Failed to save");
        return;
      }
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
      setQOpen(false);
      toast({ title: "Saved" });
    } catch {
      setQError("Failed to save — please try again.");
    } finally {
      setQSaving(false);
    }
  };

  const setD = (k: string, v: string) => { setQDraft(d => ({ ...d, [k]: v })); setQError(null); };
  const parentStartIso = parentNode?.start_date ? fmtIso(parentNode.start_date) : undefined;
  const parentEndIso   = parentNode?.end_date   ? fmtIso(parentNode.end_date)   : undefined;

  return (
    <div className={`rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${hasDepConflict ? "ring-1 ring-amber-300 dark:ring-amber-700 bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
      <div
        className="group flex items-center gap-2 py-1.5 px-2 min-w-0"
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

        {/* Dep conflict pill */}
        {hasDepConflict && (
          <span
            aria-label="Date conflict detected"
            title="Date conflict detected"
            className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 cursor-help"
          >
            <AlertTriangle className="h-2.5 w-2.5" />Conflict
          </span>
        )}

        {/* Dep count badge (no conflict) */}
        {deps.length > 0 && !hasDepConflict && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
            <Link2 className="h-2.5 w-2.5" />{deps.length}
          </span>
        )}

        {/* ── Inline quick-edit metadata ─────────────────────────────────── */}
        <div className="relative shrink-0">
          <button
            onClick={openQuickEdit}
            className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group/qe"
            title="Click to set dates, effort & owner"
          >
            {node.start_date || node.end_date ? (
              <span className="text-[11px] text-gray-500 tabular-nums flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5 text-gray-400" />
                {fmtDisplay(node.start_date) ?? "?"} → {fmtDisplay(node.end_date) ?? "?"}
                {node.start_date && node.end_date && (
                  <span className="text-gray-300 ml-0.5">
                    ({differenceInDays(new Date(node.end_date), new Date(node.start_date))}d)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[11px] text-gray-300 dark:text-gray-600 italic flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />Set dates
              </span>
            )}
            {node.estimated_hours ? (
              <span className="text-[11px] text-gray-400 flex items-center gap-0.5 tabular-nums">
                <Clock className="h-2.5 w-2.5" />{node.estimated_hours}h
              </span>
            ) : (
              <span className="text-[11px] text-gray-300 dark:text-gray-600 italic flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />Set hrs
              </span>
            )}
            {owner ? (
              <span className="text-[11px] text-gray-400 flex items-center gap-0.5 max-w-[72px] truncate">
                <User className="h-2.5 w-2.5 shrink-0" />{owner.user_name ?? owner.email}
              </span>
            ) : (
              <span className="text-[11px] text-gray-300 dark:text-gray-600 italic flex items-center gap-0.5">
                <User className="h-2.5 w-2.5" />Owner
              </span>
            )}
            <Pencil className="h-2.5 w-2.5 text-gray-300 group-hover/qe:text-gray-400 transition-colors" />
          </button>

          {/* Quick-edit popover */}
          {qOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setQOpen(false)} />
              <div
                className="absolute right-0 top-8 z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-72"
                onClick={e => e.stopPropagation()}
              >
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Quick Edit — {cfg.singularLabel}
                </p>
                {parentNode && (parentNode.start_date || parentNode.end_date) && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1 mb-2">
                    Parent window: {fmtDisplay(parentNode.start_date) ?? "?"} → {fmtDisplay(parentNode.end_date) ?? "?"}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 block mb-0.5">Start date</label>
                    <input type="date"
                      className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={qDraft.start_date} min={parentStartIso} max={parentEndIso}
                      onChange={e => setD("start_date", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 block mb-0.5">End date</label>
                    <input type="date"
                      className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={qDraft.end_date} min={qDraft.start_date || parentStartIso} max={parentEndIso}
                      onChange={e => setD("end_date", e.target.value)} />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-[10px] font-medium text-gray-500 block mb-0.5">Estimated hours</label>
                  <input type="number" min="0" step="1" placeholder="—"
                    className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={qDraft.estimated_hours} onChange={e => setD("estimated_hours", e.target.value)} />
                </div>
                <div className="mt-2">
                  <label className="text-[10px] font-medium text-gray-500 block mb-0.5">Owner</label>
                  <select
                    className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={qDraft.owner_id} onChange={e => setD("owner_id", e.target.value)}
                  >
                    <option value="">— Unassigned —</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.user_name ?? u.email}</option>
                    ))}
                  </select>
                </div>
                {qError && (
                  <p className="mt-2 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded px-2 py-1">{qError}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 h-7 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-1 disabled:opacity-60"
                    onClick={saveQuickEdit} disabled={qSaving}
                  >
                    {qSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Save
                  </button>
                  <button
                    className="flex-1 h-7 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => setQOpen(false)} disabled={qSaving}
                  >Cancel</button>
                  {(node.start_date || node.end_date || node.estimated_hours || node.owner_id) && (
                    <button
                      className="h-7 px-2 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => setQDraft({ start_date: "", end_date: "", estimated_hours: "", owner_id: "" })}
                      disabled={qSaving} title="Clear all fields"
                    ><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
            </>
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

      {/* Dependency detail badges */}
      {depConflicts.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 pb-1"
          style={{ paddingLeft: `${(depth * 20) + 34}px` }}
        >
          {depConflicts.map(({ dep, target, conflict }) => (
            <span
              key={dep.id}
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                conflict
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              <Link2 className="h-2.5 w-2.5 shrink-0" />
              {dep.dependency_type === "finish_to_start" ? "FS" : "SS"}
              {" → "}
              {target ? (target.name ?? target.title) : dep.target_id.slice(0, 8)}
              {conflict && (
                <span className="ml-0.5 text-amber-600 dark:text-amber-400">⚠ {conflict}</span>
              )}
            </span>
          ))}
        </div>
      )}
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
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isSupportedType =
      file.name.toLowerCase().endsWith(".pdf") ||
      file.name.toLowerCase().endsWith(".docx");
    if (!isSupportedType) {
      toast({ title: "Unsupported document", description: "Upload a PDF or DOCX file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Document is too large", description: "Upload a document smaller than 10 MB.", variant: "destructive" });
      return;
    }
    setDocumentFile(file);
  };

  const propose = async () => {
    if (!prompt.trim()) { toast({ title: "Please enter a prompt", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const request = new FormData();
      request.append("scope_type", scopeType);
      request.append("scope_id", scopeId || "");
      request.append("prompt", prompt.trim());
      if (documentFile) request.append("document", documentFile);

      const data = await apiClient.post(`/projects/${projectId}/planning/ai-propose`, request);
      onProposalReady(data);
      setDocumentFile(null);
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
      <SheetContent className="w-full flex flex-col sm:max-w-2xl" side="right">
        <SheetHeader className="shrink-0 border-b border-gray-100 pb-3 pr-8 dark:border-gray-800">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-500" />AI Planning
          </SheetTitle>
          <SheetDescription className="text-xs">
            Give the AI a planning goal and it will prepare a proposal for your review.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 py-3 pr-1 [&_label]:text-xs">
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
            AI will analyze your project and propose planning items. You review and approve before anything is created.
          </div>
          <div className="space-y-1">
            <Label className="font-medium">Planning Scope</Label>
            <Select
              value={scopeType === "project" ? "project" : `${scopeType}:${scopeId}`}
              onValueChange={val => {
                if (val === "project") { setScopeType("project"); setScopeId(""); }
                else { const [t, ...id] = val.split(":"); setScopeType(t); setScopeId(id.join(":")); }
              }}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {scopeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-medium">Your Instruction</Label>
            <Textarea
              rows={4}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`e.g. "Break this feature into user stories with acceptance criteria" or "Plan Phase 2 - Development with realistic milestones"`}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-medium">
              <FileText className="h-3.5 w-3.5 text-violet-500" />Reference Document
              <span className="font-normal text-gray-400">(optional)</span>
            </Label>
            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleDocumentChange}
              className="hidden"
            />
            {documentFile ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/60">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-violet-500" />
                  <span className="min-w-0 truncate">{documentFile.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {(documentFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDocumentFile(null)}
                  className="h-7 shrink-0 px-2 text-gray-500 hover:text-red-500"
                  aria-label="Remove reference document"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 transition-colors hover:border-violet-400 hover:bg-violet-50/60 hover:text-violet-600 dark:border-gray-700 dark:hover:border-violet-700 dark:hover:bg-violet-950/20 dark:hover:text-violet-300"
              >
                <Upload className="h-4 w-4" />
                Upload PDF or DOCX
              </button>
            )}
            <p className="text-[11px] text-gray-400">The AI will read the document as reference material. Maximum size: 10 MB.</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">AI Assistance Rules</p>
            <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5 list-disc list-inside">
              <li>AI proposes — you approve</li>
              <li>Existing items are never duplicated</li>
              <li>PM remains the final authority</li>
            </ul>
          </div>
        </div>
        <SheetFooter className="shrink-0 border-t border-gray-100 pt-3 dark:border-gray-800">
          <Button variant="outline" onClick={onClose} className="h-9 flex-1 text-sm">Cancel</Button>
          <Button onClick={propose} disabled={loading} className="h-9 flex-1 bg-violet-600 text-sm text-white hover:bg-violet-700">
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

  const buildFormFromNode = (n: any) => ({
    ...EMPTY_FORM,
    name: n?.name ?? n?.title ?? "",
    title: n?.title ?? "",
    description: n?.description ?? "",
    acceptance_criteria: n?.acceptance_criteria ?? "",
    start_date: n?.start_date ? format(new Date(n.start_date), "yyyy-MM-dd") : "",
    end_date: n?.end_date ? format(new Date(n.end_date), "yyyy-MM-dd") : "",
    estimated_hours: n?.estimated_hours?.toString() ?? "",
    planning_status: (n?.planning_status ?? "high_level") as PlanningStatus,
    owner_id: n?.owner_id ?? "",
    phase_id: n?.phase_id ?? "",
    stage_id: n?.stage_id ?? "",
    milestone_id: n?.milestone_id ?? "",
    feature_group_id: n?.feature_group_id ?? "",
    feature_id: n?.feature_id ?? "",
    status: n?.status ?? "draft",
    date_mode: n?.date_mode ?? "manual",
  });

  const [form, setForm] = useState(() => buildFormFromNode(node));

  // Re-populate whenever the sheet opens for a different node or type
  useEffect(() => {
    setForm(buildFormFromNode(node));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, type, open]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  // ── Dependency management state ──────────────────────────────────────────
  const [depsToAdd, setDepsToAdd] = useState<Array<{ target_id: string; target_type: string; dependency_type: string }>>([]);
  const [depsToRemove, setDepsToRemove] = useState<string[]>([]);
  const [newDepTargetId, setNewDepTargetId] = useState("");
  const [newDepType, setNewDepType] = useState("finish_to_start");

  // All existing deps for this node (when editing)
  const existingDeps = useMemo(
    () => isEdit ? (tree.dependencies ?? []).filter((d: any) => d.source_id === node.id) : [],
    [isEdit, node, tree.dependencies]
  );
  const visibleExistingDeps = existingDeps.filter((d: any) => !depsToRemove.includes(d.id));

  // Flat list of all pickable items (excluding self)
  const allPickableItems = useMemo(() => [
    ...tree.phases.map((p: any) => ({ id: p.id, type: "phase", name: p.name })),
    ...tree.stages.map((s: any) => ({ id: s.id, type: "stage", name: s.name })),
    ...tree.milestones.map((m: any) => ({ id: m.id, type: "milestone", name: m.name })),
    ...tree.featureGroups.map((fg: any) => ({ id: fg.id, type: "feature_group", name: fg.name })),
    ...tree.features.map((f: any) => ({ id: f.id, type: "feature", name: f.name })),
    ...tree.stories.map((s: any) => ({ id: s.id, type: "user_story", name: s.title })),
  ].filter(i => !isEdit || i.id !== node?.id), [tree, isEdit, node]);

  // IDs already added (pending or existing) to avoid duplicates
  const alreadyLinkedIds = new Set([
    ...visibleExistingDeps.map((d: any) => d.target_id),
    ...depsToAdd.map(d => d.target_id),
  ]);

  // IDs that would form a cycle if added as a dependency target for this node.
  // BFS from each candidate: if node.id is reachable through the existing dep graph,
  // adding node → candidate would close a loop.
  const cyclicTargetIds = useMemo(() => {
    if (!isEdit || !node) return new Set<string>();

    // Edges: existing deps (minus pending removals) + pending adds
    const edges: Array<{ source_id: string; target_id: string }> = [
      ...(tree.dependencies ?? [])
        .filter((d: any) => !depsToRemove.includes(d.id))
        .map((d: any) => ({ source_id: d.source_id as string, target_id: d.target_id as string })),
      ...depsToAdd.map(d => ({ source_id: node.id as string, target_id: d.target_id })),
    ];

    const cyclic = new Set<string>();
    for (const candidate of allPickableItems) {
      // BFS from candidate.id; if we reach node.id, the proposed edge is cyclic
      const visited = new Set<string>([candidate.id]);
      const queue: string[] = [candidate.id];
      let found = false;
      outer: while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const edge of edges) {
          if (edge.source_id === cur && !visited.has(edge.target_id)) {
            if (edge.target_id === node.id) { found = true; break outer; }
            visited.add(edge.target_id);
            queue.push(edge.target_id);
          }
        }
      }
      if (found) cyclic.add(candidate.id);
    }
    return cyclic;
  }, [isEdit, node, tree.dependencies, depsToRemove, depsToAdd, allPickableItems]);

  const addPendingDep = () => {
    if (!newDepTargetId) return;
    const target = allPickableItems.find(i => i.id === newDepTargetId);
    if (!target) return;
    setDepsToAdd(prev => [...prev, { target_id: target.id, target_type: target.type, dependency_type: newDepType }]);
    setNewDepTargetId("");
  };

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
    if (type === "milestone") return isEdit ? `/projects/${projectId}/planning/milestones/${node.id}` : `/projects/${projectId}/milestones`;
    if (type === "feature_group") return isEdit ? `/projects/${projectId}/planning/feature-groups/${node.id}` : `/projects/${projectId}/feature-groups`;
    if (type === "feature") return isEdit ? `/projects/${projectId}/planning/features/${node.id}` : `/projects/${projectId}/features`;
    return base;
  };

  const typeToEndpointType = () => type as string;

  const applyDeps = async (itemId: string) => {
    const sourceType = typeToEndpointType();
    // Removals MUST run before additions: if a PM removes dep A and re-adds it
    // (e.g. to change FS→SS), posting the add first hits a 409 duplicate check;
    // then the delete succeeds but the add is already rejected, leaving nothing.
    const removeResults = await Promise.allSettled(
      depsToRemove.map(depId =>
        apiClient.delete(`/projects/${projectId}/planning/dependencies/${depId}`)
      )
    );
    const addResults = await Promise.allSettled(
      depsToAdd.map(dep =>
        apiClient.post(`/projects/${projectId}/planning/dependencies`, {
          source_id: itemId, source_type: sourceType,
          target_id: dep.target_id, target_type: dep.target_type,
          dependency_type: dep.dependency_type,
        })
      )
    );
    const failedAddResults = addResults.filter(r => r.status === "rejected") as PromiseRejectedResult[];
    const circularCount = failedAddResults.filter(r =>
      (r.reason?.message ?? "").toLowerCase().includes("circular")
    ).length;
    const otherAddFails = failedAddResults.length - circularCount;
    const failedRemoves = removeResults.filter(r => r.status === "rejected").length;

    if (circularCount > 0) {
      toast({
        title: "Circular dependency rejected",
        description: `${circularCount} link${circularCount > 1 ? "s were" : " was"} not added because ${circularCount > 1 ? "they" : "it"} would create a loop. Remove an existing dependency in the chain first.`,
        variant: "destructive",
      });
    }
    if (otherAddFails + failedRemoves > 0) {
      toast({
        title: "Some dependency changes could not be saved",
        description: `${otherAddFails} addition(s) and ${failedRemoves} removal(s) failed. The item was saved; please retry the dependency changes.`,
        variant: "destructive",
      });
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      const endpoint = getEndpoint();
      let savedItem: any;
      if (isEdit) {
        if (type === "milestone" || type === "feature_group" || type === "feature") {
          savedItem = await apiClient.patch(endpoint, payload);
        } else {
          savedItem = await apiClient.put(endpoint + `/${node.id}`, payload);
        }
        await applyDeps(node.id);
      } else {
        if (type === "milestone") {
          savedItem = await apiClient.post(`/projects/${projectId}/milestones`, {
            name: form.name, description: form.description || null,
            start_date: form.start_date || null, end_date: form.end_date || null,
            status: "not_started", planning_status: form.planning_status,
            estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
            owner_id: form.owner_id || null, phase_id: form.phase_id || null, stage_id: form.stage_id || null,
          });
        } else if (type === "feature_group") {
          savedItem = await apiClient.post(`/projects/${projectId}/feature-groups`, {
            name: form.name, description: form.description || null,
            planning_status: form.planning_status, estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
            owner_id: form.owner_id || null, phase_id: form.phase_id || null, stage_id: form.stage_id || null, milestone_id: form.milestone_id || null,
            start_date: form.start_date || null, end_date: form.end_date || null,
          });
        } else if (type === "feature") {
          savedItem = await apiClient.post(`/projects/${projectId}/features`, {
            name: form.name, description: form.description || null,
            feature_group_id: form.feature_group_id || null, status: form.status ?? "not_started",
            planning_status: form.planning_status, estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
            owner_id: form.owner_id || null, phase_id: form.phase_id || null, stage_id: form.stage_id || null,
            start_date: form.start_date || null, end_date: form.end_date || null, date_mode: form.date_mode, acceptance_criteria: form.acceptance_criteria || null,
          });
        } else {
          savedItem = await apiClient.post(endpoint, payload);
        }
        if (depsToAdd.length > 0 && savedItem?.id) {
          await applyDeps(savedItem.id);
        }
      }
      return savedItem;
    },
    onSuccess: () => {
      toast({ title: `${cfg.singularLabel} ${isEdit ? "updated" : "created"}` });
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
      <SheetContent className="w-full flex flex-col sm:max-w-2xl" side="right">
        <SheetHeader className="shrink-0 border-b border-gray-100 pb-3 pr-8 dark:border-gray-800">
          <SheetTitle className="flex items-center gap-2 text-base">
            <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
            {isEdit ? `Edit ${cfg.singularLabel}` : `New ${cfg.singularLabel}`}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {isEdit ? "Update the planning details for this item." : "Add this item to the project plan."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 py-3 pr-1 [&_label]:text-xs">
          {/* Name / Title */}
          <div className="space-y-1">
            <Label className="font-medium">{type === "user_story" ? "Story Title" : "Name"} <span className="text-red-500">*</span></Label>
            <Input
              className="h-9 text-sm"
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
          <div className="space-y-1">
            <Label className="font-medium">Description</Label>
            <Textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} className="resize-none text-sm" />
          </div>

          {/* Acceptance Criteria (Feature & User Story) */}
          {(type === "feature" || type === "user_story") && (
            <div className="space-y-1">
              <Label className="font-medium">Acceptance Criteria</Label>
              <Textarea rows={3} value={form.acceptance_criteria} onChange={e => set("acceptance_criteria", e.target.value)} placeholder="Given… When… Then…" className="resize-none text-sm" />
            </div>
          )}

          {/* Parent selectors */}
          {type === "stage" && tree.phases.length > 0 && (
            <div className="space-y-1">
              <Label className="font-medium">Phase (optional)</Label>
              <Select value={form.phase_id || "none"} onValueChange={v => set("phase_id", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.phases.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {(type === "milestone" || type === "feature_group" || type === "feature") && tree.phases.length > 0 && (
            <div className="space-y-1">
              <Label className="font-medium">Phase (optional)</Label>
              <Select value={form.phase_id || "none"} onValueChange={v => set("phase_id", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.phases.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {(type === "milestone" || type === "feature_group" || type === "feature") && tree.stages.length > 0 && (
            <div className="space-y-1">
              <Label className="font-medium">Stage (optional)</Label>
              <Select value={form.stage_id || "none"} onValueChange={v => set("stage_id", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "feature_group" && tree.milestones.length > 0 && (
            <div className="space-y-1">
              <Label className="font-medium">Milestone (optional)</Label>
              <Select value={form.milestone_id || "none"} onValueChange={v => set("milestone_id", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.milestones.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "feature" && tree.featureGroups.length > 0 && (
            <div className="space-y-1">
              <Label className="font-medium">Feature Group (optional)</Label>
              <Select value={form.feature_group_id || "none"} onValueChange={v => set("feature_group_id", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.featureGroups.map((fg: any) => <SelectItem key={fg.id} value={fg.id}>{fg.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "user_story" && tree.features.length > 0 && (
            <div className="space-y-1">
              <Label className="font-medium">Feature (optional)</Label>
              <Select value={form.feature_id || "none"} onValueChange={v => set("feature_id", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tree.features.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.tracking_number} {f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1 font-medium"><Calendar className="h-3 w-3" />Start Date</Label>
              <Input className="h-9 text-sm" type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1 font-medium"><Calendar className="h-3 w-3" />End Date</Label>
              <Input className="h-9 text-sm" type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>
          {dateWarn && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{dateWarn}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Effort */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1 font-medium"><Clock className="h-3 w-3" />Estimated Hours</Label>
              <Input className="h-9 text-sm" type="number" min="0" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value)} placeholder="e.g. 40" />
            </div>

            {/* Planning Status */}
            <div className="space-y-1">
              <Label className="font-medium">Planning Status</Label>
              <Select value={form.planning_status} onValueChange={v => set("planning_status", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLANNING_STATUS_CONFIG).map(([v, c]) => (
                    <SelectItem key={v} value={v}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1 font-medium"><User className="h-3 w-3" />Owner</Label>
            <Select value={form.owner_id || "none"} onValueChange={v => set("owner_id", v === "none" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Unassigned —</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.user_name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dependencies */}
          {allPickableItems.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <Label className="flex items-center gap-1 font-medium"><Link2 className="h-3 w-3" />Dependencies</Label>
              <p className="text-[11px] text-gray-400">This item depends on the completion/start of another item.</p>

              {/* Existing deps */}
              {visibleExistingDeps.length > 0 && (
                <div className="space-y-1">
                  {visibleExistingDeps.map((dep: any) => {
                    const target = allPickableItems.find(i => i.id === dep.target_id);
                    return (
                      <div key={dep.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 text-xs">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
                            {dep.dependency_type === "finish_to_start" ? "FS" : "SS"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                          <span className="truncate text-gray-700 dark:text-gray-300">{target?.name ?? dep.target_id}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setDepsToRemove(prev => [...prev, dep.id])}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending adds */}
              {depsToAdd.length > 0 && (
                <div className="space-y-1">
                  {depsToAdd.map((dep, idx) => {
                    const target = allPickableItems.find(i => i.id === dep.target_id);
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-xs">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 shrink-0">
                            {dep.dependency_type === "finish_to_start" ? "FS" : "SS"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-violet-400 shrink-0" />
                          <span className="truncate text-violet-700 dark:text-violet-300">{target?.name ?? dep.target_id}</span>
                          <span className="text-violet-400 text-[10px] shrink-0">unsaved</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setDepsToAdd(prev => prev.filter((_, i) => i !== idx))}
                          className="text-violet-400 hover:text-red-500 shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new dep */}
              <div className="flex gap-2">
                <Select value={newDepType} onValueChange={setNewDepType}>
                  <SelectTrigger className="w-24 shrink-0 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finish_to_start">FS (Finish→Start)</SelectItem>
                    <SelectItem value="start_to_start">SS (Start→Start)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newDepTargetId || "none"} onValueChange={v => setNewDepTargetId(v === "none" ? "" : v)}>
                  <SelectTrigger className="flex-1 text-xs h-8"><SelectValue placeholder="Pick an item…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Select item —</SelectItem>
                    {allPickableItems
                      .filter(i => !alreadyLinkedIds.has(i.id))
                      .map(i => {
                        const isCyclic = cyclicTargetIds.has(i.id);
                        return (
                          <SelectItem key={i.id} value={i.id} disabled={isCyclic}>
                            {isCyclic ? "⊘ " : ""}{NODE_TYPE_CONFIG[i.type as NodeType]?.singularLabel ?? i.type}: {i.name}{isCyclic ? " (would create a loop)" : ""}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" className="shrink-0 h-8 px-2"
                  onClick={addPendingDep} disabled={!newDepTargetId}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t border-gray-100 pt-3 dark:border-gray-800">
          <Button variant="outline" onClick={onClose} className="h-9 flex-1 text-sm">Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()} className="h-9 flex-1 text-sm">
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
  const allNodeIds = useMemo(
    () => new Set<string>([
      ...tree.phases,
      ...tree.stages,
      ...tree.milestones,
      ...tree.featureGroups,
      ...tree.features,
      ...tree.stories,
    ].map((item: any) => item.id)),
    [tree],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allNodeIds));
  const knownNodeIds = useRef<Set<string>>(new Set());

  // Open the complete tree on first load and expand nodes added later.
  // Existing manual collapse/expand choices are preserved while this view stays mounted.
  useEffect(() => {
    const newNodeIds = Array.from(allNodeIds).filter(id => !knownNodeIds.current.has(id));
    if (newNodeIds.length > 0) {
      setExpanded(previous => {
        const next = new Set(previous);
        newNodeIds.forEach(id => next.add(id));
        return next;
      });
    }
    knownNodeIds.current = new Set(allNodeIds);
  }, [allNodeIds]);

  const toggle = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Flat lookup for all items — used by NodeRow for dep conflict detection
  const itemsById = useMemo(() => {
    const m = new Map<string, any>();
    [...tree.phases, ...tree.stages, ...tree.milestones, ...tree.featureGroups, ...tree.features]
      .forEach(i => m.set(i.id, i));
    tree.stories.forEach((s: any) => m.set(s.id, { ...s, name: s.title }));
    return m;
  }, [tree]);

  // Index deps by source_id for O(1) lookup per NodeRow
  const depsBySource = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const dep of (tree.dependencies ?? [])) {
      if (!m.has(dep.source_id)) m.set(dep.source_id, []);
      m.get(dep.source_id)!.push(dep);
    }
    return m;
  }, [tree.dependencies]);

  // Convenience: spread dep props for a given node id
  const dp = (id: string) => ({ nodeDeps: depsBySource.get(id), itemsById, projectId });

  // Hierarchy helpers
  const stagesForPhase = (phaseId: string) => tree.stages.filter((s: any) => s.phase_id === phaseId);
  const milestonesForParent = (parentId: string | null, parentType: "phase" | "stage") =>
    tree.milestones.filter((m: any) => parentType === "stage" ? m.stage_id === parentId : (m.phase_id === parentId && !m.stage_id));
  const fgsForParent = (parentId: string | null, parentType: string) =>
    tree.featureGroups.filter((fg: any) =>
      parentType === "milestone" ? fg.milestone_id === parentId
      : parentType === "stage"   ? (fg.stage_id === parentId && !fg.milestone_id)
      : (fg.phase_id === parentId && !fg.stage_id && !fg.milestone_id));
  const featuresForFG = (fgId: string) => tree.features.filter((f: any) => f.feature_group_id === fgId);
  const featuresUnassigned = () => tree.features.filter((f: any) => !f.feature_group_id);
  const storiesForFeature = (featureId: string) => tree.stories.filter((s: any) => s.feature_id === featureId);

  const orphanMilestones = tree.milestones.filter((m: any) => !m.phase_id && !m.stage_id);
  const orphanFGs = tree.featureGroups.filter((fg: any) => !fg.phase_id && !fg.stage_id && !fg.milestone_id);

  const renderStories = (featureId: string, depth: number, parentFeature?: any) =>
    storiesForFeature(featureId).map((s: any) => (
      <NodeRow key={s.id} node={s} type="user_story" depth={depth} isExpanded={false} hasChildren={false}
        onToggle={() => {}} onEdit={() => onEdit(s, "user_story")} onDelete={() => onDelete(s, "user_story")}
        onAddChild={() => {}} users={users} childTypes={[]} parentNode={parentFeature} {...dp(s.id)} />
    ));

  const renderFeatures = (fgId: string, depth: number, parentFG?: any) =>
    featuresForFG(fgId).map((f: any) => {
      const children = storiesForFeature(f.id);
      const isExp = expanded.has(f.id);
      return (
        <div key={f.id}>
          <NodeRow node={f} type="feature" depth={depth} isExpanded={isExp} hasChildren={children.length > 0}
            onToggle={() => toggle(f.id)} onEdit={() => onEdit(f, "feature")} onDelete={() => onDelete(f, "feature")}
            onAddChild={ct => onAddChild(ct, { feature_id: f.id })} users={users} childTypes={["user_story"]}
            parentNode={parentFG} {...dp(f.id)} />
          {isExp && renderStories(f.id, depth + 1, f)}
        </div>
      );
    });

  const renderFGs = (parentId: string | null, parentType: string, depth: number, parentNode?: any) =>
    fgsForParent(parentId, parentType).map((fg: any) => {
      const children = featuresForFG(fg.id);
      const isExp = expanded.has(fg.id);
      return (
        <div key={fg.id}>
          <NodeRow node={fg} type="feature_group" depth={depth} isExpanded={isExp} hasChildren={children.length > 0}
            onToggle={() => toggle(fg.id)} onEdit={() => onEdit(fg, "feature_group")} onDelete={() => onDelete(fg, "feature_group")}
            onAddChild={ct => onAddChild(ct, { feature_group_id: fg.id })} users={users} childTypes={["feature"]}
            parentNode={parentNode} {...dp(fg.id)} />
          {isExp && renderFeatures(fg.id, depth + 1, fg)}
        </div>
      );
    });

  const renderMilestones = (parentId: string | null, parentType: "phase" | "stage", depth: number, parentNode?: any) =>
    milestonesForParent(parentId, parentType).map((m: any) => {
      const fgChildren = fgsForParent(m.id, "milestone");
      const isExp = expanded.has(m.id);
      return (
        <div key={m.id}>
          <NodeRow node={m} type="milestone" depth={depth} isExpanded={isExp} hasChildren={fgChildren.length > 0}
            onToggle={() => toggle(m.id)} onEdit={() => onEdit(m, "milestone")} onDelete={() => onDelete(m, "milestone")}
            onAddChild={ct => onAddChild(ct, { milestone_id: m.id })} users={users} childTypes={["feature_group", "feature"]}
            parentNode={parentNode} {...dp(m.id)} />
          {isExp && renderFGs(m.id, "milestone", depth + 1, m)}
        </div>
      );
    });

  const renderStages = (phaseId: string, depth: number, parentPhase?: any) =>
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
            childTypes={["milestone", "feature_group", "feature"]} parentNode={parentPhase} {...dp(s.id)} />
          {isExp && (
            <>
              {renderMilestones(s.id, "stage", depth + 1, s)}
              {renderFGs(s.id, "stage", depth + 1, s)}
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
              childTypes={["stage", "milestone", "feature_group", "feature"]} parentNode={undefined} {...dp(p.id)} />
            {isExp && (
              <>
                {renderStages(p.id, 1, p)}
                {renderMilestones(p.id, "phase", 1, p)}
                {renderFGs(p.id, "phase", 1, p)}
              </>
            )}
          </div>
        );
      })}

      {/* Orphan Stages (no phase) */}
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
              childTypes={["milestone", "feature_group", "feature"]} parentNode={undefined} {...dp(s.id)} />
            {isExp && (
              <>
                {renderMilestones(s.id, "stage", 1, s)}
                {renderFGs(s.id, "stage", 1, s)}
              </>
            )}
          </div>
        );
      })}

      {/* Orphan Milestones (no phase, no stage) */}
      {orphanMilestones.map((m: any) => {
        const fgChildren = fgsForParent(m.id, "milestone");
        const isExp = expanded.has(m.id);
        return (
          <div key={m.id}>
            <NodeRow node={m} type="milestone" depth={0} isExpanded={isExp} hasChildren={fgChildren.length > 0}
              onToggle={() => toggle(m.id)} onEdit={() => onEdit(m, "milestone")} onDelete={() => onDelete(m, "milestone")}
              onAddChild={ct => onAddChild(ct, { milestone_id: m.id })} users={users} childTypes={["feature_group", "feature"]}
              parentNode={undefined} {...dp(m.id)} />
            {isExp && renderFGs(m.id, "milestone", 1, m)}
          </div>
        );
      })}

      {/* Orphan FGs (no phase, stage, or milestone) */}
      {orphanFGs.map((fg: any) => {
        const children = featuresForFG(fg.id);
        const isExp = expanded.has(fg.id);
        return (
          <div key={fg.id}>
            <NodeRow node={fg} type="feature_group" depth={0} isExpanded={isExp} hasChildren={children.length > 0}
              onToggle={() => toggle(fg.id)} onEdit={() => onEdit(fg, "feature_group")} onDelete={() => onDelete(fg, "feature_group")}
              onAddChild={ct => onAddChild(ct, { feature_group_id: fg.id })} users={users} childTypes={["feature"]}
              parentNode={undefined} {...dp(fg.id)} />
            {isExp && renderFeatures(fg.id, 1, fg)}
          </div>
        );
      })}

      {/* Unattached Features (no FG) */}
      {featuresUnassigned().map((f: any) => {
        const children = storiesForFeature(f.id);
        const isExp = expanded.has(f.id);
        return (
          <div key={f.id}>
            <NodeRow node={f} type="feature" depth={0} isExpanded={isExp} hasChildren={children.length > 0}
              onToggle={() => toggle(f.id)} onEdit={() => onEdit(f, "feature")} onDelete={() => onDelete(f, "feature")}
              onAddChild={ct => onAddChild(ct, { feature_id: f.id })} users={users} childTypes={["user_story"]}
              parentNode={undefined} {...dp(f.id)} />
            {isExp && renderStories(f.id, 1, f)}
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

  // Include ALL items — undated ones get placeholder rows
  const allItems = useMemo(() => {
    const items: { id: string; name: string; type: NodeType; start_date?: string | null; end_date?: string | null; planning_status?: string }[] = [
      ...tree.phases.map((p: any) => ({ ...p, type: "phase" as NodeType })),
      ...tree.stages.map((s: any) => ({ ...s, type: "stage" as NodeType })),
      ...tree.milestones.map((m: any) => ({ ...m, type: "milestone" as NodeType })),
      ...tree.featureGroups.map((fg: any) => ({ ...fg, type: "feature_group" as NodeType })),
      ...tree.features.map((f: any) => ({ ...f, type: "feature" as NodeType })),
      ...tree.stories.map((s: any) => ({ ...s, name: s.title, type: "user_story" as NodeType })),
    ];
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
        <p className="text-sm font-medium">No planning items yet</p>
        <p className="text-xs mt-1">Add planning items to see them on the timeline. Items with dates will show as bars; others appear as placeholders.</p>
      </div>
    );
  }

  // Timeline bounds — derived only from items that have at least one date
  const datedItems = allItems.filter(i => i.start_date || i.end_date);
  let minDate: Date, maxDate: Date;
  if (datedItems.length > 0) {
    const allDates = datedItems.flatMap(i => [i.start_date, i.end_date].filter(Boolean) as string[]);
    minDate = new Date(Math.min(...allDates.map(d => new Date(d).getTime())));
    maxDate = new Date(Math.max(...allDates.map(d => new Date(d).getTime())));
    if (differenceInDays(maxDate, minDate) < 1) {
      maxDate = new Date(minDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  } else {
    // No dated items — show a 30-day window from today as a neutral backdrop
    minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    maxDate = new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
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
  const BORDER_COLORS: Record<NodeType, string> = {
    phase: "border-violet-400", stage: "border-blue-400", milestone: "border-orange-400",
    feature_group: "border-teal-400", feature: "border-indigo-400", user_story: "border-pink-400",
  };
  const SVG_COLORS: Record<NodeType, string> = {
    phase: "#a78bfa", stage: "#60a5fa", milestone: "#fb923c",
    feature_group: "#2dd4bf", feature: "#818cf8", user_story: "#f472b6",
  };

  // For undated items, their placeholder x-position is the horizontal center of the grid
  const getItemX = (item: typeof allItems[number], isEndAnchor: boolean, gw: number): number => {
    if (!item.start_date && !item.end_date) return gw * 0.5;
    if (isEndAnchor) {
      const d = item.end_date ? new Date(item.end_date) : new Date(item.start_date!);
      return (pct(d) / 100) * gw;
    }
    const d = item.start_date ? new Date(item.start_date) : new Date(item.end_date!);
    return (pct(d) / 100) * gw;
  };

  // Compute SVG arrows — now includes undated items via placeholder positions
  const deps = tree.dependencies ?? [];
  type Arrow = {
    x1: number; y1: number; x2: number; y2: number;
    conflict: boolean; srcType: NodeType;
    /** true when one or both endpoints have no dates — arrow is approximate */
    approximate: boolean;
  };
  const arrows: Arrow[] = [];
  if (gridWidth > 0) {
    for (const d of deps) {
      const srcIdx = itemIndexMap.get(d.source_id);
      const tgtIdx = itemIndexMap.get(d.target_id);
      if (srcIdx === undefined || tgtIdx === undefined) continue;
      const src = allItems[srcIdx];
      const tgt = allItems[tgtIdx];

      const srcUndated = !src.start_date && !src.end_date;
      const tgtUndated = !tgt.start_date && !tgt.end_date;
      const approximate = srcUndated || tgtUndated;

      // x: end-of-target → start-of-source (FS) or start-of-target → start-of-source (SS)
      const x1 = d.dependency_type === "finish_to_start"
        ? getItemX(tgt, true, gridWidth)
        : getItemX(tgt, false, gridWidth);
      const x2 = getItemX(src, false, gridWidth);

      const y1 = tgtIdx * ROW_H + BAR_CY;
      const y2 = srcIdx * ROW_H + BAR_CY;

      const srcStart = src.start_date ? new Date(src.start_date) : null;
      const tgtEnd   = tgt.end_date   ? new Date(tgt.end_date)   : null;
      const tgtStart = tgt.start_date ? new Date(tgt.start_date) : null;
      // Conflicts are only meaningful when both items are dated
      const conflict = !approximate && (d.dependency_type === "finish_to_start"
        ? !!(srcStart && tgtEnd && srcStart < tgtEnd)
        : !!(srcStart && tgtStart && srcStart < tgtStart));

      arrows.push({ x1, y1, x2, y2, conflict, srcType: src.type, approximate });
    }
  }

  const svgH = allItems.length * ROW_H;
  const hasUndatedItems = allItems.some(i => !i.start_date && !i.end_date);
  const hasDeps = deps.length > 0;

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
              const isUndated = !item.start_date && !item.end_date;
              return (
                <div key={item.id} className={`h-6 flex items-center gap-1.5 min-w-0 ${isUndated ? "opacity-60" : ""}`}>
                  <Icon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                  {isUndated && (
                    <span className="text-[9px] text-gray-400 dark:text-gray-600 italic shrink-0">no dates</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bar grid with SVG overlay */}
          <div className="flex-1 relative" ref={gridRef} style={{ height: `${svgH}px` }}>
            {/* Row backgrounds */}
            <div className="absolute inset-0 space-y-1">
              {allItems.map(item => {
                const isUndated = !item.start_date && !item.end_date;
                return (
                  <div
                    key={item.id}
                    className={`h-6 rounded ${
                      isUndated
                        ? "bg-gray-50/60 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700"
                        : "bg-gray-50 dark:bg-gray-800/50"
                    }`}
                  />
                );
              })}
            </div>

            {/* Bars */}
            <div className="absolute inset-0 space-y-1">
              {allItems.map(item => {
                const barStyle = getBarStyle(item);
                const isUndated = !item.start_date && !item.end_date;
                return (
                  <div key={item.id} className="h-6 relative">
                    {barStyle && (
                      <div
                        className={`absolute top-1 h-4 rounded ${COLORS[item.type]} opacity-80 hover:opacity-100 transition-opacity`}
                        style={barStyle}
                        title={`${item.name}: ${item.start_date ? format(new Date(item.start_date), "dd MMM") : "?"} → ${item.end_date ? format(new Date(item.end_date), "dd MMM") : "?"}`}
                      />
                    )}
                    {isUndated && (
                      /* Placeholder bar: dashed border centred on the row, no fill */
                      <div
                        className={`absolute top-1 h-4 rounded border-2 border-dashed ${BORDER_COLORS[item.type]} opacity-40`}
                        style={{ left: "calc(50% - 20px)", width: "40px" }}
                        title={`${item.name}: no dates set — position is approximate`}
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
                  <marker id="arr-ok"     viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0,1 L6,4 L0,7 Z" fill="#6366f1" />
                  </marker>
                  <marker id="arr-bad"    viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0,1 L6,4 L0,7 Z" fill="#f59e0b" />
                  </marker>
                  <marker id="arr-approx" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0,1 L6,4 L0,7 Z" fill="#9ca3af" />
                  </marker>
                </defs>
                {arrows.map((a, i) => {
                  const stroke  = a.approximate ? "#9ca3af" : a.conflict ? "#f59e0b" : SVG_COLORS[a.srcType] ?? "#6366f1";
                  const marker  = a.approximate ? "url(#arr-approx)" : a.conflict ? "url(#arr-bad)" : "url(#arr-ok)";
                  const dashArr = a.approximate ? "4 4" : a.conflict ? "4 2" : undefined;
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
                      strokeDasharray={dashArr}
                      markerEnd={marker}
                      opacity={a.approximate ? 0.55 : 0.75}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Legend */}
        {(hasDeps || hasUndatedItems) && (
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400">
            {hasDeps && (
              <>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-6 h-px bg-indigo-400" />Dependency
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-6 h-px bg-amber-400" style={{ backgroundImage: "repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 4px,transparent 4px,transparent 6px)" }} />Conflict
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-6 h-px bg-gray-400" style={{ backgroundImage: "repeating-linear-gradient(90deg,#9ca3af 0,#9ca3af 4px,transparent 4px,transparent 8px)" }} />Approximate (no dates)
                </span>
              </>
            )}
            <span className="text-gray-300 dark:text-gray-600">
              {hasDeps ? "Arrows: predecessor → dependent" : ""}
              {hasUndatedItems ? " · Dashed bars and grey arrows indicate items without scheduled dates — positions are approximate" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dependencies View ──────────────────────────────────────────────────────
function DependenciesView({ tree, projectId }: { tree: PlanningTree; projectId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Local ordered copy — seeded from tree, synced on refresh
  const [orderedDeps, setOrderedDeps] = useState<any[]>(() => [...(tree.dependencies ?? [])]);
  useEffect(() => {
    setOrderedDeps([...(tree.dependencies ?? [])]);
  }, [tree.dependencies]);

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allIds = orderedDeps.map(d => d.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  // Inline type-edit state
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [savingTypeId, setSavingTypeId] = useState<string | null>(null);
  const [typeErrors, setTypeErrors] = useState<Record<string, string>>({});

  // Action busy states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkEditType, setBulkEditType] = useState<string>("finish_to_start");
  const [bulkEditing, setBulkEditing] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Item lookup maps
  const itemsById = useMemo(() => {
    const m = new Map<string, { name: string; type: NodeType }>();
    tree.phases.forEach((p: any) => m.set(p.id, { name: p.name, type: "phase" }));
    tree.stages.forEach((s: any) => m.set(s.id, { name: s.name, type: "stage" }));
    tree.milestones.forEach((ms: any) => m.set(ms.id, { name: ms.name, type: "milestone" }));
    tree.featureGroups.forEach((fg: any) => m.set(fg.id, { name: fg.name, type: "feature_group" }));
    tree.features.forEach((f: any) => m.set(f.id, { name: f.name, type: "feature" }));
    tree.stories.forEach((s: any) => m.set(s.id, { name: s.title, type: "user_story" }));
    return m;
  }, [tree]);

  const dataById = useMemo(() => {
    const m = new Map<string, any>();
    [...tree.phases, ...tree.stages, ...tree.milestones, ...tree.featureGroups, ...tree.features]
      .forEach(i => m.set(i.id, i));
    tree.stories.forEach((s: any) => m.set(s.id, s));
    return m;
  }, [tree]);

  const getUserId = () => {
    try { return JSON.parse(localStorage.getItem("user") ?? "{}")?.id ?? ""; } catch { return ""; }
  };

  // ── Selection helpers ──────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(allIds));

  // ── Bulk type change ───────────────────────────────────────────────────
  const bulkChangeType = async () => {
    if (selected.size === 0) return;
    setBulkEditing(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map(id =>
        fetch(`/api/projects/${projectId}/planning/dependencies/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-id": getUserId() },
          body: JSON.stringify({ dependency_type: bulkEditType }),
        }).then(r => { if (!r.ok) throw new Error("failed"); return r.json(); })
      )
    );
    const failed = results.filter(r => r.status === "rejected").length;
    const succeeded = ids.length - failed;
    // Optimistically update local order for succeeded rows
    setOrderedDeps(prev =>
      prev.map(d => selected.has(d.id) ? { ...d, dependency_type: bulkEditType } : d)
    );
    qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
    if (failed > 0) {
      toast({
        title: `${succeeded} updated, ${failed} failed`,
        description: "Some dependency types could not be changed. Please try again.",
        variant: "destructive",
      });
    } else {
      const label = bulkEditType === "finish_to_start" ? "FS" : "SS";
      toast({ title: `${succeeded} ${succeeded === 1 ? "dependency" : "dependencies"} set to ${label}` });
    }
    setBulkEditing(false);
  };

  // ── Single delete ──────────────────────────────────────────────────────
  const deleteSingle = async (depId: string) => {
    setDeletingId(depId);
    try {
      const resp = await fetch(`/api/projects/${projectId}/planning/dependencies/${depId}`, {
        method: "DELETE", headers: { "x-user-id": getUserId() },
      });
      if (!resp.ok) throw new Error("failed");
      setSelected(prev => { const n = new Set(prev); n.delete(depId); return n; });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
      toast({ title: "Dependency removed" });
    } catch {
      toast({ title: "Failed to remove dependency", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Bulk delete ────────────────────────────────────────────────────────
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map(id => fetch(`/api/projects/${projectId}/planning/dependencies/${id}`, {
        method: "DELETE", headers: { "x-user-id": getUserId() },
      }).then(r => { if (!r.ok) throw new Error("failed"); }))
    );
    const failed = results.filter(r => r.status === "rejected").length;
    const succeeded = ids.length - failed;
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
    if (failed > 0) {
      toast({
        title: `${succeeded} removed, ${failed} failed`,
        description: "Some dependencies could not be removed. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({ title: `${succeeded} ${succeeded === 1 ? "dependency" : "dependencies"} removed` });
    }
    setBulkDeleting(false);
  };

  // ── Inline type change ─────────────────────────────────────────────────
  const changeType = async (depId: string, newType: string) => {
    setSavingTypeId(depId);
    setTypeErrors(prev => { const n = { ...prev }; delete n[depId]; return n; });
    try {
      const resp = await fetch(`/api/projects/${projectId}/planning/dependencies/${depId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": getUserId() },
        body: JSON.stringify({ dependency_type: newType }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setTypeErrors(prev => ({ ...prev, [depId]: (err as any).error ?? "Save failed" }));
        return;
      }
      // Optimistically update local order without a full tree refetch for speed
      setOrderedDeps(prev => prev.map(d => d.id === depId ? { ...d, dependency_type: newType } : d));
      setEditingTypeId(null);
      // Still invalidate so conflict detection reflects the new type
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
    } catch {
      setTypeErrors(prev => ({ ...prev, [depId]: "Network error — try again" }));
    } finally {
      setSavingTypeId(null);
    }
  };

  // ── Reorder (up / down) ────────────────────────────────────────────────
  const moveRow = async (index: number, direction: "up" | "down") => {
    const next = [...orderedDeps];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    setOrderedDeps(next); // optimistic
    setReordering(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/planning/dependencies/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": getUserId() },
        body: JSON.stringify({ order: next.map((d, i) => ({ id: d.id, sort_order: i })) }),
      });
      if (!resp.ok) throw new Error("failed");
      // Invalidate so remounting the panel (e.g. tab switch) seeds from the
      // server's new sort_order values rather than the pre-reorder cache.
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "planning/tree"] });
    } catch {
      setOrderedDeps([...(tree.dependencies ?? [])]); // revert optimistic update
      toast({ title: "Failed to save order", variant: "destructive" });
    } finally {
      setReordering(false);
    }
  };

  const conflictCount = orderedDeps.filter(dep => {
    const src = dataById.get(dep.source_id);
    const tgt = dataById.get(dep.target_id);
    return src && tgt && !!checkDepConflict(dep, src, tgt);
  }).length;

  if (orderedDeps.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No dependencies yet</p>
        <p className="text-xs mt-1 max-w-xs mx-auto">
          Open any item in the Tree view and add a dependency in its edit sheet.
        </p>
      </div>
    );
  }

  const isBusy = bulkDeleting || bulkEditing || !!deletingId || reordering;

  return (
    <div className="space-y-3">
      {/* ── Summary + bulk action bar ────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap min-h-[28px]">
        <span className="text-xs text-gray-500">
          <strong className="text-gray-800 dark:text-gray-200">{orderedDeps.length}</strong>{" "}
          {orderedDeps.length === 1 ? "dependency" : "dependencies"}
        </span>
        {conflictCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold">
            <AlertTriangle className="h-3 w-3" />{conflictCount} date {conflictCount === 1 ? "conflict" : "conflicts"}
          </span>
        )}
        <div className="flex-1" />
        {reordering && (
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />Saving order…
          </span>
        )}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">{selected.size} selected</span>
            {/* Bulk type change */}
            <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-1.5 py-0.5">
              <span className="text-[11px] text-gray-500 shrink-0">Set type:</span>
              <select
                value={bulkEditType}
                onChange={e => setBulkEditType(e.target.value)}
                disabled={bulkEditing || bulkDeleting}
                className="text-[11px] bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
              >
                <option value="finish_to_start">FS – Finish → Start</option>
                <option value="start_to_start">SS – Start → Start</option>
              </select>
              <Button
                size="sm"
                className="h-6 text-[11px] px-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={bulkChangeType}
                disabled={bulkEditing || bulkDeleting}
              >
                {bulkEditing
                  ? <RefreshCw className="h-3 w-3 animate-spin" />
                  : <><Check className="h-3 w-3 mr-0.5" />Apply</>}
              </Button>
            </div>
            {/* Bulk delete */}
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs px-3"
              onClick={bulkDelete}
              disabled={bulkDeleting || bulkEditing}
            >
              {bulkDeleting
                ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Deleting…</>
                : <><Trash2 className="h-3 w-3 mr-1" />Delete {selected.size}</>}
            </Button>
            <button
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => setSelected(new Set())}
              disabled={bulkDeleting || bulkEditing}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Dependency table ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="w-8 px-2 py-2 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleSelectAll}
                  className="rounded"
                  title={allSelected ? "Deselect all" : "Select all"}
                />
              </th>
              <th className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 w-[32%]">Dependent (source)</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 w-28">Type</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 w-[32%]">Predecessor (target)</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">Status</th>
              <th className="w-24 px-2 py-2 text-right">
                <span className="text-[10px] font-normal text-gray-400">Order</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {orderedDeps.map((dep, idx) => {
              const src = itemsById.get(dep.source_id);
              const tgt = itemsById.get(dep.target_id);
              const srcData = dataById.get(dep.source_id);
              const tgtData = dataById.get(dep.target_id);
              const conflict = srcData && tgtData ? checkDepConflict(dep, srcData, tgtData) : null;
              const SrcIcon = src ? NODE_TYPE_CONFIG[src.type]?.icon : null;
              const TgtIcon = tgt ? NODE_TYPE_CONFIG[tgt.type]?.icon : null;
              const srcColor = src ? NODE_TYPE_CONFIG[src.type]?.color : "text-gray-400";
              const tgtColor = tgt ? NODE_TYPE_CONFIG[tgt.type]?.color : "text-gray-400";
              const isSelected = selected.has(dep.id);
              const isDeleting = deletingId === dep.id;
              const isSavingType = savingTypeId === dep.id;
              const isEditingType = editingTypeId === dep.id;
              const typeError = typeErrors[dep.id];
              const depTypeLabel = dep.dependency_type === "finish_to_start" ? "FS" : "SS";

              return (
                <tr
                  key={dep.id}
                  className={`transition-colors ${
                    isSelected
                      ? "bg-blue-50/50 dark:bg-blue-950/10"
                      : conflict
                        ? "bg-amber-50/50 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="w-8 px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(dep.id)}
                      className="rounded"
                      disabled={isBusy && !isSelected}
                    />
                  </td>

                  {/* Source item */}
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {SrcIcon && <SrcIcon className={`h-3.5 w-3.5 shrink-0 ${srcColor}`} />}
                      <span className="truncate text-gray-800 dark:text-gray-200 font-medium">
                        {src?.name ?? <span className="italic text-gray-400">{dep.source_id.slice(0, 8)}…</span>}
                      </span>
                      {src && (
                        <span className="shrink-0 text-[10px] text-gray-400">
                          ({NODE_TYPE_CONFIG[src.type]?.singularLabel})
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Dependency type — inline editable */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      {isEditingType ? (
                        <div className="flex items-center gap-1">
                          <select
                            autoFocus
                            className="text-[11px] border border-blue-300 dark:border-blue-600 rounded px-1.5 py-0.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            defaultValue={dep.dependency_type}
                            onChange={e => changeType(dep.id, e.target.value)}
                            disabled={isSavingType}
                            onBlur={() => {
                              if (!isSavingType) {
                                setEditingTypeId(null);
                                setTypeErrors(p => { const n = { ...p }; delete n[dep.id]; return n; });
                              }
                            }}
                          >
                            <option value="finish_to_start">FS – Finish → Start</option>
                            <option value="start_to_start">SS – Start → Start</option>
                          </select>
                          {isSavingType
                            ? <RefreshCw className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
                            : <button
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { setEditingTypeId(null); setTypeErrors(p => { const n = { ...p }; delete n[dep.id]; return n; }); }}
                                className="text-gray-400 hover:text-gray-600 shrink-0"
                              ><X className="h-3 w-3" /></button>
                          }
                        </div>
                      ) : (
                        <button
                          className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group w-fit"
                          title="Click to change dependency type"
                          onClick={() => !isBusy && setEditingTypeId(dep.id)}
                          disabled={isBusy}
                        >
                          <ArrowRight className="h-2.5 w-2.5" />
                          {depTypeLabel}
                          <Pencil className="h-2 w-2 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      )}
                      {typeError && (
                        <p className="text-[10px] text-red-500 mt-0.5 max-w-[100px] truncate" title={typeError}>{typeError}</p>
                      )}
                    </div>
                  </td>

                  {/* Target item */}
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {TgtIcon && <TgtIcon className={`h-3.5 w-3.5 shrink-0 ${tgtColor}`} />}
                      <span className="truncate text-gray-700 dark:text-gray-300">
                        {tgt?.name ?? <span className="italic text-gray-400">{dep.target_id.slice(0, 8)}…</span>}
                      </span>
                      {tgt && (
                        <span className="shrink-0 text-[10px] text-gray-400">
                          ({NODE_TYPE_CONFIG[tgt.type]?.singularLabel})
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Conflict status */}
                  <td className="px-3 py-2.5">
                    {conflict ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate max-w-[140px]" title={conflict}>{conflict}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400">
                        <Check className="h-2.5 w-2.5" />OK
                      </span>
                    )}
                  </td>

                  {/* Row actions: move up, move down, delete */}
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button
                        onClick={() => moveRow(idx, "up")}
                        disabled={idx === 0 || isBusy}
                        className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveRow(idx, "down")}
                        disabled={idx === orderedDeps.length - 1 || isBusy}
                        className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteSingle(dep.id)}
                        disabled={isDeleting || bulkDeleting}
                        className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Remove dependency"
                      >
                        {isDeleting
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400 italic">
        Click any <strong className="font-semibold">FS / SS</strong> badge to change that dependency's type inline.
        Select rows to bulk-change type or bulk-delete.
        Use <ChevronUp className="h-2.5 w-2.5 inline" /><ChevronDown className="h-2.5 w-2.5 inline" /> to reorder rows.
        To add dependencies, open an item in the Tree view and use its edit sheet.
      </p>
    </div>
  );
}

// ── Main Planning Workspace ────────────────────────────────────────────────
export default function PlanningWorkspace({ projectId, users }: { projectId: string; users: UserType[] }) {
  const { toast } = useToast();
  const [view, setView] = useState<"tree" | "timeline" | "dependencies">("tree");
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

  const {
    data: tree,
    isLoading,
    isError: isTreeError,
    error: treeError,
    refetch: refetchTree,
  } = useQuery<PlanningTree>({
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
      <div className="relative z-30 overflow-visible bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-5 py-3 shrink-0">
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
            {(["tree", "timeline", "dependencies"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  view === v ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {v === "tree" ? "Tree" : v === "timeline" ? "Timeline" : (
                  <span className="flex items-center gap-1">
                    Dependencies
                    {(t.dependencies?.length ?? 0) > 0 && (
                      <span className="text-[10px] font-semibold px-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        {t.dependencies.length}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="relative z-50 shrink-0">
            <Button size="sm" className="h-8 text-xs" onClick={() => setAddMenuOpen(v => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
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
        ) : isTreeError ? (
          <div
            role="alert"
            className="max-w-xl mx-auto mt-10 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/30 p-5 text-center"
          >
            <AlertTriangle className="h-7 w-7 mx-auto mb-2 text-red-600 dark:text-red-400" />
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">Couldn’t load the project plan</p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              {treeError instanceof Error ? treeError.message : "The planning data could not be retrieved. Please try again."}
            </p>
            <Button size="sm" variant="outline" className="mt-4 border-red-300 text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40" onClick={() => refetchTree()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Retry
            </Button>
          </div>
        ) : view === "tree" ? (
          <TreeView
            tree={t} projectId={projectId} users={users}
            onEdit={openEdit} onDelete={openDelete}
            onAddChild={(type, defaults) => openAdd(type, defaults)}
          />
        ) : view === "timeline" ? (
          <TimelineView tree={t} />
        ) : (
          <DependenciesView tree={t} projectId={projectId} />
        )}
      </div>

      {/* ── Dialogs & Sheets ─────────────────────────────────────────────── */}
      <NodeSheet
        key={`${sheetType}:${sheetNode?.id ?? "new"}`}
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
