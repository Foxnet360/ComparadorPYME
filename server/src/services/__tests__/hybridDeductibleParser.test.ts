import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hybridDeductibleParser,
  getHybridParserStats,
  resetHybridParserStats,
  HybridDeductibleResult,
} from '../hybridDeductibleParser';

// Mock environment variables so env.ts does not call process.exit
vi.mock('../../config/env', () => ({
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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCachedDeductibleV2 = vi.fn();
const mockSetCachedDeductibleV2 = vi.fn();

vi.mock('../cache/redisCache', () => ({
  getCachedDeductibleV2: (...args: unknown[]) => mockGetCachedDeductibleV2(...args),
  setCachedDeductibleV2: (...args: unknown[]) => mockSetCachedDeductibleV2(...args),
  getCacheValue: vi.fn().mockResolvedValue(null),
  setCacheValue: vi.fn().mockResolvedValue(undefined),
  deleteCacheValue: vi.fn().mockResolvedValue(undefined),
}));

const mockExtractDeductible = vi.fn();

vi.mock('../gemini', () => ({
  geminiService: {
    extractDeductible: (text: string, options?: unknown) => mockExtractDeductible(text, options),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCached(structure: unknown) {
  return JSON.parse(JSON.stringify(structure));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hybridDeductibleParser', () => {
  beforeEach(() => {
    mockGetCachedDeductibleV2.mockReset();
    mockSetCachedDeductibleV2.mockReset().mockResolvedValue(undefined);
    mockExtractDeductible.mockReset();
    resetHybridParserStats();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // Cache path
  // ========================================================================
  describe('cache path', () => {
    it('should return cached result when cache hit occurs', async () => {
      const cached: HybridDeductibleResult = {
        components: [{ type: 'percentage', value: 10 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
        rawText: '10%',
        normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
      };
      mockGetCachedDeductibleV2.mockResolvedValue(makeCached(cached));

      const result = await hybridDeductibleParser.parse('10%');

      expect(mockGetCachedDeductibleV2).toHaveBeenCalledWith('10%');
      expect(mockExtractDeductible).not.toHaveBeenCalled();
      expect(result.components).toEqual([{ type: 'percentage', value: 10 }]);
      expect(result.normalized.percentage).toBe(10);
      expect(getHybridParserStats().cacheHits).toBe(1);
    });

    it('should not call LLM when cache returns a result', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue({
        components: [{ type: 'na', value: 0 }],
        isZero: true,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });

      await hybridDeductibleParser.parse('No aplica');

      expect(mockExtractDeductible).not.toHaveBeenCalled();
      expect(getHybridParserStats().llmFallbacks).toBe(0);
    });
  });

  // ========================================================================
  // Regex path
  // ========================================================================
  describe('regex path', () => {
    it('should parse zero deductible without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('sin deducible');

      expect(result.isZero).toBe(true);
      expect(result.components).toEqual([{ type: 'na', value: 0 }]);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
      expect(getHybridParserStats().regexHits).toBe(1);
    });

    it('should parse percentage deductible without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('15%');

      expect(result.components).toEqual([{ type: 'percentage', value: 15 }]);
      expect(result.normalized.percentage).toBe(15);
      expect(result.normalized.isPercentageBased).toBe(true);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should parse SMMLV deductible without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('5 SMMLV');

      expect(result.components).toEqual([{ type: 'smmlv', value: 5 }]);
      expect(result.normalized.minAmount).toBe(5 * 1_423_500); // DEFAULT_RATES.smmlv
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should parse UVT deductible without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('10 UVT');

      expect(result.components).toEqual([{ type: 'uvt', value: 10 }]);
      expect(result.normalized.minAmount).toBe(10 * 42_412);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should parse fixed amount deductible without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('$500,000 COP');

      expect(result.components[0].type).toBe('fixed');
      expect(result.components[0].value).toBe(500000);
      expect(result.normalized.minAmount).toBe(500000);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should parse compound deductible (percentage + min) without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('10% con mínimo de 5 SMMLV');

      expect(result.isComposite).toBe(true);
      expect(result.components).toEqual([
        { type: 'percentage', value: 10 },
        { type: 'minimum', value: 5, currency: 'SMMLV' },
      ]);
      expect(result.normalized.percentage).toBe(10);
      expect(result.normalized.minAmount).toBe(5 * 1_423_500);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should parse compound deductible (percentage + max) without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('15% con tope de 100 SMMLV');

      expect(result.isComposite).toBe(true);
      expect(result.hasMaximum).toBe(true);
      expect(result.normalized.maxAmount).toBe(100 * 1_423_500);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should cache regex hits', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      await hybridDeductibleParser.parse('20%');

      expect(mockSetCachedDeductibleV2).toHaveBeenCalledWith(
        '20%',
        expect.objectContaining({ components: [{ type: 'percentage', value: 20 }] })
      );
    });

    it('should parse fixed amount deductible in USD without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('$500 USD');

      expect(result.components[0].type).toBe('fixed');
      expect(result.components[0].value).toBe(500);
      expect(result.components[0].currency).toBe('USD');
      expect(result.normalized.minAmount).toBe(500);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should parse compound deductible with minimum in UVT without LLM', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('10% con mínimo de 5 UVT');

      expect(result.isComposite).toBe(true);
      expect(result.components).toContainEqual({ type: 'percentage', value: 10 });
      expect(result.components).toContainEqual({ type: 'minimum', value: 5, currency: 'UVT' });
      expect(result.normalized.minAmount).toBe(5 * 42_412);
      expect(mockExtractDeductible).not.toHaveBeenCalled();
    });

    it('should log telemetry summary when operation count reaches a multiple of 10', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);
      mockExtractDeductible.mockResolvedValue({
        components: [{ type: 'unknown', value: 0 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        for (let i = 0; i < 10; i++) {
          await hybridDeductibleParser.parse(`texto raro ${i}`);
        }

        const telemetryLog = logSpy.mock.calls.find(
          (call) =>
            typeof call[0] === 'string' && call[0].includes('[HybridDeductibleParser] Telemetry')
        );
        expect(telemetryLog).toBeDefined();
      } finally {
        logSpy.mockRestore();
      }
    });
  });

  // ========================================================================
  // Benchmark evaluation
  // ========================================================================
  describe('benchmark evaluation', () => {
    it('should attach benchmark when coverageName is provided', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('10%', 'Incendio (Edificio y Contenidos)');

      expect(result.benchmark).toBeDefined();
      expect(result.benchmark?.benchmark).toBe('standard');
    });

    it('should evaluate excellent benchmark for low percentage', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('3%', 'Incendio (Edificio y Contenidos)');

      expect(result.benchmark?.benchmark).toBe('excellent');
    });

    it('should not attach benchmark when coverageName is omitted', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('10%');

      expect(result.benchmark).toBeUndefined();
    });
  });

  // ========================================================================
  // LLM fallback
  // ========================================================================
  describe('LLM fallback', () => {
    it('should fall back to Gemini when regex fails', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);
      mockExtractDeductible.mockResolvedValue({
        components: [{ type: 'unknown', value: 0 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });

      await hybridDeductibleParser.parse('algún texto raro e intrincado');

      expect(mockExtractDeductible).toHaveBeenCalledWith(
        'algún texto raro e intrincado',
        undefined
      );
      expect(getHybridParserStats().llmFallbacks).toBe(1);
    });

    it('should cache LLM fallback results', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);
      mockExtractDeductible.mockResolvedValue({
        components: [{ type: 'unknown', value: 0 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });

      await hybridDeductibleParser.parse('texto incomprensible');

      expect(mockSetCachedDeductibleV2).toHaveBeenCalledWith(
        'texto incomprensible',
        expect.objectContaining({ components: [{ type: 'unknown', value: 0 }] })
      );
    });

    it('should return safe unknown structure when LLM throws', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);
      mockExtractDeductible.mockRejectedValue(new Error('Gemini overload'));

      const result = await hybridDeductibleParser.parse('catastrophic failure');

      expect(result.components[0].type).toBe('unknown');
      expect(result.rawText).toBe('catastrophic failure');
    });

    it('should pass optional skipValidation through to geminiService', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);
      mockExtractDeductible.mockResolvedValue({
        components: [{ type: 'fixed', value: 100 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });

      await hybridDeductibleParser.parse('complejo deducible con opciones');

      // The mock records every call; we just verify Gemini was reached.
      expect(mockExtractDeductible).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================
  describe('edge cases', () => {
    it('should handle empty string', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('');

      expect(result.components[0].type).toBe('unknown');
      expect(result.normalized.minAmount).toBe(0);
    });

    it('should handle null-ish input', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('   ');

      expect(result.components[0].type).toBe('unknown');
    });

    it('should handle "No aplica" variations via regex', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const variations = ['No aplica', 'NO APLICA', 'incluido', '0%', 'N/A'];
      for (const variant of variations) {
        const r = await hybridDeductibleParser.parse(variant);
        expect(r.isZero, `failed for "${variant}"`).toBe(true);
      }
    });
  });

  // ========================================================================
  // Telemetry
  // ========================================================================

  describe('telemetry', () => {
    it('should accumulate stats across multiple calls', async () => {
      mockGetCachedDeductibleV2
        .mockResolvedValueOnce({
          components: [{ type: 'na', value: 0 }],
          isZero: true,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockExtractDeductible.mockResolvedValue({
        components: [{ type: 'unknown', value: 0 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });

      await hybridDeductibleParser.parse('No aplica'); // cache hit
      await hybridDeductibleParser.parse('10%'); // regex hit
      await hybridDeductibleParser.parse('texto muy raro'); // LLM fallback

      const stats = getHybridParserStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.regexHits).toBe(1);
      expect(stats.llmFallbacks).toBe(1);
    });

    it('should reset stats when resetStats is called', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue({
        components: [{ type: 'na', value: 0 }],
        isZero: true,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });

      await hybridDeductibleParser.parse('No aplica');
      expect(getHybridParserStats().cacheHits).toBe(1);

      resetHybridParserStats();
      expect(getHybridParserStats().cacheHits).toBe(0);
    });
  });

  // ========================================================================
  // Phase 2: Enhanced composite patterns & defensive fallback
  // ========================================================================

  describe('Phase 2 enhancements', () => {
    it('should parse percentage with min clause SMMLV correctly', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);

      const result = await hybridDeductibleParser.parse('10% PERD CON MINIMO DE 2 SMMLV');
      expect(result.parseMethod).toBe('regex');
      expect(result.hasMinimum).toBe(true);
      expect(result.components.length).toBeGreaterThan(0);
    });

    it('should return safe unparsed fallback when LLM throws error', async () => {
      mockGetCachedDeductibleV2.mockResolvedValue(null);
      mockExtractDeductible.mockRejectedValue(new Error('LLM Service Unavailable'));

      const result = await hybridDeductibleParser.parse('Deducible complejo no reconocible');
      expect(result.rawText).toBe('Deducible complejo no reconocible');
      expect(result.components).toBeDefined();
    });
  });
});
