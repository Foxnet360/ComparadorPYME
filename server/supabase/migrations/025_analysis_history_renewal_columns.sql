-- Migration 025: Additive renewal columns on analysis_history (PR-1, task 1.4)
-- renovacion-polizas. Additive-only (XC-2) — existing rows stay valid.
--
-- Design decisions applied (obs #117, R5.4):
-- * analysis_type TEXT NULL — NULL means 'new' (pre-migration semantics);
--   the engine discriminates 'new' | 'renewal' at read time (R5.1).
-- * policy_id / renewal_id UUID NULL — link a renewal-mode analysis back to
--   the portfolio entities it compares against.
-- * No DEFAULT and no backfill UPDATE: touching existing rows is forbidden.

ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS analysis_type TEXT;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS policy_id UUID
  REFERENCES public.policies(id) ON DELETE SET NULL;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS renewal_id UUID
  REFERENCES public.renewals(id) ON DELETE SET NULL;

-- Lookup of analyses by policy is only meaningful for rows that have one.
CREATE INDEX IF NOT EXISTS idx_analysis_history_policy
  ON public.analysis_history(policy_id)
  WHERE policy_id IS NOT NULL;
