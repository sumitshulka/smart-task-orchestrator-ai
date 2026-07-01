import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  SlidersHorizontal, Plus, Pencil, Search, X, Trash2,
  Power, PowerOff, Info, ChevronUp, ChevronDown, Layers, FolderPlus, Copy,
} from "lucide-react";
import { useCurrentUserRoleAndTeams } from "@/hooks/useCurrentUserRoleAndTeams";

// ─── Types ────────────────────────────────────────────────────────────────────
type UiFieldType =
  | "text" | "textarea" | "number" | "decimal"
  | "date" | "datetime" | "select" | "multiselect"
  | "checkbox" | "yesno" | "user_reference";

interface FieldOption {
  value: string;
  label: string;
  color: string;
  is_active: boolean;
}

interface CustomField {
  id: string;
  module: string;
  field_group_id: string | null;
  field_key: string;
  field_type: string;
  label: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
  is_system: boolean;
  is_searchable: boolean;
  is_reportable: boolean;
  display_order: number;
  options: FieldOption[] | null;
  validation_rules: Record<string, any> | null;
  created_at: string;
}

interface FieldGroup { id: string; module: string; name: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const FIELD_TYPES: { value: UiFieldType; label: string; desc: string }[] = [
  { value: "text",           label: "Text",         desc: "Single-line text input" },
  { value: "textarea",       label: "Long Text",    desc: "Multi-line text area" },
  { value: "number",         label: "Number",       desc: "Whole numbers only" },
  { value: "decimal",        label: "Decimal",      desc: "Numbers with decimal places" },
  { value: "date",           label: "Date",         desc: "Date picker (no time)" },
  { value: "datetime",       label: "Date & Time",  desc: "Date and time picker" },
  { value: "select",         label: "Dropdown",     desc: "Single selection from a list" },
  { value: "multiselect",    label: "Multi Select", desc: "Multiple selections from a list" },
  { value: "checkbox",       label: "Checkbox",     desc: "True / False toggle" },
  { value: "yesno",          label: "Yes / No",     desc: "Explicit Yes or No choice" },
  { value: "user_reference", label: "User Picker",  desc: "Pick a user from the system" },
];

const MODULES = [
  { value: "task",    label: "Task" },
  { value: "project", label: "Project" },
  { value: "defect",  label: "Defect" },
];

const OPTION_COLORS = [
  "#6b7280","#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#3b82f6","#6366f1","#8b5cf6","#ec4899",
];

const MODULE_BADGE: Record<string, string> = {
  task:    "bg-blue-100 text-blue-700 border-blue-200",
  project: "bg-purple-100 text-purple-700 border-purple-200",
  defect:  "bg-red-100 text-red-700 border-red-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUiType(f: CustomField): UiFieldType {
  if (f.field_type === "boolean")
    return f.validation_rules?.display === "yesno" ? "yesno" : "checkbox";
  return f.field_type as UiFieldType;
}

function uiTypeLabel(t: UiFieldType) {
  return FIELD_TYPES.find(x => x.value === t)?.label ?? t;
}

function toApiType(t: UiFieldType): string {
  return t === "checkbox" || t === "yesno" ? "boolean" : t;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 50);
}

// ─── FormState ────────────────────────────────────────────────────────────────
type FormState = {
  label: string; ui_type: UiFieldType; module: string;
  field_group_id: string; field_key: string; description: string;
  is_required: boolean; is_searchable: boolean; is_reportable: boolean; display_order: number;
  // text / textarea
  min_length: string; max_length: string; regex: string;
  // number / decimal
  min_value: string; max_value: string; decimal_places: string;
  // date / datetime
  past_only: boolean; future_only: boolean; min_date: string; max_date: string;
  // multiselect
  min_selections: string; max_selections: string;
  // options
  options: FieldOption[];
};

const emptyForm = (): FormState => ({
  label: "", ui_type: "text", module: "task", field_group_id: "",
  field_key: "", description: "", is_required: false, is_searchable: false, is_reportable: false, display_order: 0,
  min_length: "", max_length: "", regex: "",
  min_value: "", max_value: "", decimal_places: "",
  past_only: false, future_only: false, min_date: "", max_date: "",
  min_selections: "", max_selections: "",
  options: [],
});

function buildValidationRules(form: FormState): Record<string, any> | null {
  const r: Record<string, any> = {};
  if (form.ui_type === "text" || form.ui_type === "textarea") {
    if (form.min_length) r.min_length = Number(form.min_length);
    if (form.max_length) r.max_length = Number(form.max_length);
    if (form.ui_type === "text" && form.regex) r.regex = form.regex;
  }
  if (form.ui_type === "number" || form.ui_type === "decimal") {
    if (form.min_value) r.min_value = Number(form.min_value);
    if (form.max_value) r.max_value = Number(form.max_value);
    if (form.ui_type === "decimal" && form.decimal_places) r.decimal_places = Number(form.decimal_places);
  }
  if (form.ui_type === "date" || form.ui_type === "datetime") {
    if (form.past_only) r.past_only = true;
    if (form.future_only) r.future_only = true;
    if (form.ui_type === "date") {
      if (form.min_date) r.min_date = form.min_date;
      if (form.max_date) r.max_date = form.max_date;
    }
  }
  if (form.ui_type === "multiselect") {
    if (form.min_selections) r.min_selections = Number(form.min_selections);
    if (form.max_selections) r.max_selections = Number(form.max_selections);
  }
  if (form.ui_type === "checkbox") r.display = "checkbox";
  if (form.ui_type === "yesno")    r.display = "yesno";
  return Object.keys(r).length ? r : null;
}

function fieldToForm(f: CustomField): FormState {
  const uiType = getUiType(f);
  const vr = f.validation_rules ?? {};
  return {
    label: f.label, ui_type: uiType, module: f.module,
    field_group_id: f.field_group_id ?? "",
    field_key: f.field_key, description: f.description ?? "",
    is_required: f.is_required, is_searchable: !!f.is_searchable, is_reportable: !!f.is_reportable,
    display_order: f.display_order,
    min_length:    vr.min_length    != null ? String(vr.min_length)    : "",
    max_length:    vr.max_length    != null ? String(vr.max_length)    : "",
    regex:         vr.regex         ?? "",
    min_value:     vr.min_value     != null ? String(vr.min_value)     : "",
    max_value:     vr.max_value     != null ? String(vr.max_value)     : "",
    decimal_places:vr.decimal_places != null ? String(vr.decimal_places) : "",
    past_only: !!vr.past_only, future_only: !!vr.future_only,
    min_date: vr.min_date ?? "", max_date: vr.max_date ?? "",
    min_selections: vr.min_selections != null ? String(vr.min_selections) : "",
    max_selections: vr.max_selections != null ? String(vr.max_selections) : "",
    options: Array.isArray(f.options) ? f.options : [],
  };
}

// ─── Options Editor ───────────────────────────────────────────────────────────
function OptionsEditor({
  options, onChange,
}: {
  options: FieldOption[];
  onChange: (opts: FieldOption[]) => void;
}) {
  const addOption = () => {
    onChange([...options, { value: "", label: "", color: OPTION_COLORS[options.length % OPTION_COLORS.length], is_active: true }]);
  };

  const removeOption = (i: number) => onChange(options.filter((_, idx) => idx !== i));

  const updateOption = (i: number, patch: Partial<FieldOption>) => {
    const next = options.map((o, idx) => {
      if (idx !== i) return o;
      const updated = { ...o, ...patch };
      if (patch.label !== undefined && !updated.value) updated.value = slugify(patch.label);
      return updated;
    });
    onChange(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const nextColor = (current: string) => {
    const idx = OPTION_COLORS.indexOf(current);
    return OPTION_COLORS[(idx + 1) % OPTION_COLORS.length];
  };

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={() => move(i, -1)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20" disabled={i === 0}>
              <ChevronUp className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => move(i, 1)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20" disabled={i === options.length - 1}>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <button
            type="button"
            title="Click to change colour"
            onClick={() => updateOption(i, { color: nextColor(opt.color) })}
            className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
            style={{ backgroundColor: opt.color }}
          />
          <Input
            placeholder="Option label"
            value={opt.label}
            onChange={e => updateOption(i, { label: e.target.value })}
            className="flex-1 h-8 text-sm"
          />
          <Input
            placeholder="value"
            value={opt.value}
            onChange={e => updateOption(i, { value: e.target.value })}
            className="w-32 h-8 text-sm font-mono text-xs"
          />
          <button type="button" onClick={() => removeOption(i)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addOption} className="w-full mt-1 border-dashed">
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Option
      </Button>
      {options.length === 0 && (
        <p className="text-xs text-gray-400 text-center">No options yet. Click above to add the first one.</p>
      )}
    </div>
  );
}

// ─── NumInput & ToggleRow — defined at module level so React never remounts them ─
function NumInput({ label, field, placeholder, form, setForm }: {
  label: string;
  field: keyof FormState;
  placeholder?: string;
  form: FormState;
  setForm: (p: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input
        type="number"
        placeholder={placeholder ?? ""}
        value={form[field] as string}
        onChange={e => setForm({ [field]: e.target.value })}
        className="h-8 text-sm"
      />
    </div>
  );
}

function ToggleRow({ label, desc, field, form, setForm }: {
  label: string;
  desc: string;
  field: "past_only" | "future_only";
  form: FormState;
  setForm: (p: Partial<FormState>) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <Switch checked={form[field]} onCheckedChange={v => setForm({ [field]: v })} />
    </div>
  );
}

// ─── Validation Section ───────────────────────────────────────────────────────
function ValidationSection({ form, setForm }: { form: FormState; setForm: (p: Partial<FormState>) => void }) {
  const t = form.ui_type;

  if (t === "text") return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Min Length" field="min_length" placeholder="e.g. 3" form={form} setForm={setForm} />
        <NumInput label="Max Length" field="max_length" placeholder="e.g. 255" form={form} setForm={setForm} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">Regex Pattern</Label>
        <Input
          placeholder="e.g. ^[A-Z].*"
          value={form.regex}
          onChange={e => setForm({ regex: e.target.value })}
          className="h-8 text-sm font-mono"
        />
        <p className="text-xs text-gray-400">Optional regular expression the value must match.</p>
      </div>
    </div>
  );

  if (t === "textarea") return (
    <div className="grid grid-cols-2 gap-3">
      <NumInput label="Min Length" field="min_length" placeholder="e.g. 10" form={form} setForm={setForm} />
      <NumInput label="Max Length" field="max_length" placeholder="e.g. 2000" form={form} setForm={setForm} />
    </div>
  );

  if (t === "number" || t === "decimal") return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Min Value" field="min_value" placeholder="e.g. 0" form={form} setForm={setForm} />
        <NumInput label="Max Value" field="max_value" placeholder="e.g. 100" form={form} setForm={setForm} />
      </div>
      {t === "decimal" && (
        <NumInput label="Decimal Places" field="decimal_places" placeholder="e.g. 2" form={form} setForm={setForm} />
      )}
    </div>
  );

  if (t === "date") return (
    <div className="space-y-3">
      <ToggleRow label="Past Only" desc="Only allow dates in the past" field="past_only" form={form} setForm={setForm} />
      <ToggleRow label="Future Only" desc="Only allow dates in the future" field="future_only" form={form} setForm={setForm} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Min Date</Label>
          <Input type="date" value={form.min_date} onChange={e => setForm({ min_date: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Max Date</Label>
          <Input type="date" value={form.max_date} onChange={e => setForm({ max_date: e.target.value })} className="h-8 text-sm" />
        </div>
      </div>
    </div>
  );

  if (t === "datetime") return (
    <div className="space-y-2">
      <ToggleRow label="Past Only" desc="Only allow past date/times" field="past_only" form={form} setForm={setForm} />
      <ToggleRow label="Future Only" desc="Only allow future date/times" field="future_only" form={form} setForm={setForm} />
    </div>
  );

  if (t === "multiselect") return (
    <div className="grid grid-cols-2 gap-3">
      <NumInput label="Min Selections" field="min_selections" placeholder="e.g. 1" form={form} setForm={setForm} />
      <NumInput label="Max Selections" field="max_selections" placeholder="e.g. 5" form={form} setForm={setForm} />
    </div>
  );

  return (
    <p className="text-sm text-gray-400 text-center py-2">
      No validation rules for this field type.
    </p>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomFieldsPage() {
  const { roles } = useCurrentUserRoleAndTeams();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editField,  setEditField]    = useState<CustomField | null>(null);
  const [form, setFormRaw]            = useState<FormState>(emptyForm());
  const [keyManual, setKeyManual]     = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CustomField | null>(null);

  // ── Field Group management state ───────────────────────────────────────────
  const [groupsOpen,       setGroupsOpen]       = useState(false);
  const [groupDialogOpen,  setGroupDialogOpen]  = useState(false);
  const [editGroup,        setEditGroup]        = useState<FieldGroup | null>(null);
  const [groupForm,        setGroupForm]        = useState({ name: "", module: "task" });
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<FieldGroup | null>(null);

  // helper: partial update of form
  const setForm = (patch: Partial<FormState>) => setFormRaw(prev => ({ ...prev, ...patch }));

  // Auto-generate field key from label (unless user manually edited it)
  useEffect(() => {
    if (!keyManual && form.label) setForm({ field_key: slugify(form.label) });
  }, [form.label, keyManual]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: allFields = [], isLoading } = useQuery<CustomField[]>({
    queryKey: ["/api/custom-fields/definitions"],
    queryFn: () => apiClient.get("/custom-fields/definitions"),
  });

  // All groups (for the management panel)
  const { data: allGroups = [] } = useQuery<FieldGroup[]>({
    queryKey: ["/api/custom-fields/groups"],
    queryFn: () => apiClient.get("/custom-fields/groups"),
  });

  // Groups for the currently-selected module (used in the field form)
  const { data: groups = [] } = useQuery<FieldGroup[]>({
    queryKey: ["/api/custom-fields/groups", form.module],
    queryFn:  () => apiClient.get(`/custom-fields/groups?module=${form.module}`),
    enabled:  dialogOpen,
  });

  // ── Filtered list ─────────────────────────────────────────────────────────
  const fields = useMemo(() => {
    return allFields.filter(f => {
      const uiType = getUiType(f);
      const q = search.toLowerCase();
      const matchesSearch = !q || f.label.toLowerCase().includes(q) || f.field_key.toLowerCase().includes(q);
      const matchesModule = moduleFilter === "all" || f.module === moduleFilter;
      const matchesType   = typeFilter   === "all" || uiType === typeFilter;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active"   && f.is_active)
        || (statusFilter === "archived" && !f.is_active);
      return matchesSearch && matchesModule && matchesType && matchesStatus;
    });
  }, [allFields, search, moduleFilter, typeFilter, statusFilter]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/custom-fields/definitions"] });
  const invalidateGroups = () => {
    qc.invalidateQueries({ queryKey: ["/api/custom-fields/groups"] });
  };

  const createGroupMutation = useMutation({
    mutationFn: (payload: { name: string; module: string }) =>
      apiClient.post("/custom-fields/groups", payload),
    onSuccess: () => {
      invalidateGroups();
      toast({ title: "Field group created" });
      setGroupDialogOpen(false);
      setGroupForm({ name: "", module: "task" });
      setEditGroup(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string } }) =>
      apiClient.put(`/custom-fields/groups/${id}`, payload),
    onSuccess: () => {
      invalidateGroups();
      toast({ title: "Field group updated" });
      setGroupDialogOpen(false);
      setEditGroup(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/custom-fields/groups/${id}`),
    onSuccess: () => {
      invalidateGroups();
      invalidate(); // fields may have lost their group
      toast({ title: "Field group deleted" });
      setDeleteGroupTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openCreateGroup() {
    setEditGroup(null);
    setGroupForm({ name: "", module: "task" });
    setGroupDialogOpen(true);
  }

  function openEditGroup(g: FieldGroup) {
    setEditGroup(g);
    setGroupForm({ name: g.name, module: g.module });
    setGroupDialogOpen(true);
  }

  function handleGroupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupForm.name.trim()) return toast({ title: "Group name is required", variant: "destructive" });
    if (editGroup) {
      updateGroupMutation.mutate({ id: editGroup.id, payload: { name: groupForm.name } });
    } else {
      createGroupMutation.mutate(groupForm);
    }
  }

  // Groups by module for display
  const groupsByModule = useMemo(() => {
    const map: Record<string, FieldGroup[]> = {};
    for (const g of allGroups) {
      if (!map[g.module]) map[g.module] = [];
      map[g.module].push(g);
    }
    return map;
  }, [allGroups]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post("/custom-fields/definitions", payload),
    onSuccess: () => { invalidate(); toast({ title: "Field created" }); closeDialog(); },
    onError:   (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient.put(`/custom-fields/definitions/${id}`, payload),
    onSuccess: () => { invalidate(); toast({ title: "Field updated" }); closeDialog(); },
    onError:   (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.put(`/custom-fields/definitions/${id}`, { is_active }),
    onSuccess: (_data, vars) => {
      invalidate();
      toast({ title: vars.is_active ? "Field activated" : "Field archived" });
      setArchiveTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Dialog handlers ───────────────────────────────────────────────────────
  function openCreate() {
    setEditField(null);
    setFormRaw(emptyForm());
    setKeyManual(false);
    setDialogOpen(true);
  }

  function openEdit(f: CustomField) {
    setEditField(f);
    setFormRaw(fieldToForm(f));
    setKeyManual(true);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditField(null);
    setFormRaw(emptyForm());
    setKeyManual(false);
  }

  // ── Duplicate a field ─────────────────────────────────────────────────────
  function openDuplicate(f: CustomField) {
    // Strip any existing _N suffix from key/label before computing next suffix
    const baseKey   = f.field_key.replace(/_\d+$/, "");
    const baseLabel = f.label.replace(/\s+\d+$/, "");

    // Find the next free suffix by scanning existing field keys
    let suffix = 1;
    const existingKeys = new Set(allFields.map(x => x.field_key));
    while (existingKeys.has(`${baseKey}_${suffix}`)) suffix++;

    const newKey   = `${baseKey}_${suffix}`;
    const newLabel = `${baseLabel} ${suffix}`;

    // Pre-fill from the source field but treat it as a new (create) form
    setEditField(null);
    setFormRaw({ ...fieldToForm(f), label: newLabel, field_key: newKey });
    setKeyManual(true);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return toast({ title: "Label is required", variant: "destructive" });
    if (!form.field_key.trim()) return toast({ title: "Field key is required", variant: "destructive" });

    const payload: any = {
      module:         form.module,
      field_key:      form.field_key,
      field_type:     toApiType(form.ui_type),
      label:          form.label,
      description:    form.description || null,
      field_group_id: form.field_group_id || null,
      is_required:    form.is_required,
      is_searchable:  form.is_searchable,
      is_reportable:  form.is_reportable,
      display_order:  form.display_order,
      validation_rules: buildValidationRules(form),
      options: (form.ui_type === "select" || form.ui_type === "multiselect") && form.options.length
        ? form.options
        : null,
    };

    if (editField) {
      updateMutation.mutate({ id: editField.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const hasOptions = form.ui_type === "select" || form.ui_type === "multiselect";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Custom Fields</h1>
              <p className="text-sm text-gray-500">Define additional metadata fields for Tasks, Projects, and Defects</p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> New Field
            </Button>
          )}
        </div>

        {/* ── Field Groups Panel ─────────────────────────────────────────── */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            onClick={() => setGroupsOpen(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-800">Field Groups</span>
              <Badge variant="outline" className="text-xs px-1.5 py-0">{allGroups.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-indigo-600 hover:bg-indigo-50"
                  onClick={e => { e.stopPropagation(); openCreateGroup(); }}
                >
                  <FolderPlus className="w-3.5 h-3.5" /> New Group
                </Button>
              )}
              {groupsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {groupsOpen && (
            <div className="border-t px-4 py-3">
              {allGroups.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-gray-400 gap-2">
                  <Layers className="w-7 h-7 opacity-30" />
                  <p className="text-sm">No field groups yet.</p>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={openCreateGroup} className="mt-1 gap-1">
                      <FolderPlus className="w-3.5 h-3.5" /> Create first group
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {MODULES.map(mod => {
                    const modGroups = groupsByModule[mod.value] ?? [];
                    if (modGroups.length === 0) return null;
                    return (
                      <div key={mod.value}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{mod.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {modGroups.map(g => {
                            const fieldCount = allFields.filter(f => f.field_group_id === g.id).length;
                            return (
                              <div
                                key={g.id}
                                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 group"
                              >
                                <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="text-sm font-medium text-gray-700">{g.name}</span>
                                <span className="text-xs text-gray-400">({fieldCount})</span>
                                {isAdmin && (
                                  <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      className="p-0.5 rounded hover:bg-indigo-100 text-gray-400 hover:text-indigo-600"
                                      onClick={() => openEditGroup(g)}
                                      title="Rename group"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                                      onClick={() => setDeleteGroupTarget(g)}
                                      title="Delete group"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by label or key…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Field Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {fields.length} field{fields.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Label</TableHead>
                <TableHead className="font-semibold">Field Key</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Module</TableHead>
                <TableHead className="font-semibold text-center">Required</TableHead>
                <TableHead className="font-semibold text-center">Searchable</TableHead>
                <TableHead className="font-semibold text-center">Reportable</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <SlidersHorizontal className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No custom fields found</p>
                      {isAdmin && search === "" && (
                        <Button variant="outline" size="sm" onClick={openCreate} className="mt-1">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Create your first field
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : fields.map(f => {
                const uiType = getUiType(f);
                return (
                  <TableRow key={f.id} className={!f.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{f.label}</span>
                        {f.description && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-56 text-xs">{f.description}</TooltipContent>
                          </Tooltip>
                        )}
                        {f.is_system && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-600 bg-amber-50">System</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">{f.field_key}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {uiTypeLabel(uiType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs font-normal capitalize ${MODULE_BADGE[f.module] ?? ""}`}>
                        {f.module}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {f.is_required ? (
                        <span className="text-red-500 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.is_searchable ? (
                        <span className="text-blue-600 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.is_reportable ? (
                        <span className="text-purple-600 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400 text-xs">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && !f.is_system && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                                  onClick={() => openDuplicate(f)}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Duplicate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-8 w-8 ${f.is_active ? "text-gray-500 hover:text-amber-600" : "text-gray-400 hover:text-emerald-600"}`}
                                  onClick={() => f.is_active ? setArchiveTarget(f) : toggleActiveMutation.mutate({ id: f.id, is_active: true })}
                                >
                                  {f.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{f.is_active ? "Archive" : "Activate"}</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editField ? "Edit Custom Field" : "New Custom Field"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Section 1: Core ─────────────────────────────────────── */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>
                      Label <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Customer Tier"
                      value={form.label}
                      onChange={e => setForm({ label: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Field Type <span className="text-red-500">*</span></Label>
                    <Select
                      value={form.ui_type}
                      onValueChange={v => {
                        setForm({ ui_type: v as UiFieldType, options: [] });
                      }}
                      disabled={!!editField}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(ft => (
                          <SelectItem key={ft.value} value={ft.value}>
                            <div>
                              <div className="font-medium text-sm">{ft.label}</div>
                              <div className="text-xs text-gray-400">{ft.desc}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editField && (
                      <p className="text-xs text-gray-400">Field type cannot be changed after creation.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Module <span className="text-red-500">*</span></Label>
                    <Select
                      value={form.module}
                      onValueChange={v => setForm({ module: v, field_group_id: "" })}
                      disabled={!!editField}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Section 2: Identity ──────────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Field Identity</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Field Key <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="e.g. customer_tier"
                      value={form.field_key}
                      onChange={e => { setKeyManual(true); setForm({ field_key: slugify(e.target.value) }); }}
                      disabled={!!editField}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-400">Unique identifier within this module. Auto-generated from label.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Field Group</Label>
                    <Select value={form.field_group_id || "__none"} onValueChange={v => setForm({ field_group_id: v === "__none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="No group (standalone)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No group (standalone)</SelectItem>
                        {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Description / Help Text</Label>
                    <Textarea
                      placeholder="Optional hint shown below the field in forms"
                      value={form.description}
                      onChange={e => setForm({ description: e.target.value })}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.display_order}
                      onChange={e => setForm({ display_order: Number(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 border border-dashed border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between px-1">
                      <div>
                        <Label className="text-sm">Required field</Label>
                        <p className="text-xs text-gray-500">Won't submit without a value</p>
                      </div>
                      <Switch
                        checked={form.is_required}
                        onCheckedChange={v => setForm({ is_required: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between px-1 border-l border-gray-200 pl-3">
                      <div>
                        <Label className="text-sm text-blue-700">
                          Searchable <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-xs text-gray-500">Appears in Advanced Filters</p>
                      </div>
                      <Switch
                        checked={form.is_searchable}
                        onCheckedChange={v => setForm({ is_searchable: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between px-1 border-l border-gray-200 pl-3">
                      <div>
                        <Label className="text-sm text-purple-700">
                          Reportable <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-xs text-gray-500">Available in Report Builder</p>
                      </div>
                      <Switch
                        checked={form.is_reportable}
                        onCheckedChange={v => setForm({ is_reportable: v })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Section 3: Validation ────────────────────────────────── */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Validation Rules</p>
                <ValidationSection form={form} setForm={setForm} />
              </div>

              {/* ── Section 4: Options (Dropdown / Multi Select) ─────────── */}
              {hasOptions && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Options</p>
                      <p className="text-xs text-gray-400">Click colour dot to cycle colours · drag rows to reorder</p>
                    </div>
                    {form.options.length === 0 && (
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 flex-shrink-0" />
                        You must add at least one option before saving.
                      </div>
                    )}
                    <div className="text-xs text-gray-500 grid grid-cols-[20px_24px_1fr_128px_24px] gap-2 px-1">
                      <span></span><span></span>
                      <span>Label (shown to users)</span>
                      <span>Value (stored)</span>
                      <span></span>
                    </div>
                    <OptionsEditor
                      options={form.options}
                      onChange={opts => setForm({ options: opts })}
                    />
                  </div>
                </>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending || (hasOptions && form.options.length === 0)}>
                  {isPending ? "Saving…" : editField ? "Save Changes" : "Create Field"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Field Group Create / Edit Dialog ──────────────────────────────── */}
        <Dialog open={groupDialogOpen} onOpenChange={v => { if (!v) { setGroupDialogOpen(false); setEditGroup(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editGroup ? "Rename Group" : "New Field Group"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Group Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Customer Info"
                  value={groupForm.name}
                  onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              {!editGroup && (
                <div className="space-y-1.5">
                  <Label>Module <span className="text-red-500">*</span></Label>
                  <Select
                    value={groupForm.module}
                    onValueChange={v => setGroupForm(f => ({ ...f, module: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">Module cannot be changed after creation.</p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setGroupDialogOpen(false); setEditGroup(null); }}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
                >
                  {createGroupMutation.isPending || updateGroupMutation.isPending
                    ? "Saving…"
                    : editGroup ? "Save Changes" : "Create Group"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Field Group Delete Confirmation ───────────────────────────────── */}
        <AlertDialog open={!!deleteGroupTarget} onOpenChange={v => { if (!v) setDeleteGroupTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteGroupTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the group. Any fields currently in this group will become ungrouped — their values and settings will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteGroupTarget && deleteGroupMutation.mutate(deleteGroupTarget.id)}
              >
                Delete Group
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Archive Confirmation */}
        <AlertDialog open={!!archiveTarget} onOpenChange={v => { if (!v) setArchiveTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive "{archiveTarget?.label}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Archived fields are hidden from new forms but existing saved values are preserved.
                You can re-activate the field at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => archiveTarget && toggleActiveMutation.mutate({ id: archiveTarget.id, is_active: false })}
              >
                Archive Field
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
