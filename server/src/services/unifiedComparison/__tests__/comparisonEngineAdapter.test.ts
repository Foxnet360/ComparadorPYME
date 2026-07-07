/**
 * Comparison Engine Adapter Tests
 * Verifies unified-first routing, explicit disable, fallback logging, and result envelope.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { comparisonEngineAdapter } from '../comparisonEngineAdapter';
import { unifiedComparisonEngine, UnifiedComparisonError } from '../unifiedComparisonEngine';
import { featureFlags } from '../../../config/featureFlags';
import { unifiedComparisonFlag } from '../featureFlagService';
import { processQuotesBatch } from '../../quoteProcessingService';
import { FlatComparisonResult } from '../comparisonSchema';
import { ParsedQuote } from '../../quoteParser';

vi.mock('../../quoteProcessingService', () => ({
  processQuotesBatch: vi.fn(),
}));

function makeFlatResult(): FlatComparisonResult {
  return {
    metadata: {
      generatedAt: '2026-07-01T00:00:00Z',
      model: 'gemini-3.5-flash',
      pdfCount: 2,
      processingTimeMs: 1200,
      confidence: 0.92,
      needsHumanReview: false,
    },
    insurers: ['MAPFRE', 'CHUBB'],
    rows: [
      {
        label: 'Bienes Asegurados',
        cells: [
          { insurer: 'MAPFRE', value: 'Edificio $500M' },
          { insurer: 'CHUBB', value: 'Edificio $600M' },
        ],
      },
      {
        label: 'Deducibles',
        cells: [
          { insurer: 'MAPFRE', value: '10%' },
          { insurer: 'CHUBB', value: '5%' },
        ],
      },
      {
        label: 'Prima con IVA',
        cells: [
          { insurer: 'MAPFRE', value: '$ 8.500.000' },
          { insurer: 'CHUBB', value: '$ 9.200.000' },
        ],
      },
      {
        label: 'Forma de Pago',
        cells: [
          { insurer: 'MAPFRE', value: 'Anual' },
          { insurer: 'CHUBB', value: 'Mensual' },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
  };
}

function makeParsedQuotes(): ParsedQuote[] {
  return [
    {
      insurerName: 'MAPFRE',
      policyName: 'PYME',
      priceAnnual: 8_500_000,
      currency: 'COP',
      coverages: [
        {
          name: 'Incendio (Edificio y Contenidos)',
          canonicalName: 'Incendio (Edificio y Contenidos)',
          value: '500M',
          deductible: '10%',
          confidence: 95,
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 92,
    },
    {
      insurerName: 'CHUBB',
      policyName: 'PYME',
      priceAnnual: 9_200_000,
      currency: 'COP',
      coverages: [
        {
          name: 'Incendio (Edificio y Contenidos)',
          canonicalName: 'Incendio (Edificio y Contenidos)',
          value: '600M',
          deductible: '5%',
          confidence: 90,
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 90,
    },
  ];
}

describe('ComparisonEngineAdapter', () => {
  let compareSpy: ReturnType<typeof vi.spyOn>;
  let batchSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    unifiedComparisonFlag.updateRolloutPercentage(100);

    compareSpy = vi.spyOn(unifiedComparisonEngine, 'compare');
    batchSpy = vi.mocked(processQuotesBatch);
    batchSpy.mockResolvedValue(makeParsedQuotes());

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes to unified engine by default and returns ComparisonAdapterResult', async () => {
    compareSpy.mockResolvedValue(makeFlatResult());

    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf']);

    expect(compareSpy).toHaveBeenCalledWith(['a.pdf', 'b.pdf']);
    expect(batchSpy).not.toHaveBeenCalled();
    expect(result.engine).toBe('unified');
    expect(result.correlationId).toBeDefined();
    expect(result.matrix.length).toBeGreaterThan(0);
    expect(result.fallbackReason).toBeUndefined();
  });

  it('routes to legacy batch when feature flag is disabled', async () => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', false);

    const result = await comparisonEngineAdapter.generateComparison(['a.pdf']);

    expect(compareSpy).not.toHaveBeenCalled();
    expect(batchSpy).toHaveBeenCalledWith(['a.pdf'], expect.any(Object));
    expect(result.engine).toBe('fallback');
    expect(result.fallbackReason).toBe('unified_disabled_by_flag');
  });

  it('falls back to batch service when unified engine throws', async () => {
    compareSpy.mockRejectedValue(
      new UnifiedComparisonError('parse_failure: invalid json', 'corr-123', 3)
    );

    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf']);

    expect(compareSpy).toHaveBeenCalled();
    expect(batchSpy).toHaveBeenCalledWith(['a.pdf', 'b.pdf'], expect.any(Object));
    expect(result.engine).toBe('fallback');
    expect(result.fallbackReason).toContain('parse_failure');
    expect(result.correlationId).toBe('corr-123');
  });

  it('logs fallback reason with correlation id', async () => {
    compareSpy.mockRejectedValue(new UnifiedComparisonError('network error', 'corr-456', 1));

    await comparisonEngineAdapter.generateComparison(['a.pdf']);

    const matchingLog = consoleErrorSpy.mock.calls.find(
      (call) => String(call[0]).includes('routing=fallback') && String(call[0]).includes('corr-456')
    );
    expect(matchingLog).toBeDefined();
  });

  it('transforms fallback quotes into MatrixRow[]', async () => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', false);

    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf']);

    const dataRows = result.matrix.filter((r) => r.type === 'data');
    expect(dataRows.some((r) => r.id === 'premium_total')).toBe(true);
    expect(result.matrix[0].label).toContain('MAPFRE');
  });

  it('transforms unified result into MatrixRow[]', async () => {
    compareSpy.mockResolvedValue(makeFlatResult());

    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf']);

    const dataRows = result.matrix.filter((r) => r.type === 'data');
    expect(dataRows.some((r) => r.id === 'premium_total')).toBe(true);
    expect(dataRows.some((r) => r.label === 'Bienes Asegurados')).toBe(true);
  });

  it('propagates when batch service also fails', async () => {
    compareSpy.mockRejectedValue(new Error('unified failed'));
    batchSpy.mockRejectedValue(new Error('batch failed'));

    await expect(comparisonEngineAdapter.generateComparison(['a.pdf'])).rejects.toThrow(
      'batch failed'
    );
  });
});
