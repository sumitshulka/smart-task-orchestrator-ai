---
name: Planning Module Architecture
description: Architecture decisions and patterns for the Tazq Planning module added to the Project Management section.
---

## What was built
A full Planning module added as a new sidebar section ("Planning") inside the existing `ProjectDetail.tsx` layout. No existing sections were broken.

## Database — new tables (applied via `scripts/migrate-planning.ts`)
- `planning_phases` — optional top-level hierarchy containers
- `planning_stages` — sub-phase containers (phase_id nullable)
- `user_stories` — new entity, linked to project_features (feature_id nullable)
- `planning_dependencies` — cross-entity dependency links (source/target type+id polymorphic)
- `planning_methodology_configs` — per-project methodology config + version snapshot
- `planning_ai_proposals` — AI staging records (never auto-commit)
- `planning_ai_proposal_items` — individual proposal items (is_accepted controls commit)

## Database — columns added to existing tables (additive, no breakage)
- `projects`: `planning_methodology`, `planning_version`
- `project_milestones`: `phase_id`, `stage_id`, `planning_status`, `estimated_hours`, `owner_id`, `date_mode`
- `project_feature_groups`: `phase_id`, `stage_id`, `milestone_id`, `planning_status`, `estimated_hours`, `owner_id`, `sort_order`, `start_date`, `end_date`
- `project_features`: `phase_id`, `stage_id`, `planning_status`, `estimated_hours`, `owner_id`, `sort_order`, `start_date`, `end_date`, `date_mode`, `acceptance_criteria`

## Migration pattern
New tables and column additions are applied via `npx tsx scripts/migrate-planning.ts` + `npx tsx scripts/migrate-planning-fks.ts`. Do NOT use `npm run db:push` for this project — it gets stuck on an interactive prompt about the tasks table unique constraint. Always use the migration scripts or raw SQL via the pool.

**Why:** `drizzle-kit push` is interactive and blocks on the `tasks_task_number_unique` constraint confirmation. The tsx migration scripts bypass this and apply changes directly.

## Server routes
All planning routes in `server/planning-routes.ts`, registered via `registerPlanningRoutes(app)` at end of `server/routes.ts`. All routes are under `/api/projects/:projectId/planning/`.

## callAiProvider signature
`callAiProvider(config: { provider, apiKey, model, baseUrl }, messages: ChatMessage[]): Promise<string>` — returns a plain string, NOT an object. Always fetch AI settings from `storage.getAiSettings()` first, decrypt key with `decryptApiKey()`.

**Why:** Planning routes initially called it wrong (with a single object + .content access). Fixed to match the actual signature.

## Frontend
- `client/src/components/planning/PlanningWorkspace.tsx` — full self-contained planning UI (~1200 lines)
- Added `Network` icon import + `PlanningWorkspace` import to `ProjectDetail.tsx`
- Planning nav item inserted second in sidebar (after Overview)
- Planning section div uses `overflow-hidden flex flex-col` instead of padding/overflow-auto (to allow PlanningWorkspace to own its own scroll)

## Planning Coverage algorithm
Weighted sum: high_level=0.25, partially_planned=0.6, detailed=0.9, reviewed=1.0. Applies to all planning entities. Displayed separately from execution progress with explicit "Planning Coverage ≠ Execution Progress" label.

## AI proposal flow
1. PM triggers AI via `AiPlanningPanel` → POST `/planning/ai-propose`
2. Server builds system prompt with existing context, calls AI, parses JSON response
3. Creates `planning_ai_proposals` + `planning_ai_proposal_items` records
4. `AiProposalReview` component shows proposal with checkboxes per item
5. PM accepts/rejects → PUT `/planning/ai-proposals/:id/review` → commits accepted items to production tables

## Not yet built (follow-up tasks)
- PDF export (Step 10 in spec)
- Methodology implementations beyond Manual (Step 11)
- Finance integration interfaces
- `Collapsible` import in PlanningWorkspace is imported but not used (can be removed)
