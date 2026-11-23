-- ============================================================================
-- Migration 037: Real Analytics Premium/Conversion Metrics & Outbound Webhooks
-- ============================================================================

-- 1. Extract winning/selected annual premium from converted analysis records
CREATE OR REPLACE FUNCTION public.extract_analysis_sold_premium(
  p_metadata JSONB,
  p_analysis_result JSONB,
  p_unified_result JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw TEXT;
  v_quotes JSONB;
  v_quote_price NUMERIC := 0;
BEGIN
  v_raw := COALESCE(
    NULLIF(TRIM(p_metadata->>'selectedPremium'), ''),
    NULLIF(TRIM(p_metadata->>'finalPremium'), ''),
    NULLIF(TRIM(p_metadata->>'premium'), '')
  );

  IF v_raw IS NOT NULL AND v_raw ~ '^[0-9]+(\.[0-9]+)?$' THEN
    RETURN v_raw::NUMERIC;
  END IF;

  v_quotes := COALESCE(
    CASE WHEN jsonb_typeof(p_analysis_result->'quotes') = 'array' THEN p_analysis_result->'quotes' END,
    CASE WHEN jsonb_typeof(p_unified_result->'quotes') = 'array' THEN p_unified_result->'quotes' END,
    '[]'::jsonb
  );

  SELECT COALESCE(NULLIF(TRIM(elem->>'priceAnnual'), ''), '0')::NUMERIC
  INTO v_quote_price
  FROM jsonb_array_elements(v_quotes) AS elem
  WHERE COALESCE(elem->>'priceAnnual', '') ~ '^[0-9]+(\.[0-9]+)?$'
  ORDER BY
    CASE WHEN COALESCE((elem->>'isWinner')::BOOLEAN, false) THEN 1 ELSE 0 END DESC,
    CASE WHEN COALESCE(elem->>'score', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (elem->>'score')::NUMERIC ELSE 0 END DESC
  LIMIT 1;

  RETURN COALESCE(v_quote_price, 0);
END;
$$;

-- 2. Upgrade get_executive_analytics_summary to compute real SOLD/ACCEPTED premiums
CREATE OR REPLACE FUNCTION public.get_executive_analytics_summary(
  p_timeframe_days INT DEFAULT 90,
  p_caller_id TEXT DEFAULT NULL,
  p_caller_role TEXT DEFAULT NULL,
  p_caller_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_service_role BOOLEAN := false;
  v_caller_id TEXT;
  v_is_super BOOLEAN := false;
  v_role TEXT := NULL;
  v_org_id UUID := NULL;
  v_since_date TIMESTAMPTZ;

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
      COALESCE(SUM(
        CASE
          WHEN metadata->>'status' IN ('SOLD', 'ACCEPTED') OR total_score >= 85
          THEN public.extract_analysis_sold_premium(metadata, analysis_result, unified_result)
          ELSE 0
        END
      ), 0),
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_total_premium, v_avg_process_time
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
      COALESCE(SUM(
        CASE
          WHEN metadata->>'status' IN ('SOLD', 'ACCEPTED') OR total_score >= 85
          THEN public.extract_analysis_sold_premium(metadata, analysis_result, unified_result)
          ELSE 0
        END
      ), 0),
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_total_premium, v_avg_process_time
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
        COALESCE(SUM(
          CASE
            WHEN ah.metadata->>'status' IN ('SOLD', 'ACCEPTED') OR ah.total_score >= 85
            THEN public.extract_analysis_sold_premium(ah.metadata, ah.analysis_result, ah.unified_result)
            ELSE 0
          END
        ), 0) AS "totalPremium",
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
      COALESCE(SUM(
        CASE
          WHEN metadata->>'status' IN ('SOLD', 'ACCEPTED') OR total_score >= 85
          THEN public.extract_analysis_sold_premium(metadata, analysis_result, unified_result)
          ELSE 0
        END
      ), 0),
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_total_premium, v_avg_process_time
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

  RETURN jsonb_build_object(
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_executive_analytics_summary(INT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_executive_analytics_summary(INT, TEXT, TEXT, UUID) TO authenticated, service_role;

-- 3. Outbound Webhook Subscriptions and Idempotent Delivery Log
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id UUID,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['analysis.completed', 'analysis.status_changed', 'renewal.status_changed']::TEXT[],
  signing_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INT NOT NULL DEFAULT 1,
  http_status INT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  CONSTRAINT webhook_deliveries_sub_event_unique UNIQUE (subscription_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_user_org
  ON public.webhook_subscriptions (user_id, org_id) WHERE is_active = true;

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_subscriptions_owner_select ON public.webhook_subscriptions;
CREATE POLICY webhook_subscriptions_owner_select ON public.webhook_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.is_super_admin());

DROP POLICY IF EXISTS webhook_subscriptions_owner_insert ON public.webhook_subscriptions;
CREATE POLICY webhook_subscriptions_owner_insert ON public.webhook_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text OR public.is_super_admin());

DROP POLICY IF EXISTS webhook_subscriptions_owner_delete ON public.webhook_subscriptions;
CREATE POLICY webhook_subscriptions_owner_delete ON public.webhook_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text OR public.is_super_admin());

DROP POLICY IF EXISTS webhook_deliveries_owner_select ON public.webhook_deliveries;
CREATE POLICY webhook_deliveries_owner_select ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_subscriptions s
      WHERE s.id = webhook_deliveries.subscription_id
        AND (s.user_id = auth.uid()::text OR public.is_super_admin())
    )
  );
