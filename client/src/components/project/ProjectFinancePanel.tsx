import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock3, Info, LockKeyhole, Pencil, Trash2 } from "lucide-react";
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

const monthNow = new Date().toISOString().slice(0, 7);
const dateNow = new Date().toISOString().slice(0, 10);

export default function ProjectFinancePanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [salaryDetailsMonth, setSalaryDetailsMonth] = useState<string | null>(null);
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

  const resourceCostTotal = data?.summary?.resourceCosts ?? (data?.monthlyResourceCosts ?? []).reduce((sum, row) => sum + row.amount, 0);
  const expenseTotal = data?.summary?.expenses ?? expenseEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const revenueTotal = data?.summary?.revenue ?? revenueEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const money = (value: number, currency = data?.currency ?? "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const expenseMonths = [...new Set([
    ...expenseEntries.map((entry) => entry.period_month?.slice(0, 7)).filter((month): month is string => Boolean(month)),
    ...(data.monthlyResourceCosts ?? []).map((row) => row.month),
  ])].sort();
  const revenuePeriods = data.revenueRecognitionBasis === "monthly"
    ? [...new Set([
        ...expenseMonths,
        ...revenueEntries.map((entry) => entry.period_month?.slice(0, 7)).filter((month): month is string => Boolean(month)),
      ])].sort()
    : [...new Set([
        ...data.milestones.filter((milestone) => milestone.status === "completed").map((milestone) => milestone.id),
        ...revenueEntries.map((entry) => entry.milestone_id).filter((id): id is string => Boolean(id)),
      ])];
  const revenueAmounts = new Map<string, number>();
  for (const entry of revenueEntries) {
    const key = data.revenueRecognitionBasis === "monthly"
      ? entry.period_month?.slice(0, 7)
      : entry.milestone_id ?? undefined;
    if (key) revenueAmounts.set(key, (revenueAmounts.get(key) ?? 0) + Number(entry.amount));
  }
  const expensesByHead = new Map<string, { label: string; amounts: Map<string, number> }>();
  for (const entry of expenseEntries) {
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
  const salaryAmounts = new Map((data.monthlyResourceCosts ?? []).map((row) => [row.month, row.amount]));
  const periodExpenses = new Map(expenseMonths.map((month) => [
    month,
    expenseRows.reduce((sum, row) => sum + (row.amounts.get(month) ?? 0), 0) + (salaryAmounts.get(month) ?? 0),
  ]));
  const totalExpenseRows = expenseRows.reduce((sum, row) => sum + [...row.amounts.values()].reduce((a, b) => a + b, 0), 0);
  const totalResourceCosts = [...salaryAmounts.values()].reduce((sum, amount) => sum + amount, 0);
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
        <Summary title="Accrued revenue" amount={revenueTotal} currency={data.currency} />
        <Summary title="Total expenses" amount={expenseTotal + resourceCostTotal} currency={data.currency} />
        <Summary title="Accrued margin" amount={revenueTotal - expenseTotal - resourceCostTotal} currency={data.currency} />
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
            Revenue periods follow the project recognition setting. Expense heads and allocated salaries are shown by month so costs are not incorrectly assigned to milestones.
            {!data.canSeeExpenses && " Expense detail is restricted by Finance visibility settings."}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="mb-2 font-medium">Revenue</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Revenue</th>
                  {revenuePeriods.map((period) => <th key={period} className="px-3 py-2 text-right">{data.revenueRecognitionBasis === "monthly" ? period : data.milestones.find((milestone) => milestone.id === period)?.name ?? "Milestone"}</th>)}
                  <th className="py-2 pl-3 text-right">Total</th>
                </tr></thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 pr-3">Recognized revenue</td>
                    {revenuePeriods.map((period) => <td key={period} className="px-3 py-3 text-right">{money(revenueAmounts.get(period) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right font-medium">{money(revenueTotal)}</td>
                  </tr>
                  {!revenuePeriods.length && <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">No recognized revenue periods yet.</td></tr>}
                  <tr className="bg-muted/40 font-semibold"><td className="py-3 pr-3">Total revenue</td><td colSpan={revenuePeriods.length} /><td className="py-3 pl-3 text-right">{money(revenueTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 font-medium">Expenses</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Expense head</th>
                  {expenseMonths.map((month) => <th key={month} className="px-3 py-2 text-right">{month}</th>)}
                  <th className="py-2 pl-3 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {data.canSeeExpenses && expenseRows.map((row) => <tr key={row.id} className="border-b">
                    <td className="py-3 pr-3">{row.label}</td>
                    {expenseMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(row.amounts.get(month) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right">{money([...row.amounts.values()].reduce((sum, amount) => sum + amount, 0))}</td>
                  </tr>)}
                  {data.canSeeCosts && <tr className="border-b bg-muted/30">
                    <td className="py-3 pr-3">Resource salary</td>
                    {expenseMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(salaryAmounts.get(month) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right">{money(totalResourceCosts)}</td>
                  </tr>}
                  <tr className="bg-muted/40 font-semibold">
                    <td className="py-3 pr-3">{data.canSeeExpenses && data.canSeeCosts ? "Total expenses" : "Visible expense total"}</td>
                    {expenseMonths.map((month) => <td key={month} className="px-3 py-3 text-right">{money(periodExpenses.get(month) ?? 0)}</td>)}
                    <td className="py-3 pl-3 text-right">{money(totalExpenseRows + (data.canSeeCosts ? totalResourceCosts : 0))}</td>
                  </tr>
                  {!expenseMonths.length && <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">No expense periods yet.</td></tr>}
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
