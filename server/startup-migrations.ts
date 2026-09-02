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
  } finally {
    client.release();
  }
}
