import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hybridDeductibleParser,
  HybridDeductibleResult,
} from '../hybridDeductibleParser';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCachedDeductibleV2 = vi.fn();
const mockSetCachedDeductibleV2 = vi.fn();

vi.mock('../cache/redisCache', () => ({
  getCachedDeductibleV2: (...args: any[]) => mockGetCachedDeductibleV2(...args),
  setCachedDeductibleV2: (...args: any[]) => mockSetCachedDeductibleV2(...args),
}));

const mockExtractDeductible = vi.fn();

vi.mock('../gemini', () => ({
  geminiService: {
    extractDeductible: (text: string, options?: any) => mockExtractDeductible(text, options),
  },
}));

const mockQueryDeductible = vi.fn();

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    queryDeductible: (...args: any[]) => mockQueryDeductible(...args),
  },
}));

const mockIsEnabled = vi.fn();

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: (flag: string) => mockIsEnabled(flag),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCached(structure: any) {
  return JSON.parse(JSON.stringify(structure));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hybridDeductibleParser graph integration', () => {
  beforeEach(() => {
    mockGetCachedDeductibleV2.mockReset().mockResolvedValue(null);
    mockSetCachedDeductibleV2.mockReset().mockResolvedValue(undefined);
    mockExtractDeductible.mockReset().mockResolvedValue({
      components: [{ type: 'unknown', value: 0 }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    });
    mockQueryDeductible.mockReset().mockResolvedValue([]);
    mockIsEnabled.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses graph appliesTo for benchmark when coverageName is not provided', async () => {
    mockQueryDeductible.mockResolvedValue([
      { deductibleText: '10%', appliesTo: 'incendio', confidence: 0.92 },
    ]);

    const result = await hybridDeductibleParser.parse('10%', {
      insurer: 'SBS',
      domain: 'pyme',
    });

    expect(mockQueryDeductible).toHaveBeenCalledWith('10%', {
      insurer: 'SBS',
      domain: 'pyme',
    });
    expect(result.appliesTo).toEqual({
      coverageName: 'incendio',
      confidence: 0.92,
    });
    expect(result.benchmark).toBeDefined();
  });

  it('prefers explicit coverageName over graph appliesTo', async () => {
    mockQueryDeductible.mockResolvedValue([
      { deductibleText: '10%', appliesTo: 'incendio', confidence: 0.92 },
    ]);

    const result = await hybridDeductibleParser.parse('10%', {
      coverageName: 'robo',
      insurer: 'SBS',
      domain: 'pyme',
    });

    expect(result.appliesTo?.coverageName).toBe('robo');
    expect(result.benchmark).toBeDefined();
  });

  it('ignores low-confidence graph appliesTo links', async () => {
    mockQueryDeductible.mockResolvedValue([
      { deductibleText: '10%', appliesTo: 'incendio', confidence: 0.55 },
    ]);

    const result = await hybridDeductibleParser.parse('10%', {
      insurer: 'SBS',
      domain: 'pyme',
    });

    expect(result.appliesTo).toBeUndefined();
    expect(result.benchmark).toBeUndefined();
  });

  it('skips graph query when flag is disabled', async () => {
    mockIsEnabled.mockReturnValue(false);

    const result = await hybridDeductibleParser.parse('10%', {
      insurer: 'SBS',
      domain: 'pyme',
    });

    expect(mockQueryDeductible).not.toHaveBeenCalled();
    expect(result.appliesTo).toBeUndefined();
  });

  it('falls back to regex/llm when graph query throws', async () => {
    mockQueryDeductible.mockRejectedValue(new Error('graph unavailable'));

    const result = await hybridDeductibleParser.parse('10%', {
      insurer: 'SBS',
      domain: 'pyme',
    });

    expect(result.components).toEqual([{ type: 'percentage', value: 10 }]);
    expect(result.appliesTo).toBeUndefined();
  });

  it('accepts legacy string coverageName as second argument', async () => {
    const result = await hybridDeductibleParser.parse('10%', 'incendio', {
      insurer: 'SBS',
      domain: 'pyme',
    });

    expect(result.appliesTo?.coverageName).toBe('incendio');
    expect(result.benchmark).toBeDefined();
  });

  it('uses template deductibleColumnIndex hint to mark known deductible cells', async () => {
    const result = await hybridDeductibleParser.parse('10%', {
      insurer: 'BBVA',
      domain: 'pyme',
      templateHints: { deductibleColumnIndex: 3 },
    });

    expect(result.components).toEqual([{ type: 'percentage', value: 10 }]);
    expect(result.normalized.percentage).toBe(10);
  });
});
