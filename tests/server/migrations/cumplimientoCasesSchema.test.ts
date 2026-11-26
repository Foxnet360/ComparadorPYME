import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SERVER_MIGRATIONS = path.join(__dirname, '../../../server/supabase/migrations');
const ROOT_MIGRATIONS = path.join(__dirname, '../../../supabase/migrations');

describe('migration 038: cumplimiento_cases schema and multi-tenant RLS', () => {
  const sql = fs.readFileSync(
    path.join(SERVER_MIGRATIONS, '038_cumplimiento_prepolicies.sql'),
    'utf-8'
  );

  it('keeps byte-for-byte parity with supabase/migrations/20261126000038_cumplimiento_prepolicies.sql', () => {
    const mirror = fs.readFileSync(
      path.join(ROOT_MIGRATIONS, '20261126000038_cumplimiento_prepolicies.sql'),
      'utf-8'
    );
    expect(mirror).toBe(sql);
  });

  it('defines all required columns and constraints on public.cumplimiento_cases', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.cumplimiento_cases');
    for (const col of [
      'id UUID PRIMARY KEY',
      'user_id TEXT NOT NULL',
      'org_id UUID REFERENCES public.organizations(id)',
      'client_id UUID REFERENCES public.clients(id)',
      'parent_case_id UUID REFERENCES public.cumplimiento_cases(id)',
      'policy_id UUID REFERENCES public.policies(id)',
      "case_type TEXT NOT NULL CHECK (case_type IN ('LICITACION', 'CONTRATO', 'OTROSI'))",
      "status TEXT NOT NULL DEFAULT 'DRAFT'",
      'title TEXT NOT NULL',
      'legal_regime TEXT',
      'contract_type TEXT',
      'contract_number TEXT',
      'contractor_name TEXT',
      'contractor_nit TEXT',
      'entity_name TEXT',
      'entity_nit TEXT',
      'contract_value NUMERIC(18, 2)',
      'governing_document_names TEXT[]',
      'prepolicy_data JSONB',
      'checklist_data JSONB',
      'validation_history JSONB',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('enables RLS and uses hardened is_super_admin / is_org_member / auth.uid() policies', () => {
    expect(sql).toMatch(/ALTER TABLE public\.cumplimiento_cases ENABLE ROW LEVEL SECURITY/i);
    for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(new RegExp(`FOR ${verb}`, 'i'));
    }
    expect(sql).toContain('public.is_super_admin()');
    expect(sql).toContain('public.is_org_member(org_id)');
    expect(sql).toContain('((SELECT auth.uid())::text)');
    expect(sql).toContain('public.update_updated_at_column()');
  });
});
