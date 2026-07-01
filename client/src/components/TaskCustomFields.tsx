/**
 * TaskCustomFields — dynamic renderer for task-module custom field definitions.
 *
 * Usage:
 *   const cfRef = useRef<TaskCustomFieldsRef>(null);
 *   <TaskCustomFields ref={cfRef} open={open} taskId={task?.id} />
 *
 *   In handleSubmit:
 *     if (!cfRef.current?.validate()) return;
 *     await saveCfValues(cfRef.current.getPayload());
 */
import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { apiClient } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SlidersHorizontal } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FieldOption { value: string; label: string; color?: string; is_active?: boolean; }

interface CustomField {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  options: FieldOption[] | null;
  validation_rules: Record<string, any> | null;
}

export interface ApiFieldValue {
  field_definition_id: string;
  value_text:    string | null;
  value_number:  number | null;
  value_date:    string | null;
  value_boolean: boolean | null;
  value_json:    any | null;
}

export interface TaskCustomFieldsRef {
  validate:   () => boolean;
  getPayload: () => ApiFieldValue[];
  reset:      () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function getUiType(f: CustomField): string {
  if (f.field_type === "boolean")
    return f.validation_rules?.display === "yesno" ? "yesno" : "checkbox";
  return f.field_type;
}

function extractStoredValue(field: CustomField, stored: any): any {
  const t = field.field_type;
  if (t === "text" || t === "textarea" || t === "select" || t === "user_reference")
    return stored.value_text ?? "";
  if (t === "number" || t === "decimal")
    return stored.value_number != null ? String(stored.value_number) : "";
  if (t === "date")
    return stored.value_date ? String(stored.value_date).slice(0, 10) : "";
  if (t === "datetime")
    return stored.value_date ? String(stored.value_date).slice(0, 16) : "";
  if (t === "boolean")
    return stored.value_boolean ?? null;
  if (t === "multiselect")
    return Array.isArray(stored.value_json) ? stored.value_json : [];
  return null;
}

function buildApiValue(field: CustomField, value: any): ApiFieldValue {
  const t = field.field_type;
  return {
    field_definition_id: field.id,
    value_text:    (t === "text" || t === "textarea" || t === "select" || t === "user_reference")
                   ? (value || null) : null,
    value_number:  (t === "number" || t === "decimal")
                   ? (value !== "" && value != null ? Number(value) : null) : null,
    value_date:    (t === "date" || t === "datetime") ? (value || null) : null,
    value_boolean: (t === "boolean") ? (value != null ? Boolean(value) : null) : null,
    value_json:    (t === "multiselect") ? (Array.isArray(value) && value.length ? value : null) : null,
  };
}

// ─── FieldInput ───────────────────────────────────────────────────────────────
function FieldInput({
  field, uiType, value, error, users, onChange,
}: {
  field: CustomField;
  uiType: string;
  value: any;
  error?: string;
  users: { id: string; user_name: string | null; email: string }[];
  onChange: (v: any) => void;
}) {
  const options = Array.isArray(field.options)
    ? field.options.filter(o => o.is_active !== false)
    : [];

  const borderErr = error ? "border-red-500 focus:ring-red-500" : "";
  const isWide    = uiType === "textarea" || uiType === "multiselect";

  return (
    <div className={isWide ? "sm:col-span-2" : ""}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {field.label}
        {field.is_required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* ── Text ── */}
      {uiType === "text" && (
        <Input
          type="text"
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || field.description || ""}
          className={`h-12 text-base ${borderErr}`}
        />
      )}

      {/* ── Long Text ── */}
      {uiType === "textarea" && (
        <Textarea
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || field.description || ""}
          className={`text-base min-h-[80px] resize-y ${borderErr}`}
        />
      )}

      {/* ── Number / Decimal ── */}
      {(uiType === "number" || uiType === "decimal") && (
        <Input
          type="number"
          step={uiType === "decimal" ? "any" : "1"}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ""}
          className={`h-12 text-base ${borderErr}`}
        />
      )}

      {/* ── Date ── */}
      {uiType === "date" && (
        <Input
          type="date"
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className={`h-12 text-base ${borderErr}`}
        />
      )}

      {/* ── DateTime ── */}
      {uiType === "datetime" && (
        <Input
          type="datetime-local"
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className={`h-12 text-base ${borderErr}`}
        />
      )}

      {/* ── Dropdown ── */}
      {uiType === "select" && (
        <select
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className={`w-full h-12 text-base border rounded-lg px-4 focus:ring-2 focus:ring-blue-500 bg-white
            ${error ? "border-red-500" : "border-gray-300"}`}
        >
          <option value="">— Select —</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* ── Multi Select ── */}
      {uiType === "multiselect" && (
        <div className="space-y-2 mt-1">
          {options.map(opt => {
            const selected = Array.isArray(value) && value.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const cur = Array.isArray(value) ? value : [];
                    onChange(selected
                      ? cur.filter((v: string) => v !== opt.value)
                      : [...cur, opt.value]);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <p className="text-xs text-gray-400">No options configured for this field.</p>
          )}
        </div>
      )}

      {/* ── Checkbox ── */}
      {uiType === "checkbox" && (
        <div className="flex items-center gap-3 h-12">
          <input
            type="checkbox"
            id={`cf-cb-${field.id}`}
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor={`cf-cb-${field.id}`} className="text-sm text-gray-700 cursor-pointer select-none">
            {value ? "Checked" : "Unchecked"}
          </label>
        </div>
      )}

      {/* ── Yes / No ── */}
      {uiType === "yesno" && (
        <div className="flex items-center gap-3 h-12">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors
              ${value === true
                ? "bg-green-100 border-green-400 text-green-800"
                : "bg-white border-gray-300 text-gray-700 hover:bg-green-50"}`}
          >
            ✓ Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors
              ${value === false
                ? "bg-red-100 border-red-400 text-red-800"
                : "bg-white border-gray-300 text-gray-700 hover:bg-red-50"}`}
          >
            ✗ No
          </button>
          {value != null && (
            <button type="button" onClick={() => onChange(null)}
              className="text-xs text-gray-400 hover:text-gray-600 ml-1">
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── User Picker ── */}
      {uiType === "user_reference" && (
        <select
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className={`w-full h-12 text-base border rounded-lg px-4 focus:ring-2 focus:ring-blue-500 bg-white
            ${error ? "border-red-500" : "border-gray-300"}`}
        >
          <option value="">— Select a user —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.user_name ?? u.email}</option>
          ))}
        </select>
      )}

      {/* ── Help Text ── */}
      {field.description && !error && (
        <p className="text-xs text-gray-500 mt-1">{field.description}</p>
      )}

      {/* ── Error ── */}
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const TaskCustomFields = forwardRef<
  TaskCustomFieldsRef,
  { taskId?: string; open: boolean }
>(({ taskId, open }, ref) => {
  const [fields, setFields]   = useState<CustomField[]>([]);
  const [values, setValues]   = useState<Record<string, any>>({});
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [users,   setUsers]   = useState<{ id: string; user_name: string | null; email: string }[]>([]);

  // Load active field definitions for task module
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient.get("/custom-fields/definitions?module=task")
      .then((defs: CustomField[]) => {
        const active = defs
          .filter(d => d.is_active)
          .sort((a, b) => a.display_order - b.display_order);
        setFields(active);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Load users list if any user_reference field exists
  useEffect(() => {
    if (!fields.some(f => f.field_type === "user_reference")) return;
    apiClient.get("/users").then(setUsers).catch(() => {});
  }, [fields]);

  // Load existing values (edit mode: taskId is set)
  useEffect(() => {
    if (!open || !taskId || fields.length === 0) return;
    apiClient.get(`/custom-fields/values/task/${taskId}`)
      .then((existing: any[]) => {
        const vals: Record<string, any> = {};
        for (const ev of existing) {
          const field = fields.find(f => f.id === ev.field_definition_id);
          if (field) vals[ev.field_definition_id] = extractStoredValue(field, ev);
        }
        setValues(vals);
      })
      .catch(() => {});
  }, [open, taskId, fields.length]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) { setValues({}); setErrors({}); }
  }, [open]);

  // Expose imperative API to parent
  useImperativeHandle(ref, () => ({
    validate() {
      const errs: Record<string, string> = {};
      for (const f of fields) {
        if (f.is_required && isEmpty(values[f.id])) {
          errs[f.id] = `${f.label} is required.`;
        }
      }
      setErrors(errs);
      return Object.keys(errs).length === 0;
    },
    getPayload() {
      return fields.map(f => buildApiValue(f, values[f.id]));
    },
    reset() {
      setValues({});
      setErrors({});
    },
  }));

  const setValue = (fieldId: string, v: any) => {
    setValues(prev => ({ ...prev, [fieldId]: v }));
    if (errors[fieldId]) setErrors(prev => { const e = { ...prev }; delete e[fieldId]; return e; });
  };

  // Nothing to show
  if (!open) return null;
  if (loading) return (
    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
      <p className="text-sm text-indigo-400 animate-pulse">Loading custom fields…</p>
    </div>
  );
  if (fields.length === 0) return null;

  return (
    <div className="bg-indigo-50 p-3 sm:p-4 rounded-lg border border-indigo-100">
      <h3 className="text-sm sm:text-base font-medium text-gray-800 mb-4 flex items-center gap-2">
        <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </span>
        Custom Fields
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {fields.map(field => (
          <FieldInput
            key={field.id}
            field={field}
            uiType={getUiType(field)}
            value={values[field.id]}
            error={errors[field.id]}
            users={users}
            onChange={v => setValue(field.id, v)}
          />
        ))}
      </div>
    </div>
  );
});

TaskCustomFields.displayName = "TaskCustomFields";
export default TaskCustomFields;
