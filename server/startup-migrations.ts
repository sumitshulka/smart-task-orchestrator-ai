/**
 * Idempotent startup migrations — run once at server boot before any routes are registered.
 * Each statement uses IF NOT EXISTS / IF EXISTS guards so it is safe to run on every start.
 * Add new schema additions here in chronological order.
 */
import { pool } from "./db";
import { STANDARD_PROJECT_ROLES } from "@shared/project-roles";

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

    // Release Management — explicit release scope, readiness evidence, and approvals.
    await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS approved_at timestamp
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_template_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id uuid NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
        title text NOT NULL,
        system_role text NOT NULL DEFAULT 'project_member',
        is_quality_analyst boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT project_template_roles_title_unique UNIQUE (template_id, title)
      )
    `);
    const templates = await client.query<{ id: string }>(`SELECT id FROM project_templates`);
    for (const template of templates.rows) {
      for (const role of STANDARD_PROJECT_ROLES) {
        await client.query(
          `INSERT INTO project_template_roles (template_id, title, system_role, is_quality_analyst)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (template_id, title) DO NOTHING`,
          [template.id, role.title, role.systemRole, role.isQualityAnalyst === true],
        );
      }
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_releases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name text NOT NULL,
        version text NOT NULL,
        comment text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        created_by uuid NOT NULL REFERENCES users(id),
        qa_approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
        qa_approved_at timestamp,
        approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
        approved_at timestamp,
        rejection_reason text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_milestones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        release_id uuid NOT NULL REFERENCES project_releases(id) ON DELETE CASCADE,
        milestone_id uuid NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now(),
        CONSTRAINT release_milestones_unique UNIQUE (release_id, milestone_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        release_id uuid NOT NULL REFERENCES project_releases(id) ON DELETE CASCADE,
        milestone_id uuid NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
        item_type text NOT NULL,
        item_id uuid NOT NULL,
        title_snapshot text NOT NULL,
        created_at timestamp DEFAULT now(),
        CONSTRAINT release_items_unique UNIQUE (release_id, item_type, item_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        release_id uuid NOT NULL REFERENCES project_releases(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        required boolean NOT NULL DEFAULT true,
        status text NOT NULL DEFAULT 'pending',
        location text,
        approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
        approved_at timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_cases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        test_case_number serial UNIQUE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        milestone_id uuid REFERENCES project_milestones(id) ON DELETE SET NULL,
        title text NOT NULL,
        requirement text NOT NULL DEFAULT '',
        feature_id uuid REFERENCES project_features(id) ON DELETE SET NULL,
        user_story_id uuid REFERENCES user_stories(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'pending',
        comment text,
        source text NOT NULL DEFAULT 'manual',
        last_tested_by uuid REFERENCES users(id) ON DELETE SET NULL,
        last_tested_at timestamp,
        closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        closed_at timestamp,
        approval_status text NOT NULL DEFAULT 'pending',
        approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
        approved_at timestamp,
        created_by uuid NOT NULL REFERENCES users(id),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      ALTER TABLE test_cases
        ADD COLUMN IF NOT EXISTS test_case_number integer,
        ADD COLUMN IF NOT EXISTS requirement text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS feature_id uuid REFERENCES project_features(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS user_story_id uuid REFERENCES user_stories(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS comment text,
        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS last_tested_by uuid REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS last_tested_at timestamp,
        ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS closed_at timestamp
    `);
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS test_cases_test_case_number_seq
    `);
    await client.query(`
      ALTER TABLE test_cases
        ALTER COLUMN test_case_number SET DEFAULT nextval('test_cases_test_case_number_seq')
    `);
    await client.query(`
      UPDATE test_cases
      SET test_case_number = nextval('test_cases_test_case_number_seq')
      WHERE test_case_number IS NULL
    `);
    await client.query(`
      SELECT setval(
        'test_cases_test_case_number_seq',
        GREATEST(COALESCE((SELECT MAX(test_case_number) FROM test_cases), 0), 1),
        true
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS test_cases_test_case_number_unique
        ON test_cases(test_case_number)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_case_results (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        test_case_id uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
        execution_number integer NOT NULL,
        result text NOT NULL,
        comment text,
        tested_by uuid NOT NULL REFERENCES users(id),
        tested_at timestamp NOT NULL DEFAULT now(),
        defect_id uuid REFERENCES defects(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        CONSTRAINT test_case_results_execution_unique UNIQUE (test_case_id, execution_number)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_test_cases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        release_id uuid NOT NULL REFERENCES project_releases(id) ON DELETE CASCADE,
        test_case_id uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now(),
        CONSTRAINT release_test_cases_unique UNIQUE (release_id, test_case_id)
      )
    `);
    // Project Meetings — structured governance records. Files remain in the
    // existing attachment system and calendar providers remain integrations.
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_types (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name text NOT NULL,
        code text NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT meeting_types_project_code_unique UNIQUE (project_id, code)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title text NOT NULL,
        meeting_type_id uuid NOT NULL REFERENCES meeting_types(id) ON DELETE RESTRICT,
        category text NOT NULL DEFAULT 'internal',
        organizer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        starts_at timestamp NOT NULL,
        ends_at timestamp NOT NULL,
        timezone text NOT NULL DEFAULT 'UTC',
        location text,
        meeting_link text,
        description text,
        status text NOT NULL DEFAULT 'draft',
        recurrence_rule jsonb,
        recurrence_id uuid,
        minutes_summary text,
        additional_notes text,
        minutes_status text NOT NULL DEFAULT 'draft',
        published_by uuid REFERENCES users(id) ON DELETE SET NULL,
        published_at timestamp,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_attendees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        contact_id uuid REFERENCES client_contacts(id) ON DELETE CASCADE,
        attendee_type text NOT NULL DEFAULT 'internal',
        required boolean NOT NULL DEFAULT true,
        attendance_status text NOT NULL DEFAULT 'no_response',
        created_at timestamp DEFAULT now(),
        CONSTRAINT meeting_attendees_meeting_user_unique UNIQUE (meeting_id, user_id),
        CONSTRAINT meeting_attendees_meeting_contact_unique UNIQUE (meeting_id, contact_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_agenda_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        sequence integer NOT NULL DEFAULT 0,
        title text NOT NULL,
        description text,
        presenter_id uuid REFERENCES users(id) ON DELETE SET NULL,
        expected_duration integer,
        reference text,
        status text NOT NULL DEFAULT 'planned',
        linked_entity_type text,
        linked_entity_id uuid,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_discussions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        agenda_item_id uuid REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
        topic text NOT NULL,
        discussion text,
        decision text,
        reference text,
        visibility text NOT NULL DEFAULT 'internal',
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_decisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        agenda_item_id uuid REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
        title text NOT NULL,
        description text,
        decision_date timestamp DEFAULT now(),
        owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'proposed',
        visibility text NOT NULL DEFAULT 'internal',
        linked_entity_type text,
        linked_entity_id uuid,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_action_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        agenda_item_id uuid REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
        title text NOT NULL,
        description text,
        responsibility_level text NOT NULL DEFAULT 'project_team',
        responsible_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        responsible_contact_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        due_date timestamp,
        priority text NOT NULL DEFAULT 'medium',
        status text NOT NULL DEFAULT 'open',
        linked_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
        completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
        completed_at timestamp,
        visibility text NOT NULL DEFAULT 'client',
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_calendar_integrations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        provider text NOT NULL DEFAULT 'ics',
        external_event_id text,
        sync_status text NOT NULL DEFAULT 'available',
        last_synced_at timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT meeting_calendar_meeting_provider_unique UNIQUE (meeting_id, provider)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_activity (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        action_type text NOT NULL,
        metadata jsonb,
        acted_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now()
      )
    `);
  } finally {
    client.release();
  }
}
