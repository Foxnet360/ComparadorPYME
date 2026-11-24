import { describe, it, expect } from 'vitest';
import {
  buildGoverningReferenceQuote,
  auditQuotesAgainstGoverningSpec,
  type GoverningDocumentSpec,
} from '../governingDocumentExtractor';

const sampleSpec: GoverningDocumentSpec = {
  documentName: 'Minuta_Contrato_INVIAS_042.pdf',
  stage: 'CONTRATO',
  legalRegime: 'ESTATAL_LEY_80',
  processOrContractNumber: 'CTO-042-2026',
  entityName: 'INVIAS',
  contractorName: 'Consorcio Vial Andino',
  contractOrBudgetValue: 1_000_000_000,
  contractDuration: '12 meses + 6 meses liquidación',
  requiredCoverages: [
    {
      name: 'Cumplimiento de Contrato',
      canonicalName: 'Cumplimiento de Contrato',
      percentageOfContract: '20%',
      minimumAmount: 200_000_000,
      validityRule: 'Plazo + 6 meses',
      isMandatory: true,
    },
    {
      name: 'Salarios, Prestaciones e Indemnizaciones Laborales',
      canonicalName: 'Salarios, Prestaciones e Indemnizaciones Laborales',
      percentageOfContract: '5%',
      minimumAmount: 50_000_000,
      validityRule: 'Plazo + 3 años',
      isMandatory: true,
    },
    {
      name: 'Estabilidad y Calidad de Obra',
      canonicalName: 'Estabilidad y Calidad de Obra',
      percentageOfContract: '10%',
      minimumAmount: 100_000_000,
      validityRule: '5 años desde acta de recibo',
      isMandatory: true,
    },
  ],
};

describe('governingDocumentExtractor', () => {
  it('builds a synthetic reference quote preserving required % and vigencias per amparo', () => {
    const refQuote = buildGoverningReferenceQuote(sampleSpec);
    expect(refQuote.insurerName).toBe('Contrato / Pliego Rector');
    expect(refQuote.priceAnnual).toBe(1_000_000_000);
    expect(refQuote.coverages).toHaveLength(3);
    expect(refQuote.coverages[0]?.percentageOfContract).toBe('20%');
    expect(refQuote.coverages[1]?.coverageValidity).toBe('Plazo + 3 años');
    expect(refQuote.cumplimientoDetails?.contractStage).toBe('CONTRATO');
  });

  it('audits candidate quotes against GoverningDocumentSpec detecting COMPLIANT, PARTIAL_GAP, and MISSING coverages', () => {
    const quotes = [
      {
        insurerName: 'Seguros del Estado',
        coverages: [
          {
            name: 'Cumplimiento de Contrato',
            value: '200000000',
            percentageOfContract: '20%',
            coverageValidity: 'Plazo + 6 meses',
          },
          {
            name: 'Salarios, Prestaciones e Indemnizaciones Laborales',
            value: '50000000',
            percentageOfContract: '5%',
            coverageValidity: 'Plazo + 3 años',
          },
          {
            name: 'Estabilidad y Calidad de Obra',
            value: '100000000',
            percentageOfContract: '10%',
            coverageValidity: '5 años',
          },
        ],
      },
      {
        insurerName: 'La Previsora',
        coverages: [
          {
            name: 'Cumplimiento de Contrato',
            value: '100000000',
            percentageOfContract: '10%',
            coverageValidity: 'Plazo + 6 meses',
          },
          {
            name: 'Salarios, Prestaciones e Indemnizaciones Laborales',
            value: '50000000',
            percentageOfContract: '5%',
            coverageValidity: 'Plazo + 1 año',
          },
        ],
      },
    ];

    const audit = auditQuotesAgainstGoverningSpec(quotes, sampleSpec);
    expect(audit.stage).toBe('CONTRATO');
    expect(audit.requiredCoverages).toHaveLength(3);

    const estadoStatus = audit.perInsurerStatus['Seguros del Estado']!;
    expect(estadoStatus.compliantCount).toBe(3);
    expect(estadoStatus.totalRequired).toBe(3);
    expect(estadoStatus.gaps.every((g) => g.status === 'COMPLIANT')).toBe(true);

    const previsoraStatus = audit.perInsurerStatus['La Previsora']!;
    expect(previsoraStatus.compliantCount).toBe(0);
    expect(previsoraStatus.totalRequired).toBe(3);
    expect(previsoraStatus.gaps[0]?.status).toBe('PARTIAL_GAP');
    expect(previsoraStatus.gaps[0]?.notes).toContain('inferior al exigido');
    expect(previsoraStatus.gaps[1]?.status).toBe('PARTIAL_GAP');
    expect(previsoraStatus.gaps[1]?.notes).toContain('Vigencia cotizada');
    expect(previsoraStatus.gaps[2]?.status).toBe('MISSING');
  });
});
