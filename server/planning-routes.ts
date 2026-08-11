/**
 * Planning Module API Routes
 * All routes are mounted under /api/projects/:projectId/planning
 */
import type { Express } from "express";
import { db } from "./db";
import { eq, and, asc, sql } from "drizzle-orm";
import {
  planningPhases, planningStages, userStories, planningDependencies,
  planningMethodologyConfigs, planningAiProposals, planningAiProposalItems,
  projectMilestones, projectFeatureGroups, projectFeatures, projects, users,
} from "@shared/schema";
import { callAiProvider, decryptApiKey } from "./ai-provider";
import { storage } from "./storage";

const requireAuth = async (req: any, res: any, next: any) => {
  if (!req.headers["x-user-id"]) return res.status(401).json({ error: "Authentication required" });
  next();
};

export function registerPlanningRoutes(app: Express) {

  // ── Planning Tree (single call fetches entire hierarchy) ──────────────────
  app.get("/api/projects/:projectId/planning/tree", requireAuth, async (req, res) => {
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
          db.select().from(planningDependencies).where(eq(planningDependencies.project_id, projectId)),
          db.select().from(planningMethodologyConfigs).where(eq(planningMethodologyConfigs.project_id, projectId)).limit(1),
        ]);
      res.json({ phases, stages, milestones, featureGroups, features, stories, dependencies: deps, config: config[0] ?? null });
    } catch (err: any) {
      console.error("Planning tree error:", err);
      res.status(500).json({ error: "Failed to load planning tree" });
    }
  });

  // ── Planning Coverage ─────────────────────────────────────────────────────
  app.get("/api/projects/:projectId/planning/coverage", requireAuth, async (req, res) => {
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
  app.get("/api/projects/:projectId/planning/config", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const rows = await db.select().from(planningMethodologyConfigs).where(eq(planningMethodologyConfigs.project_id, projectId)).limit(1);
      res.json(rows[0] ?? null);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load config" });
    }
  });

  app.put("/api/projects/:projectId/planning/config", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.headers["x-user-id"] as string;
      const { methodology, methodology_version, config_snapshot, notes } = req.body;
      const existing = await db.select().from(planningMethodologyConfigs).where(eq(planningMethodologyConfigs.project_id, projectId)).limit(1);
      if (existing.length) {
        const updated = await db.update(planningMethodologyConfigs).set({
          methodology, methodology_version: methodology_version ?? "1.0",
          config_snapshot, notes, updated_at: new Date(),
        }).where(eq(planningMethodologyConfigs.id, existing[0].id)).returning();
        // Also update projects table
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
  app.get("/api/projects/:projectId/planning/phases", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(planningPhases).where(eq(planningPhases.project_id, req.params.projectId)).orderBy(asc(planningPhases.sort_order));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load phases" }); }
  });

  app.post("/api/projects/:projectId/planning/phases", requireAuth, async (req, res) => {
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

  app.put("/api/projects/:projectId/planning/phases/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/projects/:projectId/planning/phases/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(planningPhases).where(and(eq(planningPhases.id, req.params.id), eq(planningPhases.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete phase" }); }
  });

  // ── Stages CRUD ───────────────────────────────────────────────────────────
  app.get("/api/projects/:projectId/planning/stages", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(planningStages).where(eq(planningStages.project_id, req.params.projectId)).orderBy(asc(planningStages.sort_order));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load stages" }); }
  });

  app.post("/api/projects/:projectId/planning/stages", requireAuth, async (req, res) => {
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

  app.put("/api/projects/:projectId/planning/stages/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/projects/:projectId/planning/stages/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(planningStages).where(and(eq(planningStages.id, req.params.id), eq(planningStages.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete stage" }); }
  });

  // ── User Stories CRUD ─────────────────────────────────────────────────────
  app.get("/api/projects/:projectId/planning/user-stories", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(userStories).where(eq(userStories.project_id, req.params.projectId)).orderBy(asc(userStories.sort_order));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load user stories" }); }
  });

  app.post("/api/projects/:projectId/planning/user-stories", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      // Generate tracking number
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

  app.put("/api/projects/:projectId/planning/user-stories/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/projects/:projectId/planning/user-stories/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(userStories).where(and(eq(userStories.id, req.params.id), eq(userStories.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete user story" }); }
  });

  // ── Dependencies CRUD ─────────────────────────────────────────────────────
  app.get("/api/projects/:projectId/planning/dependencies", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(planningDependencies).where(eq(planningDependencies.project_id, req.params.projectId));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: "Failed to load dependencies" }); }
  });

  app.post("/api/projects/:projectId/planning/dependencies", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { source_id, source_type, target_id, target_type, dependency_type } = req.body;

      if (!source_id || !target_id) return res.status(400).json({ error: "source_id and target_id are required" });
      if (source_id === target_id) return res.status(400).json({ error: "An item cannot depend on itself" });

      // Duplicate check
      const existing = await db.select().from(planningDependencies)
        .where(and(
          eq(planningDependencies.project_id, projectId),
          eq(planningDependencies.source_id, source_id),
          eq(planningDependencies.target_id, target_id),
        ));
      if (existing.length > 0) return res.status(409).json({ error: "This dependency already exists" });

      // Circular dependency check — BFS from target; if we can reach source, adding this dep would create a cycle
      const allDeps = await db.select().from(planningDependencies).where(eq(planningDependencies.project_id, projectId));
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
        return res.status(422).json({ error: "This dependency would create a circular chain. Remove an existing dependency in the cycle first." });
      }

      const row = await db.insert(planningDependencies).values({
        project_id: projectId,
        source_type,
        source_id,
        target_type,
        target_id,
        dependency_type: dependency_type ?? "finish_to_start",
      }).returning();
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to create dependency" }); }
  });

  app.delete("/api/projects/:projectId/planning/dependencies/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(planningDependencies).where(and(eq(planningDependencies.id, req.params.id), eq(planningDependencies.project_id, req.params.projectId)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: "Failed to delete dependency" }); }
  });

  // ── Planning enhancements on milestones ───────────────────────────────────
  // Patch milestone with planning fields
  app.patch("/api/projects/:projectId/planning/milestones/:id", requireAuth, async (req, res) => {
    try {
      const update: Record<string, any> = { updated_at: new Date() };
      if (req.body.phase_id !== undefined) update.phase_id = req.body.phase_id;
      if (req.body.stage_id !== undefined) update.stage_id = req.body.stage_id;
      if (req.body.planning_status !== undefined) update.planning_status = req.body.planning_status;
      if (req.body.estimated_hours !== undefined) update.estimated_hours = req.body.estimated_hours;
      if (req.body.owner_id !== undefined) update.owner_id = req.body.owner_id;
      if (req.body.date_mode !== undefined) update.date_mode = req.body.date_mode;
      const row = await db.update(projectMilestones).set(update)
        .where(and(eq(projectMilestones.id, req.params.id), eq(projectMilestones.project_id, req.params.projectId)))
        .returning();
      if (!row.length) return res.status(404).json({ error: "Milestone not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update milestone planning" }); }
  });

  // Patch feature group with planning fields
  app.patch("/api/projects/:projectId/planning/feature-groups/:id", requireAuth, async (req, res) => {
    try {
      const update: Record<string, any> = { updated_at: new Date() };
      const fields = ["phase_id", "stage_id", "milestone_id", "planning_status", "estimated_hours", "owner_id", "sort_order", "start_date", "end_date"];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          update[f] = (f === "start_date" || f === "end_date") && req.body[f] ? new Date(req.body[f]) : req.body[f];
        }
      }
      const row = await db.update(projectFeatureGroups).set(update)
        .where(and(eq(projectFeatureGroups.id, req.params.id), eq(projectFeatureGroups.project_id, req.params.projectId)))
        .returning();
      if (!row.length) return res.status(404).json({ error: "Feature group not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update feature group planning" }); }
  });

  // Patch feature with planning fields
  app.patch("/api/projects/:projectId/planning/features/:id", requireAuth, async (req, res) => {
    try {
      const update: Record<string, any> = { updated_at: new Date() };
      const fields = ["phase_id", "stage_id", "planning_status", "estimated_hours", "owner_id", "sort_order", "start_date", "end_date", "date_mode", "acceptance_criteria"];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          update[f] = (f === "start_date" || f === "end_date") && req.body[f] ? new Date(req.body[f]) : req.body[f];
        }
      }
      const row = await db.update(projectFeatures).set(update)
        .where(and(eq(projectFeatures.id, req.params.id), eq(projectFeatures.project_id, req.params.projectId)))
        .returning();
      if (!row.length) return res.status(404).json({ error: "Feature not found" });
      res.json(row[0]);
    } catch (err: any) { res.status(500).json({ error: "Failed to update feature planning" }); }
  });

  // ── AI Proposals ──────────────────────────────────────────────────────────
  app.post("/api/projects/:projectId/planning/ai-propose", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.headers["x-user-id"] as string;
      const { scope_type, scope_id, prompt, context } = req.body;

      // Gather existing context
      const [milestones, featureGroups, features, stories, phases, stages] = await Promise.all([
        db.select().from(projectMilestones).where(eq(projectMilestones.project_id, projectId)),
        db.select().from(projectFeatureGroups).where(eq(projectFeatureGroups.project_id, projectId)),
        db.select().from(projectFeatures).where(eq(projectFeatures.project_id, projectId)),
        db.select().from(userStories).where(eq(userStories.project_id, projectId)),
        db.select().from(planningPhases).where(eq(planningPhases.project_id, projectId)),
        db.select().from(planningStages).where(eq(planningStages.project_id, projectId)),
      ]);

      // Fetch AI settings
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

      // Create the proposal record
      const [proposal] = await db.insert(planningAiProposals).values({
        project_id: projectId,
        scope_type: scope_type ?? "project",
        scope_id: scope_id ?? null,
        prompt,
        status: "pending_review",
        summary_json: { summary, found: foundDesc, count: proposedItems.length },
        created_by: userId,
      }).returning();

      // Create proposal items
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

  // Get proposal with items
  app.get("/api/projects/:projectId/planning/ai-proposals/:id", requireAuth, async (req, res) => {
    try {
      const [proposal] = await db.select().from(planningAiProposals).where(eq(planningAiProposals.id, req.params.id));
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      const items = await db.select().from(planningAiProposalItems).where(eq(planningAiProposalItems.proposal_id, req.params.id)).orderBy(asc(planningAiProposalItems.sort_order));
      res.json({ proposal, items });
    } catch (err: any) { res.status(500).json({ error: "Failed to load proposal" }); }
  });

  // Accept / reject proposal items
  app.put("/api/projects/:projectId/planning/ai-proposals/:id/review", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { accepted_item_ids, action } = req.body; // action: 'accept_all' | 'accept_selected' | 'reject'

      if (action === "reject") {
        await db.update(planningAiProposals).set({ status: "rejected", updated_at: new Date() }).where(eq(planningAiProposals.id, req.params.id));
        return res.json({ ok: true });
      }

      const items = await db.select().from(planningAiProposalItems).where(eq(planningAiProposalItems.proposal_id, req.params.id)).orderBy(asc(planningAiProposalItems.sort_order));
      const toCommit = action === "accept_all" ? items : items.filter(i => (accepted_item_ids ?? []).includes(i.id));

      // Commit accepted items to production tables
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
}
