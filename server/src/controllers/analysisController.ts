import { Request, Response } from 'express';
import fs from 'fs';

import { ParsedQuote } from '../services/quoteParser';
import { type CrossReferenceResult } from '../services/crossReferenceEngine';
import { type ScoringResult, type ScoreBreakdown } from '../services/quoteScorer';
import { type NarrativeResult } from '../services/narrativeService';
import { type ValidationResult } from '../services/quoteValidator';
import { type ConfidenceResult, type ConfidenceBreakdown } from '../services/confidenceScorer';
import { type ClauseValidationSummary } from '../services/clauseCoverageValidator';
import { type DualExtractionResult } from '../services/dualExtractionService';
import { isMultimodalEnabled } from '../services/quoteProcessingService';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';

import { saveAnalysisHistory, getAnalysisHistoryByUser } from '../repositories/analysisRepository';
import { formatCOP } from '../utils/formatCurrency';
import quoteBasedAuditor from '../services/quoteBasedAuditor';

import { AlertItem, AlertLevel, MatrixRow, QuoteAnalysis } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

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
}

export const analysisController = {
    uploadAndAnalyze: async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();

        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
            const quoteFiles = files?.['quotes'] || [];

            if (quoteFiles.length === 0) {
                res.status(400).json({ success: false, error: "No quote files uploaded" });
                return;
            }

            console.log(`📄 Processing ${quoteFiles.length} quotes...`);
            console.log(`🔧 Pipeline: ${isMultimodalEnabled() ? 'Multimodal (V2)' : 'Legacy (V1)'}`);

            const pdfPaths = quoteFiles.map(f => f.path);
            const adapterResult = await comparisonEngineAdapter.generateComparison(pdfPaths, req.body.userId);
            const matrixRows = adapterResult.matrix;

            // Debug: Log matrix structure
            console.log(`📊 [Adapter Debug] engine=${adapterResult.engine}, correlationId=${adapterResult.correlationId}, matrix rows: ${matrixRows.length}`);
            const dataRows = matrixRows.filter(r => r.type === 'data');
            console.log(`📊 [Adapter Debug] Data rows: ${dataRows.length}`);
            if (dataRows.length > 0) {
                console.log(`📊 [Adapter Debug] First data row:`, JSON.stringify(dataRows[0], null, 2));
            }

            // Convert MatrixRow[] to ComparisonReport format
            const comparisonResult = matrixRowsToComparisonReport(matrixRows, quoteFiles) as unknown as ComparisonResult;

            // Debug: Log result structure
            console.log(`📊 [Adapter Debug] Quotes generated: ${comparisonResult.quotes?.length || 0}`);
            comparisonResult.quotes?.forEach((q: ComparisonResultQuote, i: number) => {
                console.log(`📊 [Adapter Debug] Quote ${i} (${q.insurerName}): ${q.coverages?.length || 0} coverages, price: ${q.priceAnnual}`);
            });

            // Save to Supabase
            const userId = req.body.userId || 'anonymous';
            const clientName = req.body.clientName || 'Cliente';

            try {
                const avgConfidence = comparisonResult.quotes.reduce((sum: number, q: ComparisonResultQuote) =>
                    sum + (q.extractionConfidence || 0), 0) / (comparisonResult.quotes.length || 1);

                const duration = Date.now() - startTime;

                const insertData = {
                    user_id: userId,
                    client_name: clientName,
                    analysis_result: comparisonResult,
                    recommendation: comparisonResult.recommendation || null,
                    total_score: comparisonResult.quotes?.[0]?.score || null,
                    extraction_confidence: Math.round(avgConfidence),
                    needs_review: comparisonResult.quotes.some((q: ComparisonResultQuote) => q.needsReview),
                    validation_flags_count: comparisonResult.quotes.reduce((sum: number, q: ComparisonResultQuote) =>
                        sum + (q.validationFlags?.length || 0), 0),
                    engine_type: adapterResult.engine,
                    processing_time_ms: duration,
                    confidence_score: Math.round(avgConfidence),
                    unified_result: comparisonResult,
                    fallback_reason: adapterResult.fallbackReason || null,
                    correlation_id: adapterResult.correlationId
                };

                const savedId = await saveAnalysisHistory(insertData);
                if (savedId) {
                    (comparisonResult as ComparisonResult).id = savedId;
                }
            } catch (saveError: unknown) {
                console.error("❌ [Supabase] Exception saving analysis:", saveError);
            }

            // Cleanup temp files
            quoteFiles.forEach(f => {
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
            console.error("Controller Error:", error);

            if (error instanceof Error && error.message?.includes("No response received")) {
                res.status(502).json({ error: "Upstream Error: No response from Gemini AI." });
                return;
            }
            if (error instanceof Error && error.message?.includes("429")) {
                res.status(429).json({ error: "Rate Limit Exceeded: Please try again later." });
                return;
            }

            res.status(500).json({
                error: "Internal Server Error during analysis",
                details: error instanceof Error ? error.message : String(error),
                isMockData: false
            });
        }
    },

    getHistory: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = (req.query.userId as string) || req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: "Authentication required" });
                return;
            }

            const rawLimit = req.query.limit;
            const rawOffset = req.query.offset;
            const limit = rawLimit !== undefined ? parseInt(rawLimit as string, 10) : 20;
            const offset = rawOffset !== undefined ? parseInt(rawOffset as string, 10) : 0;

            if (Number.isNaN(limit) || Number.isNaN(offset) || limit < 1 || offset < 0) {
                res.status(400).json({ success: false, error: "Invalid pagination parameters" });
                return;
            }

            const history = await getAnalysisHistoryByUser(userId);
            res.json({
                success: true,
                data: history.slice(offset, offset + limit),
                pagination: { limit, offset, total: history.length }
            });
        } catch (error) {
            console.error("Error fetching history:", error);
            res.status(500).json({ success: false, error: "Failed to fetch history" });
        }
    }
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
        const allAlerts = crossRefs.flatMap(r => 
            r.alerts.map(a => ({
                level: a.level as AlertLevel,
                title: a.title,
                description: a.description
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
            deductibles: quote.coverages.length > 0 
                ? quote.coverages.map(c => `${c.canonicalName || c.name}: ${c.deductible}`).join('; ')
                : 'No especificado',
            coverages: quote.coverages.map(c => ({
                name: c.canonicalName || c.name,
                value: c.value,
                deductible: c.deductible,
                canonicalName: c.canonicalName,
                categoryId: c.categoryId,
                matchConfidence: c.matchConfidence,
                matchMethod: c.matchMethod
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
                warranties: 0
            },
            clientAnalysis: narrative?.clientAnalysis || '',
            technicalAnalysis: narrative?.technicalAnalysis || '',
            keyFindings: narrative?.keyFindings || [],
            alerts: allAlerts,
            crossReferenceSummary: {
                verifiedCoverages: crossRefs.filter(r => r.isVerified).length,
                totalCoverages: crossRefs.length,
                criticalAlerts: allAlerts.filter(a => a.level === 'CRITICAL').length,
                warningAlerts: allAlerts.filter(a => a.level === 'WARNING').length
            },
            extractionConfidence: confidence?.score || 0,
            confidenceBreakdown: confidence?.breakdown || null,
            needsReview: confidence?.needsReview || false,
            isCritical: confidence?.isCritical || false,
            validationFlags: validation?.flags || [],
            validationSummary: validation ? `${validation.coverageCount}/${validation.expectedCoverageCount} coberturas` : '',
            clauseValidation: clauseValidation ? {
                hasClauseDocument: clauseValidation.hasClauseDocument,
                verifiedCount: clauseValidation.verifiedCount,
                phantomCount: clauseValidation.phantomCount,
                mandatoryMissingCount: clauseValidation.mandatoryMissingCount,
                optionalMissingCount: clauseValidation.optionalMissingCount,
                scoreImpact: clauseValidation.scoreImpact
            } : undefined,
            deductibleAnalysis: advancedAnalysis?.deductibleAnalysis,
            contextualRisk: advancedAnalysis?.contextualRisk,
            warrantyCompliance: advancedAnalysis?.warrantyCompliance,
            legalOpinion: advancedAnalysis?.legalOpinion,
            // Quote-based audit (independent of RAG)
            quoteAudit: (() => {
                const audit = quoteBasedAuditor.auditQuote({
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
                    deductibles: quote.coverages.map(c => c.deductible).join('; '),
                    rawText: quote.rawText
                } as unknown as QuoteAnalysis, quotes as unknown as QuoteAnalysis[]);
                return {
                    deductibleRisks: audit.deductibleRisks,
                    missingCoverages: audit.missingCoverages,
                    specialConditions: audit.specialConditions,
                    negotiationPoints: audit.negotiationPoints,
                    competitiveAdvantages: audit.competitiveAdvantages,
                    overallRiskScore: audit.overallRiskScore,
                    summary: audit.summary
                };
            })()
        };
    });

    // Sort by score (descending)
    quotesWithScores.sort((a, b) => b.score - a.score);

    const bestQuote = quotesWithScores[0];
    
    // Check if any quote has critical confidence
    const hasCriticalExtraction = quotesWithScores.some(q => q.isCritical);
    const reviewPrefix = hasCriticalExtraction ? '[REVISIÓN REQUERIDA] ' : '';
    
    return {
        quotes: quotesWithScores,
        recommendation: bestQuote 
            ? `${reviewPrefix}Mejor opción: ${bestQuote.insurerName} con score de ${bestQuote.score}/100. ${bestQuote.clientAnalysis.substring(0, 200)}`
            : `${reviewPrefix}No se pudieron analizar las cotizaciones`,
        marketAnalysis: `Se analizaron ${quotes.length} cotizaciones de seguros PYME. ${
            bestQuote ? `El rango de precios es de ${formatCOP(Math.min(...quotesWithScores.map(q => q.priceAnnual || Infinity)))} a ${formatCOP(Math.max(...quotesWithScores.map(q => q.priceAnnual || 0)))} ${bestQuote.currency}.` : ''
        }${hasCriticalExtraction ? ' ATENCIÓN: Algunas extracciones tienen baja confianza y requieren verificación manual.' : ''}`,
        deductibleComparison: quotesWithScores.map(q => ({
            insurer: q.insurerName,
            deductibleText: q.coverages.length > 0 
                ? q.coverages.map(c => `${c.name}: ${c.deductible}`).join('; ')
                : 'No especificado'
        })),
        timestamp: new Date().toISOString(),
        analysisVersion: '2.0-rag'
    };
}

/**
 * Convert MatrixRow[] from unified engine to ComparisonReport format
 */
function matrixRowsToComparisonReport(matrixRows: MatrixRow[], quoteFiles: Express.Multer.File[]): UnifiedComparisonReport {
    // Get insurer names from quote files
    const insurerNames = quoteFiles.map(f => {
        const name = f.originalname.replace(/COTIZACION.*?-\s*/i, '').replace(/\.pdf$/i, '');
        return name || 'Desconocido';
    });
    
    // Build quotes array
    const quotes: UnifiedQuote[] = insurerNames.map((insurerName, idx) => {
        const coverages: UnifiedQuote['coverages'] = [];
        const alerts: UnifiedQuote['alerts'] = [];
        let priceAnnual = 0;
        
        // Extract coverages from matrix rows
        matrixRows.forEach(row => {
            if (row.type === 'data' && row.cells && row.cells[idx]) {
                const cell = row.cells[idx];
                const value = cell.value || '';
                
                // Check if this is a premium row
                if (row.id === 'premium_total' || row.label === 'TOTAL A PAGAR') {
                    const numericValue = parseFloat(value.replace(/[^\d]/g, ''));
                    if (!isNaN(numericValue)) {
                        priceAnnual = numericValue;
                    }
                } else if (row.id?.startsWith('premium_')) {
                    // Skip other premium rows for now
                } else if (row.id?.startsWith('meta_')) {
                    // Skip metadata rows
                } else if (row.id?.startsWith('warning_')) {
                    // Add warning alerts
                    if (value && value !== 'No informado') {
                        alerts.push({
                            level: 'WARNING',
                            title: 'Alerta del Motor Unificado',
                            description: value
                        });
                    }
                } else {
                    // Regular coverage row
                    coverages.push({
                        name: row.label || 'Cobertura',
                        value: value === 'No informado' || value === 'N.C.' ? 'No incluido' : value,
                        deductible: cell.notes || 'No especificado',
                        isPositive: !cell.isExcluded,
                        valueSource: 'extracted' as const
                    });
                }
            }
        });
        
        return {
            insurerName,
            policyName: 'Cotización PYME',
            priceMonthly: Math.round(priceAnnual / 12),
            priceAnnual,
            currency: 'COP',
            deductibles: coverages.map(c => c.deductible).join('; '),
            coverages,
            alerts,
            scoringBreakdown: {
                coverage: 70,
                deductibles: 70,
                exclusions: 70,
                priceRatio: 70,
                sublimits: 70,
                warranties: 70
            },
            clientAnalysis: `Análisis generado por el Motor Unificado para ${insurerName}`,
            technicalAnalysis: '',
            score: 70,
            dataQualityScore: 85,
            verificationConfidence: 85,
            isRagAvailable: false,
            parseConfidence: 85,
            dualExtractionValidation: [],
            specialConditions: alerts.map(a => a.description),
            extractionConfidence: 85,
            confidenceBreakdown: null,
            needsReview: false,
            isCritical: false,
            validationFlags: [],
            validationSummary: `${coverages.length} coberturas extraídas`,
            crossReferenceSummary: {
                verifiedCoverages: 0,
                totalCoverages: coverages.length,
                criticalAlerts: 0,
                warningAlerts: alerts.length
            },
            clauseValidation: {
                hasClauseDocument: false,
                verifiedCount: 0,
                phantomCount: 0,
                mandatoryMissingCount: 0,
                optionalMissingCount: 0,
                scoreImpact: 0
            },
            deductibleAnalysis: null,
            contextualRisk: null,
            warrantyCompliance: null,
            legalOpinion: null,
            quoteAudit: {
                deductibleRisks: [],
                missingCoverages: [],
                specialConditions: [],
                negotiationPoints: [],
                competitiveAdvantages: [],
                overallRiskScore: 0,
                summary: ''
            }
        };
    });
    
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
        deductibleComparison: quotes.map(q => ({
            insurer: q.insurerName,
            deductibleText: q.deductibles || 'No especificado'
        })),
        timestamp: new Date().toISOString(),
        analysisVersion: '3.0-unified'
    };
}
