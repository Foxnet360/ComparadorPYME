import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalStructureSchema, FocalizedCoverageSchema } from '../../../types/twoStageExtraction';

describe('TwoStageExtraction Schemas and Validators', () => {
  it('validates a valid GlobalStructureExtraction object', () => {
    const validGlobal = {
      insurerName: 'SEGUROS BOLIVAR',
      policyName: 'Pyme Protegida',
      validityPeriod: '2025-01-01 a 2026-01-01',
      formatFamily: 'TABLE-DOUBLE',
      premium: {
        netPremium: 5000000,
        fees: 25000,
        taxes: 950000,
        otherCharges: 0,
        totalPayable: 5975000,
        currency: 'COP',
        periodicity: 'Anual',
      },
      insuredAssets: [
        { assetType: 'CONTENIDOS', value: 200000000, notes: 'Mercancías en bodega' },
      ],
      coverageSections: [
        { sectionName: 'AMPAROS BÁSICOS', pageNumber: 1, description: 'Incendio y terremoto' },
        { sectionName: 'RESPONSABILIDAD CIVIL', pageNumber: 3 },
      ],
      specialConditions: ['Inspección requerida'],
    };

    const parsed = GlobalStructureSchema.safeParse(validGlobal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.insurerName).toBe('SEGUROS BOLIVAR');
      expect(parsed.data.premium.totalPayable).toBe(5975000);
      expect(parsed.data.coverageSections).toHaveLength(2);
    }
  });

  it('rejects an invalid GlobalStructureExtraction missing required premium', () => {
    const invalidGlobal = {
      insurerName: 'SEGUROS BOLIVAR',
      policyName: 'Pyme Protegida',
      // missing premium
    };

    const parsed = GlobalStructureSchema.safeParse(invalidGlobal);
    expect(parsed.success).toBe(false);
  });

  it('validates a valid FocalizedCoverageExtraction object with positional anchors', () => {
    const validCoverages = {
      rawCoverages: [
        {
          rawName: 'Terremoto, Temblor y Erupción Volcánica',
          section: 'AMPAROS BÁSICOS',
          insuredAmount: 1000000000,
          deductible: '2% del valor asegurable mínimo 5 SMMLV',
          rawTextSnippet: 'Amparo de Terremoto, Temblor o Erupción Volcánica hasta por $1.000.000.000 COP con deducible del 2% del valor asegurable.',
          pageNumber: 2,
          notes: 'Deducible especial para zona de alto riesgo',
        },
      ],
      subLimits: [
        {
          parentCoverage: 'Terremoto, Temblor y Erupción Volcánica',
          name: 'Remoción de escombros',
          limit: 100000000,
          deductible: null,
        },
      ],
      generalDeductibles: [
        {
          appliesTo: 'TODO EL CLAUSULADO',
          deductibleText: '10% de la pérdida mínimo 2 SMMLV',
        },
      ],
    };

    const parsed = FocalizedCoverageSchema.safeParse(validCoverages);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rawCoverages).toHaveLength(1);
      expect(parsed.data.rawCoverages[0].rawTextSnippet.length).toBeGreaterThan(10);
      expect(parsed.data.rawCoverages[0].pageNumber).toBe(2);
      expect(parsed.data.subLimits).toHaveLength(1);
    }
  });

  it('rejects FocalizedCoverageExtraction with empty rawCoverages array or missing positional anchors', () => {
    const emptyCoverages = {
      rawCoverages: [],
    };
    expect(FocalizedCoverageSchema.safeParse(emptyCoverages).success).toBe(false);

    const missingSnippet = {
      rawCoverages: [
        {
          rawName: 'Incendio',
          pageNumber: 1,
          // missing rawTextSnippet
        },
      ],
    };
    expect(FocalizedCoverageSchema.safeParse(missingSnippet).success).toBe(false);
  });
});
