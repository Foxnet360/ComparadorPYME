import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crossReferenceEngine } from '../crossReferenceEngine';
import { ParsedCoverage, ParsedQuote } from '../quoteParser';
import { ragRetrievalService, RetrievedClause } from '../ragRetrievalService';

// Mock the ragRetrievalService
vi.mock('../ragRetrievalService', () => ({
  ragRetrievalService: {
    searchWithFallback: vi.fn(),
  },
}));

describe('crossReferenceEngine', () => {
  const mockCoverage: ParsedCoverage = {
    name: 'Incendio',
    canonicalName: 'Incendio (Edificio y Contenidos)',
    value: '500.000.000',
    deductible: '10%',
    confidence: 95,
  };

  const mockQuote: ParsedQuote = {
    insurerName: 'Seguros Bolívar',
    policyName: 'PYME Empresarial',
    priceAnnual: 8500000,
    currency: 'COP',
    coverages: [mockCoverage],
    specialConditions: [],
    rawText: '',
    parseConfidence: 95,
  };

  const mockClauses: RetrievedClause[] = [
    {
      id: '1',
      documentId: 'doc1',
      insurerName: 'Seguros Bolívar',
      sectionType: 'COBERTURA',
      coverageTags: ['Incendio (Edificio y Contenidos)'],
      content:
        'Deducible: 10% del valor del siniestro. No cubre terremotos ni movimientos sísmicos.',
      pageNumber: 15,
      similarity: 0.92,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cross-reference coverage and return result', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: mockClauses,
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    expect(result).toBeDefined();
    expect(result.coverageName).toBe(mockCoverage.canonicalName);
    expect(result.isVerified).toBe(true);
  });

  it('should detect deductible discrepancies', async () => {
    const clauseWithHigherDeductible = [
      {
        ...mockClauses[0],
        content: 'Deducible: 20% del valor del siniestro.',
      },
    ];

    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: clauseWithHigherDeductible,
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    const criticalAlert = result.alerts.find((a) => a.level === 'CRITICAL');
    expect(criticalAlert).toBeDefined();
    expect(criticalAlert?.title).toContain('Discrepancia');
  });

  it('should detect favorable deductibles', async () => {
    const clauseWithLowerDeductible = [
      {
        ...mockClauses[0],
        content: 'Deducible: 5% del valor del siniestro.',
      },
    ];

    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: clauseWithLowerDeductible,
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    const goodAlert = result.alerts.find((a) => a.level === 'GOOD');
    expect(goodAlert).toBeDefined();
    expect(goodAlert?.title).toContain('favorable');
  });

  it('should detect exclusions in clauses', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: mockClauses,
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    const warningAlert = result.alerts.find((a) => a.level === 'WARNING');
    expect(warningAlert).toBeDefined();
    expect(warningAlert?.title).toContain('Exclusiones');
  });

  it('should handle no clauses found', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: [],
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    expect(result.isVerified).toBe(false);
    const infoAlert = result.alerts.find((a) => a.level === 'INFO');
    expect(infoAlert).toBeDefined();
    expect(infoAlert?.title).toContain('Sin cláusulas');
  });

  it('should handle fallback clauses', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: mockClauses,
      isFallback: true,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    // Fallback alert has both isFallback=true and specific title
    const fallbackAlert = result.alerts.find(
      (a) => a.isFallback && a.title === 'Referencia genérica'
    );
    expect(fallbackAlert).toBeDefined();
    expect(fallbackAlert?.title).toBe('Referencia genérica');
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockRejectedValue(
      new Error('Database error')
    );

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0].title).toContain('Error');
  });

  it('should cross-reference all coverages in a quote', async () => {
    const multiCoverageQuote: ParsedQuote = {
      ...mockQuote,
      coverages: [
        mockCoverage,
        { ...mockCoverage, name: 'Robo', canonicalName: 'Robo', value: '200M' },
      ],
    };

    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: mockClauses,
      isFallback: false,
    });

    const results = await crossReferenceEngine.crossReferenceQuote(multiCoverageQuote);

    expect(results).toHaveLength(2);
    expect(results[0].coverageName).toBe('Incendio (Edificio y Contenidos)');
    expect(results[1].coverageName).toBe('Robo');
  });

  it('should handle coverage with no deductible', async () => {
    const coverageNoDed = { ...mockCoverage, deductible: 'No aplica' };

    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: mockClauses,
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      coverageNoDed,
      'Seguros Bolívar'
    );

    // Should not generate deductible comparison alerts
    const dedAlert = result.alerts.find(
      (a) => a.title.includes('Discrepancia') || a.title.includes('favorable')
    );
    expect(dedAlert).toBeUndefined();
  });

  it('should handle unparseable deductible values', async () => {
    const coverageWeirdDed = { ...mockCoverage, deductible: 'Ver cláusula 5' };

    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: mockClauses,
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      coverageWeirdDed,
      'Seguros Bolívar'
    );

    expect(result).toBeDefined();
    // Should not crash, just skip comparison
  });

  it('should include clause reference in critical alerts', async () => {
    const clauseWithHigherDeductible = [
      {
        ...mockClauses[0],
        content: 'Deducible: 20% del valor del siniestro.',
      },
    ];

    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: clauseWithHigherDeductible,
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(
      mockCoverage,
      'Seguros Bolívar'
    );

    const criticalAlert = result.alerts.find((a) => a.level === 'CRITICAL');
    expect(criticalAlert).toBeDefined();
    expect(criticalAlert?.clauseReference).toBeDefined();
  });
});
