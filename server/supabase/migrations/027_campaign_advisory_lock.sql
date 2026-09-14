-- Migration 027: Campaign scheduler advisory lock for renovacion-polizas (PR-4, task 1.19)
-- Additive-only (XC-2): two SQL functions, no table changes.
--
-- Design decisions applied (obs #117, Q3):
-- * The campaign scheduler runs as a node-cron server job. On multi-instance
--   deploys every replica would fire the same tick, so leadership is elected
--   per tick through a Postgres advisory lock: pg_try_advisory_lock is
--   non-blocking — exactly one instance wins, the rest skip the tick.
-- * Supabase exposes SQL only through RPC, so the primitives are installed
--   as functions. They are service-role only: tenants must never acquire the
--   scheduler lock (XC-1).

CREATE OR REPLACE FUNCTION public.try_acquire_campaign_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
AS $$ SELECT pg_try_advisory_lock(lock_key) $$;

CREATE OR REPLACE FUNCTION public.release_campaign_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
AS $$ SELECT pg_advisory_unlock(lock_key) $$;

REVOKE ALL ON FUNCTION public.try_acquire_campaign_lock(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_campaign_lock(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_campaign_lock(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_campaign_lock(BIGINT) TO service_role;
