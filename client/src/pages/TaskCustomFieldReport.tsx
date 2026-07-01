
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, Download, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";
import useSupabaseSession from "@/hooks/useSupabaseSession";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CfField {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  module: string;
  is_reportable: boolean;
  options: { value: string; label: string }[] | null;
}

interface CfValue {
  field_definition_id: string;
  value_text: string | null;
  value_number: string | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: any;
}

interface TaskRow {
  id: string;
  task_number: number;
  title: string;
  status: string;
  priority: number | null;
  due_date: string | null;
  created_at: string;
  assigned_to_name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCfValue(field: CfField, val?: CfValue): string {
  if (!val) return "—";
  if (field.field_type === "boolean") return val.value_boolean == null ? "—" : val.value_boolean ? "Yes" : "No";
  if (field.field_type === "number" || field.field_type === "decimal") return val.value_number ?? "—";
  if (field.field_type === "date" || field.field_type === "datetime") {
    if (!val.value_date) return "—";
    try { return format(new Date(val.value_date), "dd MMM yyyy"); } catch { return val.value_date; }
  }
  if (field.field_type === "multiselect") {
    if (!val.value_json) return "—";
    const arr = Array.isArray(val.value_json) ? val.value_json : [];
    return arr.join(", ") || "—";
  }
  return val.value_text || "—";
}

function priorityLabel(p: number | null) {
  if (p === 1) return "High";
  if (p === 2) return "Medium";
  if (p === 3) return "Low";
  return "—";
}

function defaultDateRange() {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TaskCustomFieldReport() {
  const { user } = useSupabaseSession();

  const [dateRange, setDateRange] = useState(defaultDateRange());
  const [preset, setPreset] = useState("This Month");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [cfFilters, setCfFilters] = useState<Record<string, string>>({});
  const [runReport, setRunReport] = useState(false);

  // ── Load reportable task CF fields ──────────────────────────────────────────
  const { data: cfFieldsRaw = [] } = useQuery<CfField[]>({
    queryKey: ["/api/custom-fields/definitions", "task"],
    queryFn: async () => {
      const res = await apiClient.get("/custom-fields/definitions?module=task");
      return Array.isArray(res) ? res : res?.definitions ?? [];
    },
    enabled: !!user,
  });

  const reportableFields = useMemo(
    () => cfFieldsRaw.filter((f: CfField) => f.is_reportable),
    [cfFieldsRaw],
  );

  const activeFields = useMemo(
    () => reportableFields.filter(f => selectedFields.has(f.id)),
    [reportableFields, selectedFields],
  );

  // ── Build active CF filters for the backend call ─────────────────────────────
  const activeCfFilters = useMemo(() => {
    return Object.entries(cfFilters)
      .filter(([, v]) => v.trim() !== "")
      .map(([field_id, value]) => ({ field_id, value: value.trim() }));
  }, [cfFilters]);

  // ── Run Report: fetch matching task IDs via CF filters ────────────────────────
  const { data: cfMatchData, isLoading: loadingIds, refetch: refetchIds } = useQuery<{ taskIds: string[] }>({
    queryKey: ["/api/custom-fields/task-ids-filter", activeCfFilters],
    queryFn: async () => {
      if (activeCfFilters.length === 0) return { taskIds: [] };
      return apiClient.post("/custom-fields/task-ids-filter", { filters: activeCfFilters });
    },
    enabled: runReport && activeCfFilters.length > 0,
  });

  // ── Fetch tasks with date range ──────────────────────────────────────────────
  const { data: tasksRaw = [], isLoading: loadingTasks, refetch: refetchTasks } = useQuery<TaskRow[]>({
    queryKey: ["/api/tasks/report-export", dateRange],
    queryFn: async () => {
      const from = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const to = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const params = new URLSearchParams({ limit: "1000" });
      if (from) params.set("from_date", from);
      if (to) params.set("to_date", to);
      const res = await apiClient.get(`/tasks?${params.toString()}`);
      return Array.isArray(res) ? res : res?.tasks ?? [];
    },
    enabled: runReport && !!user,
  });

  // ── Filter tasks by CF match IDs ─────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    if (!runReport) return [];
    let rows = tasksRaw;
    if (activeCfFilters.length > 0 && cfMatchData) {
      const matchSet = new Set(cfMatchData.taskIds);
      rows = rows.filter(t => matchSet.has(t.id));
    }
    return rows;
  }, [runReport, tasksRaw, cfMatchData, activeCfFilters]);

  // ── Fetch CF values batch for filtered tasks ──────────────────────────────────
  const taskIds = useMemo(() => filteredTasks.map(t => t.id), [filteredTasks]);

  const { data: cfValuesMap = {}, isLoading: loadingValues } = useQuery<Record<string, CfValue[]>>({
    queryKey: ["/api/custom-fields/values/task/batch", taskIds],
    queryFn: async () => {
      if (taskIds.length === 0) return {};
      return apiClient.post("/custom-fields/values/task/batch", { taskIds });
    },
    enabled: runReport && taskIds.length > 0 && activeFields.length > 0,
  });

  // ── Toggle field selection ───────────────────────────────────────────────────
  function toggleField(id: string) {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedFields.size === reportableFields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(reportableFields.map(f => f.id)));
    }
  }

  function handleRun() {
    setRunReport(true);
    if (runReport) {
      refetchTasks();
      if (activeCfFilters.length > 0) refetchIds();
    }
  }

  // ── Export to CSV ─────────────────────────────────────────────────────────────
  function exportCsv() {
    const cols = ["Task #", "Title", "Status", "Priority", "Due Date", ...activeFields.map(f => f.label)];
    const rows = filteredTasks.map(task => {
      const vals = cfValuesMap[task.id] ?? [];
      const cfByFieldId: Record<string, CfValue> = {};
      vals.forEach(v => { cfByFieldId[v.field_definition_id] = v; });
      return [
        task.task_number,
        `"${(task.title || "").replace(/"/g, '""')}"`,
        task.status,
        priorityLabel(task.priority),
        task.due_date ? format(new Date(task.due_date), "dd MMM yyyy") : "—",
        ...activeFields.map(f => `"${formatCfValue(f, cfByFieldId[f.id]).replace(/"/g, '""')}"`),
      ].join(",");
    });
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custom-field-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isLoading = loadingIds || loadingTasks || loadingValues;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-6 h-6 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">Custom Field Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build reports using your reportable custom fields on tasks.</p>
          </div>
        </div>
        {runReport && filteredTasks.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Configuration panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Date Range */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Date Range</CardTitle>
          </CardHeader>
          <CardContent>
            <DateRangePresetSelector
              dateRange={dateRange}
              preset={preset}
              onChange={(range, p) => {
                setPreset(p);
                if (p !== "custom") setDateRange(range);
              }}
            />
          </CardContent>
        </Card>

        {/* Column selection */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Custom Field Columns
                {reportableFields.length === 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-400">(none marked as reportable)</span>
                )}
              </CardTitle>
              {reportableFields.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                  {selectedFields.size === reportableFields.length ? "Deselect all" : "Select all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {reportableFields.length === 0 ? (
              <p className="text-sm text-gray-500">
                Go to <strong>Settings → Custom Fields</strong> and enable <em>Reportable</em> on the fields you want to include here.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {reportableFields.map(f => (
                  <label key={f.id} className="flex items-center gap-2 cursor-pointer rounded-md p-2 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors">
                    <Checkbox
                      checked={selectedFields.has(f.id)}
                      onCheckedChange={() => toggleField(f.id)}
                    />
                    <span className="text-sm truncate" title={f.label}>{f.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{f.field_type}</Badge>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CF Filters */}
      {reportableFields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter by Custom Field Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {reportableFields.map(f => (
                <div key={f.id}>
                  <Label className="text-xs mb-1 block">{f.label}</Label>
                  {(f.field_type === "select" || f.field_type === "multiselect") && f.options?.length ? (
                    <select
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white"
                      value={cfFilters[f.id] ?? ""}
                      onChange={e => setCfFilters(prev => ({ ...prev, [f.id]: e.target.value }))}
                    >
                      <option value="">Any</option>
                      {f.options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.field_type === "boolean" ? (
                    <select
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white"
                      value={cfFilters[f.id] ?? ""}
                      onChange={e => setCfFilters(prev => ({ ...prev, [f.id]: e.target.value }))}
                    >
                      <option value="">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <Input
                      className="h-8 text-sm"
                      placeholder={f.field_type === "date" || f.field_type === "datetime" ? "YYYY-MM-DD" : `Search ${f.label}…`}
                      value={cfFilters[f.id] ?? ""}
                      onChange={e => setCfFilters(prev => ({ ...prev, [f.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run button */}
      <div className="flex justify-end">
        <Button onClick={handleRun} className="gap-2 px-6" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          {runReport ? "Refresh Report" : "Run Report"}
        </Button>
      </div>

      <Separator />

      {/* Results */}
      {runReport && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {isLoading ? "Loading…" : (
                <>
                  <strong>{filteredTasks.length}</strong> task{filteredTasks.length !== 1 ? "s" : ""} found
                  {activeCfFilters.length > 0 && (
                    <span className="ml-1 text-gray-400">(filtered by {activeCfFilters.length} custom field{activeCfFilters.length !== 1 ? "s" : ""})</span>
                  )}
                </>
              )}
            </p>
          </div>

          {!isLoading && filteredTasks.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No tasks matched the selected criteria.</p>
            </div>
          )}

          {!isLoading && filteredTasks.length > 0 && (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold whitespace-nowrap">Task #</TableHead>
                    <TableHead className="font-semibold min-w-[220px]">Title</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Priority</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Due Date</TableHead>
                    {activeFields.map(f => (
                      <TableHead key={f.id} className="font-semibold whitespace-nowrap text-purple-700">
                        {f.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map(task => {
                    const vals = cfValuesMap[task.id] ?? [];
                    const cfByFieldId: Record<string, CfValue> = {};
                    vals.forEach(v => { cfByFieldId[v.field_definition_id] = v; });
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-xs text-gray-500">
                          {task.task_number ? String(task.task_number).padStart(5, "0") : "—"}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate" title={task.title}>{task.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{task.status?.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{priorityLabel(task.priority)}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {task.due_date ? (() => { try { return format(new Date(task.due_date), "dd MMM yyyy"); } catch { return task.due_date; }})() : "—"}
                        </TableCell>
                        {activeFields.map(f => (
                          <TableCell key={f.id} className="text-sm">
                            {formatCfValue(f, cfByFieldId[f.id])}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
