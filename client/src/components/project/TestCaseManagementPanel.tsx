import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, ChevronDown, Edit3, FlaskConical, Plus, Search, Sparkles, X, XCircle } from "lucide-react";

type TestCaseForm = {
  requirement: string;
  featureId: string;
  userStoryId: string;
  comment: string;
};

const emptyForm: TestCaseForm = { requirement: "", featureId: "", userStoryId: "", comment: "" };

function testCaseId(testCase: any) {
  return testCase.test_case_number
    ? `TC-${String(testCase.test_case_number).padStart(5, "0")}`
    : `TC-${String(testCase.id).slice(0, 8).toUpperCase()}`;
}

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not tested";
}

type PickerOption = { id: string; label: string; description?: string };

function SearchablePicker({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  multi = false,
}: {
  options: PickerOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder: string;
  emptyLabel: string;
  multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const selectedOptions = options.filter((option) => selected.includes(option.id));
  const triggerLabel = multi
    ? selected.length ? `${selected.length} selected` : placeholder
    : selectedOptions[0]?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-[280px] p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {!multi && (
                <CommandItem value="__none__" onSelect={() => { onChange(""); setOpen(false); }}>
                  <span className="text-muted-foreground">No selection</span>
                </CommandItem>
              )}
              {options.map((option) => {
                const isSelected = selected.includes(option.id);
                return (
                  <CommandItem
                    key={option.id}
                    value={`${option.label} ${option.description || ""}`}
                    onSelect={() => {
                      if (multi) {
                        onChange(isSelected ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
                      } else {
                        onChange(option.id);
                        setOpen(false);
                      }
                    }}
                  >
                    <CheckCircle2 className={`mr-2 h-4 w-4 ${isSelected ? "text-indigo-600 opacity-100" : "opacity-0"}`} />
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SelectionChips({ values, options, onRemove }: { values: string[]; options: PickerOption[]; onRemove: (id: string) => void }) {
  if (!values.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((id) => {
        const option = options.find((item) => item.id === id);
        if (!option) return null;
        return (
          <Badge key={id} variant="secondary" className="max-w-full gap-1 font-normal">
            <span className="truncate">{option.label}</span>
            <button type="button" aria-label={`Remove ${option.label}`} onClick={() => onRemove(id)}><X className="h-3 w-3" /></button>
          </Badge>
        );
      })}
    </div>
  );
}

export default function TestCaseManagementPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [authoring, setAuthoring] = useState(false);
  const [form, setForm] = useState<TestCaseForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiFeatureIds, setAiFeatureIds] = useState<string[]>([]);
  const [aiStoryIds, setAiStoryIds] = useState<string[]>([]);
  const [executionCase, setExecutionCase] = useState<any | null>(null);
  const [executionResult, setExecutionResult] = useState("passed");
  const [executionComment, setExecutionComment] = useState("");
  const [createDefect, setCreateDefect] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState("");
  const [caseStatus, setCaseStatus] = useState("all");
  const [caseFeature, setCaseFeature] = useState("");

  const casesQuery = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "test-cases"],
    queryFn: () => apiClient.get(`/projects/${projectId}/test-cases`),
  });
  const optionsQuery = useQuery<any>({
    queryKey: ["/api/projects", projectId, "test-cases", "options"],
    queryFn: () => apiClient.get(`/projects/${projectId}/test-cases/options`),
  });
  const cases = casesQuery.data ?? [];
  const options = optionsQuery.data ?? { features: [], stories: [], milestones: [] };
  const featureOptions = useMemo<PickerOption[]>(
    () => (options.features ?? []).map((feature: any) => ({ id: feature.id, label: feature.name, description: feature.description || undefined })),
    [options.features],
  );
  const storyOptions = useMemo<PickerOption[]>(
    () => (options.stories ?? []).map((story: any) => ({ id: story.id, label: `${story.tracking_number} · ${story.title}`, description: story.description || undefined })),
    [options.stories],
  );
  const formStoryOptions = useMemo(
    () => storyOptions.filter((story) => !form.featureId || (options.stories ?? []).find((item: any) => item.id === story.id)?.feature_id === form.featureId),
    [form.featureId, options.stories, storyOptions],
  );
  const filteredCases = useMemo(() => {
    const search = caseSearch.trim().toLowerCase();
    return cases.filter((testCase: any) => {
      const feature = (options.features ?? []).find((item: any) => item.id === testCase.feature_id);
      const story = (options.stories ?? []).find((item: any) => item.id === testCase.user_story_id);
      const searchable = [testCase.test_case_number, testCase.requirement, testCase.title, feature?.name, story?.title, story?.tracking_number].filter(Boolean).join(" ").toLowerCase();
      return (!search || searchable.includes(search)) &&
        (caseStatus === "all" || testCase.status === caseStatus) &&
        (!caseFeature || testCase.feature_id === caseFeature);
    });
  }, [caseFeature, caseSearch, caseStatus, cases, options.features, options.stories]);

  const invalidateCases = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "test-cases"] });

  const saveCase = useMutation({
    mutationFn: () => editingId
      ? apiClient.patch(`/projects/${projectId}/test-cases/${editingId}`, {
          requirement: form.requirement,
          title: form.requirement,
          featureId: form.featureId || null,
          userStoryId: form.userStoryId || null,
          comment: form.comment,
        })
      : apiClient.post(`/projects/${projectId}/test-cases`, {
          requirement: form.requirement,
          title: form.requirement,
          featureId: form.featureId || null,
          userStoryId: form.userStoryId || null,
          comment: form.comment,
        }),
    onSuccess: () => {
      invalidateCases();
      setForm(emptyForm);
      setEditingId(null);
      setAuthoring(false);
      toast({ title: editingId ? "Test case updated" : "Test case created" });
    },
    onError: (error: Error) => toast({ title: "Could not save test case", description: error.message, variant: "destructive" }),
  });

  const generateCases = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/test-cases/ai-generate`, {
      featureIds: aiFeatureIds,
      userStoryIds: aiStoryIds,
    }),
    onSuccess: (created: any[]) => {
      invalidateCases();
      setAiFeatureIds([]);
      setAiStoryIds([]);
      toast({ title: `${created.length} AI test case${created.length === 1 ? "" : "s"} created`, description: "Review and edit them before execution." });
    },
    onError: (error: Error) => toast({ title: "Could not generate test cases", description: error.message, variant: "destructive" }),
  });

  const executeCase = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/test-cases/${executionCase.id}/results`, {
      result: executionResult,
      comment: executionComment,
      createDefect: executionResult === "failed" && createDefect,
    }),
    onSuccess: (response: any) => {
      invalidateCases();
      setExecutionCase(null);
      setExecutionComment("");
      toast({
        title: executionResult === "passed" ? "Test execution recorded" : "Failed execution recorded",
        description: response.defectId ? "A draft defect was created for QA review." : undefined,
      });
    },
    onError: (error: Error) => toast({ title: "Could not record execution", description: error.message, variant: "destructive" }),
  });

  const closeCase = useMutation({
    mutationFn: (testCaseId: string) => apiClient.post(`/projects/${projectId}/test-cases/${testCaseId}/close`, {}),
    onSuccess: () => {
      invalidateCases();
      toast({ title: "Test case closed" });
    },
    onError: (error: Error) => toast({ title: "Could not close test case", description: error.message, variant: "destructive" }),
  });

  function beginEdit(testCase: any) {
    setEditingId(testCase.id);
    setForm({
      requirement: testCase.requirement || testCase.title || "",
      featureId: testCase.feature_id || "",
      userStoryId: testCase.user_story_id || "",
      comment: testCase.comment || "",
    });
    setAuthoring(true);
  }

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Quality assurance</p>
          <h2 className="mt-1 text-2xl font-semibold">Test Cases</h2>
          <p className="mt-1 text-sm text-muted-foreground">Author, execute, audit, and close test cases against project requirements.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setAuthoring((value) => !value); }}>
          <Plus className="mr-2 h-4 w-4" />{authoring ? "Close authoring" : "Create test case"}
        </Button>
      </div>

      {authoring && (
        <Card>
          <CardHeader><CardTitle className="text-base">{editingId ? "Edit test case" : "Manual test case"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Requirement *</Label>
              <Textarea value={form.requirement} onChange={(event) => setForm({ ...form, requirement: event.target.value })} placeholder="Describe the behavior or acceptance requirement to verify." />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Feature</Label>
                <SearchablePicker
                  options={featureOptions}
                  value={form.featureId}
                  onChange={(value) => setForm({ ...form, featureId: value as string, userStoryId: "" })}
                  placeholder="Select feature"
                  emptyLabel="No matching features"
                />
              </div>
              <div>
                <Label>User Story</Label>
                <SearchablePicker
                  options={formStoryOptions}
                  value={form.userStoryId}
                  onChange={(value) => setForm({ ...form, userStoryId: value as string })}
                  placeholder="Optional user story"
                  emptyLabel={form.featureId ? "No stories for this feature" : "No matching user stories"}
                />
              </div>
              <div>
                <Label>Comment</Label>
                <Input value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="Author note" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); setAuthoring(false); }}>Cancel</Button>}
              <Button disabled={!form.requirement.trim() || saveCase.isPending} onClick={() => saveCase.mutate()}>{editingId ? "Save changes" : "Create test case"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-indigo-500" />Generate from features or user stories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Select functionality, generate draft cases with AI, then edit them in the test-case table before running them.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Features to cover</Label>
              <SearchablePicker
                multi
                options={featureOptions}
                value={aiFeatureIds}
                onChange={(value) => setAiFeatureIds(value as string[])}
                placeholder="Search and select features"
                emptyLabel="No matching features"
              />
              <SelectionChips values={aiFeatureIds} options={featureOptions} onRemove={(id) => setAiFeatureIds((current) => current.filter((item) => item !== id))} />
            </div>
            <div className="space-y-2">
              <Label>User stories to cover</Label>
              <SearchablePicker
                multi
                options={storyOptions}
                value={aiStoryIds}
                onChange={(value) => setAiStoryIds(value as string[])}
                placeholder="Search and select user stories"
                emptyLabel="No matching user stories"
              />
              <SelectionChips values={aiStoryIds} options={storyOptions} onRemove={(id) => setAiStoryIds((current) => current.filter((item) => item !== id))} />
            </div>
          </div>
          <Button variant="outline" disabled={(!aiFeatureIds.length && !aiStoryIds.length) || generateCases.isPending} onClick={() => generateCases.mutate()}>
            <Sparkles className="mr-2 h-4 w-4" />Generate test cases
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">{filteredCases.length} of {cases.length} test case{cases.length === 1 ? "" : "s"}</CardTitle>
            {(caseSearch || caseStatus !== "all" || caseFeature) && <Button variant="ghost" size="sm" onClick={() => { setCaseSearch(""); setCaseStatus("all"); setCaseFeature(""); }}>Clear filters</Button>}
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={caseSearch} onChange={(event) => setCaseSearch(event.target.value)} placeholder="Search ID, requirement, feature, or story..." />
            </div>
            <Select value={caseStatus} onValueChange={setCaseStatus}>
              <SelectTrigger><SelectValue placeholder="All results" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All results</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="passed">Passed</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent>
            </Select>
            <SearchablePicker options={featureOptions} value={caseFeature} onChange={(value) => setCaseFeature(value as string)} placeholder="Filter by feature" emptyLabel="No matching features" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cases.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No test cases yet. Create one manually or generate cases from a feature or user story.</div>
          ) : filteredCases.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No test cases match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground"><th className="p-3">Test Case ID</th><th className="p-3">Requirement</th><th className="p-3">Result</th><th className="p-3">Last tested</th><th className="p-3 text-right">Actions</th></tr></thead>
                <tbody>
                  {filteredCases.map((testCase: any) => {
                    const latest = testCase.results?.[0];
                    const feature = (options.features ?? []).find((item: any) => item.id === testCase.feature_id);
                    const story = (options.stories ?? []).find((item: any) => item.id === testCase.user_story_id);
                    return (
                      <tr key={testCase.id} className="border-b align-top">
                        <td className="p-3 font-mono text-xs">{testCaseId(testCase)}<div className="mt-1 flex gap-1"><Badge variant="outline">{testCase.source === "ai" ? "AI" : "Manual"}</Badge>{testCase.closed_at && <Badge>Closed</Badge>}</div></td>
                        <td className="max-w-[360px] p-3"><p className="font-medium">{testCase.requirement || testCase.title}</p><p className="mt-1 text-xs text-muted-foreground">{feature?.name ?? "No feature"}{story ? ` · ${story.tracking_number}` : ""}</p></td>
                        <td className="p-3"><Badge variant={testCase.status === "passed" ? "default" : testCase.status === "failed" ? "destructive" : "outline"}>{testCase.status}</Badge>{latest?.defect_id && <p className="mt-1 text-[10px] text-amber-700">Defect created</p>}</td>
                        <td className="p-3 text-xs text-muted-foreground">{dateLabel(testCase.last_tested_at)}<br />{latest?.testedBy?.user_name || latest?.testedBy?.email || "—"}</td>
                        <td className="p-3"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => beginEdit(testCase)}><Edit3 className="mr-1 h-3.5 w-3.5" />Edit</Button><Button size="sm" onClick={() => { setExecutionCase(testCase); setExecutionResult("passed"); }} disabled={!!testCase.closed_at}><FlaskConical className="mr-1 h-3.5 w-3.5" />Run</Button></div><div className="mt-2 flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === testCase.id ? null : testCase.id)}>History ({testCase.results?.length ?? 0})</Button>{testCase.status === "passed" && !testCase.closed_at && <Button size="sm" variant="ghost" onClick={() => closeCase.mutate(testCase.id)}>Close</Button>}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCases.filter((testCase: any) => expandedId === testCase.id).map((testCase: any) => (
                <div key={`history-${testCase.id}`} className="border-t bg-muted/20 p-4">
                  <p className="mb-2 text-sm font-medium">{testCaseId(testCase)} execution history</p>
                  {testCase.results?.length ? <table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">Run</th><th className="p-2">Result</th><th className="p-2">Comment</th><th className="p-2">Tested by</th><th className="p-2">Date</th><th className="p-2">Defect</th></tr></thead><tbody>{testCase.results.map((result: any) => <tr key={result.id} className="border-b"><td className="p-2">Pass {result.execution_number}</td><td className="p-2">{result.result === "passed" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}</td><td className="p-2">{result.comment || "—"}</td><td className="p-2">{result.testedBy?.user_name || result.testedBy?.email || result.tested_by}</td><td className="p-2">{dateLabel(result.tested_at)}</td><td className="p-2">{result.defect_id ? "Created" : "—"}</td></tr>)}</tbody></table> : <p className="text-xs text-muted-foreground">No executions yet.</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!executionCase} onOpenChange={(open) => !open && setExecutionCase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record execution · {executionCase ? testCaseId(executionCase) : ""}</DialogTitle>
            <DialogDescription>Save this run to the permanent execution history. Failed runs can create a draft defect for QA review.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{executionCase?.requirement || executionCase?.title}</p>
            <div><Label>Result</Label><Select value={executionResult} onValueChange={setExecutionResult}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="passed">Passed</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select></div>
            <div><Label>Comment</Label><Textarea value={executionComment} onChange={(event) => setExecutionComment(event.target.value)} placeholder="Observed result, evidence, or failure details" /></div>
            {executionResult === "failed" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={createDefect} onCheckedChange={(checked) => setCreateDefect(checked === true)} />Create a draft defect automatically for QA review</label>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setExecutionCase(null)}>Cancel</Button><Button disabled={executeCase.isPending} onClick={() => executeCase.mutate()}>Save execution</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}