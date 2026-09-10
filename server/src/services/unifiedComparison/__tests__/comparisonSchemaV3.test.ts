/**
 * Schema v3 tests (task 1.12, spec R5.1/R5.2/R2.2).
 *
 * schemaVersion 3 = v2 + optional baseline column (flagged isBaseline) +
 * optional renewalAnalytics block. The v3 branch is gated on
 * analysis_type === 'renewal' AND the granular schema flag; NEW mode never
 * emits v3 and v1/v2 behavior stays byte-identical.
 */

import { describe, it, expect } from 'vitest';
import {
  FlatComparisonSchemaV3,
  resolveComparisonSchemaVersion,
  normalizeAnalysisType,
} from '../comparisonSchema';

const baseV2 = {
  metadata: {
    generatedAt: '2026-07-01T00:00:00.000Z',
    model: 'gemini-3.7-flash',
    pdfCount: 2,
    processingTimeMs: 100,
    confidence: 0.9,
    needsHumanReview: false,
  },
  insurers: ['MAPFRE', 'CHUBB'],
  schemaVersion: 2,
  rows: [
    {
      label: 'Incendio',
      cells: [
        { insurer: 'MAPFRE', value: '500M' },
        { insurer: 'CHUBB', value: '600M' },
      ],
    },
  ],
  extraRows: [],
  warnings: [],
};

describe('resolveComparisonSchemaVersion v3 branch (R5.1/R5.2)', () => {
  it('returns 3 for renewal analyses on the granular path with a v2 result', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 2 }, true, 'renewal')).toBe(3);
  });

  it('returns 3 when the result already carries schemaVersion 3 in renewal mode', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 3 }, true, 'renewal')).toBe(3);
  });

  it('never emits v3 in new mode even if the result claims schemaVersion 3', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 3 }, true, 'new')).toBe(1);
  });

  it('keeps v2 for renewal analyses when the granular flag is disabled', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 2 }, false, 'renewal')).toBe(1);
  });

  it('treats omitted analysis_type as new (NULL semantics, R5.4)', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 2 }, true)).toBe(2);
    expect(resolveComparisonSchemaVersion({ schemaVersion: 3 }, true, undefined)).toBe(1);
    expect(resolveComparisonSchemaVersion({ schemaVersion: 3 }, true, null)).toBe(1);
  });

  it('keeps legacy v1/v2 resolution byte-identical for new analyses', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 2 }, true)).toBe(2);
    expect(resolveComparisonSchemaVersion({ schemaVersion: 2 }, false)).toBe(1);
    expect(resolveComparisonSchemaVersion({}, true)).toBe(1);
    expect(resolveComparisonSchemaVersion({ schemaVersion: 1 }, true, 'renewal')).toBe(1);
  });
});

describe('normalizeAnalysisType (NULL = new, R5.4)', () => {
  it('maps null/undefined/empty to new', () => {
    expect(normalizeAnalysisType(null)).toBe('new');
    expect(normalizeAnalysisType(undefined)).toBe('new');
    expect(normalizeAnalysisType('')).toBe('new');
  });

  it('passes through explicit values', () => {
    expect(normalizeAnalysisType('renewal')).toBe('renewal');
    expect(normalizeAnalysisType('new')).toBe('new');
  });

  it('maps unknown values to new (fail-safe)', () => {
    expect(normalizeAnalysisType('weird')).toBe('new');
  });
});

describe('FlatComparisonSchemaV3', () => {
  it('accepts a v2 payload extended with baseline and renewalAnalytics', () => {
    const result = FlatComparisonSchemaV3.safeParse({
      ...baseV2,
      schemaVersion: 3,
      baseline: {
        insurerName: 'Seguros Bolívar',
        priceAnnual: 8_500_000,
        coverages: [{ name: 'Incendio', value: '500M', deductible: '10%' }],
      },
      renewalAnalytics: [
        {
          insurer: 'MAPFRE',
          gaps: {
            coveragesLost: ['RC'],
            coveragesGained: ['Terremoto'],
            deductibleWorsening: [],
            newExclusions: ['Terremoto por zona'],
          },
          premiumDelta: { absolute: 500000, percentage: 5.88, direction: 'increase' },
          friction: ['salud: carencias y preexistencias aplican'],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(3);
      expect(result.data.baseline?.insurerName).toBe('Seguros Bolívar');
      expect(result.data.renewalAnalytics?.[0]?.premiumDelta.direction).toBe('increase');
    }
  });

  it('accepts a v3 payload without the optional blocks (v2-compatible)', () => {
    const result = FlatComparisonSchemaV3.safeParse({ ...baseV2, schemaVersion: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects a schemaVersion other than 3', () => {
    const result = FlatComparisonSchemaV3.safeParse({ ...baseV2, schemaVersion: 2 });
    expect(result.success).toBe(false);
  });
});
