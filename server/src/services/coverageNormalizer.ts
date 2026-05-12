/**
 * Coverage Normalizer Service
 * Maps raw extracted coverages to 14 canonical PYME categories
 */

import { semanticMatcher, SemanticMatchResult, CANONICAL_CATEGORIES } from './semanticMatcher';
import { thesaurusService } from './normalization/thesaurusService';
import { normalizeText } from '../utils/textUtils';
import { levenshteinDistance } from '../utils/stringUtils';

export type CoverageStatus = 'present' | 'missing' | 'excluded';

export interface CanonicalCoverage {
  name: string;
  status: CoverageStatus;
  insuredAmount: number | null;
  deductible: string | null;
  premium: number | null;
  confidence: number;
  rawNames: string[];
  matchMethod: 'exact' | 'fuzzy' | 'embedding' | 'llm' | 'implicit' | 'derived' | null;
  needsReview: boolean;
  notes?: string;
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
  missingCoverages: string[];
  needsReview: boolean;
  totalConfidence: number;
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
 */
export async function mapRawToCanonical(rawName: string): Promise<{
  canonicalName: string | null;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'embedding' | 'llm' | null;
}> {
  if (!rawName || rawName.trim().length === 0) {
    return { canonicalName: null, confidence: 0, method: null };
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
 * Build canonical coverage array (14 coverages)
 */
export async function buildCanonicalCoverages(
  rawCoverages: RawCoverage[],
  insuredAssets: InsuredAsset[] = [],
  generalDeductibles: GeneralDeductible[] = []
): Promise<NormalizationResult> {
  // Step 1: Resolve deductibles
  const withDeductibles = resolveDeductibles(rawCoverages, generalDeductibles);
  
  // Step 2: Derive insured amounts
  const withAmounts = deriveInsuredAmounts(withDeductibles, insuredAssets);
  
  // Step 3: Map to canonical
  const mapped: Array<{
    coverage: RawCoverage;
    canonicalName: string | null;
    confidence: number;
    method: string | null;
  }> = [];
  
  for (const coverage of withAmounts) {
    const result = await mapRawToCanonical(coverage.rawName);
    mapped.push({
      coverage,
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
      });
    }
  }
  
  const missingCoverages = canonicalCoverages
    .filter(c => c.status === 'missing')
    .map(c => c.name);
  
  const avgConfidence = canonicalCoverages.length > 0 
    ? totalConfidence / canonicalCoverages.filter(c => c.status === 'present').length 
    : 0;
  
  return {
    canonicalCoverages,
    missingCoverages,
    needsReview,
    totalConfidence: Math.round(avgConfidence),
  };
}

export default {
  mapRawToCanonical,
  resolveDeductibles,
  deriveInsuredAmounts,
  detectImplicitCoverages,
  buildCanonicalCoverages,
};
