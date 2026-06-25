import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCoverageGraphService } from '../coverageGraphService';
import { GraphEdge } from '../../types/templateGraph';

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async (_text: string) => Array(3072).fill(0).map((_, i) => i / 3072)),
    cosineSimilarity: vi.fn(() => 1.0),
  },
}));

function makeFakeDb(initialEdges: any[] = []) {
  const edges = [...initialEdges];
  const tables = new Map<string, any>();

  function buildTable(table: string) {
    if (table !== 'coverage_graph_edges') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    }

    return {
      select: vi.fn((_cols = '*') => {
        const chain: any = {
          data: edges,
          error: null,
        };
        const filters: Record<string, unknown> = {};

        chain.eq = vi.fn((col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        });
        chain.ilike = vi.fn((col: string, val: string) => {
          filters[col] = { ilike: val.toLowerCase() };
          return chain;
        });
        chain.in = vi.fn((_col: string, _vals: unknown[]) => chain);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn((n: number) => {
          const filtered = edges.filter((e) => {
            for (const [col, val] of Object.entries(filters)) {
              if (typeof val === 'object' && val && 'ilike' in val) {
                const text = String(e[col] ?? '').toLowerCase();
                if (!text.includes((val as any).ilike)) return false;
              } else if ((e[col] ?? '') !== val && !(val === '' && (e[col] ?? '') === '')) {
                return false;
              }
            }
            return true;
          });
          return Promise.resolve({ data: filtered.slice(0, n), error: null });
        });
        chain.then = (resolve: any) =>
          resolve({
            data: edges.filter((e) => {
              for (const [col, val] of Object.entries(filters)) {
                if (typeof val === 'object' && val && 'ilike' in val) {
                  const text = String(e[col] ?? '').toLowerCase();
                  if (!text.includes((val as any).ilike)) return false;
                } else if ((e[col] ?? '') !== val && !(val === '' && (e[col] ?? '') === '')) {
                  return false;
                }
              }
              return true;
            }),
            error: null,
          });

        return chain;
      }),
      upsert: vi.fn((rows: any | any[]) => {
        const rowArray = Array.isArray(rows) ? rows : [rows];
        for (const row of rowArray) {
          const existingIndex = edges.findIndex(
            (e) =>
              e.from_node === row.from_node &&
              e.to_node === row.to_node &&
              e.edge_type === row.edge_type &&
              (e.insurer ?? '') === (row.insurer ?? '') &&
              (e.domain ?? 'pyme') === (row.domain ?? 'pyme')
          );
          if (existingIndex >= 0) {
            edges[existingIndex] = { ...edges[existingIndex], ...row };
          } else {
            edges.push({ id: `edge-${edges.length + 1}`, ...row });
          }
        }
        return Promise.resolve({ data: rowArray, error: null });
      }),
      delete: vi.fn(() => {
        const delChain: any = {};
        delChain.eq = vi.fn(() => delChain);
        delChain.then = (resolve: any) => {
          resolve({ error: null });
        };
        return delChain;
      }),
    };
  }

  return {
    from: vi.fn((table: string) => {
      if (!tables.has(table)) {
        tables.set(table, buildTable(table));
      }
      return tables.get(table);
    }),
  };
}

function makeFakeCache() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

describe('coverageGraphService', () => {
  let fakeDb: ReturnType<typeof makeFakeDb>;
  let fakeCache: ReturnType<typeof makeFakeCache>;
  let service: ReturnType<typeof createCoverageGraphService>;

  beforeEach(() => {
    fakeDb = makeFakeDb();
    fakeCache = makeFakeCache();
    service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });
  });

  describe('query', () => {
    it('returns empty result when no edges match', async () => {
      const result = await service.query('Cobertura Desconocida');
      expect(result.mappings).toEqual([]);
      expect(result.composite).toBe(false);
    });

    it('returns direct maps_to mapping with edge weight as confidence', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'Daño Material Todo Riesgo',
          to_node: 'incendio',
          edge_type: 'maps_to',
          weight: 0.95,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.query('Daño Material Todo Riesgo');
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].canonicalId).toBe('incendio');
      expect(result.mappings[0].confidence).toBeCloseTo(0.95, 2);
      expect(result.mappings[0].provenance).toBe('maps_to');
    });

    it('follows alias_of edges to canonical category', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'DMG',
          to_node: 'incendio',
          edge_type: 'alias_of',
          weight: 0.98,
          insurer: 'BBVA',
          correction_count: 5,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.query('DMG', { insurer: 'BBVA' });
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].canonicalId).toBe('incendio');
      expect(result.mappings[0].confidence).toBeGreaterThan(0.95);
      expect(result.mappings[0].provenance).toContain('alias_of');
    });

    it('returns composite decomposition when decomposes_to edges exist', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'Amparo Básico Todo Riesgo',
          to_node: 'composite:amparo-basico',
          edge_type: 'maps_to',
          weight: 0.9,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
        {
          from_node: 'composite:amparo-basico',
          to_node: 'incendio',
          edge_type: 'decomposes_to',
          weight: 0.85,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
        {
          from_node: 'composite:amparo-basico',
          to_node: 'terremoto',
          edge_type: 'decomposes_to',
          weight: 0.85,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
        {
          from_node: 'composite:amparo-basico',
          to_node: 'hmacc',
          edge_type: 'decomposes_to',
          weight: 0.85,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.query('Amparo Básico Todo Riesgo');
      expect(result.composite).toBe(true);
      expect(result.components).toContain('incendio');
      expect(result.components).toContain('terremoto');
      expect(result.components).toContain('hmacc');
      expect(result.mappings.some((m) => m.canonicalId === 'incendio')).toBe(true);
    });

    it('returns cached result on repeated query', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'Daño Material',
          to_node: 'incendio',
          edge_type: 'maps_to',
          weight: 0.95,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      await service.query('Daño Material');
      await service.query('Daño Material');

      expect(fakeDb.from).toHaveBeenCalledTimes(1);
      expect(fakeCache.setex).toHaveBeenCalledTimes(1);
    });

    it('filters by insurer when provided', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'Daño Material',
          to_node: 'incendio',
          edge_type: 'maps_to',
          weight: 0.95,
          insurer: 'BBVA',
          correction_count: 0,
          domain: 'pyme',
        },
        {
          from_node: 'Daño Material',
          to_node: 'equipo-electronico',
          edge_type: 'maps_to',
          weight: 0.9,
          insurer: 'SBS',
          correction_count: 0,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.query('Daño Material', { insurer: 'BBVA' });
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].canonicalId).toBe('incendio');
    });

    it('boosts confidence for edges with high correction count', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'Daño Material Global',
          to_node: 'incendio',
          edge_type: 'learned',
          weight: 0.7,
          insurer: '',
          correction_count: 12,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.query('Daño Material Global');
      expect(result.mappings[0].confidence).toBeCloseTo(0.94, 2);
    });
  });

  describe('queryDeductible', () => {
    it('returns applicable coverages for deductible text', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: '10% min 5 smmlv',
          to_node: 'terremoto',
          edge_type: 'deductible_for',
          weight: 0.92,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.queryDeductible('10% min 5 SMMLV');
      expect(result).toHaveLength(1);
      expect(result[0].appliesTo).toBe('terremoto');
      expect(result[0].confidence).toBeCloseTo(0.92, 2);
    });

    it('prefers insurer-specific deductible rules', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: '10%',
          to_node: 'incendio',
          edge_type: 'deductible_for',
          weight: 0.8,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
        {
          from_node: '10%',
          to_node: 'equipo-electronico',
          edge_type: 'deductible_for',
          weight: 0.95,
          insurer: 'BBVA',
          correction_count: 0,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.queryDeductible('10%', { insurer: 'BBVA' });
      expect(result).toHaveLength(1);
      expect(result[0].appliesTo).toBe('equipo-electronico');
    });
  });

  describe('learnCorrection', () => {
    it('upserts a learned edge and increments correction count', async () => {
      await service.learnCorrection('Daño Material Global', 'incendio');

      const upsertCall = fakeDb.from('coverage_graph_edges').upsert;
      expect(upsertCall).toHaveBeenCalled();
      const row = upsertCall.mock.calls[0][0];
      expect(row.edge_type).toBe('learned');
      expect(row.from_node).toBe('dano material global');
      expect(row.to_node).toBe('incendio');
      expect(row.correction_count).toBe(1);
    });

    it('increments existing correction count and recalculates weight', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'dano material global',
          to_node: 'incendio',
          edge_type: 'learned',
          weight: 0.7,
          insurer: '',
          correction_count: 5,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      await service.learnCorrection('Daño Material Global', 'incendio');

      const upsertCall = fakeDb.from('coverage_graph_edges').upsert;
      const row = upsertCall.mock.calls[0][0];
      expect(row.correction_count).toBe(6);
      expect(row.weight).toBeCloseTo(0.82, 2);
    });

    it('invalidates cache after learning', async () => {
      await service.learnCorrection('Daño Material Global', 'incendio');
      expect(fakeCache.del).toHaveBeenCalled();
    });
  });

  describe('addEdge', () => {
    it('persists a validated edge to the database', async () => {
      const edge: GraphEdge = {
        from: 'raw:foo',
        to: 'cat:bar',
        type: 'maps_to',
        weight: 0.85,
      };

      await service.addEdge(edge);

      const upsertCall = fakeDb.from('coverage_graph_edges').upsert;
      expect(upsertCall).toHaveBeenCalled();
      const row = upsertCall.mock.calls[0][0];
      expect(row.from_node).toBe('raw:foo');
      expect(row.to_node).toBe('cat:bar');
      expect(row.edge_type).toBe('maps_to');
    });

    it('rejects invalid edge types', async () => {
      const edge = {
        from: 'raw:foo',
        to: 'cat:bar',
        type: 'invalid_type',
        weight: 0.85,
      } as unknown as GraphEdge;

      await expect(service.addEdge(edge)).rejects.toThrow();
    });
  });

  describe('listEdges', () => {
    it('returns edges filtered by type', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'a',
          to_node: 'incendio',
          edge_type: 'maps_to',
          weight: 0.95,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
        {
          from_node: 'b',
          to_node: 'terremoto',
          edge_type: 'deductible_for',
          weight: 0.9,
          insurer: '',
          correction_count: 0,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      const result = await service.listEdges({ type: 'deductible_for' });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('deductible_for');
    });
  });

  describe('propagate', () => {
    it('recalculates learned edge weights based on correction counts', async () => {
      fakeDb = makeFakeDb([
        {
          from_node: 'raw:a',
          to_node: 'incendio',
          edge_type: 'learned',
          weight: 0.5,
          insurer: '',
          correction_count: 10,
          domain: 'pyme',
        },
      ]);
      service = createCoverageGraphService({ db: fakeDb as any, cache: fakeCache as any });

      await service.propagate();

      const upsertCall = fakeDb.from('coverage_graph_edges').upsert;
      expect(upsertCall).toHaveBeenCalled();
      const payload = upsertCall.mock.calls[0][0];
      const row = Array.isArray(payload) ? payload[0] : payload;
      expect(row.weight).toBeCloseTo(0.9, 2);
    });
  });
});
