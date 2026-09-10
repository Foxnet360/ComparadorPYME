import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

/**
 * renovacion-polizas PR-1 / task 1.1 — migration 022 clients + policies.
 * Design contract (obs #117): nullable org_id (Q5), minimized ramo_details
 * jsonb (R1.4), provenance + source_analysis_id (R1.3). Additive-only (XC-2).
 */
describe('migration 022 clients/policies (portfolio foundation)', () => {
  it('exists and is sequential after 021', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('022_clients_policies.sql');
  });

  it('creates clients with user_id ownership and nullable org_id (Q5)', () => {
    const sql = readMigration('022_clients_policies.sql');

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.clients/i);
    expect(sql).toMatch(/user_id TEXT NOT NULL/i);
    expect(sql).toMatch(/org_id UUID/i);
    // org_id MUST be nullable: no NOT NULL attached to the org_id column
    expect(sql).not.toMatch(/org_id UUID NOT NULL/i);
  });

  it('creates policies linked to clients with provenance + source_analysis_id (R1.3)', () => {
    const sql = readMigration('022_clients_policies.sql');

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.policies/i);
    expect(sql).toMatch(/client_id UUID NOT NULL REFERENCES public\.clients\(id\)/i);
    expect(sql).toMatch(/provenance TEXT/i);
    expect(sql).toMatch(/source_analysis_id UUID REFERENCES public\.analysis_history\(id\)/i);
  });

  it('stores ramo_details as minimized jsonb, not wide columns (R1.4)', () => {
    const sql = readMigration('022_clients_policies.sql');

    expect(sql).toMatch(/ramo_details JSONB/i);
    // Data minimization: no per-ramo wide columns on policies
    expect(sql).not.toMatch(/plate TEXT/i);
    expect(sql).not.toMatch(/headcount/i);
    expect(sql).not.toMatch(/suma_asegurada/i);
  });

  it('is additive-only (XC-2): no DROP/TRUNCATE on existing tables', () => {
    const sql = readMigration('022_clients_policies.sql');

    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/ALTER TABLE public\.analysis_history/i);
  });

  it('creates the detection index policies(user_id, end_date)', () => {
    const sql = readMigration('022_clients_policies.sql');

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?\w+ ON public\.policies\(user_id, end_date\)/i
    );
  });
});
