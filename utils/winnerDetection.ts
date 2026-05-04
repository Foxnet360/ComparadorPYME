/**
 * Winner Detection Utility
 * Determines the best option per coverage category
 */

import { QuoteAnalysis, CoverageItem } from '../types';

export interface WinnerResult {
    quoteIdx: number;
    insurerName: string;
    reason: string;
}

/**
 * Parse monetary value to number
 */
const parseMonetaryValue = (value: string | undefined): number => {
    if (!value || typeof value !== 'string') return 0;
    
    const upperValue = value.trim().toUpperCase();
    if (['EXCLUIDO', 'NO CUBRE', 'NO APLICA', 'NO ESPECIFICADO'].includes(upperValue)) {
        return 0;
    }
    
    // Handle "500M" format
    const millionMatch = value.match(/^(\d+(?:[.,]\d+)?)\s*M$/i);
    if (millionMatch) {
        const num = parseFloat(millionMatch[1].replace(/\./g, '').replace(',', '.'));
        return !isNaN(num) ? num * 1000000 : 0;
    }
    
    // Handle values with $ sign
    const dollarMatch = value.match(/^\$?\s*([\d.,]+)\s*(.*)$/);
    if (dollarMatch) {
        const numStr = dollarMatch[1].replace(/\./g, '').replace(',', '.');
        const num = parseFloat(numStr);
        return !isNaN(num) && num > 0 ? num : 0;
    }
    
    return 0;
};

/**
 * Find winner by category across all quotes
 */
export const findWinnerByCategory = (
    quotes: QuoteAnalysis[],
    categoryId: number,
    categoryName: string
): WinnerResult | null => {
    if (!quotes || quotes.length < 2) return null;
    
    const scores: Array<{
        quoteIdx: number;
        insurerName: string;
        sumInsured: number;
        hasExclusion: boolean;
        deductible: number;
        score: number;
    }> = [];
    
    quotes.forEach((quote, idx) => {
        const coverage = quote.coverages?.find(c => 
            c.categoryId === categoryId || 
            (c.canonicalName || '').toLowerCase() === categoryName.toLowerCase() ||
            (c.name || '').toLowerCase() === categoryName.toLowerCase()
        );
        
        if (coverage) {
            const sumInsured = parseMonetaryValue(coverage.value);
            const hasExclusion = ['EXCLUIDO', 'NO CUBRE', 'NO APLICA'].includes((coverage.value || '').toUpperCase());
            const deductible = parseMonetaryValue(coverage.deductible);
            
            // Calculate a composite score
            // Higher sum insured = better
            // No exclusion = much better
            // Lower deductible = better
            let score = 0;
            if (!hasExclusion) {
                score += sumInsured * 0.6; // 60% weight on sum insured
                score -= deductible * 0.4; // 40% weight on deductible (penalty)
            }
            
            scores.push({
                quoteIdx: idx,
                insurerName: quote.insurerName,
                sumInsured,
                hasExclusion,
                deductible,
                score
            });
        }
    });
    
    if (scores.length === 0) return null;
    
    // Find the winner (highest score)
    const winner = scores.reduce((prev, current) => 
        current.score > prev.score ? current : prev
    );
    
    if (winner.score <= 0) return null;
    
    const reasons: string[] = [];
    if (winner.sumInsured > 0) {
        const isHighestSum = scores.every(s => s.sumInsured <= winner.sumInsured);
        if (isHighestSum) reasons.push('mayor suma asegurada');
    }
    if (winner.deductible >= 0) {
        const isLowestDed = scores.every(s => s.deductible >= winner.deductible);
        if (isLowestDed && winner.deductible > 0) reasons.push('menor deducible');
    }
    if (!winner.hasExclusion) {
        const hasExclusions = scores.some(s => s.hasExclusion);
        if (hasExclusions) reasons.push('sin exclusiones');
    }
    
    return {
        quoteIdx: winner.quoteIdx,
        insurerName: winner.insurerName,
        reason: reasons.join(' + ') || 'mejor opción'
    };
};

/**
 * Find overall winner quote
 */
export const findOverallWinner = (quotes: QuoteAnalysis[]): QuoteAnalysis | null => {
    if (!quotes || quotes.length === 0) return null;
    
    return quotes.reduce((prev, current) => 
        ((prev.score || 0) > (current.score || 0)) ? prev : current
    );
};

/**
 * Find cheapest quote
 */
export const findCheapestQuote = (quotes: QuoteAnalysis[]): QuoteAnalysis | null => {
    if (!quotes || quotes.length === 0) return null;
    
    const withPrices = quotes.filter(q => q.priceAnnual && q.priceAnnual > 0);
    if (withPrices.length === 0) return null;
    
    return withPrices.reduce((prev, current) => 
        ((prev.priceAnnual || Infinity) < (current.priceAnnual || Infinity)) ? prev : current
    );
};
