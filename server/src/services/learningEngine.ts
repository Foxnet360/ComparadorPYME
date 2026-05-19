import { supabase } from '../config/database';
import { embeddingService } from './vector/embeddingService';
import { coverageOntology } from './coverageOntology';
import { deleteCacheValue, getCacheKeys, setCacheValue } from './cache/redisCache';

export interface UserCorrection {
  id?: string;
  rawName: string;
  insurerName?: string;
  systemMapping: string;
  userCorrection: string;
  correctionType: 'coverage_mapping' | 'deductible' | 'exclusion' | 'value';
  quoteId?: string;
  createdAt?: Date;
}

export interface LearningMetrics {
  totalCorrections: number;
  correctionsByType: Record<string, number>;
  accuracyTrend: Array<{ date: string; accuracy: number }>;
  topCorrectedMappings: Array<{ rawName: string; count: number }>;
}

export const learningEngine = {
  /**
   * Save a user correction
   */
  async saveCorrection(correction: UserCorrection): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('coverage_mappings')
        .upsert({
          raw_name: correction.rawName,
          insurer_name: correction.insurerName,
          canonical_name: correction.userCorrection,
          user_corrected: true,
          correction_count: 1
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      console.log(`✅ [LearningEngine] Saved correction: "${correction.rawName}" → "${correction.userCorrection}"`);
      
      // Trigger async updates
      await this.applyCorrection(correction);
      
      return (data as any)?.id || '';
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
      
      // 2. Update embeddings if significant
      if (correction.correctionType === 'coverage_mapping') {
        await this.updateEmbedding(correction);
      }
      
      // 3. Invalidate cache
      await this.invalidateCache(correction);
      
      // 4. Update ontology if needed
      await this.updateOntology(correction);
      
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
      console.log(`📚 [LearningEngine] Adding synonym: "${correction.rawName}" → "${correction.userCorrection}"`);
      
      // Store in cache for immediate effect
      await setCacheValue(
        `thesaurus:${correction.userCorrection}`,
        86400 * 30, // 30 days
        JSON.stringify({
          synonym: correction.rawName,
          insurer: correction.insurerName,
          correctedAt: new Date().toISOString()
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
      const correctedEmbedding = await embeddingService.generateEmbedding(correction.userCorrection);
      
      // Store in cache with higher weight
      await setCacheValue(
        `emb_correction:${Buffer.from(correction.rawName).toString('base64').substring(0, 32)}`,
        86400 * 30, // 30 days
        JSON.stringify({
          rawEmbedding,
          correctedEmbedding,
          correction: correction.userCorrection,
          weight: 1.5 // Higher weight for corrected mappings
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
      await deleteCacheValue(`map:${correction.insurerName || 'global'}:${Buffer.from(correction.rawName).toString('base64').substring(0, 32)}`);
      
      // Delete cached search results that might include this mapping
      const searchKeys = await getCacheKeys('search:*');
      for (const key of searchKeys.slice(0, 100)) { // Limit to avoid blocking
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
      // Save mapping to ontology
      await coverageOntology.saveMapping({
        rawName: correction.rawName,
        insurerName: correction.insurerName,
        groups: [{
          groupId: correction.userCorrection,
          confidence: 0.95 // High confidence for user-corrected mappings
        }],
        isComposite: false,
        confidence: 0.95
      });
      
      console.log(`🌳 [LearningEngine] Updated ontology for "${correction.rawName}"`);
    } catch (error) {
      console.error('❌ [LearningEngine] Ontology update failed:', error);
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
      typeData?.forEach((row: any) => {
        const type = row.canonical_name || 'unknown';
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
        topCorrectedMappings: topData?.map((row: any) => ({
          rawName: row.raw_name,
          count: row.correction_count
        })) || []
      };
    } catch (error) {
      console.error('❌ [LearningEngine] Failed to get metrics:', error);
      return {
        totalCorrections: 0,
        correctionsByType: {},
        accuracyTrend: [],
        topCorrectedMappings: []
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
      
      data.forEach((row: any) => {
        const date = new Date(row.created_at);
        const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { corrections: 0, total: 0 };
        }
        
        weeklyData[weekKey].corrections += row.correction_count || 1;
        weeklyData[weekKey].total += 1;
      });

      return Object.entries(weeklyData).map(([date, stats]) => ({
        date,
        accuracy: Math.max(0, 100 - (stats.corrections / stats.total) * 10)
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
      improvements.push(`Top corrected mapping: "${metrics.topCorrectedMappings[0].rawName}" (${metrics.topCorrectedMappings[0].count} times)`);
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
      improvements
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

      for (const mapping of (data || []) as any[]) {
        try {
          await this.updateEmbedding({
            rawName: mapping.raw_name,
            insurerName: mapping.insurer_name,
            systemMapping: mapping.canonical_name,
            userCorrection: mapping.canonical_name,
            correctionType: 'coverage_mapping'
          });
          processed++;
        } catch (error) {
          errors++;
          console.error(`❌ [LearningEngine] Failed to retrain embedding for "${mapping.raw_name}":`, error);
        }
      }

      console.log(`✅ [LearningEngine] Batch retraining complete: ${processed} processed, ${errors} errors`);
      
      return { processed, errors };
    } catch (error) {
      console.error('❌ [LearningEngine] Batch retraining failed:', error);
      return { processed: 0, errors: 0 };
    }
  }
};

export default learningEngine;
