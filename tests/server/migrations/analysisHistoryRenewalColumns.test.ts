import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

/**
 * renovacion-polizas PR-1 / task 1.4 — migration 025 additive analysis_history.
 * Design contract (obs #117, R5.4): nullable analysis_type / policy_id /
 * renewal_id; NULL analysis_type means 'new' (XC-2 backward compat).
 * Existing rows and consumers MUST stay valid — strictly additive.
 */
describe('migration 025 analysis_history renewal columns (additive)', () => {
  it('exists and is sequential after 024', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('025_analysis_history_renewal_columns.sql');
  });

  it('adds nullable analysis_type, policy_id, renewal_id (R5.4)', () => {
    const sql = readMigration('025_analysis_history_renewal_columns.sql');

    expect(sql).toMatch(
      /ALTER TABLE public\.analysis_history ADD COLUMN IF NOT EXISTS analysis_type TEXT/i
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.analysis_history ADD COLUMN IF NOT EXISTS policy_id UUID/i
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.analysis_history ADD COLUMN IF NOT EXISTS renewal_id UUID/i
    );
  });

  it('keeps every new column nullable — NULL analysis_type means new (XC-2)', () => {
    const sql = readMigration('025_analysis_history_renewal_columns.sql');

    // No NOT NULL, no DEFAULT rewriting analysis_type semantics,
    // no backfill UPDATE that would mutate existing rows.
    expect(sql).not.toMatch(/analysis_type TEXT NOT NULL/i);
    expect(sql).not.toMatch(/analysis_type TEXT DEFAULT/i);
    expect(sql).not.toMatch(/policy_id UUID NOT NULL/i);
    expect(sql).not.toMatch(/renewal_id UUID NOT NULL/i);
    expect(sql).not.toMatch(/UPDATE public\.analysis_history/i);
  });

  it('references policies and renewals additively (FK, no cascade drops)', () => {
    const sql = readMigration('025_analysis_history_renewal_columns.sql');

    expect(sql).toMatch(/REFERENCES public\.policies\(id\)/i);
    expect(sql).toMatch(/REFERENCES public\.renewals\(id\)/i);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
  });

  it('creates the partial index analysis_history(policy_id) WHERE policy_id IS NOT NULL', () => {
    const sql = readMigration('025_analysis_history_renewal_columns.sql');

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?\w+\s+ON\s+public\.analysis_history\(policy_id\)/i
    );
    expect(sql).toMatch(/WHERE\s+policy_id IS NOT NULL/i);
  });

  it('is additive-only: no DROP, no column type changes, no renames', () => {
    const sql = readMigration('025_analysis_history_renewal_columns.sql');

    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(sql).not.toMatch(/ALTER COLUMN \w+ TYPE/i);
    expect(sql).not.toMatch(/RENAME/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});
