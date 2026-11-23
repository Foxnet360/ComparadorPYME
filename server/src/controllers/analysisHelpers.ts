import { ParsedQuote } from '../services/quoteParser';
import { type CrossReferenceResult } from '../services/crossReferenceEngine';
import { type ScoringResult, type ScoreBreakdown } from '../services/quoteScorer';
import { type NarrativeResult } from '../services/narrativeService';
import { type ValidationResult } from '../services/quoteValidator';
import { type ConfidenceResult, type ConfidenceBreakdown } from '../services/confidenceScorer';
import { type ClauseValidationSummary } from '../services/clauseCoverageValidator';
import quoteBasedAuditor from '../services/quoteBasedAuditor';
import { formatCOP } from '../utils/formatCurrency';
import { AlertItem, AlertLevel, MatrixRow, QuoteAnalysis } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { InsuranceDomain, isInsuranceDomain } from '../types/domain';
import { AppError } from '../errors';
import { AnalysisType } from '../services/unifiedComparison/comparisonSchema';
import {
  extractMatrixInsurers,
  alignInsurerIndices,
  normalizeInsurerName,
} from '../services/unifiedComparison/matrixTransformer';
import {
  matrixRowsToComparisonReport,
  type UnifiedQuote,
  type UnifiedComparisonReport,
} from '../services/unifiedComparison/reportBuilderService';

export {
  matrixRowsToComparisonReport,
  extractMatrixInsurers,
  normalizeInsurerName,
  alignInsurerIndices,
  type UnifiedQuote,
  type UnifiedComparisonReport,
};

export interface DualExtractionResult {
  coverageName: string;
  firstExtraction: {
    value: string;
    deductible: string;
    confidence: number;
  };
  secondExtraction: {
    value: string;
    deductible: string;
    confidence: number;
  };
  discrepancy: number;
  isDiscrepancy: boolean;
  recommendation: string;
}

/**
 * ERR-1: map legacy upstream failures onto operational AppErrors so the
 * central errorHandler can answer with the right status code and traceId.
 */
export function toHttpError(error: unknown): Error {
  if (error instanceof Error && error.message?.includes('No response received')) {
    return new AppError('Upstream Error: No response from Gemini AI.', 502);
  }
  if (error instanceof Error && error.message?.includes('429')) {
    return new AppError('Rate Limit Exceeded: Please try again later.', 429);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export interface ComparisonResultQuote {
  insurerName: string;
  policyName: string;
  priceAnnual: number;
  currency: string;
  deductibles: string;
  coverages: Array<{
    name: string;
    value: string;
    deductible: string;
    canonicalName?: string;
    categoryId?: number | string | null;
    matchConfidence?: number;
    matchMethod?: string | null;
  }>;
  score: number;
  dataQualityScore: number;
  verificationConfidence: number;
  isRagAvailable: boolean;
  parseConfidence: number;
  dualExtractionValidation: DualExtractionResult[];
  specialConditions?: string[];
  scoringBreakdown: ScoreBreakdown;
  clientAnalysis: string;
  technicalAnalysis: string;
  keyFindings: string[];
  alerts: AlertItem[];
  crossReferenceSummary: Record<string, number>;
  extractionConfidence: number;
  confidenceBreakdown: ConfidenceBreakdown | null;
  needsReview: boolean;
  isCritical: boolean;
  validationFlags: unknown[];
  validationSummary: string;
  clauseValidation?: Record<string, unknown>;
  deductibleAnalysis?: unknown;
  contextualRisk?: unknown;
  warrantyCompliance?: unknown;
  legalOpinion?: unknown;
  quoteAudit?: Record<string, unknown>;
}

export interface ComparisonResult {
  quotes: ComparisonResultQuote[];
  recommendation: string;
  marketAnalysis: string;
  deductibleComparison: { insurer: string; deductibleText: string }[];
  timestamp: string;
  analysisVersion: string;
  id?: string;
  matrix?: MatrixRow[];
  quoteMetadata?: unknown[];
  schemaVersion?: 1 | 2 | 3;
  domain?: InsuranceDomain;
  analysisType?: AnalysisType;
  policyId?: string;
  renewalId?: string;
  clientInfo?: {
    name: string;
    nit?: string;
    activity: string;
    location: string;
    address?: string;
    city?: string;
    department?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    vigencia?: string;
    tipoSeguro?: string;
    anoConstruccion?: string | number;
    pisos?: string | number;
    seismicZone?: string;
    buildingType?: string;
  };
}

/**
 * Resolve the effective user id for /api/analyze.
 *
 * Only an authenticated user's id is trusted for per-user feature-rollout
 * bucketing; anonymous traffic is bucketed as 'anonymous'.
 */
export function resolveAnalysisUserId(req: AuthenticatedRequest): string {
  return req.user?.id ?? 'anonymous';
}

export interface AnalysisDomainResolution {
  domain: InsuranceDomain;
  error?: string;
}

/**
 * Resolve and validate the `domain` parameter for /api/analyze.
 */
export function resolveAnalysisDomain(rawDomain: unknown): AnalysisDomainResolution {
  if (rawDomain === undefined || rawDomain === null || rawDomain === '') {
    return { domain: 'pyme' };
  }

  const normalizedDomain =
    rawDomain === 'casco'
      ? 'casco_embarcacion'
      : rawDomain === 'equipo'
        ? 'equipo_maquinaria'
        : rawDomain;

  if (isInsuranceDomain(normalizedDomain)) {
    return { domain: normalizedDomain };
  }

  return {
    domain: 'pyme',
    error: `Invalid domain "${rawDomain}". Allowed values: pyme, autos, copropiedades, vida_grupo, salud, cumplimiento, transporte, hogar, equipo_maquinaria, casco_embarcacion.`,
  };
}

export function generateComparison(
  quotes: ParsedQuote[],
  scoringResults: Map<number, ScoringResult>,
  narrativeResults: Map<number, NarrativeResult>,
  crossRefResults: Map<number, CrossReferenceResult[]>,
  validationResults: Map<number, ValidationResult>,
  confidenceResults: Map<number, ConfidenceResult>,
  clauseValidationResults?: Map<number, ClauseValidationSummary | null>,
  advancedAnalysisResults?: Map<number, Record<string, unknown> | null>,
  dualExtractionResults?: Map<number, DualExtractionResult[]>,
  insurersWithClauses?: Map<string, boolean>,
  domain?: InsuranceDomain | string
) {
  const quotesWithScores = quotes.map((quote, index) => {
    const scoring = scoringResults.get(index);
    const narrative = narrativeResults.get(index);
    const crossRefs = crossRefResults.get(index) || [];

    const allAlerts = crossRefs.flatMap((r) =>
      r.alerts.map((a) => ({
        level: a.level as AlertLevel,
        title: a.title,
        description: a.description,
      }))
    );

    const validation = validationResults.get(index);
    const confidence = confidenceResults.get(index);
    const clauseValidation = clauseValidationResults?.get(index);
    const advancedAnalysis = advancedAnalysisResults?.get(index);

    return {
      insurerName: quote.insurerName,
      policyName: quote.policyName,
      priceAnnual: quote.priceAnnual,
      currency: quote.currency,
      deductibles:
        quote.coverages.length > 0
          ? quote.coverages.map((c) => `${c.canonicalName || c.name}: ${c.deductible}`).join('; ')
          : 'No especificado',
      coverages: quote.coverages.map((c) => ({
        name: c.canonicalName || c.name,
        value: c.value,
        deductible: c.deductible,
        canonicalName: c.canonicalName,
        categoryId: c.categoryId,
        matchConfidence: c.matchConfidence,
        matchMethod: c.matchMethod,
      })),
      score: scoring?.totalScore || 0,
      dataQualityScore: scoring?.dataQualityScore || 0,
      verificationConfidence: scoring?.verificationConfidence || 0,
      isRagAvailable: insurersWithClauses?.get(quote.insurerName) || false,
      parseConfidence: quote.parseConfidence,
      dualExtractionValidation: dualExtractionResults?.get(index) || [],
      specialConditions: quote.specialConditions,
      scoringBreakdown: scoring?.breakdown || {
        coverage: 0,
        deductibles: 0,
        exclusions: 0,
        priceRatio: 0,
        sublimits: 0,
        warranties: 0,
      },
      clientAnalysis: narrative?.clientAnalysis || '',
      technicalAnalysis: narrative?.technicalAnalysis || '',
      keyFindings: narrative?.keyFindings || [],
      alerts: allAlerts,
      crossReferenceSummary: {
        verifiedCoverages: crossRefs.filter((r) => r.isVerified).length,
        totalCoverages: crossRefs.length,
        criticalAlerts: allAlerts.filter((a) => a.level === 'CRITICAL').length,
        warningAlerts: allAlerts.filter((a) => a.level === 'WARNING').length,
      },
      extractionConfidence: confidence?.score || 0,
      confidenceBreakdown: confidence?.breakdown || null,
      needsReview: confidence?.needsReview || false,
      isCritical: confidence?.isCritical || false,
      validationFlags: validation?.flags || [],
      validationSummary: validation
        ? `${validation.coverageCount}/${validation.expectedCoverageCount} coberturas`
        : '',
      clauseValidation: clauseValidation
        ? {
            hasClauseDocument: clauseValidation.hasClauseDocument,
            verifiedCount: clauseValidation.verifiedCount,
            phantomCount: clauseValidation.phantomCount,
            mandatoryMissingCount: clauseValidation.mandatoryMissingCount,
            optionalMissingCount: clauseValidation.optionalMissingCount,
            scoreImpact: clauseValidation.scoreImpact,
          }
        : undefined,
      deductibleAnalysis: advancedAnalysis?.deductibleAnalysis,
      contextualRisk: advancedAnalysis?.contextualRisk,
      warrantyCompliance: advancedAnalysis?.warrantyCompliance,
      legalOpinion: advancedAnalysis?.legalOpinion,
      quoteAudit: (() => {
        const audit = quoteBasedAuditor.auditQuote(
          {
            insurerName: quote.insurerName,
            policyName: quote.policyName,
            priceAnnual: quote.priceAnnual,
            currency: quote.currency,
            coverages: quote.coverages,
            alerts: [],
            scoringBreakdown: scoring?.breakdown,
            clientAnalysis: narrative?.clientAnalysis || '',
            technicalAnalysis: narrative?.technicalAnalysis || '',
            score: scoring?.totalScore || 0,
            deductibles: quote.coverages.map((c) => c.deductible).join('; '),
            rawText: quote.rawText,
          } as unknown as QuoteAnalysis,
          quotes as unknown as QuoteAnalysis[],
          domain
        );
        return {
          deductibleRisks: audit.deductibleRisks,
          missingCoverages: audit.missingCoverages,
          specialConditions: audit.specialConditions,
          negotiationPoints: audit.negotiationPoints,
          competitiveAdvantages: audit.competitiveAdvantages,
          overallRiskScore: audit.overallRiskScore,
          summary: audit.summary,
        };
      })(),
    };
  });

  quotesWithScores.sort((a, b) => b.score - a.score);
  const bestQuote = quotesWithScores[0];
  const hasCriticalExtraction = quotesWithScores.some((q) => q.isCritical);
  const reviewPrefix = hasCriticalExtraction ? '[REVISIÓN REQUERIDA] ' : '';

  return {
    quotes: quotesWithScores,
    recommendation: bestQuote
      ? `${reviewPrefix}Mejor opción: ${bestQuote.insurerName} con score de ${bestQuote.score}/100. ${bestQuote.clientAnalysis.substring(0, 200)}`
      : `${reviewPrefix}No se pudieron analizar las cotizaciones`,
    marketAnalysis: `Se analizaron ${quotes.length} cotizaciones de seguros PYME. ${
      bestQuote
        ? `El rango de precios es de ${formatCOP(Math.min(...quotesWithScores.map((q) => q.priceAnnual || Infinity)))} a ${formatCOP(Math.max(...quotesWithScores.map((q) => q.priceAnnual || 0)))} ${bestQuote.currency}.`
        : ''
    }${hasCriticalExtraction ? ' ATENCIÓN: Algunas extracciones tienen baja confianza y requieren verificación manual.' : ''}`,
    deductibleComparison: quotesWithScores.map((q) => ({
      insurer: q.insurerName,
      deductibleText:
        q.coverages.length > 0
          ? q.coverages.map((c) => `${c.name}: ${c.deductible}`).join('; ')
          : 'No especificado',
    })),
    timestamp: new Date().toISOString(),
    analysisVersion: '2.0-rag',
  };
}

export interface QuoteMetadataEntry {
  insurer?: string;
  cliente?: string;
  documento?: string;
  actividadOcupacion?: string;
  ubicacionRiesgo?: string;
  vigencia?: string;
  tipoSeguro?: string;
  anoConstruccion?: string;
  pisos?: string;
  [key: string]: unknown;
}

export interface ClientProfileInput {
  name?: string;
  nit?: string;
  industry?: string;
  address?: string;
  city?: string;
  department?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  constructionYear?: string;
  floorsCount?: string;
  seismicZone?: string;
  buildingType?: string;
}

export function resolveClientInfoFromRequest(
  body: Record<string, unknown> | undefined,
  quoteMetadata: unknown,
  domain: InsuranceDomain
): { clientName: string; clientInfo: NonNullable<ComparisonResult['clientInfo']> } {
  let parsedClientProfile: ClientProfileInput | null = null;
  if (body?.clientProfile) {
    try {
      parsedClientProfile = (
        typeof body.clientProfile === 'string' ? JSON.parse(body.clientProfile) : body.clientProfile
      ) as ClientProfileInput;
    } catch {
      // ignore json parse error
    }
  }

  const quoteMetadataList = (
    Array.isArray(quoteMetadata) ? quoteMetadata : []
  ) as QuoteMetadataEntry[];
  const extractedClientName = quoteMetadataList.find((m) => m?.cliente)?.cliente;
  const bodyClientName = typeof body?.clientName === 'string' ? body.clientName : undefined;
  const clientName =
    parsedClientProfile?.name ||
    (bodyClientName && bodyClientName !== 'Cliente' && bodyClientName !== 'Prospecto General'
      ? bodyClientName
      : extractedClientName || bodyClientName || 'Cliente');

  const clientNit =
    parsedClientProfile?.nit ||
    quoteMetadataList.find((m) => m?.documento)?.documento ||
    (typeof body?.clientNit === 'string' ? body.clientNit : undefined);

  const clientActivity =
    parsedClientProfile?.industry ||
    (typeof body?.clientActivity === 'string' ? body.clientActivity : undefined) ||
    quoteMetadataList.find((m) => m?.actividadOcupacion)?.actividadOcupacion ||
    (domain === 'copropiedades'
      ? 'Edificio Residencial / Comercial (Copropiedad)'
      : domain === 'autos'
        ? 'Vehículo Particular / Flotas'
        : domain === 'hogar'
          ? 'Vivienda Residencial / Hogar'
          : 'Comercial / PYME');

  const clientLocation =
    [parsedClientProfile?.address, parsedClientProfile?.city, parsedClientProfile?.department]
      .filter(Boolean)
      .join(', ') ||
    (typeof body?.clientLocation === 'string' ? body.clientLocation : undefined) ||
    quoteMetadataList.find((m) => m?.ubicacionRiesgo)?.ubicacionRiesgo ||
    (parsedClientProfile?.city ? `${parsedClientProfile.city}, Colombia` : 'Colombia');

  return {
    clientName,
    clientInfo: {
      name: clientName,
      nit: clientNit || undefined,
      activity: clientActivity,
      location: clientLocation,
      address: parsedClientProfile?.address || undefined,
      city: parsedClientProfile?.city || undefined,
      department: parsedClientProfile?.department || undefined,
      contactPerson: parsedClientProfile?.contactPerson || undefined,
      email: parsedClientProfile?.email || undefined,
      phone: parsedClientProfile?.phone || undefined,
      vigencia: quoteMetadataList.find((m) => m?.vigencia)?.vigencia || undefined,
      tipoSeguro: quoteMetadataList.find((m) => m?.tipoSeguro)?.tipoSeguro || undefined,
      anoConstruccion:
        parsedClientProfile?.constructionYear ||
        quoteMetadataList.find((m) => m?.anoConstruccion)?.anoConstruccion ||
        undefined,
      pisos:
        parsedClientProfile?.floorsCount ||
        quoteMetadataList.find((m) => m?.pisos)?.pisos ||
        undefined,
      seismicZone: parsedClientProfile?.seismicZone || undefined,
      buildingType: parsedClientProfile?.buildingType || undefined,
    },
  };
}
