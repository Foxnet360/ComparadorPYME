/**
 * Rule-Based Scoring Engine
 * Deterministic scoring system for insurance quote analysis
 * Scores 6 dimensions on a 0-100 scale
 */

import { ParsedQuote } from './quoteParser';
import { CrossReferenceResult, DiscrepancyAlert } from './crossReferenceEngine';
import { formatNumber } from '../utils/formatCurrency';
import { CoverageExistenceResult } from './clauseCoverageValidator';

export interface ScoreWeights {
    coverage: number;
    deductibles: number;
    exclusions: number;
    priceRatio: number;
    sublimits: number;
    warranties: number;
}

export interface ScoreBreakdown {
    coverage: number;
    deductibles: number;
    exclusions: number;
    priceRatio: number;
    sublimits: number;
    warranties: number;
}

export interface ScoringResult {
    totalScore: number;
    dataQualityScore: number;
    verificationConfidence: number;
    breakdown: ScoreBreakdown;
    weights: ScoreWeights;
    quotePriceRank: number;
    marketPriceAverage: number;
    coverageCount: number;
    expectedCoverageCount: number;
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
}

// Default weights (must sum to 1.0)
const DEFAULT_WEIGHTS: ScoreWeights = {
    coverage: 0.25,
    deductibles: 0.20,
    exclusions: 0.20,
    priceRatio: 0.15,
    sublimits: 0.10,
    warranties: 0.10
};

// Expected coverages for a typical PYME policy
// Aligned with frontend PLANTILLA_ITEMS (14 canonical coverages)
const EXPECTED_COVERAGES = [
    'incendio (edificio y contenidos)',
    'lucro cesante',
    'sustraccion / hurto',
    'equipo electrico y electronico',
    'rotura de maquinaria',
    'responsabilidad civil (rce)',
    'vidrios planos',
    'manejo global / infidelidad',
    'transporte de mercancias',
    'transporte de valores',
    'asistencia pyme',
    'asistencia legal',
    'huelga, motin, asonada (hmacc)',
    'terremoto y eventos catastroficos'
];

// Market price benchmarks (in COP millions, annual)
// Used when no other quotes are available for comparison
const MARKET_PRICE_BENCHMARK = 8500000; // ~8.5M COP annual

export const quoteScorer = {
    /**
     * Calculate complete score for a quote
     */
    calculateScore: (
        quote: ParsedQuote,
        crossRefResults: CrossReferenceResult[],
        allQuotes: ParsedQuote[] = [],
        customWeights?: Partial<ScoreWeights>,
        clauseValidation?: CoverageExistenceResult[]
    ): ScoringResult => {
        console.log(`📊 [quoteScorer] Calculating score for ${quote.insurerName}...`);

        const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
        normalizeWeights(weights);

        const breakdown: ScoreBreakdown = {
            coverage: calculateCoverageScore(quote, clauseValidation),
            deductibles: calculateDeductibleScore(crossRefResults),
            exclusions: calculateExclusionScore(crossRefResults),
            priceRatio: calculatePriceScore(quote, allQuotes),
            sublimits: calculateSubLimitScore(crossRefResults),
            warranties: calculateWarrantyScore(crossRefResults)
        };

        // Calculate Data Quality Score (always calculable)
        const dataQualityWeights = {
            coverage: 0.35,
            deductibles: 0.25,
            priceRatio: 0.40,
            exclusions: 0,
            sublimits: 0,
            warranties: 0
        };
        const dataQualityScore = Math.round(
            breakdown.coverage * dataQualityWeights.coverage +
            breakdown.deductibles * dataQualityWeights.deductibles +
            breakdown.priceRatio * dataQualityWeights.priceRatio
        );

        // Calculate Verification Confidence (requires RAG)
        const hasRagData = crossRefResults.length > 0;
        const verificationWeights = {
            exclusions: 0.40,
            sublimits: 0.30,
            warranties: 0.30,
            coverage: 0,
            deductibles: 0,
            priceRatio: 0
        };
        const verificationConfidence = hasRagData ? Math.round(
            breakdown.exclusions * verificationWeights.exclusions +
            breakdown.sublimits * verificationWeights.sublimits +
            breakdown.warranties * verificationWeights.warranties
        ) : 0;

        // Calculate weighted total (legacy total score for backwards compatibility)
        const totalScore = Math.round(
            breakdown.coverage * weights.coverage +
            breakdown.deductibles * weights.deductibles +
            breakdown.exclusions * weights.exclusions +
            breakdown.priceRatio * weights.priceRatio +
            breakdown.sublimits * weights.sublimits +
            breakdown.warranties * weights.warranties
        );

        // Count alerts by level
        const alertCounts = countAlerts(crossRefResults);

        // Calculate price rank
        const { rank, average } = calculatePriceRank(quote, allQuotes);

        const result: ScoringResult = {
            totalScore: clamp(totalScore, 0, 100),
            dataQualityScore: clamp(dataQualityScore, 0, 100),
            verificationConfidence: clamp(verificationConfidence, 0, 100),
            breakdown,
            weights,
            quotePriceRank: rank,
            marketPriceAverage: average,
            coverageCount: quote.coverages.length,
            expectedCoverageCount: EXPECTED_COVERAGES.length,
            ...alertCounts
        };

        console.log(`✅ [quoteScorer] Score for ${quote.insurerName}: ${result.totalScore}/100`);
        return result;
    },

    /**
     * Get default weights
     */
    getDefaultWeights: (): ScoreWeights => ({ ...DEFAULT_WEIGHTS }),

    /**
     * Validate custom weights
     */
    validateWeights: (weights: Partial<ScoreWeights>): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        const values = Object.values(weights).filter(v => v !== undefined);
        
        if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            if (Math.abs(sum - 1.0) > 0.001) {
                errors.push(`Weights must sum to 1.0, got ${formatNumber(sum, 3)}`);
            }
        }

        for (const [key, value] of Object.entries(weights)) {
            if (value !== undefined && (value < 0 || value > 1)) {
                errors.push(`Weight ${key} must be between 0 and 1, got ${value}`);
            }
        }

        return { valid: errors.length === 0, errors };
    }
};

// ====================
// Individual Score Calculators
// ====================

function calculateCoverageScore(quote: ParsedQuote, clauseValidation?: CoverageExistenceResult[]): number {
    if (quote.coverages.length === 0) return 0;

    // Count how many expected coverages are present
    const foundCoverages = new Set<string>();
    for (const coverage of quote.coverages) {
        const canonical = (coverage.canonicalName || coverage.name).toLowerCase();
        for (const expected of EXPECTED_COVERAGES) {
            if (canonical.includes(expected) || expected.includes(canonical)) {
                foundCoverages.add(expected);
            }
        }
    }

    const coverageRatio = foundCoverages.size / EXPECTED_COVERAGES.length;
    let score = coverageRatio * 100;

    // Bonus for extra coverages (up to 100)
    const extraCoverages = Math.max(0, quote.coverages.length - EXPECTED_COVERAGES.length);
    score = Math.min(100, score + extraCoverages * 3);

    // Apply clause validation penalties
    if (clauseValidation && clauseValidation.length > 0) {
        const phantomCount = clauseValidation.filter(v => v.status === 'PHANTOM').length;
        const mandatoryMissingCount = clauseValidation.filter(v => v.status === 'MANDATORY_MISSING').length;
        
        // Penalty for phantom coverages: -15 each
        score -= phantomCount * 15;
        
        // Penalty for mandatory missing coverages: -10 each
        score -= mandatoryMissingCount * 10;
    }

    return Math.round(clamp(score, 0, 100));
}

function calculateDeductibleScore(crossRefResults: CrossReferenceResult[]): number {
    if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

    let totalScore = 0;
    let count = 0;

    for (const result of crossRefResults) {
        if (!result.isVerified) continue;

        const quoteDed = parseDeductibleValue(result.quoteData.deductible);
        const clauseDed = result.clauseData.deductible ? 
            parseDeductibleValue(result.clauseData.deductible) : null;

        if (quoteDed === null) continue;

        count++;

        if (clauseDed === null) {
            // No clause data to compare, neutral
            totalScore += 70;
        } else if (quoteDed < clauseDed) {
            // Quote deductible is BETTER (lower) than clause - suspicious
            totalScore += 40;
        } else if (quoteDed > clauseDed) {
            // Quote deductible is HIGHER than clause - unfavorable
            totalScore += 60;
        } else {
            // Match - good
            totalScore += 90;
        }
    }

    return count > 0 ? Math.round(totalScore / count) : 50;
}

function calculateExclusionScore(crossRefResults: CrossReferenceResult[]): number {
    if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

    let totalExclusions = 0;
    let verifiedCount = 0;

    for (const result of crossRefResults) {
        if (!result.isVerified) continue;
        verifiedCount++;
        
        const exclusionCount = result.clauseData.exclusions?.length || 0;
        totalExclusions += exclusionCount;
    }

    if (verifiedCount === 0) return 60; // Neutral score when no RAG data available

    const avgExclusions = totalExclusions / verifiedCount;
    
    // More exclusions = lower score
    // 0 exclusions = 100, 5+ exclusions = 0
    let score = 100 - (avgExclusions * 20);
    return Math.round(clamp(score, 0, 100));
}

function calculatePriceScore(quote: ParsedQuote, allQuotes: ParsedQuote[]): number {
    if (quote.priceAnnual <= 0) return 50;

    let benchmark: number;
    let comparisonBasis: string;

    if (allQuotes.length > 1) {
        // Use average of all quotes as benchmark
        const total = allQuotes.reduce((sum, q) => sum + q.priceAnnual, 0);
        benchmark = total / allQuotes.length;
        comparisonBasis = 'market';
    } else {
        // Use fixed benchmark
        benchmark = MARKET_PRICE_BENCHMARK;
        comparisonBasis = 'benchmark';
    }

    const ratio = quote.priceAnnual / benchmark;

    // Ratio scoring:
    // 0.5x = 100 (very cheap)
    // 0.8x = 90 (cheap)
    // 1.0x = 80 (fair)
    // 1.3x = 60 (expensive)
    // 1.5x = 40 (very expensive)
    // 2.0x = 0 (extremely expensive)
    let score: number;
    if (ratio <= 0.5) score = 100;
    else if (ratio <= 0.8) score = 90 - ((ratio - 0.5) / 0.3) * 10;
    else if (ratio <= 1.0) score = 80 - ((ratio - 0.8) / 0.2) * 10;
    else if (ratio <= 1.3) score = 70 - ((ratio - 1.0) / 0.3) * 20;
    else if (ratio <= 1.5) score = 50 - ((ratio - 1.3) / 0.2) * 20;
    else if (ratio <= 2.0) score = 30 - ((ratio - 1.5) / 0.5) * 30;
    else score = 0;

    console.log(`💰 [quoteScorer] Price score for ${quote.insurerName}: ${Math.round(score)}/100 (ratio: ${formatNumber(ratio, 2)}, basis: ${comparisonBasis})`);

    return Math.round(clamp(score, 0, 100));
}

function calculateSubLimitScore(crossRefResults: CrossReferenceResult[]): number {
    if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

    let restrictiveCount = 0;
    let verifiedCount = 0;

    for (const result of crossRefResults) {
        if (!result.isVerified) continue;
        verifiedCount++;

        // Check for sub-limit mentions in conditions
        const conditions = result.clauseData.conditions || [];
        for (const condition of conditions) {
            const lower = condition.toLowerCase();
            if (lower.includes('sub') && lower.includes('limite')) {
                restrictiveCount++;
            }
            if (lower.includes('tope') || lower.includes('maximo')) {
                restrictiveCount++;
            }
        }

        // Check for critical alerts about discrepancies
        for (const alert of result.alerts) {
            if (alert.level === 'CRITICAL' && alert.title.includes('Discrepancia')) {
                restrictiveCount += 0.5;
            }
        }
    }

    if (verifiedCount === 0) return 60; // Neutral score when no RAG data available

    const avgRestrictive = restrictiveCount / verifiedCount;
    let score = 100 - (avgRestrictive * 25);
    return Math.round(clamp(score, 0, 100));
}

function calculateWarrantyScore(crossRefResults: CrossReferenceResult[]): number {
    if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

    let totalConditions = 0;
    let verifiedCount = 0;

    for (const result of crossRefResults) {
        if (!result.isVerified) continue;
        verifiedCount++;
        
        const conditionCount = result.clauseData.conditions?.length || 0;
        totalConditions += conditionCount;
    }

    if (verifiedCount === 0) return 60; // Neutral score when no RAG data available

    const avgConditions = totalConditions / verifiedCount;
    
    // More conditions/warranties = lower score
    // 0 conditions = 100, 10+ conditions = 0
    let score = 100 - (avgConditions * 10);
    return Math.round(clamp(score, 0, 100));
}

// ====================
// Helper Functions
// ====================

function parseDeductibleValue(deducibleText: string): number | null {
    if (!deducibleText || 
        deducibleText === 'No aplica' || 
        deducibleText === 'NO ESPECIFICADO' ||
        deducibleText === 'N/A') {
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

    // Try to extract plain number (assumes thousands)
    const plainMatch = deducibleText.match(/(\d+(?:[.,]\d+)?)/);
    if (plainMatch) {
        const num = parseFloat(plainMatch[1].replace(',', '.'));
        if (!isNaN(num)) return num;
    }

    return null;
}

function countAlerts(crossRefResults: CrossReferenceResult[]): {
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
} {
    let critical = 0;
    let warning = 0;
    let info = 0;

    for (const result of crossRefResults) {
        for (const alert of result.alerts) {
            switch (alert.level) {
                case 'CRITICAL': critical++; break;
                case 'WARNING': warning++; break;
                case 'INFO': info++; break;
            }
        }
    }

    return { criticalAlerts: critical, warningAlerts: warning, infoAlerts: info };
}

function calculatePriceRank(quote: ParsedQuote, allQuotes: ParsedQuote[]): {
    rank: number;
    average: number;
} {
    if (allQuotes.length === 0 || quote.priceAnnual <= 0) {
        return { rank: 0, average: MARKET_PRICE_BENCHMARK };
    }

    const sorted = [...allQuotes].sort((a, b) => a.priceAnnual - b.priceAnnual);
    const rank = sorted.findIndex(q => q.insurerName === quote.insurerName) + 1;
    const average = sorted.reduce((sum, q) => sum + q.priceAnnual, 0) / sorted.length;

    return { rank, average };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function normalizeWeights(weights: ScoreWeights): void {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum > 0 && Math.abs(sum - 1.0) > 0.001) {
        for (const key of Object.keys(weights) as Array<keyof ScoreWeights>) {
            weights[key] = weights[key] / sum;
        }
    }
}
