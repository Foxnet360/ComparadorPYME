import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

describe('migration 031: client profiles and analysis tenant linkage', () => {
  const sql = readMigration('031_migrate_client_profiles_and_tenant_linkage.sql');

  it('exists and is sequential after 030', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('031_migrate_client_profiles_and_tenant_linkage.sql');
  });

  it('migrates legacy client_profiles into clients with org_id linkage', () => {
    expect(sql).toMatch(/INSERT INTO public\.clients/i);
    expect(sql).toMatch(/FROM public\.client_profiles/i);
    expect(sql).toMatch(/organization_members/i);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE/i);
  });

  it('links client_profiles.client_id to clients with foreign key and index', () => {
    expect(sql).toMatch(/UPDATE public\.client_profiles/i);
    expect(sql).toMatch(/FOREIGN KEY \(client_id\) REFERENCES public\.clients\(id\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_client_profiles_client_id/i);
  });

  it('adds org_id to analysis_history and configures team-collaborative RLS', () => {
    expect(sql).toMatch(/ALTER TABLE public\.analysis_history ADD COLUMN org_id UUID/i);
    expect(sql).toMatch(/FOREIGN KEY \(org_id\) REFERENCES public\.organizations\(id\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_analysis_history_org_id/i);
    expect(sql).toMatch(/is_org_member\(org_id\)/i);
  });

  it('installs auto-assign tenant triggers for clients and analysis_history', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.assign_default_tenant_org/i);
    expect(sql).toMatch(/TRIGGER trg_assign_clients_org/i);
    expect(sql).toMatch(/TRIGGER trg_assign_analysis_history_org/i);
  });
});
