import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

const NEW_TABLES = [
  'clients',
  'policies',
  'renewals',
  'renewal_events',
  'campaign_configs',
  'campaign_deliveries',
] as const;

// Dual auth pattern from 001_initial_schema (XC-1): Supabase JWT or the
// service-side app.current_user_id GUC.
const DUAL_PATTERN =
  /\(\(SELECT auth\.uid\(\)\)::text\)\s*OR\s*\(?\w*\.?user_id = \(SELECT current_setting\('app\.current_user_id', true\)\)/i;

/**
 * renovacion-polizas PR-1 / task 1.5 — migration 026 RLS on new tables.
 * Design contract (obs #117, XC-1): enable + FORCE RLS, per-verb policies
 * replicating the existing dual pattern. Tables without a user_id column
 * (renewal_events, campaign_deliveries) scope through their parent renewal,
 * following the chat_messages → chat_threads precedent in 001.
 */
describe('migration 026 RLS hardening on renewal tables (XC-1)', () => {
  it('exists and is sequential after 025', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('026_renewal_rls.sql');
  });

  it.each(NEW_TABLES)('enables and FORCES row level security on %s', (table) => {
    const sql = readMigration('026_renewal_rls.sql');

    expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
    expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`, 'i'));
  });

  it.each(['clients', 'policies', 'renewals', 'campaign_configs'] as const)(
    'defines per-verb policies (SELECT/INSERT/UPDATE/DELETE) on %s with the dual auth pattern',
    (table) => {
      const sql = readMigration('026_renewal_rls.sql');

      for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        expect(sql).toMatch(
          new RegExp(`CREATE POLICY "[^"]+" ON public\\.${table} FOR ${verb}`, 'i')
        );
      }
      // Dual pattern present for both auth paths on this table's policies.
      expect(sql).toMatch(DUAL_PATTERN);
    }
  );

  it.each(['renewal_events', 'campaign_deliveries'] as const)(
    'scopes %s through its parent renewal (no direct user_id column)',
    (table) => {
      const sql = readMigration('026_renewal_rls.sql');

      for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        expect(sql).toMatch(
          new RegExp(`CREATE POLICY "[^"]+" ON public\\.${table} FOR ${verb}`, 'i')
        );
      }
      // Ownership resolved via EXISTS against renewals.user_id (dual pattern).
      expect(sql).toMatch(
        new RegExp(
          `EXISTS \\(SELECT 1 FROM public\\.renewals WHERE renewals\\.id = ${table}\\.renewal_id`,
          'i'
        )
      );
    }
  );

  it('is additive-only: policies are CREATE, never ALTER/DROP of existing ones', () => {
    const sql = readMigration('026_renewal_rls.sql');

    expect(sql).not.toMatch(/DROP POLICY/i);
    expect(sql).not.toMatch(/ALTER POLICY/i);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });
});
