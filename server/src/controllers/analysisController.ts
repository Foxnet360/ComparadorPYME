import { Response } from 'express';
import fs from 'fs';

import { ParsedQuote } from '../services/quoteParser';
import { type CrossReferenceResult } from '../services/crossReferenceEngine';
import { quoteScorer, type ScoringResult, type ScoreBreakdown } from '../services/quoteScorer';
import { type NarrativeResult } from '../services/narrativeService';
import { type ValidationResult } from '../services/quoteValidator';
import { type ConfidenceResult, type ConfidenceBreakdown } from '../services/confidenceScorer';
import { type ClauseValidationSummary } from '../services/clauseCoverageValidator';
import { type DualExtractionResult } from '../services/dualExtractionService';
import { isMultimodalEnabled } from '../services/quoteProcessingService';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { FINANCIAL_SECTION_ID } from '../services/unifiedComparison/matrixTransformer';
import { semanticMatcher } from '../services/semanticMatcher';

import { saveAnalysisHistory, getAnalysisHistoryByUser } from '../repositories/analysisRepository';
import { formatCOP } from '../utils/formatCurrency';
import { parseColombianCurrency } from '../utils/currencyParser';
import quoteBasedAuditor from '../services/quoteBasedAuditor';

import { AlertItem, AlertLevel, MatrixRow, QuoteAnalysis } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { InsuranceDomain, isInsuranceDomain } from '../types/domain';

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
    categoryId?: number | null;
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
  schemaVersion?: 1 | 2;
  domain?: InsuranceDomain;
}

interface UnifiedQuote {
  insurerName: string;
  policyName: string;
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  deductibles: string;
  coverages: Array<{
    name: string;
    value: string;
    deductible: string;
    isPositive: boolean;
    valueSource: 'extracted';
    confidence?: number;
    section?: string;
    categoryId?: number | string | null;
    canonicalName?: string;
    matchConfidence?: number;
    matchMethod?: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
  }>;
  alerts: Array<{
    level: string;
    title: string;
    description: string;
  }>;
  scoringBreakdown: Record<string, number>;
  clientAnalysis: string;
  technicalAnalysis: string;
  score: number;
  extractionConfidence: number;
  needsReview: boolean;
  isCritical: boolean;
  validationFlags: unknown[];
  validationSummary: string;
}

interface UnifiedComparisonReport {
  quotes: UnifiedQuote[];
  recommendation: string;
  marketAnalysis: string;
  deductibleComparison: { insurer: string; deductibleText: string }[];
  timestamp: string;
  analysisVersion: string;
  id?: string;
  matrix?: MatrixRow[];
  quoteMetadata?: any[];
  schemaVersion?: 1 | 2;
}

/**
 * Resolve the effective user id for /api/analyze.
 *
 * The endpoint uses optional authentication. Only an authenticated user's id
 * is trusted for per-user feature-rollout bucketing; without it we intentionally
 * return undefined so anonymous traffic is treated as MISSING rather than being
 * collapsed into a shared 'anonymous' bucket (hashUserId('anonymous') === 75).
 */
export function resolveAnalysisUserId(req: AuthenticatedRequest): string | undefined {
  return req.user?.id;
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
    error: `Invalid domain "${rawDomain}". Allowed values: pyme, autos, copropiedades, vida_grupo, salud, cumplimiento.`,
  };
}

export const analysisController = {
  uploadAndAnalyze: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
      const userId = resolveAnalysisUserId(req);

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const quoteFiles = files?.['quotes'] || [];

      if (quoteFiles.length === 0) {
        res.status(400).json({ success: false, error: 'No quote files uploaded' });
        return;
      }

      const domainResolution = resolveAnalysisDomain(req.body?.domain);
      if (domainResolution.error) {
        res.status(400).json({ success: false, error: domainResolution.error });
        return;
      }
      const domain = domainResolution.domain;

      console.log(`📄 Processing ${quoteFiles.length} quotes...`);
      console.log(`🔧 Pipeline: ${isMultimodalEnabled() ? 'Multimodal (V2)' : 'Legacy (V1)'}`);
      console.log(`🌐 Domain: ${domain}`);

      const pdfPaths = quoteFiles.map((f) => f.path);
      const adapterResult = await comparisonEngineAdapter.generateComparison(pdfPaths, {
        userId,
        domain,
      });
      const matrixRows = adapterResult.matrix;

      // Debug: Log matrix structure
      console.log(
        `📊 [Adapter Debug] engine=${adapterResult.engine}, correlationId=${adapterResult.correlationId}, matrix rows: ${matrixRows.length}`
      );
      const dataRows = matrixRows.filter((r) => r.type === 'data');
      console.log(`📊 [Adapter Debug] Data rows: ${dataRows.length}`);
      if (dataRows.length > 0) {
        console.log(`📊 [Adapter Debug] First data row:`, JSON.stringify(dataRows[0], null, 2));
      }

      // Convert MatrixRow[] to ComparisonReport format
      const comparisonResult = (await matrixRowsToComparisonReport(matrixRows, quoteFiles, {
        graphEnabled: adapterResult.graphEnabled,
        templateHintsEnabled: adapterResult.templateHintsEnabled,
        domain,
      })) as unknown as ComparisonResult;

      comparisonResult.matrix = matrixRows;
      comparisonResult.quoteMetadata = adapterResult.quoteMetadata;
      comparisonResult.schemaVersion = adapterResult.schemaVersion;
      comparisonResult.domain = domain;

      // Debug: Log result structure
      console.log(`📊 [Adapter Debug] Quotes generated: ${comparisonResult.quotes?.length || 0}`);
      comparisonResult.quotes?.forEach((q: ComparisonResultQuote, i: number) => {
        console.log(
          `📊 [Adapter Debug] Quote ${i} (${q.insurerName}): ${q.coverages?.length || 0} coverages, price: ${q.priceAnnual}`
        );
      });

      // Save to Supabase
      const clientName = req.body.clientName || 'Cliente';

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
        };

        const savedId = await saveAnalysisHistory(insertData);
        if (savedId) {
          (comparisonResult as ComparisonResult).id = savedId;
        }
      } catch (saveError: unknown) {
        console.error('❌ [Supabase] Exception saving analysis:', saveError);
      }

      // Cleanup temp files
      quoteFiles.forEach((f) => {
        try {
          if (f && f.path) {
            fs.unlinkSync(f.path);
          }
        } catch (e) {
          console.error(`Failed to delete temp file ${f.path}`, e);
        }
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Analysis completed in ${duration}ms`);

      res.json(comparisonResult);
    } catch (error: unknown) {
      console.error('Controller Error:', error);

      if (error instanceof Error && error.message?.includes('No response received')) {
        res.status(502).json({ error: 'Upstream Error: No response from Gemini AI.' });
        return;
      }
      if (error instanceof Error && error.message?.includes('429')) {
        res.status(429).json({ error: 'Rate Limit Exceeded: Please try again later.' });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error during analysis',
        details: error instanceof Error ? error.message : String(error),
        isMockData: false,
      });
    }
  },

  getHistory: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id || (req.query.userId as string) || 'anonymous';

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
      console.error('Error fetching history:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch history' });
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
  insurersWithClauses?: Map<string, boolean>
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
          quotes as unknown as QuoteAnalysis[]
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

/**
 * Convert MatrixRow[] from unified engine to ComparisonReport format
 */
export async function matrixRowsToComparisonReport(
  matrixRows: MatrixRow[],
  quoteFiles: Express.Multer.File[],
  options?: { graphEnabled?: boolean; templateHintsEnabled?: boolean; domain?: InsuranceDomain }
): Promise<UnifiedComparisonReport> {
  const domain = options?.domain ?? 'pyme';
  // Get insurer names from quote files
  const insurerNames = quoteFiles.map((f) => {
    const name = f.originalname.replace(/COTIZACION.*?-\s*/i, '').replace(/\.pdf$/i, '');
    return name || 'Desconocido';
  });

  // The unified engine builds matrix cells in the order returned by the LLM
  // (result.insurers), which may differ from the upload order. Align cells to
  // quote files by insurer name rather than by raw index to avoid attributing
  // values to the wrong insurer.
  const matrixInsurers = extractMatrixInsurers(matrixRows);
  const indexMap =
    matrixInsurers.length > 0
      ? alignInsurerIndices(insurerNames, matrixInsurers)
      : insurerNames.map((_, idx) => idx);

  // Build intermediate quotes array in a first pass
  const intermediateQuotes = await Promise.all(
    insurerNames.map(async (insurerName, idx) => {
      const coverages: UnifiedQuote['coverages'] = [];
      const alerts: UnifiedQuote['alerts'] = [];
      let priceAnnual = 0;
      const cellIdx = indexMap[idx];
      const cellConfidences: number[] = [];

      // Extract coverages from matrix rows (skip financial rows; premium is handled separately)
      let currentSection: string | undefined;
      const rowsToProcess: Array<{
        label: string;
        value: string;
        deductible: string;
        isExcluded: boolean;
        confidence?: number;
        section?: string;
      }> = [];

      matrixRows.forEach((row) => {
        if (row.type === 'header') {
          currentSection = row.label;
        } else if (row.type === 'data' && row.cells && cellIdx >= 0 && row.cells[cellIdx]) {
          // Financial rows are rendered separately; do not treat them as coverages
          if (row.sectionId === FINANCIAL_SECTION_ID) {
            return;
          }

          const cell = row.cells[cellIdx];
          const value = cell.value || '';

          // Track cell confidence if present
          if (typeof cell.confidence === 'number') {
            cellConfidences.push(cell.confidence);
          }

          // Add warning alerts
          if (row.id?.startsWith('warning_')) {
            if (value && value !== 'No informado') {
              alerts.push({
                level: 'WARNING',
                title: 'Alerta del Motor Unificado',
                description: value,
              });
            }
            return;
          }

          // Regular coverage row
          rowsToProcess.push({
            label: row.label || 'Cobertura',
            value: value === 'No informado' || value === 'N.C.' ? 'No incluido' : value,
            deductible: cell.notes || 'No especificado',
            isExcluded: cell.isExcluded,
            confidence: cell.confidence,
            section: currentSection,
          });
        }
      });

      // Map rows to canonical coverages
      for (const r of rowsToProcess) {
        const row = matrixRows.find(
          (matrixRow) => matrixRow.label === r.label && matrixRow.type === 'data'
        );
        const graphEnabled = options?.graphEnabled ?? false;
        let graphMapping:
          | {
              canonicalName: string;
              matchConfidence: number;
              matchMethod: string | null;
            }
          | undefined =
          graphEnabled && row?.canonicalName
            ? {
                canonicalName: row.canonicalName,
                matchConfidence: row.matchConfidence ?? 0,
                matchMethod: row.matchMethod ?? 'graph',
              }
            : undefined;

        let categoryId: number | null = null;
        if (graphMapping) {
          const categoryMatch = await semanticMatcher.matchCoverage(
            graphMapping.canonicalName,
            domain
          );
          categoryId = categoryMatch?.categoryId ?? null;
        } else {
          const matchResult = await semanticMatcher.matchCoverage(r.label, domain);
          categoryId = matchResult?.categoryId ?? null;
          graphMapping ??= {
            canonicalName: matchResult?.canonicalName ?? r.label,
            matchConfidence: matchResult?.confidence ?? 0,
            matchMethod: (matchResult?.method || null) as
              | 'thesaurus'
              | 'fuzzy'
              | 'embedding'
              | 'llm'
              | null,
          };
        }

        // If unmapped, check if it's a financial/billing/metadata row to skip
        const isUnmapped = categoryId === null;
        if (isUnmapped) {
          const normalizedLabel = r.label
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const billingKeywords = [
            'prima',
            'forma de pago',
            'bienes asegurados',
            'vigencia',
            'tomador',
            'asegurado',
            'poliza',
            'cotizacion',
            'gastos de expedicion',
            'iva',
            'tasa',
            'comision',
            'pago',
            'expedicion',
            'cuotas',
            'total a pagar',
          ];
          const shouldIgnore = billingKeywords.some((kw) => normalizedLabel.includes(kw));
          if (shouldIgnore) {
            continue; // Skip financial/billing rows unless they are mapped
          }
        }

        coverages.push({
          name: r.label,
          value: r.value,
          deductible: r.deductible,
          isPositive: !r.isExcluded,
          valueSource: 'extracted' as const,
          confidence: r.confidence,
          section: r.section,
          categoryId,
          canonicalName: graphMapping.canonicalName,
          matchConfidence: graphMapping.matchConfidence,
          matchMethod: graphMapping.matchMethod as
            | 'thesaurus'
            | 'fuzzy'
            | 'embedding'
            | 'llm'
            | null,
        });
      }

      const avgCellConfidence =
        cellConfidences.length > 0
          ? Math.round(
              (cellConfidences.reduce((sum, val) => sum + val, 0) / cellConfidences.length) * 100
            )
          : 85;

      const parsedQuote: ParsedQuote = {
        insurerName,
        policyName: 'Cotización PYME',
        priceAnnual,
        currency: 'COP',
        coverages: coverages.map((c) => ({
          name: c.name,
          canonicalName: c.canonicalName || c.name,
          value: c.value,
          deductible: c.deductible,
          confidence:
            c.confidence !== undefined ? Math.round(c.confidence * 100) : avgCellConfidence,
          categoryId: typeof c.categoryId === 'number' ? c.categoryId : null,
          matchConfidence: c.matchConfidence,
          matchMethod: c.matchMethod,
          valueSource: 'extracted' as const,
        })),
        specialConditions: alerts.map((a) => a.description),
        rawText: '',
        parseConfidence: avgCellConfidence,
      };

      return {
        insurerName,
        policyName: 'Cotización PYME',
        priceAnnual,
        priceMonthly: Math.round(priceAnnual / 12),
        currency: 'COP',
        deductibles: coverages.map((c) => c.deductible).join('; '),
        coverages,
        alerts,
        avgCellConfidence,
        parsedQuote,
      };
    })
  );

  const allParsedQuotes = intermediateQuotes.map((iq) => iq.parsedQuote);

  // Extract annual premium from V2 financial rows. The V2 prompt uses labels like
  // "Total prima", "Prima con IVA incluido", etc., so the legacy check for
  // "TOTAL A PAGAR" alone leaves priceAnnual as 0.
  const premiumRowLabels = [
    'total a pagar',
    'total prima',
    'prima con iva incluido',
    'prima total',
    'prima',
  ];
  for (const row of matrixRows) {
    if (row.type !== 'data' || row.sectionId !== FINANCIAL_SECTION_ID) continue;
    const normalizedLabel = row.label.toLowerCase();
    if (!premiumRowLabels.some((label) => normalizedLabel.includes(label))) continue;

    for (let i = 0; i < insurerNames.length; i++) {
      const cellIdx = indexMap[i];
      const cell = row.cells[cellIdx];
      if (!cell) continue;

      const numericValue = parseColombianCurrency(cell.value);
      if (numericValue !== null && numericValue > 0) {
        intermediateQuotes[i].priceAnnual = numericValue;
        intermediateQuotes[i].parsedQuote.priceAnnual = numericValue;
        intermediateQuotes[i].priceMonthly = Math.round(numericValue / 12);
      }
    }
  }

  // Second pass: compute scores and risk audits
  const quotes: UnifiedQuote[] = await Promise.all(
    intermediateQuotes.map(async (iq) => {
      const scoringResult = await quoteScorer.calculateScore(
        iq.parsedQuote,
        [],
        allParsedQuotes,
        undefined,
        undefined,
        domain
      );

      const audit = quoteBasedAuditor.auditQuote(
        {
          insurerName: iq.insurerName,
          policyName: iq.policyName,
          priceAnnual: iq.priceAnnual,
          currency: iq.currency,
          coverages: iq.coverages,
          alerts: [],
          scoringBreakdown: { ...scoringResult.breakdown },
          clientAnalysis: `Análisis generado por el Motor Unificado para ${iq.insurerName}`,
          technicalAnalysis: '',
          score: scoringResult.totalScore,
          deductibles: iq.deductibles,
          rawText: '',
        } as unknown as QuoteAnalysis,
        intermediateQuotes as unknown as QuoteAnalysis[]
      );

      const combinedAlerts = [...iq.alerts];
      if (audit.alerts) {
        audit.alerts.forEach((alert) => {
          const exists = combinedAlerts.some(
            (existing) => existing.description === alert.description
          );
          if (!exists) {
            combinedAlerts.push({
              level: alert.level,
              title: alert.title,
              description: alert.description,
            });
          }
        });
      }

      return {
        insurerName: iq.insurerName,
        policyName: iq.policyName,
        priceMonthly: iq.priceMonthly,
        priceAnnual: iq.priceAnnual,
        currency: iq.currency,
        deductibles: iq.deductibles,
        coverages: iq.coverages,
        alerts: combinedAlerts,
        scoringBreakdown: { ...scoringResult.breakdown },
        clientAnalysis:
          audit.summary || `Análisis generado por el Motor Unificado para ${iq.insurerName}`,
        technicalAnalysis: `Puntaje global: ${scoringResult.totalScore}/100. Calidad de datos: ${scoringResult.dataQualityScore}%. Confianza de verificación: ${scoringResult.verificationConfidence}%.`,
        score: scoringResult.totalScore,
        dataQualityScore: scoringResult.dataQualityScore,
        verificationConfidence: scoringResult.verificationConfidence,
        isRagAvailable: false,
        parseConfidence: iq.avgCellConfidence,
        dualExtractionValidation: [],
        specialConditions: combinedAlerts.map((a) => a.description),
        extractionConfidence: iq.avgCellConfidence,
        confidenceBreakdown: {
          ocrAccuracy: iq.avgCellConfidence,
          layoutCertainty: iq.avgCellConfidence,
          fieldVerification: iq.avgCellConfidence,
        },
        needsReview: iq.avgCellConfidence < 70,
        isCritical: iq.avgCellConfidence < 50,
        validationFlags: [],
        validationSummary: `${iq.coverages.length} coberturas extraídas`,
        crossReferenceSummary: {
          verifiedCoverages: 0,
          totalCoverages: iq.coverages.length,
          criticalAlerts: combinedAlerts.filter((a) => a.level === 'CRITICAL').length,
          warningAlerts: combinedAlerts.filter(
            (a) => a.level === 'WARNING' || a.level === 'warning'
          ).length,
        },
        clauseValidation: {
          hasClauseDocument: false,
          verifiedCount: 0,
          phantomCount: 0,
          mandatoryMissingCount: 0,
          optionalMissingCount: 0,
          scoreImpact: 0,
        },
        deductibleAnalysis: null,
        contextualRisk: null,
        warrantyCompliance: null,
        legalOpinion: null,
        quoteAudit: {
          deductibleRisks: audit.deductibleRisks,
          missingCoverages: audit.missingCoverages,
          specialConditions: audit.specialConditions,
          negotiationPoints: audit.negotiationPoints,
          competitiveAdvantages: audit.competitiveAdvantages,
          overallRiskScore: audit.overallRiskScore,
          summary: audit.summary,
        },
      };
    })
  );

  // Sort by score
  quotes.sort((a, b) => b.score - a.score);
  const bestQuote = quotes[0];

  return {
    quotes,
    recommendation: bestQuote
      ? `Mejor opción: ${bestQuote.insurerName} con score de ${bestQuote.score}/100. Análisis generado por el Motor Unificado de Comparación.`
      : 'No se pudieron analizar las cotizaciones',
    marketAnalysis: `Se analizaron ${quotes.length} cotizaciones de seguros PYME usando el Motor Unificado. ${
      bestQuote ? `Prima anual: ${formatCOP(bestQuote.priceAnnual)} COP` : ''
    }`,
    deductibleComparison: quotes.map((q) => ({
      insurer: q.insurerName,
      deductibleText: q.deductibles || 'No especificado',
    })),
    timestamp: new Date().toISOString(),
    analysisVersion: '3.0-unified',
  };
}

// ---------------------------------------------------------------------------
// Insurer alignment helpers
// ---------------------------------------------------------------------------

/**
 * Extract the ordered insurer names encoded in the matrix header row.
 * The unified engine emits a top header of the form:
 *   "Cotizaciones PYME - Insurer A, Insurer B"
 */
function extractMatrixInsurers(matrixRows: MatrixRow[]): string[] {
  const header = matrixRows.find((row) => row.type === 'header' && row.id === 'client_info');
  if (!header?.label) return [];
  const separator = ' - ';
  const idx = header.label.indexOf(separator);
  if (idx < 0) return [];
  return header.label
    .slice(idx + separator.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeInsurerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function longestCommonSubstringLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  let max = 0;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        max = Math.max(max, matrix[i][j]);
      }
    }
  }

  return max;
}

/**
 * Map each quote-file insurer to the index of the matching matrix column.
 * Returns -1 when no reasonable match is found.
 */
function alignInsurerIndices(quoteInsurers: string[], matrixInsurers: string[]): number[] {
  const normalizedMatrix = matrixInsurers.map((name) => normalizeInsurerName(name));

  return quoteInsurers.map((quoteName) => {
    const normalizedQuote = normalizeInsurerName(quoteName);
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < normalizedMatrix.length; i++) {
      const matrixName = normalizedMatrix[i];
      if (matrixName === normalizedQuote) {
        return i;
      }
      const score = longestCommonSubstringLength(normalizedQuote, matrixName);
      if (score > bestScore && score >= 3) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestIndex;
  });
}
