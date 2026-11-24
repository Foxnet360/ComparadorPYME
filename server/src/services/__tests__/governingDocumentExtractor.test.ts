import { describe, it, expect } from 'vitest';
import {
  buildGoverningReferenceQuote,
  auditQuotesAgainstGoverningSpec,
  applyCumplimientoPostProcessing,
  type GoverningDocumentSpec,
} from '../governingDocumentExtractor';
import {
  applyGoverningDocumentColumnToMatrix,
  quotesToMatrixRows,
} from '../unifiedComparison/matrixTransformer';
import { matrixRowsToComparisonReport } from '../unifiedComparison/reportBuilderService';
import type { ParsedQuote } from '../quoteParser';

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

  it('keeps governing document column separated from candidate quotes in matrixRowsToComparisonReport even with generic filenames', async () => {
    const candidateQuote: ParsedQuote = {
      insurerName: 'SURA',
      policyName: 'Seriedad Licitación',
      priceAnnual: 350_000,
      currency: 'COP',
      coverages: [
        {
          name: 'Seriedad de Oferta',
          canonicalName: 'Seriedad de Oferta',
          value: '100000000',
          deductible: 'No aplica',
          percentageOfContract: '10%',
          confidence: 95,
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95,
    };

    const licitacionSpec: GoverningDocumentSpec = {
      documentName: 'Pliego_SECOP.pdf',
      stage: 'LICITACION',
      legalRegime: 'ESTATAL_LEY_80',
      contractOrBudgetValue: 1_000_000_000,
      requiredCoverages: [
        {
          name: 'Seriedad de Oferta',
          percentageOfContract: '10%',
          minimumAmount: 100_000_000,
          validityRule: '120 días desde cierre',
        },
      ],
    };

    const baseMatrix = quotesToMatrixRows([candidateQuote], 'cumplimiento');
    const refQuote = buildGoverningReferenceQuote(licitacionSpec);
    const matrixWithGov = applyGoverningDocumentColumnToMatrix(baseMatrix, ['SURA'], refQuote);

    // Generic filename like "cotizacion_licitacion.pdf" must still map to SURA (index 1), not to Pliego de Licitación (index 0)
    const fakeFiles = [{ originalname: 'cotizacion_licitacion.pdf' } as Express.Multer.File];
    const report = await matrixRowsToComparisonReport(matrixWithGov, fakeFiles, {
      domain: 'cumplimiento',
    });

    expect(report.quotes).toHaveLength(1);
    expect(report.quotes[0]?.insurerName).toBe('SURA');
    expect(report.quotes[0]?.priceAnnual).toBe(350_000);
    expect(report.matrix.find((r) => r.id === 'governing_document_column')).toBeDefined();

    // Also verify applyCumplimientoPostProcessing uses the resolved stage from governingSpec when requestedStage is AUTO
    const resultEnvelope: Parameters<typeof applyCumplimientoPostProcessing>[0] = {
      quotes: report.quotes,
      regulatoryBacking: report.regulatoryBacking,
    };
    applyCumplimientoPostProcessing(resultEnvelope, 'AUTO', licitacionSpec);
    expect(resultEnvelope.cumplimientoStage).toBe('LICITACION');
    const suraChecks = resultEnvelope.regulatoryBacking?.perQuoteCompliance['SURA'] ?? [];
    expect(suraChecks.some((c) => c.status === 'NON_COMPLIANT')).toBe(false);
  });
});
