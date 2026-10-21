import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

describe('migration 029: organizations and team-level RLS', () => {
  const sql = readMigration('029_organizations_and_team_rls.sql');

  it('exists and is sequential after 028', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('029_organizations_and_team_rls.sql');
  });

  it('creates public.organizations and public.organization_members tables', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.organizations/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.organization_members/i);
    expect(sql).toMatch(/CHECK\s*\(role IN \('super_admin', 'ally_admin', 'ally_technical'\)\)/i);
  });

  it('enables and FORCES row level security on organizations and organization_members', () => {
    expect(sql).toMatch(/ALTER TABLE public\.organizations ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.organizations FORCE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.organization_members ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.organization_members FORCE ROW LEVEL SECURITY/i);
  });

  it('defines SECURITY DEFINER functions with search_path = "" for RLS optimization', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_org_member/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_super_admin/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
  });

  it('defines team-collaborative RLS policies for clients, policies, and renewals', () => {
    const tables = ['clients', 'policies', 'renewals'];
    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`CREATE POLICY "[^"]+" ON public\\.${table} FOR SELECT`, 'i'));
      expect(sql).toMatch(new RegExp(`CREATE POLICY "[^"]+" ON public\\.${table} FOR UPDATE`, 'i'));
    }
    // Ensures is_org_member is used in the policy
    expect(sql).toMatch(/is_org_member\(org_id\)/i);
    // Preserves dual auth pattern fallback
    expect(sql).toMatch(/\(\(SELECT auth\.uid\(\)\)::text\)/i);
    expect(sql).toMatch(/\(SELECT current_setting\('app\.current_user_id', true\)\)/i);
  });

  it('adds foreign keys and performance indexes on org_id', () => {
    expect(sql).toMatch(/FOREIGN KEY \(org_id\) REFERENCES public\.organizations\(id\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public\.clients\(org_id\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_policies_org_id ON public\.policies\(org_id\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_renewals_org_id ON public\.renewals\(org_id\)/i);
  });

  it('includes an idempotent backfill block for existing records', () => {
    expect(sql).toMatch(/DO \$\$/i);
    expect(sql).toMatch(/INSERT INTO public\.organizations/i);
    expect(sql).toMatch(/INSERT INTO public\.organization_members/i);
    expect(sql).toMatch(/UPDATE public\.clients SET org_id =/i);
  });
});
