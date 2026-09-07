import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, Calendar, ChevronRight, CircleDollarSign, ClipboardCheck, PackageCheck,
  Cog, FileText, FolderKanban, History, Lock, MessageSquare, Network, Plus,
  RotateCcw, Save, Settings2, Shield, SlidersHorizontal, Trash2, Users, X,
} from "lucide-react";
import type { Project, ProjectMember, User } from "@shared/schema";
import { apiClient } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  visibility: string;
  timeZone: string;
  planning: Record<string, any>;
  finance: Record<string, any>;
  quality: Record<string, any>;
  releaseManagement: Record<string, any>;
  collaboration: Record<string, any>;
  notifications: Record<string, { enabled: boolean; channels: string[] }>;
};

type Props = {
  project: Project;
  users: User[];
  clients: any[];
  members: ProjectMember[];
  onNavigate: (section: string) => void;
};

const DEFAULT_SETTINGS: Settings = {
  visibility: "private",
  timeZone: "UTC",
  planning: {
    enabled: true,
    methodology: "manual",
    allowAiPlanning: true,
    allowPlanningApproval: false,
    allowPhases: true,
    allowStages: true,
    allowMilestones: true,
    allowFeatureGroups: true,
    allowUserStories: true,
    allowDependencies: true,
    granularity: "task",
  },
  finance: {
    trackFinance: true,
    trackPeopleCost: false,
    peopleCostVisibility: ["organization_admin", "finance", "project_manager"],
    visibility: {
      budget: ["organization_admin", "finance", "project_manager"],
      expenses: ["organization_admin", "finance", "project_manager"],
      resourceCost: ["organization_admin", "finance", "project_manager"],
      profitability: ["organization_admin", "finance"],
    },
  },
  quality: {
    defectManagement: true,
    testCaseManagement: true,
    allowClientDefectCreation: false,
    allowClientTestCaseVisibility: false,
    allowClientTestExecution: false,
    requireTestCasesForFeatureCompletion: false,
    requireTestCasesForMilestoneCompletion: false,
    requireDefectsResolvedForMilestoneClosure: false,
  },
  releaseManagement: {
    enabled: true,
  },
  collaboration: {
    workspaceEnabled: true,
    internalCollaboration: true,
    clientCollaboration: false,
    clientComments: false,
    clientFileUpload: false,
    clientDefectCreation: false,
    clientActivityVisibility: false,
    clientDecisionVisibility: false,
    clientWorkspaceAccess: false,
  },
  notifications: {},
};

const NOTIFICATION_EVENTS = [
  ["taskAssigned", "Task assigned"],
  ["taskCompleted", "Task completed"],
  ["taskOverdue", "Task overdue"],
  ["milestoneCompleted", "Milestone completed"],
  ["milestoneDelayed", "Milestone delayed"],
  ["defectCreated", "Defect created"],
  ["defectAssigned", "Defect assigned"],
  ["defectResolved", "Defect resolved"],
  ["defectReopened", "Defect reopened"],
  ["workspaceMention", "Workspace mention"],
  ["workspaceComment", "Workspace comment"],
  ["planningUpdated", "Planning updated"],
  ["planningApprovalRequired", "Planning approval required"],
  ["financeEntryAdded", "Finance entry added"],
  ["budgetThresholdReached", "Budget threshold reached"],
  ["clientActivity", "Client activity"],
] as const;

const NOTIFICATION_DEFAULT = { enabled: true, channels: ["in_app"] };
const ROLE_OPTIONS = [
  ["organization_admin", "Organization Admin"],
  ["finance", "Finance"],
  ["project_manager", "Project Manager"],
  ["team_lead", "Team Lead"],
  ["project_member", "Project Members"],
  ["client", "Client"],
] as const;

const navItems = [
  { id: "general", label: "General", icon: FolderKanban },
  { id: "planning", label: "Planning", icon: Network },
  { id: "finance", label: "Finance", icon: CircleDollarSign },
  { id: "quality", label: "Quality & Delivery", icon: ClipboardCheck },
  { id: "release-management", label: "Release Management", icon: PackageCheck },
  { id: "collaboration", label: "Collaboration", icon: MessageSquare },
  { id: "access", label: "Access", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "customization", label: "Customization", icon: SlidersHorizontal },
];

const PROJECT_TYPES = [
  ["fixed_cost", "Fixed Cost"],
  ["time_material", "Time & Material"],
  ["milestone", "Milestone"],
  ["retainer", "Retainer"],
];
const PROJECT_STATUSES = [
  ["planning", "Planning"],
  ["active", "Active"],
  ["on_hold", "On hold"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];
const METHODOLOGIES = [
  ["manual", "Manual"],
  ["complexity_based", "Complexity Based"],
  ["component_based", "Component Based"],
  ["function_point", "Function Point Analysis"],
  ["story_point", "Story Point Based"],
  ["historical", "Historical Data Based"],
  ["custom", "Custom"],
];
const GRANULARITIES = [
  ["project", "Project"],
  ["phase", "Phase"],
  ["stage", "Stage"],
  ["milestone", "Milestone"],
  ["feature_group", "Feature Group"],
  ["feature", "Feature"],
  ["user_story", "User Story"],
  ["task", "Task"],
];
const TIME_ZONES = ["UTC", "Asia/Kolkata", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Singapore"];
const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD", "CAD", "SGD"];

function mergeSettings(saved: any): Settings {
  const source = saved && typeof saved === "object" ? saved : {};
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    planning: { ...DEFAULT_SETTINGS.planning, ...(source.planning ?? {}) },
    finance: {
      ...DEFAULT_SETTINGS.finance,
      ...(source.finance ?? {}),
      visibility: { ...DEFAULT_SETTINGS.finance.visibility, ...(source.finance?.visibility ?? {}) },
    },
    quality: { ...DEFAULT_SETTINGS.quality, ...(source.quality ?? {}) },
    releaseManagement: { ...DEFAULT_SETTINGS.releaseManagement, ...(source.releaseManagement ?? {}) },
    collaboration: { ...DEFAULT_SETTINGS.collaboration, ...(source.collaboration ?? {}) },
    notifications: Object.fromEntries(
      NOTIFICATION_EVENTS.map(([key]) => [key, { ...NOTIFICATION_DEFAULT, ...(source.notifications?.[key] ?? {}) }]),
    ),
  };
}

function setPath(source: any, path: string, value: any) {
  const result = JSON.parse(JSON.stringify(source));
  const keys = path.split(".");
  let cursor = result;
  keys.slice(0, -1).forEach((key) => { cursor = cursor[key]; });
  cursor[keys[keys.length - 1]] = value;
  return result;
}

function settingLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-gray-950 dark:text-white">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

function ToggleRow({
  label, description, checked, onChange, disabled = false, disabledReason,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-lg border p-3 transition-colors ${
      disabled ? "cursor-not-allowed border-gray-100 bg-gray-50/70 opacity-60 dark:border-gray-800 dark:bg-gray-900/40" : "cursor-pointer border-gray-200 hover:border-indigo-200 dark:border-gray-800 dark:hover:border-indigo-900"
    }`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500 dark:text-gray-400">
          {disabled && disabledReason ? disabledReason : description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
    </label>
  );
}

function RolePicker({ value, onChange, disabled = false }: { value: string[]; onChange: (roles: string[]) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ROLE_OPTIONS.map(([role, label]) => (
        <label key={role} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}>
          <input
            type="checkbox"
            checked={value.includes(role)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked ? [...value, role] : value.filter((item) => item !== role))}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

type ResourceSalaryRowProps = {
  resourceName: string;
  userId: string;
  records: any[];
  currency: string;
  canEdit: boolean;
  onSave: (payload: { id?: string; user_id: string; gross_salary: string; effective_month: string }) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function ResourceSalaryRows({
  resourceName,
  userId,
  records,
  currency,
  canEdit,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: ResourceSalaryRowProps) {
  const [showNew, setShowNew] = useState(records.length === 0);
  const [newSalary, setNewSalary] = useState("");
  const [newEffectiveMonth, setNewEffectiveMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (records.length === 0) setShowNew(true);
  }, [records.length]);

  const sortedRecords = [...records].sort((a, b) => String(a.effective_month).localeCompare(String(b.effective_month)));

  return (
    <>
      {sortedRecords.map((record) => (
        <ResourceSalaryRecordRow
          key={record.id}
          resourceName={resourceName}
          record={record}
          currency={currency}
          canEdit={canEdit}
          onSave={onSave}
          onDelete={onDelete}
          isSaving={isSaving}
          isDeleting={isDeleting}
        />
      ))}
      {showNew && (
        <tr className="bg-indigo-50/40 dark:bg-indigo-950/10">
          <td className="px-3 py-3 align-top">
            <div className="font-medium">{resourceName}</div>
            <div className="mt-1 text-xs text-gray-500">New salary record</div>
          </td>
          <td className="px-3 py-3 align-top">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">{currency}</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newSalary}
                disabled={!canEdit || isSaving}
                onChange={(event) => setNewSalary(event.target.value)}
                placeholder="Gross salary"
                className="h-9 min-w-[150px]"
                aria-label={`${resourceName} gross salary`}
              />
            </div>
          </td>
          <td className="px-3 py-3 align-top">
            <Input
              type="month"
              value={newEffectiveMonth}
              disabled={!canEdit || isSaving}
              onChange={(event) => setNewEffectiveMonth(event.target.value)}
              className="h-9 min-w-[145px]"
              aria-label={`${resourceName} effective month`}
            />
          </td>
          <td className="px-3 py-3 text-right align-top">
            <Button
              size="sm"
              disabled={!canEdit || isSaving || !newSalary || !newEffectiveMonth}
              onClick={() => onSave({ user_id: userId, gross_salary: newSalary, effective_month: newEffectiveMonth })}
            >
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
          </td>
        </tr>
      )}
      {!showNew && (
        <tr>
          <td colSpan={4} className="px-3 pb-3 pt-0">
            <Button variant="ghost" size="sm" className="h-8 text-xs" disabled={!canEdit} onClick={() => setShowNew(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add salary change
            </Button>
          </td>
        </tr>
      )}
    </>
  );
}

function ResourceSalaryRecordRow({
  resourceName,
  record,
  currency,
  canEdit,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  resourceName: string;
  record: any;
  currency: string;
  canEdit: boolean;
  onSave: ResourceSalaryRowProps["onSave"];
  onDelete: ResourceSalaryRowProps["onDelete"];
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [grossSalary, setGrossSalary] = useState(String(record.gross_salary ?? ""));
  const [effectiveMonth, setEffectiveMonth] = useState(String(record.effective_month ?? "").slice(0, 7));

  useEffect(() => {
    setGrossSalary(String(record.gross_salary ?? ""));
    setEffectiveMonth(String(record.effective_month ?? "").slice(0, 7));
  }, [record.gross_salary, record.effective_month]);

  return (
    <tr className="border-t dark:border-gray-800">
      <td className="px-3 py-3 align-top">
        <div className="font-medium">{resourceName}</div>
        <div className="mt-1 text-xs text-gray-500">Salary history</div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{currency}</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={grossSalary}
            disabled={!canEdit || isSaving}
            onChange={(event) => setGrossSalary(event.target.value)}
            className="h-9 min-w-[150px]"
            aria-label={`${resourceName} gross salary`}
          />
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <Input
          type="month"
          value={effectiveMonth}
          disabled={!canEdit || isSaving}
          onChange={(event) => setEffectiveMonth(event.target.value)}
          className="h-9 min-w-[145px]"
          aria-label={`${resourceName} effective month`}
        />
      </td>
      <td className="px-3 py-3 text-right align-top">
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!canEdit || isSaving || !grossSalary || !effectiveMonth}
            onClick={() => onSave({ id: record.id, user_id: record.user_id, gross_salary: grossSalary, effective_month: effectiveMonth })}
          >
            <Save className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete(record.id)} disabled={!canEdit || isDeleting}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

type FinanceHeadRowProps = {
  head?: any;
  resetKey?: number;
  canEdit: boolean;
  onSave: (payload: {
    id?: string;
    name: string;
    code: string;
    description: string;
    is_active: boolean;
    budget_allowed: boolean;
    actual_expense_allowed: boolean;
  }) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function FinanceHeadRow({ head, resetKey, canEdit, onSave, onDelete, isSaving, isDeleting }: FinanceHeadRowProps) {
  const [form, setForm] = useState({
    name: head?.name ?? "",
    code: head?.code ?? "",
    description: head?.description ?? "",
    is_active: head?.is_active ?? true,
    budget_allowed: head?.budget_allowed ?? true,
    actual_expense_allowed: head?.actual_expense_allowed ?? true,
  });

  useEffect(() => {
    setForm({
      name: head?.name ?? "",
      code: head?.code ?? "",
      description: head?.description ?? "",
      is_active: head?.is_active ?? true,
      budget_allowed: head?.budget_allowed ?? true,
      actual_expense_allowed: head?.actual_expense_allowed ?? true,
    });
  }, [head?.id, head?.name, head?.code, head?.description, head?.is_active, head?.budget_allowed, head?.actual_expense_allowed]);

  useEffect(() => {
    if (!head) {
      setForm({
        name: "",
        code: "",
        description: "",
        is_active: true,
        budget_allowed: true,
        actual_expense_allowed: true,
      });
    }
  }, [head, resetKey]);

  return (
    <tr className={`border-t align-top dark:border-gray-800 ${!head ? "bg-indigo-50/40 dark:bg-indigo-950/10" : ""}`}>
      <td className="px-3 py-3">
        <Input
          value={form.code}
          disabled={!canEdit || isSaving}
          onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
          placeholder="CODE"
          className="h-9 min-w-[110px] font-mono uppercase"
          aria-label="Finance head code"
        />
      </td>
      <td className="px-3 py-3">
        <Input
          value={form.name}
          disabled={!canEdit || isSaving}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Head name"
          className="h-9 min-w-[160px]"
          aria-label="Finance head name"
        />
      </td>
      <td className="px-3 py-3">
        <Textarea
          value={form.description}
          disabled={!canEdit || isSaving}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Optional description"
          rows={2}
          className="min-w-[220px] resize-none overflow-y-auto"
          style={{ height: "60px", minHeight: "60px", maxHeight: "60px" }}
          aria-label="Finance head description"
        />
      </td>
      {(["is_active", "budget_allowed", "actual_expense_allowed"] as const).map((key) => (
        <td key={key} className="px-3 py-3 text-center">
          <input
            type="checkbox"
            checked={form[key]}
            disabled={!canEdit || isSaving}
            onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            aria-label={`${key.replace(/_/g, " ")} for ${form.name || "new finance head"}`}
          />
        </td>
      ))}
      <td className="px-3 py-3 text-right">
        <div className="flex min-w-[130px] justify-end gap-1">
          <Button
            size="sm"
            variant={head ? "outline" : "default"}
            disabled={!canEdit || isSaving || !form.name.trim() || !form.code.trim()}
            onClick={() => onSave({ ...form, id: head?.id })}
          >
            <Save className="mr-1 h-3.5 w-3.5" /> {head ? "Save" : "Add"}
          </Button>
          {head && (
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete(head.id)} disabled={!canEdit || isDeleting}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ProjectSettingsPanel({ project, users, clients, members, onNavigate }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [general, setGeneral] = useState({
    name: project.name,
    project_code: (project as any).project_code ?? "",
    description: project.description ?? "",
    project_type: project.project_type,
    status: project.status,
    start_date: project.start_date ? new Date(project.start_date).toISOString().slice(0, 10) : "",
    projected_end_date: project.projected_end_date ? new Date(project.projected_end_date).toISOString().slice(0, 10) : "",
    currency: project.currency ?? "USD",
    client_id: (project as any).client_id ?? "",
  });
  const [managerId, setManagerId] = useState("");
  const [pendingDisable, setPendingDisable] = useState<{ path: string; label: string; description: string } | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/projects", project.id, "settings"],
    queryFn: () => apiClient.get(`/projects/${project.id}/settings`),
    refetchOnMount: "always",
  });

  const { data: organizationSettings } = useQuery<any>({
    queryKey: ["/api/organization-settings"],
    queryFn: () => apiClient.get("/organization-settings"),
    refetchOnMount: "always",
  });

  const financeHeads = data?.financeHeads ?? [];
  const resourceCosts = data?.resourceCosts ?? [];
  const organizationCurrency = organizationSettings?.currency ?? data?.organizationCurrency ?? "USD";
  const audit = data?.audit ?? [];
  const activeMembers = useMemo(
    () => members.filter((member) => member.is_active !== false),
    [members],
  );
  const internalMembers = useMemo(
    () => activeMembers.filter((member) => (member as any).member_user_type !== "client_contact" && member.user_id),
    [activeMembers],
  );
  const isDirty = useMemo(() => JSON.stringify({ settings, general, managerId }) !== initialSnapshot, [settings, general, managerId, initialSnapshot]);

  useEffect(() => {
    if (!data) return;
    const nextSettings = mergeSettings(data.settings);
    const currentManager = activeMembers.find((member) => member.member_type === "project_manager");
    const nextManagerId = currentManager?.user_id ?? "";
    const nextGeneral = {
      name: data.project?.name ?? project.name,
      project_code: data.project?.project_code ?? (project as any).project_code ?? "",
      description: data.project?.description ?? project.description ?? "",
      project_type: data.project?.project_type ?? project.project_type,
      status: data.project?.status ?? project.status,
      start_date: data.project?.start_date ? new Date(data.project.start_date).toISOString().slice(0, 10) : "",
      projected_end_date: data.project?.projected_end_date ? new Date(data.project.projected_end_date).toISOString().slice(0, 10) : "",
      currency: data.project?.currency ?? project.currency ?? "USD",
      client_id: data.project?.client_id ?? (project as any).client_id ?? "",
    };
    setSettings(nextSettings);
    setGeneral(nextGeneral);
    setManagerId(nextManagerId);
    setInitialSnapshot(JSON.stringify({ settings: nextSettings, general: nextGeneral, managerId: nextManagerId }));
  }, [data, project, activeMembers]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.put(`/projects/${project.id}/settings`, {
      settings,
      managerId,
      projectUpdates: {
        name: general.name.trim(),
        project_code: general.project_code.trim() || null,
        description: general.description.trim() || null,
        project_type: general.project_type,
        status: general.status,
        start_date: general.start_date || null,
        projected_end_date: general.projected_end_date || null,
        currency: general.currency,
        client_id: general.client_id || null,
        client_name: general.client_id ? clients.find((client) => client.id === general.client_id)?.name ?? null : null,
      },
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      const nextGeneral = { ...general, name: result.project?.name ?? general.name };
      setGeneral(nextGeneral);
      setInitialSnapshot(JSON.stringify({ settings, general: nextGeneral, managerId }));
      toast({ title: "Settings saved successfully." });
    },
    onError: (error: any) => toast({ title: "Unable to save settings", description: error.message, variant: "destructive" }),
  });

  const financeHeadMutation = useMutation({
    mutationFn: (payload: { id?: string; name: string; code: string; description: string; is_active: boolean; budget_allowed: boolean; actual_expense_allowed: boolean }) => payload.id
      ? apiClient.put(`/projects/${project.id}/settings/finance-heads/${payload.id}`, payload)
      : apiClient.post(`/projects/${project.id}/settings/finance-heads`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "settings"] });
      toast({ title: "Finance head saved" });
    },
    onError: (error: any) => toast({ title: "Unable to save finance head", description: error.message, variant: "destructive" }),
  });

  const deleteFinanceHeadMutation = useMutation({
    mutationFn: (headId: string) => apiClient.delete(`/projects/${project.id}/settings/finance-heads/${headId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "settings"] });
      toast({ title: "Finance head deleted" });
    },
    onError: (error: any) => toast({ title: "Unable to delete finance head", description: error.message, variant: "destructive" }),
  });

  const resourceCostMutation = useMutation({
    mutationFn: (payload: { id?: string; user_id: string; gross_salary: string; effective_month: string }) => payload.id
      ? apiClient.put(`/projects/${project.id}/settings/resource-costs/${payload.id}`, {
        gross_salary: payload.gross_salary,
        effective_month: payload.effective_month,
      })
      : apiClient.post(`/projects/${project.id}/settings/resource-costs`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "settings"] });
      toast({ title: "Resource salary saved" });
    },
    onError: (error: any) => toast({ title: "Unable to save resource salary", description: error.message, variant: "destructive" }),
  });

  const deleteResourceCostMutation = useMutation({
    mutationFn: (costId: string) => apiClient.delete(`/projects/${project.id}/settings/resource-costs/${costId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "settings"] });
      toast({ title: "Resource salary record deleted" });
    },
    onError: (error: any) => toast({ title: "Unable to delete resource salary", description: error.message, variant: "destructive" }),
  });

  const updateSetting = (path: string, value: any) => setSettings((current) => setPath(current, path, value));
  const toggleSetting = (path: string, value: boolean, label: string, description: string) => {
    if (!value && Boolean(path.split(".").reduce((cursor: any, key) => cursor?.[key], settings))) {
      setPendingDisable({ path, label, description });
    } else {
      updateSetting(path, value);
    }
  };

  const displayUser = (userId: string | null) => {
    const user = users.find((candidate) => candidate.id === userId);
    return user?.user_name ?? user?.email ?? "Unknown user";
  };

  if (isLoading) {
    return <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">Loading project settings…</div>;
  }

  const financeEnabled = settings.finance.trackFinance;
  const planningEnabled = settings.planning.enabled;
  const workspaceEnabled = settings.collaboration.workspaceEnabled;
  const clientCollaborationEnabled = settings.collaboration.clientCollaboration;
  const defectsEnabled = settings.quality.defectManagement;
  const resourceCostManagementEnabled = financeEnabled && settings.finance.trackPeopleCost;
  const resourceCostEditingEnabled = resourceCostManagementEnabled && !isDirty;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-3 border-b border-gray-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-600" />
            <h1 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Project Settings</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure how <span className="font-medium text-gray-700 dark:text-gray-200">{project.name}</span> operates.
            {(project as any).project_code && <span className="ml-1 font-mono text-xs">· {(project as any).project_code}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
          <Button variant="outline" size="sm" disabled={!isDirty || saveMutation.isPending} onClick={() => {
            const nextSettings = mergeSettings(data?.settings);
            const nextGeneral = {
              name: data?.project?.name ?? project.name,
              project_code: data?.project?.project_code ?? (project as any).project_code ?? "",
              description: data?.project?.description ?? project.description ?? "",
              project_type: data?.project?.project_type ?? project.project_type,
              status: data?.project?.status ?? project.status,
              start_date: data?.project?.start_date ? new Date(data.project.start_date).toISOString().slice(0, 10) : "",
              projected_end_date: data?.project?.projected_end_date ? new Date(data.project.projected_end_date).toISOString().slice(0, 10) : "",
              currency: data?.project?.currency ?? project.currency ?? "USD",
              client_id: data?.project?.client_id ?? (project as any).client_id ?? "",
            };
            const nextManagerId = activeMembers.find((member) => member.member_type === "project_manager")?.user_id ?? "";
            setSettings(nextSettings); setGeneral(nextGeneral); setManagerId(nextManagerId);
            setInitialSnapshot(JSON.stringify({ settings: nextSettings, general: nextGeneral, managerId: nextManagerId }));
          }}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Discard
          </Button>
          <Button size="sm" disabled={!isDirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="mr-1.5 h-3.5 w-3.5" /> {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[205px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-full ${
                  activeTab === item.id ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {activeTab === item.id && <ChevronRight className="ml-auto hidden h-3.5 w-3.5 lg:block" />}
              </button>
            );
          })}
          <div className="mt-5 hidden rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400 lg:block">
            <Lock className="mb-2 h-4 w-4 text-gray-400" />
            Settings changes are permission-controlled and recorded for sensitive project configuration.
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
          {activeTab === "general" && (
            <>
              <SectionHeader eyebrow="Project configuration" title="General" description="Manage the project identity, ownership, lifecycle, dates, and visibility using the existing project records." />
              <Card>
                <CardHeader><CardTitle className="text-base">Project information</CardTitle><CardDescription>These values are part of the project itself and are reused throughout Tazq.</CardDescription></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Project Name</Label><Input value={general.name} onChange={(e) => setGeneral((current) => ({ ...current, name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Project Code</Label><Input value={general.project_code} placeholder="Unique project code" onChange={(e) => setGeneral((current) => ({ ...current, project_code: e.target.value.toUpperCase() }))} /><p className="text-xs text-gray-500">Codes are unique across projects.</p></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Project Description</Label><Textarea value={general.description} rows={3} onChange={(e) => setGeneral((current) => ({ ...current, description: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Project Type</Label><Select value={general.project_type} onValueChange={(value) => setGeneral((current) => ({ ...current, project_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Project Manager</Label><Select value={managerId || "unassigned"} onValueChange={(value) => setManagerId(value === "unassigned" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">No manager assigned</SelectItem>{internalMembers.map((member) => <SelectItem key={member.user_id} value={member.user_id!}>{displayUser(member.user_id)}</SelectItem>)}</SelectContent></Select><p className="text-xs text-gray-500">Only existing project members can be promoted to manager.</p></div>
                  <div className="space-y-1.5"><Label>Client</Label><Select value={general.client_id || "none"} onValueChange={(value) => setGeneral((current) => ({ ...current, client_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No client</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Project Status</Label><Select value={general.status} onValueChange={(value) => setGeneral((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Dates, visibility & locale</CardTitle><CardDescription>Dates are validated on the server; planned start cannot be after the target end.</CardDescription></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5"><Label><Calendar className="mr-1 inline h-3.5 w-3.5" />Planned Start</Label><Input type="date" value={general.start_date} onChange={(e) => setGeneral((current) => ({ ...current, start_date: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label><Calendar className="mr-1 inline h-3.5 w-3.5" />Target End</Label><Input type="date" value={general.projected_end_date} onChange={(e) => setGeneral((current) => ({ ...current, projected_end_date: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Visibility</Label><Select value={settings.visibility} onValueChange={(value) => updateSetting("visibility", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="organization">Organization</SelectItem><SelectItem value="client">Client</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Time Zone</Label><Select value={settings.timeZone} onValueChange={(value) => updateSetting("timeZone", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIME_ZONES.map((zone) => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1"><Label>Currency</Label><Select value={general.currency} onValueChange={(value) => setGeneral((current) => ({ ...current, currency: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent></Select></div>
                </CardContent>
              </Card>
              {audit.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-gray-400" />Recent configuration changes</CardTitle></CardHeader><CardContent className="space-y-3">{audit.slice(0, 5).map((entry: any) => <div key={entry.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0 dark:border-gray-800"><div><p className="text-sm font-medium">{settingLabel(entry.setting_key)}</p><p className="text-xs text-gray-500">{entry.previous_value == null ? "Not set" : JSON.stringify(entry.previous_value)} → {JSON.stringify(entry.new_value)}</p></div><span className="shrink-0 text-[11px] text-gray-400">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</span></div>)}</CardContent></Card>}
            </>
          )}

          {activeTab === "planning" && (
            <>
              <SectionHeader eyebrow="How work is planned" title="Planning" description="Choose the planning approach for this project. Manual planning is fully supported today, while the methodology field is versioned for future engines." />
              <Card><CardHeader><CardTitle className="text-base">Planning controls</CardTitle></CardHeader><CardContent className="space-y-3">
                <ToggleRow label="Planning enabled" description="Make the Planning workspace available for this project." checked={planningEnabled} onChange={(value) => toggleSetting("planning.enabled", value, "Disable Planning?", "Existing planning data will be retained, but Planning will be hidden from this project until enabled again.")} />
                <div className={`grid gap-4 rounded-lg border p-4 sm:grid-cols-2 ${!planningEnabled ? "opacity-60" : ""}`}>
                  <div className="space-y-1.5"><Label>Planning Methodology</Label><Select disabled={!planningEnabled} value={settings.planning.methodology} onValueChange={(value) => updateSetting("planning.methodology", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METHODOLOGIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Default Planning Granularity</Label><Select disabled={!planningEnabled} value={settings.planning.granularity} onValueChange={(value) => updateSetting("planning.granularity", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GRANULARITIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="sm:col-span-2"><Button variant="outline" size="sm" disabled={!planningEnabled} onClick={() => onNavigate("planning")}><Cog className="mr-1.5 h-3.5 w-3.5" /> Configure Methodology</Button><p className="mt-1.5 text-xs text-gray-500">Manual methodology is configured directly in the Planning workspace. Other methodologies are stored as project configuration for future plug-ins.</p></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ToggleRow label="Allow AI Planning" description="Allow proposals to be generated from project context." checked={settings.planning.allowAiPlanning} disabled={!planningEnabled} disabledReason="Enable Planning to change this setting." onChange={(value) => updateSetting("planning.allowAiPlanning", value)} />
                  <ToggleRow label="Allow Planning Approval" description="Require a review step before proposed changes are applied." checked={settings.planning.allowPlanningApproval} disabled={!planningEnabled} disabledReason="Enable Planning to change this setting." onChange={(value) => updateSetting("planning.allowPlanningApproval", value)} />
                  {(["allowPhases", "allowStages", "allowMilestones", "allowFeatureGroups", "allowUserStories", "allowDependencies"] as const).map((key) => <ToggleRow key={key} label={`Allow ${settingLabel(key.replace("allow", ""))}`} description={`Make ${settingLabel(key.replace("allow", "").toLowerCase())} available in project planning.`} checked={settings.planning[key]} disabled={!planningEnabled} disabledReason="Enable Planning to change this setting." onChange={(value) => updateSetting(`planning.${key}`, value)} />)}
                </div>
                </CardContent></Card></>
          )}

          {activeTab === "finance" && (
            <>
              <SectionHeader eyebrow="Financial intelligence" title="Finance" description="Control project financial visibility and categories without turning Tazq into an accounting system. Disabling Finance never deletes existing data." />
              <Card><CardHeader><CardTitle className="text-base">Finance tracking</CardTitle></CardHeader><CardContent className="space-y-3">
                <ToggleRow label="Track Finance" description="Show Finance for this project and enable project financial workflows." checked={financeEnabled} onChange={(value) => toggleSetting("finance.trackFinance", value, "Disable Finance?", "Finance will be hidden and related workflows will stop. Existing finance data is retained and will return when Finance is enabled again.")} />
                <ToggleRow label="Track People Cost" description="Calculate resource cost from hours worked multiplied by internal cost rate." checked={settings.finance.trackPeopleCost} disabled={!financeEnabled} disabledReason="Enable Finance to change people cost tracking." onChange={(value) => updateSetting("finance.trackPeopleCost", value)} />
              </CardContent></Card>
              <Card className={!financeEnabled ? "opacity-60" : ""}><CardHeader><CardTitle className="text-base">People cost visibility</CardTitle><CardDescription>Do not expose internal cost information to project members or clients by default.</CardDescription></CardHeader><CardContent><RolePicker value={settings.finance.peopleCostVisibility} disabled={!financeEnabled || !settings.finance.trackPeopleCost} onChange={(value) => updateSetting("finance.peopleCostVisibility", value)} /></CardContent></Card>
               <Card className={!resourceCostManagementEnabled ? "opacity-75" : ""}>
                 <CardHeader>
                   <CardTitle className="text-base">Resource gross salary</CardTitle>
                   <CardDescription>
                     Every active internal project resource is listed below. Enter gross salary in the organization currency ({organizationCurrency}) and select the month from which it applies.
                   </CardDescription>
                 </CardHeader>
                 <CardContent>
                   {!resourceCostManagementEnabled ? (
                     <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">Enable Finance and Track People Cost to open the resource table.</p>
                   ) : internalMembers.length === 0 ? (
                     <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">Add an internal project member to enter resource salary details.</p>
                   ) : (
                     <div className="overflow-x-auto rounded-lg border">
                       <table className="w-full min-w-[720px] text-left text-sm">
                         <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
                           <tr>
                             <th className="px-3 py-3 font-medium">Resource</th>
                             <th className="px-3 py-3 font-medium">Gross salary</th>
                             <th className="px-3 py-3 font-medium">Effective month</th>
                             <th className="px-3 py-3 text-right font-medium">Actions</th>
                           </tr>
                         </thead>
                         <tbody>
                           {internalMembers.map((member) => (
                             <ResourceSalaryRows
                               key={member.id}
                               resourceName={displayUser(member.user_id)}
                               userId={member.user_id!}
                               records={resourceCosts.filter((record: any) => record.user_id === member.user_id)}
                               currency={organizationCurrency}
                               canEdit={resourceCostEditingEnabled}
                               onSave={(payload) => resourceCostMutation.mutate(payload)}
                               onDelete={(costId) => deleteResourceCostMutation.mutate(costId)}
                               isSaving={resourceCostMutation.isPending}
                               isDeleting={deleteResourceCostMutation.isPending}
                             />
                           ))}
                         </tbody>
                       </table>
                     </div>
                   )}
                   {isDirty && resourceCostManagementEnabled && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Save the Finance settings above before editing salary values.</p>}
                   <p className="mt-3 text-xs text-gray-500">Adding a new salary change creates a new effective-dated record. Earlier months continue using the previous salary.</p>
                 </CardContent>
               </Card>
              <Card className={!financeEnabled ? "opacity-60" : ""}><CardHeader><CardTitle className="text-base">Finance visibility</CardTitle><CardDescription>Finance being enabled does not automatically make every financial measure visible.</CardDescription></CardHeader><CardContent className="space-y-4">{([["budget", "Project Budget"], ["expenses", "Project Expenses"], ["resourceCost", "Resource Cost"], ["profitability", "Profitability / Margin"]] as const).map(([key, label]) => <div key={key}><Label className="mb-2 block text-sm">{label}</Label><RolePicker value={settings.finance.visibility[key]} disabled={!financeEnabled} onChange={(value) => updateSetting(`finance.visibility.${key}`, value)} /></div>)}</CardContent></Card>
              <Card className={!financeEnabled ? "opacity-60" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">Finance Heads</CardTitle>
                  <CardDescription>Project-level categories used by future budgets and expense records. Add and edit them directly in the table.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!financeEnabled ? (
                    <p className="rounded-lg border border-dashed p-5 text-center text-sm text-gray-500">Enable Finance to manage finance heads.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[1050px] text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-3 font-medium">Code</th>
                            <th className="px-3 py-3 font-medium">Name</th>
                            <th className="px-3 py-3 font-medium">Description</th>
                            <th className="px-3 py-3 text-center font-medium">Active</th>
                            <th className="px-3 py-3 text-center font-medium">Budget</th>
                            <th className="px-3 py-3 text-center font-medium">Expenses</th>
                            <th className="px-3 py-3 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financeHeads.map((head: any) => (
                            <FinanceHeadRow
                              key={head.id}
                              head={head}
                              canEdit={financeEnabled}
                              onSave={(payload) => financeHeadMutation.mutate(payload)}
                              onDelete={(headId) => deleteFinanceHeadMutation.mutate(headId)}
                              isSaving={financeHeadMutation.isPending}
                              isDeleting={deleteFinanceHeadMutation.isPending}
                            />
                          ))}
                          <FinanceHeadRow
                            key="new-finance-head"
                            resetKey={financeHeads.length}
                            canEdit={financeEnabled}
                            onSave={(payload) => financeHeadMutation.mutate(payload)}
                            onDelete={() => undefined}
                            isSaving={financeHeadMutation.isPending}
                            isDeleting={deleteFinanceHeadMutation.isPending}
                          />
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-gray-500">Use the blank row to add a finance head. Code and name are required; descriptions and checkbox values can be changed inline.</p>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "quality" && (
            <>
              <SectionHeader eyebrow="Delivery controls" title="Quality & Delivery" description="Choose which quality workflows are available for this project. Existing defects and test cases are retained when a module is disabled." />
              <Card><CardHeader><CardTitle className="text-base">Quality modules</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><ToggleRow label="Defect Management" description="Show the project Defects area." checked={defectsEnabled} onChange={(value) => toggleSetting("quality.defectManagement", value, "Disable Defect Management?", "Existing defects will be retained, but the Defects area will be hidden until enabled again.")} /><ToggleRow label="Test Case Management" description="Reserve this project for test-case workflows when available." checked={settings.quality.testCaseManagement} onChange={(value) => toggleSetting("quality.testCaseManagement", value, "Disable Test Case Management?", "Existing test cases will be retained, but test-case workflows will be hidden until enabled again.")} /><ToggleRow label="Allow Client Defect Creation" description="Allow client users to report defects for this project." checked={settings.quality.allowClientDefectCreation} disabled={!defectsEnabled} disabledReason="Enable Defect Management first." onChange={(value) => updateSetting("quality.allowClientDefectCreation", value)} /><ToggleRow label="Allow Client Test Case Visibility" description="Allow clients to view project test cases." checked={settings.quality.allowClientTestCaseVisibility} disabled={!settings.quality.testCaseManagement} disabledReason="Enable Test Case Management first." onChange={(value) => updateSetting("quality.allowClientTestCaseVisibility", value)} /><ToggleRow label="Allow Client Test Execution" description="Allow clients to execute visible test cases." checked={settings.quality.allowClientTestExecution} disabled={!settings.quality.testCaseManagement} disabledReason="Enable Test Case Management first." onChange={(value) => updateSetting("quality.allowClientTestExecution", value)} /></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Delivery gates</CardTitle><CardDescription>Stored as project configuration for enforcement as delivery workflows mature.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><ToggleRow label="Require Test Cases for Feature Completion" description="Mark a feature complete only after its test cases are satisfied." checked={settings.quality.requireTestCasesForFeatureCompletion} onChange={(value) => updateSetting("quality.requireTestCasesForFeatureCompletion", value)} /><ToggleRow label="Require Test Cases for Milestone Completion" description="Mark a milestone complete only after its test cases are satisfied." checked={settings.quality.requireTestCasesForMilestoneCompletion} onChange={(value) => updateSetting("quality.requireTestCasesForMilestoneCompletion", value)} /><ToggleRow label="Require Resolved Defects before Milestone Closure" description="Prevent milestone closure while linked defects remain unresolved." checked={settings.quality.requireDefectsResolvedForMilestoneClosure} disabled={!defectsEnabled} disabledReason="Enable Defect Management first." onChange={(value) => updateSetting("quality.requireDefectsResolvedForMilestoneClosure", value)} /></CardContent></Card>
            </>
          )}

          {activeTab === "release-management" && (
            <>
              <SectionHeader eyebrow="Delivery operations" title="Release Management" description="Control whether this project exposes the Release workspace in its project menu." />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Release workflow</CardTitle>
                  <CardDescription>Release data and workflows remain project-scoped and are retained if access is later disabled.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ToggleRow
                    label="Release Management"
                    description="Show Release in the project menu."
                    checked={settings.releaseManagement.enabled}
                    onChange={(value) => toggleSetting("releaseManagement.enabled", value, "Disable Release Management?", "Release will be hidden from the project menu until enabled again.")}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "collaboration" && (
            <>
              <SectionHeader eyebrow="Contextual collaboration" title="Collaboration" description="Configure the existing Project Workspace and client capabilities. Workspace data is never deleted when access is disabled." />
              <Card><CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><ToggleRow label="Workspace Enabled" description="Show Project Workspace in the project navigation." checked={workspaceEnabled} onChange={(value) => toggleSetting("collaboration.workspaceEnabled", value, "Disable Workspace?", "Workspace will be hidden from navigation. Existing messages, decisions, and attachments will be retained.")} /><ToggleRow label="Internal Collaboration" description="Allow internal project members to use the existing Workspace." checked={settings.collaboration.internalCollaboration} disabled={!workspaceEnabled} disabledReason="Enable Workspace first." onChange={(value) => updateSetting("collaboration.internalCollaboration", value)} /><ToggleRow label="Client Collaboration" description="Allow client participants to collaborate in this project Workspace." checked={clientCollaborationEnabled} disabled={!workspaceEnabled || !general.client_id} disabledReason={!general.client_id ? "Associate a client with this project first." : "Enable Workspace first."} onChange={(value) => toggleSetting("collaboration.clientCollaboration", value, "Disable Client Collaboration?", "Client participation in Workspace will stop; internal collaboration continues normally.")} /></CardContent></Card>
              <Card className={!workspaceEnabled || !clientCollaborationEnabled ? "opacity-60" : ""}><CardHeader><CardTitle className="text-base">Client capabilities</CardTitle><CardDescription>These controls apply only when a client is associated and Client Collaboration is enabled.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><ToggleRow label="Client Comments" description="Allow client users to comment in Workspace." checked={settings.collaboration.clientComments} disabled={!workspaceEnabled || !clientCollaborationEnabled} disabledReason="Enable Client Collaboration first." onChange={(value) => updateSetting("collaboration.clientComments", value)} /><ToggleRow label="Client File Upload" description="Allow client users to upload Workspace files." checked={settings.collaboration.clientFileUpload} disabled={!workspaceEnabled || !clientCollaborationEnabled} disabledReason="Enable Client Collaboration first." onChange={(value) => updateSetting("collaboration.clientFileUpload", value)} /><ToggleRow label="Client Defect Creation" description="Allow clients to create defects from project collaboration." checked={settings.collaboration.clientDefectCreation} disabled={!workspaceEnabled || !clientCollaborationEnabled || !defectsEnabled} disabledReason={!defectsEnabled ? "Enable Defect Management first." : "Enable Client Collaboration first."} onChange={(value) => updateSetting("collaboration.clientDefectCreation", value)} /><ToggleRow label="Client Activity Visibility" description="Show project activity to client participants." checked={settings.collaboration.clientActivityVisibility} disabled={!workspaceEnabled || !clientCollaborationEnabled} disabledReason="Enable Client Collaboration first." onChange={(value) => updateSetting("collaboration.clientActivityVisibility", value)} /><ToggleRow label="Client Decision Visibility" description="Show project decisions to client participants." checked={settings.collaboration.clientDecisionVisibility} disabled={!workspaceEnabled || !clientCollaborationEnabled} disabledReason="Enable Client Collaboration first." onChange={(value) => updateSetting("collaboration.clientDecisionVisibility", value)} /><ToggleRow label="Client Workspace Access" description="Allow clients to open the project Workspace." checked={settings.collaboration.clientWorkspaceAccess} disabled={!workspaceEnabled || !clientCollaborationEnabled} disabledReason="Enable Client Collaboration first." onChange={(value) => updateSetting("collaboration.clientWorkspaceAccess", value)} /></CardContent></Card>
            </>
          )}

          {activeTab === "access" && (
            <>
              <SectionHeader eyebrow="Project access" title="Access" description="Use the existing project membership and role system. This screen does not create a second authorization framework." />
              <Card><CardHeader><CardTitle className="text-base">Project access</CardTitle><CardDescription>Visibility controls who can discover the project; permissions still come from existing roles and memberships.</CardDescription></CardHeader><CardContent><div className="max-w-sm"><Label>Project Visibility</Label><Select value={settings.visibility} onValueChange={(value) => updateSetting("visibility", value)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private · explicit members only</SelectItem><SelectItem value="organization">Organization · subject to permissions</SelectItem><SelectItem value="client">Client · subject to client permissions</SelectItem></SelectContent></Select></div></CardContent></Card>
              <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">Project members</CardTitle><CardDescription>Current members are managed by the existing Members module.</CardDescription></div><Button variant="outline" size="sm" onClick={() => onNavigate("members")}><Users className="mr-1.5 h-3.5 w-3.5" /> Manage Members</Button></div></CardHeader><CardContent>{activeMembers.length === 0 ? <p className="text-sm text-gray-500">No active members assigned.</p> : <div className="space-y-2">{activeMembers.map((member) => <div key={member.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">{(member as any).member_user_type === "client_contact" ? "Client contact" : displayUser(member.user_id)}</p><p className="text-xs text-gray-500">{member.project_role || "Project member"} · {member.member_type === "project_manager" ? "Project Manager" : "Member"}</p></div><Badge variant="outline">{member.is_active === false ? "Inactive" : "Active"}</Badge></div>)}</div>}</CardContent></Card>
              <Card><CardContent className="flex items-start gap-3 pt-6"><Shield className="mt-0.5 h-4 w-4 text-indigo-500" /><div><p className="text-sm font-medium">Manage Permissions</p><p className="mt-1 text-xs leading-5 text-gray-500">Organization roles and permission levels remain in the existing Tazq permission system.</p><Button variant="link" className="h-auto px-0 pt-2 text-xs" onClick={() => window.location.assign("/admin/roles-permissions")}>Open permission management <ChevronRight className="ml-1 inline h-3 w-3" /></Button></div></CardContent></Card>
            </>
          )}

          {activeTab === "notifications" && (
            <>
              <SectionHeader eyebrow="Project alerts" title="Notifications" description="Control project-level in-app notifications. Email and push channels are not exposed until the existing notification infrastructure supports them." />
              <Card><CardHeader><CardTitle className="text-base">In-app notifications</CardTitle><CardDescription>Each event is independently configurable.</CardDescription></CardHeader><CardContent className="space-y-2">{NOTIFICATION_EVENTS.map(([key, label]) => <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-3"><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-gray-500">In-app</p></div><input type="checkbox" checked={settings.notifications[key]?.enabled ?? true} onChange={(event) => updateSetting(`notifications.${key}`, { enabled: event.target.checked, channels: ["in_app"] })} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></div>)}</CardContent></Card>
            </>
          )}

          {activeTab === "customization" && (
            <>
              <SectionHeader eyebrow="Extensibility" title="Customization" description="Project Settings connects to the existing Custom Fields system. Field definitions and values are not duplicated here." />
              <Card><CardHeader><CardTitle className="text-base">Project Custom Fields</CardTitle><CardDescription>Manage reusable field definitions for projects, tasks, features, user stories, defects, and test cases from the existing Custom Fields console.</CardDescription></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{["Project", "Task", "Feature", "User Story", "Defect", "Test Case"].map((module) => <div key={module} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><FileText className="h-4 w-4 text-gray-400" />{module} Custom Fields</div>)}</div><Button className="mt-5" onClick={() => window.location.assign("/admin/custom-fields")}><SlidersHorizontal className="mr-1.5 h-4 w-4" /> Manage Custom Fields</Button></CardContent></Card>
              <Card><CardContent className="flex items-start gap-3 pt-6"><BookOpen className="mt-0.5 h-4 w-4 text-indigo-500" /><div><p className="text-sm font-medium">One shared field engine</p><p className="mt-1 text-xs leading-5 text-gray-500">Searchable, reportable, validation, defaults, and active/inactive behavior continue to be managed by the existing Custom Fields module.</p></div></CardContent></Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!pendingDisable} onOpenChange={(open) => !open && setPendingDisable(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pendingDisable?.label}</DialogTitle><DialogDescription>{pendingDisable?.description}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setPendingDisable(null)}>Cancel</Button><Button variant="destructive" onClick={() => { if (pendingDisable) updateSetting(pendingDisable.path, false); setPendingDisable(null); }}>{pendingDisable?.label?.replace("?", "")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}