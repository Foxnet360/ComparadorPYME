import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCoverageGraphService } from '../coverageGraphService';
import {
  createStructuredLogger,
  createMetricCollector,
  StructuredLogEntry,
  MetricCollector,
} from '../../utils/structuredLogger';

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async (_text: string) => Array(3072).fill(0).map((_, i) => i / 3072)),
    cosineSimilarity: vi.fn(() => 1.0),
  },
}));

interface FakeEdge {
  id?: string;
  from_node: string;
  to_node: string;
  edge_type: string;
  weight: number;
  insurer: string;
  correction_count: number;
  domain: string;
  [key: string]: unknown;
}

interface FakeFilterBuilder {
  data: FakeEdge[];
  error: null;
  filters: Record<string, unknown>;
  eq(col: string, val: unknown): FakeFilterBuilder;
  in(col: string, vals: unknown[]): FakeFilterBuilder;
  then<T>(resolve: (value: { data: FakeEdge[]; error: null }) => T): T;
}

interface FakeDeleteBuilder {
  eq(col: string, val: unknown): FakeDeleteBuilder;
  then<T>(resolve: (value: { error: null }) => T): T;
}

interface FakeTable {
  select: () => FakeFilterBuilder;
  upsert: (rows: unknown) => Promise<{ data: unknown; error: null }>;
  delete: () => FakeDeleteBuilder;
}

type FakeDb = {
  from: (table: string) => FakeTable;
};

function makeFakeDb(initialEdges: FakeEdge[] = []): FakeDb {
  const edges = [...initialEdges];
  return {
    from: vi.fn((table: string) => {
      if (table !== 'coverage_graph_edges') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          } as unknown as FakeFilterBuilder)),
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          delete: vi.fn(() => {
            const delChain: FakeDeleteBuilder = {
              eq: vi.fn(() => delChain),
              then: vi.fn((resolve) => resolve({ error: null })),
            };
            return delChain;
          }),
        };
      }
      return {
        select: vi.fn(() => {
          const chain: FakeFilterBuilder = {
            data: edges,
            error: null,
            filters: {},
            eq: vi.fn((col: string, val: unknown) => {
              chain.filters[col] = val;
              return chain;
            }),
            in: vi.fn(() => chain),
            then: vi.fn((resolve) =>
              resolve({
                data: edges.filter((e) => {
                  for (const [col, val] of Object.entries(chain.filters)) {
                    if ((e[col] ?? '') !== val && !(val === '' && (e[col] ?? '') === '')) {
                      return false;
                    }
                  }
                  return true;
                }),
                error: null,
              })
            ),
          };
          return chain;
        }),
        upsert: vi.fn((rows: unknown) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          for (const row of rowArray as FakeEdge[]) {
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
          const delChain: FakeDeleteBuilder = {
            eq: vi.fn(() => delChain),
            then: vi.fn((resolve) => {
              resolve({ error: null });
            }),
          };
          return delChain;
        }),
      };
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

type DbArg = NonNullable<Parameters<typeof createCoverageGraphService>[0]['db']>;
type CacheArg = NonNullable<Parameters<typeof createCoverageGraphService>[0]['cache']>;

describe('coverageGraphService metrics and logging', () => {
  let entries: StructuredLogEntry[];
  let metrics: MetricCollector;
  let logger: ReturnType<typeof createStructuredLogger>;

  beforeEach(() => {
    entries = [];
    metrics = createMetricCollector();
    logger = createStructuredLogger('coverageGraphService', {
      sink: (entry) => entries.push(entry),
    });
  });

  it('logs graph_hit when a query is resolved from cache', async () => {
    const db = makeFakeDb([
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
    const cache = makeFakeCache();
    const service = createCoverageGraphService({
      db: db as unknown as DbArg,
      cache: cache as unknown as CacheArg,
      logger,
      metrics,
    });

    await service.query('Daño Material');
    await service.query('Daño Material');

    const hitLog = entries.find((e) => e.event === 'graph_hit');
    expect(hitLog).toBeDefined();
    expect(hitLog?.source).toBe('cache');
    expect(metrics.snapshot().counters['coverageGraph.hit|domain=pyme|source=cache']).toBe(1);
  });

  it('logs graph_cold_start_miss when no edges match', async () => {
    const db = makeFakeDb();
    const cache = makeFakeCache();
    const service = createCoverageGraphService({
      db: db as unknown as DbArg,
      cache: cache as unknown as CacheArg,
      logger,
      metrics,
    });

    const result = await service.query('Cobertura Desconocida');

    expect(result.mappings).toEqual([]);
    const missLog = entries.find((e) => e.event === 'graph_cold_start_miss');
    expect(missLog).toBeDefined();
    expect(missLog?.rawName).toBe('Cobertura Desconocida');
    expect(metrics.snapshot().counters['coverageGraph.cold_start_miss|domain=pyme']).toBe(1);
  });

  it('logs graph_db_hit when edges are loaded from the database', async () => {
    const db = makeFakeDb([
      {
        from_node: 'DMG',
        to_node: 'incendio',
        edge_type: 'alias_of',
        weight: 0.9,
        insurer: 'BBVA',
        correction_count: 0,
        domain: 'pyme',
      },
    ]);
    const cache = makeFakeCache();
    const service = createCoverageGraphService({
      db: db as unknown as DbArg,
      cache: cache as unknown as CacheArg,
      logger,
      metrics,
    });

    await service.query('DMG', { insurer: 'BBVA' });

    const dbHitLog = entries.find((e) => e.event === 'graph_db_hit');
    expect(dbHitLog).toBeDefined();
    expect(dbHitLog?.rawName).toBe('DMG');
    expect(metrics.snapshot().counters['coverageGraph.hit|domain=pyme|source=db']).toBe(1);
  });

  it('logs graph_learned when a correction is learned', async () => {
    const db = makeFakeDb();
    const cache = makeFakeCache();
    const service = createCoverageGraphService({
      db: db as unknown as DbArg,
      cache: cache as unknown as CacheArg,
      logger,
      metrics,
    });

    await service.learnCorrection('Daño Material Global', 'incendio');

    const learnedLog = entries.find((e) => e.event === 'graph_learned');
    expect(learnedLog).toBeDefined();
    expect(learnedLog?.raw).toBe('Daño Material Global');
    expect(learnedLog?.canonical).toBe('incendio');
    expect(metrics.snapshot().counters['coverageGraph.learned|domain=pyme|insurer=global']).toBe(1);
  });

  it('logs graph_query_failed when the database query fails', async () => {
    const failingDb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB down' } })),
        })),
      })),
    };
    const cache = makeFakeCache();
    const service = createCoverageGraphService({
      db: failingDb as unknown as DbArg,
      cache: cache as unknown as CacheArg,
      logger,
      metrics,
    });

    const result = await service.query('Daño Material');

    expect(result.mappings).toEqual([]);
    const failLog = entries.find((e) => e.event === 'graph_query_failed');
    expect(failLog).toBeDefined();
    expect(failLog?.level).toBe('error');
    expect(metrics.snapshot().counters['coverageGraph.query_failed|domain=pyme']).toBe(1);
  });
});
