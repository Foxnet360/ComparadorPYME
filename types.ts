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
  // Semantic matching fields
  canonicalName?: string;
  categoryId?: number | null;
  matchConfidence?: number;
  matchMethod?: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
  // Value source tracking (anti-hallucination)
  valueSource?: 'extracted' | 'calculated' | 'inferred';
  // Sublimit information (optional)
  sublimit?: string;
  // High-certainty ontology fields (Phase 4)
  rawTextSnippet?: string;
  needsHumanReview?: boolean;
  justification?: string;
  calculatedPage?: number;
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
  dataQualityScore?: number;
  verificationConfidence?: number;
  isRagAvailable?: boolean;
  extractionConfidence?: number;
  confidenceBreakdown?: {
    coverageCompleteness: number;
    numericParseSuccess: number;
    validationPassRate: number;
    schemaCompliance: number;
  };
  needsReview?: boolean;
  isCritical?: boolean;
  validationFlags?: Array<{
    field: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    code: string;
  }>;
  validationSummary?: string;
  // Advanced analysis fields (optional, backward compatible)
  clauseValidation?: ClauseValidationResult;
  deductibleAnalysis?: DeductibleAnalysis[];
  contextualRisk?: ContextualRisk;
  warrantyCompliance?: WarrantyCompliance;
  legalOpinion?: LegalOpinion[];
  // Dual extraction validation for critical coverages
  dualExtractionValidation?: Array<{
    coverageName: string;
    firstExtraction: { value: string; deductible: string; confidence: number };
    secondExtraction: { value: string; deductible: string; confidence: number };
    discrepancy: number;
    isDiscrepancy: boolean;
    recommendation: string;
  }>;
  // Quote-based audit results (independent of RAG)
  quoteAudit?: {
    deductibleRisks: Array<{
      coverageName: string;
      deductible: string;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      score: number;
      recommendation: string;
    }>;
    missingCoverages: Array<{
      categoryName: string;
      categoryId: number;
      impact: 'HIGH' | 'MEDIUM';
      reason: string;
    }>;
    specialConditions: Array<{
      text: string;
      impact: 'CRITICAL' | 'WARNING' | 'INFO';
      coverageName?: string;
    }>;
    negotiationPoints: Array<{
      type: 'deductible' | 'coverage' | 'price';
      title: string;
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      potentialSavings?: string;
    }>;
    competitiveAdvantages: Array<{
      type: 'exclusive_coverage' | 'better_price' | 'better_deductible' | 'more_coverages';
      description: string;
    }>;
    profileRecommendations: Array<{
      profile: string;
      priorityCoverages: string[];
      recommendation: string;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
    overallRiskScore: number;
    summary: string;
  };
}

// --- ADVANCED ANALYSIS TYPES (INTEGRACIÓN CLAUSULADOS) ---

export interface ClauseValidationResult {
  hasClauseDocument: boolean;
  verifiedCount: number;
  phantomCount: number;
  mandatoryMissingCount: number;
  optionalMissingCount: number;
  scoreImpact: number;
  results?: Array<{
    coverageName: string;
    status: 'VERIFIED' | 'PHANTOM' | 'MANDATORY_MISSING' | 'OPTIONAL_MISSING';
    isMandatory: boolean;
    alertLevel?: 'CRITICAL' | 'WARNING' | 'INFO';
  }>;
}

export interface DeductibleAnalysis {
  coverageName: string;
  quoteDeductible: string;
  clauseDeductible: string;
  insuredAmount: number;
  deductibleAmount: number;
  deductibleRatio: number;
  hasCap: boolean;
  capAmount?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  recommendation?: string;
}

export interface ContextualRisk {
  exclusions: Array<{
    exclusion: string;
    baseRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    contextualRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    explanation: string;
    mitigationSuggestions: string[];
  }>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  hasProfile: boolean;
}

export interface WarrantyCompliance {
  totalConditions: number;
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  compliancePercentage: number;
  byType: {
    documental: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
    operacional: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
    tecnico: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
    financiero: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
  };
  highRiskConditions: Array<{
    text: string;
    type: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    complianceRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

export interface LegalOpinion {
  coverageName: string;
  riskScenario: string;
  clauseInterpretation: string;
  recommendation: string;
  negotiationPoints: Array<{
    point: string;
    rationale: string;
    expectedOutcome: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  citations: Array<{
    text: string;
    section: string;
    pageNumber: number;
    documentName: string;
  }>;
  confidence: number;
}

export interface ComparisonReport {
  id?: string;
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
  citations?: ChatCitation[];
  source?: 'rag' | 'ontology' | 'fallback' | 'direct';
}

export interface ChatCitation {
  id: string;
  insurerName: string;
  content: string;
  pageNumber: number;
  similarityScore: number;
}

export interface Evidence {
  id: string;
  documentId: string;
  insurerName: string;
  sectionType: string;
  content: string;
  pageNumber: number;
  similarityScore: number;
}

export interface EnrichedAlert {
  title: string;
  description: string;
  level: AlertLevel;
  insurerName: string;
  evidence: Evidence[];
  analysisType: 'rag_enriched' | 'quote_based';
  businessContext?: string;
}

export interface CrossInsurerRisk {
  riskTitle: string;
  riskDescription: string;
  affectedInsurers: string[];
  severity: AlertLevel;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
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

// --- MATRIX COMPARISON TYPES ---

export type MatrixRowType = 'header' | 'data' | 'spacer';

export interface MatrixCell {
  value: string;
  isExcluded: boolean;
  isWinner: boolean;
  notes?: string;
  pageNumber?: number;
  confidence?: number;
  rawTextSnippet?: string;
  needsHumanReview?: boolean;
  calculatedPage?: number;
  justification?: string;
  canonicalName?: string;
  matchMethod?: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
}

export interface MatrixRow {
  type: MatrixRowType;
  id: string;
  label: string;
  sectionId: number;
  cells: MatrixCell[];
}
