/**
 * Coverage Normalizer Service
 * Maps raw extracted coverages to 14 canonical PYME categories
 */

import { semanticMatcher, SemanticMatchResult, CANONICAL_CATEGORIES } from './semanticMatcher';
import { thesaurusService } from './normalization/thesaurusService';
import { normalizeText } from '../utils/textUtils';
import { levenshteinDistance } from '../utils/stringUtils';
import { groupUncategorizedCoverages } from './semanticGrouper';
import { coverageOntology, CoverageMapping } from './coverageOntology';
import { featureFlags } from '../config/featureFlags';

export type CoverageStatus = 'present' | 'missing' | 'excluded';

export interface CanonicalCoverage {
  name: string;
  status: CoverageStatus;
  insuredAmount: number | null;
  deductible: string | null;
  premium: number | null;
  confidence: number;
  rawNames: string[];
  matchMethod: 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'implicit' | 'derived' | 'semantic-group' | 'ontology' | 'ontology-composite' | null;
  needsReview: boolean;
  notes?: string;
  categoryId?: string;
}

export interface RawCoverage {
  section?: string;
  rawName: string;
  insuredAmount?: number;
  deductible?: string;
  premium?: number;
  notes?: string;
}

export interface InsuredAsset {
  assetType: string;
  value: number;
  notes?: string;
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
  'EDIFICIOS': 'Incendio (Edificio y Contenidos)',
  'INMUEBLES': 'Incendio (Edificio y Contenidos)',
  'CONTENIDOS': 'Incendio (Edificio y Contenidos)',
  'MUEBLES': 'Incendio (Edificio y Contenidos)',
  'MERCANCIAS': 'Incendio (Edificio y Contenidos)',
  'EXISTENCIAS': 'Incendio (Edificio y Contenidos)',
  'EQUIPO ELECTRICO': 'Equipo Eléctrico y Electrónico',
  'EQUIPO ELECTRÓNICO': 'Equipo Eléctrico y Electrónico',
  'EEE': 'Equipo Eléctrico y Electrónico',
  'MAQUINARIA': 'Rotura de Maquinaria',
  'MAQUINARIA Y EQUIPO': 'Rotura de Maquinaria',
  'DINERO': 'Sustracción / Hurto',
  'VALORES': 'Sustracción / Hurto',
  'LUCRO CESANTE': 'Lucro Cesante',
  'LUCRO': 'Lucro Cesante',
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
export async function mapRawToCanonical(rawName: string): Promise<{
  canonicalName: string | null;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'ontology' | null;
}> {
  if (!rawName || rawName.trim().length === 0) {
    return { canonicalName: null, confidence: 0, method: null };
  }

  // Semantic ontology mode (new architecture)
  if (featureFlags.isEnabled('semanticCoverageOntology') && !featureFlags.isEnabled('useLegacyCoverageMatcher')) {
    const ontologyResult = await mapWithOntology(rawName);
    if (ontologyResult) {
      return ontologyResult;
    }
  }

  // Layer 1: Thesaurus exact match
  const thesaurusResult = await matchByThesaurusExact(rawName);
  if (thesaurusResult) {
    return { canonicalName: thesaurusResult, confidence: 100, method: 'exact' };
  }

  // Layer 2: Fuzzy match
  const fuzzyResult = matchByFuzzy(rawName);
  if (fuzzyResult && fuzzyResult.confidence >= 80) {
    return {
      canonicalName: fuzzyResult.canonicalName,
      confidence: fuzzyResult.confidence,
      method: 'fuzzy',
    };
  }

  // Layer 3: Embedding match (using existing semanticMatcher)
  const semanticResult = await semanticMatcher.matchCoverage(rawName);
  if (semanticResult && semanticResult.confidence >= 0.85) {
    return {
      canonicalName: semanticResult.canonicalName,
      confidence: Math.round(semanticResult.confidence * 100),
      method: 'embedding',
    };
  }

  // Layer 4: LLM fallback (using semanticMatcher's LLM layer)
  const llmResult = await semanticMatcher.matchCoverage(rawName);
  if (llmResult && llmResult.confidence >= 0.7) {
    return {
      canonicalName: llmResult.canonicalName,
      confidence: Math.round(llmResult.confidence * 100),
      method: 'llm',
    };
  }

  return { canonicalName: null, confidence: 0, method: null };
}

/**
 * Batch version of mapRawToCanonical for improved performance
 * Uses semanticMatcher.normalizeBatch with cache + batch embeddings
 */
export async function mapRawToCanonicalBatch(
  rawNames: string[]
): Promise<Array<{
    canonicalName: string | null;
    confidence: number;
    method: 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'ontology' | 'thesaurus' | null;
  }>> {
  const startTime = Date.now();
  
  // Filter out empty names
  const validIndices = rawNames.map((name, index) => ({ name, index }))
    .filter(item => item.name && item.name.trim().length > 0);
  
  if (validIndices.length === 0) {
    return rawNames.map(() => ({ canonicalName: null, confidence: 0, method: null }));
  }
  
  const results = new Array(rawNames.length).fill(null).map(() => ({
    canonicalName: null as string | null,
    confidence: 0,
    method: null as 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'ontology' | 'thesaurus' | null,
  }));
  
  // Separate names that can be resolved without embeddings (thesaurus/fuzzy)
  const namesNeedingEmbeddings: string[] = [];
  const embeddingIndices: number[] = [];
  
  for (const { name, index } of validIndices) {
    // Check thesaurus exact match first
    const thesaurusResult = await matchByThesaurusExact(name);
    if (thesaurusResult) {
      results[index] = { canonicalName: thesaurusResult, confidence: 100, method: 'exact' };
      continue;
    }
    
    // Check fuzzy match
    const fuzzyResult = matchByFuzzy(name);
    if (fuzzyResult && fuzzyResult.confidence >= 80) {
      results[index] = {
        canonicalName: fuzzyResult.canonicalName,
        confidence: fuzzyResult.confidence,
        method: 'fuzzy',
      };
      continue;
    }
    
    // Needs embedding - add to batch
    namesNeedingEmbeddings.push(name);
    embeddingIndices.push(index);
  }
  
  console.log(`🧠 [CoverageNormalizer] Batch: ${validIndices.length - namesNeedingEmbeddings.length}/${validIndices.length} resolved by thesaurus/fuzzy`);
  
  // Process embeddings in batch using semanticMatcher
  if (namesNeedingEmbeddings.length > 0) {
    try {
      const batchResults = await semanticMatcher.normalizeBatch(namesNeedingEmbeddings);
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const originalIndex = embeddingIndices[i];
        
        if (result && result.canonicalName && result.confidence >= 0.7) {
          results[originalIndex] = {
            canonicalName: result.canonicalName,
            confidence: Math.round(result.confidence * 100),
            method: result.method || 'embedding',
          };
        } else {
          // LLM fallback
          const llmResult = await semanticMatcher.matchCoverage(namesNeedingEmbeddings[i]);
          if (llmResult && llmResult.canonicalName && llmResult.confidence >= 0.7) {
            results[originalIndex] = {
              canonicalName: llmResult.canonicalName,
              confidence: Math.round(llmResult.confidence * 100),
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
        const singleResult = await mapRawToCanonical(namesNeedingEmbeddings[i]);
        results[embeddingIndices[i]] = singleResult;
      }
    }
  }
  
  return results;
}

/**
 * Match by thesaurus exact match
 */
async function matchByThesaurusExact(rawName: string): Promise<string | null> {
  const normalized = normalizeText(rawName);
  
  for (const category of CANONICAL_CATEGORIES) {
    // Check canonical name
    if (normalizeText(category.name) === normalized) {
      return category.name;
    }
    
    // Check thesaurus synonyms
    const definition = thesaurusService.getCoberturaDefinition(category.name);
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
function matchByFuzzy(rawName: string): { canonicalName: string; confidence: number } | null {
  const normalized = normalizeText(rawName);
  let bestMatch: { canonicalName: string; confidence: number } | null = null;
  
  for (const category of CANONICAL_CATEGORIES) {
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
  rawName: string
): Promise<{ canonicalName: string; confidence: number; method: 'ontology' } | null> {
  try {
    const mapping = await coverageOntology.mapCoverage(rawName);
    
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
      method: 'ontology'
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
  return rawCoverages.map(coverage => {
    if (coverage.deductible && coverage.deductible.trim().length > 0) {
      return coverage;
    }
    
    // Search for general deductible that applies
    const general = generalDeductibles.find(gd => {
      const appliesToUpper = gd.appliesTo.toUpperCase();
      const sectionUpper = (coverage.section || '').toUpperCase();
      const nameUpper = coverage.rawName.toUpperCase();
      
      return sectionUpper.includes(appliesToUpper) ||
             nameUpper.includes(appliesToUpper) ||
             appliesToUpper.includes(sectionUpper) ||
             appliesToUpper.includes(nameUpper);
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
  return rawCoverages.map(coverage => {
    if (coverage.insuredAmount && coverage.insuredAmount > 0) {
      return coverage;
    }
    
    // Try to derive from assets
    const canonicalName = coverage.rawName.toUpperCase();
    let derivedAmount: number | undefined;
    
    // Check asset mapping
    for (const [assetType, coverageName] of Object.entries(ASSET_TO_COVERAGE)) {
      if (canonicalName.includes(coverageName.toUpperCase()) ||
          coverageName.toUpperCase().includes(canonicalName)) {
        const matchingAssets = insuredAssets.filter(a => 
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
        const buildingAssets = insuredAssets.filter(a =>
          ['EDIFICIOS', 'INMUEBLES', 'CONTENIDOS', 'MUEBLES'].some(t =>
            a.assetType.toUpperCase().includes(t)
          )
        );
        if (buildingAssets.length > 0) {
          derivedAmount = buildingAssets.reduce((sum, a) => sum + a.value, 0);
        }
      }
    }
    
    if (derivedAmount) {
      return { ...coverage, insuredAmount: derivedAmount, notes: `${coverage.notes || ''} [Derivado de bienes asegurables]`.trim() };
    }
    
    return coverage;
  });
}

/**
 * Detect implicit coverages from broad coverage patterns
 */
export function detectImplicitCoverages(
  rawCoverages: RawCoverage[]
): Array<{ rawName: string; canonicalName: string; confidence: number }> {
  const implicit: Array<{ rawName: string; canonicalName: string; confidence: number }> = [];
  
  for (const raw of rawCoverages) {
    const nameUpper = raw.rawName.toUpperCase();
    
    for (const pattern of IMPLICIT_COVERAGE_PATTERNS) {
      if (pattern.pattern.test(nameUpper)) {
        for (const coverageName of pattern.coverages) {
          // Check if not already explicitly present
          const alreadyPresent = rawCoverages.some(r => {
            const mapped = mapRawToCanonicalSync(r.rawName);
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
  }
  
  return implicit;
}

/**
 * Synchronous version for checking if coverage is already present
 */
function mapRawToCanonicalSync(rawName: string): string | null {
  const normalized = normalizeText(rawName);
  
  for (const category of CANONICAL_CATEGORIES) {
    if (normalizeText(category.name) === normalized) {
      return category.name;
    }
    const definition = thesaurusService.getCoberturaDefinition(category.name);
    if (definition) {
      const allTerms = [...definition.sinonimos, ...definition.terminos_busqueda];
      if (allTerms.some(t => normalizeText(t) === normalized)) {
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
  generalDeductibles: GeneralDeductible[] = []
): Promise<NormalizationResult> {
  // Ontology mode (fluid architecture)
  if (featureFlags.isEnabled('semanticCoverageOntology') && !featureFlags.isEnabled('useLegacyCoverageMatcher')) {
    return buildOntologyBasedCoverages(rawCoverages, insuredAssets, generalDeductibles);
  }

  // Legacy mode (14 categories)
  // Step 1: Resolve deductibles
  const withDeductibles = resolveDeductibles(rawCoverages, generalDeductibles);
  
  // Step 2: Derive insured amounts
  const withAmounts = deriveInsuredAmounts(withDeductibles, insuredAssets);
  
  // Step 3: Map to canonical (batch processing for better performance)
  const mapped: Array<{
    coverage: RawCoverage;
    canonicalName: string | null;
    confidence: number;
    method: string | null;
  }> = [];
  
  // Collect coverage names for batch processing
  const coverageNames = withAmounts.map(c => c.rawName);
  const batchResults = await mapRawToCanonicalBatch(coverageNames);
  
  for (let i = 0; i < withAmounts.length; i++) {
    const result = batchResults[i];
    mapped.push({
      coverage: withAmounts[i],
      canonicalName: result.canonicalName,
      confidence: result.confidence,
      method: result.method,
    });
  }
  
  // Step 4: Detect implicit coverages
  const implicit = detectImplicitCoverages(rawCoverages);
  
  // Step 5: Build 14 canonical coverages
  const canonicalCoverages: CanonicalCoverage[] = [];
  let needsReview = false;
  let totalConfidence = 0;
  
  for (const category of CANONICAL_CATEGORIES) {
    // Find explicit matches
    const explicitMatches = mapped.filter(m => m.canonicalName === category.name);
    
    // Find implicit matches
    const implicitMatches = implicit.filter(i => i.canonicalName === category.name);
    
    if (explicitMatches.length > 0) {
      // Use best explicit match
      const best = explicitMatches.reduce((a, b) => 
        a.confidence > b.confidence ? a : b
      );
      
      canonicalCoverages.push({
        name: category.name,
        status: 'present',
        insuredAmount: best.coverage.insuredAmount || null,
        deductible: best.coverage.deductible || null,
        premium: best.coverage.premium || null,
        confidence: best.confidence,
        rawNames: explicitMatches.map(m => m.coverage.rawName),
        matchMethod: best.method as any,
        needsReview: best.confidence < 70,
        categoryId: category.id.toString(),
      });
      
      totalConfidence += best.confidence;
      if (best.confidence < 70) needsReview = true;
      
    } else if (implicitMatches.length > 0) {
      // Use implicit
      const bestImplicit = implicitMatches[0];
      const parentCoverage = rawCoverages.find(r => r.rawName === bestImplicit.rawName);
      
      canonicalCoverages.push({
        name: category.name,
        status: 'present',
        insuredAmount: parentCoverage?.insuredAmount || null,
        deductible: parentCoverage?.deductible || null,
        premium: parentCoverage?.premium || null,
        confidence: bestImplicit.confidence,
        rawNames: [bestImplicit.rawName],
        matchMethod: 'implicit',
        needsReview: true,
        notes: `Cobertura implícita en: ${bestImplicit.rawName}`,
        categoryId: category.id.toString(),
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
        rawNames: [],
        matchMethod: null,
        needsReview: false,
        categoryId: category.id.toString(),
      });
    }
  }
  
  const missingCoverages = canonicalCoverages
    .filter(c => c.status === 'missing')
    .map(c => c.name);
  
  // Collect uncategorized coverages (those that didn't match any canonical category)
  const rawUncategorized = mapped
    .filter(m => m.canonicalName === null)
    .map(m => m.coverage)
    // Filter out empty coverages (no value and no premium)
    .filter(c => c.insuredAmount !== null || c.premium !== null);
  
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
        rawNames: [coverage.rawName],
        matchMethod: 'semantic-group',
        needsReview: true,
        notes: `Grupo: ${group.name}`,
        categoryId: group.id,
      });
    }
  }
  
  const avgConfidence = canonicalCoverages.length > 0 
    ? totalConfidence / canonicalCoverages.filter(c => c.status === 'present').length 
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
  generalDeductibles: GeneralDeductible[] = []
): Promise<NormalizationResult> {
  // Step 1: Resolve deductibles
  const withDeductibles = resolveDeductibles(rawCoverages, generalDeductibles);
  
  // Step 2: Derive insured amounts
  const withAmounts = deriveInsuredAmounts(withDeductibles, insuredAssets);
  
  // Step 3: Map using ontology
  const mappings: Array<{
    coverage: RawCoverage;
    mapping: CoverageMapping;
  }> = [];
  
  for (const coverage of withAmounts) {
    const mapping = await coverageOntology.mapCoverage(coverage.rawName);
    mappings.push({ coverage, mapping });
    
    // Save for learning
    if (mapping.confidence > 0.5) {
      await coverageOntology.saveMapping(mapping).catch(() => {});
    }
  }
  
  // Step 4: Group by semantic similarity
  const groups: Record<string, {
    coverages: Array<{
      rawCoverage: RawCoverage;
      confidence: number;
      isComposite: boolean;
      components?: string[];
    }>;
    totalConfidence: number;
  }> = {};
  
  for (const { coverage, mapping } of mappings) {
    if (mapping.groups.length === 0) {
      // Ungrouped - will be added as uncategorized
      continue;
    }
    
    // Use best group
    const bestGroup = mapping.groups[0];
    const node = coverageOntology.getNodeById(bestGroup.groupId);
    
    if (!node) continue;
    
    const groupName = node.name;
    
    if (!groups[groupName]) {
      groups[groupName] = { coverages: [], totalConfidence: 0 };
    }
    
    groups[groupName].coverages.push({
      rawCoverage: coverage,
      confidence: bestGroup.confidence,
      isComposite: mapping.isComposite,
      components: mapping.components
    });
    groups[groupName].totalConfidence += bestGroup.confidence;
  }
  
  // Step 5: Build canonical coverages from groups
  const canonicalCoverages: CanonicalCoverage[] = [];
  let needsReview = false;
  let totalConfidence = 0;
  let presentCount = 0;
  
  for (const [groupName, groupData] of Object.entries(groups)) {
    // Use best coverage in group
    const best = groupData.coverages.reduce((a, b) => 
      a.confidence > b.confidence ? a : b
    );
    
    const avgConfidence = groupData.totalConfidence / groupData.coverages.length;
    const groupNeedsReview = avgConfidence < 0.7 || best.isComposite;
    
    canonicalCoverages.push({
      name: groupName,
      status: 'present',
      insuredAmount: best.rawCoverage.insuredAmount || null,
      deductible: best.rawCoverage.deductible || null,
      premium: best.rawCoverage.premium || null,
      confidence: Math.round(avgConfidence * 100),
      rawNames: groupData.coverages.map(c => c.rawCoverage.rawName),
      matchMethod: best.isComposite ? 'ontology-composite' : 'ontology',
      needsReview: groupNeedsReview,
      notes: best.isComposite ? `Cobertura compuesta: ${best.components?.join(', ')}` : undefined
    });
    
    totalConfidence += avgConfidence * 100;
    presentCount++;
    if (groupNeedsReview) needsReview = true;
  }
  
  // Add ungrouped coverages as uncategorized
  const groupedRawNames = new Set(
    mappings
      .filter(m => m.mapping.groups.length > 0)
      .map(m => m.coverage.rawName)
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
        rawNames: [coverage.rawName],
        matchMethod: null,
        needsReview: true,
        notes: 'Sin clasificación semántica'
      });
    }
  }
  
  const avgConfidence = presentCount > 0 ? totalConfidence / presentCount : 0;
  
  return {
    canonicalCoverages,
    uncategorizedCoverages,
    missingCoverages: [], // In ontology mode, nothing is "missing" - everything is present or uncategorized
    needsReview,
    totalConfidence: Math.round(avgConfidence),
    generalDeductibles
  };
}

export default {
  mapRawToCanonical,
  resolveDeductibles,
  deriveInsuredAmounts,
  detectImplicitCoverages,
  buildCanonicalCoverages,
};
