import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Calendar, Check, ChevronRight, Clock3, Download, FileText, Link2, ListChecks, MessageSquare,
  Paperclip, Plus, RefreshCw, Send, Users, X,
} from "lucide-react";
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

type Meeting = any;

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  in_progress: { label: "In progress", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
};

function localDateTime(date = new Date(Date.now() + 60 * 60 * 1000)) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function prettyDate(value: string | Date) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function statusBadge(status: string) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return <Badge className={`border-0 ${meta.className}`}>{meta.label}</Badge>;
}

function downloadMeetingFile(projectId: string, meetingId: string, kind: "ics" | "pdf") {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  fetch(`/api/projects/${projectId}/meetings/${meetingId}/${kind}`, { headers: user?.id ? { "x-user-id": user.id } : {} })
    .then(async (response) => {
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "ics" ? "meeting-invitation.ics" : "meeting-minutes.pdf";
      link.click();
      URL.revokeObjectURL(url);
    })
    .catch((error) => window.dispatchEvent(new CustomEvent("tazq-toast", { detail: { title: "Download failed", description: error.message } })));
}

export default function ProjectMeetingsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", meetingTypeId: "", category: "internal", startsAt: localDateTime(),
    endsAt: localDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    location: "", meetingLink: "", description: "", recurrenceRule: "", carryForwardActions: false,
    attendees: [] as { id: string; attendeeType: string; required: boolean }[],
  });

  const meetingsQuery = useQuery<Meeting[]>({
    queryKey: ["/api/projects", projectId, "meetings", search, statusFilter],
    queryFn: () => apiClient.get(`/projects/${projectId}/meetings?search=${encodeURIComponent(search)}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`),
  });
  const optionsQuery = useQuery<any>({
    queryKey: ["/api/projects", projectId, "meetings/options"],
    queryFn: () => apiClient.get(`/projects/${projectId}/meetings/options`),
  });
  const detailQuery = useQuery<any>({
    queryKey: ["/api/projects", projectId, "meetings", selectedId],
    queryFn: () => apiClient.get(`/projects/${projectId}/meetings/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const invalidateMeetings = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "meetings"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "meetings", selectedId] });
  };
  const createMeeting = useMutation({
    mutationFn: (payload: any) => apiClient.post(`/projects/${projectId}/meetings`, payload),
    onSuccess: (created) => {
      setShowCreate(false);
      setSelectedId(created.meeting.id);
      invalidateMeetings();
      toast({ title: "Meeting created", description: "Your meeting workspace is ready." });
    },
    onError: (error: Error) => toast({ title: "Could not create meeting", description: error.message, variant: "destructive" }),
  });
  const updateMeeting = useMutation({
    mutationFn: ({ path, data }: { path: string; data: any }) => apiClient.post(path, data),
    onSuccess: invalidateMeetings,
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const displayedMeetings = meetingsQuery.data ?? [];
  const options = optionsQuery.data ?? { meetingTypes: [], projectMembers: [], clientMembers: [] };
  const detail = detailQuery.data;

  const toggleAttendee = (person: any) => {
    setForm((current) => {
      const exists = current.attendees.some((item) => item.id === person.id && item.attendeeType === person.attendeeType);
      return {
        ...current,
        attendees: exists
          ? current.attendees.filter((item) => !(item.id === person.id && item.attendeeType === person.attendeeType))
          : [...current.attendees, { id: person.id, attendeeType: person.attendeeType, required: true }],
      };
    });
  };
  const changeCategory = (category: string) => {
    setForm((current) => ({
      ...current,
      category,
      attendees: category === "internal"
        ? current.attendees.filter((attendee) => attendee.attendeeType !== "client")
        : current.attendees,
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Project collaboration</p>
          <h2 className="mt-1 text-2xl font-semibold text-gray-950 dark:text-white">Meetings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Plan agendas, capture decisions, and keep actions connected to delivery.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Schedule meeting</Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(290px,360px)_1fr]">
        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Meeting register</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => meetingsQuery.refetch()}><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              <Input placeholder="Search meetings..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(STATUS_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-290px)] space-y-2 overflow-y-auto p-3">
            {meetingsQuery.isLoading && <p className="p-4 text-sm text-gray-500">Loading meetings...</p>}
            {!meetingsQuery.isLoading && !displayedMeetings.length && <div className="rounded-xl border border-dashed p-6 text-center"><Calendar className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p className="text-sm font-medium">No meetings yet</p><p className="mt-1 text-xs text-gray-500">Schedule the first project meeting.</p></div>}
            {displayedMeetings.map((meeting) => (
              <button key={meeting.id} onClick={() => setSelectedId(meeting.id)} className={`w-full rounded-xl border p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 ${selectedId === meeting.id ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/30" : "border-gray-200 dark:border-gray-800"}`}>
                <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-semibold">{meeting.title}</span>{statusBadge(meeting.status)}</div>
                <p className="mt-2 text-xs text-gray-500"><Clock3 className="mr-1 inline h-3 w-3" />{prettyDate(meeting.starts_at)}</p>
                <div className="mt-2 flex gap-3 text-[11px] text-gray-500"><span><Users className="mr-1 inline h-3 w-3" />{meeting.attendeeCount}</span><span><ListChecks className="mr-1 inline h-3 w-3" />{meeting.openActionCount} open</span>{meeting.overdueActionCount > 0 && <span className="font-medium text-red-600">{meeting.overdueActionCount} overdue</span>}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {!detail && <Card className="flex min-h-[420px] items-center justify-center border-dashed"><CardContent className="text-center"><Calendar className="mx-auto mb-4 h-10 w-10 text-gray-300" /><p className="font-medium">Choose a meeting</p><p className="mt-1 text-sm text-gray-500">Meeting agendas, notes, decisions, and actions will appear here.</p></CardContent></Card>}
        {detail && <MeetingWorkspace projectId={projectId} detail={detail} options={options} onRefresh={invalidateMeetings} onStatus={(status) => updateMeeting.mutate({ path: `/projects/${projectId}/meetings/${detail.meeting.id}/status`, data: { status } })} />}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Schedule a project meeting</DialogTitle><DialogDescription>Set the meeting context now; you can build its agenda and minutes in the workspace.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Meeting title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Weekly delivery review" /></div>
            <div className="space-y-1.5"><Label>Meeting type</Label><Select value={form.meetingTypeId} onValueChange={(value) => setForm({ ...form, meetingTypeId: value })}><SelectTrigger><SelectValue placeholder="Choose a type" /></SelectTrigger><SelectContent>{options.meetingTypes.map((type: any) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Audience</Label><Select value={form.category} onValueChange={changeCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="client">Client</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Starts</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Ends</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Conference room or address" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Meeting link</Label><Input value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Purpose / description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What should this meeting accomplish?" /></div>
            <div className="space-y-1.5"><Label>Recurrence</Label><Select value={form.recurrenceRule || "none"} onValueChange={(value) => setForm({ ...form, recurrenceRule: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">One-time meeting</SelectItem><SelectItem value="weekly">Repeat weekly</SelectItem><SelectItem value="monthly">Repeat monthly</SelectItem></SelectContent></Select></div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={form.carryForwardActions} onChange={(e) => setForm({ ...form, carryForwardActions: e.target.checked })} />Carry forward open actions from the previous meeting</label>
            <div className="space-y-3 sm:col-span-2">
              <Label>Attendees</Label>
              <p className="text-xs text-gray-500">Choose people by membership type. Internal meetings cannot include client members.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                  <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Internal members</p><Badge variant="outline" className="text-[10px]">{options.projectMembers.length}</Badge></div>
                  <div className="space-y-2">{options.projectMembers.length ? options.projectMembers.map((person: any) => { const selected = form.attendees.some((item) => item.id === person.id && item.attendeeType === person.attendeeType); return <button type="button" key={`internal-${person.id}`} onClick={() => toggleAttendee(person)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm ${selected ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300"}`}>{selected && <Check className="h-3 w-3" />}</span><span className="min-w-0 flex-1 truncate">{person.name}</span><span className="text-[10px] text-gray-400">{person.role || "Project member"}</span></button>; }) : <p className="text-xs text-gray-500">No internal members available.</p>}</div>
                </div>
                {form.category !== "internal" && (
                  <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Client members</p><Badge variant="outline" className="text-[10px]">{options.clientMembers.length}</Badge></div>
                    <div className="space-y-2">{options.clientMembers.length ? options.clientMembers.map((person: any) => { const selected = form.attendees.some((item) => item.id === person.id && item.attendeeType === person.attendeeType); return <button type="button" key={`client-${person.id}`} onClick={() => toggleAttendee(person)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm ${selected ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300"}`}>{selected && <Check className="h-3 w-3" />}</span><span className="min-w-0 flex-1 truncate">{person.name}</span><span className="text-[10px] text-gray-400">{person.role || "Client contact"}</span></button>; }) : <p className="text-xs text-gray-500">No client members available.</p>}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button disabled={createMeeting.isPending || !form.title || !form.meetingTypeId} onClick={() => createMeeting.mutate(form)}>{createMeeting.isPending ? "Creating..." : "Create meeting"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeetingWorkspace({ projectId, detail, options, onRefresh, onStatus }: { projectId: string; detail: any; options: any; onRefresh: () => void; onStatus: (status: string) => void }) {
  const { toast } = useToast();
  const { meeting } = detail;
  const [summary, setSummary] = useState(meeting.minutes_summary || "");
  const [notes, setNotes] = useState(meeting.additional_notes || "");
  const [agendaTitle, setAgendaTitle] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [discussionTopic, setDiscussionTopic] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [showMinutes, setShowMinutes] = useState(meeting.minutes_status === "published" || meeting.status === "completed");
  const save = useMutation({
    mutationFn: (data: any) => apiClient.patch(`/projects/${projectId}/meetings/${meeting.id}/minutes`, data),
    onSuccess: () => { onRefresh(); toast({ title: "Minutes saved" }); },
    onError: (error: Error) => toast({ title: "Could not save minutes", description: error.message, variant: "destructive" }),
  });
  const add = useMutation({
    mutationFn: ({ endpoint, data }: { endpoint: string; data: any }) => apiClient.post(`/projects/${projectId}/meetings/${meeting.id}/${endpoint}`, data),
    onSuccess: () => { onRefresh(); },
    onError: (error: Error) => toast({ title: "Could not save item", description: error.message, variant: "destructive" }),
  });
  const updateAction = useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: any }) => apiClient.patch(`/projects/${projectId}/meetings/${meeting.id}/actions/${actionId}`, data),
    onSuccess: onRefresh,
  });

  const headlineAction = meeting.status === "draft" ? "scheduled" : meeting.status === "scheduled" ? "in_progress" : meeting.status === "in_progress" ? "completed" : null;
  const headlineLabel = headlineAction === "scheduled" ? "Schedule" : headlineAction === "in_progress" ? "Start meeting" : "Complete";
  const visibleActions = detail.actions.filter((action: any) => action.visibility !== "internal");

  return (
    <div className="min-h-0 overflow-y-auto pr-1">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="mb-2 flex flex-wrap items-center gap-2">{statusBadge(meeting.status)}<Badge variant="outline">{detail.type?.name || "Meeting"}</Badge><Badge variant="outline">{meeting.category}</Badge></div><CardTitle className="text-2xl">{meeting.title}</CardTitle><CardDescription className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{prettyDate(meeting.starts_at)} – {new Date(meeting.ends_at).toLocaleTimeString([], { timeStyle: "short" })}</span>{meeting.location && <span>{meeting.location}</span>}</CardDescription></div>
            <div className="flex flex-wrap gap-2">{headlineAction && meeting.status !== "cancelled" && <Button size="sm" onClick={() => onStatus(headlineAction)}>{headlineAction === "completed" && <Check className="mr-1.5 h-4 w-4" />}{headlineLabel}</Button>}{!["completed", "cancelled"].includes(meeting.status) && <Button size="sm" variant="outline" onClick={() => onStatus("cancelled")}><X className="mr-1.5 h-4 w-4" />Cancel</Button>}<Button size="sm" variant="outline" onClick={() => downloadMeetingFile(projectId, meeting.id, "ics")}><Download className="mr-1.5 h-4 w-4" />ICS</Button><Button size="sm" variant="outline" onClick={() => downloadMeetingFile(projectId, meeting.id, "pdf")}><FileText className="mr-1.5 h-4 w-4" />PDF</Button></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          {meeting.description && <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">{meeting.description}</div>}
          <section>
            <SectionHeading icon={<Users className="h-4 w-4" />} title="Attendance" count={detail.attendees.length} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {detail.attendees.map((attendee: any) => (
                <div key={attendee.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <p className="font-medium">{attendee.attendee_type === "client" ? "Client attendee" : "Project attendee"}</p>
                    <p className="text-[11px] text-gray-500">{attendee.required ? "Required" : "Optional"} · {attendee.attendance_status.replace("_", " ")}</p>
                  </div>
                  <Select value={attendee.attendance_status} onValueChange={(value) => apiClient.patch(`/projects/${projectId}/meetings/${meeting.id}/attendees/${attendee.id}`, { attendanceStatus: value }).then(onRefresh)}>
                    <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="no_response">No response</SelectItem><SelectItem value="present">Present</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="declined">Declined</SelectItem></SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>
          <section>
            <SectionHeading icon={<ListChecks className="h-4 w-4" />} title="Agenda" count={detail.agenda.length} />
            <div className="space-y-2">
              {detail.agenda.map((item: any, index: number) => (
                <div key={item.id} className="flex gap-3 rounded-lg border p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">{index + 1}</span>
                  <div><p className="font-medium">{item.title}</p>{item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}{item.expected_duration && <p className="mt-1 text-xs text-gray-400">{item.expected_duration} minutes</p>}</div>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={agendaTitle} onChange={(e) => setAgendaTitle(e.target.value)} placeholder="Add an agenda item..." onKeyDown={(e) => { if (e.key === "Enter" && agendaTitle.trim()) { add.mutate({ endpoint: "agenda", data: { title: agendaTitle } }); setAgendaTitle(""); } }} />
                <Button variant="outline" onClick={() => { if (agendaTitle.trim()) { add.mutate({ endpoint: "agenda", data: { title: agendaTitle } }); setAgendaTitle(""); } }}><Plus className="mr-1.5 h-4 w-4" />Add</Button>
              </div>
            </div>
          </section>
          <section><SectionHeading icon={<MessageSquare className="h-4 w-4" />} title="Discussion & decisions" count={detail.discussions.length + detail.decisions.length} /><div className="grid gap-3 lg:grid-cols-2"><div className="space-y-2">{detail.discussions.map((item: any) => <div key={item.id} className="rounded-lg border p-3"><p className="font-medium">{item.topic}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{item.discussion || "No notes recorded."}</p>{item.decision && <p className="mt-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">Decision: {item.decision}</p>}</div>)}<div className="flex gap-2"><Input value={discussionTopic} onChange={(e) => setDiscussionTopic(e.target.value)} placeholder="Capture a discussion topic..." /><Button variant="outline" onClick={() => { if (discussionTopic.trim()) { add.mutate({ endpoint: "discussions", data: { topic: discussionTopic } }); setDiscussionTopic(""); } }}><Plus className="h-4 w-4" /></Button></div></div><div className="space-y-2">{detail.decisions.map((item: any) => <div key={item.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.status}</Badge></div>{item.description && <p className="mt-1 text-sm text-gray-600">{item.description}</p>}</div>)}<div className="flex gap-2"><Input value={decisionTitle} onChange={(e) => setDecisionTitle(e.target.value)} placeholder="Record a decision..." /><Button variant="outline" onClick={() => { if (decisionTitle.trim()) { add.mutate({ endpoint: "decisions", data: { title: decisionTitle, status: "approved" } }); setDecisionTitle(""); } }}><Plus className="h-4 w-4" /></Button></div></div></div></section>
          <section><SectionHeading icon={<Check className="h-4 w-4" />} title="Action items" count={detail.actions.length} /><div className="space-y-2">{detail.actions.map((action: any) => { const overdue = action.due_date && new Date(action.due_date) < new Date() && !["completed", "cancelled"].includes(action.status); return <div key={action.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="font-medium">{action.title}</p><p className={`mt-1 text-xs ${overdue ? "font-semibold text-red-600" : "text-gray-500"}`}>{action.due_date ? `Due ${new Date(action.due_date).toLocaleDateString()}` : "No due date"} · {action.priority} priority{action.linked_task_id ? " · Task linked" : ""}</p></div><div className="flex items-center gap-2"><Select value={action.status} onValueChange={(value) => updateAction.mutate({ actionId: action.id, data: { status: value } })}><SelectTrigger className="h-8 w-[125px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>{!action.linked_task_id && <Button size="sm" variant="outline" onClick={() => apiClient.post(`/projects/${projectId}/meetings/${meeting.id}/actions/${action.id}/create-task`).then(onRefresh)}><Link2 className="mr-1 h-3.5 w-3.5" />Task</Button>}</div></div>; })}</div><div className="mt-2 flex gap-2"><Input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="Add an action item (project owner required)" /><Button variant="outline" onClick={() => { const owner = options.projectMembers[0]?.id; if (actionTitle.trim() && owner) { add.mutate({ endpoint: "actions", data: { title: actionTitle, responsibleUserIds: [owner] } }); setActionTitle(""); } }}><Plus className="mr-1.5 h-4 w-4" />Add</Button></div></section>
          <section><div className="flex items-center justify-between"><SectionHeading icon={<FileText className="h-4 w-4" />} title="Minutes" count={meeting.minutes_status === "published" ? 1 : 0} /><Button variant="ghost" size="sm" onClick={() => setShowMinutes(!showMinutes)}>{showMinutes ? "Collapse" : "Open"}</Button></div>{showMinutes && <div className="space-y-3 rounded-xl border bg-gray-50/60 p-4 dark:bg-gray-900/30"><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Meeting summary..." className="min-h-[100px] bg-white dark:bg-gray-950" /><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." className="min-h-[80px] bg-white dark:bg-gray-950" /><div className="flex flex-wrap gap-2"><Button onClick={() => save.mutate({ summary, additionalNotes: notes })} disabled={save.isPending}><FileText className="mr-1.5 h-4 w-4" />Save draft</Button><Button variant="outline" onClick={() => apiClient.post(`/projects/${projectId}/meetings/${meeting.id}/publish-minutes`).then(onRefresh)}><Send className="mr-1.5 h-4 w-4" />Publish minutes</Button><Button variant="outline" onClick={() => downloadMeetingFile(projectId, meeting.id, "pdf")}><Download className="mr-1.5 h-4 w-4" />Export PDF</Button></div></div>}</section>
          <section className="border-t pt-4"><div className="flex flex-wrap items-center gap-4 text-xs text-gray-500"><span><Paperclip className="mr-1 inline h-3.5 w-3.5" />Attachments use the project Workspace file system.</span>{meeting.meeting_link && <a className="text-indigo-600 hover:underline" href={meeting.meeting_link} target="_blank" rel="noreferrer"><Link2 className="mr-1 inline h-3.5 w-3.5" />Open meeting link</a>}</div></section>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionHeading({ icon, title, count }: { icon: ReactNode; title: string; count: number }) {
  return <div className="mb-3 flex items-center gap-2"><span className="text-indigo-600 dark:text-indigo-400">{icon}</span><h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">{title}</h3><span className="text-xs text-gray-400">{count}</span></div>;
}