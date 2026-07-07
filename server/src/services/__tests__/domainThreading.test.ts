import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock environment + Supabase before any service that imports them is loaded.
vi.mock('../../config/env', () => ({
  env: {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-test',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-test',
  },
}));

vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock('../../services/vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn().mockResolvedValue([]),
    generateEmbeddingsBatch: vi.fn().mockResolvedValue([]),
    cosineSimilarity: vi.fn().mockReturnValue(0),
  },
}));

import { thesaurusService } from '../normalization/thesaurusService';
import { semanticMatcher } from '../semanticMatcher';
import { coverageOntology } from '../coverageOntology';

describe('Domain threading (PYME default + per-domain bundles)', () => {
  beforeAll(() => {
    semanticMatcher.clearCache();
  });

  it('loads the PYME thesaurus by default', () => {
    const data = thesaurusService.getThesaurus();
    expect(data.version).toBeTruthy();
    expect(Object.keys(data.coberturas_plantilla).length).toBeGreaterThanOrEqual(14);
    expect(data.coberturas_plantilla['Incendio (Edificio y Contenidos)']).toBeTruthy();
  });

  it('lists PYME coverages by default', () => {
    const coverages = thesaurusService.listCoberturas();
    expect(coverages).toContain('Incendio (Edificio y Contenidos)');
    expect(coverages).toContain('Responsabilidad Civil (RCE)');
    expect(coverages.length).toBeGreaterThanOrEqual(14);
  });

  it('returns 14 canonical categories for default domain', () => {
    const categories = semanticMatcher.getAllCategories();
    expect(categories.length).toBe(14);
    expect(categories.map((c) => c.name)).toContain('Incendio (Edificio y Contenidos)');
  });

  it('falls back to PYME when an unknown domain is requested', () => {
    // El bundle loader hace fallback a "pyme" cuando no encuentra archivos
    const categories = semanticMatcher.getAllCategories('nonexistent-domain-for-test');
    expect(categories.length).toBe(14);
  });

  it('loads ontology nodes for PYME domain', () => {
    const nodes = coverageOntology.getNodes('pyme');
    expect(nodes.length).toBeGreaterThan(0);
    const incendio = nodes.find((n) => n.id === 'incendio');
    expect(incendio).toBeTruthy();
    expect(incendio?.name).toBe('Incendio (Edificio y Contenidos)');
  });

  it('looks up ontology node by id for a domain', () => {
    const node = coverageOntology.getNodeById('rce', 'pyme');
    expect(node).toBeTruthy();
    expect(node?.name).toBe('Responsabilidad Civil (RCE)');
  });

  it('maintains independent caches per domain with no data leakage', () => {
    semanticMatcher.clearCache();

    const pymeCategories = semanticMatcher.getAllCategories('pyme');
    const otherCategories = semanticMatcher.getAllCategories('cache-isolation-test-domain');

    // Both domains resolve to valid category lists (other falls back to pyme)
    expect(pymeCategories.length).toBe(14);
    expect(otherCategories.length).toBe(14);

    // Returned arrays are independent copies
    expect(pymeCategories).not.toBe(otherCategories);

    // Modifying one result does not pollute the other domain's cache
    pymeCategories.push({ id: 999, name: 'Fake Category' });
    const pymeCategoriesReloaded = semanticMatcher.getAllCategories('pyme');
    const otherCategoriesReloaded = semanticMatcher.getAllCategories('cache-isolation-test-domain');
    expect(pymeCategoriesReloaded.length).toBe(14);
    expect(otherCategoriesReloaded.length).toBe(14);
    expect(pymeCategoriesReloaded.map((c) => c.name)).not.toContain('Fake Category');
    expect(otherCategoriesReloaded.map((c) => c.name)).not.toContain('Fake Category');
  });
});
