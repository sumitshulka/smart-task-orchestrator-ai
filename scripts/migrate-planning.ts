/**
 * Planning module migration — adds new tables and planning columns to existing tables.
 * Run with: npx tsx scripts/migrate-planning.ts
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

const migrations = [
  // ── Add planning columns to projects ─────────────────────────────────────
  `ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS planning_methodology text DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS planning_version integer DEFAULT 1`,

  // ── Add planning columns to project_milestones ────────────────────────────
  `ALTER TABLE project_milestones
    ADD COLUMN IF NOT EXISTS phase_id uuid,
    ADD COLUMN IF NOT EXISTS stage_id uuid,
    ADD COLUMN IF NOT EXISTS planning_status text DEFAULT 'high_level',
    ADD COLUMN IF NOT EXISTS estimated_hours integer,
    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS date_mode text DEFAULT 'manual'`,

  // ── Add planning columns to project_feature_groups ────────────────────────
  `ALTER TABLE project_feature_groups
    ADD COLUMN IF NOT EXISTS phase_id uuid,
    ADD COLUMN IF NOT EXISTS stage_id uuid,
    ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES project_milestones(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS planning_status text DEFAULT 'high_level',
    ADD COLUMN IF NOT EXISTS estimated_hours integer,
    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS start_date timestamp,
    ADD COLUMN IF NOT EXISTS end_date timestamp`,

  // ── Add planning columns to project_features ─────────────────────────────
  `ALTER TABLE project_features
    ADD COLUMN IF NOT EXISTS phase_id uuid,
    ADD COLUMN IF NOT EXISTS stage_id uuid,
    ADD COLUMN IF NOT EXISTS planning_status text DEFAULT 'high_level',
    ADD COLUMN IF NOT EXISTS estimated_hours integer,
    ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS start_date timestamp,
    ADD COLUMN IF NOT EXISTS end_date timestamp,
    ADD COLUMN IF NOT EXISTS date_mode text DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS acceptance_criteria text`,

  // ── planning_phases ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS planning_phases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    sort_order integer NOT NULL DEFAULT 0,
    planning_status text NOT NULL DEFAULT 'high_level',
    start_date timestamp,
    end_date timestamp,
    estimated_hours integer,
    owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,

  // ── planning_stages ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS planning_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id uuid REFERENCES planning_phases(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    sort_order integer NOT NULL DEFAULT 0,
    planning_status text NOT NULL DEFAULT 'high_level',
    start_date timestamp,
    end_date timestamp,
    estimated_hours integer,
    owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,

  // ── FK from project_milestones to planning_phases / stages ────────────────
  `ALTER TABLE project_milestones
    ADD CONSTRAINT IF NOT EXISTS fk_milestone_phase FOREIGN KEY (phase_id) REFERENCES planning_phases(id) ON DELETE SET NULL`,
  `ALTER TABLE project_milestones
    ADD CONSTRAINT IF NOT EXISTS fk_milestone_stage FOREIGN KEY (stage_id) REFERENCES planning_stages(id) ON DELETE SET NULL`,

  // ── FK from project_feature_groups to planning_phases / stages ────────────
  `ALTER TABLE project_feature_groups
    ADD CONSTRAINT IF NOT EXISTS fk_fg_phase FOREIGN KEY (phase_id) REFERENCES planning_phases(id) ON DELETE SET NULL`,
  `ALTER TABLE project_feature_groups
    ADD CONSTRAINT IF NOT EXISTS fk_fg_stage FOREIGN KEY (stage_id) REFERENCES planning_stages(id) ON DELETE SET NULL`,

  // ── FK from project_features to planning_phases / stages ─────────────────
  `ALTER TABLE project_features
    ADD CONSTRAINT IF NOT EXISTS fk_feature_phase FOREIGN KEY (phase_id) REFERENCES planning_phases(id) ON DELETE SET NULL`,
  `ALTER TABLE project_features
    ADD CONSTRAINT IF NOT EXISTS fk_feature_stage FOREIGN KEY (stage_id) REFERENCES planning_stages(id) ON DELETE SET NULL`,

  // ── user_stories ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_stories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feature_id uuid REFERENCES project_features(id) ON DELETE SET NULL,
    tracking_number text NOT NULL,
    title text NOT NULL,
    description text,
    acceptance_criteria text,
    status text NOT NULL DEFAULT 'draft',
    planning_status text NOT NULL DEFAULT 'high_level',
    estimated_hours integer,
    owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    start_date timestamp,
    end_date timestamp,
    date_mode text DEFAULT 'manual',
    sort_order integer DEFAULT 0,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,

  // ── planning_dependencies ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS planning_dependencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    dependency_type text NOT NULL DEFAULT 'finish_to_start',
    created_at timestamp DEFAULT now()
  )`,

  // ── planning_methodology_configs ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS planning_methodology_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    methodology text NOT NULL DEFAULT 'manual',
    methodology_version text NOT NULL DEFAULT '1.0',
    config_snapshot jsonb,
    notes text,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,

  // ── planning_ai_proposals ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS planning_ai_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scope_type text NOT NULL,
    scope_id uuid,
    prompt text NOT NULL,
    status text NOT NULL DEFAULT 'pending_review',
    summary_json jsonb,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`,

  // ── planning_ai_proposal_items ────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS planning_ai_proposal_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES planning_ai_proposals(id) ON DELETE CASCADE,
    item_type text NOT NULL,
    item_data jsonb NOT NULL,
    parent_type text,
    parent_id uuid,
    action text NOT NULL DEFAULT 'create',
    is_accepted boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp DEFAULT now()
  )`,
];

async function run() {
  console.log("Running planning module migrations…\n");
  for (const sql of migrations) {
    const label = sql.trim().split("\n")[0].substring(0, 80);
    try {
      await pool.query(sql);
      console.log(`  ✓ ${label}`);
    } catch (err: any) {
      // Ignore "already exists" errors for idempotency
      if (err.code === "42710" || err.code === "42P07" || err.message?.includes("already exists")) {
        console.log(`  ~ ${label} (already exists — skipped)`);
      } else {
        console.error(`  ✗ ${label}`);
        console.error(`    ${err.message}`);
      }
    }
  }
  await pool.end();
  console.log("\nMigration complete.");
}

run();
