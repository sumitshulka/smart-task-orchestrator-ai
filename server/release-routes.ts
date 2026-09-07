import type { Express } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  defects,
  defectActivity,
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
  testCaseResults,
  userStories,
  users,
} from "@shared/schema";
import { callAiProvider, decryptApiKey, DEFAULT_AI_MODEL } from "./ai-provider";
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
  const testCaseAccess = [
    requireProjectModule("testCases", "projectId"),
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

  app.get("/api/projects/:projectId/test-cases", ...testCaseAccess, async (req: any, res) => {
    const cases = await db.select().from(testCases)
      .where(eq(testCases.project_id, req.params.projectId))
      .orderBy(desc(testCases.test_case_number));
    const allResults = cases.length
      ? await db.select().from(testCaseResults).where(inArray(testCaseResults.test_case_id, cases.map((testCase) => testCase.id))).orderBy(desc(testCaseResults.execution_number))
      : [];
    const testerIds = Array.from(new Set(allResults.map((result) => result.tested_by)));
    const testers = testerIds.length
      ? await db.select({ id: users.id, user_name: users.user_name, email: users.email }).from(users).where(inArray(users.id, testerIds))
      : [];
    const testerById = new Map(testers.map((tester) => [tester.id, tester]));
    const withResults = cases.map((testCase) => ({
      ...testCase,
      results: allResults.filter((result) => result.test_case_id === testCase.id).map((result) => ({
        ...result,
        testedBy: testerById.get(result.tested_by) ?? null,
      })),
    }));
    res.json(withResults);
  });

  app.get("/api/projects/:projectId/test-cases/options", ...testCaseAccess, async (req: any, res) => {
    const projectId = req.params.projectId;
    const [milestones, features, stories] = await Promise.all([
      db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)),
      db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)),
      db.select().from(userStories).where(eq(userStories.project_id, projectId)),
    ]);
    res.json({ milestones, features, stories });
  });

  app.get("/api/projects/:projectId/test-cases/:testCaseId/results", ...testCaseAccess, async (req: any, res) => {
    const testCase = (await db.select().from(testCases).where(and(
      eq(testCases.id, req.params.testCaseId),
      eq(testCases.project_id, req.params.projectId),
    ))).at(0);
    if (!testCase) return res.status(404).json({ error: "Test case not found" });
    const results = await db.select().from(testCaseResults)
      .where(eq(testCaseResults.test_case_id, testCase.id))
      .orderBy(desc(testCaseResults.execution_number));
    const testerIds = Array.from(new Set(results.map((result) => result.tested_by)));
    const testers = testerIds.length
      ? await db.select({ id: users.id, user_name: users.user_name, email: users.email }).from(users).where(inArray(users.id, testerIds))
      : [];
    const testerById = new Map(testers.map((tester) => [tester.id, tester]));
    res.json(results.map((result) => ({ ...result, testedBy: testerById.get(result.tested_by) ?? null })));
  });

  app.post("/api/projects/:projectId/test-cases", ...testCaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const requirement = String(req.body?.requirement ?? req.body?.title ?? "").trim();
    if (!requirement) return res.status(400).json({ error: "Requirement is required" });
    const linked = await validateTestCaseLinks(req.params.projectId, req.body);
    if (linked.error) return res.status(400).json({ error: linked.error });
    const created = (await db.insert(testCases).values({
      project_id: req.params.projectId,
      milestone_id: linked.milestoneId,
      title: String(req.body?.title ?? requirement.slice(0, 120)).trim(),
      requirement,
      feature_id: linked.featureId,
      user_story_id: linked.userStoryId,
      comment: req.body?.comment ? String(req.body.comment).trim() : null,
      source: req.body?.source === "ai" ? "ai" : "manual",
      created_by: userId,
    }).returning()).at(0);
    res.status(201).json(created);
  });

  app.post("/api/projects/:projectId/test-cases/ai-generate", ...testCaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const featureIds = Array.isArray(req.body?.featureIds) ? req.body.featureIds.map(String) : [];
    const userStoryIds = Array.isArray(req.body?.userStoryIds) ? req.body.userStoryIds.map(String) : [];
    if (!featureIds.length && !userStoryIds.length) {
      return res.status(400).json({ error: "Select at least one feature or user story for AI generation" });
    }
    const [features, stories, aiSettings] = await Promise.all([
      db.select().from(projectFeatures).where(and(eq(projectFeatures.project_id, req.params.projectId), inArray(projectFeatures.id, featureIds))),
      db.select().from(userStories).where(and(eq(userStories.project_id, req.params.projectId), inArray(userStories.id, userStoryIds))),
      storage.getAiSettings(),
    ]);
    if (!aiSettings?.is_enabled || !aiSettings.api_key) {
      return res.status(503).json({ error: "AI is not enabled or configured for this workspace" });
    }
    const featureContext = features.map((feature) => ({ id: feature.id, title: feature.name, description: feature.description }));
    const storyContext = stories.map((story) => ({ id: story.id, title: story.title, description: story.description, acceptanceCriteria: story.acceptance_criteria, featureId: story.feature_id }));
    try {
      const raw = await callAiProvider(
        {
          provider: aiSettings.provider || "openai",
          apiKey: decryptApiKey(aiSettings.api_key),
          model: aiSettings.model || DEFAULT_AI_MODEL,
          baseUrl: aiSettings.base_url,
        },
        [
          {
            role: "system",
            content: "You create concise, testable software test cases. Return only a JSON array. Each item must have requirement, title, featureId, userStoryId, and comment. Use only IDs supplied by the user.",
          },
          {
            role: "user",
            content: JSON.stringify({ features: featureContext, userStories: storyContext, requestedCount: req.body?.count ?? 5 }),
          },
        ],
      );
      const parsed = parseAiTestCases(raw);
      if (!parsed.length) return res.status(422).json({ error: "AI did not return usable test cases" });
      const featureIdSet = new Set(features.map((feature) => feature.id));
      const storyMap = new Map(stories.map((story) => [story.id, story]));
      const created = [];
      for (const item of parsed.slice(0, 25)) {
        const featureId = featureIdSet.has(String(item.featureId)) ? String(item.featureId) : null;
        const story = storyMap.get(String(item.userStoryId));
        const row = (await db.insert(testCases).values({
          project_id: req.params.projectId,
          milestone_id: null,
          title: String(item.title ?? item.requirement ?? "AI generated test case").trim(),
          requirement: String(item.requirement ?? item.title ?? "").trim(),
          feature_id: featureId ?? story?.feature_id ?? null,
          user_story_id: story?.id ?? null,
          comment: item.comment ? String(item.comment).trim() : null,
          source: "ai",
          created_by: userId,
        }).returning()).at(0);
        if (row) created.push(row);
      }
      return res.status(201).json(created);
    } catch (error: any) {
      console.error("AI test case generation failed:", error);
      return res.status(500).json({ error: "Failed to generate AI test cases" });
    }
  });

  app.patch("/api/projects/:projectId/test-cases/:testCaseId", ...testCaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const existing = (await db.select().from(testCases).where(and(
      eq(testCases.id, req.params.testCaseId),
      eq(testCases.project_id, req.params.projectId),
    ))).at(0);
    if (!existing) return res.status(404).json({ error: "Test case not found" });
    const linked = await validateTestCaseLinks(req.params.projectId, req.body);
    if (linked.error) return res.status(400).json({ error: linked.error });
    const updated = (await db.update(testCases).set({
      ...(req.body?.title !== undefined ? { title: String(req.body.title).trim() } : {}),
      ...(req.body?.requirement !== undefined ? { requirement: String(req.body.requirement).trim() } : {}),
      ...(req.body?.comment !== undefined ? { comment: req.body.comment ? String(req.body.comment).trim() : null } : {}),
      ...(req.body?.featureId !== undefined ? { feature_id: linked.featureId } : {}),
      ...(req.body?.userStoryId !== undefined ? { user_story_id: linked.userStoryId } : {}),
      ...(req.body?.milestoneId !== undefined ? { milestone_id: linked.milestoneId } : {}),
      updated_at: new Date(),
    }).where(eq(testCases.id, existing.id)).returning()).at(0);
    res.json(updated);
  });

  app.post("/api/projects/:projectId/test-cases/:testCaseId/results", ...testCaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const testCase = (await db.select().from(testCases).where(and(
      eq(testCases.id, req.params.testCaseId),
      eq(testCases.project_id, req.params.projectId),
    ))).at(0);
    if (!testCase) return res.status(404).json({ error: "Test case not found" });
    if (testCase.closed_at) return res.status(400).json({ error: "Closed test cases cannot be executed" });
    const result = String(req.body?.result ?? "").toLowerCase();
    if (!["passed", "failed"].includes(result)) return res.status(400).json({ error: "Result must be passed or failed" });
    const latest = (await db.select({ execution_number: testCaseResults.execution_number })
      .from(testCaseResults)
      .where(eq(testCaseResults.test_case_id, testCase.id))
      .orderBy(desc(testCaseResults.execution_number))
      .limit(1)).at(0);
    const executionNumber = (latest?.execution_number ?? 0) + 1;
    let defectId: string | null = null;
    if (result === "failed" && req.body?.createDefect === true) {
      const defect = (await db.insert(defects).values({
        title: `Failed test: ${testCase.title}`,
        description: `Test Case ${formatTestCaseId(testCase)} failed during execution ${executionNumber}.`,
        actual_behavior: req.body?.comment ? String(req.body.comment) : null,
        expected_behavior: testCase.requirement,
        severity: "medium",
        priority: 3,
        status: "draft",
        type: "bug",
        environment: "qa",
        reported_by: userId,
        project_id: testCase.project_id,
        milestone_id: testCase.milestone_id,
        feature_id: testCase.feature_id,
      }).returning()).at(0);
      if (defect) {
        defectId = defect.id;
        await db.insert(defectActivity).values({
          defect_id: defect.id,
          action_type: "created",
          old_value: null,
          new_value: defect.title,
          acted_by: userId,
        });
      }
    }
    const execution = (await db.insert(testCaseResults).values({
      test_case_id: testCase.id,
      execution_number: executionNumber,
      result,
      comment: req.body?.comment ? String(req.body.comment).trim() : null,
      tested_by: userId,
      defect_id: defectId,
    }).returning()).at(0);
    const updated = (await db.update(testCases).set({
      status: result,
      comment: req.body?.comment ? String(req.body.comment).trim() : null,
      last_tested_by: userId,
      last_tested_at: new Date(),
      approval_status: result === "passed" ? "approved" : "pending",
      approved_by: result === "passed" ? userId : null,
      approved_at: result === "passed" ? new Date() : null,
      updated_at: new Date(),
    }).where(eq(testCases.id, testCase.id)).returning()).at(0);
    res.status(201).json({ execution, testCase: updated, defectId });
  });

  app.post("/api/projects/:projectId/test-cases/:testCaseId/close", ...testCaseAccess, async (req: any, res) => {
    const userId = requestUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const existing = (await db.select().from(testCases).where(and(
      eq(testCases.id, req.params.testCaseId),
      eq(testCases.project_id, req.params.projectId),
    ))).at(0);
    if (!existing) return res.status(404).json({ error: "Test case not found" });
    if (existing.status !== "passed") return res.status(400).json({ error: "Only passed test cases can be closed" });
    const updated = (await db.update(testCases).set({ closed_by: userId, closed_at: new Date(), updated_at: new Date() })
      .where(eq(testCases.id, existing.id)).returning()).at(0);
    res.json(updated);
  });
}

function formatTestCaseId(testCase: { test_case_number: number | null; id: string }): string {
  return testCase.test_case_number ? `TC-${String(testCase.test_case_number).padStart(5, "0")}` : `TC-${testCase.id.slice(0, 8).toUpperCase()}`;
}

function parseAiTestCases(raw: string): Array<Record<string, unknown>> {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
    } catch {
      return [];
    }
  }
}

async function validateTestCaseLinks(projectId: string, body: any): Promise<{
  error?: string;
  milestoneId: string | null;
  featureId: string | null;
  userStoryId: string | null;
}> {
  const milestoneId = body?.milestoneId ? String(body.milestoneId) : null;
  const featureId = body?.featureId ? String(body.featureId) : null;
  const userStoryId = body?.userStoryId ? String(body.userStoryId) : null;
  if (milestoneId) {
    const milestone = (await db.select().from(projectMilestones).where(and(eq(projectMilestones.id, milestoneId), eq(projectMilestones.project_id, projectId)))).at(0);
    if (!milestone) return { error: "Milestone does not belong to this project", milestoneId: null, featureId: null, userStoryId: null };
  }
  if (featureId) {
    const feature = (await db.select().from(projectFeatures).where(and(eq(projectFeatures.id, featureId), eq(projectFeatures.project_id, projectId)))).at(0);
    if (!feature) return { error: "Feature does not belong to this project", milestoneId, featureId: null, userStoryId: null };
  }
  if (userStoryId) {
    const story = (await db.select().from(userStories).where(and(eq(userStories.id, userStoryId), eq(userStories.project_id, projectId)))).at(0);
    if (!story) return { error: "User story does not belong to this project", milestoneId, featureId, userStoryId: null };
    if (featureId && story.feature_id && story.feature_id !== featureId) return { error: "User story does not belong to the selected feature", milestoneId, featureId, userStoryId };
  }
  return { milestoneId, featureId, userStoryId };
}