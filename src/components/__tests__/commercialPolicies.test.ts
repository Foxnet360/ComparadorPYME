import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COMMERCIAL_POLICIES,
  getEffectiveCommercialPolicies,
  getStructuredCommercialPolicyEntries,
  CommercialPolicies,
} from '../../data/commercialPolicies';
import { generateExcelBuffer } from '../../../server/src/services/excelGenerator';
import type { QuoteAnalysis } from '../../../types';

describe('Commercial Policies Module', () => {
  describe('DEFAULT_COMMERCIAL_POLICIES', () => {
    it('provides standard Colombian insurance broker defaults', () => {
      expect(DEFAULT_COMMERCIAL_POLICIES.offerValidityDays).toBe(15);
      expect(DEFAULT_COMMERCIAL_POLICIES.paymentConditions).toContain('Pago de contado');
      expect(DEFAULT_COMMERCIAL_POLICIES.inspectionRequirements).toContain('500 SMMLV');
      expect(DEFAULT_COMMERCIAL_POLICIES.issuanceRequirements).toContain('SARLAFT');
      expect(DEFAULT_COMMERCIAL_POLICIES.claimsPolicy).toContain('artículo 1075 del Código de Comercio');
      expect(DEFAULT_COMMERCIAL_POLICIES.intermediationScope).toContain('Asesoría técnica integral');
    });
  });

  describe('getEffectiveCommercialPolicies', () => {
    it('returns standard defaults when input is undefined or null', () => {
      const resNull = getEffectiveCommercialPolicies(null);
      const resUndefined = getEffectiveCommercialPolicies(undefined);

      expect(resNull).toEqual(DEFAULT_COMMERCIAL_POLICIES);
      expect(resUndefined).toEqual(DEFAULT_COMMERCIAL_POLICIES);
    });

    it('merges partial customizations while preserving defaults for missing keys', () => {
      const custom: Partial<CommercialPolicies> = {
        offerValidityDays: 30,
        customNotes: 'Descuento del 5% adicional por póliza multirriesgo.',
      };

      const result = getEffectiveCommercialPolicies(custom);

      expect(result.offerValidityDays).toBe(30);
      expect(result.customNotes).toBe('Descuento del 5% adicional por póliza multirriesgo.');
      // Untouched fields must equal defaults
      expect(result.paymentConditions).toBe(DEFAULT_COMMERCIAL_POLICIES.paymentConditions);
      expect(result.inspectionRequirements).toBe(DEFAULT_COMMERCIAL_POLICIES.inspectionRequirements);
      expect(result.issuanceRequirements).toBe(DEFAULT_COMMERCIAL_POLICIES.issuanceRequirements);
      expect(result.claimsPolicy).toBe(DEFAULT_COMMERCIAL_POLICIES.claimsPolicy);
    });

    it('falls back to default if string field is empty or whitespace', () => {
      const custom: Partial<CommercialPolicies> = {
        paymentConditions: '   ',
        claimsPolicy: '',
      };

      const result = getEffectiveCommercialPolicies(custom);

      expect(result.paymentConditions).toBe(DEFAULT_COMMERCIAL_POLICIES.paymentConditions);
      expect(result.claimsPolicy).toBe(DEFAULT_COMMERCIAL_POLICIES.claimsPolicy);
    });

    it('falls back to default validity days if number is 0 or negative', () => {
      const custom: Partial<CommercialPolicies> = {
        offerValidityDays: -5,
      };

      const result = getEffectiveCommercialPolicies(custom);
      expect(result.offerValidityDays).toBe(DEFAULT_COMMERCIAL_POLICIES.offerValidityDays);
    });
  });

  describe('getStructuredCommercialPolicyEntries', () => {
    it('formats policies into structured items for PDF and Excel rendering', () => {
      const policies: CommercialPolicies = {
        ...DEFAULT_COMMERCIAL_POLICIES,
        offerValidityDays: 20,
      };

      const entries = getStructuredCommercialPolicyEntries(policies);

      expect(entries.length).toBeGreaterThanOrEqual(6);
      expect(entries.some((e) => e.category === 'Vigencia de la Oferta' && e.detail.includes('20 días'))).toBe(true);
      expect(entries.some((e) => e.category === 'Atención de Siniestros')).toBe(true);
      expect(entries.some((e) => e.category === 'Financiación y Pagos')).toBe(true);
    });

    it('includes Notas Especiales only when customNotes is provided', () => {
      const withoutNotes = getStructuredCommercialPolicyEntries({
        ...DEFAULT_COMMERCIAL_POLICIES,
        customNotes: undefined,
      });
      expect(withoutNotes.some((e) => e.category === 'Notas Especiales')).toBe(false);

      const withNotes = getStructuredCommercialPolicyEntries({
        ...DEFAULT_COMMERCIAL_POLICIES,
        customNotes: 'Cláusula de inspección previa en sitio.',
      });
      expect(withNotes.some((e) => e.category === 'Notas Especiales' && e.detail.includes('inspección previa en sitio'))).toBe(true);
    });
  });

  describe('excelGenerator integration with Commercial Policies', () => {
    it('generates an Excel buffer with the Políticas Comerciales worksheet and Portada details', async () => {
      const mockQuote: QuoteAnalysis = {
        insurerName: 'Seguros Bolívar',
        policyName: 'Póliza Empresarial PYME',
        priceMonthly: 1200000,
        priceAnnual: 14400000,
        currency: 'COP',
        deductibles: '10% mínimo 2 SMMLV',
        coverages: [{ name: 'Incendio y Terremoto', value: '$1.000.000.000' }],
        alerts: [],
        scoringBreakdown: {
          coverage: 90,
          deductibles: 85,
          exclusions: 90,
          priceRatio: 80,
          sublimits: 85,
          warranties: 90,
        },
        clientAnalysis: 'Excelente amparo patrimonial.',
        technicalAnalysis: 'Cumple requisitos normativos.',
        score: 88,
      };

      const customPolicies: CommercialPolicies = {
        ...DEFAULT_COMMERCIAL_POLICIES,
        offerValidityDays: 25,
        paymentConditions: 'Hasta 12 cuotas mensuales sin interés de financiación.',
      };

      const buffer = await generateExcelBuffer(
        [mockQuote],
        { name: 'Empresa Demo SAS' },
        undefined,
        {
          name: 'Carlos Corredor',
          intermediaryName: 'Andina de Seguros S.A.',
          commercialPolicies: customPolicies,
        },
        'pyme',
        undefined,
        'client'
      );

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);
    });
  });
});
