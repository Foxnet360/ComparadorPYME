/**
 * Coverage Normalizer Service
 * Maps raw extracted coverages to 14 canonical PYME categories
 */

import { semanticMatcher } from './semanticMatcher';
import { thesaurusService } from './normalization/thesaurusService';
import { normalizeText } from '../utils/textUtils';
import { levenshteinDistance } from '../utils/stringUtils';
import { groupUncategorizedCoverages } from './semanticGrouper';
import { coverageOntology, CoverageMapping } from './coverageOntology';
import { featureFlags } from '../config/featureFlags';
import { pdfExtractor } from './pdfExtractor';
import { coverageGraphService } from './coverageGraphService';

export type CoverageStatus = 'present' | 'missing' | 'excluded';

export interface CanonicalCoverage {
  name: string;
  status: CoverageStatus;
  insuredAmount: number | null;
  deductible: string | null;
  premium: number | null;
  confidence: number;
  graphConfidence: number | null;
  rawNames: string[];
  matchMethod:
    | 'exact'
    | 'fuzzy'
    | 'embedding'
    | 'llm'
    | 'implicit'
    | 'derived'
    | 'semantic-group'
    | 'ontology'
    | 'ontology-composite'
    | 'graph'
    | null;
  needsReview: boolean;
  notes?: string;
  categoryId?: number | string | null;
  rawTextSnippet?: string;
  pageNumber?: number | null;
}

export interface RawCoverage {
  section?: string | null;
  rawName: string;
  insuredAmount?: number | null;
  deductible?: string | null;
  premium?: number | null;
  notes?: string | null;
  rawTextSnippet?: string;
  pageNumber?: number | null;
}

export interface InsuredAsset {
  assetType: string;
  value: number;
  notes?: string | null;
}

export interface GeneralDeductible {
  appliesTo: string;
  deductibleText: string;
}

export interface NormalizationResult {
  canonicalCoverages: CanonicalCoverage[];
  uncategorizedCoverages?: CanonicalCoverage[];
  missingCoverages: string[];
  needsReview: boolean;
  totalConfidence: number;
  generalDeductibles?: Array<{ appliesTo: string; deductibleText: string }>;
}

// Asset type mapping to canonical coverage
const ASSET_TO_COVERAGE: Record<string, string> = {
  EDIFICIOS: 'Incendio (Edificio y Contenidos)',
  INMUEBLES: 'Incendio (Edificio y Contenidos)',
  CONTENIDOS: 'Incendio (Edificio y Contenidos)',
  MUEBLES: 'Incendio (Edificio y Contenidos)',
  MERCANCIAS: 'Incendio (Edificio y Contenidos)',
  EXISTENCIAS: 'Incendio (Edificio y Contenidos)',
  'EQUIPO ELECTRICO': 'Equipo Eléctrico y Electrónico',
  'EQUIPO ELECTRÓNICO': 'Equipo Eléctrico y Electrónico',
  EEE: 'Equipo Eléctrico y Electrónico',
  MAQUINARIA: 'Rotura de Maquinaria',
  'MAQUINARIA Y EQUIPO': 'Rotura de Maquinaria',
  DINERO: 'Sustracción / Hurto',
  VALORES: 'Sustracción / Hurto',
  'LUCRO CESANTE': 'Lucro Cesante',
  LUCRO: 'Lucro Cesante',
};

// Implicit coverage detection
const IMPLICIT_COVERAGE_PATTERNS: Array<{
  pattern: RegExp;
  coverages: string[];
}> = [
  {
    pattern: /AMPARO\s+BÁSICO|TODO\s+RIESGO\s+DAÑO\s+MATERIAL/i,
    coverages: [
      'Incendio (Edificio y Contenidos)',
      'Terremoto y Eventos Catastróficos',
      'Huelga, Motín, Asonada (HMACC)',
    ],
  },
  {
    pattern: /SECCION\s+PRIMERA|AMPARO\s+BASICO/i,
    coverages: [
      'Incendio (Edificio y Contenidos)',
      'Terremoto y Eventos Catastróficos',
      'Sustracción / Hurto',
    ],
  },
  {
    pattern: /RESPONSABILIDAD\s+CIVIL|RC\s+EXTRACONTRACTUAL/i,
    coverages: ['Responsabilidad Civil (RCE)'],
  },
];

/**
 * Map raw coverage to canonical using 4-layer matching
 * When semantic ontology is enabled, uses probabilistic mappings
 */
export async function mapRawToCanonical(
  rawName: string,
  domain?: string,
  insurer?: string
): Promise<{
  canonicalName: string | null;
  confidence: number;
  graphConfidence: number | null;
  method: 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'ontology' | 'graph' | null;
}> {
  return mapRawToCanonicalWithInsurer(rawName, domain, insurer);
}

async function mapRawToCanonicalWithInsurer(
  rawName: string,
  domain?: string,
  insurer?: string
): Promise<{
  canonicalName: string | null;
  confidence: number;
  graphConfidence: number | null;
  method: 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'ontology' | 'graph' | null;
}> {
  if (!rawName || rawName.trim().length === 0) {
    return { canonicalName: null, confidence: 0, graphConfidence: null, method: null };
  }

  const d = domain ?? 'pyme';

  // Semantic ontology mode (new architecture)
  if (
    featureFlags.isEnabled('semanticCoverageOntology') &&
    !featureFlags.isEnabled('useLegacyCoverageMatcher')
  ) {
    const ontologyResult = await mapWithOntology(rawName, d, insurer);
    if (ontologyResult) {
      return ontologyResult;
    }
  }

  // Layer 1: Thesaurus exact match
  const thesaurusResult = await matchByThesaurusExact(rawName, d);
  if (thesaurusResult) {
    return {
      canonicalName: thesaurusResult,
      confidence: 100,
      graphConfidence: null,
      method: 'exact',
    };
  }

  // Layer 2: Fuzzy match
  const fuzzyResult = matchByFuzzy(rawName, d);
  if (fuzzyResult && fuzzyResult.confidence >= 80) {
    return {
      canonicalName: fuzzyResult.canonicalName,
      confidence: fuzzyResult.confidence,
      graphConfidence: null,
      method: 'fuzzy',
    };
  }

  // Layer 3: Embedding match (using existing semanticMatcher)
  const semanticResult = await semanticMatcher.matchCoverage(rawName, d);
  if (semanticResult && semanticResult.confidence >= 0.85) {
    return {
      canonicalName: semanticResult.canonicalName,
      confidence: Math.round(semanticResult.confidence * 100),
      graphConfidence: null,
      method: 'embedding',
    };
  }

  // Layer 4: LLM fallback (using semanticMatcher's LLM layer)
  const llmResult = await semanticMatcher.matchCoverage(rawName, d);
  if (llmResult && llmResult.confidence >= 0.7) {
    return {
      canonicalName: llmResult.canonicalName,
      confidence: Math.round(llmResult.confidence * 100),
      graphConfidence: null,
      method: 'llm',
    };
  }

  // Layer 5: Coverage semantic graph fallback
  if (featureFlags.isEnabled('useTemplateGraphPipeline')) {
    try {
      const graphResult = await coverageGraphService.query(rawName, { domain: d, insurer });
      if (graphResult.mappings.length > 0) {
        const best = graphResult.mappings[0];
        const confidence = Math.round(best.confidence * 100);
        if (confidence >= 50) {
          let canonicalName = best.canonicalId;
          // Graph may return numeric category ids; resolve to canonical name
          const numericId = parseInt(best.canonicalId, 10);
          if (!Number.isNaN(numericId) && numericId > 0) {
            const resolvedName = semanticMatcher.getCategoryName(numericId, d);
            if (resolvedName) canonicalName = resolvedName;
          }
          return {
            canonicalName,
            confidence,
            graphConfidence: confidence,
            method: 'graph',
          };
        }
      }
    } catch (error) {
      console.warn('⚠️ [CoverageNormalizer] Graph fallback failed:', error);
    }
  }

  return { canonicalName: null, confidence: 0, graphConfidence: null, method: null };
}

/**
 * Batch version of mapRawToCanonical for improved performance
 * Uses semanticMatcher.normalizeBatch with cache + batch embeddings
 */
export async function mapRawToCanonicalBatch(
  rawNames: string[],
  domain?: string,
  insurer?: string
): Promise<
  Array<{
    canonicalName: string | null;
    confidence: number;
    graphConfidence: number | null;
    method: 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'ontology' | 'thesaurus' | 'graph' | null;
  }>
> {
  const startTime = Date.now();
  const d = domain ?? 'pyme';

  // Filter out empty names
  const validIndices = rawNames
    .map((name, index) => ({ name, index }))
    .filter((item) => item.name && item.name.trim().length > 0);

  if (validIndices.length === 0) {
    return rawNames.map(() => ({
      canonicalName: null,
      confidence: 0,
      graphConfidence: null,
      method: null,
    }));
  }

  const results = new Array(rawNames.length).fill(null).map(() => ({
    canonicalName: null as string | null,
    confidence: 0,
    graphConfidence: null as number | null,
    method: null as
      | 'exact'
      | 'fuzzy'
      | 'embedding'
      | 'llm'
      | 'ontology'
      | 'thesaurus'
      | 'graph'
      | null,
  }));

  // Separate names that can be resolved without embeddings (thesaurus/fuzzy)
  const namesNeedingEmbeddings: string[] = [];
  const embeddingIndices: number[] = [];

  for (const { name, index } of validIndices) {
    // Check thesaurus exact match first
    const thesaurusResult = await matchByThesaurusExact(name, d);
    if (thesaurusResult) {
      results[index] = {
        canonicalName: thesaurusResult,
        confidence: 100,
        graphConfidence: null,
        method: 'exact',
      };
      continue;
    }

    // Check fuzzy match
    const fuzzyResult = matchByFuzzy(name, d);
    if (fuzzyResult && fuzzyResult.confidence >= 80) {
      results[index] = {
        canonicalName: fuzzyResult.canonicalName,
        confidence: fuzzyResult.confidence,
        graphConfidence: null,
        method: 'fuzzy',
      };
      continue;
    }

    // Needs embedding - add to batch
    namesNeedingEmbeddings.push(name);
    embeddingIndices.push(index);
  }

  console.log(
    `🧠 [CoverageNormalizer] Batch: ${validIndices.length - namesNeedingEmbeddings.length}/${validIndices.length} resolved by thesaurus/fuzzy`
  );

  // Process embeddings in batch using semanticMatcher
  if (namesNeedingEmbeddings.length > 0) {
    try {
      const batchResults = await semanticMatcher.normalizeBatch(namesNeedingEmbeddings, d);

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const originalIndex = embeddingIndices[i];

        if (result && result.canonicalName && result.confidence >= 0.7) {
          results[originalIndex] = {
            canonicalName: result.canonicalName,
            confidence: Math.round(result.confidence * 100),
            graphConfidence: null,
            method: result.method || 'embedding',
          };
        } else {
          // LLM fallback
          const llmResult = await semanticMatcher.matchCoverage(namesNeedingEmbeddings[i], d);
          if (llmResult && llmResult.canonicalName && llmResult.confidence >= 0.7) {
            results[originalIndex] = {
              canonicalName: llmResult.canonicalName,
              confidence: Math.round(llmResult.confidence * 100),
              graphConfidence: null,
              method: 'llm',
            };
          }
        }
      }

      console.log(`✅ [CoverageNormalizer] Batch complete in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`❌ [CoverageNormalizer] Batch processing failed:`, error);
      // Fallback to individual processing
      for (let i = 0; i < namesNeedingEmbeddings.length; i++) {
        const singleResult = await mapRawToCanonical(namesNeedingEmbeddings[i], d, insurer);
        results[embeddingIndices[i]] = singleResult;
      }
    }
  }

  // Graph fallback for unresolved names
  if (featureFlags.isEnabled('useTemplateGraphPipeline')) {
    for (let i = 0; i < results.length; i++) {
      if (!results[i].canonicalName) {
        try {
          const graphResult = await coverageGraphService.query(rawNames[i], { domain: d, insurer });
          if (graphResult.mappings.length > 0) {
            const best = graphResult.mappings[0];
            const confidence = Math.round(best.confidence * 100);
            if (confidence >= 50) {
              let canonicalName = best.canonicalId;
              const numericId = parseInt(best.canonicalId, 10);
              if (!Number.isNaN(numericId) && numericId > 0) {
                const resolvedName = semanticMatcher.getCategoryName(numericId, d);
                if (resolvedName) canonicalName = resolvedName;
              }
              results[i] = {
                canonicalName,
                confidence,
                graphConfidence: confidence,
                method: 'graph',
              };
            }
          }
        } catch (error) {
          console.warn('⚠️ [CoverageNormalizer] Batch graph fallback failed:', error);
        }
      }
    }
  }

  return results;
}

/**
 * Match by thesaurus exact match
 */
async function matchByThesaurusExact(
  rawName: string,
  domain: string = 'pyme'
): Promise<string | null> {
  const normalized = normalizeText(rawName);
  const categories = semanticMatcher.getAllCategories(domain);

  for (const category of categories) {
    // Check canonical name
    if (normalizeText(category.name) === normalized) {
      return category.name;
    }

    // Check thesaurus synonyms
    const definition = thesaurusService.getCoberturaDefinition(category.name, domain);
    if (definition) {
      const allTerms = [...definition.sinonimos, ...definition.terminos_busqueda];
      for (const term of allTerms) {
        if (normalizeText(term) === normalized) {
          return category.name;
        }
      }
    }
  }

  return null;
}

/**
 * Match by fuzzy similarity
 */
function matchByFuzzy(
  rawName: string,
  domain: string = 'pyme'
): { canonicalName: string; confidence: number } | null {
  const normalized = normalizeText(rawName);
  let bestMatch: { canonicalName: string; confidence: number } | null = null;
  const categories = semanticMatcher.getAllCategories(domain);

  for (const category of categories) {
    const distance = levenshteinDistance(normalized, normalizeText(category.name));
    const maxLength = Math.max(normalized.length, category.name.length);
    const similarity = maxLength > 0 ? (1 - distance / maxLength) * 100 : 0;

    if (similarity >= 80 && (!bestMatch || similarity > bestMatch.confidence)) {
      bestMatch = { canonicalName: category.name, confidence: similarity };
    }
  }

  return bestMatch;
}

/**
 * Map coverage using semantic ontology (probabilistic)
 * Returns best match or null if ontology unavailable
 */
async function mapWithOntology(
  rawName: string,
  domain: string = 'pyme',
  insurer?: string
): Promise<{
  canonicalName: string;
  confidence: number;
  graphConfidence: number | null;
  method: 'ontology';
} | null> {
  try {
    const mapping = await coverageOntology.mapCoverage(rawName, insurer, domain);

    if (mapping.groups.length === 0) {
      return null;
    }

    // Get best match
    const best = mapping.groups[0];
    const node = coverageOntology.getNodeById(best.groupId);

    if (!node) {
      return null;
    }

    // Save mapping for learning
    await coverageOntology.saveMapping(mapping);

    return {
      canonicalName: node.name,
      confidence: Math.round(best.confidence * 100),
      graphConfidence: null,
      method: 'ontology',
    };
  } catch (error) {
    console.warn('⚠️ [CoverageNormalizer] Ontology mapping failed:', error);
    return null;
  }
}

/**
 * Resolve deductibles (specific → general)
 */
export function resolveDeductibles(
  rawCoverages: RawCoverage[],
  generalDeductibles: GeneralDeductible[]
): RawCoverage[] {
  return rawCoverages.map((coverage) => {
    if (coverage.deductible && coverage.deductible.trim().length > 0) {
      return coverage;
    }

    // Search for general deductible that applies
    const general = generalDeductibles.find((gd) => {
      const appliesToUpper = gd.appliesTo.toUpperCase();
      const sectionUpper = (coverage.section || '').toUpperCase();
      const nameUpper = coverage.rawName.toUpperCase();

      return (
        sectionUpper.includes(appliesToUpper) ||
        nameUpper.includes(appliesToUpper) ||
        appliesToUpper.includes(sectionUpper) ||
        appliesToUpper.includes(nameUpper)
      );
    });

    if (general) {
      return { ...coverage, deductible: general.deductibleText };
    }

    return coverage;
  });
}

/**
 * Derive insured amounts from assets
 */
export function deriveInsuredAmounts(
  rawCoverages: RawCoverage[],
  insuredAssets: InsuredAsset[]
): RawCoverage[] {
  return rawCoverages.map((coverage) => {
    if (coverage.insuredAmount && coverage.insuredAmount > 0) {
      return coverage;
    }

    // Try to derive from assets
    const canonicalName = coverage.rawName.toUpperCase();
    let derivedAmount: number | undefined;

    // Check asset mapping
    for (const [assetType, coverageName] of Object.entries(ASSET_TO_COVERAGE)) {
      if (
        canonicalName.includes(coverageName.toUpperCase()) ||
        coverageName.toUpperCase().includes(canonicalName)
      ) {
        const matchingAssets = insuredAssets.filter(
          (a) =>
            a.assetType.toUpperCase().includes(assetType) ||
            assetType.includes(a.assetType.toUpperCase())
        );
        if (matchingAssets.length > 0) {
          derivedAmount = matchingAssets.reduce((sum, a) => sum + a.value, 0);
          break;
        }
      }
    }

    // Special cases
    if (!derivedAmount) {
      if (canonicalName.includes('INCENDIO') || canonicalName.includes('DAÑO MATERIAL')) {
        const buildingAssets = insuredAssets.filter((a) =>
          ['EDIFICIOS', 'INMUEBLES', 'CONTENIDOS', 'MUEBLES'].some((t) =>
            a.assetType.toUpperCase().includes(t)
          )
        );
        if (buildingAssets.length > 0) {
          derivedAmount = buildingAssets.reduce((sum, a) => sum + a.value, 0);
        }
      }
    }

    if (derivedAmount) {
      return {
        ...coverage,
        insuredAmount: derivedAmount,
        notes: `${coverage.notes || ''} [Derivado de bienes asegurables]`.trim(),
      };
    }

    return coverage;
  });
}

/**
 * Detect implicit coverages from broad coverage patterns and graph decomposition rules
 */
export async function detectImplicitCoverages(
  rawCoverages: RawCoverage[],
  domain?: string,
  insurer?: string
): Promise<Array<{ rawName: string; canonicalName: string; confidence: number }>> {
  const implicit: Array<{ rawName: string; canonicalName: string; confidence: number }> = [];

  for (const raw of rawCoverages) {
    const nameUpper = raw.rawName.toUpperCase();

    // Static patterns
    for (const pattern of IMPLICIT_COVERAGE_PATTERNS) {
      if (pattern.pattern.test(nameUpper)) {
        for (const coverageName of pattern.coverages) {
          // Check if not already explicitly present
          const alreadyPresent = rawCoverages.some((r) => {
            const mapped = mapRawToCanonicalSync(r.rawName, domain ?? 'pyme');
            return mapped === coverageName;
          });

          if (!alreadyPresent) {
            implicit.push({
              rawName: raw.rawName,
              canonicalName: coverageName,
              confidence: 50,
            });
          }
        }
      }
    }

    // Graph composite decomposition
    if (featureFlags.isEnabled('useTemplateGraphPipeline')) {
      try {
        const graphResult = await coverageGraphService.query(raw.rawName, {
          domain: domain ?? 'pyme',
          insurer,
        });
        if (graphResult.composite && graphResult.components) {
          for (const componentId of graphResult.components) {
            const componentName =
              semanticMatcher.getCategoryName(parseInt(componentId, 10), domain ?? 'pyme') ??
              componentId;

            const alreadyPresent = rawCoverages.some((r) => {
              const mapped = mapRawToCanonicalSync(r.rawName, domain ?? 'pyme');
              return mapped === componentName;
            });

            if (
              !alreadyPresent &&
              !implicit.some((i) => i.rawName === raw.rawName && i.canonicalName === componentName)
            ) {
              implicit.push({
                rawName: raw.rawName,
                canonicalName: componentName,
                confidence: 50,
              });
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ [CoverageNormalizer] Graph implicit detection failed:', error);
      }
    }
  }

  return implicit;
}

/**
 * Synchronous version for checking if coverage is already present
 */
function mapRawToCanonicalSync(rawName: string, domain: string = 'pyme'): string | null {
  const normalized = normalizeText(rawName);
  const categories = semanticMatcher.getAllCategories(domain);

  for (const category of categories) {
    if (normalizeText(category.name) === normalized) {
      return category.name;
    }
    const definition = thesaurusService.getCoberturaDefinition(category.name, domain);
    if (definition) {
      const allTerms = [...definition.sinonimos, ...definition.terminos_busqueda];
      if (allTerms.some((t) => normalizeText(t) === normalized)) {
        return category.name;
      }
    }
  }

  return null;
}

/**
 * Build canonical coverage array
 * When ontology is enabled: uses fluid semantic grouping
 * When legacy mode: uses rigid 14-category canonical coverages
 */
export async function buildCanonicalCoverages(
  rawCoverages: RawCoverage[],
  insuredAssets: InsuredAsset[] = [],
  generalDeductibles: GeneralDeductible[] = [],
  pageTextMap?: Record<number, string>,
  domain?: string,
  insurerName?: string
): Promise<NormalizationResult> {
  const d = domain ?? 'pyme';
  // Ontology mode (fluid architecture)
  if (
    featureFlags.isEnabled('semanticCoverageOntology') &&
    !featureFlags.isEnabled('useLegacyCoverageMatcher')
  ) {
    return buildOntologyBasedCoverages(
      rawCoverages,
      insuredAssets,
      generalDeductibles,
      pageTextMap,
      d,
      insurerName
    );
  }

  // Legacy mode (N categories for domain)
  // Step 1: Resolve deductibles
  const withDeductibles = resolveDeductibles(rawCoverages, generalDeductibles);

  // Step 2: Derive insured amounts
  const withAmounts = deriveInsuredAmounts(withDeductibles, insuredAssets);

  // Step 3: Map to canonical (batch processing for better performance)
  const mapped: Array<{
    coverage: RawCoverage;
    canonicalName: string | null;
    confidence: number;
    graphConfidence: number | null;
    method: string | null;
  }> = [];

  // Collect coverage names for batch processing
  const coverageNames = withAmounts.map((c) => c.rawName);
  const batchResults = await mapRawToCanonicalBatch(coverageNames, d, insurerName);

  for (let i = 0; i < withAmounts.length; i++) {
    const result = batchResults[i];
    mapped.push({
      coverage: withAmounts[i],
      canonicalName: result.canonicalName,
      confidence: result.confidence,
      graphConfidence: result.graphConfidence,
      method: result.method,
    });
  }

  // Step 4: Detect implicit coverages (static patterns + graph decomposition)
  const implicit = await detectImplicitCoverages(rawCoverages, d, insurerName);

  // Step 5: Build canonical coverages for the active domain
  const canonicalCategories = semanticMatcher.getAllCategories(d);
  const canonicalCoverages: CanonicalCoverage[] = [];
  let needsReview = false;
  let totalConfidence = 0;

  for (const category of canonicalCategories) {
    // Find explicit matches
    const explicitMatches = mapped.filter((m) => m.canonicalName === category.name);

    // Find implicit matches
    const implicitMatches = implicit.filter((i) => i.canonicalName === category.name);

    if (explicitMatches.length > 0) {
      // Use best explicit match
      const best = explicitMatches.reduce((a, b) => (a.confidence > b.confidence ? a : b));

      canonicalCoverages.push({
        name: category.name,
        status: 'present',
        insuredAmount: best.coverage.insuredAmount || null,
        deductible: best.coverage.deductible || null,
        premium: best.coverage.premium || null,
        confidence: best.confidence,
        graphConfidence: best.graphConfidence,
        rawNames: explicitMatches.map((m) => m.coverage.rawName),
        matchMethod: best.method as CanonicalCoverage['matchMethod'],
        needsReview: best.confidence < 70,
        categoryId: category.id,
      });

      totalConfidence += best.confidence;
      if (best.confidence < 70) needsReview = true;
    } else if (implicitMatches.length > 0) {
      // Use implicit
      const bestImplicit = implicitMatches[0];
      const parentCoverage = rawCoverages.find((r) => r.rawName === bestImplicit.rawName);

      canonicalCoverages.push({
        name: category.name,
        status: 'present',
        insuredAmount: parentCoverage?.insuredAmount || null,
        deductible: parentCoverage?.deductible || null,
        premium: parentCoverage?.premium || null,
        confidence: bestImplicit.confidence,
        graphConfidence: null,
        rawNames: [bestImplicit.rawName],
        matchMethod: 'implicit',
        needsReview: true,
        notes: `Cobertura implícita en: ${bestImplicit.rawName}`,
        categoryId: category.id,
      });

      totalConfidence += bestImplicit.confidence;
      needsReview = true;
    } else {
      // Missing
      canonicalCoverages.push({
        name: category.name,
        status: 'missing',
        insuredAmount: null,
        deductible: null,
        premium: null,
        confidence: 0,
        graphConfidence: null,
        rawNames: [],
        matchMethod: null,
        needsReview: false,
        categoryId: category.id,
      });
    }
  }

  const missingCoverages = canonicalCoverages
    .filter((c) => c.status === 'missing')
    .map((c) => c.name);

  // Collect uncategorized coverages (those that didn't match any canonical category)
  const rawUncategorized = mapped.filter((m) => m.canonicalName === null).map((m) => m.coverage);

  // Group uncategorized coverages by semantic similarity
  const grouped = groupUncategorizedCoverages(rawUncategorized);

  // Flatten groups into CanonicalCoverage array with categoryId
  const uncategorizedCoverages: CanonicalCoverage[] = [];
  for (const group of grouped) {
    for (const coverage of group.coverages) {
      uncategorizedCoverages.push({
        name: coverage.rawName,
        status: 'present' as CoverageStatus,
        insuredAmount: coverage.insuredAmount,
        deductible: coverage.deductible,
        premium: coverage.premium,
        confidence: 0,
        graphConfidence: null,
        rawNames: [coverage.rawName],
        matchMethod: 'semantic-group',
        needsReview: true,
        notes: `Grupo: ${group.name}`,
        categoryId: group.id,
      });
    }
  }

  const avgConfidence =
    canonicalCoverages.length > 0
      ? totalConfidence / canonicalCoverages.filter((c) => c.status === 'present').length
      : 0;

  return {
    canonicalCoverages,
    uncategorizedCoverages,
    missingCoverages,
    needsReview,
    totalConfidence: Math.round(avgConfidence),
    generalDeductibles,
  };
}

/**
 * Build coverages using semantic ontology (fluid grouping)
 * Preserves document truth - doesn't force into rigid categories
 */
async function buildOntologyBasedCoverages(
  rawCoverages: RawCoverage[],
  insuredAssets: InsuredAsset[] = [],
  generalDeductibles: GeneralDeductible[] = [],
  pageTextMap?: Record<number, string>,
  domain?: string,
  insurerName?: string
): Promise<NormalizationResult> {
  const d = domain ?? 'pyme';
  // Step 1: Resolve deductibles
  const withDeductibles = resolveDeductibles(rawCoverages, generalDeductibles);

  // Step 2: Derive insured amounts
  const withAmounts = deriveInsuredAmounts(withDeductibles, insuredAssets);

  // Step 3: Map using ontology with concurrency pool (max 5)
  const mappings: Array<{
    coverage: RawCoverage;
    mapping: CoverageMapping;
  }> = new Array(withAmounts.length);

  const limit = 5;
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < withAmounts.length; i++) {
    const coverage = withAmounts[i];
    const task = (async () => {
      const mapping = await coverageOntology.mapCoverage(coverage.rawName, insurerName, d);

      // Reverse String page mapping using literal rawTextSnippet evidence
      if (pageTextMap && coverage.rawTextSnippet) {
        const resolvedPage = pdfExtractor.findExactPageForSnippet(
          pageTextMap,
          coverage.rawTextSnippet
        );
        if (resolvedPage !== null) {
          coverage.pageNumber = resolvedPage;
          mapping.pageNumber = resolvedPage;
        }
      }

      mappings[i] = { coverage, mapping };

      // Save for learning
      if (mapping.confidence > 0.5) {
        await coverageOntology.saveMapping(mapping).catch(() => {});
      }
    })();

    executing.add(task);
    const cleanUp = () => executing.delete(task);
    task.then(cleanUp, cleanUp);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);

  // Step 4: Group by semantic similarity
  const groups: Record<
    string,
    {
      coverages: Array<{
        rawCoverage: RawCoverage;
        confidence: number;
        isComposite: boolean;
        components?: string[];
      }>;
      totalConfidence: number;
    }
  > = {};

  for (const { coverage, mapping } of mappings) {
    if (mapping.groups.length === 0) {
      // Ungrouped - will be added as uncategorized
      console.log(
        `[coverageNormalizer] Coverage ungrouped: "${coverage.rawName}" - adding as uncategorized`
      );
      continue;
    }

    // Use best group
    const bestGroup = mapping.groups[0];
    const node = coverageOntology.getNodeById(bestGroup.groupId, d);

    if (!node) continue;

    const groupName = node.name;

    if (!groups[groupName]) {
      groups[groupName] = { coverages: [], totalConfidence: 0 };
    }

    groups[groupName].coverages.push({
      rawCoverage: coverage,
      confidence: bestGroup.confidence,
      isComposite: mapping.isComposite,
      components: mapping.components,
    });
    groups[groupName].totalConfidence += bestGroup.confidence;
  }

  // Step 5: Build canonical coverages from groups using the active domain categories
  const canonicalCategories = semanticMatcher.getAllCategories(d);
  const canonicalCoverages: CanonicalCoverage[] = [];
  let needsReview = false;
  let totalConfidence = 0;
  let presentCount = 0;

  for (const category of canonicalCategories) {
    const groupData = groups[category.name];

    if (groupData && groupData.coverages.length > 0) {
      // Use best coverage in group
      const best = groupData.coverages.reduce((a, b) => (a.confidence > b.confidence ? a : b));

      const avgConfidence = groupData.totalConfidence / groupData.coverages.length;
      const groupNeedsReview = avgConfidence < 0.7 || best.isComposite;

      canonicalCoverages.push({
        name: category.name,
        status: 'present',
        insuredAmount: best.rawCoverage.insuredAmount || null,
        deductible: best.rawCoverage.deductible || null,
        premium: best.rawCoverage.premium || null,
        confidence: Math.round(avgConfidence * 100),
        graphConfidence: null,
        rawNames: groupData.coverages.map((c) => c.rawCoverage.rawName),
        matchMethod: best.isComposite ? 'ontology-composite' : 'ontology',
        needsReview: groupNeedsReview,
        notes: best.isComposite ? `Cobertura compuesta: ${best.components?.join(', ')}` : undefined,
        categoryId: category.id,
        rawTextSnippet: best.rawCoverage.rawTextSnippet || undefined,
        pageNumber: best.rawCoverage.pageNumber || undefined,
      });

      totalConfidence += avgConfidence * 100;
      presentCount++;
      if (groupNeedsReview) needsReview = true;
    } else {
      // Mark as missing
      canonicalCoverages.push({
        name: category.name,
        status: 'missing',
        insuredAmount: null,
        deductible: null,
        premium: null,
        confidence: 0,
        graphConfidence: null,
        rawNames: [],
        matchMethod: null,
        needsReview: false,
        categoryId: category.id,
      });
    }
  }

  // Add ungrouped coverages as uncategorized
  const groupedRawNames = new Set(
    mappings.filter((m) => m.mapping.groups.length > 0).map((m) => m.coverage.rawName)
  );

  const uncategorizedCoverages: CanonicalCoverage[] = [];
  for (const { coverage } of mappings) {
    if (!groupedRawNames.has(coverage.rawName)) {
      uncategorizedCoverages.push({
        name: coverage.rawName,
        status: 'present',
        insuredAmount: coverage.insuredAmount || null,
        deductible: coverage.deductible || null,
        premium: coverage.premium || null,
        confidence: 0,
        graphConfidence: null,
        rawNames: [coverage.rawName],
        matchMethod: null,
        needsReview: true,
        notes: 'Sin clasificación semántica',
        rawTextSnippet: coverage.rawTextSnippet || undefined,
        pageNumber: coverage.pageNumber || undefined,
      });
    }
  }

  const avgConfidence = presentCount > 0 ? totalConfidence / presentCount : 0;

  const missingCoverages = canonicalCoverages
    .filter((c) => c.status === 'missing')
    .map((c) => c.name);

  return {
    canonicalCoverages,
    uncategorizedCoverages,
    missingCoverages,
    needsReview,
    totalConfidence: Math.round(avgConfidence),
    generalDeductibles,
  };
}
