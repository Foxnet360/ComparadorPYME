import { supabase } from '../config/database';
import { embeddingService } from './vector/embeddingService';
import { deleteCacheValue, getCacheKeys, setCacheValue } from './cache/redisCache';
import { coverageGraphService } from './coverageGraphService';
import { featureFlags } from '../config/featureFlags';
import { normalizeText } from '../utils/textUtils';
import { GraphEdgeType } from '../schemas/templateRegistrySchema';

export interface UserCorrection {
  id?: string;
  rawName: string;
  insurerName?: string;
  systemMapping: string;
  userCorrection: string;
  correctionType: 'coverage_mapping' | 'deductible' | 'exclusion' | 'value';
  quoteId?: string;
  createdAt?: Date;
  // High certainty columns
  rawTextSnippet?: string;
  aiJustification?: string;
  pageNumber?: number;
}

export interface LearningMetrics {
  totalCorrections: number;
  correctionsByType: Record<string, number>;
  accuracyTrend: Array<{ date: string; accuracy: number }>;
  topCorrectedMappings: Array<{ rawName: string; count: number }>;
}

function parseEmbedding(val: unknown): number[] | null {
  if (!val) return null;
  if (Array.isArray(val)) return val as number[];
  if (typeof val === 'string') {
    try {
      const cleaned = val.replace(/[\][]/g, '').trim();
      if (!cleaned) return null;
      return cleaned.split(',').map(Number);
    } catch {
      return null;
    }
  }
  return null;
}

function sorensenDiceSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const val of bigrams1) {
    if (bigrams2.has(val)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

export const learningEngine = {
  /**
   * Realiza una búsqueda vectorial en memoria de las 3 correcciones de usuario anteriores más similares
   */
  async getSimilarCorrections(rawName: string): Promise<Array<Record<string, unknown>>> {
    try {
      const { data: corrections, error } = await supabase
        .from('coverage_mappings')
        .select('*')
        .eq('user_corrected', true)
        .limit(50);

      if (error || !corrections || corrections.length === 0) return [];

      let queryEmbedding: number[] | null = null;
      try {
        queryEmbedding = await embeddingService.generateEmbedding(rawName);
      } catch (_err) {
        console.warn(
          '⚠️ [LearningEngine] Could not generate query embedding, using Sørensen-Dice fallback'
        );
      }

      const similarityList: Array<{ correction: Record<string, unknown>; similarity: number }> = [];

      for (const correction of corrections as Array<Record<string, unknown>>) {
        let similarity = 0;
        const correctionEmb = parseEmbedding(correction.embedding);

        if (queryEmbedding && correctionEmb && queryEmbedding.length === correctionEmb.length) {
          similarity = embeddingService.cosineSimilarity(queryEmbedding, correctionEmb);
        } else {
          similarity = sorensenDiceSimilarity(rawName, String(correction.raw_name));
        }
        similarityList.push({ correction, similarity });
      }

      // Sort by similarity descending and take top 3
      similarityList.sort((a, b) => b.similarity - a.similarity);
      return similarityList.slice(0, 3).map((item) => item.correction);
    } catch (err) {
      console.error(
        '⚠️ [LearningEngine] Error recuperando ejemplos de aprendizaje pocos disparos:',
        err
      );
      return [];
    }
  },

  /**
   * Save a user correction
   */
  async saveCorrection(correction: UserCorrection): Promise<string> {
    try {
      let data, error;

      let embedding: number[] | null = null;
      try {
        embedding = await embeddingService.generateEmbedding(correction.rawName);
      } catch (embErr) {
        console.warn(
          '⚠️ [LearningEngine] Could not generate embedding for new correction:',
          embErr
        );
      }

      // Intento 1: Guardar con las nuevas columnas de alta certeza
      const res = await supabase
        .from('coverage_mappings')
        .upsert({
          raw_name: correction.rawName,
          insurer_name: correction.insurerName || '',
          canonical_name: correction.userCorrection,
          user_corrected: true,
          correction_count: 1,
          embedding: embedding || null,
          raw_text_snippet: correction.rawTextSnippet || null,
          ai_justification: correction.aiJustification || null,
          page_number: correction.pageNumber || null,
          needs_human_review: false,
          updated_at: new Date().toISOString(),
        } as unknown as never)
        .select('id')
        .single();

      data = res.data;
      error = res.error;

      if (error) {
        // Fallback: guardar solo columnas estándar en caso de que falten en el esquema
        console.warn(
          '⚠️ [LearningEngine DB] Faltan columnas en Supabase, usando columnas estándar:',
          error.message
        );
        const fallbackRes = await supabase
          .from('coverage_mappings')
          .upsert({
            raw_name: correction.rawName,
            insurer_name: correction.insurerName || '',
            canonical_name: correction.userCorrection,
            user_corrected: true,
            correction_count: 1,
            embedding: embedding || null,
            updated_at: new Date().toISOString(),
          } as unknown as never)
          .select('id')
          .single();

        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;

      console.log(
        `✅ [LearningEngine] Saved correction: "${correction.rawName}" → "${correction.userCorrection}"`
      );

      // Trigger async updates
      await this.applyCorrection(correction);

      return ((data as Record<string, unknown> | null)?.id as string) || '';
    } catch (error) {
      console.error('❌ [LearningEngine] Failed to save correction:', error);
      throw error;
    }
  },

  /**
   * Apply correction to system
   */
  async applyCorrection(correction: UserCorrection): Promise<void> {
    try {
      // 1. Update thesaurus
      await this.updateThesaurus(correction);

      // 2. Route coverage_mapping corrections to the graph only when graph
      // learning is explicitly enabled. This preserves the global kill-switch
      // for the unauthenticated /api/analysis/correction endpoint.
      if (correction.correctionType === 'coverage_mapping') {
        if (featureFlags.isEnabled('graphLearningEnabled')) {
          const raw = normalizeText(correction.rawName, true).replace(/\s+/g, ' ').trim();
          const canonical = correction.userCorrection.trim();
          const insurer = correction.insurerName || '';
          if (raw && canonical) {
            await coverageGraphService.learnCorrection(raw, canonical, insurer, 'pyme');
            console.log(`🌐 [LearningEngine] Graph learned: "${raw}" → "${canonical}"`);
          }
        } else {
          console.log(
            `🌐 [LearningEngine] Skipping graph learning for coverage_mapping because graphLearningEnabled is disabled`
          );
        }
      }

      // 3. Update embeddings if significant
      if (correction.correctionType === 'coverage_mapping') {
        await this.updateEmbedding(correction);
      }

      // 4. Invalidate cache
      await this.invalidateCache(correction);

      // 5. Update ontology if needed
      await this.updateOntology(correction);

      // 6. Write graph edge for non-coverage types only when graph learning is enabled
      await this.updateGraph(correction);
    } catch (error) {
      console.error('❌ [LearningEngine] Failed to apply correction:', error);
    }
  },

  /**
   * Update thesaurus with new synonym
   */
  async updateThesaurus(correction: UserCorrection): Promise<void> {
    try {
      // Add raw name as synonym for corrected category
      // This would typically update a thesaurus file or database
      console.log(
        `📚 [LearningEngine] Adding synonym: "${correction.rawName}" → "${correction.userCorrection}"`
      );

      // Store in cache for immediate effect
      await setCacheValue(
        `thesaurus:${correction.userCorrection}`,
        86400 * 30, // 30 days
        JSON.stringify({
          synonym: correction.rawName,
          insurer: correction.insurerName,
          correctedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('❌ [LearningEngine] Thesaurus update failed:', error);
    }
  },

  /**
   * Update embedding for corrected mapping
   */
  async updateEmbedding(correction: UserCorrection): Promise<void> {
    try {
      // Generate new embedding for the corrected pair
      const rawEmbedding = await embeddingService.generateEmbedding(correction.rawName);
      const correctedEmbedding = await embeddingService.generateEmbedding(
        correction.userCorrection
      );

      // Store in cache with higher weight
      await setCacheValue(
        `emb_correction:${Buffer.from(correction.rawName).toString('base64').substring(0, 32)}`,
        86400 * 30, // 30 days
        JSON.stringify({
          rawEmbedding,
          correctedEmbedding,
          correction: correction.userCorrection,
          weight: 1.5, // Higher weight for corrected mappings
        })
      );

      console.log(`🔢 [LearningEngine] Updated embeddings for "${correction.rawName}"`);
    } catch (error) {
      console.error('❌ [LearningEngine] Embedding update failed:', error);
    }
  },

  /**
   * Invalidate cache entries affected by correction
   */
  async invalidateCache(correction: UserCorrection): Promise<void> {
    try {
      // Delete cached mappings for this raw name
      await deleteCacheValue(
        `map:${correction.insurerName || 'global'}:${Buffer.from(correction.rawName).toString('base64').substring(0, 32)}`
      );

      // Delete cached search results that might include this mapping
      const searchKeys = await getCacheKeys('search:*');
      for (const key of searchKeys.slice(0, 100)) {
        // Limit to avoid blocking
        await deleteCacheValue(key);
      }

      console.log(`🗑️ [LearningEngine] Invalidated cache for "${correction.rawName}"`);
    } catch (error) {
      console.error('❌ [LearningEngine] Cache invalidation failed:', error);
    }
  },

  /**
   * Update ontology with new mapping
   */
  async updateOntology(correction: UserCorrection): Promise<void> {
    try {
      const { default: coverageOntology } = await import('./coverageOntology');
      // Save mapping to ontology
      await coverageOntology.saveMapping({
        rawName: correction.rawName,
        insurerName: correction.insurerName,
        groups: [
          {
            groupId: correction.userCorrection,
            confidence: 0.95, // High confidence for user-corrected mappings
          },
        ],
        isComposite: false,
        confidence: 0.95,
      });

      console.log(`🌳 [LearningEngine] Updated ontology for "${correction.rawName}"`);
    } catch (error) {
      console.error('❌ [LearningEngine] Ontology update failed:', error);
    }
  },

  /**
   * Update coverage semantic graph with learned correction edges
   */
  async updateGraph(correction: UserCorrection, domain: string = 'pyme'): Promise<void> {
    if (!featureFlags.isEnabled('graphLearningEnabled')) {
      return;
    }

    const raw = normalizeText(correction.rawName, true).replace(/\s+/g, ' ').trim();
    const canonical = correction.userCorrection.trim();
    const insurer = correction.insurerName || '';

    if (!raw || !canonical) {
      return;
    }

    try {
      switch (correction.correctionType) {
        case 'deductible':
          await coverageGraphService.addEdge({
            from: raw,
            to: canonical,
            type: 'deductible_for' as GraphEdgeType,
            weight: 0.9,
            insurer,
            domain,
          });
          console.log(`🌐 [LearningEngine] Graph deductible rule: "${raw}" → "${canonical}"`);
          break;

        case 'exclusion':
          await coverageGraphService.addEdge({
            from: raw,
            to: canonical,
            type: 'excludes' as GraphEdgeType,
            weight: 0.9,
            insurer,
            domain,
          });
          console.log(`🌐 [LearningEngine] Graph exclusion rule: "${raw}" → "${canonical}"`);
          break;

        default:
          // value corrections and unknown types are not represented as graph edges
          break;
      }
    } catch (error: unknown) {
      console.warn(
        `⚠️ [LearningEngine] Graph update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  /**
   * Get learning metrics
   */
  async getMetrics(): Promise<LearningMetrics> {
    try {
      // Get total corrections
      const { count: totalCorrections, error: countError } = await supabase
        .from('coverage_mappings')
        .select('*', { count: 'exact', head: true })
        .eq('user_corrected', true);

      if (countError) throw countError;

      // Get corrections by type
      const { data: typeData, error: typeError } = await supabase
        .from('coverage_mappings')
        .select('canonical_name')
        .eq('user_corrected', true);

      if (typeError) throw typeError;

      const correctionsByType: Record<string, number> = {};
      typeData?.forEach((row) => {
        const type = ((row as Record<string, unknown>).canonical_name as string) || 'unknown';
        correctionsByType[type] = (correctionsByType[type] || 0) + 1;
      });

      // Get top corrected mappings
      const { data: topData, error: topError } = await supabase
        .from('coverage_mappings')
        .select('raw_name, correction_count')
        .eq('user_corrected', true)
        .order('correction_count', { ascending: false })
        .limit(10);

      if (topError) throw topError;

      // Calculate accuracy trend (simplified)
      const accuracyTrend = await this.calculateAccuracyTrend();

      return {
        totalCorrections: totalCorrections || 0,
        correctionsByType,
        accuracyTrend,
        topCorrectedMappings:
          topData?.map((row) => ({
            rawName: (row as Record<string, unknown>).raw_name as string,
            count: (row as Record<string, unknown>).correction_count as number,
          })) || [],
      };
    } catch (error) {
      console.error('❌ [LearningEngine] Failed to get metrics:', error);
      return {
        totalCorrections: 0,
        correctionsByType: {},
        accuracyTrend: [],
        topCorrectedMappings: [],
      };
    }
  },

  /**
   * Calculate accuracy trend over time
   */
  async calculateAccuracyTrend(): Promise<Array<{ date: string; accuracy: number }>> {
    try {
      // Get corrections grouped by week
      const { data, error } = await supabase
        .from('coverage_mappings')
        .select('created_at, correction_count')
        .eq('user_corrected', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Group by week and calculate accuracy
      const weeklyData: Record<string, { corrections: number; total: number }> = {};

      data.forEach((row) => {
        const date = new Date((row as Record<string, unknown>).created_at as string);
        const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { corrections: 0, total: 0 };
        }

        weeklyData[weekKey].corrections +=
          ((row as Record<string, unknown>).correction_count as number) || 1;
        weeklyData[weekKey].total += 1;
      });

      return Object.entries(weeklyData).map(([date, stats]) => ({
        date,
        accuracy: Math.max(0, 100 - (stats.corrections / stats.total) * 10),
      }));
    } catch (error) {
      console.error('❌ [LearningEngine] Failed to calculate accuracy trend:', error);
      return [];
    }
  },

  /**
   * Generate monthly report
   */
  async generateMonthlyReport(): Promise<{
    month: string;
    metrics: LearningMetrics;
    improvements: string[];
  }> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const metrics = await this.getMetrics();

    const improvements: string[] = [];

    if (metrics.totalCorrections > 0) {
      improvements.push(`Processed ${metrics.totalCorrections} user corrections`);
    }

    if (metrics.topCorrectedMappings.length > 0) {
      improvements.push(
        `Top corrected mapping: "${metrics.topCorrectedMappings[0].rawName}" (${metrics.topCorrectedMappings[0].count} times)`
      );
    }

    if (metrics.accuracyTrend.length > 1) {
      const latest = metrics.accuracyTrend[metrics.accuracyTrend.length - 1];
      const previous = metrics.accuracyTrend[metrics.accuracyTrend.length - 2];
      const change = latest.accuracy - previous.accuracy;

      if (change > 0) {
        improvements.push(`Accuracy improved by ${change.toFixed(2)}%`);
      }
    }

    return {
      month,
      metrics,
      improvements,
    };
  },

  /**
   * Batch process corrections for embedding retraining
   */
  async batchRetrainEmbeddings(): Promise<{
    processed: number;
    errors: number;
  }> {
    try {
      // Get all user-corrected mappings
      const { data, error } = await supabase
        .from('coverage_mappings')
        .select('*')
        .eq('user_corrected', true)
        .order('correction_count', { ascending: false })
        .limit(100);

      if (error) throw error;

      let processed = 0;
      let errors = 0;

      for (const mapping of (data || []) as Array<Record<string, unknown>>) {
        try {
          await this.updateEmbedding({
            rawName: mapping.raw_name as string,
            insurerName: mapping.insurer_name as string | undefined,
            systemMapping: mapping.canonical_name as string,
            userCorrection: mapping.canonical_name as string,
            correctionType: 'coverage_mapping',
          });
          processed++;
        } catch (error) {
          errors++;
          console.error(
            `❌ [LearningEngine] Failed to retrain embedding for "${mapping.raw_name}":`,
            error
          );
        }
      }

      console.log(
        `✅ [LearningEngine] Batch retraining complete: ${processed} processed, ${errors} errors`
      );

      return { processed, errors };
    } catch (error) {
      console.error('❌ [LearningEngine] Batch retraining failed:', error);
      return { processed: 0, errors: 0 };
    }
  },
};

export default learningEngine;
