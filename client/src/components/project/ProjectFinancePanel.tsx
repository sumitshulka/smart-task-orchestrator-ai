import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FinanceData = {
  currency: string;
  revenueRecognitionBasis: "monthly" | "milestone";
  canManageRevenue: boolean;
  canSeeExpenses: boolean;
  canSeeCosts: boolean;
  canSeeProfitability: boolean;
  expenseHeads: Array<{ id: string; name: string; code: string }>;
  milestones: Array<{ id: string; name: string; status: string }>;
  entries: Array<{
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
  }>;
  summary: { revenue: number; expenses: number; resourceCosts: number } | null;
  monthlyResourceCosts: Array<{ month: string; amount: number; currency: string }>;
};

const monthNow = new Date().toISOString().slice(0, 7);

export default function ProjectFinancePanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [headId, setHeadId] = useState("");
  const [expenseMonth, setExpenseMonth] = useState(monthNow);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [revenueMonth, setRevenueMonth] = useState(monthNow);
  const [milestoneId, setMilestoneId] = useState("");
  const [achievedOn, setAchievedOn] = useState(new Date().toISOString().slice(0, 10));
  const [revenueAmount, setRevenueAmount] = useState("");
  const [revenueDescription, setRevenueDescription] = useState("");

  const { data, isLoading, isError } = useQuery<FinanceData>({
    queryKey: ["/api/projects", projectId, "finance"],
    queryFn: () => apiClient.get(`/projects/${projectId}/finance`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "finance"] });

  const expenseMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/finance/expenses`, {
      expenseHeadId: headId,
      periodMonth: expenseMonth,
      amount: expenseAmount,
      description: expenseDescription,
    }),
    onSuccess: () => {
      setExpenseAmount("");
      setExpenseDescription("");
      toast({ title: "Expense recorded" });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not record expense", description: error.message, variant: "destructive" }),
  });
  const revenueMutation = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/finance/revenue`, {
      periodMonth: revenueMonth,
      milestoneId,
      achievedOn,
      amount: revenueAmount,
      description: revenueDescription,
    }),
    onSuccess: () => {
      setRevenueAmount("");
      setRevenueDescription("");
      toast({ title: "Revenue accrual recorded" });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not record revenue", description: error.message, variant: "destructive" }),
  });
  const settingsMutation = useMutation({
    mutationFn: (basis: "monthly" | "milestone") =>
      apiClient.patch(`/projects/${projectId}/finance-settings`, { revenueRecognitionBasis: basis }),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast({ title: "Could not update revenue basis", description: error.message, variant: "destructive" }),
  });

  const expenseTotal = useMemo(() =>
    data?.summary?.expenses ?? (data?.entries ?? []).filter((entry) => entry.entry_type === "expense").reduce((sum, entry) => sum + Number(entry.amount), 0),
  [data?.entries, data?.summary]);
  const revenueTotal = useMemo(() =>
    data?.summary?.revenue ?? (data?.entries ?? []).filter((entry) => entry.entry_type === "revenue").reduce((sum, entry) => sum + Number(entry.amount), 0),
  [data?.entries, data?.summary]);
  const resourceCostTotal = useMemo(() =>
    data?.summary?.resourceCosts ?? (data?.monthlyResourceCosts ?? []).reduce((sum, month) => sum + month.amount, 0),
  [data?.monthlyResourceCosts, data?.summary]);
  const money = (amount: number, currency = data?.currency ?? "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  const entryMonth = (entry: FinanceData["entries"][number]) =>
    entry.period_month?.slice(0, 7) ?? entry.achieved_on?.slice(0, 7) ?? "—";
  const milestoneName = (id: string | null) => data?.milestones.find((milestone) => milestone.id === id)?.name ?? "Milestone";

  if (isLoading) return <div className="animate-pulse rounded-xl bg-muted p-10" />;
  if (isError || !data) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Project finance could not be loaded. Check your finance access and try again.</CardContent></Card>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Accrual accounting</p>
        <h2 className="mt-1 text-2xl font-semibold">Project Finance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Track accrued revenue and expenses. Payments are not tracked here. Amounts are recorded in {data.currency}.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.canSeeProfitability && <Summary title="Accrued revenue" amount={revenueTotal} currency={data.currency} />}
        {data.canSeeExpenses && <Summary title="Other expenses" amount={expenseTotal} currency={data.currency} />}
        {data.canSeeCosts && <Summary title="Allocated resource costs" amount={resourceCostTotal} currency={data.currency} />}
        {data.canSeeProfitability && (
          <Summary title="Accrued margin" amount={revenueTotal - expenseTotal - resourceCostTotal} currency={data.currency} />
        )}
      </div>

      {(data.canSeeExpenses || data.canManageRevenue) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.canSeeExpenses && (
            <Card>
              <CardHeader><CardTitle className="text-base">Record an expense</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Organization expense head</Label>
                  <Select value={headId} onValueChange={setHeadId}>
                    <SelectTrigger><SelectValue placeholder="Choose an expense head" /></SelectTrigger>
                    <SelectContent>{data.expenseHeads.map((head) => <SelectItem key={head.id} value={head.id}>{head.name} ({head.code})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Accrual month</Label><Input type="month" value={expenseMonth} onChange={(event) => setExpenseMonth(event.target.value)} /></div>
                <div className="space-y-1.5"><Label>Amount ({data.currency})</Label><Input type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} rows={2} /></div>
                <Button className="sm:col-span-2" disabled={!headId || !expenseAmount || !expenseDescription.trim() || expenseMutation.isPending} onClick={() => expenseMutation.mutate()}>
                  Record expense
                </Button>
              </CardContent>
            </Card>
          )}

          {data.canManageRevenue && (
            <Card>
              <CardHeader><CardTitle className="text-base">Record accrued revenue</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Recognition basis</Label>
                  <Select value={data.revenueRecognitionBasis} onValueChange={(value) => settingsMutation.mutate(value as "monthly" | "milestone")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="monthly">By month</SelectItem><SelectItem value="milestone">By completed milestone</SelectItem></SelectContent>
                  </Select>
                </div>
                {data.revenueRecognitionBasis === "monthly" ? (
                  <div className="space-y-1.5"><Label>Revenue month</Label><Input type="month" value={revenueMonth} onChange={(event) => setRevenueMonth(event.target.value)} /></div>
                ) : (
                  <>
                    <div className="space-y-1.5"><Label>Completed milestone</Label>
                      <Select value={milestoneId} onValueChange={setMilestoneId}><SelectTrigger><SelectValue placeholder="Choose a completed milestone" /></SelectTrigger><SelectContent>{data.milestones.filter((milestone) => milestone.status === "completed").map((milestone) => <SelectItem key={milestone.id} value={milestone.id}>{milestone.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5"><Label>Achieved on</Label><Input type="date" value={achievedOn} onChange={(event) => setAchievedOn(event.target.value)} /></div>
                  </>
                )}
                <div className="space-y-1.5"><Label>Accrued amount ({data.currency})</Label><Input type="number" min="0.01" step="0.01" value={revenueAmount} onChange={(event) => setRevenueAmount(event.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Details</Label><Textarea value={revenueDescription} onChange={(event) => setRevenueDescription(event.target.value)} rows={2} /></div>
                <Button className="sm:col-span-2" disabled={!revenueAmount || !revenueDescription.trim() || (data.revenueRecognitionBasis === "milestone" && !milestoneId) || revenueMutation.isPending} onClick={() => revenueMutation.mutate()}>
                  Record revenue accrual
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Accrual report</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Month / milestone</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Details</th><th className="py-2 text-right">Amount</th></tr></thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">{entry.recognition_basis === "milestone" ? milestoneName(entry.milestone_id) : entryMonth(entry)}</td>
                    <td className="py-3 pr-3"><Badge variant={entry.entry_type === "revenue" ? "secondary" : "outline"}>{entry.entry_type}</Badge></td>
                    <td className="py-3 pr-3">{entry.description}</td>
                    <td className="py-3 text-right font-medium">{money(Number(entry.amount), entry.currency)}</td>
                  </tr>
                ))}
                {data.monthlyResourceCosts.map((month) => (
                  <tr key={`resource-${month.month}`} className="border-b last:border-0">
                    <td className="py-3 pr-3">{month.month}</td><td className="py-3 pr-3"><Badge variant="outline">resource cost</Badge></td><td className="py-3 pr-3">Allocated resource salary cost</td><td className="py-3 text-right font-medium">{money(month.amount, month.currency)}</td>
                  </tr>
                ))}
                {data.entries.length === 0 && data.monthlyResourceCosts.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No accruals recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ title, amount, currency }: { title: string; amount: number; currency: string }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold">{new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)}</p></CardContent></Card>;
}
