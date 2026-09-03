/**
 * Idempotent startup migrations — run once at server boot before any routes are registered.
 * Each statement uses IF NOT EXISTS / IF EXISTS guards so it is safe to run on every start.
 * Add new schema additions here in chronological order.
 */
import { pool } from "./db";

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // planning_dependencies.sort_order — user-defined display order for the Dependencies panel
    await client.query(`
      ALTER TABLE planning_dependencies
        ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0
    `);

    // Project Settings — keep configuration and project finance categories
    // separate from operational project records. All statements are idempotent
    // because startup migrations run on every server boot.
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code text
    `);
    await client.query(`
      ALTER TABLE organization_settings
        ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD'
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS projects_project_code_unique
        ON projects(project_code)
        WHERE project_code IS NOT NULL
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_settings (
        project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_finance_heads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name text NOT NULL,
        code text NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        budget_allowed boolean NOT NULL DEFAULT true,
        actual_expense_allowed boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT project_finance_heads_project_code_unique UNIQUE (project_id, code)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_setting_audit (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        setting_key text NOT NULL,
        previous_value jsonb,
        new_value jsonb,
        changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_resource_cost_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gross_salary text NOT NULL,
        organization_currency text NOT NULL,
        effective_month date NOT NULL,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT project_resource_cost_project_user_month_unique
          UNIQUE (project_id, user_id, effective_month)
      )
    `);
  } finally {
    client.release();
  }
}
