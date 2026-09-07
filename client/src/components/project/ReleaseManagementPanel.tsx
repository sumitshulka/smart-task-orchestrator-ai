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
  const [scopeSearch, setScopeSearch] = useState("");
  const [expandedRelease, setExpandedRelease] = useState<string | null>(null);

  const releasesQuery = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "releases"],
    queryFn: () => apiClient.get(`/projects/${projectId}/releases`),
  });
  const optionsQuery = useQuery<any>({
    queryKey: ["/api/projects", projectId, "releases", "options"],
    queryFn: () => apiClient.get(`/projects/${projectId}/releases/options`),
  });
  const options = optionsQuery.data ?? { milestones: [], featureGroups: [], features: [], stories: [], tasks: [], defects: [], testCases: [] };
  const selectedMilestones = useMemo(
    () => options.milestones.filter((milestone: any) => milestoneIds.includes(milestone.id)),
    [milestoneIds, options.milestones],
  );
  const selectedStoryIds = useMemo(
    () => selections.filter((item) => item.itemType === "user_story").map((item) => item.itemId),
    [selections],
  );
  const selectedFeatureIds = useMemo(() => {
    const directFeatureIds = selections.filter((item) => item.itemType === "feature").map((item) => item.itemId);
    const storyFeatureIds = options.stories
      .filter((story: any) => selectedStoryIds.includes(story.id) && story.feature_id)
      .map((story: any) => story.feature_id);
    return Array.from(new Set([...directFeatureIds, ...storyFeatureIds]));
  }, [options.stories, selectedStoryIds, selections]);
  const includedDefects = useMemo(
    () => options.defects.filter((defect: any) => defect.feature_id && selectedFeatureIds.includes(defect.feature_id)),
    [options.defects, selectedFeatureIds],
  );
  const includedTestCases = useMemo(
    () => options.testCases.filter((testCase: any) =>
      (testCase.feature_id && selectedFeatureIds.includes(testCase.feature_id)) ||
      (testCase.user_story_id && selectedStoryIds.includes(testCase.user_story_id)),
    ),
    [options.testCases, selectedFeatureIds, selectedStoryIds],
  );

  const createRelease = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/releases`, {
      ...form,
      milestoneIds,
      items: selections.map((item) => ({ milestoneId: item.milestoneId, itemType: item.itemType, itemId: item.itemId })),
      documents: documents.filter((document) => document.name.trim()),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "releases"] });
      toast({ title: "Release created" });
      setCreating(false);
      setForm({ name: "", version: "", comment: "" });
      setMilestoneIds([]);
      setSelections([]);
      setDocuments([{ name: "", description: "" }]);
      setScopeSearch("");
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

  const toggleMilestone = (milestoneId: string, checked: boolean) => {
    setMilestoneIds((current) => checked
      ? [...current, milestoneId]
      : current.filter((id) => id !== milestoneId));
    if (!checked) {
      setSelections((current) => current.filter((item) => item.milestoneId !== milestoneId));
    }
  };

  const renderItems = (milestoneId: string) => {
    const search = scopeSearch.trim().toLowerCase();
    const featureRows = options.features.filter((feature: any) => {
      if (feature.milestone_id !== milestoneId) return false;
      if (!search) return true;
      const featureMatches = `${feature.tracking_number} ${feature.name}`.toLowerCase().includes(search);
      const storyMatches = options.stories.some((story: any) => story.feature_id === feature.id && `${story.tracking_number} ${story.title}`.toLowerCase().includes(search));
      const taskMatches = options.tasks.some((task: any) => task.milestone_id === milestoneId && task.feature_id === feature.id && `${task.task_number} ${task.title}`.toLowerCase().includes(search));
      return featureMatches || storyMatches || taskMatches;
    });
    return featureRows.length ? (
      <div className="space-y-3">
        {featureRows.map((feature: any) => {
          const stories = options.stories.filter((story: any) => story.feature_id === feature.id && (
            !search || `${story.tracking_number} ${story.title}`.toLowerCase().includes(search)
          ));
          const featureSelected = selectedFeatureIds.includes(feature.id);
          const storySelected = selectedStoryIds.some((storyId) =>
            options.stories.find((story: any) => story.id === storyId)?.feature_id === feature.id,
          );
          const tasks = options.tasks.filter((task: any) => task.milestone_id === milestoneId && task.feature_id === feature.id && (
            !search || `${task.task_number} ${task.title}`.toLowerCase().includes(search)
          ));
          return (
            <div key={feature.id} className="rounded-lg border bg-background p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox checked={featureSelected} onCheckedChange={() => toggleSelection({ milestoneId, itemType: "feature", itemId: feature.id })} />
                <span className="truncate">{feature.tracking_number} · {feature.name}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{statusLabel(feature.status ?? "planned")}</Badge>
              </label>
              <div className="ml-6 mt-3 space-y-2 border-l pl-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User stories</p>
                {stories.length ? stories.map((story: any) => (
                  <label key={story.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={selectedStoryIds.includes(story.id)} onCheckedChange={() => toggleSelection({ milestoneId, itemType: "user_story", itemId: story.id })} />
                    <span className="truncate">{story.tracking_number} · {story.title}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{statusLabel(story.status ?? "planned")}</Badge>
                  </label>
                )) : <p className="text-xs text-muted-foreground">No user stories for this feature.</p>}
                {(featureSelected || storySelected) && (
                  <div className="pt-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Related tasks</p>
                    {tasks.length ? tasks.map((task: any) => (
                      <label key={task.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                        <Checkbox checked={selections.some((item) => item.itemType === "task" && item.itemId === task.id)} onCheckedChange={() => toggleSelection({ milestoneId, itemType: "task", itemId: task.id })} />
                        <span className="truncate">{task.task_number ? `T-${task.task_number} · ` : ""}{task.title}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">{statusLabel(task.status ?? "planned")}</Badge>
                      </label>
                    )) : <p className="text-xs text-muted-foreground">No tasks are linked to this feature.</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ) : <p className="text-xs text-muted-foreground">No matching features are assigned to this milestone.</p>;
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
                    <Checkbox checked={milestoneIds.includes(milestone.id)} onCheckedChange={(checked) => toggleMilestone(milestone.id, checked === true)} />
                    <span className="truncate">{milestone.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {selectedMilestones.map((milestone: any) => (
              <div key={milestone.id} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">{milestone.name} · scope</p>
                {renderItems(milestone.id)}
              </div>
            ))}
            {selectedMilestones.length > 0 && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Included automatically</p>
                    <p className="text-xs text-muted-foreground">Defects and test cases follow the selected features and user stories. They are not manually selectable.</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{includedDefects.length} defects</Badge>
                    <Badge variant="secondary">{includedTestCases.length} test cases</Badge>
                  </div>
                </div>
              </div>
            )}
            {selectedMilestones.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3">
                <Label>Find scope items</Label>
                <Input className="mt-2" value={scopeSearch} onChange={(event) => setScopeSearch(event.target.value)} placeholder="Search features, user stories, or tasks..." />
              </div>
            )}
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
                {releaseDetailQuery.data.dependencies && (
                  <div className="mt-4 rounded-md border bg-background p-3">
                    <p className="text-sm font-medium">Scope-dependent evidence</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {releaseDetailQuery.data.dependencies.selectedFeatureIds?.length ?? 0} feature scope item(s),{" "}
                      {releaseDetailQuery.data.dependencies.selectedStoryIds?.length ?? 0} user stor{(releaseDetailQuery.data.dependencies.selectedStoryIds?.length ?? 0) === 1 ? "y" : "ies"},{" "}
                      {releaseDetailQuery.data.dependencies.includedDefects?.length ?? 0} included defect(s), and{" "}
                      {releaseDetailQuery.data.dependencies.includedTestCases?.length ?? 0} included test case(s).
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Defects and test cases are derived from the selected features and user stories and cannot be changed independently.</p>
                  </div>
                )}
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