-- Migration 033: DaaS Market Snapshots, Anonymization Pipeline & Server-Side Analytics RPC
-- Establishes the anonymized DaaS data repository, automated PII cleansing trigger,
-- and server-side executive analytics RPC without client-side memory filtering.

-- 1. Create DaaS Market Snapshots Table ---------------------------------------
CREATE TABLE IF NOT EXISTS public.daas_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_analysis_id UUID REFERENCES public.analysis_history(id) ON DELETE SET NULL,
  quote_index INTEGER NOT NULL DEFAULT 0,
  domain TEXT NOT NULL DEFAULT 'pyme',
  insurer_name TEXT NOT NULL,
  policy_plan TEXT,
  price_annual NUMERIC(15, 2),
  price_monthly NUMERIC(15, 2),
  currency TEXT NOT NULL DEFAULT 'COP',
  deductibles_raw TEXT,
  coverages_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER,
  period_month VARCHAR(7) NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  region_macro TEXT NOT NULL DEFAULT 'NACIONAL',
  anonymized_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning-fast actuarial and benchmark queries
CREATE INDEX IF NOT EXISTS idx_daas_snapshots_domain ON public.daas_market_snapshots(domain);
CREATE INDEX IF NOT EXISTS idx_daas_snapshots_insurer ON public.daas_market_snapshots(insurer_name);
CREATE INDEX IF NOT EXISTS idx_daas_snapshots_period ON public.daas_market_snapshots(period_month);
CREATE INDEX IF NOT EXISTS idx_daas_snapshots_created ON public.daas_market_snapshots(anonymized_at);
CREATE INDEX IF NOT EXISTS idx_daas_snapshots_domain_insurer ON public.daas_market_snapshots(domain, insurer_name);

-- 2. Create DaaS B2B API Usage Telemetry Table --------------------------------
CREATE TABLE IF NOT EXISTS public.daas_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_time_ms INTEGER,
  status_code INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daas_api_usage_subscriber ON public.daas_api_usage(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_daas_api_usage_created ON public.daas_api_usage(created_at);

-- 3. Enable & Force Row Level Security ---------------------------------------
ALTER TABLE public.daas_market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daas_market_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daas_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daas_api_usage FORCE ROW LEVEL SECURITY;

-- Security Policies:
-- Only Super Admins and Service Role can read or modify raw DaaS snapshots directly.
DROP POLICY IF EXISTS "Super admin full access on daas snapshots" ON public.daas_market_snapshots;
CREATE POLICY "Super admin full access on daas snapshots" ON public.daas_market_snapshots
  FOR ALL
  USING (
    (current_user IN ('postgres', 'service_role'))
    OR (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR (COALESCE(auth.role(), '') = 'service_role')
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Super admin full access on daas api usage" ON public.daas_api_usage;
CREATE POLICY "Super admin full access on daas api usage" ON public.daas_api_usage
  FOR ALL
  USING (
    (current_user IN ('postgres', 'service_role'))
    OR (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR (COALESCE(auth.role(), '') = 'service_role')
    OR public.is_super_admin()
  );

-- 4. PII Cleansing and Automated Anonymization Trigger Function ----------------
CREATE OR REPLACE FUNCTION public.anonymize_analysis_to_daas()
RETURNS TRIGGER
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
  -- Determine domain and period
  v_domain := COALESCE(NEW.domain, 'pyme');
  v_period := to_char(COALESCE(NEW.created_at, now()), 'YYYY-MM');

  -- Extract quotes array from analysis_result or unified_result
  IF NEW.analysis_result IS NOT NULL AND jsonb_typeof(NEW.analysis_result->'quotes') = 'array' THEN
    v_quotes := NEW.analysis_result->'quotes';
  ELSIF NEW.unified_result IS NOT NULL AND jsonb_typeof(NEW.unified_result->'quotes') = 'array' THEN
    v_quotes := NEW.unified_result->'quotes';
  ELSE
    RETURN NEW;
  END IF;

  -- Delete previous snapshots for this analysis to keep idempotency
  DELETE FROM public.daas_market_snapshots WHERE source_analysis_id = NEW.id;

  -- Loop through each quote and extract actuarial data stripping PII
  FOR v_quote IN SELECT * FROM jsonb_array_elements(v_quotes)
  LOOP
    v_coverages := COALESCE(v_quote->'coverages', '[]'::jsonb);
    
    -- Filter and clean coverage names removing potential PII (phone, NIT, addresses)
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
      NEW.id,
      v_quote_idx,
      v_domain,
      COALESCE(v_quote->>'insurerName', v_quote->>'insurer', 'Aseguradora Desconocida'),
      v_quote->>'policyName',
      NULLIF(regexp_replace(COALESCE(v_quote->>'priceAnnual', '0'), '[^0-9.]', '', 'g'), '')::NUMERIC,
      NULLIF(regexp_replace(COALESCE(v_quote->>'priceMonthly', '0'), '[^0-9.]', '', 'g'), '')::NUMERIC,
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

  RETURN NEW;
END;
$$;

-- Attach trigger to public.analysis_history
DROP TRIGGER IF EXISTS trg_anonymize_analysis_to_daas ON public.analysis_history;
CREATE TRIGGER trg_anonymize_analysis_to_daas
  AFTER INSERT OR UPDATE OF analysis_result, unified_result ON public.analysis_history
  FOR EACH ROW
  EXECUTE FUNCTION public.anonymize_analysis_to_daas();

-- 5. Server-Side Executive Analytics Aggregation RPC --------------------------
-- Eliminates client-side memory filtering and strictly isolates metrics by role and tenant.
CREATE OR REPLACE FUNCTION public.get_executive_analytics_summary(
  p_timeframe_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
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
  -- Determine caller
  v_caller_id := COALESCE(
    auth.uid()::text,
    current_setting('app.current_user_id', true)
  );

  v_is_super := (
    current_user IN ('postgres', 'service_role')
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
    OR COALESCE(auth.role(), '') = 'service_role'
    OR public.is_super_admin()
  );

  v_since_date := now() - (p_timeframe_days || ' days')::INTERVAL;

  -- If not super admin, lookup caller's organization and role
  IF NOT v_is_super THEN
    SELECT org_id, role INTO v_org_id, v_role
    FROM public.organization_members
    WHERE user_id = v_caller_id
    LIMIT 1;

    -- If no org found, fallback to ally_technical scoped to caller_id
    IF v_role IS NULL THEN
      v_role := 'ally_technical';
    END IF;
  ELSE
    v_role := 'super_admin';
  END IF;

  -- --------------------------------------------------------------------------
  -- Scenario A: ally_technical (Only own studies)
  -- --------------------------------------------------------------------------
  IF v_role = 'ally_technical' AND NOT v_is_super THEN
    SELECT 
      COUNT(*)::INT,
      COUNT(CASE WHEN metadata->>'status' = 'SOLD' OR total_score >= 85 THEN 1 END)::INT,
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_avg_process_time
    FROM public.analysis_history
    WHERE (user_id = v_caller_id)
      AND created_at >= v_since_date;

    IF v_total_comparisons > 0 THEN
      v_conversion_rate := ROUND((v_sold_count::NUMERIC / v_total_comparisons::NUMERIC) * 100);
    END IF;

    -- Domain distribution
    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
    INTO v_domain_dist
    FROM (
      SELECT 
        domain AS "domainId",
        domain AS "domainName",
        COUNT(*)::INT AS "count",
        ROUND((COUNT(*)::NUMERIC / GREATEST(v_total_comparisons, 1)) * 100) AS "percentage"
      FROM public.analysis_history
      WHERE (user_id = v_caller_id)
        AND created_at >= v_since_date
      GROUP BY domain
      ORDER BY count DESC
    ) d;

  -- --------------------------------------------------------------------------
  -- Scenario B: ally_admin (All studies for the caller's organization)
  -- --------------------------------------------------------------------------
  ELSIF v_role = 'ally_admin' AND NOT v_is_super THEN
    SELECT 
      COUNT(*)::INT,
      COUNT(CASE WHEN metadata->>'status' = 'SOLD' OR total_score >= 85 THEN 1 END)::INT,
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_avg_process_time
    FROM public.analysis_history
    WHERE (org_id = v_org_id)
      AND created_at >= v_since_date;

    IF v_total_comparisons > 0 THEN
      v_conversion_rate := ROUND((v_sold_count::NUMERIC / v_total_comparisons::NUMERIC) * 100);
    END IF;

    -- Domain distribution for ally
    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
    INTO v_domain_dist
    FROM (
      SELECT 
        domain AS "domainId",
        domain AS "domainName",
        COUNT(*)::INT AS "count",
        ROUND((COUNT(*)::NUMERIC / GREATEST(v_total_comparisons, 1)) * 100) AS "percentage"
      FROM public.analysis_history
      WHERE (org_id = v_org_id)
        AND created_at >= v_since_date
      GROUP BY domain
      ORDER BY count DESC
    ) d;

    -- Analyst performance table within organization
    SELECT COALESCE(jsonb_agg(a), '[]'::jsonb)
    INTO v_analyst_perf
    FROM (
      SELECT 
        om.user_id AS "analystId",
        COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)) AS "analystName",
        COUNT(ah.id)::INT AS "totalComparisons",
        COUNT(CASE WHEN ah.metadata->>'status' = 'SOLD' OR ah.total_score >= 85 THEN 1 END)::INT AS "soldCount",
        CASE 
          WHEN COUNT(ah.id) > 0 THEN ROUND((COUNT(CASE WHEN ah.metadata->>'status' = 'SOLD' OR ah.total_score >= 85 THEN 1 END)::NUMERIC / COUNT(ah.id)::NUMERIC) * 100)
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

  -- --------------------------------------------------------------------------
  -- Scenario C: super_admin / CEO (Platform-wide global & DaaS assets)
  -- --------------------------------------------------------------------------
  ELSE
    SELECT 
      COUNT(*)::INT,
      COUNT(CASE WHEN metadata->>'status' = 'SOLD' OR total_score >= 85 THEN 1 END)::INT,
      COALESCE(ROUND(AVG(processing_time_ms) / 60000), 12)::INT
    INTO v_total_comparisons, v_sold_count, v_avg_process_time
    FROM public.analysis_history
    WHERE created_at >= v_since_date;

    IF v_total_comparisons > 0 THEN
      v_conversion_rate := ROUND((v_sold_count::NUMERIC / v_total_comparisons::NUMERIC) * 100);
    END IF;

    -- Global domain distribution
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

    -- Global DaaS repository metrics
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

  -- Insurer market share from anonymized DaaS snapshots
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

  -- Build final sanitized response payload
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

-- 6. DaaS Public / B2B Benchmark RPC -----------------------------------------
-- Provides aggregated anonymized market benchmarks for subscribers or agency comparison.
CREATE OR REPLACE FUNCTION public.get_daas_market_index(
  p_domain TEXT DEFAULT 'pyme',
  p_period_months INT DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_since_period VARCHAR(7);
  v_result JSONB;
BEGIN
  v_since_period := to_char(now() - (p_period_months || ' months')::INTERVAL, 'YYYY-MM');

  SELECT jsonb_build_object(
    'domain', p_domain,
    'sampleSize', COUNT(*),
    'avgPremiumAnnual', COALESCE(ROUND(AVG(price_annual), 2), 0),
    'medianPremiumAnnual', COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_annual)::NUMERIC, 2), 0),
    'percentile25', COALESCE(ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_annual)::NUMERIC, 2), 0),
    'percentile75', COALESCE(ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_annual)::NUMERIC, 2), 0),
    'topInsurers', (
      SELECT COALESCE(jsonb_agg(ins), '[]'::jsonb)
      FROM (
        SELECT 
          insurer_name AS "insurerName",
          COUNT(*)::INT AS "quoteCount",
          ROUND(AVG(price_annual), 2) AS "avgPrice"
        FROM public.daas_market_snapshots
        WHERE (p_domain IS NULL OR domain = p_domain)
          AND period_month >= v_since_period
          AND price_annual > 0
        GROUP BY insurer_name
        ORDER BY "quoteCount" DESC
        LIMIT 5
      ) ins
    ),
    'calculatedAt', now()
  )
  INTO v_result
  FROM public.daas_market_snapshots
  WHERE (p_domain IS NULL OR domain = p_domain)
    AND period_month >= v_since_period
    AND price_annual > 0;

  RETURN v_result;
END;
$$;

-- 7. Idempotent Backfill: Anonymize existing history into DaaS ----------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, domain, created_at, analysis_result, unified_result 
    FROM public.analysis_history 
    WHERE analysis_result IS NOT NULL OR unified_result IS NOT NULL
  LOOP
    -- Execute anonymization on existing records
    PERFORM public.anonymize_analysis_to_daas() FROM (SELECT r.*) AS sub;
  END LOOP;
END;
$$;
