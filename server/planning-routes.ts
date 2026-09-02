/**
 * Planning Module API Routes
 * All routes are mounted under /api/projects/:projectId/planning
 *
 * Authorization: every route in this module requires:
 *   1. The application's authenticated user identity — requireAuth
 *   2. Active project membership for the requested project — requireProjectMember
 * Both checks are applied once via router-level middleware; no route in this
 * file is reachable without passing both.
 */
import type { Express } from "express";
import { Router } from "express";
import { db } from "./db";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import {
  planningPhases, planningStages, userStories, planningDependencies,
  planningMethodologyConfigs, planningAiProposals, planningAiProposalItems,
  projectMilestones, projectFeatureGroups, projectFeatures, projects, users,
  projectMembers,
} from "@shared/schema";
import { callAiProvider, decryptApiKey } from "./ai-provider";
import { storage } from "./storage";

/**
 * Extract the current application's user identity. The existing internal API
 * convention identifies regular users with x-user-id; a server session is
 * retained as a fallback for session-based callers.
 *
 * Planning must use this same convention as the rest of the internal API:
 * development sessions are stored in memory and disappear on server restart,
 * while the app restores its authenticated user from local storage.
 */
function getAuthenticatedUserId(req: any): string | null {
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId;
  }
  return req.session?.userId ?? null;
}

/**
 * Identity for write operations that must be tied to a verified server session.
 * Unlike getAuthenticatedUserId this never trusts a caller-supplied header,
 * preventing IDOR attacks on state-mutating planning routes.
 */
function getSessionUserId(req: any): string | null {
  return req.session?.userId ?? null;
}

/** Map entity type labels (from the UI) to their Drizzle table objects. */
const ENTITY_TABLE_MAP: Record<string, { table: any }> = {
  phase:         { table: planningPhases       },
  stage:         { table: planningStages        },
  milestone:     { table: projectMilestones     },
  feature_group: { table: projectFeatureGroups  },
  feature:       { table: projectFeatures       },
  user_story:    { table: userStories           },
};

/** Returns true only when `itemId` exists in its entity table AND belongs to `projectId`. */
async function itemBelongsToProject(itemId: string, entityType: string, projectId: string): Promise<boolean> {
  const mapping = ENTITY_TABLE_MAP[entityType];
  if (!mapping) return false;
  const [row] = await db.select({ id: mapping.table.id })
    .from(mapping.table)
    .where(and(eq(mapping.table.id, itemId), eq(mapping.table.project_id, projectId)))
    .limit(1);
  return !!row;
}

// ── Auth middleware ───────────────────────────────────────────────────────────

const requireAuth = async (req: any, res: any, next: any) => {
  if (!getSessionUserId(req)) return res.status(401).json({ error: "Authentication required" });
  next();
};

/**
 * Verify the authenticated user is an active member of :projectId.
 * Identity is derived only from the verified server session — never from
 * caller-supplied headers — to prevent IDOR / broken-access-control attacks.
 */
const requireProjectMember = async (req: any, res: any, next: any) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  const { projectId } = req.params;
  if (!projectId) return next();
  try {
    // A project creator is authorized even if older project data does not
    // contain a matching project_members row for them.
    const [[member], [project]] = await Promise.all([
      db.select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.project_id, projectId),
            eq(projectMembers.user_id, userId),
            eq(projectMembers.is_active, true),
          )
        )
        .limit(1),
      db.select({ created_by: projects.created_by })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
    ]);
    if (!member && project?.created_by !== userId) {
      return res.status(403).json({ error: "You are not a member of this project" });
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify project membership" });
  }
};

export function registerPlanningRoutes(app: Express) {
  // All routes in this router require session auth + project membership.
  // Typed as `any` so TypeScript doesn't complain about merged params shape.
  const router: any = Router({ mergeParams: true });
  router.use(requireAuth, requireProjectMember);

  // ── Planning Tree (single call fetches entire hierarchy) ──────────────────
  router.get("/tree", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const [phases, stages, milestones, featureGroups, features, stories, deps, config] =
        await Promise.all([
          db.select().from(planningPhases).where(eq(planningPhases.project_id, projectId)).orderBy(asc(planningPhases.sort_order)),
          db.select().from(planningStages).where(eq(planningStages.project_id, projectId)).orderBy(asc(planningStages.sort_order)),
          db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)).orderBy(asc(projectMilestones.milestone_order)),
          db.select().from(projectFeatureGroups).where(eq(projectFeatureGroups.project_id, projectId)).orderBy(asc((projectFeatureGroups as any).sort_order)),
          db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)).orderBy(asc((projectFeatures as any).sort_order)),
          db.select().from(userStories).where(eq(userStories.project_id, projectId)).orderBy(asc(userStories.sort_order)),
          // Sort by user-defined panel order (sort_order), tie-break by creation time
          db.select().from(planningDependencies).where(eq(planningDependencies.project_id, projectId)).orderBy(asc((planningDependencies as any).sort_order), asc(planningDependencies.created_at)),
          db.select().from(planningMethodologyConfigs).where(eq(planningMethodologyConfigs.project_id, projectId)).limit(1),
        ]);
      res.json({ phases, stages, milestones, featureGroups, features, stories, dependencies: deps, config: config[0] ?? null });
    } catch (err: any) {
      console.error("Planning tree error:", err);
      res.status(500).json({ error: "Failed to load planning tree" });
    }
  });

  // ── Planning Coverage ─────────────────────────────────────────────────────
  router.get("/coverage", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const [phases, milestones, featureGroups, features, stories] = await Promise.all([
        db.select().from(planningPhases).where(eq(planningPhases.project_id, projectId)),
        db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)),
        db.select().from(projectFeatureGroups).where(eq(projectFeatureGroups.project_id, projectId)),
        db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)),
        db.select().from(userStories).where(eq(userStories.project_id, projectId)),
      ]);

      const allItems = [
        ...phases.map(p => ({ planning_status: (p as any).planning_status })),
        ...milestones.map(m => ({ planning_status: (m as any).planning_status })),
        ...featureGroups.map(f => ({ planning_status: (f as any).planning_status })),
        ...features.map(f => ({ planning_status: (f as any).planning_status })),
        ...stories.map(s => ({ planning_status: s.planning_status })),
      ];

      const total = allItems.length;
      const statusWeights: Record<string, number> = { high_level: 0.25, partially_planned: 0.6, detailed: 0.9, reviewed: 1.0 };
      const coverage = total === 0 ? 0 : Math.round(
        (allItems.reduce((sum, item) => sum + (statusWeights[(item as any).planning_status ?? "high_level"] ?? 0), 0) / total) * 100
      );

      const byStatus = {
        high_level: allItems.filter(i => (i as any).planning_status === "high_level").length,
        partially_planned: allItems.filter(i => (i as any).planning_status === "partially_planned").length,
        detailed: allItems.filter(i => (i as any).planning_status === "detailed").length,
        reviewed: allItems.filter(i => (i as any).planning_status === "reviewed").length,
      };

      res.json({
        coverage_pct: coverage,
        total_items: total,
        by_status: byStatus,
        counts: { phases: phases.length, milestones: milestones.length, feature_groups: featureGroups.length, features: features.length, user_stories: stories.length },
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to compute coverage" });
    }
  });

  // ── Planning Methodology Config ───────────────────────────────────────────
  router.get("/config", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const rows = await db.select().from(planningMethodologyConfigs).where(eq(planningMethodologyConfigs.project_id, projectId)).limit(1);
      res.json(rows[0] ?? null);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load config" });
    }
  });

  router.put("/config", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const userId = getSessionUserId(req);
      const { methodology, methodology_version, config_snapshot, notes } = req.body;
      const existing = await db.select().from(planningMethodologyConfigs).where(eq(planningMethodologyConfigs.project_id, projectId)).limit(1);
      if (existing.length) {
        const updated = await db.update(planningMethodologyConfigs).set({
          methodology, methodology_version: methodology_version ?? "1.0",
          config_snapshot, notes, updated_at: new Date(),
        }).where(eq(planningMethodologyConfigs.id, existing[0].id)).returning();
        await db.update(projects).set({ planning_methodology: methodology, updated_at: new Date() }).where(eq(projects.id, projectId));
        return res.json(updated[0]);
      }
      const created = await db.insert(planningMethodologyConfigs).values({
        project_id: projectId, methodology: methodology ?? "manual",
        methodology_version: methodology_version ?? "1.0",
        config_snapshot, notes, created_by: userId,
      }).returning();
      await db.update(projects).set({ planning_methodology: methodology ?? "manual", updated_at: new Date() }).where(eq(projects.id, projectId));
      res.json(created[0]);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to save config" });
    }
  });

  // ── Phases CRUD ───────────────────────────────────────────────────────────
  router.get("/phases", async (req: any, res: any) => {
    try {
      const rows = await db.select().from(planningPhases).where(eq(planningPhases.project_id, req.params.projectId)).orderBy(asc(planningPhases.sort_order));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load phases" }); }
  });

  router.post("/phases", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const maxOrder = await db.select({ max: sql<number>`coalesce(max(sort_order),0)` }).from(planningPhases).where(eq(planningPhases.project_id, projectId));
      const row = await db.insert(planningPhases).values({
        project_id: projectId,
        name: req.body.name,
        description: req.body.description ?? null,
        sort_order: (maxOrder[0]?.max ?? 0) + 10,
        planning_status: req.body.planning_status ?? "high_level",
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        end_date: req.body.end_date ? new Date(req.body.end_date) : null,
        estimated_hours: req.body.estimated_hours ?? null,
        owner_id: req.body.owner_id ?? null,
      }).returning();
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to create phase" }); }
  });

  router.put("/phases/:id", async (req: any, res: any) => {
    try {
      const row = await db.update(planningPhases).set({
        name: req.body.name,
        description: req.body.description ?? null,
        planning_status: req.body.planning_status,
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        end_date: req.body.end_date ? new Date(req.body.end_date) : null,
        estimated_hours: req.body.estimated_hours ?? null,
        owner_id: req.body.owner_id ?? null,
        sort_order: req.body.sort_order,
        updated_at: new Date(),
      }).where(and(eq(planningPhases.id, req.params.id), eq(planningPhases.project_id, req.params.projectId))).returning();
      if (!row.length) return res.status(404).json({ error: "Phase not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update phase" }); }
  });

  router.delete("/phases/:id", async (req: any, res: any) => {
    try {
      await db.delete(planningPhases).where(and(eq(planningPhases.id, req.params.id), eq(planningPhases.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete phase" }); }
  });

  // ── Stages CRUD ───────────────────────────────────────────────────────────
  router.get("/stages", async (req: any, res: any) => {
    try {
      const rows = await db.select().from(planningStages).where(eq(planningStages.project_id, req.params.projectId)).orderBy(asc(planningStages.sort_order));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load stages" }); }
  });

  router.post("/stages", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const maxOrder = await db.select({ max: sql<number>`coalesce(max(sort_order),0)` }).from(planningStages).where(eq(planningStages.project_id, projectId));
      const row = await db.insert(planningStages).values({
        project_id: projectId,
        phase_id: req.body.phase_id ?? null,
        name: req.body.name,
        description: req.body.description ?? null,
        sort_order: (maxOrder[0]?.max ?? 0) + 10,
        planning_status: req.body.planning_status ?? "high_level",
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        end_date: req.body.end_date ? new Date(req.body.end_date) : null,
        estimated_hours: req.body.estimated_hours ?? null,
        owner_id: req.body.owner_id ?? null,
      }).returning();
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to create stage" }); }
  });

  router.put("/stages/:id", async (req: any, res: any) => {
    try {
      const row = await db.update(planningStages).set({
        name: req.body.name,
        description: req.body.description ?? null,
        phase_id: req.body.phase_id ?? null,
        planning_status: req.body.planning_status,
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        end_date: req.body.end_date ? new Date(req.body.end_date) : null,
        estimated_hours: req.body.estimated_hours ?? null,
        owner_id: req.body.owner_id ?? null,
        sort_order: req.body.sort_order,
        updated_at: new Date(),
      }).where(and(eq(planningStages.id, req.params.id), eq(planningStages.project_id, req.params.projectId))).returning();
      if (!row.length) return res.status(404).json({ error: "Stage not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update stage" }); }
  });

  router.delete("/stages/:id", async (req: any, res: any) => {
    try {
      await db.delete(planningStages).where(and(eq(planningStages.id, req.params.id), eq(planningStages.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete stage" }); }
  });

  // ── User Stories CRUD ─────────────────────────────────────────────────────
  router.get("/user-stories", async (req: any, res: any) => {
    try {
      const rows = await db.select().from(userStories).where(eq(userStories.project_id, req.params.projectId)).orderBy(asc(userStories.sort_order));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load user stories" }); }
  });

  router.post("/user-stories", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const count = await db.select({ cnt: sql<number>`count(*)` }).from(userStories).where(eq(userStories.project_id, projectId));
      const trackNum = `US-${String((count[0]?.cnt ?? 0) + 1).padStart(3, "0")}`;
      const maxOrder = await db.select({ max: sql<number>`coalesce(max(sort_order),0)` }).from(userStories).where(eq(userStories.project_id, projectId));
      const row = await db.insert(userStories).values({
        project_id: projectId,
        feature_id: req.body.feature_id ?? null,
        tracking_number: trackNum,
        title: req.body.title,
        description: req.body.description ?? null,
        acceptance_criteria: req.body.acceptance_criteria ?? null,
        status: req.body.status ?? "draft",
        planning_status: req.body.planning_status ?? "high_level",
        estimated_hours: req.body.estimated_hours ?? null,
        owner_id: req.body.owner_id ?? null,
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        end_date: req.body.end_date ? new Date(req.body.end_date) : null,
        date_mode: req.body.date_mode ?? "manual",
        sort_order: (maxOrder[0]?.max ?? 0) + 10,
      }).returning();
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to create user story" }); }
  });

  router.put("/user-stories/:id", async (req: any, res: any) => {
    try {
      const row = await db.update(userStories).set({
        title: req.body.title,
        description: req.body.description ?? null,
        acceptance_criteria: req.body.acceptance_criteria ?? null,
        feature_id: req.body.feature_id ?? null,
        status: req.body.status,
        planning_status: req.body.planning_status,
        estimated_hours: req.body.estimated_hours ?? null,
        owner_id: req.body.owner_id ?? null,
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        end_date: req.body.end_date ? new Date(req.body.end_date) : null,
        date_mode: req.body.date_mode ?? "manual",
        sort_order: req.body.sort_order,
        updated_at: new Date(),
      }).where(and(eq(userStories.id, req.params.id), eq(userStories.project_id, req.params.projectId))).returning();
      if (!row.length) return res.status(404).json({ error: "User story not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update user story" }); }
  });

  router.delete("/user-stories/:id", async (req: any, res: any) => {
    try {
      await db.delete(userStories).where(and(eq(userStories.id, req.params.id), eq(userStories.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete user story" }); }
  });

  // ── Dependencies CRUD ─────────────────────────────────────────────────────
  router.get("/dependencies", async (req: any, res: any) => {
    try {
      const rows = await db.select().from(planningDependencies)
        .where(eq(planningDependencies.project_id, req.params.projectId))
        .orderBy(asc((planningDependencies as any).sort_order), asc(planningDependencies.created_at));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load dependencies" }); }
  });

  router.post("/dependencies", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const { source_id, source_type, target_id, target_type, dependency_type } = req.body;

      if (!source_id || !target_id) return res.status(400).json({ error: "source_id and target_id are required" });
      if (!source_type || !target_type) return res.status(400).json({ error: "source_type and target_type are required" });
      if (source_id === target_id) return res.status(400).json({ error: "An item cannot depend on itself" });

      // Validate that both items exist in this project (prevents cross-project IDOR)
      const [sourceOk, targetOk] = await Promise.all([
        itemBelongsToProject(source_id, source_type, projectId),
        itemBelongsToProject(target_id, target_type, projectId),
      ]);
      if (!sourceOk) return res.status(404).json({ error: "Source item not found in this project" });
      if (!targetOk) return res.status(404).json({ error: "Target item not found in this project" });

      // Duplicate check
      const existing = await db.select().from(planningDependencies)
        .where(and(
          eq(planningDependencies.project_id, projectId),
          eq(planningDependencies.source_id, source_id),
          eq(planningDependencies.target_id, target_id),
        ));
      if (existing.length > 0) return res.status(409).json({ error: "This dependency already exists" });

      // ── Load full hierarchy for validation ────────────────────────────────
      const [allDeps, phases, stages, milestones, fgs, features, stories] = await Promise.all([
        db.select().from(planningDependencies).where(eq(planningDependencies.project_id, projectId)),
        db.select().from(planningPhases).where(eq(planningPhases.project_id, projectId)),
        db.select().from(planningStages).where(eq(planningStages.project_id, projectId)),
        db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)),
        db.select().from(projectFeatureGroups).where(eq(projectFeatureGroups.project_id, projectId)),
        db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)),
        db.select().from(userStories).where(eq(userStories.project_id, projectId)),
      ]);

      const phaseMap  = new Map(phases.map(p => [p.id, p]));
      const stageMap  = new Map(stages.map(s => [s.id, s]));
      const msMap     = new Map(milestones.map(m => [m.id, m]));
      const fgMap     = new Map(fgs.map(f => [f.id, f]));
      const featMap   = new Map(features.map(f => [f.id, f]));
      const storyMap  = new Map(stories.map(s => [s.id, s]));

      const itemMap = new Map<string, any>([
        ...phases.map(p => [p.id, p] as [string, any]),
        ...stages.map(s => [s.id, s] as [string, any]),
        ...milestones.map(m => [m.id, m] as [string, any]),
        ...fgs.map(f => [f.id, f] as [string, any]),
        ...features.map(f => [f.id, f] as [string, any]),
        ...stories.map(s => [s.id, s] as [string, any]),
      ]);

      const getPhaseRank = (id: string, type: string): number | null => {
        if (type === "phase") return phaseMap.get(id)?.sort_order ?? null;
        if (type === "stage") {
          const s = stageMap.get(id) as any;
          return s?.phase_id ? phaseMap.get(s.phase_id)?.sort_order ?? null : null;
        }
        if (type === "milestone") {
          const m = msMap.get(id) as any;
          if (!m) return null;
          if (m.phase_id) return phaseMap.get(m.phase_id)?.sort_order ?? null;
          if (m.stage_id) { const st = stageMap.get(m.stage_id) as any; return st?.phase_id ? phaseMap.get(st.phase_id)?.sort_order ?? null : null; }
          return null;
        }
        if (type === "feature_group") {
          const fg = fgMap.get(id) as any;
          if (!fg) return null;
          if (fg.milestone_id) return getPhaseRank(fg.milestone_id, "milestone");
          if (fg.stage_id) return getPhaseRank(fg.stage_id, "stage");
          if (fg.phase_id) return phaseMap.get(fg.phase_id)?.sort_order ?? null;
          return null;
        }
        if (type === "feature") {
          const feat = featMap.get(id) as any;
          if (!feat) return null;
          if (feat.feature_group_id) return getPhaseRank(feat.feature_group_id, "feature_group");
          if (feat.stage_id) return getPhaseRank(feat.stage_id, "stage");
          if (feat.phase_id) return phaseMap.get(feat.phase_id)?.sort_order ?? null;
          return null;
        }
        if (type === "user_story") {
          const story = storyMap.get(id) as any;
          return story?.feature_id ? getPhaseRank(story.feature_id, "feature") : null;
        }
        return null;
      };

      const sourceRank = getPhaseRank(source_id, source_type ?? "");
      const targetRank = getPhaseRank(target_id, target_type ?? "");
      if (sourceRank !== null && targetRank !== null && targetRank > sourceRank) {
        const srcPhase = phases.find(p => p.sort_order === sourceRank);
        const tgtPhase = phases.find(p => p.sort_order === targetRank);
        return res.status(422).json({
          error: `Phase sequence violation: the predecessor belongs to "${tgtPhase?.name ?? "a later phase"}" which comes after "${srcPhase?.name ?? "this item's phase"}". A successor can only depend on items from the same or an earlier phase.`,
          code: "PHASE_SEQUENCE",
        });
      }

      // Circular dependency check (BFS)
      const reachable = new Set<string>();
      const queue = [target_id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const d of allDeps) {
          if (d.source_id === current && !reachable.has(d.target_id)) {
            reachable.add(d.target_id);
            queue.push(d.target_id);
          }
        }
      }
      if (reachable.has(source_id)) {
        return res.status(422).json({
          error: "Circular dependency: this relationship would create a loop. Remove an existing dependency in the chain first.",
          code: "CIRCULAR",
        });
      }

      const row = await db.insert(planningDependencies).values({
        project_id: projectId,
        source_type,
        source_id,
        target_type,
        target_id,
        dependency_type: dependency_type ?? "finish_to_start",
      }).returning();

      // Date conflict detection (soft warning, not blocking)
      const srcItem = itemMap.get(source_id);
      const tgtItem = itemMap.get(target_id);
      let date_conflict: string | null = null;
      if (srcItem && tgtItem) {
        const srcStart = srcItem.start_date ? new Date(srcItem.start_date) : null;
        const srcEnd   = srcItem.end_date   ? new Date(srcItem.end_date)   : null;
        const tgtStart = tgtItem.start_date ? new Date(tgtItem.start_date) : null;
        const tgtEnd   = tgtItem.end_date   ? new Date(tgtItem.end_date)   : null;
        const depKind  = dependency_type ?? "finish_to_start";
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        if (depKind === "finish_to_start") {
          if (srcStart && tgtEnd && srcStart < tgtEnd)
            date_conflict = `Date conflict: this item starts ${fmt(srcStart)} but the predecessor doesn't finish until ${fmt(tgtEnd)}.`;
        } else if (depKind === "start_to_start") {
          if (srcStart && tgtStart && srcStart < tgtStart)
            date_conflict = `Date conflict: this item starts ${fmt(srcStart)} before the predecessor starts ${fmt(tgtStart)}.`;
        } else if (depKind === "finish_to_finish") {
          if (srcEnd && tgtEnd && srcEnd < tgtEnd)
            date_conflict = `Date conflict: this item finishes ${fmt(srcEnd)} before the predecessor finishes ${fmt(tgtEnd)}.`;
        }
      }

      res.json({ ...row[0], date_conflict });
    } catch (err: any) { res.status(500).json({ error: "Failed to create dependency" }); }
  });

  router.delete("/dependencies/:id", async (req: any, res: any) => {
    try {
      await db.delete(planningDependencies).where(and(eq(planningDependencies.id, req.params.id), eq(planningDependencies.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete dependency" }); }
  });

  /** PATCH /dependencies/:id — update dependency_type inline without deleting the row */
  router.patch("/dependencies/:id", async (req: any, res: any) => {
    try {
      const { projectId, id } = req.params;
      const { dependency_type } = req.body;
      const allowed = ["finish_to_start", "start_to_start"];
      if (!dependency_type || !allowed.includes(dependency_type))
        return res.status(400).json({ error: "dependency_type must be finish_to_start or start_to_start" });
      const row = await db.update(planningDependencies)
        .set({ dependency_type })
        .where(and(eq(planningDependencies.id, id), eq(planningDependencies.project_id, projectId)))
        .returning();
      if (!row.length) return res.status(404).json({ error: "Dependency not found" });
      res.json(row[0]);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update dependency type" });
    }
  });

  /** PUT /dependencies/reorder — persist display sort_order from the Dependencies panel */
  router.put("/dependencies/reorder", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const { order } = req.body; // [{ id: string, sort_order: number }]
      if (!Array.isArray(order) || order.length === 0)
        return res.status(400).json({ error: "order must be a non-empty array of { id, sort_order } objects" });

      // Validate all deps belong to this project before touching any
      const ids = order.map((o: any) => o.id);
      const existing = await db.select({ id: planningDependencies.id })
        .from(planningDependencies)
        .where(and(eq(planningDependencies.project_id, projectId), inArray(planningDependencies.id, ids)));
      const validIds = new Set(existing.map(r => r.id));
      const invalid = ids.filter((id: string) => !validIds.has(id));
      if (invalid.length > 0)
        return res.status(404).json({ error: `Unknown dependency ids: ${invalid.join(", ")}` });

      await Promise.all(
        order.map((o: any) =>
          db.update(planningDependencies)
            .set({ sort_order: o.sort_order })
            .where(and(eq(planningDependencies.id, o.id), eq(planningDependencies.project_id, projectId)))
        )
      );
      res.json({ ok: true, updated: order.length });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to reorder dependencies" });
    }
  });

  // ── Unified quick-edit PATCH ──────────────────────────────────────────────
  router.patch("/quick-edit/:entityType/:id", async (req: any, res: any) => {
    try {
      const { projectId, entityType, id } = req.params;
      const body = req.body;

      const dateField = (v: any) => (v === null || v === "" ? null : new Date(v));
      const merge = (allowed: string[]) => {
        const u: Record<string, any> = { updated_at: new Date() };
        for (const f of allowed) {
          if (!(f in body)) continue;
          if (f === "start_date" || f === "end_date") u[f] = dateField(body[f]);
          else u[f] = body[f] === "" ? null : body[f];
        }
        return u;
      };

      const FIELDS = ["start_date", "end_date", "estimated_hours", "owner_id", "planning_status",
                      "phase_id", "stage_id", "milestone_id", "feature_group_id", "date_mode"];

      let row: any[];
      switch (entityType) {
        case "phase":
          row = await db.update(planningPhases).set(merge(FIELDS))
            .where(and(eq(planningPhases.id, id), eq(planningPhases.project_id, projectId))).returning();
          break;
        case "stage":
          row = await db.update(planningStages).set(merge(FIELDS))
            .where(and(eq(planningStages.id, id), eq(planningStages.project_id, projectId))).returning();
          break;
        case "milestone":
          row = await db.update(projectMilestones).set(merge(FIELDS))
            .where(and(eq(projectMilestones.id, id), eq(projectMilestones.project_id, projectId))).returning();
          break;
        case "feature_group":
          row = await db.update(projectFeatureGroups).set(merge(FIELDS))
            .where(and(eq(projectFeatureGroups.id, id), eq(projectFeatureGroups.project_id, projectId))).returning();
          break;
        case "feature":
          row = await db.update(projectFeatures).set(merge(FIELDS))
            .where(and(eq(projectFeatures.id, id), eq(projectFeatures.project_id, projectId))).returning();
          break;
        case "user_story":
          row = await db.update(userStories).set(merge(FIELDS))
            .where(and(eq(userStories.id, id), eq(userStories.project_id, projectId))).returning();
          break;
        default:
          return res.status(400).json({ error: `Unknown entity type: ${entityType}` });
      }
      if (!row.length) return res.status(404).json({ error: "Item not found" });
      res.json(row[0]);
    } catch (err: any) {
      console.error("Quick-edit PATCH error:", err);
      res.status(500).json({ error: "Failed to save" });
    }
  });

  // ── Planning entity patches (legacy — kept for NodeSheet compatibility) ────
  router.patch("/milestones/:id", async (req: any, res: any) => {
    try {
      const update: Record<string, any> = { updated_at: new Date() };
      const fields = ["phase_id", "stage_id", "planning_status", "estimated_hours", "owner_id",
                      "date_mode", "start_date", "end_date"];
      for (const f of fields) {
        if (req.body[f] !== undefined)
          update[f] = (f === "start_date" || f === "end_date") && req.body[f] ? new Date(req.body[f]) : req.body[f];
      }
      const row = await db.update(projectMilestones).set(update)
        .where(and(eq(projectMilestones.id, req.params.id), eq(projectMilestones.project_id, req.params.projectId)))
        .returning();
      if (!row.length) return res.status(404).json({ error: "Milestone not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update milestone planning" }); }
  });

  router.patch("/feature-groups/:id", async (req: any, res: any) => {
    try {
      const update: Record<string, any> = { updated_at: new Date() };
      const fields = ["phase_id", "stage_id", "milestone_id", "planning_status", "estimated_hours", "owner_id", "sort_order", "start_date", "end_date"];
      for (const f of fields) {
        if (req.body[f] !== undefined)
          update[f] = (f === "start_date" || f === "end_date") && req.body[f] ? new Date(req.body[f]) : req.body[f];
      }
      const row = await db.update(projectFeatureGroups).set(update)
        .where(and(eq(projectFeatureGroups.id, req.params.id), eq(projectFeatureGroups.project_id, req.params.projectId)))
        .returning();
      if (!row.length) return res.status(404).json({ error: "Feature group not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update feature group planning" }); }
  });

  router.patch("/features/:id", async (req: any, res: any) => {
    try {
      const update: Record<string, any> = { updated_at: new Date() };
      const fields = ["phase_id", "stage_id", "planning_status", "estimated_hours", "owner_id", "sort_order", "start_date", "end_date", "date_mode", "acceptance_criteria"];
      for (const f of fields) {
        if (req.body[f] !== undefined)
          update[f] = (f === "start_date" || f === "end_date") && req.body[f] ? new Date(req.body[f]) : req.body[f];
      }
      const row = await db.update(projectFeatures).set(update)
        .where(and(eq(projectFeatures.id, req.params.id), eq(projectFeatures.project_id, req.params.projectId)))
        .returning();
      if (!row.length) return res.status(404).json({ error: "Feature not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update feature planning" }); }
  });

  // ── AI Proposals ──────────────────────────────────────────────────────────
  router.post("/ai-propose", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const userId = getSessionUserId(req);
      const { scope_type, scope_id, prompt, context } = req.body;

      const [milestones, featureGroups, features, stories, phases, stages] = await Promise.all([
        db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)),
        db.select().from(projectFeatureGroups).where(eq(projectFeatureGroups.project_id, projectId)),
        db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)),
        db.select().from(userStories).where(eq(userStories.project_id, projectId)),
        db.select().from(planningPhases).where(eq(planningPhases.project_id, projectId)),
        db.select().from(planningStages).where(eq(planningStages.project_id, projectId)),
      ]);

      const aiSettings = await storage.getAiSettings();
      if (!aiSettings || !aiSettings.is_enabled || !aiSettings.api_key) {
        return res.status(403).json({ error: "AI is not enabled or configured. Please configure AI settings first.", ai_unavailable: true });
      }
      const decryptedKey = decryptApiKey(aiSettings.api_key);

      const systemPrompt = `You are a professional project planning assistant. You help project managers create detailed project plans.
You must return a valid JSON object only — no markdown, no prose, no code fences.

Existing project context:
- Phases: ${phases.length} (${phases.map(p => p.name).join(", ") || "none"})
- Stages: ${stages.length} (${stages.map(s => s.name).join(", ") || "none"})
- Milestones: ${milestones.length} (${milestones.map(m => m.name).join(", ") || "none"})
- Feature Groups: ${featureGroups.length} (${featureGroups.map(f => f.name).join(", ") || "none"})
- Features: ${features.length} (${features.map(f => f.name).join(", ") || "none"})
- User Stories: ${stories.length} (${stories.map(s => s.tracking_number + " " + s.title).join(", ") || "none"})

User wants to plan at scope: ${scope_type}${scope_id ? ` (id: ${scope_id})` : ""}

Return JSON exactly: { "summary": "one sentence summary", "found": { "description": "what already exists" }, "proposed": [ { "type": "phase|stage|milestone|feature_group|feature|user_story", "name": "...", "description": "...", "estimated_hours": null, "planning_status": "high_level", "parent_type": null, "parent_hint": null } ] }

Only propose items that do not already exist. Be precise and professional.`;

      const rawResponse = await callAiProvider(
        { provider: aiSettings.provider || "openai", apiKey: decryptedKey, model: aiSettings.model || "gpt-4o-mini", baseUrl: aiSettings.base_url ?? null },
        [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }]
      );

      let proposedItems: any[] = [];
      let summary = "AI proposal generated";
      let foundDesc: any = {};
      try {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (parsed) {
          proposedItems = parsed.proposed ?? [];
          summary = parsed.summary ?? summary;
          foundDesc = parsed.found ?? {};
        }
      } catch {
        proposedItems = [];
        summary = "AI response could not be parsed. Please try again with a more specific prompt.";
      }

      const [proposal] = await db.insert(planningAiProposals).values({
        project_id: projectId,
        scope_type: scope_type ?? "project",
        scope_id: scope_id ?? null,
        prompt,
        status: "pending_review",
        summary_json: { summary, found: foundDesc, count: proposedItems.length },
        created_by: userId,
      }).returning();

      if (proposedItems.length) {
        await db.insert(planningAiProposalItems).values(
          proposedItems.map((item: any, idx: number) => ({
            proposal_id: proposal.id,
            item_type: item.type,
            item_data: item,
            parent_type: item.parent_type ?? null,
            parent_id: null,
            action: "create",
            is_accepted: false,
            sort_order: idx,
          }))
        );
      }

      const items = await db.select().from(planningAiProposalItems).where(eq(planningAiProposalItems.proposal_id, proposal.id)).orderBy(asc(planningAiProposalItems.sort_order));
      res.json({ proposal, items });
    } catch (err: any) {
      console.error("AI proposal error:", err);
      res.status(500).json({ error: "Failed to generate AI proposal" });
    }
  });

  router.get("/ai-proposals/:id", async (req: any, res: any) => {
    try {
      const [proposal] = await db.select().from(planningAiProposals).where(eq(planningAiProposals.id, req.params.id));
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      const items = await db.select().from(planningAiProposalItems).where(eq(planningAiProposalItems.proposal_id, req.params.id)).orderBy(asc(planningAiProposalItems.sort_order));
      res.json({ proposal, items });
    } catch (err: any) { res.status(500).json({ error: "Failed to load proposal" }); }
  });

  router.put("/ai-proposals/:id/review", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const { accepted_item_ids, action } = req.body;

      if (action === "reject") {
        await db.update(planningAiProposals).set({ status: "rejected", updated_at: new Date() }).where(eq(planningAiProposals.id, req.params.id));
        return res.json({ ok: true });
      }

      const items = await db.select().from(planningAiProposalItems).where(eq(planningAiProposalItems.proposal_id, req.params.id)).orderBy(asc(planningAiProposalItems.sort_order));
      const toCommit = action === "accept_all" ? items : items.filter(i => (accepted_item_ids ?? []).includes(i.id));

      for (const item of toCommit) {
        const data = item.item_data as any;
        try {
          if (item.item_type === "phase") {
            const maxOrder = await db.select({ max: sql<number>`coalesce(max(sort_order),0)` }).from(planningPhases).where(eq(planningPhases.project_id, projectId));
            await db.insert(planningPhases).values({ project_id: projectId, name: data.name, description: data.description ?? null, sort_order: (maxOrder[0]?.max ?? 0) + 10, planning_status: data.planning_status ?? "high_level", estimated_hours: data.estimated_hours ?? null });
          } else if (item.item_type === "stage") {
            const maxOrder = await db.select({ max: sql<number>`coalesce(max(sort_order),0)` }).from(planningStages).where(eq(planningStages.project_id, projectId));
            await db.insert(planningStages).values({ project_id: projectId, name: data.name, description: data.description ?? null, sort_order: (maxOrder[0]?.max ?? 0) + 10, planning_status: data.planning_status ?? "high_level", estimated_hours: data.estimated_hours ?? null });
          } else if (item.item_type === "feature_group") {
            const cnt = await db.select({ c: sql<number>`count(*)` }).from(projectFeatureGroups).where(eq(projectFeatureGroups.project_id, projectId));
            const trackNum = `FG-${String((cnt[0]?.c ?? 0) + 1).padStart(3, "0")}`;
            await db.insert(projectFeatureGroups).values({ project_id: projectId, name: data.name, description: data.description ?? null, tracking_number: trackNum });
          } else if (item.item_type === "feature") {
            const cnt = await db.select({ c: sql<number>`count(*)` }).from(projectFeatures).where(eq(projectFeatures.project_id, projectId));
            const trackNum = `F-${String((cnt[0]?.c ?? 0) + 1).padStart(3, "0")}`;
            await db.insert(projectFeatures).values({ project_id: projectId, name: data.name, description: data.description ?? null, tracking_number: trackNum, status: "not_started", planning_status: data.planning_status ?? "high_level", estimated_hours: data.estimated_hours ?? null });
          } else if (item.item_type === "user_story") {
            const cnt = await db.select({ c: sql<number>`count(*)` }).from(userStories).where(eq(userStories.project_id, projectId));
            const trackNum = `US-${String((cnt[0]?.c ?? 0) + 1).padStart(3, "0")}`;
            const maxOrder = await db.select({ max: sql<number>`coalesce(max(sort_order),0)` }).from(userStories).where(eq(userStories.project_id, projectId));
            await db.insert(userStories).values({ project_id: projectId, tracking_number: trackNum, title: data.name ?? data.title, description: data.description ?? null, acceptance_criteria: data.acceptance_criteria ?? null, status: "draft", planning_status: data.planning_status ?? "high_level", estimated_hours: data.estimated_hours ?? null, sort_order: (maxOrder[0]?.max ?? 0) + 10 });
          }
          await db.update(planningAiProposalItems).set({ is_accepted: true }).where(eq(planningAiProposalItems.id, item.id));
        } catch (commitErr) {
          console.error("Failed to commit proposal item:", commitErr);
        }
      }

      await db.update(planningAiProposals).set({ status: "accepted", updated_at: new Date() }).where(eq(planningAiProposals.id, req.params.id));
      res.json({ ok: true, committed: toCommit.length });
    } catch (err: any) {
      console.error("Proposal review error:", err);
      res.status(500).json({ error: "Failed to process proposal" });
    }
  });

  router.patch("/ai-proposals/:proposalId/items/:itemId", async (req: any, res: any) => {
    try {
      const { itemId, proposalId, projectId } = req.params;
      // Verify proposal belongs to project
      const [proposal] = await db.select().from(planningAiProposals)
        .where(and(eq(planningAiProposals.id, proposalId), eq(planningAiProposals.project_id, projectId)));
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });

      // Bind itemId to proposalId to prevent cross-proposal IDOR
      const [current] = await db.select().from(planningAiProposalItems)
        .where(and(eq(planningAiProposalItems.id, itemId), eq(planningAiProposalItems.proposal_id, proposalId)));
      if (!current) return res.status(404).json({ error: "Item not found" });

      const existingData = (current.item_data as any) ?? {};
      const { name, title, description, estimated_hours, planning_status } = req.body;
      const updated = {
        ...existingData,
        ...(name !== undefined && { name }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(estimated_hours !== undefined && { estimated_hours: estimated_hours === "" ? null : Number(estimated_hours) }),
        ...(planning_status !== undefined && { planning_status }),
      };

      const [row] = await db.update(planningAiProposalItems)
        .set({ item_data: updated })
        .where(eq(planningAiProposalItems.id, itemId))
        .returning();
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update proposal item" });
    }
  });

  // ── PDF Export ─────────────────────────────────────────────────────────────
  router.get("/export/pdf", async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const PDFDocument = (await import("pdfkit")).default;

      const [projectRows, phases, stages, milestones, featureGroups, features, stories, deps, configRows] =
        await Promise.all([
          db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
          db.select().from(planningPhases).where(eq(planningPhases.project_id, projectId)).orderBy(asc(planningPhases.sort_order)),
          db.select().from(planningStages).where(eq(planningStages.project_id, projectId)).orderBy(asc(planningStages.sort_order)),
          db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)).orderBy(asc(projectMilestones.milestone_order)),
          db.select().from(projectFeatureGroups).where(eq(projectFeatureGroups.project_id, projectId)),
          db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)),
          db.select().from(userStories).where(eq(userStories.project_id, projectId)).orderBy(asc(userStories.sort_order)),
          db.select().from(planningDependencies).where(eq(planningDependencies.project_id, projectId)),
          db.select().from(planningMethodologyConfigs).where(eq(planningMethodologyConfigs.project_id, projectId)).limit(1),
        ]);

      const project = projectRows[0];
      if (!project) return res.status(404).json({ error: "Project not found" });
      const config = configRows[0];

      const allCoverageItems = [...phases, ...milestones, ...featureGroups, ...features, ...stories];
      const total = allCoverageItems.length;
      const weights: Record<string, number> = { high_level: 0.25, partially_planned: 0.60, detailed: 0.90, reviewed: 1.00 };
      const coveragePct = total === 0 ? 0 : Math.round(
        allCoverageItems.reduce((sum, i) => sum + (weights[(i as any).planning_status ?? "high_level"] ?? 0), 0) / total * 100
      );
      const totalEffort = [...phases, ...stages, ...milestones, ...featureGroups, ...features, ...stories]
        .reduce((s, i) => s + ((i as any).estimated_hours ?? 0), 0);

      const METHODOLOGY_LABELS: Record<string, string> = {
        manual: "Manual", complexity_based: "Complexity Based", component_based: "Component Based",
        function_point: "Function Point Analysis", story_point: "Story Point Based",
        historical: "Historical Data Based", custom: "Custom",
      };
      const STATUS_LABELS: Record<string, string> = {
        high_level: "High Level", partially_planned: "Partially Planned", detailed: "Detailed", reviewed: "Reviewed",
      };
      const DEP_TYPE_LABELS: Record<string, string> = { finish_to_start: "Finish → Start", start_to_start: "Start → Start" };

      const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
      const fmtHours = (h: any) => h ? `${h}h` : "—";

      const allItems = new Map<string, string>();
      phases.forEach(p => allItems.set(p.id, `Phase: ${p.name}`));
      stages.forEach(s => allItems.set(s.id, `Stage: ${s.name}`));
      milestones.forEach(m => allItems.set(m.id, `Milestone: ${m.name}`));
      featureGroups.forEach(fg => allItems.set(fg.id, `FG: ${fg.name}`));
      features.forEach(f => allItems.set(f.id, `Feature: ${f.name}`));
      stories.forEach(s => allItems.set(s.id, `Story: ${s.tracking_number} ${s.title}`));

      const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));

      const PAGE_W = doc.page.width - 100;
      const C = { primary: "#1e3a5f", accent: "#2563eb", muted: "#64748b", light: "#e2e8f0", warn: "#b45309", green: "#15803d" };

      const heading1 = (text: string) => {
        doc.addPage();
        doc.rect(50, 50, PAGE_W, 32).fill(C.primary);
        doc.fillColor("white").fontSize(14).font("Helvetica-Bold").text(text, 60, 60, { width: PAGE_W - 20 });
        doc.fillColor("black").moveDown(0.5);
      };

      const planningTag = (status: string) => {
        const labels: Record<string, string> = { high_level: "[High Level]", partially_planned: "[Partial]", detailed: "[Detailed]", reviewed: "[Reviewed]" };
        return labels[status] ?? "[?]";
      };

      const divider = () => {
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(50 + PAGE_W, doc.y).strokeColor(C.light).lineWidth(0.5).stroke();
        doc.moveDown(0.3).strokeColor("black").lineWidth(1);
      };

      // COVER PAGE
      doc.rect(0, 0, doc.page.width, 200).fill(C.primary);
      doc.fillColor("white").fontSize(24).font("Helvetica-Bold").text("Project Plan", 50, 80, { width: PAGE_W });
      doc.fontSize(16).font("Helvetica").text((project as any).name ?? "Untitled Project", 50, 120, { width: PAGE_W });
      doc.fontSize(9).fillColor("#94a3b8").text(`Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, 50, 155);
      doc.fillColor("black").moveDown(6);

      doc.rect(50, 215, PAGE_W, 120).fillAndStroke("#f8fafc", C.light);
      const mx = 65;
      doc.fillColor(C.muted).fontSize(8).font("Helvetica-Bold").text("PROJECT STATUS", mx, 228);
      doc.fillColor("black").fontSize(10).font("Helvetica").text((project as any).status?.replace("_", " ") ?? "—", mx, 242);
      doc.fillColor(C.muted).fontSize(8).font("Helvetica-Bold").text("PLANNING METHODOLOGY", mx, 262);
      doc.fillColor("black").fontSize(10).font("Helvetica").text(METHODOLOGY_LABELS[config?.methodology ?? "manual"], mx, 276);
      doc.fillColor(C.muted).fontSize(8).font("Helvetica-Bold").text("PLANNING COVERAGE", mx + 200, 228);
      doc.fillColor(coveragePct >= 80 ? C.green : coveragePct >= 50 ? C.warn : C.muted).fontSize(22).font("Helvetica-Bold").text(`${coveragePct}%`, mx + 200, 240);
      doc.fillColor(C.muted).fontSize(8).font("Helvetica-Bold").text("TOTAL EFFORT ESTIMATE", mx + 200, 275);
      doc.fillColor("black").fontSize(10).font("Helvetica").text(fmtHours(totalEffort), mx + 200, 287);

      // SECTION 1 – EXECUTIVE SUMMARY
      heading1("1. Executive Summary");
      doc.fontSize(9).font("Helvetica").fillColor("black")
         .text(`This document presents the project plan for ${(project as any).name ?? "this project"} as of ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}. The plan was developed using the ${METHODOLOGY_LABELS[config?.methodology ?? "manual"]} methodology and reflects the current state of planning across all hierarchy levels.`,
          50, doc.y, { width: PAGE_W });
      doc.moveDown(0.8);

      const statusCounts: Record<string, number> = { high_level: 0, partially_planned: 0, detailed: 0, reviewed: 0 };
      allCoverageItems.forEach(i => { const s = (i as any).planning_status ?? "high_level"; statusCounts[s] = (statusCounts[s] ?? 0) + 1; });
      const summaryRows = [
        ["Entity Type", "Count", ""],
        ["Phases",         String(phases.length),         ""],
        ["Stages",         String(stages.length),         ""],
        ["Milestones",     String(milestones.length),     ""],
        ["Feature Groups", String(featureGroups.length),  ""],
        ["Features",       String(features.length),       ""],
        ["User Stories",   String(stories.length),        ""],
        ["Dependencies",   String(deps.length),           ""],
      ];

      const colW = [PAGE_W * 0.5, PAGE_W * 0.25, PAGE_W * 0.25];
      let tableY = doc.y;
      summaryRows.forEach((r, ri) => {
        if (tableY > doc.page.height - 80) { doc.addPage(); tableY = 60; }
        const rowH = 18;
        if (ri === 0) doc.rect(50, tableY, PAGE_W, rowH).fill(C.primary);
        else doc.rect(50, tableY, PAGE_W, rowH).fill(ri % 2 === 0 ? "#f8fafc" : "white");
        const textY = tableY + 5;
        r.forEach((cell, ci) => {
          const x = 50 + colW.slice(0, ci).reduce((a, b) => a + b, 0);
          doc.fillColor(ri === 0 ? "white" : "black").fontSize(8).font(ri === 0 ? "Helvetica-Bold" : "Helvetica")
             .text(cell, x + 4, textY, { width: colW[ci] - 8, ellipsis: true });
        });
        tableY += rowH;
      });
      doc.y = tableY + 8;

      // SECTION 2 – COVERAGE BREAKDOWN
      heading1("2. Planning Coverage Breakdown");
      doc.fontSize(9).font("Helvetica").text(
        "Planning coverage measures the depth of planning across all items. High Level = 25%, Partially Planned = 60%, Detailed = 90%, Reviewed = 100% weight.",
        50, doc.y, { width: PAGE_W });
      doc.moveDown(0.6);
      Object.entries(statusCounts).forEach(([k, count]) => {
        if (count === 0) return;
        const pct = total > 0 ? Math.round(count / total * 100) : 0;
        const barW = Math.round((PAGE_W - 160) * pct / 100);
        const y = doc.y;
        doc.fontSize(8).font("Helvetica").fillColor(C.muted).text(STATUS_LABELS[k] ?? k, 50, y, { width: 120 });
        doc.rect(175, y + 1, barW, 8).fill(k === "reviewed" ? C.green : k === "detailed" ? C.accent : k === "partially_planned" ? C.warn : C.muted);
        doc.fillColor("black").text(`${count} (${pct}%)`, 180 + barW + 4, y);
        doc.moveDown(0.5);
      });

      // SECTION 3 – PROJECT STRUCTURE
      heading1("3. Project Structure");
      const printItem = (label: string, item: any, depth: number) => {
        if (doc.y > doc.page.height - 70) doc.addPage();
        const indent = 50 + depth * 16;
        const status = (item as any).planning_status ?? "high_level";
        const statusStr = planningTag(status);
        const effortStr = (item as any).estimated_hours ? ` · ${(item as any).estimated_hours}h` : "";
        const dateStr = (item as any).start_date || (item as any).end_date
          ? ` · ${fmtDate((item as any).start_date)} → ${fmtDate((item as any).end_date)}` : "";
        const name = (item as any).name ?? (item as any).title ?? "—";
        const lineColor = status === "reviewed" ? C.green : status === "detailed" ? C.accent : status === "partially_planned" ? C.warn : C.muted;
        doc.rect(indent - 4, doc.y - 1, 3, 12).fill(lineColor);
        doc.fontSize(depth === 0 ? 10 : 8.5).font(depth === 0 ? "Helvetica-Bold" : "Helvetica").fillColor("black")
           .text(`${label}: ${name}`, indent + 4, doc.y, { width: PAGE_W - (indent - 46), continued: false });
        doc.fontSize(7.5).fillColor(C.muted).text(`  ${statusStr}${effortStr}${dateStr}`, indent + 4);
        if ((item as any).description)
          doc.fontSize(7.5).fillColor(C.muted).text((item as any).description.slice(0, 200), indent + 4, doc.y, { width: PAGE_W - (indent - 46) });
        doc.fillColor("black").moveDown(0.15);
      };

      if (phases.length === 0 && stages.length === 0 && milestones.length === 0) {
        doc.fontSize(9).font("Helvetica").fillColor(C.muted).text("No planning items have been created yet.", 50, doc.y);
      } else {
        const ungroupedMilestones = milestones.filter(m => !(m as any).phase_id && !(m as any).stage_id);
        const ungroupedFGs = featureGroups.filter(fg => !(fg as any).phase_id && !(fg as any).stage_id && !(fg as any).milestone_id);
        for (const phase of phases) {
          printItem("Phase", phase, 0);
          for (const stage of stages.filter(s => (s as any).phase_id === phase.id)) {
            printItem("Stage", stage, 1);
            for (const ms of milestones.filter(m => (m as any).stage_id === stage.id)) {
              printItem("Milestone", ms, 2);
              for (const fg of featureGroups.filter(fg => (fg as any).milestone_id === ms.id)) {
                printItem("Feature Group", fg, 3);
                for (const f of features.filter(f => (f as any).feature_group_id === fg.id)) {
                  printItem("Feature", f, 4);
                  for (const s of stories.filter(s => (s as any).feature_id === f.id)) printItem("User Story", s, 5);
                }
              }
              for (const fg of featureGroups.filter(fg => (fg as any).stage_id === stage.id && !(fg as any).milestone_id)) {
                printItem("Feature Group", fg, 2);
                for (const f of features.filter(f => (f as any).feature_group_id === fg.id)) {
                  printItem("Feature", f, 3);
                  for (const s of stories.filter(s => (s as any).feature_id === f.id)) printItem("User Story", s, 4);
                }
              }
            }
          }
          for (const ms of milestones.filter(m => (m as any).phase_id === phase.id && !(m as any).stage_id)) {
            printItem("Milestone", ms, 1);
            for (const fg of featureGroups.filter(fg => (fg as any).milestone_id === ms.id)) {
              printItem("Feature Group", fg, 2);
              for (const f of features.filter(f => (f as any).feature_group_id === fg.id)) {
                printItem("Feature", f, 3);
                for (const s of stories.filter(s => (s as any).feature_id === f.id)) printItem("User Story", s, 4);
              }
            }
          }
        }
        for (const stage of stages.filter(s => !(s as any).phase_id)) {
          printItem("Stage", stage, 0);
          for (const ms of milestones.filter(m => (m as any).stage_id === stage.id)) printItem("Milestone", ms, 1);
        }
        for (const ms of ungroupedMilestones) {
          printItem("Milestone", ms, 0);
          for (const fg of featureGroups.filter(fg => (fg as any).milestone_id === ms.id)) {
            printItem("Feature Group", fg, 1);
            for (const f of features.filter(f => (f as any).feature_group_id === fg.id)) {
              printItem("Feature", f, 2);
              for (const s of stories.filter(s => (s as any).feature_id === f.id)) printItem("User Story", s, 3);
            }
          }
        }
        for (const fg of ungroupedFGs) {
          printItem("Feature Group", fg, 0);
          for (const f of features.filter(f => (f as any).feature_group_id === fg.id)) {
            printItem("Feature", f, 1);
            for (const s of stories.filter(s => (s as any).feature_id === f.id)) printItem("User Story", s, 2);
          }
        }
        for (const f of features.filter(f => !(f as any).feature_group_id)) {
          printItem("Feature", f, 0);
          for (const s of stories.filter(s => (s as any).feature_id === f.id)) printItem("User Story", s, 1);
        }
      }

      // SECTION 4 – EFFORT SUMMARY
      heading1("4. Effort Summary");
      const effortTable = [
        ["Entity Type", "Count", "Total Estimated Hours"],
        ["Phases",         String(phases.length),        String(phases.reduce((s, i) => s + ((i as any).estimated_hours ?? 0), 0))],
        ["Stages",         String(stages.length),        String(stages.reduce((s, i) => s + ((i as any).estimated_hours ?? 0), 0))],
        ["Milestones",     String(milestones.length),    String(milestones.reduce((s, i) => s + ((i as any).estimated_hours ?? 0), 0))],
        ["Feature Groups", String(featureGroups.length), String(featureGroups.reduce((s, i) => s + ((i as any).estimated_hours ?? 0), 0))],
        ["Features",       String(features.length),      String(features.reduce((s, i) => s + ((i as any).estimated_hours ?? 0), 0))],
        ["User Stories",   String(stories.length),       String(stories.reduce((s, i) => s + ((i as any).estimated_hours ?? 0), 0))],
        ["TOTAL",          "—",                          String(totalEffort)],
      ];
      let etY = doc.y;
      const ecW = [PAGE_W * 0.45, PAGE_W * 0.2, PAGE_W * 0.35];
      effortTable.forEach((r, ri) => {
        if (etY > doc.page.height - 80) { doc.addPage(); etY = 60; }
        const rH = 18;
        const isTotal = ri === effortTable.length - 1;
        doc.rect(50, etY, PAGE_W, rH).fill(ri === 0 ? C.primary : isTotal ? C.accent : ri % 2 === 0 ? "#f8fafc" : "white");
        const tY = etY + 5;
        r.forEach((cell, ci) => {
          const x = 50 + ecW.slice(0, ci).reduce((a, b) => a + b, 0);
          doc.fillColor(ri === 0 || isTotal ? "white" : "black").fontSize(8).font(ri === 0 || isTotal ? "Helvetica-Bold" : "Helvetica")
             .text(cell, x + 4, tY, { width: ecW[ci] - 8 });
        });
        etY += rH;
      });
      doc.y = etY + 8;

      // SECTION 5 – DEPENDENCIES
      if (deps.length > 0) {
        heading1("5. Dependencies");
        doc.fontSize(9).font("Helvetica").text(
          `${deps.length} dependency relationship${deps.length === 1 ? "" : "s"} defined across this project plan.`,
          50, doc.y, { width: PAGE_W });
        doc.moveDown(0.5);
        const dCols = [PAGE_W * 0.38, PAGE_W * 0.24, PAGE_W * 0.38];
        const dHeader = ["Dependent Item", "Type", "Predecessor (must complete first)"];
        let dY = doc.y;
        const printDRow = (r: string[], ri: number) => {
          if (dY > doc.page.height - 80) { doc.addPage(); dY = 60; }
          const rH = 18;
          doc.rect(50, dY, PAGE_W, rH).fill(ri === 0 ? C.primary : ri % 2 === 0 ? "#f8fafc" : "white");
          const tY = dY + 5;
          r.forEach((cell, ci) => {
            const x = 50 + dCols.slice(0, ci).reduce((a, b) => a + b, 0);
            doc.fillColor(ri === 0 ? "white" : "black").fontSize(7.5).font(ri === 0 ? "Helvetica-Bold" : "Helvetica")
               .text(cell, x + 4, tY, { width: dCols[ci] - 8, ellipsis: true });
          });
          dY += rH;
        };
        printDRow(dHeader, 0);
        deps.forEach((d, i) => {
          printDRow([
            allItems.get(d.source_id) ?? d.source_id.slice(0, 8),
            DEP_TYPE_LABELS[d.dependency_type ?? "finish_to_start"] ?? d.dependency_type,
            allItems.get(d.target_id) ?? d.target_id.slice(0, 8),
          ], i + 1);
        });
        doc.y = dY + 8;
      }

      // SECTION 6 – PLANNING NOTES
      if (config?.notes) {
        heading1(deps.length > 0 ? "6. Planning Notes" : "5. Planning Notes");
        doc.fontSize(9).font("Helvetica").fillColor("black").text(config.notes, 50, doc.y, { width: PAGE_W });
      }

      // Page numbers
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor(C.muted)
           .text(`${(project as any).name ?? "Project Plan"}  ·  Page ${i + 1} of ${totalPages}  ·  CONFIDENTIAL`,
            50, doc.page.height - 35, { width: PAGE_W, align: "center" });
      }

      doc.end();
      await new Promise<void>((resolve, reject) => { doc.on("end", resolve); doc.on("error", reject); });

      const pdfBuffer = Buffer.concat(chunks);
      const filename = `project-plan-${((project as any).name ?? "export").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("PDF export error:", err);
      res.status(500).json({ error: "Failed to generate PDF: " + err.message });
    }
  });

  // Mount the router — every route above gets requireAuth + requireProjectMember
  app.use("/api/projects/:projectId/planning", router);
}
