import type { Express } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  defects,
  projectFeatures,
  projectMilestones,
  projectTemplateRoles,
  projectReleases,
  releaseDocuments,
  releaseItems,
  releaseMilestones,
  releaseTestCases,
  tasks,
  testCases,
  userStories,
} from "@shared/schema";
import {
  getProjectAccess,
  mergeProjectSettings,
  requireProjectModule,
} from "./project-settings";

function requestUserId(req: any): string | null {
  return String(req.headers["x-user-id"] ?? req.user?.id ?? "") || null;
}

function isDone(value: unknown): boolean {
  return ["done", "completed", "closed", "resolved", "verified"].includes(String(value ?? "").toLowerCase());
}

async function canManageRelease(projectId: string, userId: string): Promise<boolean> {
  const context = await getProjectAccess(projectId, userId);
  if (!context.allowed) return false;
  if (context.roleNames?.includes("admin")) return true;
  return Boolean(
    context.activeMember &&
    (await storage.getProjectMembers(projectId)).some(
      (member) => member.user_id === userId && member.member_type === "project_manager",
    ),
  );
}

async function isQualityAnalyst(projectId: string, userId: string): Promise<boolean> {
  const context = await getProjectAccess(projectId, userId);
  if (!context.allowed) return false;
  if (context.roleNames?.some((role) => ["admin", "quality_analyst", "qa", "quality analyst"].includes(role.toLowerCase()))) return true;
  const configuredTitle = String(context.settings?.quality?.qualityAnalystTitle ?? "Quality Analyst").toLowerCase();
  const members = await storage.getProjectMembers(projectId);
  return members.some((member) =>
    member.user_id === userId &&
    member.is_active !== false &&
    String(member.project_role ?? "").toLowerCase() === configuredTitle,
  );
}

async function isSystemAdmin(userId: string): Promise<boolean> {
  const [assigned, allRoles] = await Promise.all([storage.getUserRoles(userId), storage.getAllRoles()]);
  return assigned.some((assignment) =>
    allRoles.find((role) => role.id === assignment.role_id)?.name === "admin",
  );
}

async function releaseScope(releaseId: string) {
  const release = (await db.select().from(projectReleases).where(eq(projectReleases.id, releaseId))).at(0);
  if (!release) return null;
  const milestones = await db.select().from(releaseMilestones).where(eq(releaseMilestones.release_id, releaseId));
  const items = await db.select().from(releaseItems).where(eq(releaseItems.release_id, releaseId));
  const documents = await db.select().from(releaseDocuments).where(eq(releaseDocuments.release_id, releaseId));
  const testCaseLinks = await db.select().from(releaseTestCases).where(eq(releaseTestCases.release_id, releaseId));
  return { release, milestones, items, documents, testCases: testCaseLinks };
}

async function readiness(releaseId: string) {
  const scope = await releaseScope(releaseId);
  if (!scope) return { ready: false, blockers: ["Release not found"] };
  const milestoneIds = scope.milestones.map((row) => row.milestone_id);
  const blockers: string[] = [];

  const taskIds = scope.items.filter((item) => item.item_type === "task").map((item) => item.item_id);
  const scopedTasks = taskIds.length
    ? await db.select().from(tasks).where(inArray(tasks.id, taskIds))
    : [];
  const incompleteTasks = scopedTasks.filter((task) => !isDone(task.status) || task.approval_status !== "approved");
  if (incompleteTasks.length) blockers.push(`${incompleteTasks.length} release task(s) must be completed and approved`);

  const scopedCases = milestoneIds.length
    ? await db.select().from(testCases).where(and(
        eq(testCases.project_id, scope.release.project_id),
        inArray(testCases.milestone_id, milestoneIds),
      ))
    : [];
  const failedCases = scopedCases.filter((testCase) =>
    testCase.status !== "passed" && testCase.approval_status !== "deferred" && testCase.approval_status !== "approved",
  );
  if (failedCases.length) blockers.push(`${failedCases.length} test case(s) must pass or be approved for deferral`);

  const missingDocuments = scope.documents.filter((document) =>
    document.required && (document.status !== "approved" || !document.location?.trim()),
  );
  if (missingDocuments.length) blockers.push(`${missingDocuments.length} required document(s) must be approved and have a location`);

  const scopedDefects = milestoneIds.length
    ? await db.select().from(defects).where(and(
        eq(defects.project_id, scope.release.project_id),
        inArray(defects.milestone_id, milestoneIds),
      ))
    : [];
  const unresolvedDefects = scopedDefects.filter((defect) =>
    !["closed", "deferred"].includes(String(defect.status).toLowerCase()) ||
    (String(defect.status).toLowerCase() === "deferred" && !defect.approved_by),
  );
  if (unresolvedDefects.length) blockers.push(`${unresolvedDefects.length} defect(s) must be closed or approved for deferral`);

  if (scope.release.qa_approved_at == null) blockers.push("Release requires QA approval");
  return {
    ready: blockers.length === 0,
    blockers,
    counts: {
      tasks: scopedTasks.length,
      testCases: scopedCases.length,
      documents: scope.documents.length,
      defects: scopedDefects.length,
    },
  };
}

export function registerReleaseRoutes(app: Express) {
  const releaseAccess = [
    requireProjectModule("release", "projectId"),
  ];

  app.get("/api/project-templates/:templateId/roles", async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const roles = await db.select().from(projectTemplateRoles)
      .where(eq(projectTemplateRoles.template_id, req.params.templateId));
    res.json(roles);
  });

  app.post("/api/project-templates/:templateId/roles", async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId || !(await isSystemAdmin(userId))) return res.status(403).json({ error: "Only system admins can configure template roles" });
    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Role title is required" });
    const created = (await db.insert(projectTemplateRoles).values({
      template_id: req.params.templateId,
      title,
      system_role: String(req.body?.systemRole ?? "project_member"),
      is_quality_analyst: Boolean(req.body?.isQualityAnalyst),
    }).onConflictDoNothing().returning()).at(0);
    if (created) return res.status(201).json(created);
    const existing = (await db.select().from(projectTemplateRoles).where(and(
      eq(projectTemplateRoles.template_id, req.params.templateId),
      eq(projectTemplateRoles.title, title),
    ))).at(0);
    if (!existing) return res.status(500).json({ error: "Could not create template role" });
    res.json(existing);
  });

  app.patch("/api/project-templates/:templateId/roles/:roleId", async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId || !(await isSystemAdmin(userId))) return res.status(403).json({ error: "Only system admins can configure template roles" });
    const updated = (await db.update(projectTemplateRoles).set({
      ...(req.body?.title !== undefined ? { title: String(req.body.title).trim() } : {}),
      ...(req.body?.systemRole !== undefined ? { system_role: String(req.body.systemRole) } : {}),
      ...(req.body?.isQualityAnalyst !== undefined ? { is_quality_analyst: Boolean(req.body.isQualityAnalyst) } : {}),
      updated_at: new Date(),
    }).where(and(eq(projectTemplateRoles.id, req.params.roleId), eq(projectTemplateRoles.template_id, req.params.templateId))).returning()).at(0);
    if (!updated) return res.status(404).json({ error: "Template role not found" });
    res.json(updated);
  });

  app.get("/api/projects/:projectId/releases", ...releaseAccess, async (req: any, res) => {
    const releases = await db.select().from(projectReleases)
      .where(eq(projectReleases.project_id, req.params.projectId));
    res.json(releases);
  });

  app.get("/api/projects/:projectId/releases/options", ...releaseAccess, async (req: any, res) => {
    const projectId = req.params.projectId;
    const [milestones, features, stories, projectTasks, cases] = await Promise.all([
      db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)),
      db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)),
      db.select().from(userStories).where(eq(userStories.project_id, projectId)),
      db.select().from(tasks).where(eq(tasks.project_id, projectId)),
      db.select().from(testCases).where(eq(testCases.project_id, projectId)),
    ]);
    res.json({ milestones, features, stories, tasks: projectTasks, testCases: cases });
  });

  app.get("/api/projects/:projectId/releases/:releaseId", ...releaseAccess, async (req: any, res) => {
    const scope = await releaseScope(req.params.releaseId);
    if (!scope || scope.release.project_id !== req.params.projectId) return res.status(404).json({ error: "Release not found" });
    res.json({ ...scope, readiness: await readiness(req.params.releaseId) });
  });

  app.post("/api/projects/:projectId/releases", ...releaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId || !(await canManageRelease(req.params.projectId, userId))) {
      return res.status(403).json({ error: "Only the project manager or a system admin can create releases" });
    }
    const { name, comment, milestoneIds = [], items = [], documents = [], testCaseIds = [] } = req.body ?? {};
    const savedSettings = await storage.getProjectSettings(req.params.projectId);
    const repositoryStartingVersion = mergeProjectSettings(savedSettings?.settings).releaseManagement.repository.startingVersion;
    const version = String(req.body?.version ?? "").trim() || repositoryStartingVersion;
    if (!String(name ?? "").trim() || !String(comment ?? "").trim()) {
      return res.status(400).json({ error: "Release name, version, and comment are required" });
    }
    if (!Array.isArray(milestoneIds) || milestoneIds.length === 0) {
      return res.status(400).json({ error: "Attach at least one milestone to a release" });
    }
    const milestones = await db.select().from(projectMilestones).where(and(
      eq(projectMilestones.project_id, req.params.projectId),
      inArray(projectMilestones.id, milestoneIds),
    ));
    if (milestones.length !== milestoneIds.length) return res.status(400).json({ error: "Every milestone must belong to this project" });

    const release = (await db.insert(projectReleases).values({
      project_id: req.params.projectId,
      name: String(name).trim(),
      version: String(version).trim(),
      comment: String(comment).trim(),
      created_by: userId,
    }).returning()).at(0)!;
    await db.insert(releaseMilestones).values(milestoneIds.map((milestoneId: string) => ({ release_id: release.id, milestone_id: milestoneId })));

    const allowedTypes = new Set(["feature", "user_story", "task"]);
    const normalizedItems = Array.isArray(items) ? items.filter((item: any) =>
      allowedTypes.has(item.itemType) && milestoneIds.includes(item.milestoneId) && item.itemId,
    ) : [];
    const optionRows = await Promise.all(normalizedItems.map(async (item: any) => {
      const source = item.itemType === "feature"
        ? await db.select().from(projectFeatures).where(eq(projectFeatures.id, item.itemId))
        : item.itemType === "user_story"
          ? await db.select().from(userStories).where(eq(userStories.id, item.itemId))
          : await db.select().from(tasks).where(eq(tasks.id, item.itemId));
      const row: any = source.at(0);
      if (!row) return null;
      return { release_id: release.id, milestone_id: item.milestoneId, item_type: item.itemType, item_id: item.itemId, title_snapshot: row.title ?? row.name };
    }));
    const validItems = optionRows.filter(Boolean) as any[];
    if (validItems.length) await db.insert(releaseItems).values(validItems);

    const normalizedDocuments = Array.isArray(documents) ? documents.filter((document: any) => String(document.name ?? "").trim()) : [];
    if (normalizedDocuments.length) {
      await db.insert(releaseDocuments).values(normalizedDocuments.map((document: any) => ({
        release_id: release.id,
        name: String(document.name).trim(),
        description: document.description ? String(document.description) : null,
        required: document.required !== false,
      })));
    }
    const validTestCaseIds = Array.isArray(testCaseIds) ? testCaseIds : [];
    if (validTestCaseIds.length) await db.insert(releaseTestCases).values(validTestCaseIds.map((testCaseId: string) => ({ release_id: release.id, test_case_id: testCaseId })));
    res.status(201).json(await releaseScope(release.id));
  });

  app.post("/api/projects/:projectId/releases/:releaseId/submit", ...releaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId || !(await canManageRelease(req.params.projectId, userId))) return res.status(403).json({ error: "Only the project manager or a system admin can submit releases" });
    const scope = await releaseScope(req.params.releaseId);
    if (!scope || scope.release.project_id !== req.params.projectId) return res.status(404).json({ error: "Release not found" });
    const updated = (await db.update(projectReleases).set({ status: "pending_approval", rejection_reason: null, updated_at: new Date() }).where(eq(projectReleases.id, scope.release.id)).returning()).at(0);
    res.json({ ...updated, readiness: await readiness(scope.release.id) });
  });

  app.post("/api/projects/:projectId/releases/:releaseId/qa-approve", ...releaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId || !(await isQualityAnalyst(req.params.projectId, userId))) return res.status(403).json({ error: "Only an assigned Quality Analyst can approve release QA" });
    const scope = await releaseScope(req.params.releaseId);
    if (!scope || scope.release.project_id !== req.params.projectId) return res.status(404).json({ error: "Release not found" });
    const updated = (await db.update(projectReleases).set({ status: "qa_approved", qa_approved_by: userId, qa_approved_at: new Date(), updated_at: new Date() }).where(eq(projectReleases.id, scope.release.id)).returning()).at(0);
    res.json(updated);
  });

  app.post("/api/projects/:projectId/releases/:releaseId/approve", ...releaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId || !(await canManageRelease(req.params.projectId, userId))) return res.status(403).json({ error: "Only the project manager or a system admin can approve releases" });
    const scope = await releaseScope(req.params.releaseId);
    if (!scope || scope.release.project_id !== req.params.projectId) return res.status(404).json({ error: "Release not found" });
    const gate = await readiness(scope.release.id);
    if (!gate.ready) return res.status(409).json({ error: "Release approval gates are not satisfied", blockers: gate.blockers, readiness: gate });
    const updated = (await db.update(projectReleases).set({ status: "approved", approved_by: userId, approved_at: new Date(), updated_at: new Date() }).where(eq(projectReleases.id, scope.release.id)).returning()).at(0);
    res.json(updated);
  });

  app.post("/api/tasks/:taskId/approve", async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const task = await storage.getTask(req.params.taskId);
    if (!task?.project_id) return res.status(404).json({ error: "Project task not found" });
    if (!(await canManageRelease(task.project_id, userId))) return res.status(403).json({ error: "Only the project manager or a system admin can approve tasks" });
    const updated = await storage.updateTask(task.id, { approval_status: "approved", approved_by: userId, approved_at: new Date() } as any);
    res.json(updated);
  });

  app.patch("/api/projects/:projectId/releases/:releaseId/documents/:documentId", ...releaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId || !(await canManageRelease(req.params.projectId, userId))) return res.status(403).json({ error: "Only the project manager or a system admin can update release documents" });
    const scope = await releaseScope(req.params.releaseId);
    if (!scope || scope.release.project_id !== req.params.projectId) return res.status(404).json({ error: "Release not found" });
    const status = String(req.body?.status ?? "pending");
    if (!["pending", "approved", "rejected", "deferred"].includes(status)) return res.status(400).json({ error: "Unsupported document status" });
    const updated = (await db.update(releaseDocuments).set({
      status,
      location: req.body?.location ? String(req.body.location).trim() : null,
      approved_by: status === "approved" ? userId : null,
      approved_at: status === "approved" ? new Date() : null,
      updated_at: new Date(),
    }).where(and(eq(releaseDocuments.id, req.params.documentId), eq(releaseDocuments.release_id, req.params.releaseId))).returning()).at(0);
    if (!updated) return res.status(404).json({ error: "Release document not found" });
    res.json(updated);
  });

  app.get("/api/projects/:projectId/test-cases", ...releaseAccess, async (req: any, res) => {
    res.json(await db.select().from(testCases).where(eq(testCases.project_id, req.params.projectId)));
  });

  app.post("/api/projects/:projectId/test-cases", ...releaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Test case title is required" });
    const created = (await db.insert(testCases).values({
      project_id: req.params.projectId,
      milestone_id: req.body?.milestoneId ?? null,
      title,
      created_by: userId,
    }).returning()).at(0);
    res.status(201).json(created);
  });

  app.patch("/api/projects/:projectId/test-cases/:testCaseId", ...releaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const status = req.body?.status;
    const approvalStatus = req.body?.approvalStatus;
    const updated = (await db.update(testCases).set({
      ...(status ? { status } : {}),
      ...(approvalStatus ? { approval_status: approvalStatus, approved_by: ["approved", "deferred"].includes(approvalStatus) ? userId : null, approved_at: ["approved", "deferred"].includes(approvalStatus) ? new Date() : null } : {}),
      updated_at: new Date(),
    }).where(and(eq(testCases.id, req.params.testCaseId), eq(testCases.project_id, req.params.projectId))).returning()).at(0);
    if (!updated) return res.status(404).json({ error: "Test case not found" });
    res.json(updated);
  });
}