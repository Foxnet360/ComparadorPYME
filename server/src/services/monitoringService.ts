/**
 * Monitoring Service for Post-Deployment Tracking
 * Collects accuracy metrics, user feedback, and performance data
 */

import { supabase } from '../config/database';

export interface AccuracyMetrics {
  extractionAccuracy: number;
  deductibleParsingAccuracy: number;
  ontologyMappingAccuracy: number;
  chatResponseAccuracy: number;
  timestamp: string;
}

export interface UserFeedback {
  id?: string;
  feature: string;
  rating: number;
  comment?: string;
  userId?: string;
  createdAt?: string;
}

export interface PerformanceMetrics {
  avgAnalysisTime: number;
  avgChatResponseTime: number;
  p95AnalysisTime: number;
  p99AnalysisTime: number;
  errorRate: number;
  timestamp: string;
}

class MonitoringService {
  private metricsBuffer: any[] = [];
  private bufferSize = 100;

  /**
   * Record extraction accuracy
   */
  async recordExtractionAccuracy(
    coverageName: string,
    extractedValue: string,
    correctValue: string,
    isCorrect: boolean
  ): Promise<void> {
    try {
      await supabase.from('accuracy_logs').insert({
        type: 'extraction',
        coverage_name: coverageName,
        extracted_value: extractedValue,
        correct_value: correctValue,
        is_correct: isCorrect,
        timestamp: new Date().toISOString()
      } as any);
    } catch (error) {
      console.error('❌ [Monitoring] Failed to record extraction accuracy:', error);
    }
  }

  /**
   * Record deductible parsing accuracy
   */
  async recordDeductibleAccuracy(
    rawText: string,
    parsedResult: any,
    isCorrect: boolean,
    errorType?: string
  ): Promise<void> {
    try {
      await supabase.from('accuracy_logs').insert({
        type: 'deductible_parsing',
        raw_text: rawText,
        parsed_result: parsedResult,
        is_correct: isCorrect,
        error_type: errorType,
        timestamp: new Date().toISOString()
      } as any);
    } catch (error) {
      console.error('❌ [Monitoring] Failed to record deductible accuracy:', error);
    }
  }

  /**
   * Record chat response quality
   */
  async recordChatQuality(
    query: string,
    response: string,
    source: string,
    userRating?: number,
    wasHelpful?: boolean
  ): Promise<void> {
    try {
      await supabase.from('chat_quality_logs').insert({
        query,
        response,
        source,
        user_rating: userRating,
        was_helpful: wasHelpful,
        timestamp: new Date().toISOString()
      } as any);
    } catch (error) {
      console.error('❌ [Monitoring] Failed to record chat quality:', error);
    }
  }

  /**
   * Collect user feedback
   */
  async collectFeedback(feedback: UserFeedback): Promise<void> {
    try {
      await supabase.from('user_feedback').insert({
        feature: feedback.feature,
        rating: feedback.rating,
        comment: feedback.comment,
        user_id: feedback.userId,
        created_at: new Date().toISOString()
      } as any);
    } catch (error) {
      console.error('❌ [Monitoring] Failed to collect feedback:', error);
    }
  }

  /**
   * Record performance metrics
   */
  async recordPerformance(
    operation: string,
    durationMs: number,
    success: boolean,
    metadata?: any
  ): Promise<void> {
    const metric = {
      operation,
      duration_ms: durationMs,
      success,
      metadata,
      timestamp: new Date().toISOString()
    };

    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushMetrics();
    }
  }

  /**
   * Flush buffered metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      await supabase.from('performance_logs').insert(
        this.metricsBuffer.map(m => ({
          operation: m.operation,
          duration_ms: m.duration_ms,
          success: m.success,
          metadata: m.metadata,
          timestamp: m.timestamp
        })) as any
      );
      this.metricsBuffer = [];
    } catch (error) {
      console.error('❌ [Monitoring] Failed to flush metrics:', error);
    }
  }

  /**
   * Get accuracy summary for date range
   */
  async getAccuracySummary(
    startDate: string,
    endDate: string
  ): Promise<AccuracyMetrics> {
    try {
      const { data: extractionData } = await supabase
        .from('accuracy_logs')
        .select('is_correct')
        .eq('type', 'extraction')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      const { data: deductibleData } = await supabase
        .from('accuracy_logs')
        .select('is_correct')
        .eq('type', 'deductible_parsing')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      const extractionList = (extractionData || []) as any[];
      const deductibleList = (deductibleData || []) as any[];
      const extractionTotal = extractionList.length;
      const extractionCorrect = extractionList.filter(d => d.is_correct).length;
      const deductibleTotal = deductibleList.length;
      const deductibleCorrect = deductibleList.filter(d => d.is_correct).length;

      return {
        extractionAccuracy: extractionTotal > 0 ? extractionCorrect / extractionTotal : 0,
        deductibleParsingAccuracy: deductibleTotal > 0 ? deductibleCorrect / deductibleTotal : 0,
        ontologyMappingAccuracy: 0, // Will be implemented with learning engine
        chatResponseAccuracy: 0, // Will be implemented with chat quality tracking
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [Monitoring] Failed to get accuracy summary:', error);
      return {
        extractionAccuracy: 0,
        deductibleParsingAccuracy: 0,
        ontologyMappingAccuracy: 0,
        chatResponseAccuracy: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(
    startDate: string,
    endDate: string
  ): Promise<PerformanceMetrics> {
    try {
      const { data } = await supabase
        .from('performance_logs')
        .select('duration_ms, success')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      const dataList = (data || []) as any[];
      if (dataList.length === 0) {
        return {
          avgAnalysisTime: 0,
          avgChatResponseTime: 0,
          p95AnalysisTime: 0,
          p99AnalysisTime: 0,
          errorRate: 0,
          timestamp: new Date().toISOString()
        };
      }

      const durations = dataList.map(d => d.duration_ms).sort((a, b) => a - b);
      const total = durations.length;
      const successCount = dataList.filter(d => d.success).length;

      return {
        avgAnalysisTime: durations.reduce((a, b) => a + b, 0) / total,
        avgChatResponseTime: 0, // Separate tracking needed
        p95AnalysisTime: durations[Math.floor(total * 0.95)],
        p99AnalysisTime: durations[Math.floor(total * 0.99)],
        errorRate: (total - successCount) / total,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [Monitoring] Failed to get performance summary:', error);
      return {
        avgAnalysisTime: 0,
        avgChatResponseTime: 0,
        p95AnalysisTime: 0,
        p99AnalysisTime: 0,
        errorRate: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get user feedback summary
   */
  async getFeedbackSummary(
    startDate: string,
    endDate: string
  ): Promise<{
    avgRating: number;
    totalFeedback: number;
    byFeature: Record<string, { avgRating: number; count: number }>;
  }> {
    try {
      const { data } = await supabase
        .from('user_feedback')
        .select('feature, rating')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const dataList = (data || []) as any[];
      if (dataList.length === 0) {
        return {
          avgRating: 0,
          totalFeedback: 0,
          byFeature: {}
        };
      }

      const byFeature: Record<string, { ratings: number[]; count: number }> = {};
      
      dataList.forEach(item => {
        if (!byFeature[item.feature]) {
          byFeature[item.feature] = { ratings: [], count: 0 };
        }
        byFeature[item.feature].ratings.push(item.rating);
        byFeature[item.feature].count++;
      });

      const result: Record<string, { avgRating: number; count: number }> = {};
      
      Object.entries(byFeature).forEach(([feature, stats]) => {
        result[feature] = {
          avgRating: stats.ratings.reduce((a, b) => a + b, 0) / stats.count,
          count: stats.count
        };
      });

      return {
        avgRating: dataList.reduce((sum, item) => sum + item.rating, 0) / dataList.length,
        totalFeedback: dataList.length,
        byFeature: result
      };
    } catch (error) {
      console.error('❌ [Monitoring] Failed to get feedback summary:', error);
      return {
        avgRating: 0,
        totalFeedback: 0,
        byFeature: {}
      };
    }
  }

  /**
   * Get unified vs legacy engine comparison metrics
   */
  async getEngineComparisonMetrics(
    startDate: string,
    endDate: string
  ): Promise<{
    unified: {
      count: number;
      avgProcessingTime: number;
      avgConfidence: number;
      successRate: number;
    };
    legacy: {
      count: number;
      avgProcessingTime: number;
      avgConfidence: number;
    };
    fallback: {
      count: number;
      rate: number;
      topReasons: string[];
    };
  }> {
    try {
      const { data } = await supabase
        .from('analysis_history')
        .select('engine_type, processing_time_ms, confidence_score, fallback_reason')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('engine_type', 'is', null);

      const records = (data || []) as any[];

      const unifiedRecords = records.filter(r => r.engine_type === 'unified');
      const legacyRecords = records.filter(r => r.engine_type === 'legacy');
      const fallbackRecords = records.filter(r => r.engine_type === 'fallback');

      // Calculate top fallback reasons
      const reasonCounts: Record<string, number> = {};
      fallbackRecords.forEach(r => {
        const reason = r.fallback_reason || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });

      const topReasons = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason]) => reason);

      return {
        unified: {
          count: unifiedRecords.length,
          avgProcessingTime: unifiedRecords.length > 0
            ? Math.round(unifiedRecords.reduce((sum, r) => sum + (r.processing_time_ms || 0), 0) / unifiedRecords.length)
            : 0,
          avgConfidence: unifiedRecords.length > 0
            ? Math.round(unifiedRecords.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / unifiedRecords.length)
            : 0,
          successRate: records.length > 0
            ? Math.round((unifiedRecords.length / records.length) * 100)
            : 0
        },
        legacy: {
          count: legacyRecords.length,
          avgProcessingTime: legacyRecords.length > 0
            ? Math.round(legacyRecords.reduce((sum, r) => sum + (r.processing_time_ms || 0), 0) / legacyRecords.length)
            : 0,
          avgConfidence: legacyRecords.length > 0
            ? Math.round(legacyRecords.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / legacyRecords.length)
            : 0
        },
        fallback: {
          count: fallbackRecords.length,
          rate: records.length > 0
            ? Math.round((fallbackRecords.length / records.length) * 100)
            : 0,
          topReasons
        }
      };
    } catch (error) {
      console.error('❌ [Monitoring] Failed to get engine comparison metrics:', error);
      return {
        unified: { count: 0, avgProcessingTime: 0, avgConfidence: 0, successRate: 0 },
        legacy: { count: 0, avgProcessingTime: 0, avgConfidence: 0 },
        fallback: { count: 0, rate: 0, topReasons: [] }
      };
    }
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;