export { InsuranceDomain } from './src/shared/insuranceDomain';
export type { InsuranceDomainType } from './src/shared/insuranceDomain';

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
  id?: string;
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
  id?: string;
  quotes: QuoteAnalysis[];
  recommendation: string;
  marketAnalysis: string;
  deductibleComparison: {
    insurer: string;
    deductibleText: string;
  }[];
  matrix?: MatrixRow[]; // Synced backend rows
  quoteMetadata?: QuoteMetadata[]; // Extracted risk details
  schemaVersion?: 1 | 2 | 3; // 3 = renewal (v2 + baseline + analytics), 2 = V2 granular, 1/missing = legacy V1
  /** Renewal mode only (schemaVersion 3): incumbent baseline + per-candidate analytics. */
  baseline?: RenewalBaseline;
  renewalAnalytics?: CandidateRenewalAnalytics[];
  domain?: string;
  clientInfo?: {
    name?: string;
    activity?: string;
    location?: string;
  };
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
  registrationNumber?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
  password?: string; // Stored locally
  agentDetails?: {
    phone: string;
    field: string; // Ramo
    bio?: string;
    registrationNumber?: string;
    address?: string;
    city?: string;
    logoUrl?: string;
  };
}

export interface Client {
  id: string;
  name: string; // Razón Social o Nombre del Edificio/Conjunto
  nit: string; // Identificación Tributaria
  contactPerson?: string;
  email?: string;
  phone?: string;
  industry?: string;
  // Georeferencing & Extended Copropiedad fields
  address?: string;
  city?: string;
  department?: string;
  latitude?: number;
  longitude?: number;
  seismicZone?: 'Alta' | 'Intermedia' | 'Baja';
  buildingType?: 'Residencial' | 'Comercial' | 'Mixta';
  towersCount?: number;
  unitsCount?: number;
  floorsCount?: number;
  constructionYear?: number;
  hasElevators?: boolean;
  hasPowerPlant?: boolean;
  // Domain-specific Rich Attributes (enrichment for AI analysis)
  domainDetails?: {
    commercialAssetsValue?: number;
    employeeCount?: number;
    activitySector?: string;
    fireProtectionSystem?: string;
    securityGuard247?: boolean;
    constructionType?: string;
    transitCargoType?: string;
    maxDispatchValue?: number;
    frequentRoutes?: string;
    machineryReplacementValue?: number;
    hasPreventiveMaintenance?: boolean;
  };
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'SOLD' | 'LOST';

export interface HistoryEntry {
  id: string;
  userId?: string; // Owner of the record
  clientId?: string;
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
  rawName?: string;
  /** Renewal mode (schemaVersion 3): this cell belongs to the baseline column. */
  isBaseline?: boolean;
}

export interface MatrixRow {
  type: MatrixRowType;
  id: string;
  label: string;
  sectionId: number;
  cells: MatrixCell[];
}

// --- RBAC & EXECUTIVE ANALYTICS TYPES ---

export type UserRole = 'super_admin' | 'ally_admin' | 'ally_technical';

export interface Ally {
  id: string;
  name: string;
  nit?: string;
  createdAt?: string;
}

export interface ExtendedUserProfile extends Omit<UserProfile, 'role'> {
  role: UserRole;
  allyId?: string;
  allyName?: string;
}

export interface AnalystPerformance {
  analystId: string;
  analystName: string;
  totalComparisons: number;
  soldCount: number;
  conversionRate: number;
  totalPremium: number;
  avgTimeMinutes: number;
  topDomain: string;
}

export interface ExecutiveAnalyticsData {
  role: UserRole;
  allyId?: string;
  allyName?: string;
  totalComparisons: number;
  soldCount: number;
  conversionRate: number;
  totalPremium: number;
  activeProspects: number;
  avgProcessTimeMinutes: number;
  domainDistribution: Array<{
    domainId: string;
    domainName: string;
    count: number;
    percentage: number;
  }>;
  insurerDistribution: Array<{ insurerName: string; count: number; percentage: number }>;
  analystPerformance?: AnalystPerformance[];
  aiBenchmarks?: {
    overallAccuracy: number;
    thesaurusExactRate: number;
    fuzzyMatchRate: number;
    embeddingMatchRate: number;
    avgApiLatencyMs: number;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    avgCostPerComparisonUSD?: number;
    avgCostPerComparisonCOP?: number;
    totalEstimatedCostUSD?: number;
    allyTokenBreakdown?: Array<{
      allyName: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUSD: number;
    }>;
  };
}

// --- RENEWAL PORTFOLIO (renovacion-polizas) ---
// Mirrors the backend portfolio API (PR-2/PR-4). Ownership is always derived
// from the session server-side; these shapes never carry userId.

export interface PortfolioClient {
  id: string;
  name: string;
  tax_id?: string | null;
  contact?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export type PolicyProvenance = 'analysis' | 'incumbent_pdf' | 'manual';

export interface PortfolioPolicy {
  id: string;
  client_id: string;
  ramo: string;
  insurer: string;
  policy_number?: string | null;
  premium?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  provenance?: PolicyProvenance;
  coverages?: unknown[] | null;
  deductibles?: unknown[] | null;
  source_analysis_id?: string | null;
  ramo_details?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export type RenewalState = 'detected' | 'notified' | 'in_review' | 'quoted' | 'closed';

export type RenewalOutcome = 'renewed_same_insurer' | 'renewed_competitor' | 'lost';

export interface PortfolioRenewal {
  id: string;
  policy_id: string;
  cycle_start: string;
  state: RenewalState;
  outcome?: RenewalOutcome | null;
  final_premium?: number | null;
  loss_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RenewalEvent {
  id: string;
  renewal_id: string;
  from_state: RenewalState | null;
  to_state: RenewalState;
  actor_id?: string | null;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface RenewalTransitionInput {
  to: RenewalState;
  outcome?: RenewalOutcome;
  final_premium?: number;
  loss_reason?: string;
}

export interface CampaignConfig {
  windows: number[];
  enabled: boolean;
}

// --- RENEWAL COMPARISON (schemaVersion 3) ---
// v3 = v2 + baseline column (MatrixCell.isBaseline) + renewalAnalytics block.
// Present ONLY on renewal analyses; NEW-mode reports never carry these (XC-3).

export interface RenewalBaselineCoverage {
  name: string;
  value: string | null;
  deductible: string | null;
}

export interface RenewalBaseline {
  insurerName: string;
  priceAnnual: number | null;
  coverages: RenewalBaselineCoverage[];
}

export interface RenewalGapAnalysis {
  coveragesLost: string[];
  coveragesGained: string[];
  deductibleWorsening: string[];
  newExclusions: string[];
}

export interface RenewalPremiumDelta {
  absolute: number | null;
  percentage: number | null;
  direction: 'increase' | 'decrease' | 'equal' | 'unknown';
}

export interface CandidateRenewalAnalytics {
  insurer: string;
  gaps: RenewalGapAnalysis;
  premiumDelta: RenewalPremiumDelta;
  friction: string[];
}
