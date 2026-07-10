import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isPast } from "date-fns";
import {
  Search, X, CheckSquare, Briefcase, Bug, Users, UserCheck,
  MessageSquare, ArrowRight, Play, CheckCircle2, Clock,
  History, Star, Hash, ChevronRight, Zap, Loader2,
  AlertTriangle, Shield, FolderOpen, Command, Lightbulb,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SearchResults {
  tasks: TaskResult[];
  projects: ProjectResult[];
  defects: DefectResult[];
  users: UserResult[];
  teams: TeamResult[];
  decisions: DecisionResult[];
}
interface TaskResult {
  id: string; task_number: number; title: string; status: string;
  priority: number | null; due_date: string | null; assigned_to: string | null;
}
interface ProjectResult {
  id: string; name: string; status: string;
  project_type: string | null; color: string | null;
}
interface DefectResult {
  id: string; defect_number: number; title: string;
  severity: string; status: string; priority: number | null;
}
interface UserResult { id: string; user_name: string; email: string; }
interface TeamResult { id: string; name: string; }
interface DecisionResult { id: string; title: string; status: string; created_at: string; }

type ResultItem = {
  key: string; type: "task" | "project" | "defect" | "user" | "team" | "decision";
  title: string; subtitle: string; meta?: string;
  href: string; icon: React.ElementType; iconColor: string; iconBg: string;
  actions: { label: string; icon: React.ElementType; href?: string; action?: string }[];
};

// ── "Did you know?" rotating tips ─────────────────────────────────────────────
const DID_YOU_KNOW_TIPS = [
  { text: 'Type "Create Task" to instantly open the task creation form.', highlight: "Create Task" },
  { text: 'Type "Report Defect" to log a new bug or issue immediately.', highlight: "Report Defect" },
  { text: 'Use task: prefix to search only within tasks — e.g. task:login.', highlight: "task:" },
  { text: 'Use project: prefix to jump straight to a project by name.', highlight: "project:" },
  { text: 'Press Tab to reveal filter shortcuts for faster scoped searches.', highlight: "Tab" },
  { text: 'Press Ctrl+K from anywhere in the app to open the Command Center.', highlight: "Ctrl+K" },
  { text: 'Use defect: prefix to find bugs and issues across the system.', highlight: "defect:" },
  { text: 'Type a colleague\'s name to see their profile and assigned tasks.', highlight: null },
  { text: 'Arrow keys navigate results — no mouse needed.', highlight: null },
  { text: 'Soon: Ask AI questions like "Why is Project Alpha delayed?"', highlight: "Coming soon" },
  { text: 'Your recent searches are remembered — scroll down to see them.', highlight: null },
  { text: 'Use user: prefix to find teammates by name or email.', highlight: "user:" },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const HISTORY_KEY = "taskrep_search_history";
const MAX_HISTORY = 8;

const PRIORITY_LABEL: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low", 5: "Minimal" };
const SEV_COLOR: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high:     "text-orange-500",
  medium:   "text-yellow-600",
  low:      "text-blue-500",
};
const FILTER_HINTS = [
  { prefix: "task:",       label: "Search Tasks",       icon: CheckSquare,  color: "text-indigo-500" },
  { prefix: "project:",    label: "Search Projects",    icon: Briefcase,    color: "text-violet-500" },
  { prefix: "defect:",     label: "Search Defects",     icon: Bug,          color: "text-orange-500" },
  { prefix: "user:",       label: "Search Users",       icon: UserCheck,    color: "text-emerald-500" },
  { prefix: "discussion:", label: "Search Discussions", icon: MessageSquare,color: "text-sky-500" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function addHistory(q: string) {
  if (!q.trim()) return;
  const h = [q, ...getHistory().filter(x => x !== q)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}
function clearHistory() { localStorage.removeItem(HISTORY_KEY); }

function sl(s: string) { return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

function mapTask(t: TaskResult): ResultItem {
  const overdue = t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
  const dueLabel = t.due_date
    ? isToday(new Date(t.due_date)) ? "Due today" : overdue ? "Overdue" : `Due ${format(new Date(t.due_date), "MMM d")}`
    : "";
  return {
    key: `task-${t.id}`,
    type: "task",
    title: t.title,
    subtitle: `Task #${String(t.task_number).padStart(5, "0")} · ${PRIORITY_LABEL[t.priority ?? 3] ?? "Medium"}`,
    meta: dueLabel,
    href: `/admin/tasks?open=${t.id}`,
    icon: CheckSquare,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-50 dark:bg-indigo-900/30",
    actions: [
      { label: "Open",     icon: ArrowRight,    href: `/admin/tasks?open=${t.id}` },
      { label: "Complete", icon: CheckCircle2,  action: `complete-task-${t.id}` },
      { label: "Timer",    icon: Play,          action: `timer-task-${t.id}` },
    ],
  };
}
function mapProject(p: ProjectResult): ResultItem {
  return {
    key: `project-${p.id}`,
    type: "project",
    title: p.name,
    subtitle: `Project · ${sl(p.project_type ?? "project")} · ${sl(p.status)}`,
    href: `/projects/${p.id}`,
    icon: Briefcase,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50 dark:bg-violet-900/30",
    actions: [
      { label: "Open",      icon: ArrowRight,  href: `/projects/${p.id}` },
      { label: "Workspace", icon: MessageSquare, href: `/workspace/project/${p.id}` },
    ],
  };
}
function mapDefect(d: DefectResult): ResultItem {
  return {
    key: `defect-${d.id}`,
    type: "defect",
    title: d.title,
    subtitle: `DEF-${String(d.defect_number).padStart(5, "0")} · ${sl(d.severity)} · ${sl(d.status)}`,
    href: `/defects?open=${d.id}`,
    icon: Bug,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50 dark:bg-orange-900/30",
    actions: [
      { label: "Open",    icon: ArrowRight, href: `/defects?open=${d.id}` },
      { label: "Resolve", icon: CheckCircle2, action: `resolve-defect-${d.id}` },
    ],
  };
}
function mapUser(u: UserResult): ResultItem {
  return {
    key: `user-${u.id}`,
    type: "user",
    title: u.user_name,
    subtitle: u.email,
    href: `/admin/users`,
    icon: UserCheck,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
    actions: [{ label: "View Profile", icon: ArrowRight, href: `/admin/users` }],
  };
}
function mapTeam(t: TeamResult): ResultItem {
  return {
    key: `team-${t.id}`,
    type: "team",
    title: t.name,
    subtitle: "Team",
    href: `/admin/teams`,
    icon: Shield,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-50 dark:bg-sky-900/30",
    actions: [{ label: "View Team", icon: ArrowRight, href: `/admin/teams` }],
  };
}
function mapDecision(d: DecisionResult): ResultItem {
  return {
    key: `decision-${d.id}`,
    type: "decision",
    title: d.title,
    subtitle: `Discussion · ${sl(d.status)} · ${format(new Date(d.created_at), "MMM d, yyyy")}`,
    href: `/decisions`,
    icon: MessageSquare,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-50 dark:bg-sky-900/30",
    actions: [
      { label: "Open",     icon: ArrowRight,    href: `/decisions` },
      { label: "Workspace",icon: MessageSquare, href: `/workspace/decision/${d.id}` },
    ],
  };
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 sticky top-0">
      {children}
    </div>
  );
}

// ── Single result row ──────────────────────────────────────────────────────────
function ResultRow({
  item, active, onSelect, onAction,
}: {
  item: ResultItem; active: boolean;
  onSelect: (item: ResultItem) => void;
  onAction: (action: string, item: ResultItem) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onMouseDown={() => onSelect(item)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors group ${
        active ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${item.iconBg}`}>
        <Icon className={`w-4 h-4 ${item.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"}`}>
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400 truncate">{item.subtitle}</span>
          {item.meta && (
            <span className={`text-[10px] font-medium flex-shrink-0 ${item.meta === "Overdue" ? "text-red-500" : item.meta === "Due today" ? "text-amber-600" : "text-slate-400"}`}>
              · {item.meta}
            </span>
          )}
        </div>
      </div>
      {/* Quick actions shown on hover / active */}
      <div className={`flex items-center gap-0.5 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        {item.actions.slice(0, 2).map(a => {
          const AI = a.icon;
          return (
            <button key={a.label}
              onMouseDown={e => { e.stopPropagation(); if (a.href) { } else if (a.action) onAction(a.action, item); }}
              title={a.label}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition-colors">
              <AI className="w-3.5 h-3.5" />
            </button>
          );
        })}
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-0.5" />
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface UniversalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function UniversalSearch({ open, onClose }: UniversalSearchProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [showFilterHints, setShowFilterHints] = useState(false);
  const [didYouKnowTip, setDidYouKnowTip] = useState(DID_YOU_KNOW_TIPS[0]);

  // Refresh history on open, and pick a fresh random tip each time
  useEffect(() => {
    if (open) {
      setQuery(""); setDebouncedQ(""); setActiveIdx(0); setShowFilterHints(false);
      setHistory(getHistory());
      setDidYouKnowTip(DID_YOU_KNOW_TIPS[Math.floor(Math.random() * DID_YOU_KNOW_TIPS.length)]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch search results
  const { data: results, isFetching } = useQuery<SearchResults>({
    queryKey: ["/api/search", debouncedQ],
    queryFn: () => apiRequest(`/api/search?q=${encodeURIComponent(debouncedQ)}`),
    enabled: debouncedQ.length >= 1,
    staleTime: 10_000,
  });

  // Fetch smart suggestions when empty (my tasks)
  const { data: myTasks = [] } = useQuery<TaskResult[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => apiRequest("/api/tasks"),
    enabled: open && !debouncedQ,
  });
  const { data: myProjects = [] } = useQuery<ProjectResult[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("/api/projects"),
    enabled: open && !debouncedQ,
  });

  // Build flat list of all result items for keyboard navigation
  const allItems: ResultItem[] = debouncedQ
    ? [
        ...(results?.tasks ?? []).map(mapTask),
        ...(results?.projects ?? []).map(mapProject),
        ...(results?.defects ?? []).map(mapDefect),
        ...(results?.users ?? []).map(mapUser),
        ...(results?.teams ?? []).map(mapTeam),
        ...(results?.decisions ?? []).map(mapDecision),
      ]
    : [];

  const totalCount = allItems.length;

  // Smart suggestions for empty state
  const suggestedTasks = myTasks.filter(t => t.assigned_to === user?.id && !["completed", "done"].includes(t.status)).slice(0, 4);
  const suggestedProjects = (myProjects as ProjectResult[]).filter(p => p.status === "active").slice(0, 3);

  const handleSelect = useCallback((item: ResultItem) => {
    addHistory(item.title);
    setHistory(getHistory());
    navigate(item.href);
    onClose();
  }, [navigate, onClose]);

  const handleAction = useCallback((_action: string, item: ResultItem) => {
    // Future: handle quick actions (complete task, start timer, etc.)
    navigate(item.href);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, Math.max(totalCount - 1, 0))); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter") {
      if (allItems[activeIdx]) { handleSelect(allItems[activeIdx]); }
      else if (debouncedQ) { addHistory(debouncedQ); onClose(); }
    }
    if (e.key === "Tab") { e.preventDefault(); setShowFilterHints(v => !v); }
  };

  // Reset activeIdx when results change
  useEffect(() => setActiveIdx(0), [debouncedQ]);

  if (!open) return null;

  const hasResults = allItems.length > 0;
  const noResults = debouncedQ.length >= 1 && !isFetching && !hasResults;

  // Grouped sections for display
  const sections: { label: string; items: ResultItem[] }[] = [];
  if (results?.tasks?.length)     sections.push({ label: "Tasks",       items: results.tasks.map(mapTask) });
  if (results?.projects?.length)  sections.push({ label: "Projects",    items: results.projects.map(mapProject) });
  if (results?.defects?.length)   sections.push({ label: "Defects",     items: results.defects.map(mapDefect) });
  if (results?.users?.length)     sections.push({ label: "People",      items: results.users.map(mapUser) });
  if (results?.teams?.length)     sections.push({ label: "Teams",       items: results.teams.map(mapTeam) });
  if (results?.decisions?.length) sections.push({ label: "Discussions", items: results.decisions.map(mapDecision) });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-150"
        onMouseDown={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 pointer-events-none">
        <div
          className="w-full max-w-2xl pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in slide-in-from-top-4 duration-200"
          style={{ maxHeight: "75vh" }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            {isFetching
              ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
              : <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, projects, defects, people…"
              className="flex-1 bg-transparent text-base text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button onClick={() => { setQuery(""); setDebouncedQ(""); inputRef.current?.focus(); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              ESC
            </kbd>
          </div>

          {/* Filter prefix hints */}
          {!query && showFilterHints && (
            <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              {FILTER_HINTS.map(f => {
                const FI = f.icon;
                return (
                  <button key={f.prefix}
                    onMouseDown={() => { setQuery(f.prefix); setDebouncedQ(""); inputRef.current?.focus(); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors ${f.color}`}>
                    <FI className="w-3.5 h-3.5" />
                    <code className="font-mono">{f.prefix}</code>
                  </button>
                );
              })}
            </div>
          )}

          {/* Body */}
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: "calc(75vh - 120px)" }}>

            {/* Filter chips when query has prefix */}
            {query.includes(":") && (
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800">
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                  Filtered search: <code className="font-mono bg-indigo-100 dark:bg-indigo-800 px-1 rounded">{query.split(":")[0]}:</code>
                </span>
                <button onMouseDown={() => { setQuery(query.split(":")[1] ?? ""); inputRef.current?.focus(); }}
                  className="ml-auto text-[10px] text-indigo-500 hover:text-indigo-700">Remove filter</button>
              </div>
            )}

            {/* Empty state: smart suggestions */}
            {!debouncedQ && (
              <div>
                {/* Recent searches */}
                {history.length > 0 && (
                  <>
                    <SectionLabel>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> Recent Searches</span>
                        <button onMouseDown={() => { clearHistory(); setHistory([]); }}
                          className="text-slate-400 hover:text-red-500 font-normal normal-case text-[10px] tracking-normal">Clear</button>
                      </div>
                    </SectionLabel>
                    {history.map(h => (
                      <button key={h} onMouseDown={() => setQuery(h)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <History className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">{h}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
                      </button>
                    ))}
                  </>
                )}

                {/* My assigned tasks */}
                {suggestedTasks.length > 0 && (
                  <>
                    <SectionLabel><span className="flex items-center gap-1.5"><CheckSquare className="w-3 h-3" /> Assigned to Me</span></SectionLabel>
                    {suggestedTasks.map(t => <ResultRow key={t.id} item={mapTask(t)} active={false} onSelect={handleSelect} onAction={handleAction} />)}
                  </>
                )}

                {/* Active projects */}
                {suggestedProjects.length > 0 && (
                  <>
                    <SectionLabel><span className="flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> Active Projects</span></SectionLabel>
                    {suggestedProjects.map(p => <ResultRow key={p.id} item={mapProject(p)} active={false} onSelect={handleSelect} onAction={handleAction} />)}
                  </>
                )}

                {/* Quick nav links */}
                <SectionLabel><span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> Quick Navigation</span></SectionLabel>
                {[
                  { label: "My Workspace",   href: "/my-workspace",    Icon: Hash,         color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
                  { label: "All Tasks",       href: "/admin/tasks",      Icon: CheckSquare,  color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
                  { label: "Projects",        href: "/projects",         Icon: Briefcase,    color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/30" },
                  { label: "Defects",         href: "/defects",          Icon: Bug,          color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30" },
                  { label: "Discussions",     href: "/decisions",        Icon: MessageSquare,color: "text-sky-600",    bg: "bg-sky-50 dark:bg-sky-900/30" },
                  { label: "Reports",         href: "/admin/reports",    Icon: FolderOpen,   color: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-900/30" },
                ].map(({ label, href, Icon, color, bg }) => (
                  <button key={href} onMouseDown={() => { navigate(href); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto" />
                  </button>
                ))}

                {/* Did you know? — rotates on every open */}
                <div className="mx-3 my-3 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400 mb-0.5">Did you know?</p>
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                      {didYouKnowTip.highlight ? (
                        (() => {
                          const { text, highlight } = didYouKnowTip;
                          const idx = text.indexOf(highlight);
                          if (idx === -1) return text;
                          return (
                            <>
                              {text.slice(0, idx)}
                              <kbd className="mx-0.5 px-1 py-0.5 text-[10px] font-mono font-semibold bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded border border-amber-200 dark:border-amber-700">
                                {highlight}
                              </kbd>
                              {text.slice(idx + highlight.length)}
                            </>
                          );
                        })()
                      ) : didYouKnowTip.text}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Search results */}
            {debouncedQ && hasResults && sections.map(section => {
              let sectionStart = 0;
              for (const s of sections) {
                if (s.label === section.label) break;
                sectionStart += s.items.length;
              }
              return (
                <div key={section.label}>
                  <SectionLabel>{section.label}</SectionLabel>
                  {section.items.map((item, i) => (
                    <ResultRow
                      key={item.key}
                      item={item}
                      active={sectionStart + i === activeIdx}
                      onSelect={handleSelect}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              );
            })}

            {/* No results */}
            {noResults && (
              <div className="py-12 text-center">
                <Search className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">No results for "<span className="text-slate-700 dark:text-slate-300">{debouncedQ}</span>"</p>
                <p className="text-xs text-slate-400 mt-1">Try a different term or use a filter prefix like <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">task:</code></p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px]">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px]">↵</kbd> Open</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[9px]">Tab</kbd> Filters</span>
            </div>
            {debouncedQ && hasResults && (
              <span className="text-[10px] text-slate-400">{totalCount} result{totalCount !== 1 ? "s" : ""}</span>
            )}
            {!debouncedQ && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Command className="w-3 h-3" />
                <span>K</span>
                <span className="ml-1">to open</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
