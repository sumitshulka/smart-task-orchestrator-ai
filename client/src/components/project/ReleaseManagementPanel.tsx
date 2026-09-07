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
import { PackageCheck, Plus, Send, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

type ReleaseManagementPanelProps = { projectId: string };
type Selection = { milestoneId: string; itemType: "feature" | "user_story" | "task"; itemId: string };

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function ReleaseManagementPanel({ projectId }: ReleaseManagementPanelProps) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", version: "", comment: "" });
  const [milestoneIds, setMilestoneIds] = useState<string[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [documents, setDocuments] = useState([{ name: "", description: "" }]);
  const [testCaseIds, setTestCaseIds] = useState<string[]>([]);
  const [expandedRelease, setExpandedRelease] = useState<string | null>(null);

  const releasesQuery = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "releases"],
    queryFn: () => apiClient.get(`/projects/${projectId}/releases`),
  });
  const optionsQuery = useQuery<any>({
    queryKey: ["/api/projects", projectId, "releases", "options"],
    queryFn: () => apiClient.get(`/projects/${projectId}/releases/options`),
  });
  const testCasesQuery = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "test-cases"],
    queryFn: () => apiClient.get(`/projects/${projectId}/test-cases`),
  });

  const options = optionsQuery.data ?? { milestones: [], features: [], stories: [], tasks: [], testCases: [] };
  const selectedMilestones = useMemo(
    () => options.milestones.filter((milestone: any) => milestoneIds.includes(milestone.id)),
    [milestoneIds, options.milestones],
  );

  const createRelease = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/releases`, {
      ...form,
      milestoneIds,
      items: selections.map((item) => ({ milestoneId: item.milestoneId, itemType: item.itemType, itemId: item.itemId })),
      documents: documents.filter((document) => document.name.trim()),
      testCaseIds,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "releases"] });
      toast({ title: "Release created" });
      setCreating(false);
      setForm({ name: "", version: "", comment: "" });
      setMilestoneIds([]);
      setSelections([]);
      setDocuments([{ name: "", description: "" }]);
      setTestCaseIds([]);
    },
    onError: (error: Error) => toast({ title: "Could not create release", description: error.message, variant: "destructive" }),
  });

  const action = useMutation({
    mutationFn: ({ releaseId, action: actionName }: { releaseId: string; action: "submit" | "qa-approve" | "approve" }) =>
      apiClient.post(`/projects/${projectId}/releases/${releaseId}/${actionName}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "releases"] }),
    onError: (error: Error) => toast({ title: "Release action blocked", description: error.message, variant: "destructive" }),
  });
  const releaseDetailQuery = useQuery<any>({
    queryKey: ["/api/projects", projectId, "releases", expandedRelease],
    queryFn: () => apiClient.get(`/projects/${projectId}/releases/${expandedRelease}`),
    enabled: !!expandedRelease,
  });
  const updateDocument = useMutation({
    mutationFn: ({ releaseId, documentId, data }: { releaseId: string; documentId: string; data: any }) =>
      apiClient.patch(`/projects/${projectId}/releases/${releaseId}/documents/${documentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "releases", expandedRelease] });
      toast({ title: "Document evidence updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update document", description: error.message, variant: "destructive" }),
  });

  const toggleSelection = (selection: Selection) => {
    setSelections((current) => current.some((item) => item.itemType === selection.itemType && item.itemId === selection.itemId)
      ? current.filter((item) => !(item.itemType === selection.itemType && item.itemId === selection.itemId))
      : [...current, selection]);
  };

  const renderItems = (milestoneId: string) => {
    const featureIds = new Set(options.features.filter((item: any) => item.milestone_id === milestoneId).map((item: any) => item.id));
    const storyRows = options.stories.filter((item: any) => featureIds.has(item.feature_id));
    const taskRows = options.tasks.filter((item: any) => item.milestone_id === milestoneId);
    const featureRows = options.features.filter((item: any) => item.milestone_id === milestoneId);
    const rows = [
      ...featureRows.map((item: any) => ({ ...item, itemType: "feature" as const })),
      ...storyRows.map((item: any) => ({ ...item, itemType: "user_story" as const })),
      ...taskRows.map((item: any) => ({ ...item, itemType: "task" as const })),
    ];
    return rows.length ? (
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((item: any) => {
          const checked = selections.some((selected) => selected.itemType === item.itemType && selected.itemId === item.id);
          return (
            <label key={`${item.itemType}-${item.id}`} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={() => toggleSelection({ milestoneId, itemType: item.itemType, itemId: item.id })} />
              <span className="truncate">{item.tracking_number ? `${item.tracking_number} · ` : ""}{item.title ?? item.name}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{statusLabel(item.status ?? "planned")}</Badge>
            </label>
          );
        })}
      </div>
    ) : <p className="text-xs text-muted-foreground">No features, user stories, or tasks are assigned to this milestone.</p>;
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Delivery control</p>
          <h2 className="mt-1 text-2xl font-semibold">Release Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">Build a release from milestone scope, collect evidence, and enforce QA readiness before approval.</p>
        </div>
        <Button onClick={() => setCreating((value) => !value)}><Plus className="mr-2 h-4 w-4" />{creating ? "Close" : "Create Release"}</Button>
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-base">New release</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Mobile launch" /></div>
              <div><Label>Repository version</Label><Input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="1.0.0" /></div>
              <div><Label>Release comment</Label><Input value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="What is included?" /></div>
            </div>
            <div>
              <Label>Milestones</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {options.milestones.map((milestone: any) => (
                  <label key={milestone.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox checked={milestoneIds.includes(milestone.id)} onCheckedChange={(checked) => setMilestoneIds((current) => checked ? [...current, milestone.id] : current.filter((id) => id !== milestone.id))} />
                    <span className="truncate">{milestone.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {selectedMilestones.map((milestone: any) => (
              <div key={milestone.id} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">{milestone.name} · release items</p>
                {renderItems(milestone.id)}
              </div>
            ))}
            <div>
              <div className="mb-2 flex items-center justify-between"><Label>Required documents</Label><Button type="button" size="sm" variant="outline" onClick={() => setDocuments([...documents, { name: "", description: "" }])}>Add document</Button></div>
              <div className="space-y-2">
                {documents.map((document, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-2">
                    <Input placeholder="Document name" value={document.name} onChange={(event) => setDocuments(documents.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} />
                    <Input placeholder="Description or evidence expected" value={document.description} onChange={(event) => setDocuments(documents.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Test cases in this release</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(testCasesQuery.data ?? []).map((testCase: any) => (
                  <label key={testCase.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox checked={testCaseIds.includes(testCase.id)} onCheckedChange={(checked) => setTestCaseIds((current) => checked ? [...current, testCase.id] : current.filter((id) => id !== testCase.id))} />
                    <span className="truncate">{testCase.title}</span><Badge variant="outline" className="ml-auto">{statusLabel(testCase.status)}</Badge>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end"><Button disabled={createRelease.isPending} onClick={() => createRelease.mutate()}>Create release</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(releasesQuery.data ?? []).length === 0 && !creating && (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><PackageCheck className="mb-3 h-10 w-10 text-indigo-500" /><p className="font-medium">No releases yet</p><p className="mt-1 text-sm text-muted-foreground">Create the first release when a milestone is ready for delivery.</p></CardContent></Card>
        )}
        {(releasesQuery.data ?? []).map((release: any) => (
          <Card key={release.id}>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <button className="min-w-[220px] flex-1 text-left" onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)}>
                <div className="flex items-center gap-2"><h3 className="font-semibold">{release.name}</h3><Badge variant="outline">v{release.version}</Badge><Badge>{statusLabel(release.status)}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{release.comment}</p>
              </button>
              <div className="flex flex-wrap gap-2">
                {release.status === "draft" && <Button size="sm" variant="outline" onClick={() => action.mutate({ releaseId: release.id, action: "submit" })}><Send className="mr-1 h-3.5 w-3.5" />Submit</Button>}
                {release.status === "pending_approval" && <Button size="sm" variant="outline" onClick={() => action.mutate({ releaseId: release.id, action: "qa-approve" })}><ShieldCheck className="mr-1 h-3.5 w-3.5" />QA approve</Button>}
                {release.status === "qa_approved" && <Button size="sm" onClick={() => action.mutate({ releaseId: release.id, action: "approve" })}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve release</Button>}
              </div>
            </CardContent>
            {expandedRelease === release.id && releaseDetailQuery.data && (
              <CardContent className="border-t bg-muted/20 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">Required evidence</p>
                  <Badge variant={releaseDetailQuery.data.readiness?.ready ? "default" : "outline"}>
                    {releaseDetailQuery.data.readiness?.ready ? "Ready for approval" : `${releaseDetailQuery.data.readiness?.blockers?.length ?? 0} blockers`}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {(releaseDetailQuery.data.documents ?? []).map((document: any) => (
                    <div key={document.id} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[1fr_180px_1fr_auto] md:items-center">
                      <div><p className="text-sm font-medium">{document.name}</p>{document.description && <p className="text-xs text-muted-foreground">{document.description}</p>}</div>
                      <select className="h-9 rounded-md border bg-background px-2 text-sm" defaultValue={document.status} onChange={(event) => updateDocument.mutate({ releaseId: release.id, documentId: document.id, data: { status: event.target.value, location: document.location } })}>
                        <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="deferred">Deferred</option>
                      </select>
                      <Input defaultValue={document.location ?? ""} placeholder="Stored location / URL" onBlur={(event) => updateDocument.mutate({ releaseId: release.id, documentId: document.id, data: { status: document.status, location: event.target.value } })} />
                      <Badge variant="outline">{document.required ? "Required" : "Optional"}</Badge>
                    </div>
                  ))}
                </div>
                {(releaseDetailQuery.data.readiness?.blockers ?? []).length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground">{releaseDetailQuery.data.readiness.blockers.map((blocker: string) => <li key={blocker}>{blocker}</li>)}</ul>}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Final approval checks completed and approved tasks, passed or deferred test cases, approved documents with locations, closed or deferred defects, and QA approval.
      </div>
      <div className="hidden"><Textarea /></div>
    </div>
  );
}