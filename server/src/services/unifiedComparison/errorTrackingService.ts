/**
 * Error Tracking Service for Unified Engine
 * Tracks and categorizes errors specific to the unified comparison engine
 */

import { supabase } from '../../config/database';

export enum ErrorCategory {
  GEMINI_API = 'gemini_api',
  PDF_UPLOAD = 'pdf_upload',
  JSON_PARSE = 'json_parse',
  SCHEMA_VALIDATION = 'schema_validation',
  CACHE = 'cache',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export interface TrackedError {
  id?: string;
  correlationId: string;
  category: ErrorCategory;
  message: string;
  stack?: string;
  metadata: Record<string, any>;
  pdfCount: number;
  pdfNames: string[];
  createdAt?: string;
  resolved: boolean;
  resolution?: string;
}

class ErrorTrackingService {
  private errorBuffer: TrackedError[] = [];
  private bufferSize = 50;

  /**
   * Categorize an error based on its message
   */
  categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('gemini') || message.includes('generatecontent') || message.includes('model')) {
      return ErrorCategory.GEMINI_API;
    }
    
    if (message.includes('upload') || message.includes('file') || message.includes('pdf')) {
      return ErrorCategory.PDF_UPLOAD;
    }
    
    if (message.includes('json') || message.includes('parse') || message.includes('syntax')) {
      return ErrorCategory.JSON_PARSE;
    }
    
    if (message.includes('schema') || message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.SCHEMA_VALIDATION;
    }
    
    if (message.includes('cache') || message.includes('redis') || message.includes('memory')) {
      return ErrorCategory.CACHE;
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return ErrorCategory.NETWORK;
    }
    
    if (message.includes('timeout') || message.includes('exceeded')) {
      return ErrorCategory.TIMEOUT;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Track an error
   */
  async trackError(
    error: Error,
    correlationId: string,
    pdfPaths: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const category = this.categorizeError(error);
    
    const trackedError: TrackedError = {
      correlationId,
      category,
      message: error.message,
      stack: error.stack,
      metadata: metadata || {},
      pdfCount: pdfPaths.length,
      pdfNames: pdfPaths.map(p => {
        const parts = p.split('/');
        return parts[parts.length - 1];
      }),
      resolved: false
    };

    // Add to buffer
    this.errorBuffer.push(trackedError);

    // Log error
    console.error(`❌ [ErrorTracking] ${category}: ${error.message} [${correlationId}]`);

    // Flush if buffer is full
    if (this.errorBuffer.length >= this.bufferSize) {
      await this.flushErrors();
    }
  }

  /**
   * Flush buffered errors to database
   */
  private async flushErrors(): Promise<void> {
    if (this.errorBuffer.length === 0) return;

    try {
      const errors = this.errorBuffer.map(err => ({
        correlation_id: err.correlationId,
        category: err.category,
        message: err.message,
        stack_trace: err.stack,
        metadata: err.metadata,
        pdf_count: err.pdfCount,
        pdf_names: err.pdfNames,
        resolved: err.resolved,
        created_at: new Date().toISOString()
      }));

      await supabase.from('unified_engine_errors').insert(errors as any);
      
      console.log(`📝 [ErrorTracking] Flushed ${this.errorBuffer.length} errors to database`);
      this.errorBuffer = [];
    } catch (dbError: any) {
      console.error('❌ [ErrorTracking] Failed to flush errors:', dbError.message);
    }
  }

  /**
   * Get error summary for date range
   */
  async getErrorSummary(
    startDate: string,
    endDate: string
  ): Promise<{
    total: number;
    byCategory: Record<ErrorCategory, number>;
    topErrors: Array<{ message: string; count: number; category: ErrorCategory }>;
    resolutionRate: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('unified_engine_errors')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const errors = (data || []) as any[];
      
      // Count by category
      const byCategory: Record<ErrorCategory, number> = {
        [ErrorCategory.GEMINI_API]: 0,
        [ErrorCategory.PDF_UPLOAD]: 0,
        [ErrorCategory.JSON_PARSE]: 0,
        [ErrorCategory.SCHEMA_VALIDATION]: 0,
        [ErrorCategory.CACHE]: 0,
        [ErrorCategory.NETWORK]: 0,
        [ErrorCategory.TIMEOUT]: 0,
        [ErrorCategory.UNKNOWN]: 0
      };

      errors.forEach((err: any) => {
        const category = err.category as ErrorCategory;
        byCategory[category] = (byCategory[category] || 0) + 1;
      });

      // Get top errors
      const errorCounts: Record<string, { message: string; count: number; category: ErrorCategory }> = {};
      errors.forEach((err: any) => {
        const key = `${err.category}:${err.message}`;
        if (!errorCounts[key]) {
          errorCounts[key] = {
            message: err.message,
            count: 0,
            category: err.category
          };
        }
        errorCounts[key].count++;
      });

      const topErrors = Object.values(errorCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate resolution rate
      const resolved = errors.filter((err: any) => err.resolved).length;
      const resolutionRate = errors.length > 0 ? Math.round((resolved / errors.length) * 100) : 0;

      return {
        total: errors.length,
        byCategory,
        topErrors,
        resolutionRate
      };

    } catch (error: any) {
      console.error('❌ [ErrorTracking] Failed to get error summary:', error.message);
      return {
        total: 0,
        byCategory: {} as Record<ErrorCategory, number>,
        topErrors: [],
        resolutionRate: 0
      };
    }
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(errorId: string, resolution: string): Promise<boolean> {
    try {
      const { error } = await (supabase as any)
        .from('unified_engine_errors')
        .update({
          resolved: true,
          resolution,
          updated_at: new Date().toISOString()
        })
        .eq('id', errorId);

      if (error) throw error;

      console.log(`✅ [ErrorTracking] Error ${errorId} resolved: ${resolution}`);
      return true;

    } catch (error: any) {
      console.error('❌ [ErrorTracking] Failed to resolve error:', error.message);
      return false;
    }
  }

  /**
   * Get errors by category
   */
  async getErrorsByCategory(
    category: ErrorCategory,
    startDate: string,
    endDate: string
  ): Promise<TrackedError[]> {
    try {
      const { data, error } = await supabase
        .from('unified_engine_errors')
        .select('*')
        .eq('category', category)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((err: any) => ({
        id: err.id,
        correlationId: err.correlation_id,
        category: err.category,
        message: err.message,
        stack: err.stack_trace,
        metadata: err.metadata,
        pdfCount: err.pdf_count,
        pdfNames: err.pdf_names,
        createdAt: err.created_at,
        resolved: err.resolved,
        resolution: err.resolution
      }));

    } catch (error: any) {
      console.error('❌ [ErrorTracking] Failed to get errors by category:', error.message);
      return [];
    }
  }

  /**
   * Flush remaining errors (call on shutdown)
   */
  async flush(): Promise<void> {
    await this.flushErrors();
  }
}

export const errorTrackingService = new ErrorTrackingService();
export default errorTrackingService;