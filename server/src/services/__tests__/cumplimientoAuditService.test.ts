import { describe, it, expect } from 'vitest';
import {
  buildDefaultComplianceChecklist,
  evaluateDecreto1082Rules,
  validateQuotesAgainstPrepolicy,
} from '../cumplimientoAuditService';
import type { CumplimientoPrepolicyData } from '../../types/cumplimientoCase';

function makeBasePrepolicy(
  overrides: Partial<CumplimientoPrepolicyData> = {}
): CumplimientoPrepolicyData {
  return {
    caseType: 'CONTRATO',
    legalRegime: 'ESTATAL_LEY_80',
    contractType: 'OBRA',
    contractNumber: 'CT-2026-045',
    secopProcessNumber: 'LP-001-2026',
    objectDescription: 'Construcción de cubierta escolar',
    contractValue: 200_000_000,
    includesIva: true,
    advancePaymentPercent: 20,
    advancePaymentAmount: 40_000_000,
    contractDuration: '6 meses',
    contractor: {
      name: 'CONSTRUCTORA ANDINA SAS',
      nit: '900123456-1',
      personType: 'JURIDICA',
      consortiumMembers: [],
    },
    beneficiary: {
      name: 'ALCALDIA MUNICIPAL DE PRUEBA',
      nit: '890980123-4',
    },
    requiredCoverages: [
      {
        id: 'cov-1',
        name: 'Cumplimiento del Contrato',
        percentageOfContract: '10%',
        percentageNumeric: 10,
        minimumAmount: 20_000_000,
        validityRule: 'Plazo de ejecución + 4 meses de liquidación',
        isMandatory: true,
      },
      {
        id: 'cov-2',
        name: 'Buen Manejo y Correcta Inversión del Anticipo',
        percentageOfContract: '100%',
        percentageNumeric: 100,
        minimumAmount: 40_000_000,
        validityRule: 'Plazo + liquidación',
        isMandatory: true,
      },
      {
        id: 'cov-3',
        name: 'Pago de Salarios y Prestaciones Sociales',
        percentageOfContract: '5%',
        percentageNumeric: 5,
        minimumAmount: 10_000_000,
        validityRule: 'Plazo del contrato + 3 años',
        isMandatory: true,
      },
    ],
    rceRequirement: {
      required: true,
      amountSmmlv: 200,
      subcoverages: ['PLO', 'Contratistas y Subcontratistas'],
      maxDeductibleRule: 'Máximo 10%',
    },
    decreto1082Alerts: [],
    ...overrides,
  };
}

describe('cumplimientoAuditService', () => {
  describe('evaluateDecreto1082Rules', () => {
    it('flags missing Estabilidad de Obra in OBRA contracts and Anticipo < 100%', () => {
      const prepolicy = makeBasePrepolicy({
        requiredCoverages: [
          {
            id: 'cov-1',
            name: 'Cumplimiento',
            percentageOfContract: '10%',
            percentageNumeric: 10,
            minimumAmount: 20_000_000,
            validityRule: '6 meses',
            isMandatory: true,
          },
          {
            id: 'cov-2',
            name: 'Anticipo',
            percentageOfContract: '50%',
            percentageNumeric: 50,
            minimumAmount: 20_000_000,
            validityRule: '6 meses',
            isMandatory: true,
          },
        ],
      });

      const alerts = evaluateDecreto1082Rules(prepolicy);
      expect(
        alerts.some((a) => a.ruleCode === 'DEC_1082_ANTICIPO_100' && a.severity === 'CRITICAL')
      ).toBe(true);
      expect(alerts.some((a) => a.ruleCode === 'DEC_1082_ESTABILIDAD_OBRA')).toBe(true);
    });

    it('returns no Decreto 1082 alerts for PARTICULAR regime', () => {
      const alerts = evaluateDecreto1082Rules(makeBasePrepolicy({ legalRegime: 'PARTICULAR' }));
      expect(alerts).toEqual([]);
    });
  });

  describe('buildDefaultComplianceChecklist', () => {
    it('includes Cámara de Comercio ≤ 30 days, RUP, SARLAFT, and Pagaré post-emisión for JURIDICA', () => {
      const items = buildDefaultComplianceChecklist(makeBasePrepolicy(), true);
      expect(items.some((i) => i.code === 'CAMARA_COMERCIO_30D' && i.maxAgeDays === 30)).toBe(true);
      expect(items.some((i) => i.code === 'LISTAS_RESTRICTIVAS')).toBe(true);
      expect(
        items.some((i) => i.code === 'PAGARE_CONTRAGARANTIA' && i.category === 'POST_EMISION')
      ).toBe(true);
      expect(items.some((i) => i.code === 'EXPERIENCIA_RUP' && i.required)).toBe(true);
    });

    it('adds consortium constitution and member docs when personType is CONSORCIO', () => {
      const prepolicy = makeBasePrepolicy({
        contractor: {
          name: 'CONSORCIO VIAL 2026',
          nit: '901555666-1',
          personType: 'CONSORCIO',
          consortiumMembers: [],
        },
      });
      const items = buildDefaultComplianceChecklist(prepolicy, true);
      expect(items.some((i) => i.code === 'ACTA_CONSORCIO_UT')).toBe(true);
      expect(items.some((i) => i.code === 'RUT_CONSORCIO_UT')).toBe(true);
    });
  });

  describe('validateQuotesAgainstPrepolicy', () => {
    it('detects blocking NIT mismatch and coverage percentage gap and builds correctionMessage', () => {
      const prepolicy = makeBasePrepolicy();
      const result = validateQuotesAgainstPrepolicy(
        prepolicy,
        [
          {
            fileName: 'cotizacion_bolivar.pdf',
            insurerName: 'Seguros Bolívar',
            contractorName: 'CONSTRUCTORA ANDINA SAS',
            contractorNit: '900123456-1',
            beneficiaryName: 'ALCALDIA MUNICIPAL DE PRUEBA',
            beneficiaryNit: '890980999-9', // mismatch
            contractNumber: 'CT-2026-045',
            contractValue: 200_000_000,
            premiumAnnual: 1_850_000,
            ratePercent: 0.92,
            coverages: [
              {
                name: 'Cumplimiento del Contrato',
                percentageOfContract: '10%',
                insuredAmount: 20_000_000,
                validityRule: 'Plazo + 4 meses',
              },
              {
                name: 'Buen Manejo del Anticipo',
                percentageOfContract: '50%', // gap vs 100%
                insuredAmount: 20_000_000,
                validityRule: 'Plazo',
              },
              {
                name: 'Salarios y Prestaciones Sociales',
                percentageOfContract: '5%',
                insuredAmount: 10_000_000,
                validityRule: 'Plazo + 3 años',
              },
            ],
          },
        ],
        'BORRADOR_POLIZA'
      );

      expect(result.overallStatus).toBe('REJECTED_RISK');
      expect(result.economicComparison).toHaveLength(1);
      expect(result.economicComparison[0]!.blockingGapsCount).toBe(2);
      expect(result.correctionMessage).toContain('Asegurado / Beneficiario (NIT)');
      expect(result.correctionMessage).toContain('Anticipo');
    });

    it('returns COMPLIANT and supports economic comparison across 2 quotes', () => {
      const prepolicy = makeBasePrepolicy({
        rceRequirement: { required: false, subcoverages: [] },
      });
      const matchingCoverages = [
        {
          name: 'Cumplimiento del Contrato',
          percentageOfContract: '10%',
          insuredAmount: 20_000_000,
        },
        {
          name: 'Buen Manejo y Correcta Inversión del Anticipo',
          percentageOfContract: '100%',
          insuredAmount: 40_000_000,
        },
        {
          name: 'Pago de Salarios y Prestaciones Sociales',
          percentageOfContract: '5%',
          insuredAmount: 10_000_000,
        },
      ];
      const result = validateQuotesAgainstPrepolicy(
        prepolicy,
        [
          {
            fileName: 'bolivar.pdf',
            insurerName: 'Bolívar',
            contractorName: 'CONSTRUCTORA ANDINA SAS',
            contractorNit: '900123456-1',
            beneficiaryName: 'ALCALDIA MUNICIPAL DE PRUEBA',
            beneficiaryNit: '890980123-4',
            contractNumber: 'CT-2026-045',
            contractValue: 200_000_000,
            premiumAnnual: 1_900_000,
            coverages: matchingCoverages,
          },
          {
            fileName: 'estado.pdf',
            insurerName: 'Seguros del Estado',
            contractorName: 'CONSTRUCTORA ANDINA SAS',
            contractorNit: '900123456-1',
            beneficiaryName: 'ALCALDIA MUNICIPAL DE PRUEBA',
            beneficiaryNit: '890980123-4',
            contractNumber: 'CT-2026-045',
            contractValue: 200_000_000,
            premiumAnnual: 1_550_000,
            coverages: matchingCoverages,
          },
        ],
        'COTIZACION'
      );

      expect(result.overallStatus).toBe('COMPLIANT');
      expect(result.economicComparison).toHaveLength(2);
    });
  });
});
