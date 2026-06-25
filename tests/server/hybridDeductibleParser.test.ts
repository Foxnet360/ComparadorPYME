import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hybridDeductibleParser,
  resetHybridParserStats,
} from '../../server/src/services/hybridDeductibleParser';

vi.mock('../../server/src/config/env', () => ({
  env: {
    GEMINI_API_KEY: 'dummy',
    GEMINI_MODEL: 'gemini-3.5-flash',
    GEMINI_CHAT_MODEL: 'gemini-2.5-flash-lite',
    GEMINI_CLAUSE_MODEL: 'gemini-3.5-flash',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-2',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'dummy',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy',
    SUPABASE_JWT_SECRET: 'dummy',
    PORT: 8080,
    NODE_ENV: 'test',
    REGION: 'CO',
    SMMLV_VALUE: 1423500,
    UVT_VALUE: 42412,
    CURRENCY: 'COP',
    CLAUSE_PAGES_BUCKET: 'clause-pages',
    MAX_FILE_SIZE: 52428800,
    MAX_PAGES_LIMIT: 100,
    UPLOAD_TIMEOUT: 300000,
    LOG_LEVEL: 'info',
  },
}));

const mockGetCachedDeductibleV2 = vi.fn();
const mockSetCachedDeductibleV2 = vi.fn();

vi.mock('../../server/src/services/cache/redisCache', () => ({
  getCachedDeductibleV2: (...args: any[]) => mockGetCachedDeductibleV2(...args),
  setCachedDeductibleV2: (...args: any[]) => mockSetCachedDeductibleV2(...args),
  getCacheValue: vi.fn().mockResolvedValue(null),
  setCacheValue: vi.fn().mockResolvedValue(undefined),
  deleteCacheValue: vi.fn().mockResolvedValue(undefined),
}));

const mockExtractDeductible = vi.fn();

vi.mock('../../server/src/services/gemini', () => ({
  geminiService: {
    extractDeductible: (text: string, options?: any) => mockExtractDeductible(text, options),
  },
}));

describe('hybridDeductibleParser (PR3 canonical parser)', () => {
  beforeEach(() => {
    mockGetCachedDeductibleV2.mockReset().mockResolvedValue(null);
    mockSetCachedDeductibleV2.mockReset().mockResolvedValue(undefined);
    mockExtractDeductible.mockReset();
    resetHybridParserStats();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('compound operators', () => {
    it('parses "10% y 5 SMMLV" as greater_of', async () => {
      const result = await hybridDeductibleParser.parse('10% y 5 SMMLV');

      expect(result.isComposite).toBe(true);
      expect(result.compoundOperator).toBe('greater_of');
      expect(result.components).toContainEqual({ type: 'percentage', value: 10 });
      expect(result.components).toContainEqual({ type: 'smmlv', value: 5 });
      expect(result.normalized.percentage).toBe(10);
      expect(result.normalized.minAmount).toBe(5 * 1_423_500);
      expect(result.parseMethod).toBe('regex');
    });

    it('parses "mayor entre 10% y 5 SMMLV" as greater_of', async () => {
      const result = await hybridDeductibleParser.parse('mayor entre 10% y 5 SMMLV');

      expect(result.compoundOperator).toBe('greater_of');
      expect(result.components).toContainEqual({ type: 'percentage', value: 10 });
      expect(result.components).toContainEqual({ type: 'smmlv', value: 5 });
    });

    it('parses "menor entre 10% y $500.000" as lesser_of', async () => {
      const result = await hybridDeductibleParser.parse('menor entre 10% y $500.000');

      expect(result.compoundOperator).toBe('lesser_of');
      expect(result.components).toContainEqual({ type: 'percentage', value: 10 });
      expect(result.components).toContainEqual({ type: 'fixed', value: 500000, currency: 'COP' });
      expect(result.normalized.maxAmount).toBe(500000);
    });

    it('parses "10% / mín. 2 SMMLV" as greater_of', async () => {
      const result = await hybridDeductibleParser.parse('10% / mín. 2 SMMLV');

      expect(result.compoundOperator).toBe('greater_of');
      expect(result.components).toContainEqual({ type: 'percentage', value: 10 });
      expect(result.components).toContainEqual({ type: 'minimum', value: 2, currency: 'SMMLV' });
      expect(result.normalized.minAmount).toBe(2 * 1_423_500);
    });

    it('parses "10% / máx. $1.000.000" as lesser_of', async () => {
      const result = await hybridDeductibleParser.parse('10% / máx. $1.000.000');

      expect(result.compoundOperator).toBe('lesser_of');
      expect(result.components).toContainEqual({ type: 'percentage', value: 10 });
      expect(result.components).toContainEqual({ type: 'maximum', value: 1000000, currency: 'COP' });
      expect(result.normalized.maxAmount).toBe(1000000);
    });

    it('parses "10% + 5 SMMLV" as sum', async () => {
      const result = await hybridDeductibleParser.parse('10% + 5 SMMLV');

      expect(result.compoundOperator).toBe('sum');
      expect(result.components).toContainEqual({ type: 'percentage', value: 10 });
      expect(result.components).toContainEqual({ type: 'smmlv', value: 5 });
    });
  });

  describe('reference-unit deductibles', () => {
    it('resolves SMMLV references to COP', async () => {
      const result = await hybridDeductibleParser.parse('3 SMMLV');

      expect(result.components).toEqual([{ type: 'smmlv', value: 3 }]);
      expect(result.normalized.minAmount).toBe(3 * 1_423_500);
      expect(result.normalized.minAmountCOP).toBe(3 * 1_423_500);
    });

    it('resolves UVT references to COP', async () => {
      const result = await hybridDeductibleParser.parse('7 UVT');

      expect(result.components).toEqual([{ type: 'uvt', value: 7 }]);
      expect(result.normalized.minAmount).toBe(7 * 42_412);
    });

    it('resolves SM shorthand to SMMLV', async () => {
      const result = await hybridDeductibleParser.parse('2 SM');

      expect(result.components).toEqual([{ type: 'smmlv', value: 2 }]);
    });
  });

  describe('percentage and NA forms', () => {
    it('parses simple percentage', async () => {
      const result = await hybridDeductibleParser.parse('12,5%');

      expect(result.components).toEqual([{ type: 'percentage', value: 12.5 }]);
      expect(result.normalized.isPercentageBased).toBe(true);
      expect(result.normalized.percentage).toBe(12.5);
    });

    it('parses "NO APLICA" as zero deductible', async () => {
      const result = await hybridDeductibleParser.parse('NO APLICA');

      expect(result.isZero).toBe(true);
      expect(result.components).toEqual([{ type: 'na', value: 0 }]);
    });

    it('parses "sin deducible alguno" as zero deductible', async () => {
      const result = await hybridDeductibleParser.parse('sin deducible alguno');

      expect(result.isZero).toBe(true);
    });

    it('parses "N/A" as zero deductible', async () => {
      const result = await hybridDeductibleParser.parse('N/A');

      expect(result.isZero).toBe(true);
    });
  });

  describe('malformed / edge inputs', () => {
    it('returns unknown for empty input with parseMethod empty', () => {
      const result = hybridDeductibleParser.parseSync('');

      expect(result.components[0].type).toBe('unknown');
      expect(result.parseMethod).toBe('empty');
    });

    it('returns unknown for whitespace-only input', () => {
      const result = hybridDeductibleParser.parseSync('   ');

      expect(result.components[0].type).toBe('unknown');
    });

    it('returns unknown for malformed percentages', () => {
      const result = hybridDeductibleParser.parseSync('%%');

      expect(result.components[0].type).toBe('unknown');
    });

    it('falls back to LLM when regex cannot parse', async () => {
      mockExtractDeductible.mockResolvedValue({
        components: [{ type: 'fixed', value: 250000, currency: 'COP' }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });

      const result = await hybridDeductibleParser.parse('deducible especial según clausulado');

      expect(mockExtractDeductible).toHaveBeenCalled();
      expect(result.parseMethod).toBe('llm');
      expect(result.components[0].type).toBe('fixed');
    });

    it('returns unknown when LLM fallback fails', async () => {
      mockExtractDeductible.mockRejectedValue(new Error('Gemini error'));

      const result = await hybridDeductibleParser.parse('texto ininteligible');

      expect(result.components[0].type).toBe('unknown');
      expect(result.parseMethod).toBe('llm');
    });
  });

  describe('parseSync', () => {
    it('does not call cache or LLM', () => {
      hybridDeductibleParser.parseSync('5 SMMLV');

      expect(mockGetCachedDeductibleV2).not.toHaveBeenCalled();
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('returns rawText in the result', () => {
      const result = hybridDeductibleParser.parseSync('15% con mínimo de 2 SMMLV');

      expect(result.rawText).toBe('15% con mínimo de 2 SMMLV');
    });
  });
});
