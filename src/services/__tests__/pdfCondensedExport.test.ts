import { describe, it, expect, vi } from 'vitest';
import { generatePDF } from '../../../services/pdfService';
import type { ComparisonReport, QuoteAnalysis } from '../../../types';

// Mock jsPDF save to prevent writing files to disk during test execution
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  const jsPDF = actual.default;

  return {
    ...actual,
    default: class MockJsPDF extends jsPDF {
      save(_filename?: string) {
        return this;
      }
    },
  };
});

const mockQuotes: QuoteAnalysis[] = [
  {
    insurerName: 'Seguros del Estado',
    priceAnnual: 12500000,
    score: 88,
    coverages: [
      { name: 'Incendio y Terremoto', value: '$ 1.200.000.000', isPositive: true },
      { name: 'Responsabilidad Civil Extracontractual', value: '$ 500.000.000', isPositive: true },
    ],
    deductibles: '10% mínimo 3 SMMLV',
    technicalAnalysis: 'Propuesta balanceada con respaldo patrimonial sólido.',
  } as unknown as QuoteAnalysis,
  {
    insurerName: 'Seguros Bolívar',
    priceAnnual: 13200000,
    score: 92,
    coverages: [
      { name: 'Incendio y Terremoto', value: '$ 1.200.000.000', isPositive: true },
      { name: 'Responsabilidad Civil Extracontractual', value: '$ 600.000.000', isPositive: true },
    ],
    deductibles: '10% mínimo 2.5 SMMLV',
    technicalAnalysis: 'Amplitud de amparos y menores deducibles en RCE.',
  } as unknown as QuoteAnalysis,
];

const mockReport: ComparisonReport = {
  id: 'rep-test-123',
  domain: 'pyme',
  quotes: mockQuotes,
  recommendation: 'Recomendamos Seguros Bolívar por relación costo-amparo.',
  marketAnalysis: 'Competitivo',
  timestamp: new Date().toISOString(),
  analysisVersion: '2.0-rag',
  clientInfo: {
    name: 'Industrias Metálicas del Norte S.A.S.',
    address: 'Zona Industrial Calle 13 # 45-67',
    city: 'Bogotá D.C.',
  },
  matrix: [
    {
      type: 'data',
      id: 'cov-1',
      label: 'Incendio y Terremoto',
      sectionId: 1,
      cells: [
        { value: '$ 1.200.000.000', isExcluded: false, isWinner: false },
        { value: '$ 1.200.000.000', isExcluded: false, isWinner: false },
      ],
    },
    {
      type: 'data',
      id: 'cov-2',
      label: 'Responsabilidad Civil Extracontractual',
      sectionId: 1,
      cells: [
        { value: '$ 500.000.000', isExcluded: false, isWinner: false },
        { value: '$ 600.000.000', isExcluded: false, isWinner: true },
      ],
    },
  ],
  commercialConditions: {
    'Seguros del Estado': { validezOferta: '30 días', formaPago: '10 cuotas mensuales' },
    'Seguros Bolívar': { validezOferta: '45 días', formaPago: '12 cuotas mensuales' },
  },
} as unknown as ComparisonReport;

const brokerInfo = {
  name: 'Alejandro Morales',
  intermediaryName: 'Corredores de Seguros Asociados S.A.',
  registrationNumber: 'SFC-88776',
  phone: '+57 (601) 789-0123',
  email: 'amorales@correseguros.co',
  website: 'https://correseguros.co/',
  address: 'Carrera 7 # 71-21 Torre B',
  city: 'Bogotá D.C.',
  logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

describe('generatePDF — Condensed mode vs Extended mode', () => {
  it('generates condensed version matching the Client Excel scope (Cuadro Resumen + Políticas Comerciales)', () => {
    const doc = generatePDF(mockReport, {
      mode: 'condensed',
      customTitle: 'CUADRO COMPARATIVO RESUMIDO · VISIÓN EJECUTIVA CONDENSADA',
      brokerInfo,
    });

    expect(doc).toBeDefined();
    // In condensed mode, the document should be strictly 2 pages (Cuadro Resumen + Políticas Comerciales)
    const pageCount = doc.getNumberOfPages();
    expect(pageCount).toBe(2);
  });

  it('generates extended version with comprehensive multi-page technical audit matrices', () => {
    const doc = generatePDF(mockReport, {
      mode: 'extended',
      customTitle: 'Informe Auditoría Técnica Completa',
      brokerInfo,
    });

    expect(doc).toBeDefined();
    // In extended mode, the document includes full multi-page matrices (coverages, deductibles, findings, economic)
    const pageCount = doc.getNumberOfPages();
    expect(pageCount).toBeGreaterThan(4);
  });
});
