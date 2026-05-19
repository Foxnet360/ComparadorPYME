/**
 * Semantic Coverage Matcher
 * Sistema de 4 capas para mapear coberturas extraídas a 14 categorías canónicas
 * Capas: 1.Thesaurus Exacto → 2.Fuzzy → 3.Embeddings → 4.LLM Fallback
 */

import { thesaurusService } from './normalization/thesaurusService';
import { embeddingService } from './vector/embeddingService';
import { geminiService } from './gemini';
import { normalizeText } from '../utils/textUtils';
import { levenshteinDistance } from '../utils/stringUtils';
import { coverageOntology, CoverageMapping } from './coverageOntology';
import { featureFlags } from '../config/featureFlags';

export interface SemanticMatchResult {
    categoryId: number | null;
    canonicalName: string | null;
    confidence: number;
    method: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
}

export interface ProbabilisticMatch {
    categoryId: number;
    canonicalName: string;
    confidence: number;
    method: string;
}

export interface ProbabilisticMatchResult {
    matches: ProbabilisticMatch[];
    isComposite: boolean;
    compositeComponents?: string[];
    rawName: string;
}

// Las 14 categorías canónicas de la Plantilla PYME
export const CANONICAL_CATEGORIES = [
    { id: 1, name: 'Incendio (Edificio y Contenidos)' },
    { id: 2, name: 'Lucro Cesante' },
    { id: 3, name: 'Sustracción / Hurto' },
    { id: 4, name: 'Equipo Eléctrico y Electrónico' },
    { id: 5, name: 'Rotura de Maquinaria' },
    { id: 6, name: 'Responsabilidad Civil (RCE)' },
    { id: 7, name: 'Vidrios Planos' },
    { id: 8, name: 'Manejo Global / Infidelidad' },
    { id: 9, name: 'Transporte de Mercancías' },
    { id: 10, name: 'Transporte de Valores' },
    { id: 11, name: 'Asistencia PYME' },
    { id: 12, name: 'Asistencia Legal' },
    { id: 13, name: 'Huelga, Motín, Asonada (HMACC)' },
    { id: 14, name: 'Terremoto y Eventos Catastróficos' },
];

// Umbrales de confianza
export const CONFIDENCE_THRESHOLDS = {
    THESAURUS_EXACT: 1.0,
    FUZZY_MIN: 0.6,
    EMBEDDING_MIN: 0.7,
    LLM_MIN: 0.6,
    OVERALL_MIN: 0.6,
};

// Cache de embeddings para evitar regeneración
const embeddingCache = new Map<string, number[]>();
let categoryEmbeddingsCache: Map<number, number[]> | null = null;
let categoryEmbeddingsInitialized = false;

/**
 * Precalculate embeddings for all 14 canonical categories at module load time
 * This eliminates redundant API calls during quote processing
 */
async function initializeCategoryEmbeddings(): Promise<void> {
    if (categoryEmbeddingsInitialized) return;
    
    try {
        console.log('🚀 [SemanticMatcher] Pre-calculating embeddings for 14 canonical categories...');
        categoryEmbeddingsCache = new Map();
        const categoryTexts = CANONICAL_CATEGORIES.map(c => c.name);
        const categoryEmbeddings = await embeddingService.generateEmbeddingsBatch(categoryTexts);
        
        let successCount = 0;
        for (let i = 0; i < CANONICAL_CATEGORIES.length; i++) {
            if (categoryEmbeddings[i]?.embedding) {
                categoryEmbeddingsCache.set(CANONICAL_CATEGORIES[i].id, categoryEmbeddings[i].embedding);
                successCount++;
            }
        }
        
        categoryEmbeddingsInitialized = true;
        console.log(`✅ [SemanticMatcher] Category embeddings ready: ${successCount}/${CANONICAL_CATEGORIES.length} categories`);
    } catch (error) {
        console.error('❌ [SemanticMatcher] Failed to pre-calculate category embeddings:', error);
        // Don't set initialized flag, allow retry on next call
        categoryEmbeddingsCache = null;
    }
}

// Start initialization immediately when module loads
initializeCategoryEmbeddings().catch(err => {
    console.error('❌ [SemanticMatcher] Initialization error:', err);
});

// Stop words comunes en español para matching
const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'con', 'por', 'para', 'un', 'una', 'al']);

/**
 * Normaliza texto removiendo stop words para matching parcial más preciso
 */
function normalizeForPartialMatch(text: string): string {
    if (!text || text.trim().length === 0) return '';
    const normalized = normalizeText(text);
    return normalized
        .split(/\s+/)
        .filter(word => !STOP_WORDS.has(word))
        .join(' ');
}

/**
 * Capa 1: Matching por Thesaurus Exacto
 */
function matchByThesaurus(coverageName: string): SemanticMatchResult | null {
    const normalized = normalizeText(coverageName);
    
    let bestPartialMatch: SemanticMatchResult | null = null;
    let bestPartialMatchLength = 0;
    const normalizedForPartial = normalizeForPartialMatch(coverageName);

    // Buscar en cada categoría
    for (const category of CANONICAL_CATEGORIES) {
        const categoryNormalized = normalizeText(category.name);

        // Coincidencia exacta con nombre de categoría
        if (normalized === categoryNormalized) {
            return {
                categoryId: category.id,
                canonicalName: category.name,
                confidence: CONFIDENCE_THRESHOLDS.THESAURUS_EXACT,
                method: 'thesaurus',
            };
        }

        // Obtener sinónimos del thesaurus
        const definition = thesaurusService.getCoberturaDefinition(category.name);
        if (definition) {
            const allTerms = [
                ...definition.sinonimos,
                ...definition.terminos_busqueda,
            ];

            for (const term of allTerms) {
                const termNormalized = normalizeText(term);
                if (normalized === termNormalized) {
                    return {
                        categoryId: category.id,
                        canonicalName: category.name,
                        confidence: CONFIDENCE_THRESHOLDS.THESAURUS_EXACT,
                        method: 'thesaurus',
                    };
                }

                // Coincidencia parcial: usar versión sin stop words para mayor precisión
                const termForPartial = normalizeForPartialMatch(term);
                if (termForPartial.length > 3 &&
                    (normalizedForPartial.includes(termForPartial) || termForPartial.includes(normalizedForPartial))) {
                    // Priorizar términos más largos (más específicos)
                    if (termForPartial.length > bestPartialMatchLength) {
                        bestPartialMatchLength = termForPartial.length;
                        bestPartialMatch = {
                            categoryId: category.id,
                            canonicalName: category.name,
                            confidence: 0.95,
                            method: 'thesaurus',
                        };
                    }
                }
            }
        }
    }

    return bestPartialMatch;
}

/**
 * Capa 2: Matching por Fuzzy Similarity
 */
function matchByFuzzy(coverageName: string): SemanticMatchResult | null {
    const normalized = normalizeText(coverageName);
    let bestMatch: SemanticMatchResult | null = null;
    let bestConfidence = 0;

    for (const category of CANONICAL_CATEGORIES) {
        const categoryNormalized = normalizeText(category.name);
        
        // Calcular distancia Levenshtein
        const distance = levenshteinDistance(normalized, categoryNormalized);
        const maxLength = Math.max(normalized.length, categoryNormalized.length);
        const confidence = maxLength > 0 ? 1 - (distance / maxLength) : 0;
        
        if (confidence > bestConfidence && confidence >= CONFIDENCE_THRESHOLDS.FUZZY_MIN) {
            bestConfidence = confidence;
            bestMatch = {
                categoryId: category.id,
                canonicalName: category.name,
                confidence,
                method: 'fuzzy',
            };
        }
        
        // También buscar en sinónimos
        const definition = thesaurusService.getCoberturaDefinition(category.name);
        if (definition) {
            const allTerms = [...definition.sinonimos, ...definition.terminos_busqueda];
            
            for (const term of allTerms) {
                const termNormalized = normalizeText(term);
                const termDistance = levenshteinDistance(normalized, termNormalized);
                const termMaxLength = Math.max(normalized.length, termNormalized.length);
                const termConfidence = termMaxLength > 0 ? 1 - (termDistance / termMaxLength) : 0;
                
                if (termConfidence > bestConfidence && termConfidence >= CONFIDENCE_THRESHOLDS.FUZZY_MIN) {
                    bestConfidence = termConfidence;
                    bestMatch = {
                        categoryId: category.id,
                        canonicalName: category.name,
                        confidence: termConfidence,
                        method: 'fuzzy',
                    };
                }
            }
        }
    }

    return bestMatch;
}

/**
 * Capa 3: Matching por Embedding Similarity
 */
async function matchByEmbedding(coverageName: string): Promise<SemanticMatchResult | null> {
    try {
        // Generar embedding para la cobertura (con cache)
        let coverageEmbedding: number[];
        const cacheKey = normalizeText(coverageName);
        
        if (embeddingCache.has(cacheKey)) {
            coverageEmbedding = embeddingCache.get(cacheKey)!;
        } else {
            coverageEmbedding = await embeddingService.generateEmbedding(coverageName);
            embeddingCache.set(cacheKey, coverageEmbedding);
        }
        
        // Ensure category embeddings are initialized (will use pre-calculated if available)
        if (!categoryEmbeddingsInitialized || !categoryEmbeddingsCache) {
            await initializeCategoryEmbeddings();
        }
        
        // categoryEmbeddingsCache is guaranteed to be non-null after initialization
        const cache = categoryEmbeddingsCache!;
        
        // Comparar con cada categoría
        let bestMatch: SemanticMatchResult | null = null;
        let bestSimilarity = 0;
        
        for (const category of CANONICAL_CATEGORIES) {
            const categoryEmbedding = cache.get(category.id);
            if (!categoryEmbedding) continue;
            
            const similarity = embeddingService.cosineSimilarity(coverageEmbedding, categoryEmbedding);
            
            if (similarity > bestSimilarity && similarity >= CONFIDENCE_THRESHOLDS.EMBEDDING_MIN) {
                bestSimilarity = similarity;
                bestMatch = {
                    categoryId: category.id,
                    canonicalName: category.name,
                    confidence: similarity,
                    method: 'embedding',
                };
            }
        }
        
        return bestMatch;
    } catch (error) {
        console.error(`❌ [SemanticMatcher] Embedding matching failed for "${coverageName}":`, error);
        return null;
    }
}

/**
 * Capa 4: LLM Fallback
 */
async function matchByLLM(coverageName: string): Promise<SemanticMatchResult | null> {
    try {
        const prompt = `Clasifica la siguiente cobertura de seguro PYME en una de estas 14 categorías:

CATEGORÍAS:
1. Incendio (Edificio y Contenidos)
2. Lucro Cesante
3. Sustracción / Hurto
4. Equipo Eléctrico y Electrónico
5. Rotura de Maquinaria
6. Responsabilidad Civil (RCE)
7. Vidrios Planos
8. Manejo Global / Infidelidad
9. Transporte de Mercancías
10. Transporte de Valores
11. Asistencia PYME
12. Asistencia Legal
13. Huelga, Motín, Asonada (HMACC)
14. Terremoto y Eventos Catastróficos

COBERTURA A CLASIFICAR: "${coverageName}"

Responde ÚNICAMENTE con el número de la categoría (1-14) y un score de confianza (0-1).
Formato: "CATEGORIA: [número]\nCONFIANZA: [score]"
Si no estás seguro, responde: "CATEGORIA: 0\nCONFIANZA: 0"`;

        const response = await geminiService.extractText('', prompt);
        
        const categoryMatch = response.match(/CATEGORIA:\s*(\d+)/i);
        const confidenceMatch = response.match(/CONFIANZA:\s*([\d.]+)/i);
        
        if (categoryMatch && confidenceMatch) {
            const categoryId = parseInt(categoryMatch[1]);
            const confidence = parseFloat(confidenceMatch[1]);
            
            if (categoryId >= 1 && categoryId <= 14 && confidence >= CONFIDENCE_THRESHOLDS.LLM_MIN) {
                const category = CANONICAL_CATEGORIES.find(c => c.id === categoryId);
                if (category) {
                    return {
                        categoryId: category.id,
                        canonicalName: category.name,
                        confidence,
                        method: 'llm',
                    };
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error(`❌ [SemanticMatcher] LLM matching failed for "${coverageName}":`, error);
        return null;
    }
}

/**
 * Probabilistic matching using semantic ontology
 * Returns multiple possible mappings with confidence scores
 */
async function matchProbabilistic(coverageName: string): Promise<ProbabilisticMatchResult> {
    console.log(`🔍 [SemanticMatcher] Probabilistic matching: "${coverageName}"`);
    
    if (!coverageName || coverageName.trim().length === 0) {
        return {
            matches: [],
            isComposite: false,
            rawName: coverageName
        };
    }
    
    try {
        // Use ontology for probabilistic mapping
        const mapping = await coverageOntology.mapCoverage(coverageName);
        
        const matches: ProbabilisticMatch[] = mapping.groups.map(g => {
            const node = coverageOntology.getNodeById(g.groupId);
            return {
                categoryId: 0, // Ontology uses string IDs, not numeric
                canonicalName: node?.name || g.groupId,
                confidence: g.confidence,
                method: mapping.isComposite ? 'ontology-composite' : 'ontology'
            };
        });
        
        return {
            matches,
            isComposite: mapping.isComposite,
            compositeComponents: mapping.components,
            rawName: coverageName
        };
    } catch (error) {
        console.error(`❌ [SemanticMatcher] Probabilistic matching failed:`, error);
        return {
            matches: [],
            isComposite: false,
            rawName: coverageName
        };
    }
}

/**
 * Matcher principal: ejecuta las 4 capas en cascada
 */
export const semanticMatcher = {
    /**
     * Match una cobertura usando las 4 capas en cascada
     */
    matchCoverage: async (coverageName: string): Promise<SemanticMatchResult> => {
        console.log(`🔍 [SemanticMatcher] Matching coverage: "${coverageName}"`);
        
        // Return null for empty or invalid input
        if (!coverageName || coverageName.trim().length === 0) {
            console.log(`⚠️ [SemanticMatcher] Empty coverage name, skipping match`);
            return {
                categoryId: null,
                canonicalName: null,
                confidence: 0,
                method: null,
            };
        }
        
        // Capa 1: Thesaurus exacto
        const thesaurusResult = matchByThesaurus(coverageName);
        if (thesaurusResult) {
            console.log(`✅ [SemanticMatcher] Thesaurus match: ${thesaurusResult.canonicalName} (${thesaurusResult.confidence})`);
            return thesaurusResult;
        }
        
        // Capa 2: Fuzzy
        const fuzzyResult = matchByFuzzy(coverageName);
        if (fuzzyResult) {
            console.log(`✅ [SemanticMatcher] Fuzzy match: ${fuzzyResult.canonicalName} (${fuzzyResult.confidence})`);
            return fuzzyResult;
        }
        
        // Capa 3: Embedding
        const embeddingResult = await matchByEmbedding(coverageName);
        if (embeddingResult) {
            console.log(`✅ [SemanticMatcher] Embedding match: ${embeddingResult.canonicalName} (${embeddingResult.confidence})`);
            return embeddingResult;
        }
        
        // Capa 4: LLM Fallback
        const llmResult = await matchByLLM(coverageName);
        if (llmResult) {
            console.log(`✅ [SemanticMatcher] LLM match: ${llmResult.canonicalName} (${llmResult.confidence})`);
            return llmResult;
        }
        
        // No match found
        console.log(`⚠️ [SemanticMatcher] No match found for "${coverageName}"`);
        return {
            categoryId: null,
            canonicalName: null,
            confidence: 0,
            method: null,
        };
    },

    /**
     * Match múltiples coberturas
     */
    matchCoverages: async (coverageNames: string[]): Promise<SemanticMatchResult[]> => {
        const results: SemanticMatchResult[] = [];
        
        for (const name of coverageNames) {
            const result = await semanticMatcher.matchCoverage(name);
            results.push(result);
        }
        
        return results;
    },

    /**
     * Probabilistic matching using semantic ontology
     * Returns multiple possible group mappings with confidence scores
     */
    matchProbabilistic: async (coverageName: string): Promise<ProbabilisticMatchResult> => {
        if (featureFlags.isEnabled('semanticCoverageOntology')) {
            return matchProbabilistic(coverageName);
        }
        
        // Fallback to legacy single match
        const legacyResult = await semanticMatcher.matchCoverage(coverageName);
        return {
            matches: legacyResult.canonicalName ? [{
                categoryId: legacyResult.categoryId || 0,
                canonicalName: legacyResult.canonicalName,
                confidence: legacyResult.confidence,
                method: legacyResult.method || 'legacy'
            }] : [],
            isComposite: false,
            rawName: coverageName
        };
    },

    /**
     * Batch probabilistic matching
     */
    matchCoveragesProbabilistic: async (coverageNames: string[]): Promise<ProbabilisticMatchResult[]> => {
        const results: ProbabilisticMatchResult[] = [];
        
        for (const name of coverageNames) {
            const result = await semanticMatcher.matchProbabilistic(name);
            results.push(result);
        }
        
        return results;
    },

    /**
     * Obtiene el nombre canónico de una categoría por ID
     */
    getCategoryName: (categoryId: number): string | null => {
        const category = CANONICAL_CATEGORIES.find(c => c.id === categoryId);
        return category?.name || null;
    },

    /**
     * Lista todas las categorías canónicas
     */
    getAllCategories: () => [...CANONICAL_CATEGORIES],

    /**
     * Limpia el cache de embeddings (útil para testing)
     */
    clearCache: (): void => {
        embeddingCache.clear();
        categoryEmbeddingsCache = null;
        console.log('🧹 [SemanticMatcher] Embedding cache cleared');
    },
};
