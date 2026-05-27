/**
 * Analysis Repository
 * Database operations for analysis_history table
 */

import { supabase, handleDbError, RepositoryError } from './baseRepository';

export interface AnalysisHistoryRecord {
  id?: string;
  user_id: string;
  quotes_count: number;
  total_coverages: number;
  average_confidence: number;
  best_insurer: string;
  best_score: number;
  price_range_min: number;
  price_range_max: number;
  extraction_confidence: number;
  needs_review: boolean;
  validation_flags_count: number;
  created_at?: string;
}

export async function saveAnalysisHistory(
  data: Record<string, any>
): Promise<string | null> {
  const { data: result, error } = await supabase
    .from('analysis_history' as any)
    .insert(data as any)
    .select('id')
    .single();

  if (error) {
    console.error('❌ [AnalysisRepository] Failed to save analysis:', error);
    return null;
  }

  return (result as any)?.id || null;
}

export async function getAnalysisHistoryByUser(
  userId: string
): Promise<AnalysisHistoryRecord[]> {
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

export async function getAnalysisById(
  id: string
): Promise<any> {
  const { data, error } = await supabase
    .from('analysis_history')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    handleDbError(error, 'Failed to fetch analysis by id');
  }

  return data;
}
