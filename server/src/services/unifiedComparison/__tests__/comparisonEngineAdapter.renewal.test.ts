/**
 * Renewal-mode adapter tests (task 1.12, spec R2.1/R2.2/R5.1/R5.2).
 *
 * In renewal mode the adapter promotes the v2 result to schemaVersion 3 and
 * prepends the incumbent baseline column. The reference quote is NEVER sent
 * to the engine as a candidate. NEW mode keeps v1/v2 behavior byte-identical.
 *
 * All engine/flag modules are mocked so this suite runs without env secrets.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { comparisonEngineAdapter } from '../comparisonEngineAdapter';
import { unifiedComparisonEngine } from '../unifiedComparisonEngine';
import { unifiedComparisonFlag } from '../featureFlagService';
import { FlatComparisonResultV2, SchemaSection } from '../comparisonSchema';
import { ParsedQuote } from '../../quoteParser';

vi.mock('../unifiedComparisonEngine', () => ({
  unifiedComparisonEngine: { compare: vi.fn() },
  UnifiedComparisonError: class UnifiedComparisonError extends Error {
    constructor(
      public readonly reason: string,
      public readonly correlationId: string,
      public readonly attempts: number
    ) {
      super(`Unified comparison failed [${correlationId}]: ${reason}`);
    }
  },
}));

vi.mock('../featureFlagService', () => ({
  unifiedComparisonFlag: {
    isEnabled: vi.fn(() => true),
    isGranularComparisonSchemaEnabled: vi.fn(() => true),
  },
  hashUserId: () => 0,
}));

vi.mock('../../../config/featureFlags', () => ({
  featureFlags: { isEnabled: vi.fn(() => false) },
  getUnifiedSliceRolloutPercentage: vi.fn(() => 0),
}));

vi.mock('../../quoteProcessingService', () => ({
  processQuotesBatch: vi.fn(async () => []),
}));

function makeV2Result(): FlatComparisonResultV2 {
  return {
    schemaVersion: 2,
    metadata: {
      generatedAt: '2026-07-01T00:00:00Z',
      model: 'gemini-3.7-flash',
      pdfCount: 2,
      processingTimeMs: 100,
      confidence: 0.9,
      needsHumanReview: false,
    },
    insurers: ['MAPFRE', 'CHUBB'],
    rows: [
      {
        label: 'Incendio',
        section: SchemaSection.COBERTURAS,
        canonicalName: 'Incendio',
        cells: [
          { insurer: 'MAPFRE', value: '500M', confidence: 0.9 },
          { insurer: 'CHUBB', value: '600M', confidence: 0.9 },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
    quoteMetadata: [{ insurer: 'MAPFRE' }, { insurer: 'CHUBB' }],
  };
}

function makeReferenceQuote(): ParsedQuote {
  return {
    insurerName: 'Seguros Bolívar',
    policyName: 'PYME Empresarial',
    priceAnnual: 8_500_000,
    currency: 'COP',
    coverages: [
      { name: 'Incendio', canonicalName: 'Incendio', value: '450M', deductible: '10%' },
    ],
    specialConditions: [],
    rawText: '',
    parseConfidence: 90,
  };
}

describe('ComparisonEngineAdapter — renewal mode (v3)', () => {
  const compareMock = vi.mocked(unifiedComparisonEngine.compare);

  beforeEach(() => {
    compareMock.mockResolvedValue(makeV2Result());
  });

  it('emits schemaVersion 3 with a baseline column when analysis_type is renewal and a referenceQuote is present', async () => {
    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf'], {
      userId: 'u1',
      analysisType: 'renewal',
      referenceQuote: makeReferenceQuote(),
    });

    expect(result.schemaVersion).toBe(3);
    const marker = result.matrix.find((r) => r.id === 'baseline_column');
    expect(marker).toBeDefined();
    expect(marker!.isBaseline).toBe(true);

    const dataRow = result.matrix.find((r) => r.type === 'data' && r.label === 'Incendio');
    expect(dataRow).toBeDefined();
    // baseline + one cell per candidate insurer
    expect(dataRow!.cells).toHaveLength(3);
    expect(dataRow!.cells[0]!.isBaseline).toBe(true);
    expect(dataRow!.cells[0]!.value).toBe('450M');
  });

  it('never sends the reference quote to the engine as a candidate (R2.1)', async () => {
    await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf'], {
      userId: 'u1',
      analysisType: 'renewal',
      referenceQuote: makeReferenceQuote(),
    });

    const [pdfPaths] = compareMock.mock.calls[0]!;
    expect(pdfPaths).toEqual(['a.pdf', 'b.pdf']);
  });

  it('emits schemaVersion 3 without a baseline column when the reference is missing (manual-edit fallback path)', async () => {
    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf'], {
      userId: 'u1',
      analysisType: 'renewal',
    });

    expect(result.schemaVersion).toBe(3);
    expect(result.matrix.find((r) => r.id === 'baseline_column')).toBeUndefined();
    expect(result.matrix.every((r) => r.isBaseline !== true)).toBe(true);
    expect(result.quoteMetadata).toHaveLength(2);
  });

  it('keeps v2 byte-identical behavior when analysis_type is omitted (NULL = new)', async () => {
    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf'], {
      userId: 'u1',
    });

    expect(result.schemaVersion).toBe(2);
    expect(result.matrix.find((r) => r.id === 'baseline_column')).toBeUndefined();
    expect(result.matrix.every((r) => r.isBaseline !== true)).toBe(true);
    const dataRow = result.matrix.find((r) => r.type === 'data' && r.label === 'Incendio');
    expect(dataRow!.cells).toHaveLength(2);
  });

  it('never emits v3 on the v1 path even in renewal mode', async () => {
    vi.mocked(unifiedComparisonFlag.isGranularComparisonSchemaEnabled).mockReturnValueOnce(false);
    compareMock.mockResolvedValueOnce({
      ...makeV2Result(),
      schemaVersion: 1,
    } as ReturnType<typeof makeV2Result>);

    const result = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf'], {
      userId: 'u1',
      analysisType: 'renewal',
      referenceQuote: makeReferenceQuote(),
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.matrix.every((r) => r.isBaseline !== true)).toBe(true);
  });
});
