import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crossReferenceEngine } from '../../server/src/services/crossReferenceEngine';
import { ragRetrievalService } from '../../server/src/services/ragRetrievalService';
import { featureFlags } from '../../server/src/config/featureFlags';
import { ParsedCoverage } from '../../server/src/services/quoteParser';

vi.mock('../../server/src/services/ragRetrievalService', () => ({
  ragRetrievalService: {
    searchWithFallback: vi.fn(),
  },
}));

vi.mock('../../server/src/config/env', () => ({
  env: {
    GEMINI_API_KEY: 'dummy',
    GEMINI_MODEL: 'gemini-3.5-flash',
    GEMINI_CHAT_MODEL: 'gemini-2.5-flash-lite',
    GEMINI_CLAUSE_MODEL: 'gemini-3.5-flash',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-2',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'dummy',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy',
    SUPABASE_JWT_SECRET: 'dummy',
    PORT: 8080,
    NODE_ENV: 'test',
    REGION: 'CO',
    SMMLV_VALUE: 1423500,
    UVT_VALUE: 42412,
    CURRENCY: 'COP',
    CLAUSE_PAGES_BUCKET: 'clause-pages',
    MAX_FILE_SIZE: 52428800,
    MAX_PAGES_LIMIT: 100,
    UPLOAD_TIMEOUT: 300000,
    LOG_LEVEL: 'info',
  },
}));

vi.mock('../../server/src/services/cache/redisCache', () => ({
  getCachedDeductibleV2: vi.fn().mockResolvedValue(null),
  setCachedDeductibleV2: vi.fn().mockResolvedValue(undefined),
  getCacheValue: vi.fn().mockResolvedValue(null),
  setCacheValue: vi.fn().mockResolvedValue(undefined),
  deleteCacheValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../server/src/services/gemini', () => ({
  geminiService: {
    extractDeductible: vi.fn().mockResolvedValue({
      components: [{ type: 'unknown', value: 0 }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    }),
  },
}));

describe('crossReference deductible structured comparison', () => {
  const mockCoverage: ParsedCoverage = {
    name: 'Incendio',
    canonicalName: 'Incendio (Edificio y Contenidos)',
    value: '500.000.000',
    deductible: '10%',
    confidence: 95,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Force legacy RAG path so we do not depend on the Gemini-backed structured extractor.
    featureFlags.updateFlag('structuredClauseExtraction', false);
  });

  it('detects a CRITICAL discrepancy when clause deductible is higher', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: [
        {
          id: '1',
          documentId: 'doc1',
          insurerName: 'Seguros Bolívar',
          sectionType: 'COBERTURA',
          coverageTags: ['Incendio (Edificio y Contenidos)'],
          content: 'Deducible: 20% del valor del siniestro.',
          pageNumber: 15,
          similarity: 0.92,
        },
      ],
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');

    const criticalAlert = result.alerts.find((a) => a.level === 'CRITICAL');
    expect(criticalAlert).toBeDefined();
    expect(criticalAlert?.title).toContain('Discrepancia');
  });

  it('detects a GOOD alert when clause deductible is lower', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: [
        {
          id: '1',
          documentId: 'doc1',
          insurerName: 'Seguros Bolívar',
          sectionType: 'COBERTURA',
          coverageTags: ['Incendio (Edificio y Contenidos)'],
          content: 'Deducible: 5% del valor del siniestro.',
          pageNumber: 15,
          similarity: 0.92,
        },
      ],
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');

    const goodAlert = result.alerts.find((a) => a.level === 'GOOD');
    expect(goodAlert).toBeDefined();
    expect(goodAlert?.title).toContain('favorable');
  });

  it('does not generate deductible alerts when deductibles match', async () => {
    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: [
        {
          id: '1',
          documentId: 'doc1',
          insurerName: 'Seguros Bolívar',
          sectionType: 'COBERTURA',
          coverageTags: ['Incendio (Edificio y Contenidos)'],
          content: 'Deducible: 10% del valor del siniestro.',
          pageNumber: 15,
          similarity: 0.92,
        },
      ],
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');

    const dedAlert = result.alerts.find(
      (a) => a.title.includes('Discrepancia') || a.title.includes('favorable')
    );
    expect(dedAlert).toBeUndefined();
  });

  it('compares SMMLV clause deductibles structurally', async () => {
    const coverage: ParsedCoverage = { ...mockCoverage, deductible: '5 SMMLV' };

    vi.mocked(ragRetrievalService.searchWithFallback).mockResolvedValue({
      clauses: [
        {
          id: '1',
          documentId: 'doc1',
          insurerName: 'Seguros Bolívar',
          sectionType: 'COBERTURA',
          coverageTags: ['Incendio (Edificio y Contenidos)'],
          content: 'Deducible: 10 SMMLV.',
          pageNumber: 15,
          similarity: 0.92,
        },
      ],
      isFallback: false,
    });

    const result = await crossReferenceEngine.crossReferenceCoverage(coverage, 'Seguros Bolívar');

    const criticalAlert = result.alerts.find((a) => a.level === 'CRITICAL');
    expect(criticalAlert).toBeDefined();
  });
});
