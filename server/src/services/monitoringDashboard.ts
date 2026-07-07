import { supabase } from '../config/database';
import { redis, getCacheValue, setCacheValue } from './cache/redisCache';

export interface MonitoringMetrics {
  timestamp: string;
  totalAnalyses: number;
  averageAnalysisTime: number;
  successRate: number;
  activeUsers: number;
  apiLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  ragMetrics: {
    averageChunksRetrieved: number;
    averageSimilarity: number;
    fallbackRate: number;
  };
  extractionAccuracy: {
    structuredClause: number;
    deductible: number;
    coverageMapping: number;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  services: {
    database: boolean;
    redis: boolean;
    gemini: boolean;
    embeddings: boolean;
  };
  lastCheck: string;
}

export const monitoringDashboard = {
  /**
   * Get current system metrics
   */
  async getMetrics(): Promise<MonitoringMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // Get analysis metrics from database
      const { data: analysesRaw, error: analysisError } = await supabase
        .from('analysis_logs')
        .select('duration_ms, status, error_type')
        .gte('created_at', oneHourAgo.toISOString());

      if (analysisError) throw analysisError;
      const analyses = (analysesRaw || []) as Array<{
        duration_ms: number;
        status: string;
        error_type?: string;
      }>;

      // Calculate metrics
      const totalAnalyses = analyses?.length || 0;
      const successfulAnalyses = analyses?.filter((a) => a.status === 'success').length || 0;
      const successRate = totalAnalyses > 0 ? (successfulAnalyses / totalAnalyses) * 100 : 100;

      const durations = analyses?.map((a) => a.duration_ms).filter(Boolean) || [];
      const averageAnalysisTime =
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

      // Get error breakdown
      const errors = analyses?.filter((a) => a.status === 'error') || [];
      const errorByType: Record<string, number> = {};
      errors.forEach((e) => {
        const type = e.error_type || 'unknown';
        errorByType[type] = (errorByType[type] || 0) + 1;
      });

      // Get RAG metrics from Redis cache
      let ragMetrics = {
        averageChunksRetrieved: 0,
        averageSimilarity: 0,
        fallbackRate: 0,
      };

      try {
        const ragStats = await getCacheValue('rag:stats:last_hour');
        if (ragStats) {
          ragMetrics = JSON.parse(ragStats);
        }
      } catch {
        // RAG stats not available
      }

      // Get extraction accuracy metrics
      const extractionAccuracy = await this.getExtractionAccuracy();

      return {
        timestamp: now.toISOString(),
        totalAnalyses,
        averageAnalysisTime,
        successRate,
        activeUsers: 0, // Would need user tracking
        apiLatency: {
          p50: this.calculatePercentile(durations, 50),
          p95: this.calculatePercentile(durations, 95),
          p99: this.calculatePercentile(durations, 99),
        },
        errors: {
          total: errors.length,
          byType: errorByType,
        },
        ragMetrics,
        extractionAccuracy,
      };
    } catch (error) {
      console.error('❌ [Monitoring] Error getting metrics:', error);
      return this.getDefaultMetrics();
    }
  },

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      gemini: await this.checkGemini(),
      embeddings: await this.checkEmbeddings(),
    };

    const allHealthy = Object.values(checks).every((c) => c);
    const anyCritical = Object.values(checks).filter((c) => !c).length >= 2;

    return {
      status: anyCritical ? 'critical' : allHealthy ? 'healthy' : 'degraded',
      services: checks,
      lastCheck: new Date().toISOString(),
    };
  },

  /**
   * Log analysis performance
   */
  async logAnalysis(
    analysisId: string,
    durationMs: number,
    status: 'success' | 'error',
    errorType?: string
  ): Promise<void> {
    try {
      await supabase.from('analysis_logs').insert({
        analysis_id: analysisId,
        duration_ms: durationMs,
        status,
        error_type: errorType,
        created_at: new Date().toISOString(),
      } as unknown as never[]);
    } catch (error) {
      console.error('❌ [Monitoring] Error logging analysis:', error);
    }
  },

  /**
   * Log RAG retrieval metrics
   */
  async logRagMetrics(
    chunksRetrieved: number,
    averageSimilarity: number,
    isFallback: boolean
  ): Promise<void> {
    try {
      const key = 'rag:stats:last_hour';
      const existing = await getCacheValue(key);
      const stats = existing
        ? JSON.parse(existing)
        : {
            count: 0,
            totalChunks: 0,
            totalSimilarity: 0,
            fallbackCount: 0,
          };

      stats.count++;
      stats.totalChunks += chunksRetrieved;
      stats.totalSimilarity += averageSimilarity;
      if (isFallback) stats.fallbackCount++;

      await setCacheValue(key, 3600, JSON.stringify(stats));
    } catch (error) {
      console.error('❌ [Monitoring] Error logging RAG metrics:', error);
    }
  },

  /**
   * Get extraction accuracy from learning engine
   */
  async getExtractionAccuracy(): Promise<{
    structuredClause: number;
    deductible: number;
    coverageMapping: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('coverage_mappings')
        .select('confidence, user_corrected')
        .limit(1000);

      if (error) throw error;

      const mappings = (data || []) as Array<{
        confidence: number;
        user_corrected: boolean;
      }>;
      const total = mappings.length;

      if (total === 0) {
        return { structuredClause: 0, deductible: 0, coverageMapping: 0 };
      }

      const corrected = mappings.filter((m) => m.user_corrected).length;
      const accuracy = ((total - corrected) / total) * 100;

      return {
        structuredClause: accuracy,
        deductible: accuracy, // Would need separate tracking
        coverageMapping: accuracy,
      };
    } catch (error) {
      console.error('❌ [Monitoring] Error getting extraction accuracy:', error);
      return { structuredClause: 0, deductible: 0, coverageMapping: 0 };
    }
  },

  /**
   * Get RAG performance summary
   */
  async getRagSummary(): Promise<{
    totalSearches: number;
    averageChunks: number;
    averageSimilarity: number;
    fallbackRate: number;
  }> {
    try {
      const stats = await redis.get('rag:stats:last_hour');
      if (!stats) {
        return { totalSearches: 0, averageChunks: 0, averageSimilarity: 0, fallbackRate: 0 };
      }

      const parsed = JSON.parse(stats);
      return {
        totalSearches: parsed.count,
        averageChunks: parsed.count > 0 ? parsed.totalChunks / parsed.count : 0,
        averageSimilarity: parsed.count > 0 ? parsed.totalSimilarity / parsed.count : 0,
        fallbackRate: parsed.count > 0 ? (parsed.fallbackCount / parsed.count) * 100 : 0,
      };
    } catch (error) {
      console.error('❌ [Monitoring] Error getting RAG summary:', error);
      return { totalSearches: 0, averageChunks: 0, averageSimilarity: 0, fallbackRate: 0 };
    }
  },

  /**
   * Health check helpers
   */
  async checkDatabase(): Promise<boolean> {
    try {
      const { error } = await supabase.from('coverage_mappings').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  },

  async checkRedis(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  },

  async checkGemini(): Promise<boolean> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      return !!apiKey;
    } catch {
      return false;
    }
  },

  async checkEmbeddings(): Promise<boolean> {
    try {
      const { embeddingService } = await import('./vector/embeddingService');
      await embeddingService.generateEmbedding('test');
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Helper methods
   */
  calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  },

  getDefaultMetrics(): MonitoringMetrics {
    return {
      timestamp: new Date().toISOString(),
      totalAnalyses: 0,
      averageAnalysisTime: 0,
      successRate: 100,
      activeUsers: 0,
      apiLatency: { p50: 0, p95: 0, p99: 0 },
      errors: { total: 0, byType: {} },
      ragMetrics: {
        averageChunksRetrieved: 0,
        averageSimilarity: 0,
        fallbackRate: 0,
      },
      extractionAccuracy: {
        structuredClause: 0,
        deductible: 0,
        coverageMapping: 0,
      },
    };
  },
};

export default monitoringDashboard;
