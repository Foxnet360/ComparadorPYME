/**
 * Comparison Engine Adapter
 * Provides safe coexistence between unified and legacy comparison engines.
 * Routes requests based on feature flags with automatic fallback to the
 * proven per-quote V2 pipeline when the unified engine fails.
 */

import { randomUUID } from 'crypto';
import { MatrixRow } from '../../types';
import {
  unifiedComparisonEngine,
  UnifiedComparisonError,
  CompareOptions,
} from './unifiedComparisonEngine';
import { unifiedComparisonFlag, hashUserId } from './featureFlagService';
import {
  featureFlags,
  getUnifiedSliceRolloutPercentage,
  UnifiedSliceRolloutKey,
  FeatureFlags,
} from '../../config/featureFlags';
import { processQuotesBatch } from '../quoteProcessingService';
import {
  flatResultToMatrixRows,
  flatResultToMatrixRowsV2,
  quotesToMatrixRows,
} from './matrixTransformer';
import { resolveComparisonSchemaVersion, FlatComparisonResultV2 } from './comparisonSchema';

export interface ComparisonAdapterResult {
  matrix: MatrixRow[];
  engine: 'unified' | 'fallback';
  schemaVersion: 1 | 2;
  fallbackReason?: string;
  correlationId: string;
  quoteMetadata?: any[];
  /** Slice decisions applied to this result; always false on V1/fallback paths. */
  graphEnabled?: boolean;
  templateHintsEnabled?: boolean;
}

export class ComparisonEngineAdapter {
  /**
   * Generate comparison using unified engine first; fall back to the legacy
   * per-quote batch service on failure. Returns a typed envelope with routing
   * metadata so callers can log engine type and fallback reasons consistently.
   */
  async generateComparison(
    pdfPaths: string[],
    options?: string | { userId?: string; granularComparisonSchema?: boolean }
  ): Promise<ComparisonAdapterResult> {
    const opts = typeof options === 'string' ? { userId: options } : options || {};
    const userId = opts.userId;
    const granularOverride = opts.granularComparisonSchema;
    const correlationId = `adapter-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const flagEnabled = unifiedComparisonFlag.isEnabled(userId);

    // V1 schema guard: slice flags only apply to the V2 granular path, so
    // resolve the effective schema first and force both slices off on V1.
    const v2Schema = granularOverride ?? unifiedComparisonFlag.isGranularComparisonSchemaEnabled();
    const graphEnabled =
      v2Schema &&
      this.isSliceEnabled('useUnifiedGraphCanonicalization', 'graphCanonicalization', userId);
    const templateHintsEnabled =
      v2Schema && this.isSliceEnabled('useUnifiedTemplateHints', 'templateHints', userId);

    console.log(
      `🚩 [Adapter] Unified engine ${flagEnabled ? 'ENABLED' : 'DISABLED'} for user ${userId || 'anonymous'} [${correlationId}]`
    );

    if (!flagEnabled) {
      console.log(
        `📦 [Adapter] Routing to legacy batch service (flag disabled) [${correlationId}]`
      );
      const matrix = await this.runLegacyBatch(pdfPaths, 'unified_disabled_by_flag', correlationId);
      return {
        matrix,
        engine: 'fallback',
        schemaVersion: 1,
        fallbackReason: 'unified_disabled_by_flag',
        correlationId,
        graphEnabled: false,
        templateHintsEnabled: false,
      };
    }

    try {
      console.log(
        `🚀 [Adapter] Using unified comparison engine — routing=unified, graphEnabled=${graphEnabled}, templateHintsEnabled=${templateHintsEnabled} [${correlationId}]`
      );
      const compareOptions: CompareOptions = {
        graphEnabled,
        templateHintsEnabled,
        ...(granularOverride !== undefined ? { granularComparisonSchema: granularOverride } : {}),
      };
      const result = await unifiedComparisonEngine.compare(pdfPaths, compareOptions);
      const schemaVersion = resolveComparisonSchemaVersion(
        result,
        granularOverride ?? unifiedComparisonFlag.isGranularComparisonSchemaEnabled()
      );
      const matrix =
        schemaVersion === 2 ? flatResultToMatrixRowsV2(result) : flatResultToMatrixRows(result);

      console.log(
        `✅ [Adapter] Unified engine succeeded [${correlationId}] schemaVersion=${schemaVersion}`
      );
      return {
        matrix,
        engine: 'unified',
        schemaVersion,
        correlationId,
        quoteMetadata:
          schemaVersion === 2 ? (result as FlatComparisonResultV2).quoteMetadata : undefined,
        graphEnabled,
        templateHintsEnabled,
      };
    } catch (error) {
      const reason =
        error instanceof UnifiedComparisonError
          ? error.reason
          : error instanceof Error
            ? error.message
            : String(error);
      const fallbackCorrelationId =
        error instanceof UnifiedComparisonError ? error.correlationId : correlationId;

      console.error(`❌ [Adapter] Unified engine failed [${fallbackCorrelationId}]: ${reason}`);
      console.error(
        `🔄 [Adapter] routing=fallback, reason=${reason}, correlationId=${fallbackCorrelationId}`
      );

      const matrix = await this.runLegacyBatch(pdfPaths, reason, fallbackCorrelationId);

      return {
        matrix,
        engine: 'fallback',
        schemaVersion: 1,
        fallbackReason: reason,
        correlationId: fallbackCorrelationId,
        graphEnabled: false,
        templateHintsEnabled: false,
      };
    }
  }

  /**
   * Enabled when the master boolean flag is on, or when the shared
   * `hashUserId` bucket (same strategy as `UnifiedComparisonFeatureFlag`)
   * falls inside the request-time rollout percentage. Anonymous users only
   * enter fully rolled-out slices.
   */
  private isSliceEnabled(
    flag: keyof FeatureFlags,
    rollout: UnifiedSliceRolloutKey,
    userId?: string
  ): boolean {
    if (featureFlags.isEnabled(flag)) {
      return true;
    }
    const percentage = getUnifiedSliceRolloutPercentage(rollout);
    if (percentage >= 100) {
      return true;
    }
    if (percentage <= 0) {
      return false;
    }
    if (!userId) {
      return false;
    }
    return hashUserId(userId) < percentage;
  }

  /**
   * Validate comparison with clauses (deep mode)
   */
  async validateWithClauses(comparisonId: string, clausePaths: string[]): Promise<MatrixRow[]> {
    console.log(`🔍 [Adapter] Deep mode validation for comparison ${comparisonId}`);

    if (!clausePaths || clausePaths.length === 0) {
      throw new Error('No clause files provided for deep mode validation');
    }

    try {
      // TODO: Retrieve original comparison from database
      // For now, this is a placeholder implementation

      // Call unified engine deep mode
      // const result = await unifiedComparisonEngine.validateWithClauses(
      //   originalComparison,
      //   clausePaths
      // );

      // return this.toMatrixRows(result);

      throw new Error('Deep mode not yet fully implemented');
    } catch (error) {
      console.error(
        `❌ [Adapter] Deep mode failed:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Run the legacy per-quote batch service and convert the results to the
   * shared MatrixRow[] shape.
   */
  private async runLegacyBatch(
    pdfPaths: string[],
    reason: string,
    correlationId: string
  ): Promise<MatrixRow[]> {
    console.log(
      `🔄 [Adapter] Falling back to legacy batch service [${correlationId}], reason=${reason}`
    );
    const quotes = await processQuotesBatch(pdfPaths, { concurrencyLimit: 2 });
    return quotesToMatrixRows(quotes);
  }
}

export const comparisonEngineAdapter = new ComparisonEngineAdapter();
export default comparisonEngineAdapter;
