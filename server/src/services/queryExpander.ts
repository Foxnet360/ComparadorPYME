export interface ExpandedQuery {
  query: string;
  type: 'original' | 'synonym' | 'related' | 'insurer_variant';
  weight: number;
}

// Common term mappings for insurance
const TERM_MAPPINGS: Record<string, string[]> = {
  deducible: ['franquicia', 'participación', 'prorrata', 'copago'],
  franquicia: ['deducible', 'participación', 'prorrata'],
  incendio: ['fuego', 'combustión', 'explosión', 'amparo básico', 'daño material'],
  'amparo básico': ['todo riesgo', 'daño material', 'incendio', 'edificio'],
  'todo riesgo': ['amparo básico', 'daño material', 'pérdida o daño'],
  terremoto: ['sismo', 'temblor', 'catastrófico', 'evento natural'],
  sismo: ['terremoto', 'temblor', 'catastrófico'],
  hurto: ['sustracción', 'robo', 'asalto', 'mérchandise theft'],
  sustracción: ['hurto', 'robo', 'asalto'],
  'responsabilidad civil': ['rc', 'rce', 'daño a terceros', 'civil liability'],
  rce: ['responsabilidad civil', 'rc', 'daño a terceros'],
  'equipo eléctrico': ['equipo electrónico', 'eee', 'corto circuito', 'equipo'],
  'rotura de maquinaria': ['daño interno', 'rotura', 'máquina', 'avería'],
  'lucro cesante': ['pérdida de beneficios', 'interrupción de negocio', 'lucro'],
  asistencia: ['servicios', 'ayuda', 'soporte'],
  huelga: ['motín', 'asonada', 'hmacc', 'disturbio'],
  hmacc: ['huelga', 'motín', 'asonada', 'disturbio'],
  transporte: ['tránsito', 'mercancías', 'valores', 'envío'],
};

// Insurer-specific terminology variants
const INSURER_VARIANTS: Record<string, Record<string, string[]>> = {
  MAPFRE: {
    'amparo básico': ['todo riesgo daño material', 'amparo básico todo riesgo'],
    'daño material': ['pérdida o daño material'],
  },
  CHUBB: {
    'amparo básico': ['amparo básico todo riesgo de pérdida o daño material'],
    'todo riesgo': ['todo riesgo de pérdida o daño material'],
  },
  BBVA: {
    'todo riesgo': ['todo riesgo daños materiales'],
    'daño material': ['daños materiales'],
  },
  AXA: {
    incendio: ['inmuebles y mejoras locativas', 'muebles y enseres'],
  },
};

interface QueryExpander {
  expand(
    query: string,
    options?: {
      includeSynonyms?: boolean;
      includeRelated?: boolean;
      includeInsurerVariants?: boolean;
      insurerName?: string;
      maxExpansions?: number;
    }
  ): ExpandedQuery[];
  expandBatch(
    queries: string[],
    options?: Parameters<QueryExpander['expand']>[1]
  ): Map<string, ExpandedQuery[]>;
  getUniqueQueries(expansions: ExpandedQuery[]): string[];
  mergeResults<T extends { id: string; score?: number }>(
    results: Map<string, T[]>,
    expansions: ExpandedQuery[],
    maxResults?: number
  ): T[];
  getSynonyms(term: string): string[];
  getRelatedTerms(term: string): string[];
  getInsurerVariants(term: string, insurerName: string): string[];
}

export const queryExpander: QueryExpander = {
  /**
   * Expand a search query with synonyms and related terms
   */
  expand(
    query: string,
    options: {
      includeSynonyms?: boolean;
      includeRelated?: boolean;
      includeInsurerVariants?: boolean;
      insurerName?: string;
      maxExpansions?: number;
    } = {}
  ): ExpandedQuery[] {
    const {
      includeSynonyms = true,
      includeRelated = true,
      includeInsurerVariants = true,
      insurerName,
      maxExpansions = 10,
    } = options;

    console.log(`🔍 [QueryExpander] Expanding: "${query}"`);

    const expansions: ExpandedQuery[] = [{ query, type: 'original', weight: 1.0 }];

    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);

    // Find matching terms in mappings
    for (const [term, variants] of Object.entries(TERM_MAPPINGS)) {
      if (queryLower.includes(term)) {
        // Add synonyms
        if (includeSynonyms) {
          for (const variant of variants) {
            const expandedQuery = queryLower.replace(term, variant);
            if (
              expandedQuery !== queryLower &&
              !expansions.some((e) => e.query === expandedQuery)
            ) {
              expansions.push({
                query: expandedQuery,
                type: 'synonym',
                weight: 0.8,
              });
            }
          }
        }
      }
    }

    // Add insurer-specific variants
    if (includeInsurerVariants && insurerName) {
      const insurerUpper = insurerName.toUpperCase();
      const insurerTerms = INSURER_VARIANTS[insurerUpper];

      if (insurerTerms) {
        for (const [term, variants] of Object.entries(insurerTerms)) {
          if (queryLower.includes(term)) {
            for (const variant of variants) {
              const expandedQuery = queryLower.replace(term, variant);
              if (
                expandedQuery !== queryLower &&
                !expansions.some((e) => e.query === expandedQuery)
              ) {
                expansions.push({
                  query: expandedQuery,
                  type: 'insurer_variant',
                  weight: 0.9,
                });
              }
            }
          }
        }
      }
    }

    // Add combinations of individual word synonyms
    if (includeRelated) {
      for (const word of words) {
        const variants = TERM_MAPPINGS[word];
        if (variants) {
          for (const variant of variants) {
            const expandedQuery = queryLower.replace(word, variant);
            if (
              expandedQuery !== queryLower &&
              !expansions.some((e) => e.query === expandedQuery)
            ) {
              expansions.push({
                query: expandedQuery,
                type: 'related',
                weight: 0.6,
              });
            }
          }
        }
      }
    }

    // Limit to max expansions
    const limited = expansions.slice(0, maxExpansions + 1);

    console.log(`✅ [QueryExpander] Generated ${limited.length} variants`);
    return limited;
  },

  /**
   * Expand multiple queries for batch search
   */
  expandBatch(
    queries: string[],
    options: Parameters<QueryExpander['expand']>[1] = {}
  ): Map<string, ExpandedQuery[]> {
    const results = new Map<string, ExpandedQuery[]>();

    for (const query of queries) {
      results.set(query, this.expand(query, options));
    }

    return results;
  },

  /**
   * Get all unique queries from expansions for search execution
   */
  getUniqueQueries(expansions: ExpandedQuery[]): string[] {
    return [...new Set(expansions.map((e) => e.query))];
  },

  /**
   * Merge results from multiple expanded queries
   */
  mergeResults<T extends { id: string; score?: number }>(
    results: Map<string, T[]>,
    expansions: ExpandedQuery[],
    maxResults: number = 10
  ): T[] {
    const scored = new Map<string, { item: T; totalScore: number }>();

    for (const [query, items] of results) {
      const expansion = expansions.find((e) => e.query === query);
      const weight = expansion?.weight || 0.5;

      for (const item of items) {
        const existing = scored.get(item.id);
        const itemScore = (item.score || 0.5) * weight;

        if (existing) {
          existing.totalScore += itemScore;
        } else {
          scored.set(item.id, {
            item,
            totalScore: itemScore,
          });
        }
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, maxResults)
      .map((s) => ({
        ...s.item,
        score: s.totalScore,
      }));
  },

  /**
   * Get synonyms for a term
   */
  getSynonyms(term: string): string[] {
    const normalized = term.toLowerCase();
    return TERM_MAPPINGS[normalized] || [];
  },

  /**
   * Get related terms
   */
  getRelatedTerms(term: string): string[] {
    const normalized = term.toLowerCase();
    return TERM_MAPPINGS[normalized] || [];
  },

  /**
   * Get insurer-specific variants
   */
  getInsurerVariants(term: string, insurerName: string): string[] {
    const normalized = term.toLowerCase();
    const insurerKey = insurerName.toUpperCase() as keyof typeof INSURER_VARIANTS;
    return INSURER_VARIANTS[insurerKey]?.[normalized] || [];
  },
};

export default queryExpander;
