/**
 * Coverage Graph Service
 * Probabilistic semantic graph for coverage mapping, composite decomposition,
 * deductible linking, and learning from analyst corrections.
 */

import { supabase } from '../config/database';
import { deleteCacheValue, getCacheValue, setCacheValue } from './cache/redisCache';

import { normalizeText } from '../utils/textUtils';
import {
  StructuredLogger,
  MetricCollector,
  createStructuredLogger,
  globalMetrics,
} from '../utils/structuredLogger';
import {
  GraphEdge,
  GraphEdgeType,
  GraphDeductibleLink,
  GraphQueryResult,
} from '../types/templateGraph';
import { validateGraphEdge } from '../schemas/templateRegistrySchema';
import { embeddingService } from './vector/embeddingService';

const LEARNED_BASE_WEIGHT = 0.7;
const LEARNED_INCREMENT = 0.02;
const MAX_LEARNED_WEIGHT = 0.99;
const DEFAULT_TOP_K = 5;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface GraphQueryOptions {
  insurer?: string;
  domain?: string;
  maxDepth?: number;
  topK?: number;
}

interface GraphDbClient {
  from(table: string): GraphTableBuilder;
}

interface GraphTableBuilder {
  select(columns: string): GraphFilterBuilder;
  upsert(values: unknown, options?: { onConflict?: string }): GraphFilterBuilder;
  update(values: unknown): GraphFilterBuilder;
  delete(): GraphFilterBuilder;
}

interface GraphFilterBuilder extends PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> {
  eq(column: string, value: unknown): GraphFilterBuilder;
  in(column: string, values: readonly unknown[]): GraphFilterBuilder;
}

export interface CoverageGraphService {
  query(
    rawName: string,
    options?: GraphQueryOptions
  ): Promise<GraphQueryResult & { rawName: string }>;
  queryDeductible(
    deductibleText: string,
    options?: GraphQueryOptions
  ): Promise<GraphDeductibleLink[]>;
  addEdge(edge: GraphEdge): Promise<void>;
  addEdges(edges: GraphEdge[]): Promise<void>;
  learnCorrection(raw: string, canonical: string, insurer?: string, domain?: string): Promise<void>;
  propagate(): Promise<void>;
  listEdges(filters: {
    from?: string;
    to?: string;
    type?: GraphEdgeType;
    insurer?: string;
    domain?: string;
  }): Promise<GraphEdge[]>;
  updateEdge(
    edge: Partial<GraphEdge> & {
      from: string;
      to: string;
      type: GraphEdgeType;
      insurer?: string;
      domain?: string;
    }
  ): Promise<void>;
  deleteEdge(
    from: string,
    to: string,
    type: GraphEdgeType,
    insurer?: string,
    domain?: string
  ): Promise<void>;
  invalidateCache(rawName: string, insurer?: string, domain?: string): Promise<void>;
}

interface DbEdge {
  id?: string;
  from_node: string;
  to_node: string;
  edge_type: GraphEdgeType;
  weight: number;
  insurer: string;
  correction_count: number;
  domain: string;
}

function normalizeNodeName(name: string): string {
  return normalizeText(name).trim();
}

function graphCacheKey(rawName: string, insurer: string, domain: string): string {
  return `graph:query:${domain}:${insurer || 'global'}:${Buffer.from(normalizeNodeName(rawName))
    .toString('base64')
    .substring(0, 32)}`;
}

function deductibleCacheKey(text: string, insurer: string, domain: string): string {
  return `graph:deductible:${domain}:${insurer || 'global'}:${Buffer.from(normalizeNodeName(text))
    .toString('base64')
    .substring(0, 32)}`;
}

function correctionBoost(correctionCount: number): number {
  return Math.min(MAX_LEARNED_WEIGHT, LEARNED_BASE_WEIGHT + LEARNED_INCREMENT * correctionCount);
}

function edgeConfidence(row: DbEdge, embeddingSim?: number): number {
  const base = Math.min(
    MAX_LEARNED_WEIGHT,
    row.weight + LEARNED_INCREMENT * (row.correction_count || 0)
  );
  if (embeddingSim !== undefined && !Number.isNaN(embeddingSim)) {
    return base * 0.95 + Math.min(Math.max(embeddingSim, 0), 1) * 0.05;
  }
  return base;
}

function toGraphEdge(row: DbEdge): GraphEdge {
  return {
    from: row.from_node,
    to: row.to_node,
    type: row.edge_type,
    weight: row.weight,
    correctionCount: row.correction_count,
    insurer: row.insurer || undefined,
    domain: row.domain || undefined,
  };
}

function fromGraphEdge(edge: GraphEdge): DbEdge {
  return {
    from_node: edge.from,
    to_node: edge.to,
    edge_type: edge.type,
    weight: edge.weight,
    insurer: edge.insurer ?? '',
    correction_count: edge.correctionCount ?? 0,
    domain: edge.domain ?? 'pyme',
  };
}

function isCanonicalNode(nodeId: string): boolean {
  return (
    nodeId.startsWith('cat:') ||
    (!nodeId.startsWith('raw:') && !nodeId.startsWith('alias:') && !nodeId.startsWith('composite:'))
  );
}

function stripPrefix(nodeId: string): string {
  return nodeId.replace(/^(raw:|alias:|cat:|composite:|deductible:)/, '');
}

function rowMatchesInsurer(row: DbEdge, insurer?: string): boolean {
  if (!insurer) return true;
  return (row.insurer ?? '') === '' || row.insurer === insurer;
}

function rankMappings(
  mappings: Map<string, { canonicalId: string; confidence: number; provenance: string }>
): GraphQueryResult['mappings'] {
  return Array.from(mappings.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, DEFAULT_TOP_K);
}

export function createCoverageGraphService(
  deps: {
    db?: GraphDbClient;
    cache?: {
      get: (key: string) => Promise<string | null>;
      setex: (key: string, ttl: number, value: string) => Promise<void>;
      del: (key: string) => Promise<void>;
    };
    logger?: StructuredLogger;
    metrics?: MetricCollector;
  } = {}
): CoverageGraphService {
  const db: GraphDbClient = deps.db ?? (supabase as unknown as GraphDbClient);
  const cache = deps.cache ?? {
    get: getCacheValue,
    setex: async (key: string, ttl: number, value: string) => setCacheValue(key, ttl, value),
    del: deleteCacheValue,
  };
  const logger = deps.logger ?? createStructuredLogger('coverageGraphService');
  const metrics = deps.metrics ?? globalMetrics;

  async function fetchEdges(where: {
    from?: string;
    to?: string;
    type?: GraphEdgeType | GraphEdgeType[];
    insurer?: string;
    domain?: string;
  }): Promise<DbEdge[]> {
    let query = db.from('coverage_graph_edges').select('*');

    if (where.from !== undefined) {
      query = query.eq('from_node', where.from);
    }
    if (where.to !== undefined) {
      query = query.eq('to_node', where.to);
    }
    if (where.type !== undefined) {
      if (Array.isArray(where.type)) {
        query = query.in('edge_type', where.type);
      } else {
        query = query.eq('edge_type', where.type);
      }
    }
    if (where.domain !== undefined) {
      query = query.eq('domain', where.domain);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('graph_query_failed', 'Coverage graph DB query failed', {
        table: 'coverage_graph_edges',
        error: error.message ?? String(error),
      });
      metrics.increment('coverageGraph.query_failed');
      return [];
    }

    const rows = (data ?? []) as DbEdge[];
    if (where.insurer !== undefined) {
      return rows.filter((r) => rowMatchesInsurer(r, where.insurer));
    }
    return rows;
  }

  async function fetchAllEdges(domain: string): Promise<DbEdge[]> {
    const { data, error } = await db.from('coverage_graph_edges').select('*').eq('domain', domain);
    if (error) {
      logger.error('graph_query_failed', 'Failed to load coverage graph edges', {
        domain,
        error: error.message ?? String(error),
      });
      metrics.increment('coverageGraph.query_failed', { domain });
      return [];
    }
    return (data ?? []) as DbEdge[];
  }

  async function computeEmbeddingSimilarity(
    raw: string,
    canonicalId: string
  ): Promise<number | undefined> {
    try {
      const [rawEmbedding, canonicalEmbedding] = await Promise.all([
        embeddingService.generateEmbedding(raw),
        embeddingService.generateEmbedding(canonicalId),
      ]);
      return embeddingService.cosineSimilarity(rawEmbedding, canonicalEmbedding);
    } catch (_e) {
      return undefined;
    }
  }

  async function queryInternal(
    rawName: string,
    options: GraphQueryOptions
  ): Promise<GraphQueryResult> {
    const domain = options.domain ?? 'pyme';
    const insurer = options.insurer ?? '';
    const normalizedRaw = normalizeNodeName(rawName);

    if (!normalizedRaw) {
      return { mappings: [], composite: false };
    }

    const allDomainEdges = await fetchAllEdges(domain);
    const mappings = new Map<
      string,
      { canonicalId: string; confidence: number; provenance: string }
    >();
    const visitedCompositeNodes = new Set<string>();
    const components = new Set<string>();

    // Step 1: Direct edges from normalized raw term to canonical targets.
    const directTypes: GraphEdgeType[] = ['maps_to', 'alias_of', 'learned', 'alias'];
    const directEdges = allDomainEdges.filter(
      (e) =>
        normalizeNodeName(e.from_node) === normalizedRaw &&
        directTypes.includes(e.edge_type) &&
        rowMatchesInsurer(e, insurer)
    );

    for (const edge of directEdges) {
      const target = edge.to_node;
      if (isCanonicalNode(target) || target.startsWith('cat:')) {
        const canonicalId = stripPrefix(target);
        const embeddingSim = await computeEmbeddingSimilarity(rawName, canonicalId);
        const confidence = edgeConfidence(edge, embeddingSim);
        const existing = mappings.get(canonicalId);
        if (!existing || existing.confidence < confidence) {
          mappings.set(canonicalId, {
            canonicalId,
            confidence,
            provenance: edge.edge_type,
          });
        }
      }
    }

    // Step 2: Short indirect paths through alias/intermediate nodes (depth 2).
    const aliasEdges = allDomainEdges.filter(
      (e) =>
        normalizeNodeName(e.from_node) === normalizedRaw &&
        ['alias_of', 'alias'].includes(e.edge_type) &&
        rowMatchesInsurer(e, insurer)
    );

    for (const aliasEdge of aliasEdges) {
      const intermediate = aliasEdge.to_node;
      const secondEdges = allDomainEdges.filter(
        (e) =>
          normalizeNodeName(e.from_node) === normalizeNodeName(intermediate) &&
          ['maps_to', 'alias_of', 'learned', 'alias'].includes(e.edge_type) &&
          rowMatchesInsurer(e, insurer)
      );
      for (const second of secondEdges) {
        const target = second.to_node;
        const canonicalId = stripPrefix(target);
        const pathWeight = aliasEdge.weight * second.weight;
        const count = Math.max(aliasEdge.correction_count, second.correction_count);
        const embeddingSim = await computeEmbeddingSimilarity(rawName, canonicalId);
        const confidence = edgeConfidence(
          { ...second, weight: pathWeight, correction_count: count },
          embeddingSim
        );
        const existing = mappings.get(canonicalId);
        if (!existing || existing.confidence < confidence) {
          mappings.set(canonicalId, {
            canonicalId,
            confidence,
            provenance: `${aliasEdge.edge_type}->${second.edge_type}`,
          });
        }
      }
    }

    // Step 3: Composite decomposition.
    const compositeEntryEdges = allDomainEdges.filter(
      (e) =>
        normalizeNodeName(e.from_node) === normalizedRaw &&
        e.edge_type === 'maps_to' &&
        e.to_node.startsWith('composite:') &&
        rowMatchesInsurer(e, insurer)
    );

    for (const entryEdge of compositeEntryEdges) {
      const compositeNode = entryEdge.to_node;
      if (visitedCompositeNodes.has(compositeNode)) continue;
      visitedCompositeNodes.add(compositeNode);

      const decompositionEdges = allDomainEdges.filter(
        (e) =>
          e.from_node === compositeNode &&
          e.edge_type === 'decomposes_to' &&
          rowMatchesInsurer(e, insurer)
      );

      for (const decomp of decompositionEdges) {
        const canonicalId = stripPrefix(decomp.to_node);
        components.add(canonicalId);
        const embeddingSim = await computeEmbeddingSimilarity(rawName, canonicalId);
        const confidence = edgeConfidence(
          { ...decomp, weight: entryEdge.weight * decomp.weight },
          embeddingSim
        );
        const existing = mappings.get(canonicalId);
        if (!existing || existing.confidence < confidence) {
          mappings.set(canonicalId, {
            canonicalId,
            confidence,
            provenance: 'decomposes_to',
          });
        }
      }
    }

    // Step 4: Direct decomposes_to from raw term (composite node named after raw term).
    const directDecomposeEdges = allDomainEdges.filter(
      (e) =>
        normalizeNodeName(e.from_node) === normalizedRaw &&
        e.edge_type === 'decomposes_to' &&
        rowMatchesInsurer(e, insurer)
    );
    for (const decomp of directDecomposeEdges) {
      const canonicalId = stripPrefix(decomp.to_node);
      components.add(canonicalId);
      const embeddingSim = await computeEmbeddingSimilarity(rawName, canonicalId);
      const confidence = edgeConfidence(decomp, embeddingSim);
      const existing = mappings.get(canonicalId);
      if (!existing || existing.confidence < confidence) {
        mappings.set(canonicalId, {
          canonicalId,
          confidence,
          provenance: 'decomposes_to',
        });
      }
    }

    return {
      mappings: rankMappings(mappings),
      composite: components.size > 0,
      components: components.size > 0 ? Array.from(components) : undefined,
    };
  }

  async function invalidateCache(
    rawName: string,
    insurer?: string,
    domain?: string
  ): Promise<void> {
    const queryKey = graphCacheKey(rawName, insurer ?? '', domain ?? 'pyme');
    const deductibleKey = deductibleCacheKey(rawName, insurer ?? '', domain ?? 'pyme');
    await cache.del(queryKey);
    await cache.del(deductibleKey);
  }

  return {
    async query(
      rawName: string,
      options: GraphQueryOptions = {}
    ): Promise<GraphQueryResult & { rawName: string }> {
      const domain = options.domain ?? 'pyme';
      const insurer = options.insurer ?? '';
      const key = graphCacheKey(rawName, insurer, domain);

      const cached = await cache.get(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.mappings)) {
            logger.info('graph_hit', 'Coverage graph query resolved from cache', {
              rawName,
              domain,
              insurer: insurer || undefined,
              source: 'cache',
              mappingCount: parsed.mappings.length,
            });
            metrics.increment('coverageGraph.hit', { source: 'cache', domain });
            return { ...parsed, rawName } as GraphQueryResult & { rawName: string };
          }
        } catch {
          // Ignore malformed cache entries.
        }
      }

      const result = await queryInternal(rawName, options);
      await cache.setex(key, CACHE_TTL_SECONDS, JSON.stringify(result));

      if (result.mappings.length === 0) {
        logger.info('graph_cold_start_miss', 'No coverage graph mappings found', {
          rawName,
          domain,
          insurer: insurer || undefined,
        });
        metrics.increment('coverageGraph.cold_start_miss', { domain });
      } else {
        logger.info('graph_db_hit', 'Coverage graph query resolved from database', {
          rawName,
          domain,
          insurer: insurer || undefined,
          source: 'db',
          mappingCount: result.mappings.length,
        });
        metrics.increment('coverageGraph.hit', { source: 'db', domain });
      }

      return { ...result, rawName };
    },

    async queryDeductible(
      deductibleText: string,
      options: GraphQueryOptions = {}
    ): Promise<GraphDeductibleLink[]> {
      const domain = options.domain ?? 'pyme';
      const insurer = options.insurer ?? '';
      const key = deductibleCacheKey(deductibleText, insurer, domain);

      const cached = await cache.get(key);
      if (cached) {
        try {
          return JSON.parse(cached) as GraphDeductibleLink[];
        } catch {
          // Ignore malformed cache entries.
        }
      }

      const normalizedText = normalizeNodeName(deductibleText);
      const deductibleRows = await fetchEdges({
        from: normalizedText,
        type: 'deductible_for',
        domain,
      });
      const appliesRows = await fetchEdges({
        from: normalizedText,
        type: 'applies_to',
        domain,
      });

      const rows = [...deductibleRows, ...appliesRows];

      const filtered = rows.filter((r) => rowMatchesInsurer(r, insurer));
      const specificRows = filtered.filter((r) => r.insurer === insurer);
      const rowsToUse = specificRows.length > 0 ? specificRows : filtered;

      const specificFirst = rowsToUse.sort((a, b) => b.weight - a.weight);

      const result: GraphDeductibleLink[] = specificFirst.map((row) => ({
        deductibleText: row.from_node,
        appliesTo: stripPrefix(row.to_node),
        confidence: edgeConfidence(row),
      }));

      await cache.setex(key, CACHE_TTL_SECONDS, JSON.stringify(result));
      return result;
    },

    async addEdge(edge: GraphEdge): Promise<void> {
      const validation = validateGraphEdge(edge);
      if (!validation.success) {
        throw new Error(`Invalid graph edge: ${validation.error?.message ?? 'unknown'}`);
      }

      const row = fromGraphEdge(edge);
      const { error } = await db.from('coverage_graph_edges').upsert(row, {
        onConflict: 'from_node,to_node,edge_type,insurer,domain',
      });

      if (error) {
        throw new Error(`Failed to add graph edge: ${error.message}`);
      }

      await invalidateCache(edge.from, edge.insurer, edge.domain);
    },

    async addEdges(edges: GraphEdge[]): Promise<void> {
      const rows = edges.map((edge) => {
        const validation = validateGraphEdge(edge);
        if (!validation.success) {
          throw new Error(`Invalid graph edge: ${validation.error?.message ?? 'unknown'}`);
        }
        return fromGraphEdge(edge);
      });

      if (rows.length === 0) return;

      const { error } = await db.from('coverage_graph_edges').upsert(rows, {
        onConflict: 'from_node,to_node,edge_type,insurer,domain',
      });

      if (error) {
        throw new Error(`Failed to add graph edges: ${error.message}`);
      }

      for (const edge of edges) {
        await invalidateCache(edge.from, edge.insurer, edge.domain);
      }
    },

    async learnCorrection(
      raw: string,
      canonical: string,
      insurer?: string,
      domain?: string
    ): Promise<void> {
      const normalizedRaw = normalizeNodeName(raw);
      const canonicalId = stripPrefix(canonical);

      const existingRows = await fetchEdges({
        from: normalizedRaw,
        to: canonicalId,
        type: 'learned',
        insurer,
        domain,
      });

      const existing = existingRows[0];
      const correctionCount = (existing?.correction_count ?? 0) + 1;
      const weight = correctionBoost(correctionCount);

      const row = {
        from_node: normalizedRaw,
        to_node: canonicalId,
        edge_type: 'learned' as const,
        weight,
        insurer: insurer ?? '',
        correction_count: correctionCount,
        domain: domain ?? 'pyme',
      };

      const { error } = await db.from('coverage_graph_edges').upsert(row, {
        onConflict: 'from_node,to_node,edge_type,insurer,domain',
      });

      if (error) {
        throw new Error(`Failed to learn correction: ${error.message}`);
      }

      logger.info('graph_learned', 'Coverage graph learned from analyst correction', {
        raw,
        canonical,
        normalizedRaw,
        canonicalId,
        insurer: insurer || undefined,
        domain: domain ?? 'pyme',
        correctionCount,
        weight,
      });
      metrics.increment('coverageGraph.learned', {
        domain: domain ?? 'pyme',
        insurer: insurer || 'global',
      });

      await invalidateCache(raw, insurer, domain);
    },

    async propagate(): Promise<void> {
      const { data, error } = await db
        .from('coverage_graph_edges')
        .select('*')
        .eq('edge_type', 'learned');

      if (error) {
        throw new Error(`Failed to propagate graph: ${error.message}`);
      }

      const rows = (data ?? []) as DbEdge[];
      const updates = rows.map((row) => ({
        ...row,
        weight: correctionBoost(row.correction_count),
      }));

      if (updates.length === 0) return;

      const { error: upsertError } = await db.from('coverage_graph_edges').upsert(updates, {
        onConflict: 'from_node,to_node,edge_type,insurer,domain',
      });

      if (upsertError) {
        throw new Error(`Failed to update propagated weights: ${upsertError.message}`);
      }
    },

    async listEdges(filters): Promise<GraphEdge[]> {
      const rows = await fetchEdges({
        from: filters.from,
        to: filters.to,
        type: filters.type,
        insurer: filters.insurer,
        domain: filters.domain,
      });
      return rows.map(toGraphEdge);
    },

    async updateEdge(edge): Promise<void> {
      const row: Partial<DbEdge> = {};
      if (edge.weight !== undefined) row.weight = edge.weight;
      if (edge.correctionCount !== undefined) row.correction_count = edge.correctionCount;
      if (edge.insurer !== undefined) row.insurer = edge.insurer;

      const { error } = await db
        .from('coverage_graph_edges')
        .update(row)
        .eq('from_node', edge.from)
        .eq('to_node', edge.to)
        .eq('edge_type', edge.type)
        .eq('insurer', edge.insurer ?? '')
        .eq('domain', edge.domain ?? 'pyme');

      if (error) {
        throw new Error(`Failed to update graph edge: ${error.message}`);
      }

      await invalidateCache(edge.from, edge.insurer, edge.domain);
    },

    async deleteEdge(from, to, type, insurer?, domain?): Promise<void> {
      const { error } = await db
        .from('coverage_graph_edges')
        .delete()
        .eq('from_node', from)
        .eq('to_node', to)
        .eq('edge_type', type)
        .eq('insurer', insurer ?? '')
        .eq('domain', domain ?? 'pyme');

      if (error) {
        throw new Error(`Failed to delete graph edge: ${error.message}`);
      }

      await invalidateCache(from, insurer, domain);
    },

    invalidateCache,
  };
}

export const coverageGraphService = createCoverageGraphService();

export default coverageGraphService;
