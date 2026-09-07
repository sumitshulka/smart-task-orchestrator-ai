import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Shield, FolderKanban, Milestone, Bug, ListTodo,
  Clock, DollarSign, Users, Plus, CheckCircle, AlertTriangle, CalendarDays,
  Circle, PauseCircle, XCircle, LogOut,
} from "lucide-react";

const MILESTONE_STATUS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  not_started: { label: "Not Started", icon: Circle,       color: "text-gray-400" },
  in_progress: { label: "In Progress", icon: Clock,        color: "text-blue-500" },
  on_hold:     { label: "On Hold",     icon: PauseCircle,  color: "text-amber-500" },
  completed:   { label: "Completed",   icon: CheckCircle,  color: "text-green-500" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-800 border-orange-200",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  low:      "bg-blue-100 text-blue-800 border-blue-200",
};

const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "Critical", color: "text-red-600" },
  2: { label: "High",     color: "text-orange-500" },
  3: { label: "Medium",   color: "text-yellow-500" },
  4: { label: "Low",      color: "text-blue-400" },
  5: { label: "Minimal",  color: "text-gray-400" },
};

export default function PortalProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [me, setMe] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [projectSettings, setProjectSettings] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [meetingDetailLoading, setMeetingDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [defectDialog, setDefectDialog] = useState(false);
  const [defectForm, setDefectForm] = useState({ title: "", description: "", severity: "medium", type: "bug", environment: "production" });
  const [submittingDefect, setSubmittingDefect] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/portal/me", { credentials: "include" });
        if (!meRes.ok) { navigate("/portal/login"); return; }
        const meData = await meRes.json();
        setMe(meData);

        const projRes = await fetch(`/api/portal/projects/${id}`, { credentials: "include" });
        if (!projRes.ok) { navigate("/portal/dashboard"); return; }
        const { project: proj, access: acc, settings } = await projRes.json();
        setProject(proj);
        setAccess(acc);
        setProjectSettings(settings);
        const canViewDefects = acc.can_view_defects && settings?.quality?.defectManagement !== false;
        const canViewMeetings = settings?.meetings?.enabled !== false;

        const [msRes, defRes, taskRes, meetingRes] = await Promise.all([
          fetch(`/api/portal/projects/${id}/milestones`, { credentials: "include" }),
          canViewDefects ? fetch(`/api/portal/projects/${id}/defects`, { credentials: "include" }) : Promise.resolve(null),
          acc.can_view_tasks ? fetch(`/api/portal/projects/${id}/tasks`, { credentials: "include" }) : Promise.resolve(null),
          canViewMeetings ? fetch(`/api/portal/projects/${id}/meetings`, { credentials: "include" }) : Promise.resolve(null),
        ]);
        if (msRes.ok) setMilestones(await msRes.json());
        if (defRes?.ok) setDefects(await defRes.json());
        if (taskRes?.ok) setTasks(await taskRes.json());
        if (meetingRes?.ok) setMeetings(await meetingRes.json());
      } catch {
        navigate("/portal/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const handleLogout = async () => {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
    navigate("/portal/login");
  };

  const submitDefect = async () => {
    if (!defectForm.title.trim()) { toast({ title: "Title is required.", variant: "destructive" }); return; }
    setSubmittingDefect(true);
    try {
      const res = await fetch(`/api/portal/projects/${id}/defects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(defectForm),
      });
      if (!res.ok) throw new Error("Failed");
      const newDefect = await res.json();
      setDefects(prev => [newDefect, ...prev]);
      toast({ title: "Defect submitted", description: "Your defect has been reported successfully." });
      setDefectDialog(false);
      setDefectForm({ title: "", description: "", severity: "medium", type: "bug", environment: "production" });
    } catch {
      toast({ title: "Error", description: "Failed to submit defect.", variant: "destructive" });
    } finally {
      setSubmittingDefect(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Shield className="h-8 w-8 text-blue-500 animate-pulse" />
      </div>
    );
  }

  if (!project) return null;

  const canViewDefects = access?.can_view_defects && projectSettings?.quality?.defectManagement !== false;
  const canCreateDefects = canViewDefects &&
    access?.can_create_defects &&
    projectSettings?.quality?.allowClientDefectCreation === true &&
    projectSettings?.collaboration?.clientDefectCreation === true;
  const canViewMeetings = projectSettings?.meetings?.enabled !== false;
  const tabCount = 2 + (canViewDefects ? 1 : 0) + (access?.can_view_tasks ? 1 : 0) + (canViewMeetings ? 1 : 0);

  const openMeeting = async (meetingId: string) => {
    setMeetingDetailLoading(true);
    try {
      const response = await fetch(`/api/portal/projects/${id}/meetings/${meetingId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load meeting");
      setSelectedMeeting(await response.json());
    } catch {
      toast({ title: "Unable to load meeting", description: "Please try again.", variant: "destructive" });
    } finally {
      setMeetingDetailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Bar */}
      <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm text-gray-900 dark:text-white">Client Portal</span>
          </div>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/portal/dashboard")}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Dashboard
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {me?.contact && (
              <span className="text-xs text-gray-500 hidden sm:block">{me.contact.name}</span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 gap-1.5 text-gray-500 hover:text-red-600">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Project header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
              {project.client_name && <p className="text-sm text-gray-500">{project.client_name}</p>}
            </div>
          </div>
          <Badge className="capitalize bg-blue-50 text-blue-700 border-blue-200 text-xs">
            {(project.status || "").replace("_", " ")}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">
              <Milestone className="h-3.5 w-3.5 mr-1" /> Milestones ({milestones.length})
            </TabsTrigger>
            {canViewMeetings && (
              <TabsTrigger value="meetings">
                <CalendarDays className="h-3.5 w-3.5 mr-1" /> Meetings ({meetings.length})
              </TabsTrigger>
            )}
            {canViewDefects && (
              <TabsTrigger value="defects">
                <Bug className="h-3.5 w-3.5 mr-1" /> Defects ({defects.length})
              </TabsTrigger>
            )}
            {access?.can_view_tasks && (
              <TabsTrigger value="tasks">
                <ListTodo className="h-3.5 w-3.5 mr-1" /> Tasks ({tasks.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { label: "Type",     value: (project.project_type || "").replace("_", " ") },
                    { label: "Start",    value: project.start_date ? format(new Date(project.start_date), "MMM d, yyyy") : null },
                    { label: "End",      value: project.projected_end_date ? format(new Date(project.projected_end_date), "MMM d, yyyy") : null },
                    { label: "Budget",   value: project.budget_amount ? `${project.currency || ""} ${project.budget_amount}` : null },
                    { label: "Effort",   value: project.total_effort_hours ? `${project.total_effort_hours}h` : null },
                  ].filter(r => r.value).map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500 capitalize">{label}</span>
                      <span className="font-medium capitalize">{value}</span>
                    </div>
                  ))}
                  {project.description && (
                    <div className="pt-2 border-t dark:border-gray-700">
                      <p className="text-gray-500 text-xs mb-1">Description</p>
                      <p className="text-sm">{project.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick stats */}
              <div className="space-y-3">
                {[
                  { label: "Milestones", value: milestones.length, icon: Milestone, color: "text-purple-600", bg: "bg-purple-50" },
                  ...(canViewDefects ? [{ label: "Defects", value: defects.length, icon: Bug, color: "text-orange-600", bg: "bg-orange-50" }] : []),
                  ...(access?.can_view_tasks ? [{ label: "Tasks", value: tasks.length, icon: ListTodo, color: "text-blue-600", bg: "bg-blue-50" }] : []),
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <Card key={label}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Milestones ── */}
          <TabsContent value="milestones" className="mt-4 space-y-3">
            {milestones.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Milestone className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No milestones defined yet.</p>
              </div>
            ) : milestones.map((ms: any) => {
              const st = MILESTONE_STATUS[ms.status] || MILESTONE_STATUS.not_started;
              const Icon = st.icon;
              return (
                <Card key={ms.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${st.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{ms.name}</p>
                        <span className={`text-xs capitalize ${st.color}`}>{st.label}</span>
                      </div>
                      {ms.description && <p className="text-xs text-gray-500 mt-0.5">{ms.description}</p>}
                      {(ms.start_date || ms.end_date) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {ms.start_date && format(new Date(ms.start_date), "MMM d")}
                          {ms.start_date && ms.end_date && " → "}
                          {ms.end_date && format(new Date(ms.end_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    {access?.can_approve_milestones && ms.status === "completed" && (
                      <Badge className="bg-green-50 text-green-700 border-green-200 text-xs shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" /> Ready for Approval
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ── Meetings ── */}
          {canViewMeetings && (
            <TabsContent value="meetings" className="mt-4 space-y-3">
              {selectedMeeting ? (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" className="px-0" onClick={() => setSelectedMeeting(null)}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" /> All meetings
                  </Button>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{selectedMeeting.meeting.title}</CardTitle>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(selectedMeeting.meeting.starts_at), "MMM d, yyyy · h:mm a")}
                            {" · "}
                            {selectedMeeting.meeting.category === "mixed" ? "Mixed meeting" : "Client meeting"}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize text-[10px]">{selectedMeeting.meeting.status.replace("_", " ")}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(selectedMeeting.meeting.location || selectedMeeting.meeting.meeting_link) && (
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Joining details</p>
                          {selectedMeeting.meeting.location && <p>{selectedMeeting.meeting.location}</p>}
                          {selectedMeeting.meeting.meeting_link && <a className="text-blue-600 hover:underline break-all" href={selectedMeeting.meeting.meeting_link} target="_blank" rel="noreferrer">{selectedMeeting.meeting.meeting_link}</a>}
                        </div>
                      )}
                      {selectedMeeting.meeting.description && <p className="text-sm text-gray-600 dark:text-gray-300">{selectedMeeting.meeting.description}</p>}
                      {selectedMeeting.agenda?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Agenda</p>
                          <div className="space-y-2">{selectedMeeting.agenda.map((item: any, index: number) => <div key={item.id} className="flex gap-2 text-sm"><span className="text-gray-400">{index + 1}.</span><span>{item.title}</span></div>)}</div>
                        </div>
                      )}
                      {selectedMeeting.meeting.minutes_summary && (
                        <div className="border-t dark:border-gray-700 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Minutes</p>
                          <p className="text-sm whitespace-pre-wrap">{selectedMeeting.meeting.minutes_summary}</p>
                        </div>
                      )}
                      {selectedMeeting.discussions?.length > 0 && (
                        <div className="border-t dark:border-gray-700 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Discussion</p>
                          <div className="space-y-3">{selectedMeeting.discussions.map((item: any) => <div key={item.id}><p className="text-sm font-medium">{item.topic}</p>{item.discussion && <p className="text-sm text-gray-500 mt-0.5">{item.discussion}</p>}</div>)}</div>
                        </div>
                      )}
                      {selectedMeeting.decisions?.length > 0 && (
                        <div className="border-t dark:border-gray-700 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Decisions</p>
                          <div className="space-y-2">{selectedMeeting.decisions.map((item: any) => <div key={item.id} className="text-sm"><span className="font-medium">{item.title}</span>{item.description && <span className="text-gray-500"> — {item.description}</span>}</div>)}</div>
                        </div>
                      )}
                      {selectedMeeting.actions?.length > 0 && (
                        <div className="border-t dark:border-gray-700 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Action items</p>
                          <div className="space-y-2">{selectedMeeting.actions.map((item: any) => <div key={item.id} className="flex items-start justify-between gap-3 text-sm"><span>{item.title}</span><Badge variant="outline" className="text-[10px] capitalize shrink-0">{item.status.replace("_", " ")}{item.due_date ? ` · ${format(new Date(item.due_date), "MMM d")}` : ""}</Badge></div>)}</div>
                        </div>
                      )}
                      {selectedMeeting.meeting.additional_notes && <p className="text-sm text-gray-500 whitespace-pre-wrap border-t dark:border-gray-700 pt-4">{selectedMeeting.meeting.additional_notes}</p>}
                    </CardContent>
                  </Card>
                </div>
              ) : meetings.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No client meetings have been shared yet.</p>
                </div>
              ) : (
                meetings.map((meeting: any) => (
                  <Card key={meeting.id} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => openMeeting(meeting.id)}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0"><CalendarDays className="h-4 w-4 text-blue-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap"><p className="font-medium text-sm">{meeting.title}</p><Badge variant="outline" className="text-[10px] capitalize">{meeting.status.replace("_", " ")}</Badge>{meeting.minutes_status === "published" && <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200">Minutes available</Badge>}</div>
                        <p className="text-xs text-gray-500 mt-1">{format(new Date(meeting.starts_at), "EEE, MMM d, yyyy · h:mm a")} · {meeting.category === "mixed" ? "Mixed" : "Client"} meeting</p>
                        {meeting.location && <p className="text-xs text-gray-400 mt-1">{meeting.location}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              {meetingDetailLoading && <p className="text-center text-xs text-gray-400">Loading meeting details…</p>}
            </TabsContent>
          )}

          {/* ── Defects ── */}
          {canViewDefects && (
            <TabsContent value="defects" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{defects.length} defect{defects.length !== 1 ? "s" : ""} reported</p>
                {canCreateDefects && (
                  <Button size="sm" onClick={() => setDefectDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Report Defect
                  </Button>
                )}
              </div>
              {defects.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bug className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No defects reported.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {defects.map((d: any) => (
                    <Card key={d.id}>
                      <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${d.severity === "critical" || d.severity === "high" ? "text-red-500" : "text-yellow-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{d.title}</p>
                            <Badge className={`text-[10px] border capitalize ${SEVERITY_COLORS[d.severity] || ""}`}>{d.severity}</Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">{(d.status || "").replace("_", " ")}</Badge>
                          </div>
                          {d.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.description}</p>}
                          <p className="text-[10px] text-gray-400 mt-1">
                            {d.created_at ? format(new Date(d.created_at), "MMM d, yyyy") : ""}
                            {d.reported_by ? ` · Reported by ${d.reported_by}` : ""}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* ── Tasks ── */}
          {access?.can_view_tasks && (
            <TabsContent value="tasks" className="mt-4 space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No tasks linked to this project.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t: any) => {
                    const pri = PRIORITY_MAP[t.priority as number] || { label: "—", color: "text-gray-400" };
                    return (
                      <Card key={t.id}>
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {t.task_number && <span className="font-mono text-[10px] text-gray-400">#{t.task_number}</span>}
                              <p className="font-medium text-sm">{t.title}</p>
                              {t.status && <Badge variant="outline" className="text-[10px] capitalize">{(t.status || "").replace("_", " ")}</Badge>}
                              <span className={`text-xs font-medium ${pri.color}`}>{pri.label}</span>
                            </div>
                            {t.due_date && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                Due {format(new Date(t.due_date), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Report Defect Dialog */}
      <Dialog open={defectDialog} onOpenChange={setDefectDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bug className="h-4 w-4 text-orange-500" /> Report a Defect</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Section 1 */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 flex items-center gap-2 border-b dark:border-gray-700">
                <span className="h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                <h3 className="text-sm font-semibold">Defect Details</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Title *</Label>
                  <Input className="h-10" placeholder="Brief description of the issue" value={defectForm.title}
                    onChange={(e) => setDefectForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Description</Label>
                  <Textarea rows={4} placeholder="Steps to reproduce, expected vs actual behavior…"
                    value={defectForm.description} onChange={(e) => setDefectForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
            </div>
            {/* Section 2 */}
            <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 overflow-hidden">
              <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 flex items-center gap-2 border-b border-orange-200 dark:border-orange-800/50">
                <span className="h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">Classification</h3>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Severity</Label>
                  <Select value={defectForm.severity} onValueChange={(v) => setDefectForm(p => ({ ...p, severity: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["critical", "high", "medium", "low"].map(s => <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Type</Label>
                  <Select value={defectForm.type} onValueChange={(v) => setDefectForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["bug", "regression", "performance", "ui", "security", "data"].map(t => <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Environment</Label>
                  <Select value={defectForm.environment} onValueChange={(v) => setDefectForm(p => ({ ...p, environment: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["production", "staging", "qa", "development"].map(e => <SelectItem key={e} value={e} className="capitalize">{e.charAt(0).toUpperCase() + e.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDefectDialog(false)}>Cancel</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={submitDefect} disabled={submittingDefect}>
              {submittingDefect ? "Submitting…" : "Submit Defect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
