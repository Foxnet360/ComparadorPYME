import { describe, it, expect } from 'vitest';
import { buildGraphEdgesFromDomain, seedCoverageGraph } from '../graphSeeder';
import { validateGraphEdge } from '../../schemas/templateRegistrySchema';

describe('graphSeeder', () => {
  describe('buildGraphEdgesFromDomain', () => {
    it('produces non-empty edges from taxonomy and ontology', () => {
      const edges = buildGraphEdgesFromDomain('pyme');
      expect(edges.length).toBeGreaterThan(0);
    });

    it('creates maps_to edges from taxonomy aliases to canonical categories', () => {
      const edges = buildGraphEdgesFromDomain('pyme');

      const incendioEdges = edges.filter((e) => e.to === 'incendio' && e.type === 'maps_to');
      expect(incendioEdges.length).toBeGreaterThan(0);
      expect(incendioEdges.some((e) => e.from === 'Incendio')).toBe(true);
      expect(incendioEdges.some((e) => e.from === 'Daños Materiales')).toBe(true);
    });

    it('creates maps_to edges from ontology aliases', () => {
      const edges = buildGraphEdgesFromDomain('pyme');

      const lucroEdges = edges.filter((e) => e.to === 'lucro-cesante' && e.type === 'maps_to');
      expect(lucroEdges.length).toBeGreaterThan(0);
      expect(lucroEdges.some((e) => e.from === 'Lucro Cesante')).toBe(true);
    });

    it('creates decomposes_to edges for composite patterns', () => {
      const edges = buildGraphEdgesFromDomain('pyme');

      const compositeEdges = edges.filter((e) => e.type === 'decomposes_to');
      expect(compositeEdges.length).toBeGreaterThan(0);

      const todoRiesgo = compositeEdges.filter((e) => e.from === 'composite:todo-riesgo');
      expect(todoRiesgo.some((e) => e.to === 'incendio')).toBe(true);
      expect(todoRiesgo.some((e) => e.to === 'terremoto')).toBe(true);
      expect(todoRiesgo.some((e) => e.to === 'hmacc')).toBe(true);
      expect(todoRiesgo.some((e) => e.to === 'sustraccion')).toBe(true);
    });

    it('uses high seed weights for taxonomy and ontology mappings', () => {
      const edges = buildGraphEdgesFromDomain('pyme');
      const mapsToEdges = edges.filter((e) => e.type === 'maps_to');

      expect(mapsToEdges.every((e) => e.weight === 0.95)).toBe(true);
    });

    it('returns valid GraphEdge objects', () => {
      const edges = buildGraphEdgesFromDomain('pyme');
      for (const edge of edges) {
        const result = validateGraphEdge(edge);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('seedCoverageGraph', () => {
    it('upserts edges into coverage_graph_edges', async () => {
      const upsertCalls: { table: string; rows: unknown[]; options: unknown }[] = [];
      const fakeDb = {
        from: (table: string) => ({
          upsert: (rows: unknown[], options?: unknown) => {
            upsertCalls.push({ table, rows: rows as unknown[], options });
            return Promise.resolve({ data: rows, error: null });
          },
        }),
      };

      const edges = buildGraphEdgesFromDomain('pyme').slice(0, 5);
      await seedCoverageGraph(
        fakeDb as unknown as Parameters<typeof seedCoverageGraph>[0],
        'pyme',
        edges
      );

      expect(upsertCalls).toHaveLength(1);
      expect(upsertCalls[0].table).toBe('coverage_graph_edges');
      expect(upsertCalls[0].rows).toHaveLength(5);
      expect(upsertCalls[0].options).toMatchObject({
        onConflict: 'from_node,to_node,edge_type,insurer,domain',
      });
    });
  });
});
