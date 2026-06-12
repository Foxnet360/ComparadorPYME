import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapRawToCanonical,
  buildCanonicalCoverages,
  detectImplicitCoverages,
} from '../coverageNormalizer';
import { featureFlags } from '../../config/featureFlags';
import { coverageGraphService } from '../coverageGraphService';
import { semanticMatcher } from '../semanticMatcher';
import { coverageOntology } from '../coverageOntology';

vi.mock('../semanticMatcher', () => ({
  semanticMatcher: {
    matchCoverage: vi.fn(async () => ({
      categoryId: null,
      canonicalName: null,
      confidence: 0,
      method: null,
    })),
    normalizeBatch: vi.fn(async () => []),
    getAllCategories: vi.fn(() => [
      { id: 1, name: 'Incendio (Edificio y Contenidos)' },
      { id: 2, name: 'Terremoto y Eventos Catastróficos' },
      { id: 3, name: 'Huelga, Motín, Asonada (HMACC)' },
      { id: 4, name: 'Equipo Eléctrico y Electrónico' },
    ]),
    getCategoryName: vi.fn((id: number) => {
      const map: Record<number, string> = {
        1: 'Incendio (Edificio y Contenidos)',
        2: 'Terremoto y Eventos Catastróficos',
        3: 'Huelga, Motín, Asonada (HMACC)',
        4: 'Equipo Eléctrico y Electrónico',
      };
      return map[id] || null;
    }),
    clearCache: vi.fn(),
  },
}));

vi.mock('../coverageOntology', () => ({
  coverageOntology: {
    mapCoverage: vi.fn(async () => ({
      rawName: '',
      groups: [],
      isComposite: false,
      confidence: 0,
    })),
    saveMapping: vi.fn(async () => {}),
    getNodeById: vi.fn(),
  },
}));

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    query: vi.fn(async () => ({ mappings: [], composite: false })),
    queryDeductible: vi.fn(async () => []),
  },
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn((flag: string) => flag === 'useTemplateGraphPipeline'),
    getFlags: vi.fn(() => ({})),
  },
}));

describe('coverageNormalizer graph integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coverageGraphService.query).mockResolvedValue({ mappings: [], composite: false });
    vi.mocked(semanticMatcher.matchCoverage).mockResolvedValue({
      categoryId: null,
      canonicalName: null,
      confidence: 0,
      method: null,
    } as any);
    vi.mocked(semanticMatcher.normalizeBatch).mockResolvedValue([]);
    vi.mocked(featureFlags.isEnabled).mockImplementation((flag: string) => flag === 'useTemplateGraphPipeline');
  });

  describe('mapRawToCanonical', () => {
    it('falls back to graph when standard layers return no match', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: 'incendio', confidence: 0.92, provenance: 'maps_to' }],
        composite: false,
      });

      const result = await mapRawToCanonical('Daño Material Todo Riesgo', 'pyme');

      expect(result.canonicalName).toBe('incendio');
      expect(result.method).toBe('graph');
      expect(result.confidence).toBe(92);
      expect(result.graphConfidence).toBe(92);
      expect(coverageGraphService.query).toHaveBeenCalledWith('Daño Material Todo Riesgo', {
        domain: 'pyme',
        insurer: undefined,
      });
    });

    it('skips graph fallback when pipeline flag is disabled', async () => {
      vi.mocked(featureFlags.isEnabled).mockReturnValue(false);
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: 'incendio', confidence: 0.92, provenance: 'maps_to' }],
        composite: false,
      });

      const result = await mapRawToCanonical('Cobertura Desconocida', 'pyme');

      expect(result.canonicalName).toBeNull();
      expect(coverageGraphService.query).not.toHaveBeenCalled();
    });

    it('returns standard match when available and does not call graph', async () => {
      vi.mocked(semanticMatcher.matchCoverage).mockResolvedValue({
        categoryId: 1,
        canonicalName: 'Incendio (Edificio y Contenidos)',
        confidence: 0.95,
        method: 'embedding',
      } as any);

      const result = await mapRawToCanonical('Algo', 'pyme');

      expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result.method).toBe('embedding');
      expect(coverageGraphService.query).not.toHaveBeenCalled();
    });
  });

  describe('buildCanonicalCoverages', () => {
    it('includes graphConfidence for graph-mapped coverages', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: '1', confidence: 0.88, provenance: 'maps_to' }],
        composite: false,
      });

      const result = await buildCanonicalCoverages(
        [{ rawName: 'Daño Material Global' }],
        [],
        [],
        undefined,
        'pyme'
      );

      const incendio = result.canonicalCoverages.find(
        (c) => c.name === 'Incendio (Edificio y Contenidos)'
      );
      expect(incendio).toBeDefined();
      expect(incendio?.matchMethod).toBe('graph');
      expect(incendio?.graphConfidence).toBe(88);
    });

    it('injects implicit coverages from graph decomposition', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [
          { canonicalId: 'incendio', confidence: 0.9, provenance: 'maps_to' },
        ],
        composite: true,
        components: ['terremoto', 'hmacc'],
      });

      const result = await buildCanonicalCoverages(
        [{ rawName: 'Amparo Básico Todo Riesgo' }],
        [],
        [],
        undefined,
        'pyme'
      );

      const terremoto = result.canonicalCoverages.find(
        (c) => c.name === 'Terremoto y Eventos Catastróficos'
      );
      const hmacc = result.canonicalCoverages.find(
        (c) => c.name === 'Huelga, Motín, Asonada (HMACC)'
      );
      expect(terremoto?.status).toBe('present');
      expect(hmacc?.status).toBe('present');
      expect(terremoto?.matchMethod).toBe('implicit');
    });

    it('keeps uncategorized coverages when graph returns no mappings', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [],
        composite: false,
      });

      const result = await buildCanonicalCoverages(
        [{ rawName: 'XYZ123 Unknown Coverage' }],
        [],
        [],
        undefined,
        'pyme'
      );

      expect(result.uncategorizedCoverages?.length).toBeGreaterThan(0);
      expect(result.uncategorizedCoverages?.[0].name).toBe('XYZ123 Unknown Coverage');
    });
  });

  describe('detectImplicitCoverages', () => {
    it('returns graph-decomposed components as implicit coverages', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: 'incendio', confidence: 0.85, provenance: 'decomposes_to' }],
        composite: true,
        components: ['terremoto', 'hmacc'],
      });

      const result = await detectImplicitCoverages(
        [{ rawName: 'Amparo Básico Todo Riesgo' }],
        'pyme'
      );

      expect(result.map((r) => r.canonicalName)).toContain('Terremoto y Eventos Catastróficos');
      expect(result.map((r) => r.canonicalName)).toContain('Huelga, Motín, Asonada (HMACC)');
    });
  });
});
