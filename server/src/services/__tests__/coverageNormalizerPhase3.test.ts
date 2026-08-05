import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapRawToCanonical } from '../coverageNormalizer';
import { coverageOntology } from '../coverageOntology';

// Mock env
vi.mock('../../config/env', () => ({
  env: {
    GEMINI_API_KEY: 'dummy',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy',
    SMMLV_VALUE: 1423500,
    UVT_VALUE: 42412,
  },
}));

describe('Phase 3: Graph Canonicalization & Fallback Thresholds', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fall back to thesaurus when ontology match confidence is below 0.7 (70%)', async () => {
    // Mock ontology to return a low confidence match (< 0.7)
    vi.spyOn(coverageOntology, 'mapCoverage').mockResolvedValueOnce({
      rawName: 'Incendio Todo Riesgo',
      insurer: 'Allianz',
      domain: 'pyme',
      groups: [
        {
          groupId: '1',
          confidence: 0.45, // Below 0.70 threshold
          reasoning: 'Weak similarity',
        },
      ],
      ambiguous: true,
      needsHumanReview: true,
    });

    const result = await mapRawToCanonical('Incendio Todo Riesgo', 'pyme', 'Allianz');

    // Because ontology confidence was < 0.7, it fell back to thesaurus/exact/fuzzy match
    expect(result.method).not.toBe('ontology');
    expect(result.canonicalName).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it('should use ontology mapping when confidence is >= 0.7 (70%)', async () => {
    vi.spyOn(coverageOntology, 'mapCoverage').mockResolvedValueOnce({
      rawName: 'Incendio Estructuras',
      insurer: 'Sura',
      domain: 'pyme',
      groups: [
        {
          groupId: '1',
          confidence: 0.88, // Above 0.70 threshold
          reasoning: 'Strong ontology match',
        },
      ],
      ambiguous: false,
      needsHumanReview: false,
    });

    vi.spyOn(coverageOntology, 'getNodeById').mockReturnValueOnce({
      id: '1',
      name: 'Incendio (Edificio y Contenidos)',
      domain: 'pyme',
      synonyms: [],
      description: 'Test node',
    });

    const result = await mapRawToCanonical('Incendio Estructuras', 'pyme', 'Sura');

    expect(result.method).toBe('ontology');
    expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
    expect(result.confidence).toBe(88);
  });
});
