-- Migration 034: DaaS B2B Subscribers, API Keys & Monetization Quotas
-- Manages external institutional subscribers (insurers, reinsurers, actuaries),
-- secure SHA-256 hashed API keys, tiers, monthly quotas, and consumption tracking.

-- 1. Create daas_subscribers table --------------------------------------------
CREATE TABLE IF NOT EXISTS public.daas_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nit TEXT,
  contact_email TEXT NOT NULL,
  api_key_prefix VARCHAR(16) NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'TIER_1' CHECK (tier IN ('TIER_1', 'TIER_2', 'ENTERPRISE')),
  monthly_quota INTEGER NOT NULL DEFAULT 1000,
  current_month_usage INTEGER NOT NULL DEFAULT 0,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  allowed_domains TEXT[] NOT NULL DEFAULT '{all}',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daas_subscribers_hash ON public.daas_subscribers(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_daas_subscribers_status ON public.daas_subscribers(status);

-- 2. Enable & Force Row Level Security ---------------------------------------
ALTER TABLE public.daas_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daas_subscribers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access on daas subscribers" ON public.daas_subscribers;
CREATE POLICY "Super admin full access on daas subscribers" ON public.daas_subscribers
  FOR ALL
  USING (
    (current_user IN ('postgres', 'service_role'))
    OR (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR (COALESCE(auth.role(), '') = 'service_role')
    OR public.is_super_admin()
  );

-- 3. Security Definer RPC: Verify API Key and Increment Telemetry Usage --------
CREATE OR REPLACE FUNCTION public.verify_daas_api_key(p_key_hash TEXT)
RETURNS TABLE (
  subscriber_id UUID,
  name TEXT,
  tier TEXT,
  monthly_quota INTEGER,
  current_month_usage INTEGER,
  rate_limit_per_minute INTEGER,
  allowed_domains TEXT[],
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT s.id, s.name, s.tier, s.monthly_quota, s.current_month_usage,
         s.rate_limit_per_minute, s.allowed_domains, s.status, s.expires_at
  INTO v_sub
  FROM public.daas_subscribers s
  WHERE s.api_key_hash = p_key_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, 0, 0, 0, ARRAY[]::TEXT[], false;
    RETURN;
  END IF;

  -- Check status and expiration
  IF v_sub.status <> 'ACTIVE' OR (v_sub.expires_at IS NOT NULL AND v_sub.expires_at < now()) THEN
    RETURN QUERY SELECT v_sub.id, v_sub.name, v_sub.tier, v_sub.monthly_quota, v_sub.current_month_usage,
                        v_sub.rate_limit_per_minute, v_sub.allowed_domains, false;
    RETURN;
  END IF;

  -- Increment usage counter
  UPDATE public.daas_subscribers
  SET current_month_usage = current_month_usage + 1,
      updated_at = now()
  WHERE id = v_sub.id;

  RETURN QUERY SELECT v_sub.id, v_sub.name, v_sub.tier, v_sub.monthly_quota, v_sub.current_month_usage + 1,
                      v_sub.rate_limit_per_minute, v_sub.allowed_domains, true;
END;
$$;

-- 4. Seed Initial Demonstration B2B Subscribers -------------------------------
INSERT INTO public.daas_subscribers (
  name, nit, contact_email, api_key_prefix, api_key_hash, tier, monthly_quota, rate_limit_per_minute, status
) VALUES 
  (
    'Aseguradora SURA - Dirección Actuarial',
    '890.903.407-9',
    'actuaria@sura.com.co',
    'csa_live_sura',
    'ccc380e5bfddd7724294afe88df8477916249ba1242b37dd9e0d89cef12803b9',
    'ENTERPRISE',
    50000,
    600,
    'ACTIVE'
  ),
  (
    'CHUBB Seguros - Suscripción B2B',
    '860.028.455-8',
    'suscripcion@chubb.com.co',
    'csa_live_chubb',
    'b89ce9fcb09f32229c950390dfad402b7dcd2fcb91b3d545b65993aa0926abe2',
    'TIER_1',
    2000,
    60,
    'ACTIVE'
  )
ON CONFLICT (api_key_hash) DO NOTHING;
