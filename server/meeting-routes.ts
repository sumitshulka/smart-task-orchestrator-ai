import type { Express } from "express";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  clientContacts,
  meetingActionItems,
  meetingActivity,
  meetingAgendaItems,
  meetingAttendees,
  meetingCalendarIntegrations,
  meetingDecisions,
  meetingDiscussions,
  meetingTypes,
  meetings,
  appNotifications,
  projectMembers,
  tasks,
  users,
  workspaceAttachments,
  clientProjectAccess,
} from "@shared/schema";
import { getProjectAccess, mergeProjectSettings, requireProjectModule } from "./project-settings";

const DEFAULT_MEETING_TYPES = [
  ["weekly", "Weekly Meeting"], ["standup", "Daily Stand-up"], ["stakeholder", "Stakeholder Meeting"],
  ["client_review", "Client Review"], ["project_review", "Project Review"], ["requirement", "Requirement Discussion"],
  ["technical", "Technical Discussion"], ["sprint_review", "Sprint Review"], ["sprint_planning", "Sprint Planning"],
  ["demo", "Demo"], ["retrospective", "Retrospective"], ["steering", "Steering Committee"],
  ["issue_resolution", "Issue Resolution"], ["adhoc", "Ad-hoc Meeting"], ["other", "Other"],
] as const;

function userId(req: any): string | null {
  const id = req.headers["x-user-id"] ?? req.session?.userId;
  return typeof id === "string" && id.trim() ? id : null;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

async function canManageMeeting(projectId: string, currentUserId: string): Promise<boolean> {
  const context = await getProjectAccess(projectId, currentUserId);
  if (!context.allowed) return false;
  if (context.roleNames?.includes("admin") || context.project?.created_by === currentUserId) return true;
  return Boolean(context.activeMember && (await storage.getProjectMembers(projectId)).some(
    (member) => member.user_id === currentUserId && member.member_type === "project_manager",
  ));
}

async function ensureMeetingTypes(projectId: string, createdBy: string) {
  const current = await db.select().from(meetingTypes).where(eq(meetingTypes.project_id, projectId)).orderBy(asc(meetingTypes.name));
  if (current.length) return current;
  await db.insert(meetingTypes).values(DEFAULT_MEETING_TYPES.map(([code, name]) => ({
    project_id: projectId, code, name, created_by: createdBy,
  }))).onConflictDoNothing();
  return db.select().from(meetingTypes).where(eq(meetingTypes.project_id, projectId)).orderBy(asc(meetingTypes.name));
}

async function participantOptions(projectId: string) {
  const members = await db.select().from(projectMembers).where(and(
    eq(projectMembers.project_id, projectId),
    eq(projectMembers.is_active, true),
  ));
  const userIds = members.map((member) => member.user_id).filter((id): id is string => Boolean(id));
  const contactIds = members.map((member) => member.contact_id).filter((id): id is string => Boolean(id));
  const [internalUsers, contacts] = await Promise.all([
    userIds.length ? db.select().from(users).where(inArray(users.id, userIds)) : Promise.resolve([]),
    contactIds.length ? db.select().from(clientContacts).where(inArray(clientContacts.id, contactIds)) : Promise.resolve([]),
  ]);
  return {
    projectMembers: members.filter((member) => member.user_id).map((member) => {
      const person = internalUsers.find((candidate) => candidate.id === member.user_id);
      return { id: member.user_id, name: person?.user_name || person?.email || "Project member", email: person?.email, role: member.project_role, memberType: member.member_type, attendeeType: "internal" };
    }),
    clientMembers: members.filter((member) => member.contact_id).map((member) => {
      const contact = contacts.find((candidate) => candidate.id === member.contact_id);
      return { id: member.contact_id, name: contact?.name || "Client contact", email: contact?.email, role: contact?.job_title, memberType: "client", attendeeType: "client" };
    }),
  };
}

async function recordActivity(meetingId: string, actionType: string, actedBy: string | null, metadata: Record<string, unknown> = {}) {
  await db.insert(meetingActivity).values({ meeting_id: meetingId, action_type: actionType, acted_by: actedBy, metadata });
}

async function notifyMeetingAudience(
  projectId: string,
  meetingId: string,
  eventType: string,
  title: string,
  message: string,
  dedupeKey?: string,
) {
  const savedSettings = await storage.getProjectSettings(projectId);
  const settings = mergeProjectSettings(savedSettings?.settings);
  if (settings.notifications?.[eventType]?.enabled === false) return;

  const meeting = (await db.select().from(meetings).where(and(eq(meetings.id, meetingId), eq(meetings.project_id, projectId)))).at(0);
  if (!meeting) return;
  const attendees = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meeting_id, meetingId));
  const rows = [
    ...Array.from(new Set(attendees.filter((attendee) => attendee.attendee_type === "internal" && attendee.user_id).map((attendee) => attendee.user_id!)))
      .map((recipientId) => ({ recipient_user_id: recipientId, project_id: projectId, event_type: eventType, title, message, entity_type: "meeting", entity_id: meetingId, dedupe_key: dedupeKey ? `${dedupeKey}:user:${recipientId}` : undefined })),
    ...(meeting.category !== "internal" && settings.collaboration?.clientCollaboration !== false
      ? Array.from(new Set(attendees.filter((attendee) => attendee.attendee_type === "client" && attendee.contact_id).map((attendee) => attendee.contact_id!)))
        .map((recipientId) => ({ recipient_contact_id: recipientId, project_id: projectId, event_type: eventType, title, message, entity_type: "meeting", entity_id: meetingId, dedupe_key: dedupeKey ? `${dedupeKey}:contact:${recipientId}` : undefined }))
      : []),
  ];
  if (rows.length) await db.insert(appNotifications).values(rows as any).onConflictDoNothing();
}

async function ensureOverdueMeetingNotifications(userIdValue: string) {
  const overdueActions = await db.select({
    action: meetingActionItems,
    meeting: meetings,
  }).from(meetingActionItems).innerJoin(meetings, eq(meetingActionItems.meeting_id, meetings.id))
    .where(lt(meetingActionItems.due_date, new Date()));
  for (const { action, meeting } of overdueActions) {
    if (["completed", "cancelled"].includes(action.status) || !normalizeIds(action.responsible_user_ids).includes(userIdValue)) continue;
    const settings = mergeProjectSettings((await storage.getProjectSettings(meeting.project_id))?.settings);
    if (settings.notifications?.meetingActionDue?.enabled === false) continue;
    const dueDate = new Date(action.due_date!).toISOString().slice(0, 10);
    await db.insert(appNotifications).values({
      recipient_user_id: userIdValue,
      project_id: meeting.project_id,
      event_type: "meetingActionDue",
      title: "Meeting action is overdue",
      message: `${action.title} from “${meeting.title}” was due on ${new Date(action.due_date!).toLocaleDateString()}.`,
      entity_type: "meeting",
      entity_id: meeting.id,
      dedupe_key: `meeting-action-due:${action.id}:${dueDate}:user:${userIdValue}`,
    }).onConflictDoNothing();
  }
}

async function meetingDetail(projectId: string, meetingId: string) {
  const meeting = (await db.select().from(meetings).where(and(eq(meetings.id, meetingId), eq(meetings.project_id, projectId)))).at(0);
  if (!meeting) return null;
  const [type, attendees, agenda, discussions, decisions, actions, calendar, activity, attachments] = await Promise.all([
    db.select().from(meetingTypes).where(eq(meetingTypes.id, meeting.meeting_type_id)).then((rows) => rows.at(0)),
    db.select().from(meetingAttendees).where(eq(meetingAttendees.meeting_id, meetingId)),
    db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meeting_id, meetingId)).orderBy(asc(meetingAgendaItems.sequence)),
    db.select().from(meetingDiscussions).where(eq(meetingDiscussions.meeting_id, meetingId)).orderBy(desc(meetingDiscussions.created_at)),
    db.select().from(meetingDecisions).where(eq(meetingDecisions.meeting_id, meetingId)).orderBy(desc(meetingDecisions.created_at)),
    db.select().from(meetingActionItems).where(eq(meetingActionItems.meeting_id, meetingId)).orderBy(asc(meetingActionItems.due_date)),
    db.select().from(meetingCalendarIntegrations).where(eq(meetingCalendarIntegrations.meeting_id, meetingId)),
    db.select().from(meetingActivity).where(eq(meetingActivity.meeting_id, meetingId)).orderBy(desc(meetingActivity.created_at)),
    db.select().from(workspaceAttachments).where(and(
      eq(workspaceAttachments.entity_type, "meeting"),
      eq(workspaceAttachments.entity_id, meetingId),
    )).orderBy(desc(workspaceAttachments.created_at)),
  ]);
  return {
    meeting,
    type,
    attendees: meeting.category === "internal"
      ? attendees.filter((attendee) => attendee.attendee_type !== "client")
      : attendees,
    agenda,
    discussions,
    decisions,
    actions,
    calendar,
    activity,
    attachments,
  };
}

function checkDateRange(startsAt: Date | null, endsAt: Date | null): string | null {
  if (!startsAt || !endsAt) return "Start and end date/time are required";
  if (endsAt <= startsAt) return "End time must be after start time";
  return null;
}

function requireMeetingPortalAuth(req: any, res: any, next: any) {
  if (!req.session?.clientContactId) return res.status(401).json({ error: "Portal authentication required" });
  next();
}

async function clientCanViewProject(contactId: string, projectId: string) {
  const access = await db.select().from(clientProjectAccess).where(and(
    eq(clientProjectAccess.contact_id, contactId),
    eq(clientProjectAccess.project_id, projectId),
  ));
  if (!access.length) return false;
  const project = await storage.getProject(projectId);
  const settings = mergeProjectSettings((await storage.getProjectSettings(projectId))?.settings);
  return Boolean(project && settings.visibility === "client" && settings.meetings?.enabled !== false);
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const PDF_NAVY = "#0b2a50";
const PDF_BLUE = "#2f78c4";
const PDF_PALE_BLUE = "#e7f0f8";
const PDF_GRID = "#d6dee8";
const PDF_TEXT = "#233044";
const PDF_MUTED = "#64748b";
const PDF_GREEN = "#dff3e8";
const PDF_RED = "#fbe2e2";
const PDF_AMBER = "#fff0c7";

function pdfDate(value: unknown, withDay = true) {
  if (!value) return "—";
  return new Date(String(value)).toLocaleDateString("en-GB", withDay
    ? { day: "2-digit", month: "long", year: "numeric", weekday: "long" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

function pdfTime(value: unknown) {
  if (!value) return "—";
  return new Date(String(value)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function pdfShort(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function drawPdfHeader(doc: any, projectName: string) {
  const width = doc.page.width;
  doc.save();
  doc.font("Helvetica-Bold").fontSize(20).fillColor(PDF_NAVY).text("TAZQ", 42, 16);
  doc.font("Helvetica").fontSize(5.5).fillColor(PDF_MUTED).text("Plan | Execute | Deliver Together", 43, 37);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_NAVY).text("Project Meeting Record", width - 215, 18, { width: 173, align: "right" });
  doc.font("Helvetica").fontSize(7).fillColor(PDF_MUTED).text(pdfShort(projectName, "Project"), width - 215, 33, { width: 173, align: "right" });
  doc.strokeColor(PDF_GRID).lineWidth(0.8).moveTo(42, 51).lineTo(width - 42, 51).stroke();
  doc.restore();
}

function drawPdfFooter(doc: any, pageNumber: number, pageCount: number) {
  const width = doc.page.width;
  const height = doc.page.height;
  doc.save();
  doc.strokeColor(PDF_GRID).lineWidth(0.6).moveTo(42, height - 35).lineTo(width - 42, height - 35).stroke();
  doc.font("Helvetica-Bold").fontSize(7).fillColor(PDF_NAVY).text("TAZQ", 42, height - 25);
  doc.font("Helvetica").fontSize(6.5).fillColor(PDF_MUTED).text("Project Governance & Work Execution", 67, height - 25);
  doc.text(`Page ${pageNumber} of ${pageCount}`, width - 130, height - 25, { width: 88, align: "right" });
  doc.restore();
}

function drawPdfSection(doc: any, number: number, title: string, y: number) {
  const x = 42;
  const width = doc.page.width - 84;
  doc.save();
  doc.fillColor(PDF_PALE_BLUE).rect(x, y, width, 23).fill();
  doc.fillColor(PDF_NAVY).roundedRect(x, y, 23, 23, 3).fill();
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff").text(String(number), x + 7, y + 6);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_NAVY).text(title.toUpperCase(), x + 35, y + 7);
  doc.restore();
  return y + 31;
}

function drawPdfTable(
  doc: any,
  y: number,
  columns: Array<{ label: string; width: number }>,
  rows: string[][],
  options: { rowHeight?: number; fontSize?: number } = {},
) {
  const x = 42;
  const width = doc.page.width - 84;
  const headerHeight = 22;
  const rowHeight = options.rowHeight ?? 22;
  const fontSize = options.fontSize ?? 7.5;
  let cursor = x;
  doc.save();
  doc.fillColor(PDF_PALE_BLUE).rect(x, y, width, headerHeight).fill();
  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(PDF_NAVY);
  columns.forEach((column) => {
    doc.text(column.label, cursor + 5, y + 7, { width: column.width - 10, height: headerHeight - 6, ellipsis: true });
    cursor += column.width;
  });
  doc.strokeColor(PDF_GRID).lineWidth(0.6).rect(x, y, width, headerHeight).stroke();
  cursor = x;
  columns.forEach((column) => {
    doc.moveTo(cursor, y).lineTo(cursor, y + headerHeight).stroke();
    cursor += column.width;
  });
  doc.moveTo(x + width, y).lineTo(x + width, y + headerHeight).stroke();
  rows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    doc.fillColor(rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc").rect(x, rowY, width, rowHeight).fill();
    cursor = x;
    doc.font("Helvetica").fontSize(fontSize).fillColor(PDF_TEXT);
    columns.forEach((column, columnIndex) => {
      const value = pdfShort(row[columnIndex]);
      doc.text(value, cursor + 5, rowY + 6, { width: column.width - 10, height: rowHeight - 8, ellipsis: true });
      doc.moveTo(cursor, rowY).lineTo(cursor, rowY + rowHeight).stroke();
      cursor += column.width;
    });
    doc.moveTo(cursor, rowY).lineTo(cursor, rowY + rowHeight).stroke();
    doc.strokeColor(PDF_GRID).rect(x, rowY, width, rowHeight).stroke();
  });
  doc.restore();
  return y + headerHeight + rows.length * rowHeight;
}

function drawPdfParagraph(doc: any, text: string, y: number, options: { fontSize?: number; color?: string; width?: number; lineGap?: number } = {}) {
  const width = options.width ?? doc.page.width - 84;
  const fontSize = options.fontSize ?? 8.5;
  doc.font("Helvetica").fontSize(fontSize).fillColor(options.color ?? PDF_TEXT);
  doc.text(pdfShort(text, "No notes recorded."), 42, y, { width, lineGap: options.lineGap ?? 2 });
  return y + doc.heightOfString(pdfShort(text, "No notes recorded."), { width, lineGap: options.lineGap ?? 2 });
}

export function registerMeetingRoutes(app: Express) {
  const access = requireProjectModule("meetings", "projectId");

  app.get("/api/notifications", async (req: any, res) => {
    const currentUserId = userId(req);
    if (!currentUserId) return res.status(401).json({ error: "Authentication required" });
    await ensureOverdueMeetingNotifications(currentUserId);
    const notifications = await db.select().from(appNotifications)
      .where(eq(appNotifications.recipient_user_id, currentUserId))
      .orderBy(desc(appNotifications.created_at))
      .limit(50);
    res.json({ notifications, unreadCount: notifications.filter((notification) => !notification.is_read).length });
  });

  app.patch("/api/notifications/:notificationId/read", async (req: any, res) => {
    const currentUserId = userId(req);
    if (!currentUserId) return res.status(401).json({ error: "Authentication required" });
    const [updated] = await db.update(appNotifications).set({ is_read: true })
      .where(and(eq(appNotifications.id, req.params.notificationId), eq(appNotifications.recipient_user_id, currentUserId))).returning();
    if (!updated) return res.status(404).json({ error: "Notification not found" });
    res.json(updated);
  });

  app.post("/api/notifications/read-all", async (req: any, res) => {
    const currentUserId = userId(req);
    if (!currentUserId) return res.status(401).json({ error: "Authentication required" });
    await db.update(appNotifications).set({ is_read: true }).where(eq(appNotifications.recipient_user_id, currentUserId));
    res.json({ ok: true });
  });

  app.get("/api/projects/:projectId/meetings/options", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    const [types, participants, canManage] = await Promise.all([
      ensureMeetingTypes(req.params.projectId, currentUserId),
      participantOptions(req.params.projectId),
      canManageMeeting(req.params.projectId, currentUserId),
    ]);
    res.json({ meetingTypes: types.filter((type) => type.is_active), ...participants, canManage });
  });

  app.get("/api/projects/:projectId/meeting-types", access, async (req: any, res) => {
    res.json(await ensureMeetingTypes(req.params.projectId, userId(req)!));
  });

  app.post("/api/projects/:projectId/meeting-types", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage meeting types" });
    const name = String(req.body?.name ?? "").trim();
    const code = String(req.body?.code ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "_")).trim();
    if (!name || !code) return res.status(400).json({ error: "Meeting type name and code are required" });
    try {
      const [created] = await db.insert(meetingTypes).values({ project_id: req.params.projectId, name, code, description: req.body?.description || null, created_by: userId(req) }).returning();
      res.status(201).json(created);
    } catch {
      res.status(409).json({ error: "A meeting type with this code already exists" });
    }
  });

  app.patch("/api/projects/:projectId/meeting-types/:typeId", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage meeting types" });
    const [updated] = await db.update(meetingTypes).set({
      ...(req.body?.name !== undefined ? { name: String(req.body.name).trim() } : {}),
      ...(req.body?.description !== undefined ? { description: req.body.description || null } : {}),
      ...(req.body?.is_active !== undefined ? { is_active: Boolean(req.body.is_active) } : {}),
      updated_at: new Date(),
    }).where(and(eq(meetingTypes.id, req.params.typeId), eq(meetingTypes.project_id, req.params.projectId))).returning();
    if (!updated) return res.status(404).json({ error: "Meeting type not found" });
    res.json(updated);
  });

  app.delete("/api/projects/:projectId/meeting-types/:typeId", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage meeting types" });
    const used = await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.meeting_type_id, req.params.typeId)).limit(1);
    if (used.length) return res.status(409).json({ error: "This meeting type is already used; deactivate it instead" });
    await db.delete(meetingTypes).where(and(eq(meetingTypes.id, req.params.typeId), eq(meetingTypes.project_id, req.params.projectId)));
    res.json({ ok: true });
  });

  app.get("/api/projects/:projectId/meetings", access, async (req: any, res) => {
    const [rows, types, attendees, actions] = await Promise.all([
      db.select().from(meetings).where(eq(meetings.project_id, req.params.projectId)).orderBy(desc(meetings.starts_at)),
      db.select().from(meetingTypes).where(eq(meetingTypes.project_id, req.params.projectId)),
      db.select().from(meetingAttendees),
      db.select().from(meetingActionItems),
    ]);
    const q = String(req.query.search ?? "").toLowerCase();
    const result = rows.filter((meeting) => {
      if (q && !`${meeting.title} ${meeting.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (req.query.status && meeting.status !== req.query.status) return false;
      if (req.query.category && meeting.category !== req.query.category) return false;
      if (req.query.typeId && meeting.meeting_type_id !== req.query.typeId) return false;
      return true;
    }).map((meeting) => ({
      ...meeting,
      meetingType: types.find((type) => type.id === meeting.meeting_type_id) ?? null,
      attendeeCount: attendees.filter((attendee) => attendee.meeting_id === meeting.id).length,
      openActionCount: actions.filter((action) => action.meeting_id === meeting.id && !["completed", "cancelled"].includes(action.status)).length,
      overdueActionCount: actions.filter((action) => action.meeting_id === meeting.id && action.due_date && new Date(action.due_date) < new Date() && !["completed", "cancelled"].includes(action.status)).length,
      nextActionDueDate: actions
        .filter((action) => action.meeting_id === meeting.id && action.due_date && !["completed", "cancelled"].includes(action.status))
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .at(0)?.due_date ?? null,
    }));
    res.json(result);
  });

  app.post("/api/projects/:projectId/meetings", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can create meetings" });
    const startsAt = asDate(req.body?.startsAt);
    const endsAt = asDate(req.body?.endsAt);
    const dateError = checkDateRange(startsAt, endsAt);
    const title = String(req.body?.title ?? "").trim();
    if (!title || dateError) return res.status(400).json({ error: title ? dateError : "Meeting title is required" });
    const type = (await db.select().from(meetingTypes).where(and(eq(meetingTypes.id, String(req.body.meetingTypeId)), eq(meetingTypes.project_id, req.params.projectId)))).at(0);
    if (!type || !type.is_active) return res.status(400).json({ error: "Choose an active meeting type" });
    const category = ["internal", "client", "mixed"].includes(req.body?.category) ? req.body.category : "internal";
    const [meeting] = await db.insert(meetings).values({
      project_id: req.params.projectId, title, meeting_type_id: type.id, category,
      organizer_id: currentUserId, starts_at: startsAt!, ends_at: endsAt!,
      timezone: String(req.body?.timezone || req.projectContext?.settings?.timeZone || "UTC"),
      location: req.body?.location || null, meeting_link: req.body?.meetingLink || null,
      description: req.body?.description || null, status: req.body?.status || "draft",
      recurrence_rule: req.body?.recurrenceRule || null, created_by: currentUserId,
    }).returning();
    const attendees = Array.isArray(req.body?.attendees) ? req.body.attendees : [];
    if (category === "internal" && attendees.some((item: any) => item?.attendeeType === "client")) {
      return res.status(400).json({ error: "Internal meetings cannot include client members" });
    }
    const validParticipants = await participantOptions(req.params.projectId);
    const internalIds = new Set(validParticipants.projectMembers.map((member) => member.id));
    const clientIds = new Set(validParticipants.clientMembers.map((member) => member.id));
    const attendeeRows = [
      { meeting_id: meeting.id, user_id: currentUserId, attendee_type: "internal", required: true, attendance_status: "present" },
      ...attendees.filter((item: any) =>
        (item.attendeeType === "client" ? clientIds.has(item.id) : internalIds.has(item.id)) && item.id !== currentUserId,
      ).map((item: any) => ({
        meeting_id: meeting.id,
        ...(item.attendeeType === "client" ? { contact_id: item.id } : { user_id: item.id }),
        attendee_type: item.attendeeType === "client" ? "client" : "internal",
        required: item.required !== false,
        attendance_status: "no_response",
      })),
    ];
    if (attendeeRows.length) await db.insert(meetingAttendees).values(attendeeRows as any).onConflictDoNothing();
    await db.insert(meetingCalendarIntegrations).values({ meeting_id: meeting.id, provider: "ics", sync_status: "available" }).onConflictDoNothing();
    if (req.body?.carryForwardActions) {
      const previousMeetings = await db.select().from(meetings).where(and(
        eq(meetings.project_id, req.params.projectId),
      )).orderBy(desc(meetings.starts_at));
      const previous = previousMeetings.find((candidate) => candidate.id !== meeting.id && new Date(candidate.starts_at) < startsAt!);
      if (previous) {
        const openActions = await db.select().from(meetingActionItems).where(and(
          eq(meetingActionItems.meeting_id, previous.id),
        ));
        const carry = openActions.filter((action) => !["completed", "cancelled"].includes(action.status));
        if (carry.length) {
          await db.insert(meetingActionItems).values(carry.map((action) => ({
            meeting_id: meeting.id, agenda_item_id: null, title: action.title, description: action.description,
            responsibility_level: action.responsibility_level, responsible_user_ids: action.responsible_user_ids,
            responsible_contact_ids: action.responsible_contact_ids, due_date: action.due_date, priority: action.priority,
            status: action.status, visibility: action.visibility, created_by: currentUserId,
          })));
        }
      }
    }
    await recordActivity(meeting.id, "meeting_created", currentUserId);
    if (meeting.status === "scheduled") {
      await notifyMeetingAudience(req.params.projectId, meeting.id, "meetingScheduled", "Meeting scheduled", `${meeting.title} is scheduled for ${new Date(meeting.starts_at).toLocaleString()}.`);
    }
    res.status(201).json(await meetingDetail(req.params.projectId, meeting.id));
  });

  app.get("/api/projects/:projectId/meetings/:meetingId", access, async (req: any, res) => {
    const detail = await meetingDetail(req.params.projectId, req.params.meetingId);
    if (!detail) return res.status(404).json({ error: "Meeting not found" });
    res.json(detail);
  });

  // Meeting files use the same metadata and permission model as Workspace
  // attachments. Binary upload/storage remains the responsibility of the
  // existing private file-storage flow.
  app.get("/api/projects/:projectId/meetings/:meetingId/attachments", access, async (req: any, res) => {
    const detail = await meetingDetail(req.params.projectId, req.params.meetingId);
    if (!detail) return res.status(404).json({ error: "Meeting not found" });
    res.json(await db.select().from(workspaceAttachments).where(and(
      eq(workspaceAttachments.entity_type, "meeting"),
      eq(workspaceAttachments.entity_id, req.params.meetingId),
    )));
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/attachments", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    const detail = await meetingDetail(req.params.projectId, req.params.meetingId);
    if (!detail) return res.status(404).json({ error: "Meeting not found" });
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can add meeting attachments" });
    const { fileName, fileType, fileSize, fileUrl, addToProjectWorkspace } = req.body ?? {};
    if (!fileName || !fileType || !fileUrl) return res.status(400).json({ error: "fileName, fileType and fileUrl are required" });
    const normalizedSize = fileSize === undefined || fileSize === null || fileSize === "" ? null : Number(fileSize);
    if (normalizedSize !== null && (!Number.isFinite(normalizedSize) || normalizedSize < 0 || normalizedSize > 5 * 1024 * 1024)) {
      return res.status(400).json({ error: "Attachments must be 5 MB or smaller" });
    }
    const [attachment] = await db.insert(workspaceAttachments).values({
      entity_type: "meeting", entity_id: req.params.meetingId, uploaded_by: currentUserId,
      file_name: String(fileName), file_type: String(fileType), file_size: normalizedSize, file_url: String(fileUrl),
    }).returning();
    let projectAttachment = null;
    if (addToProjectWorkspace !== false) {
      [projectAttachment] = await db.insert(workspaceAttachments).values({
        entity_type: "project", entity_id: req.params.projectId, uploaded_by: currentUserId,
        file_name: String(fileName), file_type: String(fileType), file_size: normalizedSize, file_url: String(fileUrl),
      }).returning();
    }
    await recordActivity(req.params.meetingId, "attachment_added", currentUserId, { attachmentId: attachment.id });
    res.status(201).json({ attachment, projectAttachment });
  });

  app.delete("/api/projects/:projectId/meetings/:meetingId/attachments/:attachmentId", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can remove meeting attachments" });
    await db.delete(workspaceAttachments).where(and(
      eq(workspaceAttachments.id, req.params.attachmentId),
      eq(workspaceAttachments.entity_type, "meeting"),
      eq(workspaceAttachments.entity_id, req.params.meetingId),
    ));
    res.json({ ok: true });
  });

  app.patch("/api/projects/:projectId/meetings/:meetingId", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can edit meetings" });
    const existing = (await meetingDetail(req.params.projectId, req.params.meetingId))?.meeting;
    if (!existing) return res.status(404).json({ error: "Meeting not found" });
    const startsAt = req.body?.startsAt !== undefined ? asDate(req.body.startsAt) : existing.starts_at;
    const endsAt = req.body?.endsAt !== undefined ? asDate(req.body.endsAt) : existing.ends_at;
    const dateError = checkDateRange(startsAt, endsAt);
    if (dateError) return res.status(400).json({ error: dateError });
    const [updated] = await db.update(meetings).set({
      ...(req.body?.title !== undefined ? { title: String(req.body.title).trim() } : {}),
      ...(req.body?.startsAt !== undefined ? { starts_at: startsAt! } : {}),
      ...(req.body?.endsAt !== undefined ? { ends_at: endsAt! } : {}),
      ...(req.body?.timezone !== undefined ? { timezone: String(req.body.timezone) } : {}),
      ...(req.body?.location !== undefined ? { location: req.body.location || null } : {}),
      ...(req.body?.meetingLink !== undefined ? { meeting_link: req.body.meetingLink || null } : {}),
      ...(req.body?.description !== undefined ? { description: req.body.description || null } : {}),
      ...(req.body?.category !== undefined ? { category: req.body.category } : {}),
      updated_at: new Date(),
    }).where(eq(meetings.id, req.params.meetingId)).returning();
    if (req.body?.category === "internal") {
      await db.delete(meetingAttendees).where(and(
        eq(meetingAttendees.meeting_id, req.params.meetingId),
        eq(meetingAttendees.attendee_type, "client"),
      ));
    }
    await recordActivity(updated.id, "meeting_updated", currentUserId);
    if (req.body?.startsAt !== undefined || req.body?.endsAt !== undefined) {
      await notifyMeetingAudience(req.params.projectId, updated.id, "meetingRescheduled", "Meeting rescheduled", `${updated.title} is now scheduled for ${new Date(updated.starts_at).toLocaleString()}.`);
    }
    res.json(await meetingDetail(req.params.projectId, updated.id));
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/status", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can change meeting status" });
    const status = String(req.body?.status ?? "");
    if (!["draft", "scheduled", "in_progress", "completed", "cancelled"].includes(status)) return res.status(400).json({ error: "Unsupported meeting status" });
    const current = (await meetingDetail(req.params.projectId, req.params.meetingId))?.meeting;
    if (!current) return res.status(404).json({ error: "Meeting not found" });
    if (current.status === "completed" && status !== "completed") return res.status(409).json({ error: "Completed meetings remain historical records and cannot be reverted" });
    const [updated] = await db.update(meetings).set({ status, updated_at: new Date() }).where(eq(meetings.id, current.id)).returning();
    await recordActivity(updated.id, `meeting_${status}`, currentUserId);
    if (status === "scheduled") {
      await notifyMeetingAudience(req.params.projectId, updated.id, "meetingScheduled", "Meeting scheduled", `${updated.title} is scheduled for ${new Date(updated.starts_at).toLocaleString()}.`);
    }
    res.json(updated);
  });

  app.delete("/api/projects/:projectId/meetings/:meetingId", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can delete meetings" });
    const current = (await meetingDetail(req.params.projectId, req.params.meetingId))?.meeting;
    if (!current) return res.status(404).json({ error: "Meeting not found" });
    if (!["draft", "cancelled"].includes(current.status)) return res.status(409).json({ error: "Only draft or cancelled meetings can be deleted" });
    await db.delete(meetings).where(and(eq(meetings.id, current.id), eq(meetings.project_id, req.params.projectId)));
    res.json({ ok: true });
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/attendees", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can manage attendees" });
    const detail = await meetingDetail(req.params.projectId, req.params.meetingId);
    if (!detail) return res.status(404).json({ error: "Meeting not found" });
    const requested = Array.isArray(req.body?.attendees) ? req.body.attendees : [req.body];
    const attendeeRequests = requested.filter(Boolean).map((item: any) => ({
      id: typeof item.id === "string" ? item.id : "",
      attendeeType: item.attendeeType === "client" || item.attendeeType === "external" ? item.attendeeType : "internal",
      externalName: String(item.externalName ?? item.name ?? "").trim(),
      externalRole: String(item.externalRole ?? item.role ?? "").trim(),
      required: item.required !== false,
    }));
    if (!attendeeRequests.length) return res.status(400).json({ error: "At least one attendee is required" });
    if (detail.meeting.category === "internal" && attendeeRequests.some((item: any) => item.attendeeType === "client")) {
      return res.status(400).json({ error: "Internal meetings cannot include client members" });
    }
    const participants = await participantOptions(req.params.projectId);
    const internalIds = new Set(participants.projectMembers.map((participant) => participant.id));
    const clientIds = new Set(participants.clientMembers.map((participant) => participant.id));
    const existingExternal = await db.select().from(meetingAttendees).where(and(
      eq(meetingAttendees.meeting_id, req.params.meetingId),
      eq(meetingAttendees.attendee_type, "external"),
    ));
    const externalKeys = new Set(existingExternal.map((attendee) => `${attendee.external_name?.trim().toLowerCase()}::${attendee.external_role?.trim().toLowerCase()}`));
    const rows: any[] = [];
    for (const item of attendeeRequests) {
      if (item.attendeeType === "external") {
        if (!item.externalName) return res.status(400).json({ error: "External attendee name is required" });
        if (!item.externalRole) return res.status(400).json({ error: "External attendee role is required" });
        const key = `${item.externalName.toLowerCase()}::${item.externalRole.toLowerCase()}`;
        if (externalKeys.has(key)) continue;
        externalKeys.add(key);
        rows.push({
          meeting_id: req.params.meetingId,
          external_name: item.externalName,
          external_role: item.externalRole || null,
          attendee_type: "external",
          required: item.required,
        });
        continue;
      }
      const sourceIds = item.attendeeType === "client" ? clientIds : internalIds;
      if (!item.id || !sourceIds.has(item.id)) return res.status(400).json({ error: "Attendee is not a member of this project" });
      rows.push({
        meeting_id: req.params.meetingId,
        ...(item.attendeeType === "client" ? { contact_id: item.id } : { user_id: item.id }),
        attendee_type: item.attendeeType,
        required: item.required,
      });
    }
    const created = rows.length ? await db.insert(meetingAttendees).values(rows).onConflictDoNothing().returning() : [];
    if (created.length) await recordActivity(req.params.meetingId, "attendee_added", currentUserId, { count: created.length });
    res.status(201).json(created.length === 1 ? created[0] : { attendees: created });
  });

  app.patch("/api/projects/:projectId/meetings/:meetingId/attendees/:attendeeId", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage attendance" });
    const [updated] = await db.update(meetingAttendees).set({
      ...(req.body?.required !== undefined ? { required: Boolean(req.body.required) } : {}),
      ...(req.body?.attendanceStatus !== undefined ? { attendance_status: String(req.body.attendanceStatus) } : {}),
    }).where(and(eq(meetingAttendees.id, req.params.attendeeId), eq(meetingAttendees.meeting_id, req.params.meetingId))).returning();
    if (!updated) return res.status(404).json({ error: "Attendee not found" });
    res.json(updated);
  });

  app.delete("/api/projects/:projectId/meetings/:meetingId/attendees/:attendeeId", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage attendees" });
    await db.delete(meetingAttendees).where(and(eq(meetingAttendees.id, req.params.attendeeId), eq(meetingAttendees.meeting_id, req.params.meetingId)));
    res.json({ ok: true });
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/agenda", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage agendas" });
    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Agenda item title is required" });
    const existing = await db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meeting_id, req.params.meetingId));
    const [created] = await db.insert(meetingAgendaItems).values({
      meeting_id: req.params.meetingId, sequence: Number(req.body?.sequence ?? existing.length + 1), title,
      description: req.body?.description || null, presenter_id: req.body?.presenterId || null,
      expected_duration: req.body?.expectedDuration ? Number(req.body.expectedDuration) : null,
      reference: req.body?.reference || null, linked_entity_type: req.body?.linkedEntityType || null,
      linked_entity_id: req.body?.linkedEntityId || null,
    }).returning();
    await recordActivity(req.params.meetingId, "agenda_updated", userId(req));
    res.status(201).json(created);
  });

  app.patch("/api/projects/:projectId/meetings/:meetingId/agenda/:agendaId", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage agendas" });
    const [updated] = await db.update(meetingAgendaItems).set({
      ...(req.body?.title !== undefined ? { title: String(req.body.title).trim() } : {}),
      ...(req.body?.description !== undefined ? { description: req.body.description || null } : {}),
      ...(req.body?.sequence !== undefined ? { sequence: Number(req.body.sequence) } : {}),
      ...(req.body?.status !== undefined ? { status: req.body.status } : {}),
      ...(req.body?.presenterId !== undefined ? { presenter_id: req.body.presenterId || null } : {}),
      updated_at: new Date(),
    }).where(and(eq(meetingAgendaItems.id, req.params.agendaId), eq(meetingAgendaItems.meeting_id, req.params.meetingId))).returning();
    if (!updated) return res.status(404).json({ error: "Agenda item not found" });
    await recordActivity(req.params.meetingId, "agenda_updated", userId(req));
    res.json(updated);
  });

  app.delete("/api/projects/:projectId/meetings/:meetingId/agenda/:agendaId", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage agendas" });
    await db.delete(meetingAgendaItems).where(and(eq(meetingAgendaItems.id, req.params.agendaId), eq(meetingAgendaItems.meeting_id, req.params.meetingId)));
    res.json({ ok: true });
  });

  app.patch("/api/projects/:projectId/meetings/:meetingId/minutes", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can record minutes" });
    const [updated] = await db.update(meetings).set({
      minutes_summary: req.body?.summary ?? null, additional_notes: req.body?.additionalNotes ?? null, updated_at: new Date(),
    }).where(and(eq(meetings.id, req.params.meetingId), eq(meetings.project_id, req.params.projectId))).returning();
    if (!updated) return res.status(404).json({ error: "Meeting not found" });
    await recordActivity(updated.id, "minutes_updated", userId(req));
    res.json(updated);
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/publish-minutes", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can publish minutes" });
    const [updated] = await db.update(meetings).set({ minutes_status: "published", published_by: currentUserId, published_at: new Date(), updated_at: new Date() }).where(and(eq(meetings.id, req.params.meetingId), eq(meetings.project_id, req.params.projectId))).returning();
    if (!updated) return res.status(404).json({ error: "Meeting not found" });
    await recordActivity(updated.id, "minutes_published", currentUserId);
    await notifyMeetingAudience(req.params.projectId, updated.id, "meetingMinutesPublished", "Meeting minutes published", `Minutes for “${updated.title}” are now available.`);
    res.json(updated);
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/discussions", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can record discussions" });
    const topic = String(req.body?.topic ?? "").trim();
    if (!topic) return res.status(400).json({ error: "Discussion topic is required" });
    const [created] = await db.insert(meetingDiscussions).values({
      meeting_id: req.params.meetingId, agenda_item_id: req.body?.agendaItemId || null, topic,
      discussion: req.body?.discussion || null, decision: req.body?.decision || null,
      reference: req.body?.reference || null, visibility: req.body?.visibility === "client" ? "client" : "internal", created_by: userId(req),
    }).returning();
    await recordActivity(req.params.meetingId, "discussion_added", userId(req));
    res.status(201).json(created);
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/decisions", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage decisions" });
    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Decision title is required" });
    const [created] = await db.insert(meetingDecisions).values({
      meeting_id: req.params.meetingId, agenda_item_id: req.body?.agendaItemId || null, title,
      description: req.body?.description || null, owner_id: req.body?.ownerId || null,
      status: req.body?.status || "proposed", visibility: req.body?.visibility === "client" ? "client" : "internal",
      linked_entity_type: req.body?.linkedEntityType || null, linked_entity_id: req.body?.linkedEntityId || null, created_by: userId(req),
    }).returning();
    await recordActivity(req.params.meetingId, "decision_added", userId(req));
    res.status(201).json(created);
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/actions", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can manage action items" });
    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Action item is required" });
    const responsibility = ["project_team", "client", "both"].includes(req.body?.responsibilityLevel) ? req.body.responsibilityLevel : "project_team";
    const userIds = normalizeIds(req.body?.responsibleUserIds);
    const contactIds = normalizeIds(req.body?.responsibleContactIds);
    if (responsibility === "project_team" && !userIds.length) return res.status(400).json({ error: "Assign at least one project member" });
    if (responsibility === "client" && !contactIds.length) return res.status(400).json({ error: "Assign at least one client member" });
    const [created] = await db.insert(meetingActionItems).values({
      meeting_id: req.params.meetingId, agenda_item_id: req.body?.agendaItemId || null, title,
      description: req.body?.description || null, responsibility_level: responsibility,
      responsible_user_ids: userIds, responsible_contact_ids: contactIds,
      due_date: asDate(req.body?.dueDate), priority: req.body?.priority || "medium",
      visibility: req.body?.visibility === "internal" ? "internal" : "client", created_by: userId(req),
    }).returning();
    await recordActivity(req.params.meetingId, "action_item_created", userId(req));
    res.status(201).json(created);
  });

  app.patch("/api/projects/:projectId/meetings/:meetingId/actions/:actionId", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can update action items" });
    const status = req.body?.status;
    const [updated] = await db.update(meetingActionItems).set({
      ...(req.body?.title !== undefined ? { title: String(req.body.title).trim() } : {}),
      ...(req.body?.description !== undefined ? { description: req.body.description || null } : {}),
      ...(req.body?.status !== undefined ? { status } : {}),
      ...(req.body?.priority !== undefined ? { priority: req.body.priority } : {}),
      ...(req.body?.dueDate !== undefined ? { due_date: asDate(req.body.dueDate) } : {}),
      ...(status === "completed" ? { completed_by: currentUserId, completed_at: new Date() } : {}),
      updated_at: new Date(),
    }).where(and(eq(meetingActionItems.id, req.params.actionId), eq(meetingActionItems.meeting_id, req.params.meetingId))).returning();
    if (!updated) return res.status(404).json({ error: "Action item not found" });
    await recordActivity(req.params.meetingId, status === "completed" ? "action_item_completed" : "action_item_updated", currentUserId);
    res.json(updated);
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/actions/:actionId/link-task", access, async (req: any, res) => {
    if (!(await canManageMeeting(req.params.projectId, userId(req)!))) return res.status(403).json({ error: "Only project managers or administrators can link tasks" });
    const task = (await db.select().from(tasks).where(and(eq(tasks.id, String(req.body?.taskId)), eq(tasks.project_id, req.params.projectId)))).at(0);
    if (!task) return res.status(404).json({ error: "Project task not found" });
    const [updated] = await db.update(meetingActionItems).set({ linked_task_id: task.id, updated_at: new Date() }).where(and(eq(meetingActionItems.id, req.params.actionId), eq(meetingActionItems.meeting_id, req.params.meetingId))).returning();
    res.json(updated);
  });

  app.post("/api/projects/:projectId/meetings/:meetingId/actions/:actionId/create-task", access, async (req: any, res) => {
    const currentUserId = userId(req)!;
    if (!(await canManageMeeting(req.params.projectId, currentUserId))) return res.status(403).json({ error: "Only project managers or administrators can create tasks" });
    const action = (await db.select().from(meetingActionItems).where(and(eq(meetingActionItems.id, req.params.actionId), eq(meetingActionItems.meeting_id, req.params.meetingId)))).at(0);
    if (!action) return res.status(404).json({ error: "Action item not found" });
    const responsibleUsers = normalizeIds(action.responsible_user_ids);
    const [createdTask] = await db.insert(tasks).values({
      title: action.title, description: action.description, project_id: req.params.projectId,
      created_by: currentUserId, assigned_to: responsibleUsers[0] || null, due_date: action.due_date,
      priority: action.priority === "high" ? 1 : action.priority === "low" ? 3 : 2, type: "meeting_action",
      status: "pending",
    }).returning();
    const [updatedAction] = await db.update(meetingActionItems).set({ linked_task_id: createdTask.id, updated_at: new Date() }).where(eq(meetingActionItems.id, action.id)).returning();
    await recordActivity(req.params.meetingId, "action_item_task_created", currentUserId, { taskId: createdTask.id });
    res.status(201).json({ task: createdTask, action: updatedAction });
  });

  app.get("/api/projects/:projectId/meetings/:meetingId/ics", access, async (req: any, res) => {
    const detail = await meetingDetail(req.params.projectId, req.params.meetingId);
    if (!detail) return res.status(404).json({ error: "Meeting not found" });
    const { meeting } = detail;
    const participantData = await participantOptions(req.params.projectId);
    const attendees = detail.attendees.map((attendee) => {
      const person = attendee.attendee_type === "client"
        ? participantData.clientMembers.find((candidate) => candidate.id === attendee.contact_id)
        : attendee.attendee_type === "internal"
          ? participantData.projectMembers.find((candidate) => candidate.id === attendee.user_id)
          : null;
      return person?.email ? `ATTENDEE;CN=${icsEscape(person.name)}:mailto:${person.email}` : "";
    }).filter(Boolean);
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tazq//Project Meetings//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:${meeting.id}@tazq`, `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(new Date(meeting.starts_at))}`, `DTEND:${icsDate(new Date(meeting.ends_at))}`,
      `SUMMARY:${icsEscape(meeting.title)}`, `DESCRIPTION:${icsEscape(meeting.description || detail.agenda.map((item) => item.title).join(", "))}`,
      ...(meeting.location ? [`LOCATION:${icsEscape(meeting.location)}`] : []),
      ...(meeting.meeting_link ? [`URL:${icsEscape(meeting.meeting_link)}`] : []),
      ...attendees, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${meeting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "meeting"}.ics"`);
    res.send(ics);
  });

  app.get("/api/projects/:projectId/meetings/:meetingId/pdf", access, async (req: any, res) => {
    const detail = await meetingDetail(req.params.projectId, req.params.meetingId);
    if (!detail) return res.status(404).json({ error: "Meeting not found" });
    const project = await storage.getProject(req.params.projectId);
    const [organizer, participantData] = await Promise.all([
      db.select().from(users).where(eq(users.id, detail.meeting.organizer_id)).then((rows) => rows.at(0)),
      participantOptions(req.params.projectId),
    ]);
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 0, size: "A4", bufferPages: true, autoFirstPage: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${detail.meeting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "meeting-minutes"}.pdf"`);
    doc.pipe(res);
    const projectName = project?.name || "Project";
    const attendeePeople = [...participantData.projectMembers, ...participantData.clientMembers];
    const attendeeRows = detail.attendees.length
      ? detail.attendees.map((attendee, index) => {
        const person = attendee.attendee_type === "external"
          ? null
          : attendeePeople.find((candidate) => candidate.id === (attendee.user_id || attendee.contact_id));
        return [
          String(index + 1),
          attendee.attendee_type === "external" ? pdfShort(attendee.external_name, "External participant") : pdfShort(person?.name, "Participant"),
          attendee.attendee_type === "external" ? "External" : attendee.attendee_type === "client" ? "Client" : "Project team",
          attendee.attendee_type === "external" ? pdfShort(attendee.external_role, "Participant") : pdfShort(person?.role, "Participant"),
          pdfShort(attendee.attendance_status, "No response").replace("_", " "),
        ];
      })
      : [["—", "No attendees recorded", "—", "—", "—"]];

    drawPdfHeader(doc, projectName);
    doc.save();
    doc.fillColor(PDF_NAVY).roundedRect(42, 63, doc.page.width - 84, 171, 4).fill();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("MEETING MINUTES", 60, 87);
    doc.font("Helvetica").fontSize(11).text(pdfShort(projectName), 60, 119, { width: 320 });
    doc.strokeColor("#7eb3e4").lineWidth(1).moveTo(60, 143).lineTo(112, 143).stroke();
    doc.font("Helvetica-Bold").fontSize(16).text(pdfShort(detail.meeting.title), 60, 157, { width: 320, height: 42, ellipsis: true });
    doc.font("Helvetica").fontSize(8.5).fillColor("#d8e8f7").text("Project Meeting Record", 60, 206);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#d8e8f7").text("Turning conversations into progress", doc.page.width - 205, 201, { width: 145, align: "right" });
    doc.restore();

    let y = 256;
    y = drawPdfSection(doc, 1, "Meeting information", y);
    y = drawPdfTable(doc, y, [
      { label: "Field", width: 145 }, { label: "Details", width: doc.page.width - 84 - 145 },
    ], [
      ["Date", pdfDate(detail.meeting.starts_at)],
      ["Time", `${pdfTime(detail.meeting.starts_at)} – ${pdfTime(detail.meeting.ends_at)} (${pdfShort(detail.meeting.timezone, "UTC")})`],
      ["Duration", `${Math.max(1, Math.round((new Date(detail.meeting.ends_at).getTime() - new Date(detail.meeting.starts_at).getTime()) / 60000))} minutes`],
      ["Organizer", pdfShort(organizer?.user_name || organizer?.email, "Project team")],
      ["Meeting type", pdfShort(detail.type?.name, "Project meeting")],
      ["Location / link", pdfShort(detail.meeting.location || detail.meeting.meeting_link, "Not specified")],
    ], { rowHeight: 20, fontSize: 8 });

    y += 18;
    y = drawPdfSection(doc, 2, "Attendees", y);
    y = drawPdfTable(doc, y, [
      { label: "#", width: 28 }, { label: "Name", width: 145 }, { label: "Organization", width: 105 },
      { label: "Role", width: 145 }, { label: "Attendance", width: 88 },
    ], attendeeRows, { rowHeight: 20, fontSize: 7.5 });

    y += 18;
    y = drawPdfSection(doc, 3, "Meeting summary", y);
    doc.save().fillColor("#f4f8fc").roundedRect(42, y, doc.page.width - 84, 74, 3).fill();
    drawPdfParagraph(doc, detail.meeting.minutes_summary || detail.meeting.description || "No meeting summary recorded.", y + 13, { width: doc.page.width - 110, fontSize: 8.5, lineGap: 2 });
    doc.restore();

    doc.addPage();
    drawPdfHeader(doc, projectName);
    y = 67;
    y = drawPdfSection(doc, 4, "Meeting agenda", y);
    const agendaRows = detail.agenda.length
      ? detail.agenda.map((item, index) => [String(index + 1), pdfShort(item.title), "—", item.expected_duration ? `${item.expected_duration} min` : "—"])
      : [["—", "No agenda items recorded", "—", "—"]];
    y = drawPdfTable(doc, y, [
      { label: "#", width: 28 }, { label: "Agenda item", width: 266 }, { label: "Presenter", width: 130 }, { label: "Time", width: 87 },
    ], agendaRows, { rowHeight: 24, fontSize: 7.5 });

    y += 18;
    y = drawPdfSection(doc, 5, "Discussions", y);
    const discussionRows = detail.discussions.length
      ? detail.discussions.slice(0, 7).map((item, index) => [String(index + 1), pdfShort(item.topic), pdfShort(item.discussion || item.decision, "No outcome recorded.")])
      : [["—", "No discussions recorded", "No outcome recorded."]];
    y = drawPdfTable(doc, y, [
      { label: "#", width: 28 }, { label: "Topic", width: 145 }, { label: "Discussion / outcome", width: 338 },
    ], discussionRows, { rowHeight: 34, fontSize: 7.2 });

    y += 18;
    y = drawPdfSection(doc, 6, "Key decisions", y);
    const decisionRows = detail.decisions.length
      ? detail.decisions.slice(0, 5).map((item, index) => [String(index + 1), pdfShort(item.title), pdfShort(item.description, "No details recorded."), pdfShort(item.status)])
      : [["—", "No decisions recorded", "No details recorded.", "—"]];
    y = drawPdfTable(doc, y, [
      { label: "#", width: 28 }, { label: "Decision", width: 150 }, { label: "Details", width: 250 }, { label: "Status", width: 83 },
    ], decisionRows, { rowHeight: 34, fontSize: 7.2 });
    doc.save().fillColor("#eef6fd").roundedRect(42, 735, doc.page.width - 84, 42, 3).fill();
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(PDF_BLUE).text(`“${pdfShort(detail.meeting.minutes_summary, "Good collaboration today. We are aligned on the next steps.")}”`, 58, 749, { width: doc.page.width - 116, height: 22, ellipsis: true });
    doc.restore();

    doc.addPage();
    drawPdfHeader(doc, projectName);
    y = 67;
    y = drawPdfSection(doc, 7, "Action items", y);
    const actionRows = detail.actions.length
      ? detail.actions.slice(0, 9).map((item, index) => {
        const owners = [
          ...((Array.isArray(item.responsible_user_ids) ? item.responsible_user_ids : []).map((id: string) => participantData.projectMembers.find((person) => person.id === id)?.name).filter(Boolean)),
          ...((Array.isArray(item.responsible_contact_ids) ? item.responsible_contact_ids : []).map((id: string) => participantData.clientMembers.find((person) => person.id === id)?.name).filter(Boolean)),
        ];
        const responsibility = item.responsibility_level === "client" ? "Client" : item.responsibility_level === "both" ? "Both" : "Project team";
        return [`A${index + 1}`, pdfShort(item.title), responsibility, owners.join(" / ") || "Unassigned", item.due_date ? pdfDate(item.due_date, false) : "Not set", pdfShort(item.status).replace("_", " ")];
      })
      : [["—", "No action items recorded", "—", "—", "—", "—"]];
    y = drawPdfTable(doc, y, [
      { label: "#", width: 30 }, { label: "Action item", width: 150 }, { label: "Responsibility", width: 88 },
      { label: "Responsible person(s)", width: 115 }, { label: "Due date", width: 70 }, { label: "Status", width: 58 },
    ], actionRows, { rowHeight: 34, fontSize: 6.8 });

    y += 18;
    y = drawPdfSection(doc, 8, "Additional notes", y);
    const noteLines = [detail.meeting.additional_notes, detail.meeting.description].filter(Boolean).join("\n\n");
    doc.save().fillColor("#f8fafc").roundedRect(42, y, doc.page.width - 84, 95, 3).fill();
    drawPdfParagraph(doc, noteLines || "No additional notes recorded.", y + 13, { width: doc.page.width - 110, fontSize: 8.2, lineGap: 3 });
    doc.restore();

    y += 113;
    y = drawPdfSection(doc, 9, "Next meeting", y);
    y = drawPdfTable(doc, y, [
      { label: "Date", width: 125 }, { label: "Time", width: 120 }, { label: "Type", width: 120 }, { label: "Location", width: 138 },
    ], [[
      "Not scheduled", "—", "Follow-up", pdfShort(detail.meeting.location || detail.meeting.meeting_link, "To be confirmed"),
    ]], { rowHeight: 27, fontSize: 7.5 });
    const openActions = detail.actions.filter((item) => !["completed", "cancelled"].includes(item.status)).slice(0, 4);
    const nextAgenda = openActions.length ? openActions.map((item) => `• ${item.title}`).join("\n") : "• Review progress and confirm next steps";
    drawPdfParagraph(doc, `Tentative agenda\n${nextAgenda}`, y + 12, { width: doc.page.width - 110, fontSize: 8, lineGap: 3 });

    doc.save().fillColor("#e9f4ff").roundedRect(42, 707, doc.page.width - 84, 58, 4).fill();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_BLUE).text("Thank you for your time and valuable contributions.", 42, 722, { width: doc.page.width - 84, align: "center" });
    doc.font("Helvetica").fontSize(8).fillColor(PDF_MUTED).text("Together, we make progress.", 42, 740, { width: doc.page.width - 84, align: "center" });
    doc.restore();

    const pageRange = doc.bufferedPageRange();
    for (let page = 0; page < pageRange.count; page += 1) {
      doc.switchToPage(page);
      drawPdfFooter(doc, page + 1, pageRange.count);
    }
    doc.end();
  });

  // Client portal reads are deliberately separate from internal project reads:
  // only client/mixed meetings with published minutes are exposed, and all
  // structured content is filtered by its explicit visibility value.
  app.get("/api/portal/projects/:projectId/meetings", requireMeetingPortalAuth, async (req: any, res) => {
    const contactId = String(req.session.clientContactId);
    if (!(await clientCanViewProject(contactId, req.params.projectId))) return res.status(403).json({ error: "You do not have access to this project" });
    const rows = await db.select().from(meetings).where(eq(meetings.project_id, req.params.projectId)).orderBy(desc(meetings.starts_at));
    res.json(rows.filter((meeting) => meeting.category !== "internal" &&
      meeting.status !== "draft" && meeting.status !== "cancelled" &&
      (meeting.status !== "completed" || meeting.minutes_status === "published")).map((meeting) => ({
      id: meeting.id, title: meeting.title, category: meeting.category, starts_at: meeting.starts_at,
      ends_at: meeting.ends_at, timezone: meeting.timezone, location: meeting.location, meeting_link: meeting.meeting_link,
      status: meeting.status, minutes_status: meeting.minutes_status,
    })));
  });

  app.get("/api/portal/projects/:projectId/meetings/:meetingId", requireMeetingPortalAuth, async (req: any, res) => {
    const contactId = String(req.session.clientContactId);
    if (!(await clientCanViewProject(contactId, req.params.projectId))) return res.status(403).json({ error: "You do not have access to this project" });
    const detail = await meetingDetail(req.params.projectId, req.params.meetingId);
    if (!detail || detail.meeting.category === "internal" || detail.meeting.status === "draft" || detail.meeting.status === "cancelled" ||
        (detail.meeting.status === "completed" && detail.meeting.minutes_status !== "published")) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    const published = detail.meeting.minutes_status === "published";
    res.json({
      meeting: {
        id: detail.meeting.id,
        project_id: detail.meeting.project_id,
        title: detail.meeting.title,
        category: detail.meeting.category,
        starts_at: detail.meeting.starts_at,
        ends_at: detail.meeting.ends_at,
        timezone: detail.meeting.timezone,
        location: detail.meeting.location,
        meeting_link: detail.meeting.meeting_link,
        status: detail.meeting.status,
        minutes_status: detail.meeting.minutes_status,
        description: published ? detail.meeting.description : null,
        minutes_summary: published ? detail.meeting.minutes_summary : null,
        additional_notes: published ? detail.meeting.additional_notes : null,
      },
      agenda: detail.agenda,
      discussions: published ? detail.discussions.filter((item) => item.visibility === "client") : [],
      decisions: published ? detail.decisions.filter((item) => item.visibility === "client") : [],
      actions: published ? detail.actions.filter((item) => item.visibility === "client") : [],
      attendees: detail.attendees.filter((item) => item.attendee_type !== "external" && (item.attendee_type === "client" || item.attendance_status === "present")),
    });
  });

  app.get("/api/portal/notifications", requireMeetingPortalAuth, async (req: any, res) => {
    const contactId = String(req.session.clientContactId);
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
    if (projectId && !(await clientCanViewProject(contactId, projectId))) return res.status(403).json({ error: "Access denied" });
    const conditions = [eq(appNotifications.recipient_contact_id, contactId)];
    if (projectId) conditions.push(eq(appNotifications.project_id, projectId));
    const notifications = await db.select().from(appNotifications)
      .where(and(...conditions))
      .orderBy(desc(appNotifications.created_at))
      .limit(50);
    res.json({ notifications, unreadCount: notifications.filter((notification) => !notification.is_read).length });
  });
}