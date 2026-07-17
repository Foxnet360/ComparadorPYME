/**
 * Fallback Mechanism Tests
 * Tests automatic fallback when unified engine fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { comparisonEngineAdapter } from '../comparisonEngineAdapter';
import { unifiedComparisonEngine, UnifiedComparisonError } from '../unifiedComparisonEngine';
import { featureFlags } from '../../../config/featureFlags';
import { unifiedComparisonFlag } from '../featureFlagService';
import { processQuotesBatch } from '../../quoteProcessingService';

vi.mock('../../quoteProcessingService', () => ({
  processQuotesBatch: vi.fn(),
}));

describe('Fallback Mechanism', () => {
  let compareSpy: ReturnType<typeof vi.spyOn>;
  let batchSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    unifiedComparisonFlag.updateRolloutPercentage(100);

    compareSpy = vi.spyOn(unifiedComparisonEngine, 'compare');
    batchSpy = vi.mocked(processQuotesBatch);
    batchSpy.mockResolvedValue([
      {
        insurerName: 'BBVA',
        policyName: 'PYME',
        priceAnnual: 8_500_000,
        currency: 'COP',
        coverages: [
          {
            name: 'Incendio',
            canonicalName: 'Incendio',
            value: '500M',
            deductible: '10%',
            confidence: 95,
          },
        ],
        specialConditions: [],
        rawText: '',
        parseConfidence: 92,
      },
    ]);

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fallback to batch service when unified engine throws error', async () => {
    compareSpy.mockRejectedValue(
      new UnifiedComparisonError('Simulated unified engine failure', 'corr-fallback-1', 3)
    );

    const result = await comparisonEngineAdapter.generateComparison(['fake1.pdf', 'fake2.pdf']);

    expect(compareSpy).toHaveBeenCalledWith(
      ['fake1.pdf', 'fake2.pdf'],
      expect.objectContaining({ graphEnabled: false, templateHintsEnabled: false })
    );
    expect(batchSpy).toHaveBeenCalledWith(['fake1.pdf', 'fake2.pdf'], expect.any(Object));
    expect(result.engine).toBe('fallback');
    expect(result.fallbackReason).toBe('Simulated unified engine failure');
    expect(result.correlationId).toBe('corr-fallback-1');
    expect(result.matrix.length).toBeGreaterThan(0);
  });

  it('should route to batch service when feature flag is disabled', async () => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', false);

    const result = await comparisonEngineAdapter.generateComparison(['fake1.pdf']);

    expect(compareSpy).not.toHaveBeenCalled();
    expect(batchSpy).toHaveBeenCalledWith(['fake1.pdf'], expect.any(Object));
    expect(result.engine).toBe('fallback');
    expect(result.fallbackReason).toBe('unified_disabled_by_flag');
  });

  it('should log fallback reason with correlation id', async () => {
    compareSpy.mockRejectedValue(
      new UnifiedComparisonError('Network error: Connection refused', 'corr-net-1', 1)
    );

    await comparisonEngineAdapter.generateComparison(['fake1.pdf']);

    const matchingLog = consoleErrorSpy.mock.calls.find(
      (call) =>
        String(call[0]).includes('routing=fallback') && String(call[0]).includes('corr-net-1')
    );
    expect(matchingLog).toBeDefined();
  });

  it('should log timeout fallback reason', async () => {
    compareSpy.mockRejectedValue(
      new UnifiedComparisonError('Request timeout after 30000ms', 'corr-timeout-1', 1)
    );

    const result = await comparisonEngineAdapter.generateComparison(['fake1.pdf']);

    expect(result.engine).toBe('fallback');
    expect(result.fallbackReason).toContain('timeout');
  });
});

describe('Feature Flag Toggle', () => {
  beforeEach(() => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', false);
  });

  it('should toggle feature flag at runtime', () => {
    expect(featureFlags.isEnabled('useUnifiedComparisonEngine')).toBe(false);

    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    expect(featureFlags.isEnabled('useUnifiedComparisonEngine')).toBe(true);

    featureFlags.updateFlag('useUnifiedComparisonEngine', false);
    expect(featureFlags.isEnabled('useUnifiedComparisonEngine')).toBe(false);
  });

  it('should respect user-specific overrides', () => {
    unifiedComparisonFlag.updateRolloutPercentage(0);

    expect(unifiedComparisonFlag.isEnabled()).toBe(false);
    expect(unifiedComparisonFlag.isEnabled('user123')).toBe(false);
  });

  it('should handle percentage-based rollout', () => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    unifiedComparisonFlag.updateRolloutPercentage(50);

    const testUserId = 'test-user-123';
    const result = unifiedComparisonFlag.isEnabled(testUserId);

    expect(unifiedComparisonFlag.isEnabled(testUserId)).toBe(result);

    unifiedComparisonFlag.updateRolloutPercentage(0);
  });

  it('should handle 100% rollout', () => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    unifiedComparisonFlag.updateRolloutPercentage(100);

    expect(unifiedComparisonFlag.isEnabled('any-user')).toBe(true);
    expect(unifiedComparisonFlag.isEnabled()).toBe(true);

    unifiedComparisonFlag.updateRolloutPercentage(0);
  });
});
