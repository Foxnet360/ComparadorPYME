/**
 * Review Queue Controller
 * Expone el endpoint para consultar coberturas que requieren revisión humana.
 */

import { Request, Response } from 'express';
import { supabase } from '../config/database';

interface ReviewQueueFilters {
  insurer?: string;
  from?: string;
  to?: string;
  domain?: string;
  page: number;
  limit: number;
}

function parseFilters(req: Request): ReviewQueueFilters {
  const rawPage = parseInt(req.query.page as string, 10);
  const rawLimit = parseInt(req.query.limit as string, 10);

  return {
    insurer: (req.query.insurer as string) || undefined,
    from: (req.query.from as string) || undefined,
    to: (req.query.to as string) || undefined,
    domain: (req.query.domain as string) || undefined,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    limit: Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 20,
  };
}

export const getReviewQueueCoverages = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = parseFilters(req);
    const fromIdx = (filters.page - 1) * filters.limit;
    const toIdx = fromIdx + filters.limit - 1;

    let query = supabase
      .from('coverage_mappings')
      .select('*', { count: 'exact' })
      .eq('needs_human_review', true);

    if (filters.insurer) {
      query = query.ilike('insurer_name', `%${filters.insurer}%`);
    }

    if (filters.from) {
      query = query.gte('created_at', filters.from);
    }

    if (filters.to) {
      query = query.lte('created_at', filters.to);
    }

    if (filters.domain) {
      query = query.eq('domain', filters.domain);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (error) {
      console.error('❌ [ReviewQueue] Database error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to query review queue',
        details: error.message,
      });
      return;
    }

    const records = (data || []).map((record: any) => ({
      id: record.id,
      rawName: record.raw_name,
      insurerName: record.insurer_name,
      domain: record.domain,
      confidence: record.confidence,
      createdAt: record.created_at,
    }));

    res.json({
      success: true,
      data: records,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: count || 0,
      },
    });
  } catch (err: any) {
    console.error('❌ [ReviewQueue] Unexpected error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error while querying review queue',
      details: err?.message || 'Unknown error',
    });
  }
};
