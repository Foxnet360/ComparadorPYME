/**
 * Cross-Reference Engine
 * Compares quote coverage data against clause documents retrieved via RAG
 */

import { ragRetrievalService, RetrievedClause } from './ragRetrievalService';
import { ParsedCoverage, ParsedQuote } from './quoteParser';

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
     */
    crossReferenceCoverage: async (
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

            // Compare deductibles
            if (coverage.deductible && coverage.deductible !== 'No aplica' && coverage.deductible !== 'NO ESPECIFICADO') {
                const quoteDeductible = parseDeductible(coverage.deductible);
                const clauseDeductible = clauseData.deductible ? parseDeductible(clauseData.deductible) : null;

                if (clauseDeductible && quoteDeductible && quoteDeductible < clauseDeductible) {
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
                } else if (clauseDeductible && quoteDeductible && quoteDeductible > clauseDeductible) {
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

// Helper functions
function extractClauseData(clauses: RetrievedClause[], coverageName: string): {
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
        
        // Extract deductible
        if (!data.deductible) {
            const dedMatch = content.match(/deducible[\s:]+(\d+%?[^\n.]*)/i);
            if (dedMatch) {
                data.deductible = dedMatch[1].trim();
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

function parseDeductible(deducibleText: string): number | null {
    if (!deducibleText || deducibleText === 'No aplica' || deducibleText === 'NO ESPECIFICADO') {
        return null;
    }

    // Try to extract percentage
    const percentMatch = deducibleText.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
        return parseFloat(percentMatch[1]);
    }

    // Try to extract numeric value (SMMLV, SM, etc)
    const smmlvMatch = deducibleText.match(/(\d+)\s*(?:SMMLV|SM)/i);
    if (smmlvMatch) {
        return parseFloat(smmlvMatch[1]);
    }

    return null;
}