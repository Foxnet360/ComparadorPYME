import { Response, NextFunction } from 'express';
import fs from 'fs';

import { ParsedQuote } from '../services/quoteParser';
import { type CrossReferenceResult } from '../services/crossReferenceEngine';
import { quoteScorer, type ScoringResult, type ScoreBreakdown } from '../services/quoteScorer';
import { type NarrativeResult } from '../services/narrativeService';
import { type ValidationResult } from '../services/quoteValidator';
import { type ConfidenceResult, type ConfidenceBreakdown } from '../services/confidenceScorer';
import { type ClauseValidationSummary, checkClauseDocumentExists } from '../services/clauseCoverageValidator';
import { type DualExtractionResult } from '../services/dualExtractionService';
import { isMultimodalEnabled } from '../services/quoteProcessingService';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { AnalysisType } from '../services/unifiedComparison/comparisonSchema';
import {
  FINANCIAL_SECTION_ID,
  isFinancialRowLabel,
  alignMatrixRowsToQuotes,
  extractMatrixInsurers,
  alignInsurerIndices,
  normalizeInsurerName,
} from '../services/unifiedComparison/matrixTransformer';
import {
  extractCanonicalInsurerName,
  isKnownCanonicalInsurer,
} from '../services/unifiedComparison/insurerSanitizer';
import { semanticMatcher } from '../services/semanticMatcher';

import { saveAnalysisHistory, getAnalysisHistoryByUser } from '../repositories/analysisRepository';
import { getPolicyById } from '../repositories/policyRepository';
import { supabase } from '../config/database';
import { ensureClausePersistedInLibrary } from '../services/documentIndexingService';
import { formatCOP } from '../utils/formatCurrency';
import { parseColombianCurrency } from '../utils/currencyParser';
import { sanitizeDeep } from '../utils/textSanitizer';
import { auditGroundedComparison } from '../services/groundingAuditor';
import quoteBasedAuditor from '../services/quoteBasedAuditor';

import { AlertItem, AlertLevel, MatrixRow, QuoteAnalysis } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { InsuranceDomain, isInsuranceDomain } from '../types/domain';
import { AppError } from '../errors';
import logger from '../config/logger';

/**
 * ERR-1: map legacy upstream failures onto operational AppErrors so the
 * central errorHandler can answer with the right status code and traceId.
 */
function toHttpError(error: unknown): Error {
  if (error instanceof Error && error.message?.includes('No response received')) {
    return new AppError('Upstream Error: No response from Gemini AI.', 502);
  }
  if (error instanceof Error && error.message?.includes('429')) {
    return new AppError('Rate Limit Exceeded: Please try again later.', 429);
  }
  return error instanceof Error ? error : new Error(String(error));
}

interface ComparisonResultQuote {
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

interface ComparisonResult {
  quotes: ComparisonResultQuote[];
  recommendation: string;
  marketAnalysis: string;
  deductibleComparison: { insurer: string; deductibleText: string }[];
  timestamp: string;
  analysisVersion: string;
  id?: string;
  matrix?: MatrixRow[];
  quoteMetadata?: any[];
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

import {
  matrixRowsToComparisonReport,
  type UnifiedQuote,
  type UnifiedComparisonReport,
} from '../services/unifiedComparison/reportBuilderService';
export { matrixRowsToComparisonReport, type UnifiedQuote, type UnifiedComparisonReport };

/**
 * Resolve the effective user id for /api/analyze.
 *
 * The endpoint uses optional authentication. Only an authenticated user's id
 * is trusted for per-user feature-rollout bucketing; a client-supplied
 * body userId is NEVER trusted (spoofing vector — callers sending one get a
 * 400 from uploadAndAnalyze). Anonymous traffic is bucketed as 'anonymous'.
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
 *
 * - Missing/empty/undefined → `pyme` (default, backward compatible).
 * - `pyme` or `autos` → accepted as-is.
 * - Anything else → validation error (HTTP 400).
 */
export function resolveAnalysisDomain(rawDomain: unknown): AnalysisDomainResolution {
  if (rawDomain === undefined || rawDomain === null || rawDomain === '') {
    return { domain: 'pyme' };
  }

  if (isInsuranceDomain(rawDomain)) {
    return { domain: rawDomain };
  }

  return {
    domain: 'pyme',
    error: `Invalid domain "${rawDomain}". Allowed values: pyme, autos, copropiedades, vida_grupo, salud, cumplimiento, transporte, hogar, equipo_maquinaria, casco_embarcacion.`,
  };
}

export const analysisController = {
  uploadAndAnalyze: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const quoteFiles = files?.['quotes'] || [];
    const clauseFiles = files?.['clauses'] || [];
    const allUploadedFiles = [...quoteFiles, ...clauseFiles];
    let filesCleanedUp = false;
    const cleanupUploadedFiles = () => {
      if (filesCleanedUp) return;
      filesCleanedUp = true;
      allUploadedFiles.forEach((f) => {
        try {
          if (f && f.path) {
            fs.unlinkSync(f.path);
          }
        } catch (e) {
          logger.warn({ err: e }, `Failed to delete temp file ${f.path}`);
        }
      });
    };

    try {
      // AUTH-2: ownership is derived from the authenticated session; a
      // client-supplied userId is a spoofing vector and is rejected.
      if ((req.body as Record<string, unknown> | undefined)?.userId !== undefined) {
        cleanupUploadedFiles();
        res.status(400).json({
          success: false,
          error: 'userId is derived from the authenticated session; do not send it',
        });
        return;
      }

      const userId = resolveAnalysisUserId(req);

      if (quoteFiles.length === 0) {
        cleanupUploadedFiles();
        res.status(400).json({ success: false, error: 'No quote files uploaded' });
        return;
      }

      const domainResolution = resolveAnalysisDomain(req.body?.domain);
      if (domainResolution.error) {
        cleanupUploadedFiles();
        res.status(400).json({ success: false, error: domainResolution.error });
        return;
      }
      const domain = domainResolution.domain;

      // Permanent Clause Library (Issue 8): persist and deduplicate any uploaded clauses
      if (clauseFiles.length > 0) {
        for (const cf of clauseFiles) {
          try {
            if (cf.path && fs.existsSync(cf.path)) {
              const buffer = fs.readFileSync(cf.path);
              await ensureClausePersistedInLibrary(
                buffer,
                cf.originalname,
                req.body?.insurerName || 'Aseguradora',
                domain
              );
            }
          } catch (clauseErr) {
            logger.warn({ err: clauseErr, file: cf.originalname }, 'Failed to auto-persist clause in permanent library');
          }
        }
      }

      // Parse clauseIds selected from persistent library
      let selectedClauseIds: string[] = [];
      if (req.body?.clauseIds) {
        try {
          selectedClauseIds =
            typeof req.body.clauseIds === 'string'
              ? JSON.parse(req.body.clauseIds)
              : req.body.clauseIds;
          if (!Array.isArray(selectedClauseIds)) {
            selectedClauseIds = [];
          }
        } catch (e) {
          logger.warn({ err: e }, 'Failed to parse clauseIds from req.body');
        }
      }

      const rawAnalysisType = req.body?.analysisType ?? req.body?.analysis_type;
      const analysisType: AnalysisType | undefined =
        rawAnalysisType === 'renewal' ? 'renewal' : undefined;
      const policyId =
        typeof (req.body?.policyId ?? req.body?.policy_id) === 'string'
          ? (req.body.policyId ?? req.body.policy_id).trim()
          : undefined;
      const renewalId =
        typeof (req.body?.renewalId ?? req.body?.renewal_id) === 'string'
          ? (req.body.renewalId ?? req.body.renewal_id).trim()
          : undefined;

      let referenceQuote: ParsedQuote | undefined;
      if (analysisType === 'renewal' && policyId && userId) {
        try {
          const policy = await getPolicyById(userId, policyId);
          if (policy) {
            referenceQuote = {
              insurerName: policy.insurer,
              policyName: policy.policy_number ? `Póliza ${policy.policy_number}` : 'Póliza Actual',
              priceAnnual: Number(policy.premium) || 0,
              currency: 'COP',
              coverages: Array.isArray(policy.coverages) ? (policy.coverages as any) : [],
              specialConditions: [],
              rawText: '',
              parseConfidence: 100,
            };
          }
        } catch (e) {
          logger.warn({ err: e }, `Failed to fetch policy ${policyId} for renewal reference quote`);
        }
      }

      logger.info(`📄 Processing ${quoteFiles.length} quotes...`);
      logger.info(`🔧 Pipeline: ${isMultimodalEnabled() ? 'Multimodal (V2)' : 'Legacy (V1)'}`);
      logger.info(`🌐 Domain: ${domain}`);

      const pdfPaths = quoteFiles.map((f) => f.path);
      const adapterResult = await comparisonEngineAdapter.generateComparison(pdfPaths, {
        userId,
        domain,
        ...(analysisType ? { analysisType } : {}),
        ...(referenceQuote ? { referenceQuote } : {}),
        ...(policyId ? { policyId } : {}),
        ...(renewalId ? { renewalId } : {}),
      });
      const matrixRows = adapterResult.matrix;

      // Debug: Log matrix structure
      logger.info(
        `📊 [Adapter Debug] engine=${adapterResult.engine}, correlationId=${adapterResult.correlationId}, matrix rows: ${matrixRows.length}`
      );
      const dataRows = matrixRows.filter((r) => r.type === 'data');
      logger.info(`📊 [Adapter Debug] Data rows: ${dataRows.length}`);
      if (dataRows.length > 0) {
        logger.info(`📊 [Adapter Debug] First data row: ${JSON.stringify(dataRows[0], null, 2)}`);
      }

      // Convert MatrixRow[] to ComparisonReport format
      const comparisonResult = (await matrixRowsToComparisonReport(matrixRows, quoteFiles, {
        graphEnabled: adapterResult.graphEnabled,
        templateHintsEnabled: adapterResult.templateHintsEnabled,
        domain,
      })) as unknown as ComparisonResult;

      comparisonResult.matrix = comparisonResult.matrix || matrixRows;
      comparisonResult.quoteMetadata = Array.isArray(adapterResult.quoteMetadata)
        ? adapterResult.quoteMetadata.map((m: any) =>
            m && typeof m.insurer === 'string'
              ? { ...m, insurer: extractCanonicalInsurerName(m.insurer) }
              : m
          )
        : adapterResult.quoteMetadata;
      comparisonResult.schemaVersion = adapterResult.schemaVersion;
      comparisonResult.domain = domain;
      if (analysisType) {
        comparisonResult.analysisType = analysisType;
      }
      if (policyId) {
        comparisonResult.policyId = policyId;
      }
      if (renewalId) {
        comparisonResult.renewalId = renewalId;
      }

      // Propagate clause availability when clauseIds are selected from library
      if (selectedClauseIds.length > 0) {
        try {
          const { data: clauseDocs } = await supabase
            .from('document_insurer_view')
            .select('insurer_name, id')
            .in('id', selectedClauseIds);
          const activeInsurers = new Set(
            (clauseDocs || [])
              .map((d: any) => (d.insurer_name || '').toUpperCase().trim())
              .filter(Boolean)
          );
          comparisonResult.quotes?.forEach((q: ComparisonResultQuote) => {
            const insNorm = (q.insurerName || '').toUpperCase().trim();
            if (
              activeInsurers.size === 0 ||
              activeInsurers.has(insNorm) ||
              Array.from(activeInsurers).some(
                (ai: string) => insNorm.includes(ai) || ai.includes(insNorm)
              )
            ) {
              q.isRagAvailable = true;
            }
          });
        } catch (e) {
          logger.warn({ err: e }, 'Failed to map selected clauseIds to insurers');
          comparisonResult.quotes?.forEach((q: ComparisonResultQuote) => {
            q.isRagAvailable = true;
          });
        }
      }

      // Debug: Log result structure
      logger.info(`📊 [Adapter Debug] Quotes generated: ${comparisonResult.quotes?.length || 0}`);
      comparisonResult.quotes?.forEach((q: ComparisonResultQuote, i: number) => {
        logger.info(
          `📊 [Adapter Debug] Quote ${i} (${q.insurerName}): ${q.coverages?.length || 0} coverages, price: ${q.priceAnnual}`
        );
      });

      // Client Info Resolution (Priority: Client Profile / CRUD > req.body > Quote Metadata > Defaults)
      let parsedClientProfile: any = null;
      if (req.body.clientProfile) {
        try {
          parsedClientProfile =
            typeof req.body.clientProfile === 'string'
              ? JSON.parse(req.body.clientProfile)
              : req.body.clientProfile;
        } catch {
          // ignore json parse error
        }
      }

      const extractedMetaClient = adapterResult.quoteMetadata?.find(
        (m: any) => m?.cliente
      );
      const extractedClientName = extractedMetaClient?.cliente;
      const clientName =
        parsedClientProfile?.name ||
        (req.body.clientName && req.body.clientName !== 'Cliente' && req.body.clientName !== 'Prospecto General'
          ? req.body.clientName
          : extractedClientName || req.body.clientName || 'Cliente');

      const clientNit =
        parsedClientProfile?.nit ||
        adapterResult.quoteMetadata?.find((m: any) => m?.documento)?.documento ||
        req.body.clientNit;

      const clientActivity =
        parsedClientProfile?.industry ||
        req.body.clientActivity ||
        adapterResult.quoteMetadata?.find((m: any) => m?.actividadOcupacion)?.actividadOcupacion ||
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
        req.body.clientLocation ||
        adapterResult.quoteMetadata?.find((m: any) => m?.ubicacionRiesgo)?.ubicacionRiesgo ||
        (parsedClientProfile?.city ? `${parsedClientProfile.city}, Colombia` : 'Colombia');

      comparisonResult.domain = domain;
      comparisonResult.clientInfo = {
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
        vigencia: adapterResult.quoteMetadata?.find((m: any) => m?.vigencia)?.vigencia || undefined,
        tipoSeguro: adapterResult.quoteMetadata?.find((m: any) => m?.tipoSeguro)?.tipoSeguro || undefined,
        anoConstruccion:
          parsedClientProfile?.constructionYear ||
          adapterResult.quoteMetadata?.find((m: any) => m?.anoConstruccion)?.anoConstruccion ||
          undefined,
        pisos:
          parsedClientProfile?.floorsCount ||
          adapterResult.quoteMetadata?.find((m: any) => m?.pisos)?.pisos ||
          undefined,
        seismicZone: parsedClientProfile?.seismicZone || undefined,
        buildingType: parsedClientProfile?.buildingType || undefined,
      };

      try {
        const avgConfidence =
          comparisonResult.quotes.reduce(
            (sum: number, q: ComparisonResultQuote) => sum + (q.extractionConfidence || 0),
            0
          ) / (comparisonResult.quotes.length || 1);

        const duration = Date.now() - startTime;

        const insertData = {
          user_id: userId,
          client_name: clientName,
          domain: domain,
          analysis_result: comparisonResult,
          recommendation: comparisonResult.recommendation || null,
          total_score: comparisonResult.quotes?.[0]?.score || null,
          extraction_confidence: Math.round(avgConfidence),
          needs_review: comparisonResult.quotes.some((q: ComparisonResultQuote) => q.needsReview),
          validation_flags_count: comparisonResult.quotes.reduce(
            (sum: number, q: ComparisonResultQuote) => sum + (q.validationFlags?.length || 0),
            0
          ),
          engine_type: adapterResult.engine,
          processing_time_ms: duration,
          confidence_score: Math.round(avgConfidence),
          unified_result: comparisonResult,
          fallback_reason: adapterResult.fallbackReason || null,
          correlation_id: adapterResult.correlationId,
          analysis_type: analysisType || null,
          policy_id: policyId || null,
          renewal_id: renewalId || null,
        };

        const savedId = await saveAnalysisHistory(insertData);
        if (savedId) {
          (comparisonResult as ComparisonResult).id = savedId;
        }
      } catch (saveError: unknown) {
        // ERR-1: a failed save must be logged and reach the central error
        // handler via next(error) — temp files are cleaned up either way.
        logger.error({ err: saveError }, '❌ [Supabase] Exception saving analysis');

        cleanupUploadedFiles();

        next(toHttpError(saveError));
        return;
      }

      // Cleanup temp files
      cleanupUploadedFiles();

      const duration = Date.now() - startTime;
      logger.info(`✅ Analysis completed in ${duration}ms`);

      const auditEnvelope = auditGroundedComparison(comparisonResult);
      res.json(auditEnvelope.result);
    } catch (error: unknown) {
      cleanupUploadedFiles();
      // ERR-1: forward to the central error handler instead of sending a raw
      // response from the controller — the handler attaches the traceId.
      logger.error({ err: error }, 'Controller Error: uploadAndAnalyze failed');
      next(toHttpError(error));
    }
  },

  getHistory: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // AUTH-2: ownership is derived from the authenticated session; a
      // client-supplied userId query param is a spoofing vector.
      if (req.query.userId !== undefined) {
        res.status(400).json({
          success: false,
          error: 'userId is derived from the authenticated session; do not send it',
        });
        return;
      }

      const userId = req.user?.id ?? 'anonymous';

      const rawLimit = req.query.limit;
      const rawOffset = req.query.offset;
      const limit = rawLimit !== undefined ? parseInt(rawLimit as string, 10) : 20;
      const offset = rawOffset !== undefined ? parseInt(rawOffset as string, 10) : 0;

      if (Number.isNaN(limit) || Number.isNaN(offset) || limit < 1 || offset < 0) {
        res.status(400).json({ success: false, error: 'Invalid pagination parameters' });
        return;
      }

      const history = await getAnalysisHistoryByUser(userId);
      res.json({
        success: true,
        data: history.slice(offset, offset + limit),
        pagination: { limit, offset, total: history.length },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching history');
      next(error);
    }
  },
};

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

    // Collect all alerts
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
      // Quote-based audit (independent of RAG)
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

  // Sort by score (descending)
  quotesWithScores.sort((a, b) => b.score - a.score);

  const bestQuote = quotesWithScores[0];

  // Check if any quote has critical confidence
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

// Note: matrixRowsToComparisonReport has been extracted to reportBuilderService.ts
// and is re-exported at the top of this file for backward compatibility.

// ---------------------------------------------------------------------------
// Insurer alignment helpers (re-exported from matrixTransformer for backward compatibility)
// ---------------------------------------------------------------------------
export { extractMatrixInsurers, normalizeInsurerName, alignInsurerIndices };
