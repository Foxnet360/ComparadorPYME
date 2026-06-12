import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedGraphFromEntries, seedGraphFromThesaurus } from '../thesaurusMapper';
import { coverageGraphService } from '../coverageGraphService';

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    addEdges: vi.fn(async () => {}),
    listEdges: vi.fn(async () => []),
    deleteEdge: vi.fn(async () => {}),
  },
}));

describe('thesaurusMapper graph seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('seedGraphFromEntries', () => {
    it('creates alias_of edges from variants to canonical names', async () => {
      await seedGraphFromEntries(
        [
          {
            canonicalName: 'Incendio (Edificio y Contenidos)',
            variants: ['Fuego', 'Combustión'],
            category: 'Patrimoniales',
          },
          {
            canonicalName: 'Terremoto y Eventos Catastróficos',
            variants: ['Temblor'],
            category: 'Patrimoniales',
          },
        ],
        { domain: 'pyme' }
      );

      expect(coverageGraphService.addEdges).toHaveBeenCalledTimes(1);
      const edges = vi.mocked(coverageGraphService.addEdges).mock.calls[0][0];
      expect(edges).toHaveLength(3);
      expect(edges).toContainEqual({
        from: 'Fuego',
        to: 'Incendio (Edificio y Contenidos)',
        type: 'alias_of',
        weight: 0.85,
        domain: 'pyme',
      });
      expect(edges).toContainEqual({
        from: 'Temblor',
        to: 'Terremoto y Eventos Catastróficos',
        type: 'alias_of',
        weight: 0.85,
        domain: 'pyme',
      });
    });

    it('uses provided insurer and weight', async () => {
      await seedGraphFromEntries(
        [
          {
            canonicalName: 'Incendio (Edificio y Contenidos)',
            variants: ['Fuego'],
            category: 'Patrimoniales',
          },
        ],
        { domain: 'pyme', insurer: 'mapfre', weight: 0.92 }
      );

      const edges = vi.mocked(coverageGraphService.addEdges).mock.calls[0][0];
      expect(edges[0]).toMatchObject({
        from: 'Fuego',
        to: 'Incendio (Edificio y Contenidos)',
        type: 'alias_of',
        weight: 0.92,
        insurer: 'mapfre',
        domain: 'pyme',
      });
    });

    it('does not call addEdges for empty entries', async () => {
      await seedGraphFromEntries([], { domain: 'pyme' });
      expect(coverageGraphService.addEdges).not.toHaveBeenCalled();
    });

    it('does not call addEdges when no entry has variants', async () => {
      await seedGraphFromEntries(
        [{ canonicalName: 'Incendio', variants: [], category: 'Patrimoniales' }],
        { domain: 'pyme' }
      );
      expect(coverageGraphService.addEdges).not.toHaveBeenCalled();
    });
  });

  describe('seedGraphFromThesaurus', () => {
    it('loads the thesaurus and seeds alias edges', async () => {
      await seedGraphFromThesaurus('pyme', { insurer: 'sbs' });

      expect(coverageGraphService.addEdges).toHaveBeenCalledTimes(1);
      const edges = vi.mocked(coverageGraphService.addEdges).mock.calls[0][0];
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.every((e) => e.type === 'alias_of')).toBe(true);
      expect(edges.every((e) => e.domain === 'pyme')).toBe(true);
      expect(edges.every((e) => e.insurer === 'sbs')).toBe(true);
    });
  });
});
