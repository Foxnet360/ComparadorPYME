export interface Citation {
  text: string;
  source: string;
  page?: number;
  section?: string;
}

export interface CoverageItem {
  name: string;
  value: string;
  description?: string;
  isPositive?: boolean;
  citations?: Citation[];
  deductible?: string;
}

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'GOOD' | 'INFO';

export interface AlertItem {
  level: AlertLevel;
  title: string;
  description: string;
  clauseReference?: string;
  sourceDocument?: string;
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

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// --- NEW TYPES FOR AUTH & DASHBOARD ---

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  role: 'TECHNICAL' | 'ADMIN';
  avatarUrl?: string;
  intermediaryName?: string;
  password?: string; // Stored locally
  agentDetails?: {
    phone: string;
    field: string; // Ramo
    bio?: string;
  };
}

export interface Client {
  id: string;
  name: string; // Razón Social
  nit: string; // Identificación Tributaria
  contactPerson?: string;
  email?: string;
  industry?: string;
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'SOLD' | 'LOST';

export interface HistoryEntry {
  id: string;
  userId?: string; // Owner of the record
  date: string;
  clientName: string;
  insurers: string[];
  bestOption: string;
  premiumValue: number;
  status: QuoteStatus;
  fullReport?: ComparisonReport; // Added to allow reviewing
}

export interface DashboardStats {
  totalQuotes: number;
  conversionRate: number; // Percentage
  totalPremiumSold: number;
  activeProspects: number;
  monthName: string; // Context for the stats
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
  fechaCreacion: string;
  fechaActualizacion: string;
  activo: boolean;
}

export interface ClauseSummary {
  id: string;
  aseguradora: string;
  producto: string;
  version: string;
  tokensEstimados: number;
  tieneSecciones: boolean;
  fechaActualizacion: string;
}

export interface InsurerSummary {
  aseguradora: string;
  count: number;
}