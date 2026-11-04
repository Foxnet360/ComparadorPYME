/**
 * Analysis Repository
 * Database operations for analysis_history table
 */

import { supabase, handleDbError } from './baseRepository';
import { QuoteAnalysis } from '../types';

export interface AnalysisHistoryRecord {
  id?: string;
  user_id?: string | null;
  quotes_count?: number;
  total_coverages?: number;
  average_confidence?: number;
  best_insurer?: string;
  best_score?: number;
  price_range_min?: number;
  price_range_max?: number;
  extraction_confidence?: number;
  needs_review?: boolean;
  validation_flags_count?: number;
  client_name?: string;
  analysis_result?: { quotes?: QuoteAnalysis[]; [key: string]: unknown };
  recommendation?: string | null;
  total_score?: number | null;
  quote_document_ids?: string[] | null;
  clause_document_ids?: string[] | null;
  created_at?: string;
  domain?: string;
  metadata?: Record<string, unknown>;
  // Unified comparison fields
  engine_type?: 'legacy' | 'unified' | 'fallback';
  processing_time_ms?: number;
  confidence_score?: number;
  unified_result?: unknown;
  fallback_reason?: string;
}

export async function saveAnalysisHistory(data: Record<string, unknown>): Promise<string | null> {
  // Strip non-existent/phantom columns to prevent PostgREST PGRST204 errors
  const {
    quotes_count: _qc,
    total_coverages: _tc,
    average_confidence: _ac,
    best_insurer: _bi,
    best_score: _bs,
    price_range_min: _pmin,
    price_range_max: _pmax,
    ...payload
  } = data;

  let { data: result, error } = await supabase
    .from('analysis_history')
    .insert(payload as never)
    .select('id')
    .single();

  if (error) {
    console.warn(
      `⚠️ [AnalysisRepository] Insert failed (${error.code || 'schema_error'}: ${error.message}). Retrying with resilient schema...`
    );

    const resilientPayload = {
      user_id: payload.user_id || 'anonymous',
      org_id: payload.org_id || null,
      client_name: payload.client_name || 'Cliente Desconocido',
      domain: payload.domain || 'pyme',
      metadata: payload.metadata || {},
      analysis_result: payload.analysis_result || payload.unified_result || {},
      recommendation: payload.recommendation || null,
      total_score: payload.total_score || null,
      correlation_id: payload.correlation_id || null,
      engine_type: payload.engine_type || null,
      processing_time_ms: payload.processing_time_ms || null,
      confidence_score: payload.confidence_score || null,
      unified_result: payload.unified_result || null,
      fallback_reason: payload.fallback_reason || null,
      policy_id: payload.policy_id || null,
      renewal_id: payload.renewal_id || null,
      analysis_type: payload.analysis_type || null,
    };

    const retryRes = await supabase
      .from('analysis_history')
      .insert(resilientPayload as never)
      .select('id')
      .single();

    result = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error('❌ [AnalysisRepository] Failed to save analysis:', error);
    return null;
  }

  const savedId = (result as unknown as { id?: string })?.id || null;

  // Background DaaS ingestion worker (non-blocking, fail-soft)
  if (savedId) {
    try {
      import('../services/analyticsAggregationService')
        .then(({ analyticsAggregationService }) => {
          analyticsAggregationService.ingestAnalysisToDaas({ id: savedId, ...payload }).catch((err) => {
            console.warn('[AnalysisRepository] Background DaaS ingestion failed:', err);
          });
        })
        .catch(() => {});
    } catch {
      // Fire-and-forget
    }
  }

  return savedId;
}

export async function getAnalysisHistoryByUser(
  userId: string,
  orgId?: string,
  role?: string,
  limit?: number,
  offset?: number
): Promise<{ data: AnalysisHistoryRecord[]; total: number }> {
  let countQuery = supabase.from('analysis_history').select('*', { count: 'exact', head: true });
  let dataQuery = supabase.from('analysis_history').select('*');

  // Enforce tenant/user isolation: NEVER leak anonymous/null user analyses across organizations
  if (role === 'super_admin') {
    // Super admin sees all platform analyses
  } else if (role === 'ally_admin' && orgId) {
    countQuery = countQuery.eq('org_id', orgId);
    dataQuery = dataQuery.eq('org_id', orgId);
  } else if (userId && userId !== 'all' && userId !== 'anonymous') {
    countQuery = countQuery.eq('user_id', userId);
    dataQuery = dataQuery.eq('user_id', userId);
  } else {
    // Unauthenticated/anonymous caller: only see own empty set
    return { data: [], total: 0 };
  }

  const { count } = await countQuery;
  const total = count || 0;

  dataQuery = dataQuery.order('created_at', { ascending: false });

  if (limit !== undefined && offset !== undefined) {
    dataQuery = dataQuery.range(offset, offset + limit - 1);
  }

  const { data, error } = await dataQuery;

  if (error) {
    handleDbError(error, 'Failed to fetch analysis history');
  }

  return {
    data: (data || []) as unknown as AnalysisHistoryRecord[],
    total,
  };
}

export async function getAnalysisById(id: string): Promise<AnalysisHistoryRecord | null> {
  const { data, error } = await supabase.from('analysis_history').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to fetch analysis by id');
  }

  return (data as unknown as AnalysisHistoryRecord) || null;
}

interface EngineMetricsRecord {
  engine_type: string;
  processing_time_ms: number | null;
  confidence_score: number | null;
}

/**
 * Get unified engine metrics for monitoring
 */
export async function getUnifiedEngineMetrics(
  since: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
): Promise<{
  total: number;
  unified: number;
  legacy: number;
  fallback: number;
  successRate: number;
  fallbackRate: number;
  avgProcessingTimeMs: number;
  avgConfidenceScore: number;
}> {
  const { data, error } = await supabase
    .from('analysis_history' as never)
    .select('engine_type, processing_time_ms, confidence_score')
    .gte('created_at', since.toISOString())
    .not('engine_type', 'is', null);

  if (error || !data || (data as EngineMetricsRecord[]).length === 0) {
    return {
      total: 0,
      unified: 0,
      legacy: 0,
      fallback: 0,
      successRate: 0,
      fallbackRate: 0,
      avgProcessingTimeMs: 0,
      avgConfidenceScore: 0,
    };
  }

  const records = data as EngineMetricsRecord[];
  const total = records.length;
  const unified = records.filter((r: EngineMetricsRecord) => r.engine_type === 'unified').length;
  const legacy = records.filter((r: EngineMetricsRecord) => r.engine_type === 'legacy').length;
  const fallback = records.filter((r: EngineMetricsRecord) => r.engine_type === 'fallback').length;

  const processingTimes = records
    .filter(
      (r: EngineMetricsRecord) =>
        typeof r.processing_time_ms === 'number' && r.processing_time_ms > 0
    )
    .map((r: EngineMetricsRecord) => r.processing_time_ms as number);

  const confidenceScores = records
    .filter(
      (r: EngineMetricsRecord) => typeof r.confidence_score === 'number' && r.confidence_score > 0
    )
    .map((r: EngineMetricsRecord) => r.confidence_score as number);

  return {
    total,
    unified,
    legacy,
    fallback,
    successRate: total > 0 ? Math.round(((unified + legacy) / total) * 100) : 0,
    fallbackRate: total > 0 ? Math.round((fallback / total) * 100) : 0,
    avgProcessingTimeMs:
      processingTimes.length > 0
        ? Math.round(
            processingTimes.reduce((a: number, b: number) => a + b, 0) / processingTimes.length
          )
        : 0,
    avgConfidenceScore:
      confidenceScores.length > 0
        ? Math.round(
            confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length
          )
        : 0,
  };
}
