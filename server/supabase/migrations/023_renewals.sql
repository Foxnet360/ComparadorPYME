-- Migration 023: Renewal lifecycle foundation for renovacion-polizas (PR-1, task 1.2)
-- renewals + renewal_events. Additive-only (XC-2).
--
-- Design decisions applied (obs #117, Q2):
-- * R3.1: state machine detected → notified → in_review → quoted → closed,
--   audited via renewal_events (from/to/actor/payload/created_at).
-- * R3.2: outcome + final_premium + loss_reason columns (lost-requires-reason
--   is enforced at the transition layer, not the schema).
-- * R3.3: ONE open renewal per (policy_id, cycle_start) via unique partial
--   index WHERE state <> 'closed'; closing a cycle frees the pair for the
--   next cycle's renewal row.
-- RLS is applied separately (migration 026) per the chained-PR slicing.

CREATE TABLE IF NOT EXISTS public.renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id UUID,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  cycle_start DATE NOT NULL,
  state TEXT NOT NULL DEFAULT 'detected',
  outcome TEXT,
  final_premium NUMERIC(14, 2),
  loss_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- R3.3: at most one open renewal per policy cycle. cycle_start is NOT NULL,
-- so NULLS NOT DISTINCT is declared for explicitness but never engages.
CREATE UNIQUE INDEX IF NOT EXISTS idx_renewals_one_open_per_cycle
  ON public.renewals (policy_id, cycle_start) NULLS NOT DISTINCT
  WHERE state <> 'closed';

CREATE INDEX IF NOT EXISTS idx_renewals_user_state ON public.renewals(user_id, state);

CREATE TABLE IF NOT EXISTS public.renewal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID NOT NULL REFERENCES public.renewals(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renewal_events_renewal ON public.renewal_events(renewal_id);
