import { Request, Response } from 'express';

import { pdfExtractor, PDFExtractionResult } from '../services/pdfExtractor';
import { ParsedQuote } from '../services/quoteParser';
import { crossReferenceEngine, CrossReferenceResult } from '../services/crossReferenceEngine';
import { ragRetrievalService } from '../services/ragRetrievalService';
import { quoteScorer, ScoringResult, ScoreBreakdown } from '../services/quoteScorer';
import { narrativeService, NarrativeResult } from '../services/narrativeService';
import { validateQuote, ValidationResult } from '../services/quoteValidator';
import { calculateConfidence, ConfidenceResult, ConfidenceBreakdown } from '../services/confidenceScorer';

import { clauseCoverageValidator, ClauseValidationSummary } from '../services/clauseCoverageValidator';
import { deductibleAnalyzer } from '../services/deductibleAnalyzer';
import { inverseCoverageChecker } from '../services/inverseCoverageChecker';
import { contextualRiskAnalyzer } from '../services/contextualRiskAnalyzer';
import { warrantyComplianceAnalyzer } from '../services/warrantyComplianceAnalyzer';
import { virtualLawyerService } from '../services/virtualLawyerService';

import { saveAnalysisHistory, getAnalysisHistoryByUser } from '../repositories/analysisRepository';
import { formatCOP } from '../utils/formatCurrency';

import { validateValueSources } from '../services/valueValidationService';
import { dualExtractionService, DualExtractionResult } from '../services/dualExtractionService';
import {
  processQuoteMultimodal,
  processQuoteLegacy,
  createDefaultScoringResult,
  isMultimodalEnabled,
  shouldUseV2,
  NativeTextResult,
} from '../services/quoteProcessingService';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { featureFlags } from '../config/featureFlags';
import {
  createExtractionMetricsEmitter,
} from '../services/extractionMetrics';
import { ExtractionResult } from '../types/extractionMetrics';
import { randomUUID } from 'crypto';
import { AlertItem, AlertLevel, MatrixRow, QuoteAnalysis } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import quoteBasedAuditor from '../services/quoteBasedAuditor';
import fs from 'fs';

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

// Helper to call service with timeout
const callWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 5000, fallback: T): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  );
  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    console.warn(`⚠️ Service call timed out or failed:`, error);
    return fallback;
  }
};

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

            // Check if unified comparison engine is enabled
            const useUnifiedEngine = featureFlags.isEnabled('useUnifiedComparisonEngine');
            console.log(`🚩 Unified Comparison Engine: ${useUnifiedEngine ? 'ENABLED' : 'DISABLED'}`);

            if (useUnifiedEngine) {
                try {
                    console.log('🚀 Using Unified Comparison Engine (single LLM call)...');
                    const pdfPaths = quoteFiles.map(f => f.path);
                    const matrixRows = await comparisonEngineAdapter.generateComparison(pdfPaths, req.body.userId);
                    
                    // Debug: Log matrix structure
                    console.log(`📊 [Unified Debug] Matrix rows: ${matrixRows.length}`);
                    const dataRows = matrixRows.filter(r => r.type === 'data');
                    console.log(`📊 [Unified Debug] Data rows: ${dataRows.length}`);
                    if (dataRows.length > 0) {
                        console.log(`📊 [Unified Debug] First data row:`, JSON.stringify(dataRows[0], null, 2));
                    }
                    
                    // Convert MatrixRow[] to ComparisonReport format
                    const comparisonResult = matrixRowsToComparisonReport(matrixRows, quoteFiles) as unknown as ComparisonResult;
                    
                    // Debug: Log result structure
                    console.log(`📊 [Unified Debug] Quotes generated: ${comparisonResult.quotes?.length || 0}`);
                    comparisonResult.quotes?.forEach((q: ComparisonResultQuote, i: number) => {
                        console.log(`📊 [Unified Debug] Quote ${i} (${q.insurerName}): ${q.coverages?.length || 0} coverages, price: ${q.priceAnnual}`);
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
                            // Unified comparison fields
                            engine_type: 'unified',
                            processing_time_ms: duration,
                            confidence_score: Math.round(avgConfidence),
                            unified_result: comparisonResult
                        };
                        
                        const savedId = await saveAnalysisHistory(insertData);
                        if (savedId) {
                            (comparisonResult as ComparisonResult).id = savedId;
                        }
                    } catch (saveError: unknown) {
                        console.error("❌ [Supabase] Exception saving analysis:", saveError);
                    }
                    
                    const duration = Date.now() - startTime;
                    console.log(`✅ Unified analysis completed in ${duration}ms`);
                    
                    res.json(comparisonResult);
                    return;
                } catch (unifiedError: unknown) {
                    console.error('❌ Unified engine failed, falling back to legacy:', unifiedError instanceof Error ? unifiedError.message : String(unifiedError));
                    console.log('🔄 Falling back to legacy pipeline...');
                }
            }

            let parsedQuotes: ParsedQuote[] = [];
            const domain = req.body?.domain ?? 'pyme';

            console.log(`🤖 V2 multimodal is ${isMultimodalEnabled() ? 'enabled' : 'disabled'}; extracting native text first for path selection...`);

            // Phase 0: Extract native text once per file to decide V2 vs legacy path.
            const nativeTextResults: { file: Express.Multer.File; result: PDFExtractionResult }[] = [];
            for (const file of quoteFiles) {
              try {
                const result = await pdfExtractor.extractTextFromPdf(file.path);
                nativeTextResults.push({ file, result });
              } catch (err: unknown) {
                const errMessage = err instanceof Error ? err.message : 'Unknown error';
                console.warn(`⚠️ Native text extraction failed for ${file.originalname}: ${errMessage}`);
                nativeTextResults.push({
                  file,
                  result: {
                    text: '',
                    pages: [],
                    pageTextMap: {},
                    metadata: { pageCount: 1 },
                    warnings: [errMessage],
                    isScanned: false,
                  },
                });
              }
            }

            // Process all quotes with V2 as the default; legacy is used for scanned PDFs or V2 failures.
            const CONCURRENCY_LIMIT = 2; // Limit to 2 simultaneous Gemini calls
            const processQuote = async (
              file: Express.Multer.File,
              nativeResult: PDFExtractionResult,
              index: number
            ) => {
              const quoteId = randomUUID();
              const metrics = createExtractionMetricsEmitter();
              const quoteStartTime = Date.now();

              metrics.emit({
                quoteId,
                index,
                total: quoteFiles.length,
                filename: file.originalname,
              });

              try {
                const nativeTextResult: NativeTextResult = {
                  text: nativeResult.text,
                  pageTextMap: nativeResult.pageTextMap || {},
                  pageTextItems: nativeResult.pageTextItems,
                  metadata: nativeResult.metadata,
                  isScanned: nativeResult.isScanned ?? false,
                };

                if (shouldUseV2(file, nativeTextResult)) {
                  console.log(`   🤖 Quote ${index + 1}: using V2 multimodal path`);
                  const parsed = await processQuoteMultimodal(file, index, quoteFiles.length, {
                    domain,
                    quoteId,
                    metrics,
                    nativeTextResult,
                  });
                  metrics.emit({
                    quoteId,
                    index,
                    total: quoteFiles.length,
                    result: 'success' as ExtractionResult,
                    durationMs: Date.now() - quoteStartTime,
                    path: 'v2',
                  });
                  return { index, parsed, error: null };
                }

                console.log(`   📑 Quote ${index + 1}: using legacy path (${nativeTextResult.isScanned ? 'scanned PDF' : 'V2 disabled'})`);
                metrics.emit({
                  quoteId,
                  index,
                  total: quoteFiles.length,
                  path: 'legacy',
                });
                const quote = {
                  text: nativeResult.text,
                  metadata: nativeResult.metadata,
                  filename: file.originalname,
                  isScanned: nativeResult.isScanned ?? false,
                };
                const parsed = await processQuoteLegacy(quote, index, quoteFiles.length, {
                  domain,
                  quoteId,
                  metrics,
                });
                metrics.emit({
                  quoteId,
                  index,
                  total: quoteFiles.length,
                  result: 'success' as ExtractionResult,
                  durationMs: Date.now() - quoteStartTime,
                  path: 'legacy',
                });
                return { index, parsed, error: null };
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const isServiceError =
                  errorMessage.includes('503') ||
                  errorMessage.includes('Service Unavailable') ||
                  errorMessage.includes('high demand');

                if (isServiceError) {
                  console.error(`   ❌ Error processing quote ${index + 1}: Servicio de IA temporalmente no disponible (503)`);
                } else {
                  console.error(`   ❌ Error processing quote ${index + 1}:`, errorMessage);
                }

                metrics.emit({
                  quoteId,
                  index,
                  total: quoteFiles.length,
                  result: 'failed' as ExtractionResult,
                  durationMs: Date.now() - quoteStartTime,
                  path: 'legacy',
                  errorCategory: isServiceError ? 'SERVICE_UNAVAILABLE' : 'EXTRACTION_FAILED',
                  errorCode: isServiceError ? 'GEMINI_SERVICE_UNAVAILABLE' : 'EXTRACTION_ERROR',
                });

                return { index, parsed: null, error };
              }
            };

            // Process in batches to limit concurrency
            for (let i = 0; i < quoteFiles.length; i += CONCURRENCY_LIMIT) {
              const batch = quoteFiles.slice(i, i + CONCURRENCY_LIMIT);
              const batchNativeResults = nativeTextResults.slice(i, i + CONCURRENCY_LIMIT);
              const batchResults = await Promise.all(
                batch.map((file, batchIdx) => processQuote(file, batchNativeResults[batchIdx].result, i + batchIdx))
              );

              for (const result of batchResults) {
                if (result.parsed) {
                  parsedQuotes[result.index] = result.parsed;
                } else {
                  // Create error placeholder
                  const filename = quoteFiles[result.index]?.originalname || 'Unknown';
                  const insurerName = filename.replace(/COTIZACION.*?-\s*/i, '').replace(/\.pdf$/i, '') || filename;
                  const errorMessage = result.error instanceof Error ? result.error.message : 'Unknown error';
                  const isServiceError =
                    errorMessage.includes('503') ||
                    errorMessage.includes('Service Unavailable') ||
                    errorMessage.includes('high demand');
                  const displayError = isServiceError
                    ? 'Servicio temporalmente no disponible. Intente nuevamente en unos momentos.'
                    : errorMessage;

                  parsedQuotes[result.index] = {
                    insurerName: insurerName,
                    policyName: 'Error en procesamiento',
                    priceAnnual: 0,
                    currency: 'COP',
                    coverages: [],
                    specialConditions: [`Error: ${displayError}`],
                    rawText: '',
                    parseConfidence: 0,
                    isFailed: true,
                    errorCategory: isServiceError ? 'SERVICE_UNAVAILABLE' : 'EXTRACTION_FAILED',
                    errorCode: isServiceError ? 'GEMINI_SERVICE_UNAVAILABLE' : 'EXTRACTION_ERROR'
                  };
                }
              }
            }

            // Phase 2.5: Validate coverage values against raw text (anti-hallucination)
            console.log('🔍 Phase 2.5/5: Validating coverage values against raw text...');
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                if (quote.rawText) {
                    const valueValidations = validateValueSources(
                        quote.coverages.map(c => ({ name: c.name, value: c.value })),
                        quote.rawText
                    );
                    
                    valueValidations.forEach((validation, idx) => {
                        if (quote.coverages[idx]) {
                            quote.coverages[idx].valueSource = validation.validation.source;
                            if (validation.validation.source === 'inferred' && !validation.validation.isValid) {
                                console.warn(`⚠️ [ValueValidation] ${quote.insurerName} - ${validation.coverageName}: ${validation.validation.reason}`);
                            }
                        }
                    });
                }
            }

            // Phase 2.6: Dual extraction validation for critical coverages
            console.log('🔍 Phase 2.6/5: Validating critical coverages with dual extraction...');
            const dualExtractionResults: Map<number, DualExtractionResult[]> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                if (quote.rawText && quote.coverages.length > 0) {
                    const dualResults = await dualExtractionService.validateCriticalCoverages(
                        quote.coverages.map(c => ({ 
                            name: c.name, 
                            value: c.value, 
                            deductible: c.deductible,
                            confidence: c.confidence 
                        })),
                        quote.rawText
                    );
                    
                    if (dualResults.length > 0) {
                        dualExtractionResults.set(i, dualResults);
                        
                        const discrepancies = dualResults.filter(r => r.isDiscrepancy);
                        if (discrepancies.length > 0) {
                            console.warn(`⚠️ [DualExtraction] ${quote.insurerName}: ${discrepancies.length} discrepancias detectadas`);
                            discrepancies.forEach(d => {
                                console.warn(`   - ${d.coverageName}: ${d.discrepancy.toFixed(1)}% diferencia`);
                            });
                        } else {
                            console.log(`✅ [DualExtraction] ${quote.insurerName}: Todas las coberturas críticas verificadas`);
                        }
                    }
                }
            }

            // Phase 3: Validate and score confidence
            console.log('✅ Phase 3/5: Validating extractions and calculating confidence...');
            const validationResults: Map<number, ValidationResult> = new Map();
            const confidenceResults: Map<number, ConfidenceResult> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                console.log(`   Validating ${quote.insurerName}...`);
                
                try {
                    // Run validation
                    const validation = validateQuote(quote);
                    validationResults.set(i, validation);
                    
                    // Calculate confidence
                    const isStructured = quote.parseConfidence >= 90; // Structured extraction marks high confidence
                    const confidence = calculateConfidence(quote, validation, isStructured);
                    confidenceResults.set(i, confidence);
                    
                    console.log(`   ✅ Validation: ${validation.flags.length} flags | Confidence: ${confidence.score}/100 (${confidence.needsReview ? 'NEEDS REVIEW' : 'OK'})`);
                    
                    // Log warnings
                    if (validation.flags.length > 0) {
                        validation.flags.forEach(flag => {
                            console.log(`      ${flag.severity}: ${flag.message}`);
                        });
                    }
                } catch (error) {
                    console.error(`   ❌ Validation error for ${quote.insurerName}:`, error);
                    validationResults.set(i, {
                        isValid: false,
                        flags: [{
                            field: 'validation',
                            severity: 'CRITICAL',
                            message: `Error de validación: ${(error as Error).message}`,
                            code: 'VALIDATION_ERROR'
                        }],
                        coverageCount: 0,
                        expectedCoverageCount: 14,
                        numericParseSuccess: false
                    });
                    confidenceResults.set(i, {
                        score: 0,
                        breakdown: {
                            coverageCompleteness: 0,
                            numericParseSuccess: 0,
                            validationPassRate: 0,
                            schemaCompliance: 0
                        },
                        needsReview: true,
                        isCritical: true
                    });
                }
            }

            // Phase 4: Cross-reference with RAG clause library (ASYNC - non-blocking)
            console.log('🔍 Phase 4/5: Cross-referencing with clause library (async)...');
            const crossRefResults: Map<number, CrossReferenceResult[]> = new Map();
            const clauseValidationResults: Map<number, ClauseValidationSummary | null> = new Map();
            
    // Pre-flight check: which insurers have clauses indexed?
    console.log('🔍 [RAG] Checking clause availability...');
    const insurersWithClauses = new Map<string, boolean>();
    const isRagAvailable = new Map<number, boolean>(); // Track RAG availability per quote index
            for (const quote of parsedQuotes) {
                if (!insurersWithClauses.has(quote.insurerName)) {
                    const hasClauses = await ragRetrievalService.checkInsurerHasClauses(quote.insurerName);
                    insurersWithClauses.set(quote.insurerName, hasClauses);
                    if (!hasClauses) {
                        console.log(`⚠️ [RAG] No clauses indexed for ${quote.insurerName}, skipping RAG`);
                    }
                }
            }
            
            // Track RAG availability for each quote
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                isRagAvailable.set(i, insurersWithClauses.get(quote.insurerName) || false);
            }
            
            // Use batch RAG for better performance
            const startRag = Date.now();
            
            // Filter quotes that have clauses available
            const quotesWithClauses = parsedQuotes.filter((_, i) => 
                insurersWithClauses.get(parsedQuotes[i].insurerName)
            );
            
            if (quotesWithClauses.length > 0) {
                try {
                    const batchResults = await Promise.race([
                        crossReferenceEngine.crossReferenceQuotesBatch(quotesWithClauses),
                        new Promise<never>((_, reject) => 
                            setTimeout(() => reject(new Error('RAG batch timeout')), 30000)
                        )
                    ]);
                    
                    // Map batch results back to original indices
                    let batchIndex = 0;
                    for (let i = 0; i < parsedQuotes.length; i++) {
                        if (insurersWithClauses.get(parsedQuotes[i].insurerName)) {
                            crossRefResults.set(i, batchResults.get(batchIndex) || []);
                            batchIndex++;
                        } else {
                            crossRefResults.set(i, []);
                        }
                    }
                    
                    console.log(`✅ [RAG] Batch completed in ${Date.now() - startRag}ms`);
                } catch (error) {
                    console.error('❌ [RAG] Batch error:', error);
                    for (let i = 0; i < parsedQuotes.length; i++) {
                        crossRefResults.set(i, []);
                    }
                }
            } else {
                console.log('⚠️ [RAG] No insurers with clauses, skipping batch');
                for (let i = 0; i < parsedQuotes.length; i++) {
                    crossRefResults.set(i, []);
                }
            }
            
            // Clause validation (keep per-quote for now)
            const validationPromises = parsedQuotes.map(async (quote, i) => {
                // Skip if no clauses for this insurer
                if (!insurersWithClauses.get(quote.insurerName)) {
                    clauseValidationResults.set(i, null);
                    return;
                }
                
                try {
                    const validation = await Promise.race([
                        clauseCoverageValidator.validate(quote, quote.insurerName),
                        new Promise<never>((_, reject) => 
                            setTimeout(() => reject(new Error('Clause validation timeout')), 8000)
                        )
                    ]);
                    clauseValidationResults.set(i, validation);
                    
                    if (!validation.hasClauseDocument) {
                        console.log(`   ⚠️ ${quote.insurerName}: No clause document, score penalized`);
                    } else {
                        console.log(`   ✅ ${quote.insurerName}: ${validation.verifiedCount} verified, ${validation.phantomCount} phantom`);
                    }
                } catch (_clauseError) {
                    console.warn(`   ⚠️ ${quote.insurerName}: Clause validation failed or timed out`);
                    clauseValidationResults.set(i, null);
                }
            });
            
            // Wait for all validations
            try {
                await Promise.all(validationPromises);
            } catch (_error) {
                console.warn('⚠️ Some validations failed');
            }

            // Phase 4: Calculate scores
            console.log('📊 Phase 4/5: Calculating scores...');
            const scoringResults: Map<number, ScoringResult> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                const crossRefs = crossRefResults.get(i) || [];
                const clauseValidation = clauseValidationResults.get(i)?.results;
                
                try {
                    const scoring = await quoteScorer.calculateScore(quote, crossRefs, parsedQuotes, undefined, clauseValidation);
                    scoringResults.set(i, scoring);
                    console.log(`   ${quote.insurerName}: ${scoring.totalScore}/100`);
                } catch (error) {
                    console.error(`   ❌ Scoring error for ${quote.insurerName}:`, error);
                    scoringResults.set(i, createDefaultScoringResult(quote));
                }
            }

            // Phase 5: Generate narratives
            console.log('📝 Phase 5/5: Generating narratives...');
            const narrativeResults: Map<number, NarrativeResult> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                const scoring = scoringResults.get(i);
                const crossRefs = crossRefResults.get(i) || [];
                
                if (scoring) {
                    try {
                        const narrative = await narrativeService.generateNarrative(quote, scoring, crossRefs);
                        narrativeResults.set(i, narrative);
                        console.log(`   ✅ Narrative for ${quote.insurerName}: ${narrative.clientAnalysis.length} chars`);
                    } catch (error) {
                        console.error(`   ❌ Narrative error for ${quote.insurerName}:`, error);
                        narrativeResults.set(i, {
                            clientAnalysis: `Análisis de ${quote.insurerName} (score: ${scoring.totalScore}/100)`,
                            technicalAnalysis: '',
                            keyFindings: []
                        });
                    }
                }
            }

            // Phase 5b: Advanced analysis (parallel with timeout)
            console.log('🔬 Phase 5b/5: Running advanced analysis...');
            const advancedAnalysisResults: Map<number, Record<string, unknown> | null> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                
                try {
                    // Run advanced analyses in parallel with 5s timeout each
                    const [deductibleAnalysis, inverseCheck, contextualRisk, warrantyCompliance, legalOpinion] = await Promise.allSettled([
                        callWithTimeout(
                            Promise.resolve(deductibleAnalyzer.analyzeQuote(quote, new Map())),
                            5000,
                            null
                        ),
                        callWithTimeout(
                            inverseCoverageChecker.checkMissingCoverages(quote, quote.insurerName),
                            5000,
                            null
                        ),
                        req.body.clientProfile ? callWithTimeout(
                            Promise.resolve(contextualRiskAnalyzer.contextualizeExclusions(
                                quote.specialConditions || [],
                                req.body.clientProfile
                            )),
                            3000,
                            null
                        ) : Promise.resolve(null),
                        callWithTimeout(
                            Promise.resolve(warrantyComplianceAnalyzer.analyzeConditions(
                                quote.specialConditions || []
                            )),
                            3000,
                            null
                        ),
                        req.body.clientProfile ? callWithTimeout(
                            virtualLawyerService.generateOpinions(
                                quote.coverages.map(c => ({
                                    insurerName: quote.insurerName,
                                    coverageName: c.canonicalName || c.name,
                                    value: c.value,
                                    deductible: c.deductible || 'No especificado',
                                    exclusions: quote.specialConditions || []
                                })),
                                req.body.clientProfile,
                                quote.insurerName
                            ),
                            8000,
                            null
                        ) : Promise.resolve(null)
                    ]);
                    
                    advancedAnalysisResults.set(i, {
                        deductibleAnalysis: deductibleAnalysis.status === 'fulfilled' ? deductibleAnalysis.value : null,
                        inverseCheck: inverseCheck.status === 'fulfilled' ? inverseCheck.value : null,
                        contextualRisk: contextualRisk.status === 'fulfilled' ? contextualRisk.value : null,
                        warrantyCompliance: warrantyCompliance.status === 'fulfilled' ? warrantyCompliance.value : null,
                        legalOpinion: legalOpinion.status === 'fulfilled' ? legalOpinion.value : null
                    });
                    
                    console.log(`   ✅ Advanced analysis for ${quote.insurerName} completed`);
                } catch (error) {
                    console.error(`   ❌ Advanced analysis error for ${quote.insurerName}:`, error);
                    advancedAnalysisResults.set(i, null);
                }
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

            // Generate comparison result
            console.log('🏁 Generating final comparison...');
            const comparisonResult = generateComparison(
                parsedQuotes,
                scoringResults,
                narrativeResults,
                crossRefResults,
                validationResults,
                confidenceResults,
                clauseValidationResults,
                advancedAnalysisResults,
                dualExtractionResults,
                insurersWithClauses
            );

            // Save to Supabase
            const userId = req.body.userId || 'anonymous';
            const clientName = req.body.clientName || 'Cliente';

            try {
                // Calculate average confidence
                const avgConfidence = comparisonResult.quotes.reduce((sum: number, q: ComparisonResultQuote) => 
                    sum + (q.extractionConfidence || 0), 0) / (comparisonResult.quotes.length || 1);
                
                const duration = Date.now() - startTime;
                
                // Determine engine type based on whether unified was attempted
                const engineType = useUnifiedEngine ? 'fallback' : 'legacy';
                const fallbackReason = useUnifiedEngine ? 'Unified engine failed, fell back to legacy' : null;
                
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
                    // Unified comparison fields
                    engine_type: engineType,
                    processing_time_ms: duration,
                    confidence_score: Math.round(avgConfidence),
                    fallback_reason: fallbackReason
                };
                
                const savedId = await saveAnalysisHistory(insertData);
                if (savedId) {
                    (comparisonResult as unknown as ComparisonResult).id = savedId;
                }
            } catch (saveError: unknown) {
                console.error("❌ [Supabase] Exception saving analysis:", saveError);
            }
            
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
            extractionConfidence: 85,
            needsReview: false,
            isCritical: false,
            validationFlags: [],
            validationSummary: `${coverages.length} coberturas extraídas`
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
