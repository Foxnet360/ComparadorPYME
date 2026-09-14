-- Migration 022: Portfolio foundation for renovacion-polizas (PR-1, task 1.1)
-- clients + policies tables. Additive-only (XC-2).
--
-- Design decisions applied (obs #117):
-- * Q5: nullable org_id NOW — zero-cost tenant upgrade path, no future
--   rewrite lock on big tables. Org semantics/backfill deferred.
-- * R1.3: policies record provenance ('analysis' | 'incumbent_pdf' | 'manual')
--   and an optional source_analysis_id link for quote promotion.
-- * R1.4: data minimization — ramo-specific data lives in a minimized
--   ramo_details JSONB column instead of wide per-ramo columns.
-- RLS is applied separately (migration 026) per the chained-PR slicing.

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id UUID,
  name TEXT NOT NULL,
  tax_id TEXT,
  contact JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id UUID,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ramo TEXT NOT NULL,
  insurer TEXT NOT NULL,
  policy_number TEXT,
  premium NUMERIC(14, 2),
  start_date DATE,
  end_date DATE,
  coverages JSONB DEFAULT '[]'::jsonb,
  deductibles JSONB DEFAULT '[]'::jsonb,
  provenance TEXT NOT NULL DEFAULT 'manual',
  source_analysis_id UUID REFERENCES public.analysis_history(id) ON DELETE SET NULL,
  ramo_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Renewal detection scans end_date per owner (R1.2).
CREATE INDEX IF NOT EXISTS idx_policies_user_end_date ON public.policies(user_id, end_date);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
