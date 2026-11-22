-- ============================================================================
-- Migration 036: Security, RLS & RPC Hardening (Audit P0 Remediation)
-- ============================================================================
-- Fixes:
-- 1. Active status checks in is_org_member, is_super_admin, and is_org_admin
-- 2. Removes broken `current_user IN ('postgres', 'service_role')` check inside
--    SECURITY DEFINER function get_organization_directory()
-- 3. Hardens get_executive_analytics_summary() so non-service_role callers cannot
--    spoof p_caller_role / p_caller_org_id / p_caller_id
-- 4. Revokes PUBLIC/anon (and authenticated where internal) EXECUTE privileges
--    on DaaS / analytics / directory SECURITY DEFINER RPCs
-- 5. Fixes self-referencing `cs.client_id = id` bug in clients Opción A RLS
-- 6. Removes public `OR user_id = 'anonymous'` leak on analysis_history SELECT
-- 7. Adds fault-tolerant Colombian numeric parsing for DaaS ingestion trigger
-- ============================================================================

-- 1. Harden tenant role helper functions (require ACTIVE membership) ---------
CREATE OR REPLACE FUNCTION public.is_org_member(lookup_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.org_id = lookup_org_id
      AND om.status = 'ACTIVE'
      AND (
        om.user_id = ((SELECT auth.uid())::text)
        OR om.user_id = (SELECT current_setting('app.current_user_id', true))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.role = 'super_admin'
      AND om.status = 'ACTIVE'
      AND (
        om.user_id = ((SELECT auth.uid())::text)
        OR om.user_id = (SELECT current_setting('app.current_user_id', true))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.role IN ('ally_admin', 'super_admin')
      AND om.status = 'ACTIVE'
      AND (
        om.user_id = ((SELECT auth.uid())::text)
        OR om.user_id = (SELECT current_setting('app.current_user_id', true))
      )
  );
$$;

-- 2. Fix get_organization_directory() SECURITY DEFINER current_user bypass ---
CREATE OR REPLACE FUNCTION public.get_organization_directory()
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  email TEXT,
  name TEXT,
  role TEXT,
  org_id UUID,
  org_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Inside SECURITY DEFINER, current_user is the owner (postgres), NEVER the caller.
  -- Check JWT claim / auth.role() / is_super_admin() exclusively.
  IF (current_setting('request.jwt.claim.role', true) = 'service_role')
     OR (COALESCE(auth.role(), '') = 'service_role')
     OR public.is_super_admin() THEN
    RETURN QUERY
    SELECT
      om.id,
      om.user_id,
      u.email::text,
      COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)) AS name,
      om.role,
      om.org_id,
      o.name AS org_name,
      om.status,
      om.created_at
    FROM public.organization_members om
    JOIN public.organizations o ON om.org_id = o.id
    JOIN auth.users u ON om.user_id = u.id::text
    ORDER BY o.name ASC, om.role ASC;
  ELSE
    -- Non-super-admin authenticated callers only see active members of their own org
    RETURN QUERY
    SELECT
      om.id,
      om.user_id,
      u.email::text,
      COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)) AS name,
      om.role,
      om.org_id,
      o.name AS org_name,
      om.status,
      om.created_at
    FROM public.organization_members om
    JOIN public.organizations o ON om.org_id = o.id
    JOIN auth.users u ON om.user_id = u.id::text
    WHERE public.is_org_member(om.org_id)
      AND om.status = 'ACTIVE'
    ORDER BY om.role ASC;
  END IF;
END;
$$;

-- 3. Fault-tolerant Colombian numeric parser for DaaS ingestion --------------
CREATE OR REPLACE FUNCTION public.parse_colombian_numeric(p_raw TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_clean TEXT;
  v_dot_count INT;
  v_comma_count INT;
BEGIN
  IF p_raw IS NULL OR trim(p_raw) = '' THEN
    RETURN NULL;
  END IF;

  v_clean := regexp_replace(trim(p_raw), '[^0-9.,-]', '', 'g');
  IF v_clean = '' OR v_clean !~ '[0-9]' THEN
    RETURN NULL;
  END IF;

  v_dot_count := length(v_clean) - length(replace(v_clean, '.', ''));
  v_comma_count := length(v_clean) - length(replace(v_clean, ',', ''));

  IF v_dot_count > 0 AND v_comma_count > 0 THEN
    -- Compare last separator position: comma closer to end => Colombian (1.500.000,50),
    -- dot closer to end => US/English ($1,500.00 or $1,500,000.00).
    IF strpos(reverse(v_clean), ',') < strpos(reverse(v_clean), '.') THEN
      v_clean := replace(replace(v_clean, '.', ''), ',', '.');
    ELSE
      v_clean := replace(v_clean, ',', '');
    END IF;
  ELSIF v_comma_count > 0 THEN
    IF v_comma_count = 1 AND v_clean ~ ',[0-9]{1,2}$' THEN
      v_clean := replace(v_clean, ',', '.');
    ELSE
      v_clean := replace(v_clean, ',', '');
    END IF;
  ELSIF v_dot_count > 1 THEN
    -- Multiple dots (e.g. 1.500.000) -> thousands separators
    v_clean := replace(v_clean, '.', '');
  ELSIF v_dot_count = 1 AND v_clean ~ '\.[0-9]{3}$' THEN
    -- Single dot followed by 3 digits (e.g. 500.000) -> Colombian thousands separator
    v_clean := replace(v_clean, '.', '');
  END IF;

  RETURN v_clean::NUMERIC;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_analysis_row_to_daas(
  p_analysis_id UUID,
  p_domain TEXT,
  p_analysis_result JSONB,
  p_unified_result JSONB,
  p_created_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quote JSONB;
  v_quote_idx INTEGER := 0;
  v_quotes JSONB;
  v_coverages JSONB;
  v_clean_coverages JSONB;
  v_domain TEXT;
  v_period VARCHAR(7);
BEGIN
  v_domain := COALESCE(p_domain, 'pyme');
  v_period := to_char(COALESCE(p_created_at, now()), 'YYYY-MM');

  IF p_analysis_result IS NOT NULL AND jsonb_typeof(p_analysis_result->'quotes') = 'array' THEN
    v_quotes := p_analysis_result->'quotes';
  ELSIF p_unified_result IS NOT NULL AND jsonb_typeof(p_unified_result->'quotes') = 'array' THEN
    v_quotes := p_unified_result->'quotes';
  ELSE
    RETURN;
  END IF;

  DELETE FROM public.daas_market_snapshots WHERE source_analysis_id = p_analysis_id;

  FOR v_quote IN SELECT * FROM jsonb_array_elements(v_quotes)
  LOOP
    v_coverages := COALESCE(v_quote->'coverages', '[]'::jsonb);

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'name', trim(COALESCE(cov->>'name', 'Amparo')),
        'value', cov->>'value',
        'deductible', cov->>'deductible'
      )
    ), '[]'::jsonb)
    INTO v_clean_coverages
    FROM jsonb_array_elements(v_coverages) AS cov;

    INSERT INTO public.daas_market_snapshots (
      source_analysis_id,
      quote_index,
      domain,
      insurer_name,
      policy_plan,
      price_annual,
      price_monthly,
      currency,
      deductibles_raw,
      coverages_summary,
      score,
      period_month,
      region_macro,
      anonymized_at
    ) VALUES (
      p_analysis_id,
      v_quote_idx,
      v_domain,
      COALESCE(v_quote->>'insurerName', v_quote->>'insurer', 'Aseguradora Desconocida'),
      v_quote->>'policyName',
      public.parse_colombian_numeric(v_quote->>'priceAnnual'),
      public.parse_colombian_numeric(v_quote->>'priceMonthly'),
      COALESCE(v_quote->>'currency', 'COP'),
      v_quote->>'deductibles',
      v_clean_coverages,
      NULLIF(regexp_replace(COALESCE(v_quote->>'score', '0'), '[^0-9]', '', 'g'), '')::INTEGER,
      v_period,
      'NACIONAL',
      now()
    );

    v_quote_idx := v_quote_idx + 1;
  END LOOP;
END;
$$;

-- 4. Harden get_executive_analytics_summary() against caller-spoofed roles ---
CREATE OR REPLACE FUNCTION public.get_executive_analytics_summary(
  p_timeframe_days INT DEFAULT 90,
  p_caller_id TEXT DEFAULT NULL,
  p_caller_role TEXT DEFAULT NULL,
  p_caller_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_service_role BOOLEAN := false;
  v_caller_id TEXT;
  v_is_super BOOLEAN := false;
  v_org_id UUID;
  v_role TEXT;
  v_since_date TIMESTAMPTZ;
  v_result JSONB;

  v_total_comparisons INT := 0;
  v_sold_count INT := 0;
  v_conversion_rate NUMERIC := 0;
  v_total_premium NUMERIC := 0;
  v_avg_process_time INT := 12;

  v_domain_dist JSONB := '[]'::jsonb;
  v_insurer_dist JSONB := '[]'::jsonb;
  v_analyst_perf JSONB := '[]'::jsonb;
  v_daas_metrics JSONB := '{}'::jsonb;
BEGIN
  v_is_service_role :=
    (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR (COALESCE(auth.role(), '') = 'service_role');

  IF v_is_service_role THEN
    -- Trusted backend service_role call may supply explicit caller context
    v_caller_id := COALESCE(
      p_caller_id,
      auth.uid()::text,
      current_setting('app.current_user_id', true)
    );

    IF p_caller_role = 'super_admin' THEN
      v_is_super := true;
      v_role := 'super_admin';
    ELSIF p_caller_role = 'ally_admin' THEN
      v_is_super := false;
      v_role := 'ally_admin';
      v_org_id := p_caller_org_id;
    ELSIF p_caller_role = 'ally_technical' THEN
      v_is_super := false;
      v_role := 'ally_technical';
      v_org_id := p_caller_org_id;
    END IF;
  ELSE
    -- Non-service_role callers MUST derive identity, role, and org from auth context
    v_caller_id := auth.uid()::text;
    IF v_caller_id IS NULL OR v_caller_id = '' THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;
    v_is_super := public.is_super_admin();
    IF v_is_super THEN
      v_role := 'super_admin';
    END IF;
  END IF;

  v_since_date := now() - make_interval(days => GREATEST(1, COALESCE(p_timeframe_days, 90)));

  IF NOT v_is_super AND v_role IS NULL THEN
    SELECT om.org_id, om.role INTO v_org_id, v_role
    FROM public.organization_members om
    WHERE om.user_id = v_caller_id
      AND om.status = 'ACTIVE'
    LIMIT 1;

    IF v_role IS NULL THEN
      v_role := 'ally_technical';
    END IF;
  ELSIF v_is_service_role AND v_org_id IS NULL AND p_caller_org_id IS NOT NULL THEN
    v_org_id := p_caller_org_id;
  END IF;

  IF v_role = 'ally_technical' AND NOT v_is_super THEN
    SELECT
      COUNT(*)::INT,
      COUNT(CASE WHEN metadata->>'status' IN ('SOLD', 'ACCEPTED') OR total_score >= 85 THEN 1 END)::INT,
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_avg_process_time
    FROM public.analysis_history
    WHERE user_id = v_caller_id
      AND created_at >= v_since_date;

    IF v_total_comparisons > 0 THEN
      v_conversion_rate := ROUND((v_sold_count::NUMERIC / v_total_comparisons::NUMERIC) * 100);
    END IF;

    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
    INTO v_domain_dist
    FROM (
      SELECT
        domain AS "domainId",
        domain AS "domainName",
        COUNT(*)::INT AS "count",
        ROUND((COUNT(*)::NUMERIC / GREATEST(v_total_comparisons, 1)) * 100) AS "percentage"
      FROM public.analysis_history
      WHERE user_id = v_caller_id
        AND created_at >= v_since_date
      GROUP BY domain
      ORDER BY count DESC
    ) d;

  ELSIF v_role = 'ally_admin' AND NOT v_is_super THEN
    SELECT
      COUNT(*)::INT,
      COUNT(CASE WHEN metadata->>'status' IN ('SOLD', 'ACCEPTED') OR total_score >= 85 THEN 1 END)::INT,
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_avg_process_time
    FROM public.analysis_history
    WHERE org_id = v_org_id
      AND created_at >= v_since_date;

    IF v_total_comparisons > 0 THEN
      v_conversion_rate := ROUND((v_sold_count::NUMERIC / v_total_comparisons::NUMERIC) * 100);
    END IF;

    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
    INTO v_domain_dist
    FROM (
      SELECT
        domain AS "domainId",
        domain AS "domainName",
        COUNT(*)::INT AS "count",
        ROUND((COUNT(*)::NUMERIC / GREATEST(v_total_comparisons, 1)) * 100) AS "percentage"
      FROM public.analysis_history
      WHERE org_id = v_org_id
        AND created_at >= v_since_date
      GROUP BY domain
      ORDER BY count DESC
    ) d;

    SELECT COALESCE(jsonb_agg(a), '[]'::jsonb)
    INTO v_analyst_perf
    FROM (
      SELECT
        om.user_id AS "analystId",
        COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)) AS "analystName",
        COUNT(ah.id)::INT AS "totalComparisons",
        COUNT(CASE WHEN ah.metadata->>'status' IN ('SOLD', 'ACCEPTED') OR ah.total_score >= 85 THEN 1 END)::INT AS "soldCount",
        CASE
          WHEN COUNT(ah.id) > 0 THEN ROUND((COUNT(CASE WHEN ah.metadata->>'status' IN ('SOLD', 'ACCEPTED') OR ah.total_score >= 85 THEN 1 END)::NUMERIC / COUNT(ah.id)::NUMERIC) * 100)
          ELSE 0
        END AS "conversionRate",
        0 AS "totalPremium",
        COALESCE(ROUND(AVG(ah.processing_time_ms) / 60000), 12)::INT AS "avgTimeMinutes",
        COALESCE(MODE() WITHIN GROUP (ORDER BY ah.domain), 'pyme') AS "topDomain"
      FROM public.organization_members om
      JOIN auth.users u ON om.user_id = u.id::text
      LEFT JOIN public.analysis_history ah ON ah.user_id = om.user_id AND ah.created_at >= v_since_date
      WHERE om.org_id = v_org_id
      GROUP BY om.user_id, u.raw_user_meta_data, u.email
      ORDER BY "totalComparisons" DESC
    ) a;

  ELSE
    SELECT
      COUNT(*)::INT,
      COUNT(CASE WHEN metadata->>'status' IN ('SOLD', 'ACCEPTED') OR total_score >= 85 THEN 1 END)::INT,
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_avg_process_time
    FROM public.analysis_history
    WHERE created_at >= v_since_date;

    IF v_total_comparisons > 0 THEN
      v_conversion_rate := ROUND((v_sold_count::NUMERIC / v_total_comparisons::NUMERIC) * 100);
    END IF;

    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
    INTO v_domain_dist
    FROM (
      SELECT
        domain AS "domainId",
        domain AS "domainName",
        COUNT(*)::INT AS "count",
        ROUND((COUNT(*)::NUMERIC / GREATEST(v_total_comparisons, 1)) * 100) AS "percentage"
      FROM public.analysis_history
      WHERE created_at >= v_since_date
      GROUP BY domain
      ORDER BY count DESC
    ) d;

    SELECT jsonb_build_object(
      'totalSnapshots', COUNT(*),
      'activeDomains', COUNT(DISTINCT domain),
      'activeInsurers', COUNT(DISTINCT insurer_name),
      'monthlyIngestionRate', COUNT(CASE WHEN anonymized_at >= now() - INTERVAL '30 days' THEN 1 END),
      'avgMarketScore', COALESCE(ROUND(AVG(score)), 0)
    )
    INTO v_daas_metrics
    FROM public.daas_market_snapshots;
  END IF;

  SELECT COALESCE(jsonb_agg(ins), '[]'::jsonb)
  INTO v_insurer_dist
  FROM (
    SELECT
      insurer_name AS "insurerName",
      COUNT(*)::INT AS "count",
      ROUND((COUNT(*)::NUMERIC / GREATEST((SELECT COUNT(*) FROM public.daas_market_snapshots), 1)) * 100) AS "percentage"
    FROM public.daas_market_snapshots
    GROUP BY insurer_name
    ORDER BY count DESC
    LIMIT 8
  ) ins;

  v_result := jsonb_build_object(
    'role', v_role,
    'totalComparisons', v_total_comparisons,
    'soldCount', v_sold_count,
    'conversionRate', v_conversion_rate,
    'totalPremium', v_total_premium,
    'avgProcessTimeMinutes', v_avg_process_time,
    'domainDistribution', v_domain_dist,
    'insurerDistribution', v_insurer_dist,
    'analystPerformance', v_analyst_perf,
    'daasMetrics', v_daas_metrics,
    'timeframeDays', p_timeframe_days,
    'generatedAt', now()
  );

  RETURN v_result;
END;
$$;

-- 5. Revoke PUBLIC / anon / authenticated EXECUTE on privileged RPCs --------
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_organization_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_organization_directory() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_executive_analytics_summary(INT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_executive_analytics_summary(INT, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_daas_market_index(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daas_market_index(TEXT, INT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_org_client_directory(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_client_directory(UUID, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ingest_analysis_row_to_daas(UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_analysis_row_to_daas(UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ) TO service_role;

REVOKE EXECUTE ON FUNCTION public.verify_daas_api_key(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_daas_api_key(TEXT) TO service_role;

-- 6. Fix self-referencing `cs.client_id = id` in clients Opción A RLS --------
DROP POLICY IF EXISTS "Users can select own clients" ON public.clients;
CREATE POLICY "Users can select own clients" ON public.clients FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_admin(org_id))
    OR assigned_to = (SELECT auth.uid())
    OR (assigned_to IS NULL AND user_id = ((SELECT auth.uid())::text))
    OR EXISTS (
      SELECT 1 FROM public.client_shares cs
      WHERE cs.client_id = public.clients.id
        AND cs.shared_with_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_admin(org_id))
    OR assigned_to = (SELECT auth.uid())
    OR (assigned_to IS NULL AND user_id = ((SELECT auth.uid())::text))
    OR EXISTS (
      SELECT 1 FROM public.client_shares cs
      WHERE cs.client_id = public.clients.id
        AND cs.shared_with_user_id = (SELECT auth.uid())
        AND cs.permission = 'edit'
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_admin(org_id))
    OR assigned_to = (SELECT auth.uid())
    OR (assigned_to IS NULL AND user_id = ((SELECT auth.uid())::text))
    OR EXISTS (
      SELECT 1 FROM public.client_shares cs
      WHERE cs.client_id = public.clients.id
        AND cs.shared_with_user_id = (SELECT auth.uid())
        AND cs.permission = 'edit'
    )
  );

-- 7. Remove public anonymous exposure from analysis_history SELECT policy ----
DROP POLICY IF EXISTS "Users can view own analysis history" ON public.analysis_history;
CREATE POLICY "Users can view own analysis history" ON public.analysis_history FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );
