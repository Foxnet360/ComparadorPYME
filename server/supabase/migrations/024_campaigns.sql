-- Migration 024: Expiration campaign tables for renovacion-polizas (PR-1, task 1.3)
-- campaign_configs + campaign_deliveries. Additive-only (XC-2).
--
-- Design decisions applied (obs #117, Q3):
-- * R4.1: per-user campaign_configs; windows int[] default '{60,30,7}' days
--   before policy end_date, toggleable via enabled.
-- * R4.3: delivery idempotency — UNIQUE(renewal_id, window_key) so the
--   scheduler's insert-first-then-send flow can never notify the same
--   (renewal, window) pair twice.
-- RLS is applied separately (migration 026) per the chained-PR slicing.

CREATE TABLE IF NOT EXISTS public.campaign_configs (
  user_id TEXT PRIMARY KEY,
  windows INTEGER[] NOT NULL DEFAULT '{60,30,7}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID NOT NULL REFERENCES public.renewals(id) ON DELETE CASCADE,
  window_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (renewal_id, window_key)
);

CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_renewal
  ON public.campaign_deliveries(renewal_id);
