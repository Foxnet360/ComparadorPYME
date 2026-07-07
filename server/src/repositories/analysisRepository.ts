/**
 * Analysis Repository
 * Database operations for analysis_history table
 */

import { supabase, handleDbError } from './baseRepository';
import { QuoteAnalysis } from '../types';

export interface AnalysisHistoryRecord {
  id?: string;
  user_id?: string;
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
  // Unified comparison fields
  engine_type?: 'legacy' | 'unified' | 'fallback';
  processing_time_ms?: number;
  confidence_score?: number;
  unified_result?: unknown;
  fallback_reason?: string;
}

export async function saveAnalysisHistory(data: Record<string, unknown>): Promise<string | null> {
  const { data: result, error } = await supabase
    .from('analysis_history')
    .insert(data as never)
    .select('id')
    .single();

  if (error) {
    console.error('❌ [AnalysisRepository] Failed to save analysis:', error);
    return null;
  }

  return (result as { id?: string })?.id || null;
}

export async function getAnalysisHistoryByUser(userId: string): Promise<AnalysisHistoryRecord[]> {
  const { data, error } = await supabase
    .from('analysis_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    handleDbError(error, 'Failed to fetch analysis history');
  }

  return data || [];
}

export async function getAnalysisById(id: string): Promise<AnalysisHistoryRecord | null> {
  const { data, error } = await supabase.from('analysis_history').select('*').eq('id', id).single();

  if (error) {
    handleDbError(error, 'Failed to fetch analysis by id');
  }

  return data as AnalysisHistoryRecord | null;
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
