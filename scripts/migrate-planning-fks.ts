/**
 * Add FK constraints for planning phase/stage linkages (idempotent).
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

const fks = [
  { table: "project_milestones",    col: "phase_id", name: "fk_milestone_phase", ref: "planning_phases(id)" },
  { table: "project_milestones",    col: "stage_id", name: "fk_milestone_stage", ref: "planning_stages(id)" },
  { table: "project_feature_groups", col: "phase_id", name: "fk_fg_phase",       ref: "planning_phases(id)" },
  { table: "project_feature_groups", col: "stage_id", name: "fk_fg_stage",       ref: "planning_stages(id)" },
  { table: "project_features",      col: "phase_id", name: "fk_feature_phase",   ref: "planning_phases(id)" },
  { table: "project_features",      col: "stage_id", name: "fk_feature_stage",   ref: "planning_stages(id)" },
];

async function run() {
  console.log("Adding FK constraints…");
  for (const fk of fks) {
    // Check if constraint already exists
    const res = await pool.query(
      `SELECT 1 FROM information_schema.table_constraints WHERE constraint_name=$1 AND table_name=$2`,
      [fk.name, fk.table]
    );
    if (res.rows.length > 0) {
      console.log(`  ~ ${fk.name} already exists`);
      continue;
    }
    try {
      await pool.query(
        `ALTER TABLE ${fk.table} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${fk.col}) REFERENCES ${fk.ref} ON DELETE SET NULL`
      );
      console.log(`  ✓ ${fk.name}`);
    } catch (err: any) {
      console.error(`  ✗ ${fk.name}: ${err.message}`);
    }
  }
  await pool.end();
  console.log("Done.");
}
run();
