/**
 * Reference extraction tests (task 1.11, spec R2.1).
 *
 * The incumbent policy PDF MUST go through the existing multimodal pipeline
 * unchanged and produce a `referenceQuote` that is NEVER ranked as a
 * candidate. When validation fails, the broker gets a manual-edit fallback
 * payload instead of a broken baseline.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  extractReferenceQuote,
  ReferenceExtractionResult,
} from '../referenceExtractionService';
import { ParsedQuote } from '../quoteParser';
import { ValidationResult } from '../quoteValidator';

function makeQuote(overrides: Partial<ParsedQuote> = {}): ParsedQuote {
  return {
    insurerName: 'Seguros Bolívar',
    policyName: 'PYME Empresarial',
    priceAnnual: 8_500_000,
    currency: 'COP',
    coverages: [
      { name: 'Incendio', value: '500M', deductible: '10%' },
      { name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' },
    ],
    specialConditions: [],
    rawText: 'raw',
    parseConfidence: 90,
    ...overrides,
  };
}

function okValidation(): ValidationResult {
  return {
    isValid: true,
    flags: [],
    coverageCount: 2,
    expectedCoverageCount: 2,
    numericParseSuccess: true,
  };
}

function failedValidation(): ValidationResult {
  return {
    isValid: false,
    flags: [
      {
        field: 'priceAnnual',
        severity: 'CRITICAL',
        message: 'Prima anual no especificada o es 0',
        code: 'PREMIUM_MISSING',
      },
    ],
    coverageCount: 0,
    expectedCoverageCount: 2,
    numericParseSuccess: false,
  };
}

describe('extractReferenceQuote (R2.1)', () => {
  it('returns the extracted quote as referenceQuote when validation passes', async () => {
    const quote = makeQuote();
    const processBatch = vi.fn(async () => [quote]);

    const result = await extractReferenceQuote('/tmp/incumbent.pdf', {
      processBatch,
      validate: () => okValidation(),
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.referenceQuote).toEqual(quote);
    expect(result.validation.isValid).toBe(true);
  });

  it('sends ONLY the incumbent PDF through the existing pipeline (never batched with candidates)', async () => {
    const processBatch = vi.fn(async () => [makeQuote()]);

    await extractReferenceQuote('/tmp/incumbent.pdf', {
      domain: 'autos',
      processBatch,
      validate: () => okValidation(),
    });

    expect(processBatch).toHaveBeenCalledTimes(1);
    const [paths, batchOptions] = processBatch.mock.calls[0]!;
    expect(paths).toEqual(['/tmp/incumbent.pdf']);
    expect(batchOptions).toMatchObject({ domain: 'autos', concurrencyLimit: 1 });
  });

  it('returns a manual-edit fallback payload when the pipeline flags the extraction as failed', async () => {
    const failedQuote = makeQuote({
      isFailed: true,
      errorCategory: 'EXTRACTION_FAILED',
      priceAnnual: 0,
      coverages: [],
    });
    const processBatch = vi.fn(async () => [failedQuote]);

    const result = await extractReferenceQuote('/tmp/incumbent.pdf', {
      processBatch,
      validate: () => okValidation(),
    });

    expect(result.status).toBe('manual_edit_required');
    if (result.status !== 'manual_edit_required') throw new Error('expected fallback');
    expect(result.referenceQuote).toBeNull();
    expect(result.fallback.reason).toBe('extraction_failed');
    expect(result.fallback.draft).toEqual(failedQuote);
  });

  it('returns a manual-edit fallback payload with validation flags when validation fails', async () => {
    const weakQuote = makeQuote({ priceAnnual: 0 });
    const processBatch = vi.fn(async () => [weakQuote]);

    const result = await extractReferenceQuote('/tmp/incumbent.pdf', {
      processBatch,
      validate: () => failedValidation(),
    });

    expect(result.status).toBe('manual_edit_required');
    if (result.status !== 'manual_edit_required') throw new Error('expected fallback');
    expect(result.fallback.reason).toBe('validation_failed');
    expect(result.fallback.validationFlags).toHaveLength(1);
    expect(result.fallback.validationFlags[0]!.code).toBe('PREMIUM_MISSING');
    // Draft carries the partial extraction so the broker can edit instead of retyping.
    expect(result.fallback.draft).toEqual(weakQuote);
  });

  it('returns a manual-edit fallback payload when the pipeline yields no quote at all', async () => {
    const processBatch = vi.fn(async () => [] as ParsedQuote[]);

    const result = await extractReferenceQuote('/tmp/incumbent.pdf', {
      processBatch,
      validate: () => okValidation(),
    });

    expect(result.status).toBe('manual_edit_required');
    if (result.status !== 'manual_edit_required') throw new Error('expected fallback');
    expect(result.fallback.reason).toBe('extraction_failed');
    expect(result.fallback.draft).toBeNull();
  });

  it('never exposes the reference as a candidate list (referenceQuote is a standalone field)', async () => {
    const result: ReferenceExtractionResult = await extractReferenceQuote('/tmp/incumbent.pdf', {
      processBatch: async () => [makeQuote()],
      validate: () => okValidation(),
    });

    expect('candidates' in result).toBe(false);
    expect(result).toHaveProperty('referenceQuote');
  });
});
