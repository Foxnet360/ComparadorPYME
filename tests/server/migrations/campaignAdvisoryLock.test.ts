import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

/**
 * renovacion-polizas PR-4 / task 1.19 — migration 027 campaign advisory lock.
 * Design contract (obs #117, Q3): the node-cron scheduler elects a leader via
 * a DB advisory lock so multi-instance deploys never double-send. Supabase
 * only exposes SQL through RPC functions, so the lock primitives are
 * installed as service-role-only functions.
 */
describe('migration 027 campaign advisory lock', () => {
  it('exists and is sequential after 026', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('027_campaign_advisory_lock.sql');
  });

  it('exposes try_acquire_campaign_lock backed by pg_try_advisory_lock', () => {
    const sql = readMigration('027_campaign_advisory_lock.sql');

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.try_acquire_campaign_lock\(lock_key BIGINT\)/i
    );
    expect(sql).toMatch(/pg_try_advisory_lock\(lock_key\)/i);
    expect(sql).toMatch(/RETURNS BOOLEAN/i);
  });

  it('exposes release_campaign_lock backed by pg_advisory_unlock', () => {
    const sql = readMigration('027_campaign_advisory_lock.sql');

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.release_campaign_lock\(lock_key BIGINT\)/i
    );
    expect(sql).toMatch(/pg_advisory_unlock\(lock_key\)/i);
  });

  it('restricts execution to the service role (XC-1: not callable by tenants)', () => {
    const sql = readMigration('027_campaign_advisory_lock.sql');

    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.try_acquire_campaign_lock/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.release_campaign_lock/i);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.try_acquire_campaign_lock[\s\S]*?TO service_role/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.release_campaign_lock[\s\S]*?TO service_role/i
    );
  });

  it('is additive-only (XC-2)', () => {
    const sql = readMigration('027_campaign_advisory_lock.sql');

    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE/i);
  });
});
