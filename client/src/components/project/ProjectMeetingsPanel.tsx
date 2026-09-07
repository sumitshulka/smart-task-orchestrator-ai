import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Calendar, CalendarDays, Check, ChevronRight, Clock3, Download, FileText, Link2, ListChecks, MapPin,
  MessageSquare, Paperclip, Plus, RefreshCw, Send, UserPlus, Users, Video, X,
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
  const options = optionsQuery.data ?? { meetingTypes: [], projectMembers: [], clientMembers: [], canManage: false };
  const detail = detailQuery.data;
  const upcomingCount = displayedMeetings.filter((meeting) => !["completed", "cancelled"].includes(meeting.status) && new Date(meeting.starts_at) >= new Date()).length;
  const openActionTotal = displayedMeetings.reduce((total, meeting) => total + (meeting.openActionCount || 0), 0);
  const completedCount = displayedMeetings.filter((meeting) => meeting.status === "completed").length;

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
      {selectedId ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Button variant="ghost" className="-ml-3 text-gray-600 dark:text-gray-300" onClick={() => setSelectedId(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back to meetings
              </Button>
              <p className="ml-1 mt-1 text-xs text-gray-500">Meeting description</p>
            </div>
            {detail?.meeting?.title && <p className="max-w-[min(50vw,520px)] truncate text-sm font-medium text-gray-500">{detail.meeting.title}</p>}
          </div>
          {detailQuery.isLoading && <Card className="flex min-h-[420px] flex-1 items-center justify-center"><CardContent className="text-center text-sm text-gray-500">Loading meeting details...</CardContent></Card>}
          {detail && <MeetingWorkspace projectId={projectId} detail={detail} options={options} onRefresh={invalidateMeetings} onStatus={(status) => updateMeeting.mutate({ path: `/projects/${projectId}/meetings/${detail.meeting.id}/status`, data: { status } })} />}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Project collaboration</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-950 dark:text-white">Meetings</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Plan agendas, capture decisions, and keep actions connected to delivery.</p>
            </div>
            <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Schedule meeting</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-indigo-50/80 p-4 dark:bg-indigo-950/25"><div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300"><Calendar className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-wide">Upcoming</p></div><p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{upcomingCount}</p><p className="mt-1 text-xs text-gray-500">Meetings still to come</p></div>
            <div className="rounded-2xl bg-amber-50/80 p-4 dark:bg-amber-950/25"><div className="flex items-center gap-2 text-amber-700 dark:text-amber-300"><ListChecks className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-wide">Open actions</p></div><p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{openActionTotal}</p><p className="mt-1 text-xs text-gray-500">Across this register</p></div>
            <div className="rounded-2xl bg-emerald-50/80 p-4 dark:bg-emerald-950/25"><div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-wide">Completed</p></div><p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{completedCount}</p><p className="mt-1 text-xs text-gray-500">Meetings with captured history</p></div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white/80 shadow-sm dark:bg-gray-950/60">
            <div className="px-5 pb-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-950 dark:text-white">Meeting register</h3>
                  <p className="mt-1 text-sm text-gray-500">{displayedMeetings.length} {displayedMeetings.length === 1 ? "meeting" : "meetings"} in this view</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => meetingsQuery.refetch()} aria-label="Refresh meetings"><RefreshCw className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Input className="min-w-[240px] flex-1" placeholder="Search by title or description..." value={search} onChange={(event) => setSearch(event.target.value)} />
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(STATUS_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {meetingsQuery.isLoading && <p className="p-6 text-sm text-gray-500">Loading meetings...</p>}
              {!meetingsQuery.isLoading && !displayedMeetings.length && <div className="m-6 rounded-xl border border-dashed p-10 text-center"><Calendar className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p className="text-sm font-medium">No meetings yet</p><p className="mt-1 text-xs text-gray-500">Schedule the first project meeting.</p></div>}
              {!!displayedMeetings.length && (
                <div className="min-w-[1040px]">
                  <div className="grid grid-cols-[minmax(220px,2fr)_minmax(170px,1.25fr)_130px_100px_95px_120px_120px_24px] items-center gap-4 border-b bg-gray-50/70 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:bg-gray-900/40">
                    <span>Meeting</span><span>Date & time</span><span>Status</span><span>Audience</span><span>Attendees</span><span>Next due</span><span>Actions</span><span />
                  </div>
                  {displayedMeetings.map((meeting) => (
                    <button key={meeting.id} onClick={() => setSelectedId(meeting.id)} className="group grid w-full grid-cols-[minmax(220px,2fr)_minmax(170px,1.25fr)_130px_100px_95px_120px_120px_24px] items-center gap-4 border-b px-5 py-4 text-left transition last:border-b-0 hover:bg-indigo-50/50 dark:border-gray-800 dark:hover:bg-indigo-950/20">
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{meeting.title}</span><span className="mt-1 block truncate text-xs text-gray-500">{meeting.meetingType?.name || "Meeting"} · {meeting.location || "No location set"}</span></span>
                      <span className="text-xs text-gray-600 dark:text-gray-300"><span className="block font-medium">{new Date(meeting.starts_at).toLocaleDateString([], { dateStyle: "medium" })}</span><span className="mt-1 block text-gray-500">{new Date(meeting.starts_at).toLocaleTimeString([], { timeStyle: "short" })} – {new Date(meeting.ends_at).toLocaleTimeString([], { timeStyle: "short" })}</span></span>
                      <span>{statusBadge(meeting.status)}</span>
                      <span className="text-xs capitalize text-gray-600 dark:text-gray-300">{meeting.category}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300"><Users className="mr-1 inline h-3.5 w-3.5" />{meeting.attendeeCount}</span>
                      <span className={`text-xs ${meeting.nextActionDueDate && new Date(meeting.nextActionDueDate) < new Date() ? "font-semibold text-red-600" : "text-gray-600 dark:text-gray-300"}`}>{meeting.nextActionDueDate ? <><Clock3 className="mr-1 inline h-3.5 w-3.5" />{new Date(meeting.nextActionDueDate).toLocaleDateString()}</> : "—"}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300"><ListChecks className="mr-1 inline h-3.5 w-3.5" />{meeting.openActionCount} open{meeting.overdueActionCount > 0 && <span className="mt-1 block font-medium text-red-600">{meeting.overdueActionCount} overdue</span>}</span>
                      <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

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
  const [actionDueDate, setActionDueDate] = useState("");
  const [actionResponsible, setActionResponsible] = useState("project_team");
  const [actionProjectOwnerId, setActionProjectOwnerId] = useState("");
  const [actionClientOwnerId, setActionClientOwnerId] = useState("");
  const [discussionTopic, setDiscussionTopic] = useState("");
  const [decisionTitle, setDecisionTitle] = useState("");
  const [showMinutes, setShowMinutes] = useState(meeting.minutes_status === "published" || meeting.status === "completed");
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);
  const [attendeeType, setAttendeeType] = useState<"internal" | "client" | "external">("internal");
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [externalName, setExternalName] = useState("");
  const [externalRole, setExternalRole] = useState("");
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
  const addAttendee = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/meetings/${meeting.id}/attendees`, attendeeType === "external"
      ? { attendeeType, externalName, externalRole, required: true }
      : { attendees: selectedAttendeeIds.map((id) => ({ id, attendeeType, required: true })) }),
    onSuccess: () => {
      setSelectedAttendeeIds([]);
      setExternalName("");
      setExternalRole("");
      setShowAttendeePicker(false);
      onRefresh();
      toast({ title: "Attendees attached", description: "These participants can now be linked to meeting discussions and actions." });
    },
    onError: (error: Error) => toast({ title: "Could not attach attendee", description: error.message, variant: "destructive" }),
  });

  const headlineAction = meeting.status === "draft" ? "scheduled" : meeting.status === "scheduled" ? "in_progress" : meeting.status === "in_progress" ? "completed" : null;
  const headlineLabel = headlineAction === "scheduled" ? "Schedule" : headlineAction === "in_progress" ? "Start meeting" : "Complete";
  const visibleActions = detail.actions.filter((action: any) => action.visibility !== "internal");
  const internalMembers = options.projectMembers ?? [];
  const clientMembers = options.clientMembers ?? [];
  const attendeeChoices = attendeeType === "client" ? clientMembers : attendeeType === "internal" ? internalMembers : [];
  const existingAttendeeKeys = new Set(detail.attendees.map((attendee: any) => `${attendee.attendee_type}:${attendee.user_id || attendee.contact_id}`));
  const availableAttendeeChoices = attendeeChoices.filter((person: any) => !existingAttendeeKeys.has(`${attendeeType}:${person.id}`));
  const attendeeName = (attendee: any) => {
    if (attendee.attendee_type === "external") return attendee.external_name || "External participant";
    const members = attendee.attendee_type === "client" ? clientMembers : internalMembers;
    const participant = members.find((person: any) => person.id === (attendee.user_id || attendee.contact_id));
    return participant?.name || (attendee.attendee_type === "client" ? "Client attendee" : "Project attendee");
  };
  const attendeeRole = (attendee: any) => {
    if (attendee.attendee_type === "external") return attendee.external_role || "External participant";
    const members = attendee.attendee_type === "client" ? clientMembers : internalMembers;
    const participant = members.find((person: any) => person.id === (attendee.user_id || attendee.contact_id));
    return participant?.role || (attendee.attendee_type === "client" ? "Client contact" : "Project member");
  };
  const actionOwnerNames = (ids: unknown, members: any[]) => {
    if (!Array.isArray(ids)) return [];
    return ids.map((id) => members.find((person) => person.id === id)?.name).filter(Boolean);
  };
  const actionResponsibility = (action: any) => {
    if (action.responsibility_level === "client") return "Client";
    if (action.responsibility_level === "both") return "Project Team + Client";
    return "Project Team";
  };
  const addActionItem = () => {
    const responsibleUserIds = actionResponsible !== "client" && actionProjectOwnerId ? [actionProjectOwnerId] : [];
    const responsibleContactIds = actionResponsible !== "project_team" && actionClientOwnerId ? [actionClientOwnerId] : [];
    const ownersComplete = actionResponsible === "project_team" ? responsibleUserIds.length > 0 : actionResponsible === "client" ? responsibleContactIds.length > 0 : responsibleUserIds.length > 0 && responsibleContactIds.length > 0;
    if (!actionTitle.trim() || !ownersComplete) return;
    add.mutate({ endpoint: "actions", data: { title: actionTitle.trim(), responsibilityLevel: actionResponsible, responsibleUserIds, responsibleContactIds, dueDate: actionDueDate || null } });
    setActionTitle("");
    setActionDueDate("");
    setActionProjectOwnerId("");
    setActionClientOwnerId("");
  };
  const ownerSelect = (kind: "project" | "client", value: string, onChange: (value: string) => void) => {
    const members = kind === "project" ? internalMembers : clientMembers;
    return <Select value={value} onValueChange={onChange}><SelectTrigger className="h-9 min-w-[150px] bg-white text-xs dark:bg-gray-950"><SelectValue placeholder={kind === "project" ? "Choose project owner" : "Choose client owner"} /></SelectTrigger><SelectContent>{members.map((person: any) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select>;
  };
  const toggleAttendee = (id: string) => {
    setSelectedAttendeeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <Card className="w-full border-0 shadow-none">
        <CardHeader className="relative overflow-hidden border-b bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-5 dark:from-indigo-950/40 dark:via-gray-950 dark:to-cyan-950/30 sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-500/10" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">{statusBadge(meeting.status)}<Badge variant="outline">{detail.type?.name || "Meeting"}</Badge><Badge variant="outline" className="capitalize">{meeting.category}</Badge></div>
                <CardTitle className="text-3xl tracking-tight text-gray-950 dark:text-white">{meeting.title}</CardTitle>
                <CardDescription className="mt-2 max-w-2xl text-sm">A shared record for the agenda, conversation, decisions, and follow-through from this meeting.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">{headlineAction && meeting.status !== "cancelled" && <Button size="sm" onClick={() => onStatus(headlineAction)}>{headlineAction === "completed" && <Check className="mr-1.5 h-4 w-4" />}{headlineLabel}</Button>}{!["completed", "cancelled"].includes(meeting.status) && <Button size="sm" variant="outline" onClick={() => onStatus("cancelled")}><X className="mr-1.5 h-4 w-4" />Cancel</Button>}<Button size="sm" variant="outline" onClick={() => downloadMeetingFile(projectId, meeting.id, "ics")}><Download className="mr-1.5 h-4 w-4" />ICS</Button><Button size="sm" variant="outline" onClick={() => downloadMeetingFile(projectId, meeting.id, "pdf")}><FileText className="mr-1.5 h-4 w-4" />PDF</Button></div>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MeetingMeta icon={<CalendarDays className="h-4 w-4" />} label="When"><span>{prettyDate(meeting.starts_at)}</span><span className="text-xs text-gray-500">Ends {new Date(meeting.ends_at).toLocaleTimeString([], { timeStyle: "short" })}</span></MeetingMeta>
              <MeetingMeta icon={<MapPin className="h-4 w-4" />} label="Location"><span>{meeting.location || "Location not set"}</span>{meeting.timezone && <span className="text-xs text-gray-500">{meeting.timezone}</span>}</MeetingMeta>
              <MeetingMeta icon={<Video className="h-4 w-4" />} label="Meeting link">{meeting.meeting_link ? <a className="truncate text-indigo-700 hover:underline dark:text-indigo-300" href={meeting.meeting_link} target="_blank" rel="noreferrer">Open video link</a> : <span>No link attached</span>}</MeetingMeta>
              <MeetingMeta icon={<Users className="h-4 w-4" />} label="Attendance"><span>{detail.attendees.length} {detail.attendees.length === 1 ? "participant" : "participants"}</span><span className="text-xs text-gray-500">{detail.actions.filter((action: any) => !["completed", "cancelled"].includes(action.status)).length} open actions</span></MeetingMeta>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 bg-white p-4 dark:bg-gray-950 sm:p-6">
          {meeting.description && <div className="mb-1 border-l-4 border-indigo-400 bg-indigo-50/60 px-5 py-4 dark:bg-indigo-950/20"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">Purpose & context</p><p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">{meeting.description}</p></div>}
          <section className="border-b border-gray-200/80 py-6 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading icon={<Users className="h-4 w-4" />} title="Attendance" count={detail.attendees.length} description="Track who participated and how they attended." />
              {options.canManage && <Button size="sm" variant="outline" onClick={() => setShowAttendeePicker((current) => !current)}>
                <UserPlus className="mr-1.5 h-4 w-4" />{showAttendeePicker ? "Close" : "Attach attendee"}
              </Button>}
            </div>
            {showAttendeePicker && options.canManage && (
              <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="mb-3">
                  <p className="text-sm font-semibold">Attach someone after scheduling</p>
                  <p className="mt-1 text-xs text-gray-500">Use this when the meeting happened outside Tazq but its minutes, discussions, and actions are being recorded here.</p>
                </div>
                <div className="space-y-3">
                  <div className="max-w-[220px]">
                    <Select value={attendeeType} onValueChange={(value: "internal" | "client" | "external") => { setAttendeeType(value); setSelectedAttendeeIds([]); setExternalName(""); setExternalRole(""); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal members</SelectItem>
                        {meeting.category !== "internal" && <SelectItem value="client">Client members</SelectItem>}
                        <SelectItem value="external">External participant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {attendeeType !== "external" ? (
                    <div className="rounded-lg bg-white/70 p-2 dark:bg-gray-950/50">
                      <p className="mb-2 text-xs text-gray-500">Select one or more participants.</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {availableAttendeeChoices.map((person: any) => {
                          const selected = selectedAttendeeIds.includes(person.id);
                            return <button type="button" key={person.id} onClick={() => toggleAttendee(person.id)} className={`flex items-center gap-2 rounded-lg p-2 text-left text-sm transition ${selected ? "bg-indigo-100 dark:bg-indigo-950/50" : "bg-gray-50/80 hover:bg-gray-100 dark:bg-gray-900/60 dark:hover:bg-gray-900"}`}>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300"}`}>{selected && <Check className="h-3 w-3" />}</span>
                            <span className="min-w-0 flex-1 truncate">{person.name}</span><span className="text-[10px] text-gray-400">{person.role || (attendeeType === "client" ? "Client contact" : "Project member")}</span>
                          </button>;
                        })}
                      </div>
                      {!availableAttendeeChoices.length && <p className="py-2 text-xs text-gray-500">All eligible {attendeeType === "client" ? "client members" : "internal members"} are already attached.</p>}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={externalName} onChange={(event) => setExternalName(event.target.value)} placeholder="Participant name" />
                      <Input value={externalRole} onChange={(event) => setExternalRole(event.target.value)} placeholder="Role, e.g. Client architect" />
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={() => addAttendee.mutate()} disabled={addAttendee.isPending || (attendeeType === "external" ? !externalName.trim() || !externalRole.trim() : !selectedAttendeeIds.length)}>
                      {addAttendee.isPending ? "Attaching..." : attendeeType === "external" ? "Attach participant" : `Attach ${selectedAttendeeIds.length || ""} ${selectedAttendeeIds.length === 1 ? "member" : "members"}`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {!detail.attendees.length && <div className="mb-3 rounded-xl border border-dashed p-4 text-sm text-gray-500">No attendees were added when this meeting was scheduled. You can attach the people who participated now.</div>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {detail.attendees.map((attendee: any) => (
                <div key={attendee.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <p className="font-medium">{attendeeName(attendee)}</p>
                    <p className="text-[11px] text-gray-500">{attendeeRole(attendee)} · {attendee.required ? "Required" : "Optional"} · {attendee.attendance_status.replace("_", " ")}</p>
                  </div>
                  <Select value={attendee.attendance_status} onValueChange={(value) => apiClient.patch(`/projects/${projectId}/meetings/${meeting.id}/attendees/${attendee.id}`, { attendanceStatus: value }).then(onRefresh)}>
                    <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="no_response">No response</SelectItem><SelectItem value="present">Present</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="declined">Declined</SelectItem></SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>
          <section className="border-b border-gray-200/80 py-6 dark:border-gray-800">
            <SectionHeading icon={<ListChecks className="h-4 w-4" />} title="Agenda" count={detail.agenda.length} description="Topics planned for the session." />
            <div className="space-y-2">
              {detail.agenda.map((item: any, index: number) => (
                <div key={item.id} className="flex gap-3 rounded-lg bg-gray-50/70 p-3 dark:bg-gray-900/50">
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
          <section className="border-b border-gray-200/80 py-6 dark:border-gray-800"><SectionHeading icon={<MessageSquare className="h-4 w-4" />} title="Discussion & decisions" count={detail.discussions.length + detail.decisions.length} description="Capture what was discussed and what was agreed." /><div className="grid gap-5 lg:grid-cols-2"><div className="space-y-2">{detail.discussions.map((item: any) => <div key={item.id} className="border-l-2 border-indigo-200 bg-indigo-50/30 px-4 py-3 dark:border-indigo-900/70 dark:bg-indigo-950/15"><p className="font-medium">{item.topic}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{item.discussion || "No notes recorded."}</p>{item.decision && <p className="mt-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">Decision: {item.decision}</p>}</div>)}<div className="flex gap-2"><Input value={discussionTopic} onChange={(e) => setDiscussionTopic(e.target.value)} placeholder="Capture a discussion topic..." /><Button variant="outline" onClick={() => { if (discussionTopic.trim()) { add.mutate({ endpoint: "discussions", data: { topic: discussionTopic } }); setDiscussionTopic(""); } }}><Plus className="h-4 w-4" /></Button></div></div><div className="space-y-2">{detail.decisions.map((item: any) => <div key={item.id} className="bg-gray-50/80 px-4 py-3 dark:bg-gray-900/50"><div className="flex items-start justify-between gap-2"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.status}</Badge></div>{item.description && <p className="mt-1 text-sm text-gray-600">{item.description}</p>}</div>)}<div className="flex gap-2"><Input value={decisionTitle} onChange={(e) => setDecisionTitle(e.target.value)} placeholder="Record a decision..." /><Button variant="outline" onClick={() => { if (decisionTitle.trim()) { add.mutate({ endpoint: "decisions", data: { title: decisionTitle, status: "approved" } }); setDecisionTitle(""); } }}><Plus className="h-4 w-4" /></Button></div></div></div></section>
          <section className="border-b border-gray-200/80 py-6 dark:border-gray-800">
            <SectionHeading icon={<Check className="h-4 w-4" />} title="Action items" count={detail.actions.length} description="Turn meeting outcomes into clear ownership and follow-through." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="border-b border-gray-200/80 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:border-gray-800">
                  <tr><th className="pb-3 pr-5">Action</th><th className="pb-3 pr-5">Responsible</th><th className="pb-3 pr-5">Task owners</th><th className="pb-3 pr-5">Due date</th><th className="pb-3 text-right">Progress</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                  {detail.actions.map((action: any) => {
                    const overdue = action.due_date && new Date(action.due_date) < new Date() && !["completed", "cancelled"].includes(action.status);
                    const owners = [...actionOwnerNames(action.responsible_user_ids, internalMembers), ...actionOwnerNames(action.responsible_contact_ids, clientMembers)];
                    return <tr key={action.id} className={overdue ? "bg-red-50/50 dark:bg-red-950/15" : ""}>
                      <td className="py-3 pr-5 align-top"><p className="font-medium text-gray-900 dark:text-gray-100">{action.title}</p><p className="mt-1 text-xs text-gray-500">{action.priority} priority{action.linked_task_id ? " · Task linked" : ""}</p></td>
                      <td className="py-3 pr-5 align-top"><Badge variant="outline" className="whitespace-nowrap">{actionResponsibility(action)}</Badge></td>
                      <td className="py-3 pr-5 align-top"><div className="flex max-w-[240px] flex-wrap gap-1.5">{owners.length ? owners.map((owner: string) => <span key={owner} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{owner}</span>) : <span className="text-xs text-gray-500">Unassigned</span>}</div></td>
                      <td className={`py-3 pr-5 align-top text-sm ${overdue ? "font-semibold text-red-600" : "text-gray-600 dark:text-gray-300"}`}>{action.due_date ? new Date(action.due_date).toLocaleDateString([], { dateStyle: "medium" }) : "Not set"}{overdue && <span className="mt-1 block text-[11px]">Overdue</span>}</td>
                      <td className="py-3 align-top"><div className="flex items-center justify-end gap-2"><Select value={action.status} onValueChange={(value) => updateAction.mutate({ actionId: action.id, data: { status: value } })}><SelectTrigger className="h-8 w-[125px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>{!action.linked_task_id && <Button size="sm" variant="ghost" onClick={() => apiClient.post(`/projects/${projectId}/meetings/${meeting.id}/actions/${action.id}/create-task`).then(onRefresh)} aria-label={`Create task for ${action.title}`}><Link2 className="h-3.5 w-3.5" /></Button>}</div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
                <tr className="bg-indigo-50/45 dark:bg-indigo-950/15">
                  <td className="py-3 pr-5 align-top"><Input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="New action..." onKeyDown={(event) => { if (event.key === "Enter") addActionItem(); }} aria-label="Action" /></td>
                  <td className="py-3 pr-5 align-top"><Select value={actionResponsible} onValueChange={(value) => { setActionResponsible(value); setActionProjectOwnerId(""); setActionClientOwnerId(""); }}><SelectTrigger className="h-9 min-w-[150px] bg-white text-xs dark:bg-gray-950"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project_team">Project Team</SelectItem><SelectItem value="client">Client</SelectItem><SelectItem value="both">Project Team + Client</SelectItem></SelectContent></Select></td>
                  <td className="py-3 pr-5 align-top">{actionResponsible === "both" ? <div className="space-y-1.5"><div><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">Project</span>{ownerSelect("project", actionProjectOwnerId, setActionProjectOwnerId)}</div><div><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">Client</span>{ownerSelect("client", actionClientOwnerId, setActionClientOwnerId)}</div></div> : ownerSelect(actionResponsible === "client" ? "client" : "project", actionResponsible === "client" ? actionClientOwnerId : actionProjectOwnerId, actionResponsible === "client" ? setActionClientOwnerId : setActionProjectOwnerId)}</td>
                  <td className="py-3 pr-5 align-top"><Input type="date" value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} aria-label="Action due date" title="Optional action due date" className="h-9 min-w-[145px] bg-white text-xs dark:bg-gray-950" /></td>
                  <td className="py-3 align-top text-right"><Button variant="outline" onClick={addActionItem} disabled={!actionTitle.trim()}><Plus className="mr-1.5 h-4 w-4" />Add</Button></td>
                </tr>
          </section>
          <MinutesSection
            showMinutes={showMinutes}
            setShowMinutes={setShowMinutes}
            summary={summary}
            notes={notes}
            setSummary={setSummary}
            setNotes={setNotes}
            meeting={meeting}
            save={save}
            projectId={projectId}
            onRefresh={onRefresh}
            downloadPdf={() => downloadMeetingFile(projectId, meeting.id, "pdf")}
          />
          <section className="py-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Resources & links</p><p className="mt-1 text-xs text-gray-500">Files and meeting access points connected to this record.</p></div><div className="flex flex-wrap items-center gap-4 text-xs text-gray-500"><span><Paperclip className="mr-1 inline h-3.5 w-3.5" />Workspace attachments</span>{meeting.meeting_link && <a className="text-indigo-600 hover:underline" href={meeting.meeting_link} target="_blank" rel="noreferrer"><Link2 className="mr-1 inline h-3.5 w-3.5" />Open meeting link</a>}</div></div></section>
        </CardContent>
      </Card>
    </div>
  );
}

function MeetingMeta({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-xl bg-white/60 p-3 shadow-sm dark:bg-gray-900/50"><span className="mt-0.5 rounded-lg bg-indigo-100 p-2 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{icon}</span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p><div className="mt-1 flex min-w-0 flex-col truncate text-sm font-medium text-gray-800 dark:text-gray-200">{children}</div></div></div>;
}

function SectionHeading({ icon, title, count, description }: { icon: ReactNode; title: string; count: number; description?: string }) {
  return <div className="mb-4 flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="mt-1 text-indigo-600 dark:text-indigo-300">{icon}</span><div><h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>{description && <p className="mt-1 text-xs text-gray-500">{description}</p>}</div></div><span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{count}</span></div>;
}

function MinutesSection({
  showMinutes,
  setShowMinutes,
  summary,
  notes,
  setSummary,
  setNotes,
  meeting,
  save,
  projectId,
  onRefresh,
  downloadPdf,
}: {
  showMinutes: boolean;
  setShowMinutes: (value: boolean) => void;
  summary: string;
  notes: string;
  setSummary: (value: string) => void;
  setNotes: (value: string) => void;
  meeting: any;
  save: any;
  projectId: string;
  onRefresh: () => void;
  downloadPdf: () => void;
}) {
  const isPublished = meeting.minutes_status === "published";
  const hasContent = Boolean(summary.trim() || notes.trim());

  return (
    <section className="border-b border-indigo-200/80 bg-indigo-50/55 py-6 dark:border-indigo-900/60 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 rounded-lg bg-indigo-600 p-2 text-white shadow-sm"><FileText className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Meeting record</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-gray-950 dark:text-white">Minutes summary</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">Shape the final record of what happened, what was agreed, and what needs to happen next.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={isPublished ? "border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "border-0 bg-white/80 text-indigo-700 dark:bg-gray-900/70 dark:text-indigo-300"}>{isPublished ? "Published" : hasContent ? "Draft saved" : "Not started"}</Badge>
          <Button variant="outline" size="sm" onClick={() => setShowMinutes(!showMinutes)}>{showMinutes ? "Close editor" : "Open editor"}</Button>
        </div>
      </div>
      {!showMinutes && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 bg-white/70 px-4 py-3 dark:bg-gray-950/40">
          <p className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">{summary || "No summary has been added yet. Open the editor to capture the meeting record."}</p>
          {notes && <span className="text-xs font-medium text-gray-500">Additional notes saved</span>}
        </div>
      )}
      {showMinutes && (
        <div className="mt-5 space-y-4 bg-white/75 p-4 dark:bg-gray-950/45">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5"><Label>Summary</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What happened in this meeting?" className="min-h-[130px] bg-white dark:bg-gray-950" /></div>
            <div className="space-y-1.5"><Label>Additional notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Supporting notes, context, or follow-up details..." className="min-h-[130px] bg-white dark:bg-gray-950" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate({ summary, additionalNotes: notes })} disabled={save.isPending}><FileText className="mr-1.5 h-4 w-4" />Save draft</Button>
            <Button variant="outline" onClick={() => apiClient.post(`/projects/${projectId}/meetings/${meeting.id}/publish-minutes`).then(onRefresh)}><Send className="mr-1.5 h-4 w-4" />Publish minutes</Button>
            <Button variant="ghost" onClick={downloadPdf}><Download className="mr-1.5 h-4 w-4" />Export PDF</Button>
          </div>
        </div>
      )}
    </section>
  );
}