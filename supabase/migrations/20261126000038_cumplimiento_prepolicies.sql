-- ============================================================================
-- Migration 038: Cumplimiento Pre-policies (Slip), Checklist & Case Persistence
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cumplimiento_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  parent_case_id UUID REFERENCES public.cumplimiento_cases(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL CHECK (case_type IN ('LICITACION', 'CONTRATO', 'OTROSI')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',
      'READY_TO_QUOTE',
      'QUOTED',
      'VALIDATED',
      'ISSUED',
      'MODIFICATION_PENDING',
      'CLOSED'
    )
  ),
  title TEXT NOT NULL,
  legal_regime TEXT CHECK (
    legal_regime IS NULL OR legal_regime IN ('ESTATAL_LEY_80', 'PARTICULAR', 'REGIMEN_ESPECIAL')
  ),
  contract_type TEXT,
  contract_number TEXT,
  contractor_name TEXT,
  contractor_nit TEXT,
  entity_name TEXT,
  entity_nit TEXT,
  contract_value NUMERIC(18, 2),
  governing_document_names TEXT[] NOT NULL DEFAULT '{}',
  prepolicy_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  checklist_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for tenant/user listing, modification lineage, and case lookup
CREATE INDEX IF NOT EXISTS idx_cumplimiento_cases_org_updated
  ON public.cumplimiento_cases (org_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cumplimiento_cases_user_updated
  ON public.cumplimiento_cases (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cumplimiento_cases_parent_case
  ON public.cumplimiento_cases (parent_case_id);

CREATE INDEX IF NOT EXISTS idx_cumplimiento_cases_contract_number
  ON public.cumplimiento_cases (contract_number);

CREATE INDEX IF NOT EXISTS idx_cumplimiento_cases_contractor_nit
  ON public.cumplimiento_cases (contractor_nit);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_cumplimiento_cases_updated_at ON public.cumplimiento_cases;
CREATE TRIGGER update_cumplimiento_cases_updated_at
  BEFORE UPDATE ON public.cumplimiento_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Row Level Security (multi-tenant hardened per migration 036 pattern)
ALTER TABLE public.cumplimiento_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cumplimiento_cases_select_policy" ON public.cumplimiento_cases;
CREATE POLICY "cumplimiento_cases_select_policy"
  ON public.cumplimiento_cases
  FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
  );

DROP POLICY IF EXISTS "cumplimiento_cases_insert_policy" ON public.cumplimiento_cases;
CREATE POLICY "cumplimiento_cases_insert_policy"
  ON public.cumplimiento_cases
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      user_id = ((SELECT auth.uid())::text)
      AND (org_id IS NULL OR public.is_org_member(org_id))
    )
  );

DROP POLICY IF EXISTS "cumplimiento_cases_update_policy" ON public.cumplimiento_cases;
CREATE POLICY "cumplimiento_cases_update_policy"
  ON public.cumplimiento_cases
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
  );

DROP POLICY IF EXISTS "cumplimiento_cases_delete_policy" ON public.cumplimiento_cases;
CREATE POLICY "cumplimiento_cases_delete_policy"
  ON public.cumplimiento_cases
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
  );
