import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

/**
 * renovacion-polizas PR-1 / task 1.2 — migration 023 renewals + renewal_events.
 * Design contract (obs #117, Q2): state machine rows with outcome/final_premium/
 * loss_reason (R3.1/R3.2), audit events, and ONE open renewal per
 * (policy_id, cycle_start) via unique partial index (R3.3).
 */
describe('migration 023 renewals/renewal_events (lifecycle foundation)', () => {
  it('exists and is sequential after 022', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('023_renewals.sql');
  });

  it('creates renewals with state machine fields and detected default', () => {
    const sql = readMigration('023_renewals.sql');

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.renewals/i);
    expect(sql).toMatch(/user_id TEXT NOT NULL/i);
    expect(sql).toMatch(/org_id UUID/i);
    expect(sql).toMatch(/policy_id UUID NOT NULL REFERENCES public\.policies\(id\)/i);
    expect(sql).toMatch(/cycle_start DATE NOT NULL/i);
    expect(sql).toMatch(/state TEXT NOT NULL DEFAULT 'detected'/i);
    expect(sql).toMatch(/outcome TEXT/i);
    expect(sql).toMatch(/final_premium NUMERIC/i);
    expect(sql).toMatch(/loss_reason TEXT/i);
  });

  it('enforces ONE open renewal per (policy_id, cycle_start) — R3.3', () => {
    const sql = readMigration('023_renewals.sql');

    // Unique partial index: duplicates only rejected while state <> 'closed'
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX (IF NOT EXISTS )?\w+\s+ON public\.renewals\s*\(policy_id,\s*cycle_start\)/i
    );
    expect(sql).toMatch(/WHERE\s+state\s*<>\s*'closed'/i);
  });

  it('creates renewal_events audit table with actor and payload (R3.1)', () => {
    const sql = readMigration('023_renewals.sql');

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.renewal_events/i);
    expect(sql).toMatch(/renewal_id UUID NOT NULL REFERENCES public\.renewals\(id\)/i);
    expect(sql).toMatch(/from_state TEXT/i);
    expect(sql).toMatch(/to_state TEXT NOT NULL/i);
    expect(sql).toMatch(/actor_id TEXT/i);
    expect(sql).toMatch(/payload JSONB/i);
    expect(sql).toMatch(/created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/i);
  });

  it('creates supporting indexes renewals(user_id, state) and renewal_events(renewal_id)', () => {
    const sql = readMigration('023_renewals.sql');

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?\w+ ON public\.renewals\(user_id, state\)/i);
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?\w+ ON public\.renewal_events\(renewal_id\)/i
    );
  });

  it('is additive-only (XC-2)', () => {
    const sql = readMigration('023_renewals.sql');

    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });
});
