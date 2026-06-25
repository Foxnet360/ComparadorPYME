import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reconciliationService,
} from '../reconciliationService';
import { HybridDeductibleResult } from '../hybridDeductibleParser';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockParse = vi.fn();
const mockSearchClause = vi.fn();
const mockNormalize = vi.fn();
const mockGetKnownInsurers = vi.fn();

vi.mock('../hybridDeductibleParser', () => ({
  hybridDeductibleParser: {
    parse: (text: string, coverageName?: string) => mockParse(text, coverageName),
  },
}));

vi.mock('../structuredClauseExtractor', () => ({
  structuredClauseExtractor: {
    searchClause: (insurer: string, coverage?: string) => mockSearchClause(insurer, coverage),
  },
}));

vi.mock('../insurerNameNormalizer', () => ({
  insurerNameNormalizer: {
    normalize: (name: string) => mockNormalize(name),
    getKnownInsurers: () => mockGetKnownInsurers(),
    verifyMatch: (extracted: string, db: string) => mockNormalize(extracted).toUpperCase() === db.toUpperCase(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuoteDeductible(structure: Partial<HybridDeductibleResult>): HybridDeductibleResult {
  return {
    components: structure.components || [{ type: 'unknown', value: 0 }],
    isZero: structure.isZero ?? false,
    hasMinimum: structure.hasMinimum ?? false,
    hasMaximum: structure.hasMaximum ?? false,
    isComposite: structure.isComposite ?? false,
    rawText: structure.rawText || '',
    normalized: structure.normalized || { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
  };
}

function makeParsedQuote(
  insurerName: string,
  coverages: Array<{ name: string; deductible: string }>
): import('../quoteParser').ParsedQuote {
  return {
    insurerName,
    policyName: 'Test Policy',
    priceAnnual: 1000000,
    currency: 'COP',
    coverages: coverages.map(c => ({
      name: c.name,
      canonicalName: c.name,
      value: '100M',
      deductible: c.deductible,
      confidence: 90,
    })),
    specialConditions: [],
    rawText: '',
    parseConfidence: 95,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reconciliationService', () => {
  beforeEach(() => {
    mockParse.mockReset();
    mockSearchClause.mockReset();
    mockNormalize.mockReset();
    mockGetKnownInsurers.mockReset();
    delete process.env.RECONCILIATION_THRESHOLDS;

    // Default normalization behavior: pass-through for unknown names, normalize for known ones
    mockNormalize.mockImplementation((name: string) => name);
    mockGetKnownInsurers.mockReturnValue(['SBS', 'AXA Colpatria', 'BBVA', 'CHUBB', 'HDI', 'MAPFRE']);
  });

  // ========================================================================
  // MATCH scenarios
  // ========================================================================
  describe('MATCH status', () => {
    it('should return MATCH when quote and clause deductibles are identical', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('MATCH');
      expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('should return MATCH when deductibles are within threshold', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 11 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '11%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 11, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '11%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MATCH');
      expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('should return MATCH for zero/NA deductibles on both sides', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Responsabilidad Civil (RCE)',
            description: '...',
            deductible: {
              components: [{ type: 'na', value: 0 }],
              rawText: 'No aplica',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'na', value: 0 }],
          isZero: true,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: 'No aplica',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Responsabilidad Civil (RCE)', deductible: 'No aplica' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MATCH');
      expect(results[0].confidence).toBeGreaterThan(0.95);
    });
  });

  // ========================================================================
  // MISMATCH scenarios
  // ========================================================================
  describe('MISMATCH status', () => {
    it('should return MISMATCH when deductibles differ beyond threshold', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 20 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '20%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 20, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '20%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MISMATCH');
      expect(results[0].confidence).toBeGreaterThan(0.75);
      expect(results[0].discrepancyDetails?.length).toBeGreaterThan(0);
    });

    it('should return MISMATCH when one is zero and other is not', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'na', value: 0 }],
          isZero: true,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: 'No aplica',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: 'No aplica' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MISMATCH');
    });

    it('should return MISMATCH for mixed types (percentage vs fixed)', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'fixed', value: 5000000, currency: 'COP' }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '$5.000.000 COP',
          normalized: { minAmount: 5000000, maxAmount: 5000000, percentage: 0, isPercentageBased: false },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '$5.000.000 COP' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MISMATCH');
    });
  });

  // ========================================================================
  // MISSING_CLAUSE scenarios
  // ========================================================================
  describe('MISSING_CLAUSE status', () => {
    it('should return MISSING_CLAUSE when no clause found for insurer', async () => {
      mockSearchClause.mockResolvedValue(null);

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Unknown Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MISSING_CLAUSE');
      expect(results[0].confidence).toBeLessThan(0.5);
    });

    it('should return MISSING_CLAUSE when coverage not found in clause', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Responsabilidad Civil (RCE)',
            description: '...',
            deductible: {
              components: [{ type: 'na', value: 0 }],
              rawText: 'No aplica',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MISSING_CLAUSE');
    });
  });

  // ========================================================================
  // PENDING scenarios
  // ========================================================================
  describe('PENDING status', () => {
    it('should return PENDING when clause has no deductible for coverage', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('PENDING');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should return PENDING when quote has no deductible', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'unknown', value: 0 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('PENDING');
    });
  });

  // ========================================================================
  // Per-insurer threshold configuration
  // ========================================================================
  describe('per-insurer thresholds', () => {
    it('should use default threshold when no env config is set', async () => {
      const { getThreshold } = reconciliationService.__testHelpers;
      expect(getThreshold('Any Insurer', 'Any Coverage')).toBe(0.05);
    });

    it('should load and use per-insurer thresholds from env', async () => {
      const originalEnv = process.env.RECONCILIATION_THRESHOLDS;
      process.env.RECONCILIATION_THRESHOLDS = JSON.stringify({
        default: { default: 0.10 },
        insurers: {
          'Strict Insurer': { default: 0.01, coverageOverrides: {} },
          'Test Insurer': {
            default: 0.05,
            coverageOverrides: {
              'Incendio (Edificio y Contenidos)': 0.02,
            },
          },
        },
      });

      // Force module re-evaluation by resetting modules and re-importing
      vi.resetModules();
      const { reconciliationService: freshService } = await import('../reconciliationService');
      const { getThreshold } = freshService.__testHelpers;

      expect(getThreshold('Strict Insurer', 'Any Coverage')).toBe(0.01);
      expect(getThreshold('Test Insurer', 'Incendio (Edificio y Contenidos)')).toBe(0.02);
      expect(getThreshold('Test Insurer', 'Other Coverage')).toBe(0.05);
      expect(getThreshold('Unknown Insurer', 'Any Coverage')).toBe(0.10);

      // Restore
      process.env.RECONCILIATION_THRESHOLDS = originalEnv;
      vi.resetModules();
    });
  });

  // ========================================================================
  // Internal comparison logic
  // ========================================================================
  describe('compareDeductibles helper', () => {
    it('should detect MATCH for identical fixed amounts', () => {
      const { compareDeductibles } = reconciliationService.__testHelpers;
      const quote = { percentage: 0, minAmount: 5_000_000, maxAmount: 5_000_000, isPercentageBased: false, isZero: false, isUnknown: false };
      const clause = { percentage: 0, minAmount: 5_000_000, maxAmount: 5_000_000, isPercentageBased: false, isZero: false, isUnknown: false };

      const result = compareDeductibles(quote, clause, 0.05);

      expect(result.status).toBe('MATCH');
    });

    it('should detect MISMATCH for different fixed amounts beyond threshold', () => {
      const { compareDeductibles } = reconciliationService.__testHelpers;
      const quote = { percentage: 0, minAmount: 5_000_000, maxAmount: 5_000_000, isPercentageBased: false, isZero: false, isUnknown: false };
      const clause = { percentage: 0, minAmount: 10_000_000, maxAmount: 10_000_000, isPercentageBased: false, isZero: false, isUnknown: false };

      const result = compareDeductibles(quote, clause, 0.05);

      expect(result.status).toBe('MISMATCH');
    });

    it('should detect PENDING for unknown components', () => {
      const { compareDeductibles } = reconciliationService.__testHelpers;
      const quote = { percentage: 0, minAmount: 0, maxAmount: 0, isPercentageBased: false, isZero: false, isUnknown: true };
      const clause = { percentage: 10, minAmount: 0, maxAmount: 0, isPercentageBased: true, isZero: false, isUnknown: false };

      const result = compareDeductibles(quote, clause, 0.05);

      expect(result.status).toBe('PENDING');
    });
  });

  // ========================================================================
  // Graceful degradation
  // ========================================================================
  describe('graceful degradation', () => {
    it('should return empty array when insurer name is missing', async () => {
      const quote = makeParsedQuote('NO ESPECIFICADO', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results).toHaveLength(0);
    });

    it('should handle parser failures gracefully', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockRejectedValue(new Error('Parser error'));

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('PENDING');
      expect(results[0].quoteDeductible.components[0].type).toBe('unknown');
    });

    it('should handle clause search failures gracefully', async () => {
      mockSearchClause.mockRejectedValue(new Error('Database error'));

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MISSING_CLAUSE');
    });
  });

  // ========================================================================
  // Composite deductible comparison
  // ========================================================================
  describe('composite deductibles', () => {
    it('should match composite deductibles with same components', async () => {
      mockSearchClause.mockResolvedValue({
        insurer: 'Test Insurer',
        product: 'Test Product',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Terremoto y Eventos Catastróficos',
            description: '...',
            deductible: {
              components: [
                { type: 'percentage', value: 10 },
                { type: 'minimum', value: 5, currency: 'SMMLV' },
              ],
              rawText: '10% con mínimo de 5 SMMLV',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [
            { type: 'percentage', value: 10 },
            { type: 'minimum', value: 5, currency: 'SMMLV' },
          ],
          isZero: false,
          hasMinimum: true,
          hasMaximum: false,
          isComposite: true,
          rawText: '10% con mínimo de 5 SMMLV',
          normalized: { minAmount: 5 * 1_423_500, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('Test Insurer', [
        { name: 'Terremoto y Eventos Catastróficos', deductible: '10% con mínimo de 5 SMMLV' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(results[0].status).toBe('MATCH');
    });
  });

  // ========================================================================
  // Insurer name normalization
  // ========================================================================
  describe('insurer name normalization', () => {
    it('should normalize insurer name before searching clause', async () => {
      mockNormalize.mockReturnValue('SBS');
      mockSearchClause.mockResolvedValue({
        insurer: 'SBS',
        product: 'PYME',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('SBS SEGUROS COLOMBIA S.A.', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(mockNormalize).toHaveBeenCalledWith('SBS SEGUROS COLOMBIA S.A.');
      expect(mockSearchClause).toHaveBeenCalledWith('SBS', undefined);
      expect(results[0].status).toBe('MATCH');
    });

    it('should fallback to raw name when normalizer returns null/empty', async () => {
      mockNormalize.mockReturnValue('');
      mockSearchClause.mockResolvedValue(null);

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('UNKNOWN INSURER LTD', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      const results = await reconciliationService.reconcileQuote(quote);

      expect(mockNormalize).toHaveBeenCalledWith('UNKNOWN INSURER LTD');
      expect(mockSearchClause).toHaveBeenCalledWith('UNKNOWN INSURER LTD', undefined);
      expect(results[0].status).toBe('MISSING_CLAUSE');
    });

    it('should log warning for unmapped insurer names', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockNormalize.mockImplementation((name: string) => name);
      mockSearchClause.mockResolvedValue(null);

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('NOVEL INSURER INC', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      await reconciliationService.reconcileQuote(quote);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unmapped insurer name encountered: "NOVEL INSURER INC"')
      );

      consoleSpy.mockRestore();
    });

    it('should NOT log warning for known canonical insurer names', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockNormalize.mockImplementation((name: string) => name);
      mockSearchClause.mockResolvedValue({
        insurer: 'SBS',
        product: 'PYME',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            description: '...',
            deductible: {
              components: [{ type: 'percentage', value: 10 }],
              rawText: '10%',
            },
            exclusions: [],
            conditions: [],
            sourcePage: 1,
          },
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {},
      });

      mockParse.mockResolvedValue(
        makeQuoteDeductible({
          components: [{ type: 'percentage', value: 10 }],
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: '10%',
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        })
      );

      const quote = makeParsedQuote('SBS', [
        { name: 'Incendio (Edificio y Contenidos)', deductible: '10%' },
      ]);

      await reconciliationService.reconcileQuote(quote);

      const unmappedWarnings = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('Unmapped insurer name')
      );
      expect(unmappedWarnings).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });
});
