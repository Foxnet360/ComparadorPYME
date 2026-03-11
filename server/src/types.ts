export interface CoverageItem {
    name: string;
    value: string;
    description?: string;
    isPositive?: boolean;
}

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'GOOD' | 'INFO';

export interface AlertItem {
    level: AlertLevel;
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

export interface QuoteAnalysis {
    insurerName: string;
    policyName: string;
    priceMonthly: number;
    priceAnnual: number;
    currency: string;
    deductibles: string;
    coverages: CoverageItem[];
    alerts: AlertItem[];
    scoringBreakdown: ScoringBreakdown;
    clientAnalysis: string;
    technicalAnalysis: string;
    score: number;
}

export interface ComparisonReport {
    quotes: QuoteAnalysis[];
    recommendation: string;
    marketAnalysis: string;
    deductibleComparison: {
        insurer: string;
        deductibleText: string;
    }[];
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'SOLD' | 'LOST';

export interface HistoryEntry {
    id: string;
    userId?: string;
    date: string;
    clientName: string;
    insurers: string[];
    bestOption: string;
    premiumValue: number;
    status: QuoteStatus;
    fullReport?: ComparisonReport;
}

// Clause Library Types
export interface ClauseSections {
    exclusiones?: string;
    deducibles?: string;
    garantias?: string;
}

export interface ClauseDocument {
    id: string;
    aseguradora: string;
    producto: string;
    version: string;
    hash: string;
    textoCompleto: string;
    secciones: ClauseSections;
    tokensEstimados: number;
    fechaCreacion: Date;
    fechaActualizacion: Date;
    activo: boolean;
}

export interface InsurerSummary {
    aseguradora: string;
    count: number;
}
