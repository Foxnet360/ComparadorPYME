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
  // Legacy semantic matching fields (kept for backward compatibility)
  canonicalName?: string;
  categoryId?: number | string | null;
  matchConfidence?: number;
  matchMethod?: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
  // New fluid architecture fields
  semanticGroups?: Array<{
    groupId: string;
    groupName: string;
    confidence: number;
  }>;
  isComposite?: boolean;
  components?: string[];
  // Structured variables
  insuredAmount?: {
    value: number;
    currency: string;
    rawText: string;
  };
  deductibleStructure?: {
    components: Array<{
      type: string;
      value: number;
      currency?: string;
    }>;
    normalized: {
      minAmount: number;
      maxAmount: number;
      percentage: number;
      isPercentageBased: boolean;
    };
    rawText: string;
  };
  sublimit?: {
    value: number;
    type: string;
    rawText: string;
  };
  exclusions?: string[];
  conditions?: string[];
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

export interface QuoteMetadata {
  insurer: string;
  cliente?: string | null;
  tipoSeguro?: string | null;
  ubicacionRiesgo?: string | null;
  anoConstruccion?: string | null;
  pisos?: string | null;
  aliado?: string | null;
  actividadOcupacion?: string | null;
  documento?: string | null;
  vigencia?: string | null;
}

export interface ComparisonReport {
  quotes: QuoteAnalysis[];
  recommendation: string;
  marketAnalysis: string;
  deductibleComparison: {
    insurer: string;
    deductibleText: string;
  }[];
  matrix?: MatrixRow[]; // Synced backend rows
  quoteMetadata?: QuoteMetadata[]; // Extracted risk details
  schemaVersion?: 1 | 2;
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

// ============================================
// Fluid Architecture Types (New)
// ============================================

export interface SemanticGroup {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId?: string;
  childrenIds: string[];
  aliases: string[];
  riskType: string;
  typicalDeductible?: string;
}

export interface ProbabilisticMapping {
  rawName: string;
  insurerName?: string;
  groups: Array<{
    groupId: string;
    confidence: number;
  }>;
  isComposite: boolean;
  components?: string[];
  confidence: number;
}

export interface VariableComparison {
  groupName: string;
  groupId: string;
  variables: Array<{
    insurerName: string;
    rawName: string;
    insuredAmount?: {
      value: number;
      currency: string;
      rawText: string;
    };
    deductible?: {
      components: Array<{
        type: string;
        value: number;
        currency?: string;
      }>;
      normalized: {
        minAmount: number;
        maxAmount: number;
        percentage: number;
      };
      rawText: string;
    };
    sublimit?: {
      value: number;
      type: string;
      rawText: string;
    };
    exclusions: string[];
    conditions: string[];
    confidence: number;
  }>;
  analysis: {
    bestInsuredAmount?: string;
    bestDeductible?: string;
    mostComprehensive?: string;
    bestPrice?: string;
  };
  exclusiveCoverages: Array<{
    insurerName: string;
    rawName: string;
  }>;
}

export interface StructuredClause {
  insurer: string;
  product: string;
  documentType: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR';
  coverages: Array<{
    name: string;
    description: string;
    insuredAmount?: string;
    deductible?: {
      components: Array<{
        type: string;
        value: number;
        currency?: string;
      }>;
      rawText: string;
    };
    sublimit?: string;
    exclusions: string[];
    conditions: string[];
    sourcePage: number;
  }>;
  generalExclusions: string[];
  generalConditions: string[];
  definitions: Record<string, string>;
}

export interface DeductibleBenchmark {
  name: string;
  data: {
    type: string;
    value: number;
    min?: string;
  };
  notes: string;
}

export interface ChatSource {
  type: 'quote' | 'structured_clause' | 'rag' | 'general';
  data: string;
  insurerName?: string;
  pageNumber?: number;
}

export interface UserCorrection {
  id?: string;
  rawName: string;
  insurerName?: string;
  systemMapping: string;
  userCorrection: string;
  correctionType: 'coverage_mapping' | 'deductible' | 'exclusion' | 'value';
  quoteId?: string;
  createdAt?: Date;
}

// --- MATRIX COMPARISON TYPES ---

export type MatrixRowType = 'header' | 'data' | 'spacer';

export interface MatrixCell {
  value: string;
  isExcluded: boolean;
  isWinner: boolean;
  notes?: string;
  pageNumber?: number;
  confidence?: number;
}

export interface MatrixRow {
  type: MatrixRowType;
  id: string;
  label: string;
  sectionId: number;
  cells: MatrixCell[];
  canonicalName?: string;
  canonicalId?: string;
  matchConfidence?: number;
  matchMethod?: string | null;
}
