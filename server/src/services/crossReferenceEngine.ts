/**
 * Cross-Reference Engine
 * Compares quote coverage data against clause documents retrieved via RAG
 */

import { ragRetrievalService, RetrievedClause } from './ragRetrievalService';
import { ParsedCoverage, ParsedQuote } from './quoteParser';
import { structuredClauseExtractor } from './structuredClauseExtractor';
import { hybridDeductibleParser, HybridDeductibleResult } from './hybridDeductibleParser';
import {
  deductibleEquals,
  extractDeductibleFromClauseText,
} from './deductibleFormatter';
import { featureFlags } from '../config/featureFlags';

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO' | 'GOOD';

export interface DiscrepancyAlert {
    level: AlertLevel;
    coverageName: string;
    title: string;
    description: string;
    quoteValue: string;
    clauseValue: string;
    clauseReference?: string;
    isFallback: boolean;
}

export interface CrossReferenceResult {
    coverageName: string;
    quoteData: {
        value: string;
        deductible: string;
    };
    clauseData: {
        value?: string;
        deductible?: string;
        exclusions?: string[];
        conditions?: string[];
        hasCap?: boolean;
        capAmount?: number;
        isMandatory?: boolean;
    };
    alerts: DiscrepancyAlert[];
    isVerified: boolean;
}

export const crossReferenceEngine = {
    /**
     * Cross-reference a single coverage against clause documents
     * Uses structured data when available, falls back to RAG
     */
    crossReferenceCoverage: async (
        coverage: ParsedCoverage,
        insurerName: string
    ): Promise<CrossReferenceResult> => {
        // Use structured clause extraction when enabled
        if (featureFlags.isEnabled('structuredClauseExtraction')) {
            return crossReferenceEngine.crossReferenceCoverageStructured(coverage, insurerName);
        }

        // Legacy RAG-based cross-reference
        return crossReferenceCoverageLegacy(coverage, insurerName);
    },

    /**
     * Cross-reference using structured clause data (new architecture)
     * Compares variables directly: value, deductible structure, exclusions, conditions
     */
    crossReferenceCoverageStructured: async (
        coverage: ParsedCoverage,
        insurerName: string
    ): Promise<CrossReferenceResult> => {
        const result: CrossReferenceResult = {
            coverageName: coverage.canonicalName || coverage.name,
            quoteData: {
                value: coverage.value,
                deductible: coverage.deductible
            },
            clauseData: {},
            alerts: [],
            isVerified: false
        };

        try {
            // Search for structured clause data
            const structuredClause = await structuredClauseExtractor.searchClause(
                insurerName,
                coverage.canonicalName || coverage.name
            );

            if (!structuredClause) {
                // Fall back to legacy RAG-based cross-reference
                return crossReferenceCoverageLegacy(coverage, insurerName);
            }

            // Find matching coverage in structured data
            const matchingCoverage = structuredClause.coverages.find(c =>
                c.name.toLowerCase().includes((coverage.canonicalName || coverage.name).toLowerCase()) ||
                (coverage.canonicalName || coverage.name).toLowerCase().includes(c.name.toLowerCase())
            );

            if (!matchingCoverage) {
                result.alerts.push({
                    level: 'INFO',
                    coverageName: result.coverageName,
                    title: 'Cobertura no encontrada en clausulado',
                    description: `La cobertura ${result.coverageName} no aparece en el clausulado estructurado de ${insurerName}.`,
                    quoteValue: coverage.value,
                    clauseValue: 'N/A',
                    isFallback: false
                });
                return result;
            }

            // Populate structured clause data
            result.clauseData = {
                value: matchingCoverage.insuredAmount,
                deductible: matchingCoverage.deductible?.rawText,
                exclusions: [...matchingCoverage.exclusions, ...structuredClause.generalExclusions],
                conditions: [...matchingCoverage.conditions, ...structuredClause.generalConditions],
                isMandatory: false
            };
            result.isVerified = true;

            // Semantic deductible comparison
            if (coverage.deductible && coverage.deductible !== 'No aplica' && coverage.deductible !== 'NO ESPECIFICADO') {
                const quoteDeductibleStructure = await hybridDeductibleParser.parse(coverage.deductible);
                const matchingDeductible = matchingCoverage.deductible;
                const clauseDeductibleStructure = matchingDeductible
                    ? buildDeductibleStructureFromClause(matchingDeductible)
                    : null;

                if (clauseDeductibleStructure) {
                    const clauseRawText = clauseDeductibleStructure.rawText;
                    if (deductibleEquals(quoteDeductibleStructure, clauseDeductibleStructure)) {
                        // Equal deductibles: no alert needed.
                    } else {
                        const comparison = compareDeductibleStructures(
                            quoteDeductibleStructure,
                            clauseDeductibleStructure
                        );

                        if (comparison.isBetter) {
                            result.alerts.push({
                                level: 'GOOD',
                                coverageName: result.coverageName,
                                title: 'Deducible favorable',
                                description: `La cotización ofrece mejores condiciones de deducible (${coverage.deductible}) vs clausulado (${clauseRawText}).`,
                                quoteValue: coverage.deductible,
                                clauseValue: clauseRawText,
                                isFallback: false
                            });
                        } else if (comparison.isWorse) {
                            result.alerts.push({
                                level: 'CRITICAL',
                                coverageName: result.coverageName,
                                title: 'Discrepancia en deducible',
                                description: `El clausulado establece condiciones menos favorables (${clauseRawText}) que la cotización (${coverage.deductible}).`,
                                quoteValue: coverage.deductible,
                                clauseValue: clauseRawText,
                                isFallback: false
                            });
                        }
                    }
                }
            }

            // Compare insured amounts
            if (matchingCoverage.insuredAmount && coverage.value) {
                const quoteAmount = parseValue(coverage.value);
                const clauseAmount = parseValue(matchingCoverage.insuredAmount);

                if (quoteAmount && clauseAmount && quoteAmount < clauseAmount) {
                    result.alerts.push({
                        level: 'WARNING',
                        coverageName: result.coverageName,
                        title: 'Valor asegurado menor al clausulado',
                        description: `La cotización cubre ${coverage.value}, pero el clausulado menciona ${matchingCoverage.insuredAmount}.`,
                        quoteValue: coverage.value,
                        clauseValue: matchingCoverage.insuredAmount,
                        isFallback: false
                    });
                }
            }

            // Check exclusions
            const totalExclusions = [
                ...matchingCoverage.exclusions,
                ...structuredClause.generalExclusions
            ];
            if (totalExclusions.length > 0) {
                result.alerts.push({
                    level: 'WARNING',
                    coverageName: result.coverageName,
                    title: 'Exclusiones aplicables',
                    description: `Se encontraron ${totalExclusions.length} exclusiones: ${totalExclusions.slice(0, 2).join('; ')}${totalExclusions.length > 2 ? '...' : ''}`,
                    quoteValue: coverage.value,
                    clauseValue: totalExclusions.join('; '),
                    isFallback: false
                });
            }

        } catch (error) {
            console.error(`❌ [crossReference] Error in structured cross-reference ${coverage.name}:`, error);
            // Fall back to legacy
            return crossReferenceCoverageLegacy(coverage, insurerName);
        }

        return result;
    },

    /**
     * Cross-reference all coverages in a quote
     */
    crossReferenceQuote: async (
        quote: ParsedQuote
    ): Promise<CrossReferenceResult[]> => {
        console.log(`🔍 [crossReference] Cross-referencing ${quote.coverages.length} coverages for ${quote.insurerName}...`);
        
        const results: CrossReferenceResult[] = [];
        
        for (const coverage of quote.coverages) {
            const result = await crossReferenceEngine.crossReferenceCoverage(
                coverage,
                quote.insurerName
            );
            results.push(result);
        }

        console.log(`✅ [crossReference] Completed cross-reference for ${quote.insurerName}`);
        return results;
    },

    /**
     * Batch cross-reference multiple quotes with shared coverage queries
     * Reduces RAG calls from N*M to M (where M is unique coverages)
     */
    crossReferenceQuotesBatch: async (
        quotes: ParsedQuote[]
    ): Promise<Map<number, CrossReferenceResult[]>> => {
        console.log(`🔍 [crossReference] Starting batch cross-reference for ${quotes.length} quotes...`);
        
        const results = new Map<number, CrossReferenceResult[]>();
        
        // Extract unique coverages across all quotes
        const uniqueCoverages = new Map<string, { coverage: ParsedCoverage; quoteIndices: number[] }>();
        
        for (let i = 0; i < quotes.length; i++) {
            const quote = quotes[i];
            for (const coverage of quote.coverages) {
                const key = coverage.canonicalName || coverage.name;
                if (!uniqueCoverages.has(key)) {
                    uniqueCoverages.set(key, { coverage, quoteIndices: [] });
                }
                uniqueCoverages.get(key)!.quoteIndices.push(i);
            }
        }
        
        console.log(`🔍 [crossReference] Found ${uniqueCoverages.size} unique coverages across ${quotes.length} quotes`);
        
        // Search clauses once per unique coverage (without insurer filter for broader results)
        const coverageClauses = new Map<string, { clauses: RetrievedClause[]; isFallback: boolean }>();
        
        for (const [name, { coverage }] of uniqueCoverages) {
            try {
                const searchResult = await ragRetrievalService.searchWithFallback(
                    `${coverage.canonicalName || coverage.name} deducible exclusion`,
                    {
                        coverageTags: coverage.canonicalName ? [coverage.canonicalName] : undefined,
                        limit: 3
                    }
                );
                coverageClauses.set(name, searchResult);
            } catch (error) {
                console.error(`❌ [crossReference] Error searching for ${name}:`, error);
                coverageClauses.set(name, { clauses: [], isFallback: false });
            }
        }
        
        // Distribute results to all quotes
        for (let i = 0; i < quotes.length; i++) {
            const quote = quotes[i];
            const quoteResults: CrossReferenceResult[] = [];
            
            for (const coverage of quote.coverages) {
                const key = coverage.canonicalName || coverage.name;
                const clauseResult = coverageClauses.get(key);
                
                if (clauseResult) {
                    // Create a modified result for this specific quote
                    const result = await crossReferenceEngine.crossReferenceCoverage(
                        coverage,
                        quote.insurerName
                    );
                    quoteResults.push(result);
                } else {
                    // No clauses found for this coverage
                    quoteResults.push({
                        coverageName: coverage.canonicalName || coverage.name,
                        quoteData: { value: coverage.value, deductible: coverage.deductible },
                        clauseData: {},
                        alerts: [{
                            level: 'INFO',
                            coverageName: coverage.canonicalName || coverage.name,
                            title: 'Sin cláusulas de referencia',
                            description: `No se encontraron cláusulas para ${coverage.canonicalName || coverage.name}`,
                            quoteValue: coverage.value,
                            clauseValue: 'N/A',
                            isFallback: false
                        }],
                        isVerified: false
                    });
                }
            }
            
            results.set(i, quoteResults);
        }
        
        console.log(`✅ [crossReference] Completed batch cross-reference`);
        return results;
    }
};

// ====================
// Legacy Implementation
// ====================

/**
 * Legacy cross-reference implementation using RAG chunks
 */
async function crossReferenceCoverageLegacy(
    coverage: ParsedCoverage,
    insurerName: string
): Promise<CrossReferenceResult> {
    const result: CrossReferenceResult = {
        coverageName: coverage.canonicalName || coverage.name,
        quoteData: {
            value: coverage.value,
            deductible: coverage.deductible
        },
        clauseData: {},
        alerts: [],
        isVerified: false
    };

    try {
        // Retrieve clause sections for this coverage
        const { clauses, isFallback } = await ragRetrievalService.searchWithFallback(
            `${coverage.canonicalName} deducible exclusion`,
            {
                insurerName,
                coverageTags: coverage.canonicalName ? [coverage.canonicalName] : undefined,
                limit: 3
            }
        );

        if (clauses.length === 0) {
            result.alerts.push({
                level: 'INFO',
                coverageName: result.coverageName,
                title: 'Sin cláusulas de referencia',
                description: `No se encontraron cláusulas para ${result.coverageName}. No se puede verificar la información.`,
                quoteValue: coverage.value,
                clauseValue: 'N/A',
                isFallback: false
            });
            return result;
        }

        // Extract clause data
        const clauseData = extractClauseData(clauses, coverage.canonicalName || coverage.name);
        result.clauseData = clauseData;
        result.isVerified = true;

        // Compare deductibles using structured parser output
        if (coverage.deductible && coverage.deductible !== 'No aplica' && coverage.deductible !== 'NO ESPECIFICADO') {
            const quoteDeductible = await parseDeductibleValue(coverage.deductible);
            const clauseDeductible = clauseData.deductible
                ? await parseDeductibleValue(clauseData.deductible)
                : null;

            if (quoteDeductible === null) {
                // Unparseable quote deductible; skip numeric comparison.
            } else if (clauseDeductible === null) {
                // No clause data to compare, neutral
            } else if (clauseDeductible > quoteDeductible) {
                result.alerts.push({
                    level: 'CRITICAL',
                    coverageName: result.coverageName,
                    title: 'Discrepancia en deducible',
                    description: `La cotización indica deducible ${coverage.deductible}, pero el clausulado establece ${clauseData.deductible}. El deducible real podría ser mayor.`,
                    quoteValue: coverage.deductible,
                    clauseValue: clauseData.deductible || 'N/A',
                    clauseReference: clauses[0]?.content.substring(0, 200),
                    isFallback
                });
            } else if (clauseDeductible < quoteDeductible) {
                result.alerts.push({
                    level: 'GOOD',
                    coverageName: result.coverageName,
                    title: 'Deducible favorable',
                    description: `La cotización ofrece un deducible ${coverage.deductible}, mejor que el clausulado (${clauseData.deductible}).`,
                    quoteValue: coverage.deductible,
                    clauseValue: clauseData.deductible || 'N/A',
                    isFallback
                });
            }
        }

        // Check exclusions
        if (clauseData.exclusions && clauseData.exclusions.length > 0) {
            result.alerts.push({
                level: 'WARNING',
                coverageName: result.coverageName,
                title: 'Exclusiones aplicables',
                description: `Se encontraron ${clauseData.exclusions.length} exclusiones relevantes: ${clauseData.exclusions.slice(0, 2).join('; ')}${clauseData.exclusions.length > 2 ? '...' : ''}`,
                quoteValue: coverage.value,
                clauseValue: clauseData.exclusions.join('; '),
                isFallback
            });
        }

        // If using fallback clauses, add info alert
        if (isFallback) {
            result.alerts.push({
                level: 'INFO',
                coverageName: result.coverageName,
                title: 'Referencia genérica',
                description: 'Las cláusulas consultadas son de referencia general. Verificar con la aseguradora específica.',
                quoteValue: coverage.value,
                clauseValue: 'N/A',
                isFallback: true
            });
        }

    } catch (error) {
        console.error(`❌ [crossReference] Error cross-referencing ${coverage.name}:`, error);
        result.alerts.push({
            level: 'INFO',
            coverageName: result.coverageName,
            title: 'Error en verificación',
            description: 'No se pudo completar la verificación contra cláusulas.',
            quoteValue: coverage.value,
            clauseValue: 'Error',
            isFallback: false
        });
    }

    return result;
}

// ====================
// Helper Functions
// ====================

function buildDeductibleStructureFromClause(
    clauseDeductible: { components: any[]; rawText: string }
): HybridDeductibleResult {
    // Re-parse the clause raw text with the canonical parser so that the
    // resulting structure carries normalised COP amounts for comparison.
    return hybridDeductibleParser.parseSync(clauseDeductible.rawText);
}

function extractClauseData(clauses: RetrievedClause[], _coverageName: string): {
    value?: string;
    deductible?: string;
    exclusions?: string[];
    conditions?: string[];
} {
    const data: {
        value?: string;
        deductible?: string;
        exclusions: string[];
        conditions: string[];
    } = {
        exclusions: [],
        conditions: []
    };

    for (const clause of clauses) {
        const content = clause.content.toLowerCase();
        
        // Extract deductible using the canonical formatter helper.
        if (!data.deductible) {
            const extracted = extractDeductibleFromClauseText(clause.content);
            if (extracted) {
                data.deductible = extracted;
            }
        }

        // Extract exclusions
        if (content.includes('exclusi') || content.includes('no cubre')) {
            const lines = clause.content.split('\n');
            for (const line of lines) {
                if (line.toLowerCase().includes('exclusi') || line.toLowerCase().includes('no cubre')) {
                    const cleanLine = line.trim();
                    if (cleanLine.length > 10 && !data.exclusions.includes(cleanLine)) {
                        data.exclusions.push(cleanLine);
                    }
                }
            }
        }

        // Extract conditions
        if (content.includes('condici') || content.includes('requisito')) {
            const lines = clause.content.split('\n');
            for (const line of lines) {
                if (line.toLowerCase().includes('condici') || line.toLowerCase().includes('requisito')) {
                    const cleanLine = line.trim();
                    if (cleanLine.length > 10 && !data.conditions.includes(cleanLine)) {
                        data.conditions.push(cleanLine);
                    }
                }
            }
        }
    }

    return data;
}

async function parseDeductibleValue(deducibleText: string): Promise<number | null> {
    if (!deducibleText || 
        deducibleText === 'No aplica' || 
        deducibleText === 'NO ESPECIFICADO' ||
        deducibleText === 'N/A') {
        return null;
    }

    const structure = await hybridDeductibleParser.parse(deducibleText);
    if (structure.components.some((c) => c.type === 'unknown')) {
        return null;
    }

    if (structure.normalized.isPercentageBased && structure.normalized.percentage > 0) {
        return structure.normalized.percentage;
    }
    if (structure.normalized.minAmount > 0) {
        return structure.normalized.minAmount;
    }
    return null;
}

/**
 * Compare two deductible structures semantically
 */
function compareDeductibleStructures(
    quote: { normalized: { minAmount: number; maxAmount: number; percentage: number } },
    clause: { normalized: { minAmount: number; maxAmount: number; percentage: number } }
): { isBetter: boolean; isWorse: boolean; isEqual: boolean } {
    // Lower deductible is better
    const quoteMin = quote.normalized.minAmount;
    const clauseMin = clause.normalized.minAmount;
    
    // Consider percentage-based deductibles
    const quotePercentage = quote.normalized.percentage;
    const clausePercentage = clause.normalized.percentage;
    
    // Compare by effective minimum amount
    const threshold = 0.05; // 5% tolerance
    
    if (quoteMin > 0 && clauseMin > 0) {
        const diff = (quoteMin - clauseMin) / clauseMin;
        if (diff < -threshold) return { isBetter: true, isWorse: false, isEqual: false };
        if (diff > threshold) return { isBetter: false, isWorse: true, isEqual: false };
    }
    
    // Compare by percentage
    if (quotePercentage > 0 && clausePercentage > 0) {
        const diff = quotePercentage - clausePercentage;
        if (diff < -threshold * 100) return { isBetter: true, isWorse: false, isEqual: false };
        if (diff > threshold * 100) return { isBetter: false, isWorse: true, isEqual: false };
    }
    
    return { isBetter: false, isWorse: false, isEqual: true };
}

/**
 * Parse monetary value from string
 */
function parseValue(valueText: string): number | null {
    if (!valueText || valueText === 'N/A' || valueText === 'No aplica') {
        return null;
    }
    
    // Remove currency symbols and common text
    const cleaned = valueText
        .replace(/[$€£]/g, '')
        .replace(/\./g, '') // Remove thousand separators (Colombian format)
        .replace(/,/g, '.') // Convert decimal comma to dot
        .replace(/\s*(SMMLV|SM|UVT)\s*/gi, '')
        .trim();
    
    const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(M|millones|millon)?/i);
    if (!match) return null;
    
    let value = parseFloat(match[1]);
    if (match[2]) {
        value *= 1000000; // Convert millions
    }
    
    return value;
}
