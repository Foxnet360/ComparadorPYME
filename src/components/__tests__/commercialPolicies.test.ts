import { describe, it, expect } from 'vitest';
import * as ExcelJS from 'exceljs';
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
          phone: '+57 300 123 4567',
          email: 'contacto@andina.com',
          registrationNumber: 'SFC-98765',
          address: 'Calle 100 # 15-20',
          city: 'Bogotá',
          logoUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          commercialPolicies: customPolicies,
        },
        'pyme',
        undefined,
        'client'
      );

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      // Verify Header & Footer enriched with Ally commercial info
      const portada = wb.getWorksheet('Portada y Resumen General');
      expect(portada).toBeDefined();
      expect(portada?.headerFooter.oddHeader).toContain('Andina de Seguros S.A.');
      expect(portada?.headerFooter.oddFooter).toContain('+57 300 123 4567');

      // Verify embedded logo image in workbook
      expect(wb.model.media.length).toBeGreaterThanOrEqual(1);

      // Verify Insurer corporate brand color fill on coverages sheet
      const covSheet = wb.getWorksheet('Matriz Coberturas');
      expect(covSheet).toBeDefined();
      const insCell = covSheet?.getCell(4, 2);
      expect(insCell?.value).toBe('SEGUROS BOLÍVAR');
      expect((insCell?.fill as any)?.fgColor?.argb).toBe('FF00843D'); // Bolívar official green brand color

      // Verify Políticas Comerciales sheet and commercial card
      const polSheet = wb.getWorksheet('Políticas Comerciales');
      expect(polSheet).toBeDefined();
      let foundBrokerCard = false;
      polSheet?.eachRow((row) => {
        const val = String(row.getCell(1).value || '');
        if (val.includes('INTERMEDIARIO: Andina de Seguros S.A.')) {
          foundBrokerCard = true;
          expect(val).toContain('SFC-98765');
          expect(val).toContain('contacto@andina.com');
        }
      });
      expect(foundBrokerCard).toBe(true);
    });
  });
});
