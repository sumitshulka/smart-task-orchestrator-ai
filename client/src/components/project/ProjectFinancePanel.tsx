import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock3, FileSpreadsheet, FileText, Info, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Entry = {
  id: string;
  entry_type: "expense" | "revenue";
  expense_head_id: string | null;
  milestone_id: string | null;
  recognition_basis: string;
  period_month: string | null;
  achieved_on: string | null;
  amount: string;
  currency: string;
  description: string;
  approval_status: "pending" | "approved";
  canApprove: boolean;
};
type FinanceData = {
  project: { name: string; start_date: string | null };
  currency: string;
  revenueRecognitionBasis: "monthly" | "milestone";
  canManageRevenue: boolean;
  canSeeExpenses: boolean;
  canSeeCosts: boolean;
  canSeeProfitability: boolean;
  missingSalaryCount: number;
  expenseHeads: Array<{ id: string; name: string; code: string }>;
  milestones: Array<{ id: string; name: string; status: string }>;
  entries: Entry[];
  summary: { revenue: number; expenses: number; resourceCosts: number } | null;
  monthlyResourceCosts: Array<{ month: string; amount: number; currency: string }>;
  monthlyResourceCostBreakdown: Array<{
    month: string;
    currency: string;
    resources: Array<{ userId: string; name: string; grossSalary: number | null; allocationPercentage: number; effectiveMonth: string | null; allocatedCost: number }>;
  }>;
};
type ReportRangeType = "month" | "quarter" | "year" | "custom" | "itd";

const monthNow = new Date().toISOString().slice(0, 7);
const dateNow = new Date().toISOString().slice(0, 10);

export default function ProjectFinancePanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [salaryDetailsMonth, setSalaryDetailsMonth] = useState<string | null>(null);
  const [reportRangeType, setReportRangeType] = useState<ReportRangeType>("itd");
  const [reportMonth, setReportMonth] = useState(monthNow);
  const [reportQuarter, setReportQuarter] = useState(`${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`);
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [customStart, setCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [headId, setHeadId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(monthNow);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [achievedOn, setAchievedOn] = useState(dateNow);
  const { data, isLoading, isError } = useQuery<FinanceData>({
    queryKey: ["/api/projects", projectId, "finance"],
    queryFn: () => apiClient.get(`/projects/${projectId}/finance`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "finance"] });
  const resetForm = () => {
    setEditingEntry(null);
    setHeadId("");
    setPeriodMonth(monthNow);
    setAmount("");
    setDescription("");
    setMilestoneId("");
    setAchievedOn(dateNow);
  };
  const expenseMutation = useMutation({
    mutationFn: () => editingEntry
      ? apiClient.patch(`/projects/${projectId}/finance/entries/${editingEntry.id}`, { expenseHeadId: headId, periodMonth, amount, description })
      : apiClient.post(`/projects/${projectId}/finance/expenses`, { expenseHeadId: headId, periodMonth, amount, description }),
    onSuccess: () => { resetForm(); setExpenseOpen(false); toast({ title: editingEntry ? "Expense updated" : "Expense recorded" }); refresh(); },
    onError: (error: Error) => toast({ title: "Could not save expense", description: error.message, variant: "destructive" }),
  });
  const revenueMutation = useMutation({
    mutationFn: () => editingEntry
      ? apiClient.patch(`/projects/${projectId}/finance/entries/${editingEntry.id}`, { periodMonth, milestoneId, achievedOn, amount, description })
      : apiClient.post(`/projects/${projectId}/finance/revenue`, { periodMonth, milestoneId, achievedOn, amount, description }),
    onSuccess: () => { resetForm(); setRevenueOpen(false); toast({ title: editingEntry ? "Revenue updated" : "Revenue recorded" }); refresh(); },
    onError: (error: Error) => toast({ title: "Could not save revenue", description: error.message, variant: "destructive" }),
  });
  const deleteEntry = useMutation({
    mutationFn: (entryId: string) => apiClient.delete(`/projects/${projectId}/finance/entries/${entryId}`),
    onSuccess: refresh,
    onError: (error: Error) => toast({ title: "Could not delete entry", description: error.message, variant: "destructive" }),
  });
  const approveEntry = useMutation({
    mutationFn: (entryId: string) => apiClient.post(`/projects/${projectId}/finance/entries/${entryId}/approve`, {}),
    onSuccess: () => { toast({ title: "Finance entry approved" }); refresh(); },
    onError: (error: Error) => toast({ title: "Could not approve entry", description: error.message, variant: "destructive" }),
  });
  const revenueEntries = useMemo(() => (data?.entries ?? []).filter((entry) => entry.entry_type === "revenue"), [data?.entries]);
  const expenseEntries = useMemo(() => (data?.entries ?? []).filter((entry) => entry.entry_type === "expense"), [data?.entries]);
  if (isLoading) return <div className="animate-pulse rounded-xl bg-muted p-10" />;
  if (isError || !data) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Project finance could not be loaded. Check your finance access and try again.</CardContent></Card>;

  const money = (value: number, currency = data?.currency ?? "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const today = new Date().toISOString().slice(0, 10);
  const earliestEntryDate = [...revenueEntries, ...expenseEntries]
    .map((entry) => entry.entry_type === "revenue" && entry.recognition_basis === "milestone" ? entry.achieved_on : entry.period_month)
    .concat(data.monthlyResourceCosts[0]?.month ?? "")
    .filter((date): date is string => Boolean(date))
    .sort()[0];
  const range = (() => {
    if (reportRangeType === "month") {
      const [year, month] = reportMonth.split("-").map(Number);
      return { start: `${reportMonth}-01`, end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10), label: reportMonth };
    }
    if (reportRangeType === "quarter") {
      const [yearText, quarterText] = reportQuarter.split("-Q");
      const year = Number(yearText);
      const startMonthNumber = (Number(quarterText) - 1) * 3 + 1;
      const start = `${year}-${String(startMonthNumber).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(year, startMonthNumber + 2, 0)).toISOString().slice(0, 10);
      return { start, end, label: `${reportQuarter}` };
    }
    if (reportRangeType === "year") {
      const year = Number(reportYear);
      return { start: `${year}-01-01`, end: `${year}-12-31`, label: reportYear };
    }
    if (reportRangeType === "custom") {
      return { start: customStart, end: customEnd, label: `${customStart} to ${customEnd}` };
    }
    const inception = data.project?.start_date?.slice(0, 10) ?? earliestEntryDate?.slice(0, 10) ?? today;
    return { start: inception, end: today, label: "Inception to date" };
  })();
  const validReportRange = Boolean(range.start && range.end && range.start <= range.end);
  const firstReportMonth = validReportRange ? range.start.slice(0, 7) : "";
  const lastReportMonth = validReportRange ? range.end.slice(0, 7) : "";
  const reportMonths: string[] = [];
  if (validReportRange) {
    let cursor = new Date(`${firstReportMonth}-01T00:00:00.000Z`);
    const end = new Date(`${lastReportMonth}-01T00:00:00.000Z`);
    while (cursor <= end && reportMonths.length < 1200) {
      reportMonths.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const inReportRange = (entry: Entry) => {
    if (!validReportRange) return false;
    const periodDate = entry.entry_type === "revenue" && entry.recognition_basis === "milestone"
      ? entry.achieved_on
      : entry.period_month;
    if (!periodDate) return false;
    const month = periodDate.slice(0, 7);
    return month >= firstReportMonth && month <= lastReportMonth &&
      (reportRangeType !== "custom" || entry.entry_type !== "revenue" ||
        entry.recognition_basis !== "milestone" || (periodDate >= range.start && periodDate <= range.end));
  };
  const reportRevenueEntries = revenueEntries.filter(inReportRange);
  const reportExpenseEntries = expenseEntries.filter(inReportRange);
  const revenueAmounts = new Map<string, number>();
  for (const entry of reportRevenueEntries) {
    const key = (entry.recognition_basis === "milestone" ? entry.achieved_on : entry.period_month)?.slice(0, 7);
    if (key) revenueAmounts.set(key, (revenueAmounts.get(key) ?? 0) + Number(entry.amount));
  }
  const expensesByHead = new Map<string, { label: string; amounts: Map<string, number> }>();
  for (const entry of reportExpenseEntries) {
    const key = entry.expense_head_id ?? "retired";
    const group = expensesByHead.get(key) ?? {
      id: key,
      label: data.expenseHeads.find((head) => head.id === entry.expense_head_id)?.name ?? "Retired category",
      amounts: new Map<string, number>(),
    };
    const month = entry.period_month?.slice(0, 7);
    if (month) group.amounts.set(month, (group.amounts.get(month) ?? 0) + Number(entry.amount));
    expensesByHead.set(key, group);
  }
  const expenseRows = [...expensesByHead.values()].sort((a, b) => a.label.localeCompare(b.label));
  const salaryAmounts = new Map((data.monthlyResourceCosts ?? []).filter((row) => reportMonths.includes(row.month)).map((row) => [row.month, row.amount]));
  const periodExpenses = new Map(reportMonths.map((month) => [
    month,
    expenseRows.reduce((sum, row) => sum + (row.amounts.get(month) ?? 0), 0) + (salaryAmounts.get(month) ?? 0),
  ]));
  const totalExpenseRows = expenseRows.reduce((sum, row) => sum + [...row.amounts.values()].reduce((a, b) => a + b, 0), 0);
  const totalResourceCosts = [...salaryAmounts.values()].reduce((sum, amount) => sum + amount, 0);
  const revenueTotal = [...revenueAmounts.values()].reduce((sum, amount) => sum + amount, 0);
  const expenseTotal = totalExpenseRows;
  const reportResourceCostTotal = totalResourceCosts;
  const reportExpenseTotal = expenseTotal + reportResourceCostTotal;
  const reportMargin = revenueTotal - reportExpenseTotal;
  const resourceCostTotal = reportResourceCostTotal;
  const reportYears = Array.from({ length: 81 }, (_, index) => String(new Date().getFullYear() - index));
  const reportMilestoneName = (entry: Entry) => data.milestones.find((milestone) => milestone.id === entry.milestone_id)?.name ?? "";
  const reportExport = {
    projectName: data.project?.name ?? "Project",
    rangeLabel: range.label,
    currency: data.currency,
    months: reportMonths,
    revenue: reportMonths.map((month) => revenueAmounts.get(month) ?? 0),
    revenueTotal,
    expenses: expenseRows.map((row) => ({
      label: row.label,
      amounts: reportMonths.map((month) => row.amounts.get(month) ?? 0),
      total: reportMonths.reduce((sum, month) => sum + (row.amounts.get(month) ?? 0), 0),
    })),
    includeSalary: data.canSeeCosts,
    salaryAmounts: reportMonths.map((month) => salaryAmounts.get(month) ?? 0),
    expenseTotals: reportMonths.map((month) => periodExpenses.get(month) ?? 0),
    expenseTotal: reportExpenseTotal,
    profitability: reportMonths.map((month, index) => (revenueAmounts.get(month) ?? 0) - (periodExpenses.get(month) ?? 0)),
    profitabilityTotal: reportMargin,
    revenueDetails: reportRevenueEntries.map((entry) => ({
      date: entry.recognition_basis === "milestone" ? entry.achieved_on ?? "" : entry.period_month ?? "",
      milestone: reportMilestoneName(entry),
      description: entry.description,
      amount: Number(entry.amount),
      status: entry.approval_status,
    })),
  };
  const downloadExcel = () => {
    const workbook = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ["Project Profitability Report"],
      ["Project", reportExport.projectName],
      ["Period", reportExport.rangeLabel],
      ["Currency", reportExport.currency],
      [],
      ["Revenue"],
      ["Revenue", ...reportMonths, "Total"],
      ["Recognized revenue", ...reportExport.revenue, reportExport.revenueTotal],
      ["Total revenue", ...reportExport.revenue, reportExport.revenueTotal],
      [],
      ["Expenses"],
      ["Expense head", ...reportMonths, "Total"],
      ...reportExport.expenses.map((row) => [row.label, ...row.amounts, row.total]),
      ...(reportExport.includeSalary ? [["Resource salary", ...reportExport.salaryAmounts, totalResourceCosts] as (string | number)[]] : []),
      ["Total expenses", ...reportExport.expenseTotals, reportExport.expenseTotal],
      [],
      ["Project profitability"],
      ["Net profitability", ...reportExport.profitability, reportExport.profitabilityTotal],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 30 }, ...reportMonths.map(() => ({ wch: 14 })), { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Profitability");
    const detailRows: (string | number)[][] = [
      ["Revenue accrual details", "", "", "", ""],
      ["Accrual date", "Milestone", "Description", "Amount", "Approval status"],
      ...reportExport.revenueDetails.map((detail) => [detail.date, detail.milestone, detail.description, detail.amount, detail.status]),
    ];
    const detailsSheet = XLSX.utils.aoa_to_sheet(detailRows);
    detailsSheet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 44 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, detailsSheet, "Revenue details");
    const fileBase = `${reportExport.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-profitability-${reportExport.rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    XLSX.writeFile(workbook, `${fileBase}.xlsx`);
  };
  const downloadPdf = async () => {
    try {
      const fileBase = `${reportExport.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-profitability-${reportExport.rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
      await apiClient.downloadPost(`/projects/${projectId}/finance/profitability.pdf`, reportExport, fileBase);
    } catch (error) {
      toast({ title: "Could not download PDF report", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };
  const salaryDetails = data.monthlyResourceCostBreakdown?.find((row) => row.month === salaryDetailsMonth);
  const openEditor = (entry: Entry) => {
    setEditingEntry(entry);
    setPeriodMonth(entry.period_month?.slice(0, 7) ?? monthNow);
    setAmount(entry.amount);
    setDescription(entry.description);
    setHeadId(entry.expense_head_id ?? "");
    setMilestoneId(entry.milestone_id ?? "");
    setAchievedOn(entry.achieved_on ?? dateNow);
    if (entry.entry_type === "expense") setExpenseOpen(true);
    else setRevenueOpen(true);
  };
  const confirmDelete = (entry: Entry) => {
    if (window.confirm(`Delete this ${entry.entry_type} entry? This cannot be undone.`)) deleteEntry.mutate(entry.id);
  };
  const entryActions = (entry: Entry, canEdit: boolean) => entry.approval_status === "approved"
    ? <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-label="Approved and locked" title="Approved and locked" />
    : <div className="flex items-center justify-end gap-1">
        {entry.canApprove && <Button size="sm" variant="secondary" onClick={() => approveEntry.mutate(entry.id)} disabled={approveEntry.isPending}>Approve</Button>}
        {canEdit && <div className="pointer-events-none inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <Button size="icon" variant="ghost" aria-label="Edit entry" title="Edit" onClick={() => openEditor(entry)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Delete entry" title="Delete" onClick={() => confirmDelete(entry)}><Trash2 className="h-4 w-4" /></Button>
        </div>}
      </div>;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Accrual accounting</p>
        <h2 className="mt-1 text-2xl font-semibold">Project Finance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Revenue is recognized {data.revenueRecognitionBasis === "monthly" ? "by month" : "by completed milestone"}. Amounts use {data.currency}; payments are not tracked.</p>
      </header>
      {data.canSeeProfitability && <div className="grid gap-3 sm:grid-cols-3">
        <Summary title="Period revenue" amount={revenueTotal} currency={data.currency} />
        <Summary title="Period expenses" amount={expenseTotal + resourceCostTotal} currency={data.currency} />
        <Summary title="Period profitability" amount={revenueTotal - expenseTotal - resourceCostTotal} currency={data.currency} />
      </div>}

      {(data.canSeeProfitability || data.canManageRevenue) && <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div><CardTitle className="text-base">Revenue</CardTitle><p className="mt-1 text-sm text-muted-foreground">{data.revenueRecognitionBasis === "monthly" ? "Reported by month" : "Reported by completed milestone"}</p></div>
          {data.canManageRevenue && <Button onClick={() => { resetForm(); setRevenueOpen(true); }}>Record new revenue</Button>}
        </CardHeader>
        <CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">{data.revenueRecognitionBasis === "monthly" ? "Month" : "Milestone"}</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 text-right">Actions</th></tr></thead>
          <tbody>{revenueEntries.map((entry) => <tr key={entry.id} className="group border-b last:border-0">
            <td className="py-3 pr-3">{data.revenueRecognitionBasis === "monthly" ? entry.period_month?.slice(0, 7) : data.milestones.find((m) => m.id === entry.milestone_id)?.name ?? entry.achieved_on}</td>
            <td className="py-3 pr-3">{entry.description}</td><td className="py-3 pr-3"><ApprovalStatusIcon status={entry.approval_status} /></td><td className="py-3 pr-3 text-right">{money(Number(entry.amount), entry.currency)}</td><td className="py-3 text-right">{entryActions(entry, data.canManageRevenue)}</td>
          </tr>)}
          {!revenueEntries.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No revenue accruals recorded.</td></tr>}</tbody>
        </table></div></CardContent>
      </Card>}

      {(data.canSeeExpenses || data.canSeeCosts) && <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div><CardTitle className="text-base">Expenses</CardTitle><p className="mt-1 text-sm text-muted-foreground">Includes automatically calculated resource salary costs.</p></div>
          {data.canSeeExpenses && <Button onClick={() => { resetForm(); setExpenseOpen(true); }}>Record new expense</Button>}
        </CardHeader>
        <CardContent>
          {data.canSeeCosts && data.missingSalaryCount > 0 && <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{data.missingSalaryCount} allocated resource(s) have no effective salary set. Add their salary in Project Settings to calculate the full monthly cost.</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Month</th><th className="py-2 pr-3">Expense head</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 text-right">Actions</th></tr></thead>
            <tbody>
              {expenseEntries.map((entry) => <tr key={entry.id} className="group border-b last:border-0">
                <td className="py-3 pr-3">{entry.period_month?.slice(0, 7)}</td><td className="py-3 pr-3">{data.expenseHeads.find((h) => h.id === entry.expense_head_id)?.name ?? "Retired category"}</td><td className="py-3 pr-3">{entry.description}</td><td className="py-3 pr-3"><ApprovalStatusIcon status={entry.approval_status} /></td><td className="py-3 pr-3 text-right">{money(Number(entry.amount), entry.currency)}</td><td className="py-3 text-right">{entryActions(entry, data.canSeeExpenses)}</td>
              </tr>)}
              {data.canSeeCosts && data.monthlyResourceCosts.map((row) => <tr key={`salary-${row.month}`} className="border-b last:border-0 bg-muted/30">
                <td className="py-3 pr-3">{row.month}</td><td className="py-3 pr-3">Resource salary</td><td className="py-3 pr-3">Allocated gross salary cost · managed in Project Settings</td><td className="py-3 pr-3"><Badge variant="outline">Automatic</Badge></td><td className="py-3 pr-3 text-right">{money(row.amount, row.currency)}</td><td className="py-3 text-right"><Button variant="ghost" size="icon" aria-label={`View salary calculation for ${row.month}`} title="View salary calculation" onClick={() => setSalaryDetailsMonth(row.month)}><Info className="h-4 w-4" /></Button></td>
              </tr>)}
              {!expenseEntries.length && (!data.canSeeCosts || !data.monthlyResourceCosts.length) && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No expense accruals recorded.</td></tr>}
            </tbody>
          </table></div>
        </CardContent>
      </Card>}

      {data.canSeeProfitability && <Card>
        <CardHeader>
          <CardTitle>Profitability report</CardTitle>
          <p className="text-sm text-muted-foreground">
            Both sections share calendar-month columns. Milestone revenue is placed in the month it was achieved, with milestone details included in exports.
            {!data.canSeeExpenses && " Expense detail is restricted by Finance visibility settings."}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40 space-y-1.5">
                <Label>Report period</Label>
                <Select value={reportRangeType} onValueChange={(value) => setReportRangeType(value as ReportRangeType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="custom">Custom date range</SelectItem>
                    <SelectItem value="itd">ITD · Inception to date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {reportRangeType === "month" && <div className="space-y-1.5"><Label htmlFor="finance-report-month">Month</Label><Input id="finance-report-month" type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></div>}
              {reportRangeType === "quarter" && <div className="flex gap-2">
                <div className="space-y-1.5"><Label>Year</Label><Select value={reportYear} onValueChange={(year) => { setReportYear(year); setReportQuarter(`${year}-Q${reportQuarter.split("-Q")[1] ?? "1"}`); }}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{reportYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Quarter</Label><Select value={reportQuarter.split("-Q")[1] ?? "1"} onValueChange={(quarter) => setReportQuarter(`${reportYear}-Q${quarter}`)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{["1", "2", "3", "4"].map((quarter) => <SelectItem key={quarter} value={quarter}>Q{quarter}</SelectItem>)}</SelectContent></Select></div>
              </div>}
              {reportRangeType === "year" && <div className="space-y-1.5"><Label>Year</Label><Select value={reportYear} onValueChange={setReportYear}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{reportYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent></Select></div>}
              {reportRangeType === "custom" && <div className="flex flex-wrap gap-2">
                <div className="space-y-1.5"><Label htmlFor="finance-report-start">From</Label><Input id="finance-report-start" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="finance-report-end">To</Label><Input id="finance-report-end" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div>
              </div>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadExcel} disabled={!validReportRange}><FileSpreadsheet className="mr-2 h-4 w-4" />Download Excel</Button>
              <Button variant="outline" onClick={() => void downloadPdf()} disabled={!validReportRange}><FileText className="mr-2 h-4 w-4" />Download PDF</Button>
            </div>
          </div>
          {!validReportRange && <p role="alert" className="text-sm text-destructive">The custom start date must be on or before the end date.</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="mb-2 font-medium">Revenue</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-fixed text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-48 py-2 pr-3">Revenue</th>
                  {reportMonths.map((month) => <th key={month} className="px-3 py-2 text-right">{month}</th>)}
                  <th className="py-2 pl-3 text-right">Total</th>
                </tr></thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 pr-3">Recognized revenue</td>
                    {reportMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(revenueAmounts.get(month) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right font-medium">{money(revenueTotal)}</td>
                  </tr>
                  {!reportMonths.length && <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">No months in this period.</td></tr>}
                  <tr className="bg-muted/40 font-semibold"><td className="py-3 pr-3">Total revenue</td>{reportMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(revenueAmounts.get(month) ?? 0)}</td>)}<td className="py-3 pl-3 text-right">{money(revenueTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 font-medium">Expenses</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-fixed text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-48 py-2 pr-3">Expense head</th>
                  {reportMonths.map((month) => <th key={month} className="px-3 py-2 text-right">{month}</th>)}
                  <th className="py-2 pl-3 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {data.canSeeExpenses && expenseRows.map((row) => <tr key={row.id} className="border-b">
                    <td className="py-3 pr-3">{row.label}</td>
                    {reportMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(row.amounts.get(month) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right">{money([...row.amounts.values()].reduce((sum, amount) => sum + amount, 0))}</td>
                  </tr>)}
                  {data.canSeeCosts && <tr className="border-b bg-muted/30">
                    <td className="py-3 pr-3">Resource salary</td>
                    {reportMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(salaryAmounts.get(month) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right">{money(totalResourceCosts)}</td>
                  </tr>}
                  <tr className="bg-muted/40 font-semibold">
                    <td className="py-3 pr-3">{data.canSeeExpenses && data.canSeeCosts ? "Total expenses" : "Visible expense total"}</td>
                    {reportMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(periodExpenses.get(month) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right">{money(totalExpenseRows + (data.canSeeCosts ? totalResourceCosts : 0))}</td>
                  </tr>
                  {!reportMonths.length && <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">No months in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <Summary title="Total revenue" amount={revenueTotal} currency={data.currency} />
            <Summary title="Total expenses" amount={expenseTotal + resourceCostTotal} currency={data.currency} />
            <Summary title="Project profitability" amount={revenueTotal - expenseTotal - resourceCostTotal} currency={data.currency} />
          </div>
        </CardContent>
      </Card>}

      <Dialog open={salaryDetailsMonth !== null} onOpenChange={(open) => { if (!open) setSalaryDetailsMonth(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Resource salary calculation · {salaryDetailsMonth}</DialogTitle>
            <DialogDescription>Monthly gross salary × project allocation percentage = allocated project cost.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Resource</th><th className="px-3 py-2 text-right">Gross monthly salary</th><th className="px-3 py-2 text-right">Allocation</th><th className="px-3 py-2">Salary effective</th><th className="py-2 pl-3 text-right">Allocated cost</th></tr></thead>
              <tbody>
                {(salaryDetails?.resources ?? []).map((resource) => <tr key={resource.userId} className="border-b">
                  <td className="py-3 pr-3">{resource.name}</td>
                  <td className="px-3 py-3 text-right">{resource.grossSalary === null ? "Not set" : money(resource.grossSalary, salaryDetails?.currency)}</td>
                  <td className="px-3 py-3 text-right">{resource.allocationPercentage}%</td>
                  <td className="px-3 py-3">{resource.effectiveMonth ?? "No effective salary"}</td>
                  <td className="py-3 pl-3 text-right">{resource.grossSalary === null ? "—" : money(resource.allocatedCost, salaryDetails?.currency)}</td>
                </tr>)}
                <tr className="bg-muted/40 font-semibold"><td colSpan={4} className="py-3 pr-3 text-right">Monthly resource salary cost</td><td className="py-3 pl-3 text-right">{money(salaryDetails?.resources.reduce((sum, resource) => sum + resource.allocatedCost, 0) ?? 0, salaryDetails?.currency)}</td></tr>
              </tbody>
            </table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSalaryDetailsMonth(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseOpen} onOpenChange={(open) => { setExpenseOpen(open); if (!open) resetForm(); }}>
        <DialogContent><DialogHeader><DialogTitle>{editingEntry ? "Edit expense" : "Record new expense"}</DialogTitle><DialogDescription>Resource salary costs are calculated automatically and cannot be edited here.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>Organization expense head</Label><Select value={headId} onValueChange={setHeadId}><SelectTrigger><SelectValue placeholder="Choose a head" /></SelectTrigger><SelectContent>{data.expenseHeads.map((head) => <SelectItem key={head.id} value={head.id}>{head.name} ({head.code})</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Accrual month</Label><Input type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Amount ({data.currency})</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button><Button disabled={!headId || !amount || !description.trim() || expenseMutation.isPending} onClick={() => expenseMutation.mutate()}>{editingEntry ? "Save expense" : "Record expense"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={revenueOpen} onOpenChange={(open) => { setRevenueOpen(open); if (!open) resetForm(); }}>
        <DialogContent><DialogHeader><DialogTitle>{editingEntry ? "Edit revenue" : "Record new revenue"}</DialogTitle><DialogDescription>Revenue recognition is configured in Project Settings → Finance.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            {data.revenueRecognitionBasis === "monthly"
              ? <div className="space-y-1.5"><Label>Revenue month</Label><Input type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} /></div>
              : <><div className="space-y-1.5"><Label>Completed milestone</Label><Select value={milestoneId} onValueChange={setMilestoneId}><SelectTrigger><SelectValue placeholder="Choose a completed milestone" /></SelectTrigger><SelectContent>{data.milestones.filter((m) => m.status === "completed").map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Achieved on</Label><Input type="date" value={achievedOn} onChange={(event) => setAchievedOn(event.target.value)} /></div></>}
            <div className="space-y-1.5"><Label>Amount ({data.currency})</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRevenueOpen(false)}>Cancel</Button><Button disabled={!amount || !description.trim() || (data.revenueRecognitionBasis === "milestone" && !milestoneId) || revenueMutation.isPending} onClick={() => revenueMutation.mutate()}>{editingEntry ? "Save revenue" : "Record revenue"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ title, amount, currency }: { title: string; amount: number; currency: string }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold">{new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)}</p></CardContent></Card>;
}

function ApprovalStatusIcon({ status }: { status: Entry["approval_status"] }) {
  return status === "approved"
    ? <span className="inline-flex" role="img" aria-label="Approved" title="Approved"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></span>
    : <span className="inline-flex" role="img" aria-label="Pending approval" title="Pending approval"><Clock3 className="h-4 w-4 text-amber-600" /></span>;
}
