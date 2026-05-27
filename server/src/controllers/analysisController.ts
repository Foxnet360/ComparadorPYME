import { Request, Response } from 'express';
import { geminiService } from '../services/gemini';
import { pdfExtractor } from '../services/pdfExtractor';
import { quoteParser, ParsedQuote } from '../services/quoteParser';
import { crossReferenceEngine, CrossReferenceResult } from '../services/crossReferenceEngine';
import { ragRetrievalService } from '../services/ragRetrievalService';
import { quoteScorer, ScoringResult } from '../services/quoteScorer';
import { narrativeService, NarrativeResult } from '../services/narrativeService';
import { validateQuote, ValidationResult } from '../services/quoteValidator';
import { calculateConfidence, ConfidenceResult } from '../services/confidenceScorer';
import { normalizeCoverages } from '../services/thesaurusMapper';
import { clauseCoverageValidator } from '../services/clauseCoverageValidator';
import { deductibleAnalyzer } from '../services/deductibleAnalyzer';
import { inverseCoverageChecker } from '../services/inverseCoverageChecker';
import { contextualRiskAnalyzer } from '../services/contextualRiskAnalyzer';
import { warrantyComplianceAnalyzer } from '../services/warrantyComplianceAnalyzer';
import { virtualLawyerService } from '../services/virtualLawyerService';
import { insurerProfileService } from '../services/insurerProfileService';
import { saveAnalysisHistory, getAnalysisHistoryByUser } from '../repositories/analysisRepository';
import { formatCOP } from '../utils/formatCurrency';
import { validateCoverageValues } from '../services/coverageValueValidator';
import { validateCoverageValues as validateValueSources } from '../services/valueValidationService';
import { dualExtractionService, DualExtractionResult } from '../services/dualExtractionService';
import {
  processQuoteMultimodal,
  processQuoteLegacy,
  createDefaultScoringResult,
  isMultimodalEnabled
} from '../services/quoteProcessingService';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { featureFlags } from '../config/featureFlags';

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
import quoteBasedAuditor from '../services/quoteBasedAuditor';
import fs from 'fs';

export const analysisController = {
    uploadAndAnalyze: async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            const quoteFiles = files['quotes'] || [];

            if (quoteFiles.length === 0) {
                res.status(400).json({ error: "No quote files uploaded" });
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
                    
                    // Convert MatrixRow[] to ComparisonReport format
                    const comparisonResult = matrixRowsToComparisonReport(matrixRows, quoteFiles);
                    
                    // Save to Supabase
                    const userId = req.body.userId || 'anonymous';
                    const clientName = req.body.clientName || 'Cliente';
                    
                    try {
                        const avgConfidence = comparisonResult.quotes.reduce((sum: number, q: any) => 
                            sum + (q.extractionConfidence || 0), 0) / (comparisonResult.quotes.length || 1);
                        
                        const insertData = {
                            user_id: userId,
                            client_name: clientName,
                            analysis_result: comparisonResult,
                            recommendation: comparisonResult.recommendation || null,
                            total_score: comparisonResult.quotes?.[0]?.score || null,
                            extraction_confidence: Math.round(avgConfidence),
                            needs_review: comparisonResult.quotes.some((q: any) => q.needsReview),
                            validation_flags_count: comparisonResult.quotes.reduce((sum: number, q: any) => 
                                sum + (q.validationFlags?.length || 0), 0)
                        };
                        
                        const savedId = await saveAnalysisHistory(insertData);
                        if (savedId) {
                            (comparisonResult as any).id = savedId;
                        }
                    } catch (saveError: any) {
                        console.error("❌ [Supabase] Exception saving analysis:", saveError);
                    }
                    
                    const duration = Date.now() - startTime;
                    console.log(`✅ Unified analysis completed in ${duration}ms`);
                    
                    res.json(comparisonResult);
                    return;
                } catch (unifiedError: any) {
                    console.error('❌ Unified engine failed, falling back to legacy:', unifiedError.message);
                    console.log('🔄 Falling back to legacy pipeline...');
                }
            }

            let parsedQuotes: ParsedQuote[] = [];

            if (isMultimodalEnabled()) {
                // NEW: Multimodal extraction pipeline (PARALLEL)
                console.log('🤖 Using multimodal extraction with Gemini 2.5 Pro (PARALLEL)...');
                
                // Process all quotes in parallel with concurrency limit
                const CONCURRENCY_LIMIT = 2; // Limit to 2 simultaneous Gemini calls
                const processQuote = async (file: Express.Multer.File, index: number) => {
                    try {
                        const parsed = await processQuoteMultimodal(file, index, quoteFiles.length);
                        return { index, parsed, error: null };
                    } catch (error: any) {
                        const errorMessage = error?.message || 'Unknown error';
                        const isServiceError = errorMessage.includes('503') || 
                                               errorMessage.includes('Service Unavailable') ||
                                               errorMessage.includes('high demand');
                        
                        if (isServiceError) {
                            console.error(`   ❌ Error processing quote ${index + 1}: Servicio de IA temporalmente no disponible (503)`);
                        } else {
                            console.error(`   ❌ Error processing quote ${index + 1}:`, errorMessage);
                        }
                        
                        // Fallback to legacy pipeline
                        console.log(`   🔄 Falling back to legacy pipeline...`);
                        try {
                            const fallback = await processQuoteLegacy(file, index, quoteFiles.length);
                            return { index, parsed: fallback, error: null };
                        } catch (fallbackError: any) {
                            console.error(`   ❌ Legacy fallback also failed:`, fallbackError?.message);
                            return { index, parsed: null, error: error }; // Return original error for better messaging
                        }
                    }
                };
                
                // Process in batches to limit concurrency
                for (let i = 0; i < quoteFiles.length; i += CONCURRENCY_LIMIT) {
                    const batch = quoteFiles.slice(i, i + CONCURRENCY_LIMIT);
                    const batchResults = await Promise.all(
                        batch.map((file, batchIdx) => processQuote(file, i + batchIdx))
                    );
                    
                    for (const result of batchResults) {
                        if (result.parsed) {
                            parsedQuotes[result.index] = result.parsed;
                        } else {
                            // Create error placeholder
                            const filename = quoteFiles[result.index]?.originalname || 'Unknown';
                            const insurerName = filename.replace(/COTIZACION.*?-\s*/i, '').replace(/\.pdf$/i, '') || filename;
                            const errorMessage = result.error?.message || 'Unknown error';
                            const isServiceError = errorMessage.includes('503') || 
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
            } else {
                // LEGACY: Text-based extraction pipeline
                // Phase 1: Extract text from quote PDFs
                console.log('📑 Phase 1/5: Extracting text from PDFs...');
                const extractedQuotes = await pdfExtractor.processMultiplePdfs(
                    quoteFiles.map(f => ({ path: f.path, originalname: f.originalname })),
                    'COTIZACIÓN'
                );

                // Phase 2: Process each quote in parallel with Gemini
                console.log('🤖 Phase 2/5: Extracting structured data with Gemini (PARALLEL)...');
                
                const legacyPromises = extractedQuotes.map((quote, i) =>
                    processQuoteLegacy(quote, i, extractedQuotes.length)
                );
                parsedQuotes = await Promise.all(legacyPromises);
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
                    const dualResults = dualExtractionService.validateCriticalCoverages(
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
            const clauseValidationResults: Map<number, any> = new Map();
            
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
                } catch (clauseError) {
                    console.warn(`   ⚠️ ${quote.insurerName}: Clause validation failed or timed out`);
                    clauseValidationResults.set(i, null);
                }
            });
            
            // Wait for all validations
            try {
                await Promise.all(validationPromises);
            } catch (error) {
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
            const advancedAnalysisResults: Map<number, any> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                const clauseValidation = clauseValidationResults.get(i);
                
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
                const avgConfidence = comparisonResult.quotes.reduce((sum: number, q: any) => 
                    sum + (q.extractionConfidence || 0), 0) / (comparisonResult.quotes.length || 1);
                
                const insertData = {
                    user_id: userId,
                    client_name: clientName,
                    analysis_result: comparisonResult,
                    recommendation: comparisonResult.recommendation || null,
                    total_score: comparisonResult.quotes?.[0]?.score || null,
                    extraction_confidence: Math.round(avgConfidence),
                    needs_review: comparisonResult.quotes.some((q: any) => q.needsReview),
                    validation_flags_count: comparisonResult.quotes.reduce((sum: number, q: any) => 
                        sum + (q.validationFlags?.length || 0), 0)
                };
                
                const savedId = await saveAnalysisHistory(insertData);
                if (savedId) {
                    (comparisonResult as any).id = savedId;
                }
            } catch (saveError: any) {
                console.error("❌ [Supabase] Exception saving analysis:", saveError);
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ Analysis completed in ${duration}ms`);

            res.json(comparisonResult);

        } catch (error: any) {
            console.error("Controller Error:", error);

            if (error.message?.includes("No response received")) {
                res.status(502).json({ error: "Upstream Error: No response from Gemini AI." });
                return;
            }
            if (error.message?.includes("429") || error.status === 429) {
                res.status(429).json({ error: "Rate Limit Exceeded: Please try again later." });
                return;
            }

            res.status(500).json({
                error: "Internal Server Error during analysis",
                details: error.message || String(error),
                isMockData: false
            });
        }
    },

    getHistory: async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.query.userId as string;
            if (!userId) {
                res.json([]);
                return;
            }

            const history = await getAnalysisHistoryByUser(userId);
            res.json(history);
        } catch (error) {
            console.error("Error fetching history:", error);
            res.status(500).json({ error: "Failed to fetch history" });
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
    clauseValidationResults?: Map<number, any>,
    advancedAnalysisResults?: Map<number, any>,
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
                level: a.level as any,
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
                } as any, quotes as any);
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
function matrixRowsToComparisonReport(matrixRows: any[], quoteFiles: Express.Multer.File[]): any {
    // Extract insurer names from header row
    const headerRow = matrixRows.find(r => r.type === 'header' && r.id === 'client_info');
    const numInsurers = headerRow ? headerRow.cells.length : 0;
    
    // Get insurer names from quote files
    const insurerNames = quoteFiles.map(f => {
        const name = f.originalname.replace(/COTIZACION.*?-\s*/i, '').replace(/\.pdf$/i, '');
        return name || 'Desconocido';
    });
    
    // Build quotes array
    const quotes: any[] = insurerNames.map((insurerName, idx) => {
        const coverages: any[] = [];
        const alerts: any[] = [];
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
