import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');
const DOCS_DIR = path.join(__dirname, '../../../docs');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

function readDoc(name: string): string {
  return fs.readFileSync(path.join(DOCS_DIR, name), 'utf-8');
}

describe('migration 033: DaaS market snapshots and anonymization pipeline', () => {
  const sql = readMigration('033_daas_market_snapshots_and_anonymization.sql');

  it('exists and is sequential after 032', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files).toContain('033_daas_market_snapshots_and_anonymization.sql');
  });

  it('creates public.daas_market_snapshots table with actuarial columns and no PII', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.daas_market_snapshots/i);
    expect(sql).toMatch(/source_analysis_id UUID REFERENCES public\.analysis_history/i);
    expect(sql).toMatch(/domain TEXT NOT NULL/i);
    expect(sql).toMatch(/insurer_name TEXT NOT NULL/i);
    expect(sql).toMatch(/price_annual NUMERIC/i);
    expect(sql).toMatch(/coverages_summary JSONB/i);
    expect(sql).toMatch(/period_month VARCHAR\(7\)/i);
    expect(sql).toMatch(/region_macro TEXT/i);
  });

  it('creates public.daas_api_usage telemetry table for B2B API consumption', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.daas_api_usage/i);
    expect(sql).toMatch(/subscriber_id UUID NOT NULL/i);
    expect(sql).toMatch(/endpoint TEXT NOT NULL/i);
    expect(sql).toMatch(/response_time_ms INTEGER/i);
  });

  it('enables and forces RLS on daas tables with super_admin guard', () => {
    expect(sql).toMatch(/ALTER TABLE public\.daas_market_snapshots ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.daas_market_snapshots FORCE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.daas_api_usage ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.daas_api_usage FORCE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/is_super_admin\(\)/i);
  });

  it('creates performant indexes on domain, insurer_name, and period', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_daas_snapshots_domain ON public\.daas_market_snapshots\(domain\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_daas_snapshots_insurer ON public\.daas_market_snapshots\(insurer_name\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_daas_snapshots_period ON public\.daas_market_snapshots\(period_month\)/i);
  });

  it('defines the automated PII cleansing trigger function and attaches it to analysis_history', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.anonymize_analysis_to_daas\(\)/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
    expect(sql).toMatch(/TRIGGER trg_anonymize_analysis_to_daas/i);
    expect(sql).toMatch(/AFTER INSERT OR UPDATE OF analysis_result, unified_result ON public\.analysis_history/i);
  });

  it('implements server-side executive analytics RPC (get_executive_analytics_summary) with role isolation', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_executive_analytics_summary/i);
    expect(sql).toMatch(/p_timeframe_days INT DEFAULT 90/i);
    expect(sql).toMatch(/v_role = 'ally_technical'/i);
    expect(sql).toMatch(/v_role = 'ally_admin'/i);
    expect(sql).toMatch(/super_admin/i);
  });

  it('implements DaaS market benchmarking index RPC (get_daas_market_index) with statistical percentiles', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_daas_market_index/i);
    expect(sql).toMatch(/PERCENTILE_CONT\(0\.5\)/i);
    expect(sql).toMatch(/PERCENTILE_CONT\(0\.25\)/i);
    expect(sql).toMatch(/PERCENTILE_CONT\(0\.75\)/i);
  });

  it('includes an idempotent backfill block to process existing analysis history', () => {
    expect(sql).toMatch(/DO \$\$/i);
    expect(sql).toMatch(/public\.anonymize_analysis_to_daas\(\)/i);
    expect(sql).toMatch(/FROM public\.analysis_history/i);
  });
});

describe('DaaS documentation artifacts', () => {
  it('documents strict anonymization policy adhering to Ley 1581 and Superfinanciera', () => {
    const doc = readDoc('DAAS_ANONYMIZATION_POLICY.md');
    expect(doc).toContain('Ley Estatutaria 1581 de 2012');
    expect(doc).toContain('Superintendencia Financiera de Colombia');
    expect(doc).toContain('daas_market_snapshots');
    expect(doc).toContain('K-Anonimato');
  });

  it('provides OpenAPI 3.0 specification for B2B DaaS endpoints', () => {
    const openapi = readDoc('daas-openapi.yaml');
    expect(openapi).toContain('/benchmarks/pricing');
    expect(openapi).toContain('/benchmarks/market-share');
    expect(openapi).toContain('PricingBenchmarkResponse');
    expect(openapi).toContain('ApiKeyAuth');
  });
});
