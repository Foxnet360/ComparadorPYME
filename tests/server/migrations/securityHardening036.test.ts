import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

describe('Migration 036: Security, RLS & RPC Hardening', () => {
  it('replaces broken current_user check in get_organization_directory()', () => {
    const sql = readMigration('036_security_rls_and_rpc_hardening.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_organization_directory()');
    const fnSection = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.get_organization_directory()'),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.get_executive_analytics_summary(')
    );
    expect(fnSection).not.toContain("current_user IN ('postgres', 'service_role')");
    expect(fnSection).toContain("current_setting('request.jwt.claim.role', true) = 'service_role'");
    expect(fnSection).toContain('public.is_super_admin()');
    expect(fnSection).toContain('public.is_org_member(om.org_id)');
  });

  it('hardens get_executive_analytics_summary against client-spoofed role/org params and revokes PUBLIC/anon', () => {
    const sql = readMigration('036_security_rls_and_rpc_hardening.sql');

    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_executive_analytics_summary');
    expect(sql).toContain('FROM PUBLIC, anon');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_daas_market_index');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.ingest_analysis_row_to_daas');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.verify_daas_api_key');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');

    const fnStart = sql.indexOf(
      'CREATE OR REPLACE FUNCTION public.get_executive_analytics_summary('
    );
    const fnEnd = sql.indexOf('-- 5. Revoke PUBLIC', fnStart);
    const fnSection = sql.slice(fnStart, fnEnd);
    expect(fnSection).toContain('v_is_service_role');
    expect(fnSection).toContain('IF v_is_service_role THEN');
  });

  it('fixes is_org_admin active status case and clients Opción A share predicates', () => {
    const sql = readMigration('036_security_rls_and_rpc_hardening.sql');

    expect(sql).toContain("AND om.status = 'ACTIVE'");
    expect(sql).toContain('WHERE cs.client_id = public.clients.id');
    expect(sql).not.toContain('WHERE cs.client_id = id\n');
  });

  it('removes public anonymous visibility from analysis_history SELECT policy', () => {
    const sql = readMigration('036_security_rls_and_rpc_hardening.sql');

    const policyStart = sql.indexOf('CREATE POLICY "Users can view own analysis history"');
    const policyEnd = sql.indexOf(';', policyStart);
    const policySql = sql.slice(policyStart, policyEnd);
    expect(policySql).not.toContain("user_id = 'anonymous'");
  });

  it('safely parses Colombian and US formatted numbers in ingest_analysis_row_to_daas', () => {
    const sql = readMigration('036_security_rls_and_rpc_hardening.sql');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.parse_colombian_numeric(');
    expect(sql).toContain("strpos(reverse(v_clean), ',') < strpos(reverse(v_clean), '.')");
    expect(sql).toContain('public.parse_colombian_numeric(');
  });
});
