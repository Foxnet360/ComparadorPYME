import { SupabaseClient } from '@supabase/supabase-js';
import { loadDomainJson } from './domainBundleLoader';
import { TaxonomyBundle, OntologyBundle } from '../schemas/domainBundleSchema';
import { GraphEdge } from '../types/templateGraph';

const SEED_WEIGHT = 0.95;

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function compositeSlug(pattern: string): string {
  return pattern
    .split('|')[0]
    .replace(/\\s\+/g, '-')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

function findCanonicalId(raw: string, ontology: OntologyBundle): string | null {
  const normalizedRaw = normalizeKey(raw);

  for (const node of ontology.nodes) {
    if (normalizeKey(node.name) === normalizedRaw) {
      return node.id;
    }
    for (const alias of node.aliases) {
      if (normalizeKey(alias) === normalizedRaw) {
        return node.id;
      }
    }
  }

  return null;
}

function addEdge(
  edges: Map<string, GraphEdge>,
  edge: GraphEdge
): void {
  const key = `${edge.from}|${edge.to}|${edge.type}|${edge.insurer ?? ''}|${edge.domain ?? 'pyme'}`;
  edges.set(key, edge);
}

export function buildGraphEdgesFromDomain(domain: string): GraphEdge[] {
  const taxonomy = loadDomainJson<TaxonomyBundle>(domain, 'taxonomy.json');
  const ontology = loadDomainJson<OntologyBundle>(domain, 'ontology.json');

  const edges = new Map<string, GraphEdge>();

  // Ontology aliases and node names map to canonical node ids.
  for (const node of ontology.nodes) {
    const sources = new Set([node.name, ...node.aliases]);
    for (const source of sources) {
      addEdge(edges, {
        from: source,
        to: node.id,
        type: 'maps_to',
        weight: SEED_WEIGHT,
        domain,
      });
    }
  }

  // Taxonomy aliases also map to canonical ontology nodes.
  for (const category of taxonomy.categories) {
    const canonicalId = findCanonicalId(category.name, ontology);
    if (!canonicalId) {
      continue;
    }

    const sources = new Set([category.name, ...category.aliases]);
    for (const source of sources) {
      addEdge(edges, {
        from: source,
        to: canonicalId,
        type: 'maps_to',
        weight: SEED_WEIGHT,
        domain,
      });
    }
  }

  // Composite patterns decompose into implicit coverages.
  for (const pattern of ontology.compositePatterns) {
    const nodeId = `composite:${compositeSlug(pattern.pattern)}`;
    for (const component of pattern.components) {
      addEdge(edges, {
        from: nodeId,
        to: component,
        type: 'decomposes_to',
        weight: pattern.confidence,
        domain,
      });
    }
  }

  return Array.from(edges.values());
}

export async function seedCoverageGraph(
  db: SupabaseClient,
  domain: string,
  edges: GraphEdge[]
): Promise<void> {
  const rows = edges.map((edge) => ({
    from_node: edge.from,
    to_node: edge.to,
    edge_type: edge.type,
    weight: edge.weight,
    insurer: edge.insurer ?? '',
    correction_count: edge.correctionCount ?? 0,
    domain,
  }));

  const { error } = await db
    .from('coverage_graph_edges')
    .upsert(rows, {
      onConflict: 'from_node,to_node,edge_type,insurer,domain',
    });

  if (error) {
    throw new Error(`Failed to seed coverage graph: ${error.message}`);
  }
}
