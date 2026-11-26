import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildGoverningReferenceQuote,
  auditQuotesAgainstGoverningSpec,
  applyCumplimientoPostProcessing,
  extractPrepolicyFromDocuments,
  type GoverningDocumentSpec,
} from '../governingDocumentExtractor';
import { pdfExtractor } from '../pdfExtractor';
import * as geminiClient from '../geminiClient';
import { env } from '../../config/env';
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

  describe('extractPrepolicyFromDocuments', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('sends text beyond 65,000 chars and parses formatted COP amounts and snippets', async () => {
      const longClauseTail = 'CLAUSULA GARANTIAS FINAL: Cumplimiento 20% y Estabilidad 10%';
      const longText = `${'A'.repeat(70_000)}\n${longClauseTail}`;

      vi.spyOn(pdfExtractor, 'extractTextFromPdf').mockResolvedValue({
        text: longText,
        pages: [],
        metadata: { pageCount: 25 },
      } as never);

      const originalKey = env.GEMINI_API_KEY;
      (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = 'test-key';

      const generateContentMock = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          caseType: 'CONTRATO',
          legalRegime: 'PARTICULAR',
          contractType: 'OBRA',
          contractNumber: 'OC-001-2026',
          objectDescription: 'Construcción proyecto Papiro',
          contractValue: '$ 467.852.976',
          contractDuration: '8 meses',
          contractor: {
            name: 'MESA MEJIA CONSTRUCTORES SAS',
            nit: '900111222-3',
            personType: 'JURIDICA',
          },
          beneficiary: {
            name: 'PAPIRO SAS',
            nit: '800333444-5',
          },
          requiredCoverages: [
            {
              name: 'Buen manejo y correcta inversión del anticipo',
              percentageOfContract: '50%',
              minimumAmount: null,
              validityRule: 'Desde expedición hasta liquidación',
              rawTextSnippet:
                'Buen manejo y correcta inversión del anticipo 50% $ 233.926.488 Desde expedición',
            },
            {
              name: 'Cumplimiento',
              percentageOfContract: '20%',
              minimumAmount: null,
              validityRule: 'Plazo + 4 meses',
            },
          ],
        }),
      });

      vi.spyOn(geminiClient, 'getGenAI').mockReturnValue({
        models: { generateContent: generateContentMock },
      } as never);

      try {
        const result = await extractPrepolicyFromDocuments(
          [{ path: '/tmp/contrato.pdf', originalname: 'CONTRATO.pdf' }],
          'CONTRATO'
        );

        const sentPrompt = String(
          generateContentMock.mock.calls[0]?.[0]?.contents?.[0]?.parts?.[0]?.text || ''
        );
        expect(sentPrompt).toContain(longClauseTail);
        expect(result.contractNumber).toBe('OC-001-2026');
        expect(result.contractValue).toBe(467_852_976);
        expect(result.contractor.name).toBe('MESA MEJIA CONSTRUCTORES SAS');
        expect(result.contractor.nit).toBe('900111222-3');
        expect(result.beneficiary.name).toBe('PAPIRO SAS');
        expect(result.requiredCoverages).toHaveLength(2);
        expect(result.requiredCoverages[0]?.minimumAmount).toBe(233_926_488);
        expect(result.requiredCoverages[1]?.minimumAmount).toBe(93_570_595);
      } finally {
        (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = originalKey;
      }
    });

    it('splits Calidad del Servicio into Contractual and Post-contractual, calculates business-day dates from signature, and builds independent RCE SMMLV', async () => {
      vi.spyOn(pdfExtractor, 'extractTextFromPdf').mockResolvedValue({
        text: 'CONTRATO DE SERVICIOS',
        pages: [],
        metadata: { pageCount: 5 },
      } as never);

      const originalKey = env.GEMINI_API_KEY;
      (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = 'test-key';

      vi.spyOn(geminiClient, 'getGenAI').mockReturnValue({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              caseType: 'CONTRATO',
              legalRegime: 'ESTATAL_LEY_80',
              contractType: 'PRESTACION_SERVICIOS',
              contractNumber: 'PS-2026-10',
              objectDescription: 'Servicios TI',
              contractValue: 100_000_000,
              contractDuration: '3 días hábiles',
              durationValue: 3,
              durationUnit: 'DIAS_HABILES',
              contractSignatureDate: '2026-04-01',
              contractor: {
                name: 'TECH SAS',
                nit: '900111222-3',
                personType: 'JURIDICA',
                address: 'Calle 10 # 20-30',
                phone: '3001234567',
              },
              beneficiary: {
                name: 'ENTIDAD PUBLICA',
                nit: '899999001-1',
                address: 'Cra 7 # 1-2',
                phone: '6015550000',
              },
              requiredCoverages: [
                {
                  name: 'Calidad del Servicio',
                  percentageOfContract: '20%',
                  additionalTermValue: 1,
                  additionalTermUnit: 'ANIOS',
                  validityRule: 'Plazo + 1 año',
                },
              ],
              rceRequirement: {
                required: true,
                basicPloIncluded: true,
                amountSmmlv: 200,
                additionalCoverages: [
                  { code: 'RC_PATRONAL', label: 'RC Patronal', included: true, sublimitSmmlv: 50 },
                  { code: 'RC_CRUZADA', label: 'RC Cruzada', included: true },
                ],
              },
            }),
          }),
        },
      } as never);

      try {
        const res = await extractPrepolicyFromDocuments(
          [{ path: '/tmp/ps.pdf', originalname: 'ps.pdf' }],
          'CONTRATO'
        );

        expect(res.contractStartDate).toBe('2026-04-01');
        expect(res.contractStartDateSource).toBe('FIRMA');
        expect(res.contractEndDate).toBe('2026-04-08'); // skips Apr 2,3,4,5
        expect(res.contractor.phone).toBe('3001234567');
        expect(res.beneficiary.phone).toBe('6015550000');

        expect(res.requiredCoverages).toHaveLength(2);
        expect(res.requiredCoverages[0]).toMatchObject({
          phase: 'CONTRACTUAL',
          estimatedStartDate: '2026-04-01',
          estimatedEndDate: '2026-04-08',
        });
        expect(res.requiredCoverages[1]).toMatchObject({
          phase: 'POST_CONTRACTUAL',
          estimatedStartDate: '2026-04-08',
          estimatedEndDate: '2027-04-08',
        });

        expect(res.rceRequirement?.required).toBe(true);
        expect(res.rceRequirement?.basicPloIncluded).toBe(true);
        expect(res.rceRequirement?.amountSmmlv).toBe(200);
        expect(res.rceRequirement?.amountCop).toBe(200 * 1_750_905);
        expect(res.rceRequirement?.additionalCoverages).toHaveLength(7);
        expect(
          res.rceRequirement?.additionalCoverages?.find((a) => a.code === 'RC_PATRONAL')?.included
        ).toBe(true);
      } finally {
        (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY = originalKey;
      }
    });
  });
});
