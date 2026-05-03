/**
 * Tipos para el pipeline de análisis multi-fase
 */

export interface ExtractedCoverage {
    name: string;
    value: string;
    deductible: string;
}

export interface ExtractedQuote {
    insurerName: string;
    policyName: string;
    priceAnnual: number;
    currency: string;
    coverages: ExtractedCoverage[];
}

export interface ExtractionOutput {
    quotes: ExtractedQuote[];
}

export interface ScoringAlert {
    level: 'CRITICAL' | 'WARNING' | 'GOOD' | 'INFO';
    title: string;
    description: string;
}

export interface ScoringBreakdown {
    coverage: number;
    deductibles: number;
    exclusions: number;
    priceRatio: number;
    sublimits: number;
    warranties: number;
}

export interface QuoteScore {
    insurerName: string;
    score: number;
    scoringBreakdown: ScoringBreakdown;
    alerts: ScoringAlert[];
}

export interface ScoringOutput {
    quotes: QuoteScore[];
}

export interface NarrativeOutput {
    recommendation: string;
    marketAnalysis: string;
}

export interface CompleteAnalysis {
    quotes: Array<ExtractedQuote & QuoteScore>;
    recommendation: string;
    marketAnalysis: string;
}
