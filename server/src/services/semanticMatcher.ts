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
import { coverageOntology} from './coverageOntology';
import { featureFlags } from '../config/featureFlags';
import { getBatch, setBatch } from './cache/embeddingCacheService';
import { assertTaxonomyBundle } from '../schemas/domainBundleSchema';
import { loadDomainJson } from './domainBundleLoader';
import { coverageGraphService } from './coverageGraphService';

export interface SemanticMatchResult {
    categoryId: number | null;
    canonicalName: string | null;
    confidence: number;
    method: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | 'graph' | null;
}

export interface ProbabilisticMatch {
    categoryId: number | null;
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

const canonicalCategoriesCache = new Map<string, Array<{ id: number; name: string }>>();

function loadCanonicalCategories(domain: string = 'pyme'): Array<{ id: number; name: string }> {
  if (canonicalCategoriesCache.has(domain)) {
    return canonicalCategoriesCache.get(domain)!;
  }

  const bundle = assertTaxonomyBundle(loadDomainJson(domain, 'taxonomy.json'));
  const categories = bundle.categories.map(c => ({ id: c.id, name: c.name }));
  canonicalCategoriesCache.set(domain, categories);
  return categories;
}

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
const categoryEmbeddingsCache = new Map<string, Map<number, number[]>>();
const categoryEmbeddingsInitialized = new Map<string, boolean>();

/**
 * Precalculate embeddings for canonical categories at module load time
 * This eliminates redundant API calls during quote processing
 */
async function initializeCategoryEmbeddings(domain: string = 'pyme'): Promise<void> {
    if (categoryEmbeddingsInitialized.get(domain)) return;

    try {
        const categories = loadCanonicalCategories(domain);
        console.log(`🚀 [SemanticMatcher] Pre-calculating embeddings for ${categories.length} canonical categories (domain: ${domain})...`);
        const cache = new Map<number, number[]>();
        const categoryTexts = categories.map(c => c.name);
        const categoryEmbeddings = await embeddingService.generateEmbeddingsBatch(categoryTexts);

        let successCount = 0;
        for (let i = 0; i < categories.length; i++) {
            if (categoryEmbeddings[i]?.embedding) {
                cache.set(categories[i].id, categoryEmbeddings[i].embedding);
                successCount++;
            }
        }

        categoryEmbeddingsCache.set(domain, cache);
        categoryEmbeddingsInitialized.set(domain, true);
        console.log(`✅ [SemanticMatcher] Category embeddings ready: ${successCount}/${categories.length} categories (domain: ${domain})`);
    } catch (error) {
        console.error('❌ [SemanticMatcher] Failed to pre-calculate category embeddings:', error);
        // Don't set initialized flag, allow retry on next call
        categoryEmbeddingsCache.delete(domain);
    }
}

// Start initialization immediately for default domain when module loads
initializeCategoryEmbeddings('pyme').catch(err => {
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
function matchByThesaurus(coverageName: string, domain: string = 'pyme'): SemanticMatchResult | null {
    const normalized = normalizeText(coverageName);

    let bestPartialMatch: SemanticMatchResult | null = null;
    let bestPartialMatchLength = 0;
    const normalizedForPartial = normalizeForPartialMatch(coverageName);
    const categories = loadCanonicalCategories(domain);

    // Buscar en cada categoría
    for (const category of categories) {
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
function matchByFuzzy(coverageName: string, domain: string = 'pyme'): SemanticMatchResult | null {
    const normalized = normalizeText(coverageName);
    let bestMatch: SemanticMatchResult | null = null;
    let bestConfidence = 0;
    const categories = loadCanonicalCategories(domain);

    for (const category of categories) {
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
async function matchByEmbedding(coverageName: string, domain: string = 'pyme'): Promise<SemanticMatchResult | null> {
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
        if (!categoryEmbeddingsInitialized.get(domain) || !categoryEmbeddingsCache.has(domain)) {
            await initializeCategoryEmbeddings(domain);
        }

        // categoryEmbeddingsCache is guaranteed to be non-null after initialization
        const cache = categoryEmbeddingsCache.get(domain)!;
        const categories = loadCanonicalCategories(domain);

        // Comparar con cada categoría
        let bestMatch: SemanticMatchResult | null = null;
        let bestSimilarity = 0;

        for (const category of categories) {
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
 * Helper: Match coverage using pre-computed embedding vector
 */
async function matchByEmbeddingWithVector(coverageName: string, coverageEmbedding: number[], domain: string = 'pyme'): Promise<SemanticMatchResult | null> {
    try {
        // Ensure category embeddings are initialized
        if (!categoryEmbeddingsInitialized.get(domain) || !categoryEmbeddingsCache.has(domain)) {
            await initializeCategoryEmbeddings(domain);
        }

        const cache = categoryEmbeddingsCache.get(domain)!;
        const categories = loadCanonicalCategories(domain);
        let bestMatch: SemanticMatchResult | null = null;
        let bestSimilarity = 0;

        for (const category of categories) {
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
        console.error(`❌ [SemanticMatcher] Vector matching failed for "${coverageName}":`, error);
        return null;
    }
}

/**
 * Capa 4: LLM Fallback
 */
async function matchByLLM(coverageName: string, domain: string = 'pyme'): Promise<SemanticMatchResult | null> {
    try {
        const categories = loadCanonicalCategories(domain);
        const categoryList = categories
            .map((c, idx) => `${idx + 1}. ${c.name}`)
            .join('\n');

        const prompt = `Clasifica la siguiente cobertura de seguro en una de estas categorías:\n\nCATEGORÍAS:\n${categoryList}\n\nCOBERTURA A CLASIFICAR: "${coverageName}"\n\nResponde ÚNICAMENTE con el número de la categoría y un score de confianza (0-1).\nFormato: "CATEGORIA: [número]\nCONFIANZA: [score]"\nSi no estás seguro, responde: "CATEGORIA: 0\nCONFIANZA: 0"`;

        const response = await geminiService.extractText('', prompt);
        
        const categoryMatch = response.match(/CATEGORIA:\s*(\d+)/i);
        const confidenceMatch = response.match(/CONFIANZA:\s*([\d.]+)/i);
        
        if (categoryMatch && confidenceMatch) {
            const categoryId = parseInt(categoryMatch[1]);
            const confidence = parseFloat(confidenceMatch[1]);
            
            if (categoryId >= 1 && confidence >= CONFIDENCE_THRESHOLDS.LLM_MIN) {
                const category = categories.find(c => c.id === categoryId);
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
async function matchProbabilistic(coverageName: string, domain: string = 'pyme'): Promise<ProbabilisticMatchResult> {
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
        const mapping = await coverageOntology.mapCoverage(coverageName, undefined, domain);
        
        const categories = loadCanonicalCategories(domain);
        const matches: ProbabilisticMatch[] = mapping.groups.map(g => {
            const node = coverageOntology.getNodeById(g.groupId, domain);
            const resolvedName = node?.name || g.groupId;
            const normalizedResolved = normalizeText(resolvedName);
            const normalizedGroupId = normalizeText(g.groupId);
            
            let category = categories.find(c => 
                normalizeText(c.name) === normalizedResolved ||
                normalizeText(c.name) === normalizedGroupId ||
                c.id.toString() === g.groupId
            );

            if (!category) {
                for (const c of categories) {
                    const definition = thesaurusService.getCoberturaDefinition(c.name, domain);
                    if (definition) {
                        const allTerms = [...definition.sinonimos, ...definition.terminos_busqueda].map(t => normalizeText(t));
                        if (allTerms.includes(normalizedResolved) || allTerms.includes(normalizedGroupId)) {
                            category = c;
                            break;
                        }
                    }
                }
            }

            return {
                categoryId: category ? category.id : null,
                canonicalName: resolvedName,
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
    matchCoverage: async (coverageName: string, domain?: string): Promise<SemanticMatchResult> => {
        const d = domain ?? 'pyme';
        console.log(`🔍 [SemanticMatcher] Matching coverage: "${coverageName}" domain: ${d}`);

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
        const thesaurusResult = matchByThesaurus(coverageName, d);
        if (thesaurusResult) {
            console.log(`✅ [SemanticMatcher] Thesaurus match: ${thesaurusResult.canonicalName} (${thesaurusResult.confidence})`);
            return thesaurusResult;
        }

        // Capa 2: Fuzzy
        const fuzzyResult = matchByFuzzy(coverageName, d);
        if (fuzzyResult) {
            console.log(`✅ [SemanticMatcher] Fuzzy match: ${fuzzyResult.canonicalName} (${fuzzyResult.confidence})`);
            return fuzzyResult;
        }

        // Capa 3: Embedding
        const embeddingResult = await matchByEmbedding(coverageName, d);
        if (embeddingResult) {
            console.log(`✅ [SemanticMatcher] Embedding match: ${embeddingResult.canonicalName} (${embeddingResult.confidence})`);
            return embeddingResult;
        }

        // Capa 4: LLM Fallback
        const llmResult = await matchByLLM(coverageName, d);
        if (llmResult) {
            console.log(`✅ [SemanticMatcher] LLM match: ${llmResult.canonicalName} (${llmResult.confidence})`);
            return llmResult;
        }

        // Capa 5: Coverage semantic graph fallback
        if (featureFlags.isEnabled('useTemplateGraphPipeline')) {
            try {
                const graphResult = await coverageGraphService.query(coverageName, { domain: d });
                if (graphResult.mappings.length > 0) {
                    const best = graphResult.mappings[0];
                    if (best.confidence >= 0.5) {
                        const categories = loadCanonicalCategories(d);
                        let categoryId: number | null = null;
                        let canonicalName = best.canonicalId;

                        const numericId = parseInt(best.canonicalId, 10);
                        if (!Number.isNaN(numericId) && numericId > 0) {
                            categoryId = numericId;
                            canonicalName = categories.find(c => c.id === numericId)?.name || best.canonicalId;
                        } else {
                            const normalizedCanonicalId = normalizeText(best.canonicalId);
                            const matchedCategory = categories.find(c => normalizeText(c.name) === normalizedCanonicalId);
                            if (matchedCategory) {
                                categoryId = matchedCategory.id;
                                canonicalName = matchedCategory.name;
                            }
                        }

                        if (categoryId !== null) {
                            console.log(`✅ [SemanticMatcher] Graph match: ${canonicalName} (${best.confidence})`);
                            return {
                                categoryId,
                                canonicalName,
                                confidence: best.confidence,
                                method: 'graph',
                            };
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ [SemanticMatcher] Graph fallback failed:', error);
            }
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
    matchCoverages: async (coverageNames: string[], domain?: string): Promise<SemanticMatchResult[]> => {
        const results: SemanticMatchResult[] = [];

        for (const name of coverageNames) {
            const result = await semanticMatcher.matchCoverage(name, domain);
            results.push(result);
        }

        return results;
    },

    /**
     * Probabilistic matching using semantic ontology
     * Returns multiple possible group mappings with confidence scores
     */
    matchProbabilistic: async (coverageName: string, domain?: string): Promise<ProbabilisticMatchResult> => {
        if (featureFlags.isEnabled('semanticCoverageOntology')) {
            return matchProbabilistic(coverageName, domain);
        }

        // Fallback to legacy single match
        const legacyResult = await semanticMatcher.matchCoverage(coverageName, domain);
        return {
            matches: legacyResult.canonicalName ? [{
                categoryId: legacyResult.categoryId,
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
    matchCoveragesProbabilistic: async (coverageNames: string[], domain?: string): Promise<ProbabilisticMatchResult[]> => {
        const results: ProbabilisticMatchResult[] = [];

        for (const name of coverageNames) {
            const result = await semanticMatcher.matchProbabilistic(name, domain);
            results.push(result);
        }

        return results;
    },

    /**
     * Obtiene el nombre canónico de una categoría por ID
     */
    getCategoryName: (categoryId: number, domain?: string): string | null => {
        const categories = loadCanonicalCategories(domain ?? 'pyme');
        const category = categories.find(c => c.id === categoryId);
        return category?.name || null;
    },

    /**
     * Lista todas las categorías canónicas
     */
    getAllCategories: (domain?: string) => [...loadCanonicalCategories(domain ?? 'pyme')],

    /**
     * Normalización por lotes con pipeline híbrido
     * 1. Thesaurus exacto → 2. Fuzzy → 3. Cache persistente → 4. Batch embeddings → 5. LLM fallback
     */
    normalizeBatch: async (coverageNames: string[], domain?: string): Promise<SemanticMatchResult[]> => {
        const startTime = Date.now();
        const results: SemanticMatchResult[] = new Array(coverageNames.length).fill(null);
        const pendingIndices: number[] = [];
        const pendingNames: string[] = [];

        const d = domain ?? 'pyme';

        // Paso 1 & 2: Thesaurus + Fuzzy (rápido, sin API)
        for (let i = 0; i < coverageNames.length; i++) {
            const name = coverageNames[i];

            // Capa 1: Thesaurus exacto
            const thesaurusResult = await matchByThesaurus(name, d);
            if (thesaurusResult) {
                results[i] = thesaurusResult;
                continue;
            }

            // Capa 2: Fuzzy matching
            const fuzzyResult = await matchByFuzzy(name, d);
            if (fuzzyResult && fuzzyResult.confidence >= CONFIDENCE_THRESHOLDS.FUZZY_MIN) {
                results[i] = fuzzyResult;
                continue;
            }

            // No match rápido, agregar a pendientes
            pendingIndices.push(i);
            pendingNames.push(name);
        }

        console.log(`🧠 [SemanticMatcher] Batch: ${coverageNames.length - pendingNames.length}/${coverageNames.length} resolved by thesaurus/fuzzy`);

        if (pendingNames.length === 0) {
            console.log(`✅ [SemanticMatcher] Batch complete in ${Date.now() - startTime}ms (all cached)`);
            return results;
        }

        // Paso 3: Cache persistente
        const cacheHits = await getBatch(pendingNames);
        const stillPendingIndices: number[] = [];
        const stillPendingNames: string[] = [];

        for (let i = 0; i < pendingNames.length; i++) {
            const cached = cacheHits.get(pendingNames[i].toLowerCase().trim());
            if (cached) {
                // Encontrado en cache, comparar con categorías
                const match = await matchByEmbeddingWithVector(pendingNames[i], cached, d);
                results[pendingIndices[i]] = match || {
                    categoryId: null,
                    canonicalName: null,
                    confidence: 0,
                    method: null
                };
            } else {
                stillPendingIndices.push(pendingIndices[i]);
                stillPendingNames.push(pendingNames[i]);
            }
        }

        console.log(`🧠 [SemanticMatcher] Batch: ${pendingNames.length - stillPendingNames.length}/${pendingNames.length} resolved from persistent cache`);

        if (stillPendingNames.length === 0) {
            console.log(`✅ [SemanticMatcher] Batch complete in ${Date.now() - startTime}ms`);
            return results;
        }

        // Paso 4: Batch embeddings para los que faltan
        try {
            const batchResults = await embeddingService.generateEmbeddingsBatch(stillPendingNames);
            const embeddingsToCache: { name: string; embedding: number[] }[] = [];

            for (let i = 0; i < batchResults.length; i++) {
                const result = batchResults[i];
                const originalIndex = stillPendingIndices[i];

                if (result && result.embedding) {
                    // Almacenar para cache
                    embeddingsToCache.push({
                        name: stillPendingNames[i],
                        embedding: result.embedding
                    });

                    // Comparar con categorías
                    const match = await matchByEmbeddingWithVector(stillPendingNames[i], result.embedding, d);
                    results[originalIndex] = match || {
                        categoryId: null,
                        canonicalName: null,
                        confidence: 0,
                        method: null
                    };
                } else {
                    // Fallback a LLM si el embedding falló
                    const llmMatch = await matchByLLM(stillPendingNames[i], d);
                    results[originalIndex] = llmMatch || {
                        categoryId: null,
                        canonicalName: null,
                        confidence: 0,
                        method: null
                    };
                }
            }

            // Guardar en cache persistente
            if (embeddingsToCache.length > 0) {
                await setBatch(
                    embeddingsToCache.map(e => e.name),
                    embeddingsToCache.map(e => e.embedding)
                );
            }

            console.log(`✅ [SemanticMatcher] Batch complete in ${Date.now() - startTime}ms (${stillPendingNames.length} embeddings generated)`);
        } catch (error) {
            console.error(`❌ [SemanticMatcher] Batch embedding failed:`, error);
            // Fallback individual a LLM
            for (let i = 0; i < stillPendingNames.length; i++) {
                const llmMatch = await matchByLLM(stillPendingNames[i], d);
                results[stillPendingIndices[i]] = llmMatch || {
                    categoryId: null,
                    canonicalName: null,
                    confidence: 0,
                    method: null
                };
            }
        }

        return results;
    },

    /**
     * Limpia el cache de embeddings (útil para testing)
     */
    clearCache: (): void => {
        embeddingCache.clear();
        categoryEmbeddingsCache.clear();
        categoryEmbeddingsInitialized.clear();
        canonicalCategoriesCache.clear();
        console.log('🧹 [SemanticMatcher] Embedding cache cleared');
    },
};
