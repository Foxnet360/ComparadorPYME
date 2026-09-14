import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

/**
 * renovacion-polizas PR-1 / task 1.3 — migration 024 campaign tables.
 * Design contract (obs #117, Q3): per-user campaign_configs (windows int[]
 * default '{60,30,7}', R4.1) and campaign_deliveries idempotency via
 * UNIQUE(renewal_id, window_key) — insert-first-then-send (R4.3).
 */
describe('migration 024 campaign_configs/campaign_deliveries', () => {
  it('exists and is sequential after 023', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('024_campaigns.sql');
  });

  it('creates campaign_configs keyed by user_id with default windows 60/30/7 (R4.1)', () => {
    const sql = readMigration('024_campaigns.sql');

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.campaign_configs/i);
    expect(sql).toMatch(/user_id TEXT PRIMARY KEY/i);
    expect(sql).toMatch(/windows INTEGER\[\] NOT NULL DEFAULT '\{60,30,7\}'/i);
    expect(sql).toMatch(/enabled BOOLEAN NOT NULL DEFAULT true/i);
  });

  it('creates campaign_deliveries with send tracking fields', () => {
    const sql = readMigration('024_campaigns.sql');

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.campaign_deliveries/i);
    expect(sql).toMatch(/renewal_id UUID NOT NULL REFERENCES public\.renewals\(id\)/i);
    expect(sql).toMatch(/window_key TEXT NOT NULL/i);
    expect(sql).toMatch(/channel TEXT/i);
    expect(sql).toMatch(/status TEXT/i);
    expect(sql).toMatch(/sent_at TIMESTAMPTZ/i);
  });

  it('enforces delivery idempotency with UNIQUE(renewal_id, window_key) — R4.3', () => {
    const sql = readMigration('024_campaigns.sql');

    // Insert-first-then-send: a second insert for the same pair must conflict.
    expect(sql).toMatch(/UNIQUE\s*\(\s*renewal_id,\s*window_key\s*\)/i);
  });

  it('creates the campaign_deliveries(renewal_id) index', () => {
    const sql = readMigration('024_campaigns.sql');

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?\w+\s+ON\s+public\.campaign_deliveries\(renewal_id\)/i
    );
  });

  it('is additive-only (XC-2)', () => {
    const sql = readMigration('024_campaigns.sql');

    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });
});
