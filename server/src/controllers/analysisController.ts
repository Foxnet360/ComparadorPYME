import { Request, Response } from 'express';
import { geminiService } from '../services/gemini';
import { pdfExtractor } from '../services/pdfExtractor';
import { quoteParser, ParsedQuote } from '../services/quoteParser';
import { crossReferenceEngine, CrossReferenceResult } from '../services/crossReferenceEngine';
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
import { supabase } from '../config/database';
import { formatCOP } from '../utils/formatCurrency';
import { validateCoverageValues } from '../services/coverageValueValidator';
import fs from 'fs';

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

const STRUCTURED_EXTRACTION_PROMPT = `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

### EJEMPLO DE ENTRADA/SALIDA

Ejemplo - Cotización estándar:
ENTRADA: "Seguros Bolívar presenta: Póliza Empresarial Plus. Prima anual: $8.500.000 COP. Coberturas: Incendio Edificio $500M (ded 10%), RC $100M (ded 5 SMMLV)..."

SALIDA ESPERADA:
{
  "insurerName": "Seguros Bolívar",
  "policyName": "Empresarial Plus",
  "priceAnnual": 8500000,
  "currency": "COP",
  "validityPeriod": "2024-01-01 - 2024-12-31",
  "coverages": [
    {
      "name": "Incendio (Edificio y Contenidos)",
      "value": "500.000.000",
      "deductible": "10%"
    },
    {
      "name": "Responsabilidad Civil (RCE)",
      "value": "100.000.000",
      "deductible": "5 SMMLV"
    }
  ],
  "specialConditions": ["Aplica cláusula de ajuste por inflación"],
  "expectedCoverages": [
    { "name": "Incendio (Edificio y Contenidos)", "status": "present", "value": "500M", "deductible": "10%" },
    { "name": "Lucro Cesante", "status": "missing", "value": null, "deductible": null },
    { "name": "Sustracción / Hurto", "status": "present", "value": "100M", "deductible": "10%" },
    { "name": "Equipo Eléctrico y Electrónico", "status": "present", "value": "50M", "deductible": "No aplica" },
    { "name": "Rotura de Maquinaria", "status": "present", "value": "50M", "deductible": "15%" },
    { "name": "Responsabilidad Civil (RCE)", "status": "present", "value": "100M", "deductible": "5 SMMLV" },
    { "name": "Vidrios Planos", "status": "missing", "value": null, "deductible": null },
    { "name": "Manejo Global / Infidelidad", "status": "missing", "value": null, "deductible": null },
    { "name": "Transporte de Mercancías", "status": "missing", "value": null, "deductible": null },
    { "name": "Transporte de Valores", "status": "missing", "value": null, "deductible": null },
    { "name": "Asistencia PYME", "status": "present", "value": "Incluido", "deductible": "No aplica" },
    { "name": "Asistencia Legal", "status": "present", "value": "Incluido", "deductible": "No aplica" },
    { "name": "Huelga, Motín, Asonada (HMACC)", "status": "missing", "value": null, "deductible": null },
    { "name": "Terremoto y Eventos Catastróficos", "status": "present", "value": "200M", "deductible": "20%" }
  ]
}

### REGLAS CRÍTICAS

1. Nombres de coberturas: Usa EXACTAMENTE estos 14 nombres canónicos:
   - "Incendio (Edificio y Contenidos)"
   - "Lucro Cesante"
   - "Sustracción / Hurto"
   - "Equipo Eléctrico y Electrónico"
   - "Rotura de Maquinaria"
   - "Responsabilidad Civil (RCE)"
   - "Vidrios Planos"
   - "Manejo Global / Infidelidad"
   - "Transporte de Mercancías"
   - "Transporte de Valores"
   - "Asistencia PYME"
   - "Asistencia Legal"
   - "Huelga, Motín, Asonada (HMACC)"
   - "Terremoto y Eventos Catastróficos"

2. Si una cobertura no aparece en el documento, inclúyela con:
   { "name": "[Nombre exacto de plantilla]", "value": "NO ESPECIFICADO", "deductible": "" }

3. NO inventes coberturas que no estén en el documento.

4. Formato de deducibles:
   - Porcentaje: "10%" o "10% / Mín. 2 SMMLV"
   - Fijo: "5 SMMLV" o "$500.000"
   - No aplica: "No aplica"

5. Formato de valores de cobertura:
   - Usa el formato exacto del documento: "$500.000.000" o "500M" o "10%"
   - NO inventes valores. Si no está claro, usa "NO ESPECIFICADO"
   - Para RC e Incendio, valores menores a $100M son sospechosos - verifica

6. Prima anual: Extrae solo el número entero (ej: 8500000), sin símbolos ni puntos.

6. expectedCoverages: Incluye TODAS las 14 coberturas canónicas con su estado:
   - "present": La cobertura aparece en el documento
   - "missing": La cobertura no aparece pero debería estar
   - "excluded": La cobertura fue explícitamente excluida
   
   Ejemplo:
   "expectedCoverages": [
     { "name": "Incendio (Edificio y Contenidos)", "status": "present", "value": "500M", "deductible": "10%" },
     { "name": "Lucro Cesante", "status": "missing", "value": null, "deductible": null },
     { "name": "Transporte de Mercancías", "status": "excluded", "value": "No contratado", "deductible": null }
   ]

7. Devuelve SOLO el JSON, sin texto adicional.`;

// Legacy prompt for fallback
const EXTRACTION_PROMPT = `Eres un extractor de datos de cotizaciones de seguros PYME.

TAREA: Extrae los siguientes datos del texto de la cotización y presentalos 
en formato estructurado usando los marcadores ===.

=== INICIO EXTRACCIÓN ===

ASEGURADORA: [nombre exacto de la aseguradora]
PÓLIZA: [nombre del producto]
PRIMA ANUAL: [valor numérico]
MONEDA: [COP/USD]
VIGENCIA: [fecha inicio - fecha fin]

COBERTURAS:
- [Nombre cobertura]: [Valor asegurado o descripción]
  Deducible: [X% o valor o "No aplica"]
- [Siguiente cobertura]...

CONDICIONES ESPECIALES:
- [Cualquier condición particular mencionada]

=== FIN EXTRACCIÓN ===

REGLAS:
1. Si una cobertura no está especificada, pon "NO ESPECIFICADO"
2. Mantén los nombres exactos como aparecen en el documento
n3. Extrae TODAS las coberturas que encuentres, sin omitir ninguna
4. Sé preciso con los valores numéricos y porcentajes`;

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

            // Phase 1: Extract text from quote PDFs
            console.log('📑 Phase 1/5: Extracting text from PDFs...');
            const extractedQuotes = await pdfExtractor.processMultiplePdfs(
                quoteFiles.map(f => ({ path: f.path, originalname: f.originalname })),
                'COTIZACIÓN'
            );

            // Phase 2: Process each quote individually with Gemini
            console.log('🤖 Phase 2/5: Extracting structured data with Gemini...');
            const parsedQuotes: ParsedQuote[] = [];
            
            for (let i = 0; i < extractedQuotes.length; i++) {
                const quote = extractedQuotes[i];
                console.log(`   Quote ${i + 1}/${extractedQuotes.length}: ${quote.filename}`);
                
                try {
                    // Detect insurer and get profile
                    const detectedInsurer = insurerProfileService.detectInsurer(quote.text);
                    const profile = insurerProfileService.getProfile(detectedInsurer);
                    console.log(`   🔍 Detected insurer: ${detectedInsurer} (${profile.displayName})`);
                    
                    // Build prompt with profile
                    const extractionPrompt = `${STRUCTURED_EXTRACTION_PROMPT}\n\n${profile.promptTemplate}\n\n${profile.fewShotExamples.join('\n\n')}`;
                    
                    // Try structured extraction first (JSON mode)
                    let parsed: ParsedQuote;
                    try {
                        const structuredResult = await geminiService.extractStructured(
                            quote.text,
                            extractionPrompt,
                            quote.metadata?.pageCount || 1
                        );
                        
                        // Normalize coverages using thesaurus
                        const normalizedCoverages = normalizeCoverages(
                            (structuredResult.coverages || []).map((c: any) => ({
                                name: c.name,
                                value: c.value,
                                deductible: c.deductible
                            }))
                        );
                        
                        if (normalizedCoverages.needsReview) {
                            console.log(`   ⚠️ Some coverages need review after thesaurus normalization`);
                        }
                        
                        // Validate coverage values for absurd values
                        const coverageValidation = validateCoverageValues(
                            normalizedCoverages.normalized.map(c => ({ name: c.name, value: c.value }))
                        );
                        if (coverageValidation.length > 0) {
                            console.log(`   ⚠️ Coverage value issues detected:`);
                            coverageValidation.forEach(v => {
                                console.log(`      - ${v.coverageName}: ${v.message}`);
                            });
                        }
                        
                        // Convert structured result to ParsedQuote format
                        parsed = {
                            insurerName: structuredResult.insurerName || 'NO ESPECIFICADO',
                            policyName: structuredResult.policyName || 'NO ESPECIFICADO',
                            priceAnnual: structuredResult.priceAnnual || 0,
                            currency: structuredResult.currency || 'COP',
                            coverages: normalizedCoverages.normalized.map(c => ({
                                name: c.name,
                                canonicalName: c.name,
                                value: c.value,
                                deductible: c.deductible,
                                confidence: Math.round(c.confidence * 100)
                            })),
                            validityPeriod: structuredResult.validityPeriod,
                            specialConditions: structuredResult.specialConditions || [],
                            rawText: JSON.stringify(structuredResult),
                            parseConfidence: normalizedCoverages.needsReview ? 75 : 95
                        };
                        
                        console.log(`   ✅ Structured extraction: ${parsed.insurerName}, ${parsed.coverages.length} coverages`);
                    } catch (structuredError) {
                        // Fallback to legacy text extraction
                        console.warn(`   ⚠️ Structured extraction failed, falling back to text mode:`, (structuredError as Error).message);
                        
                        const geminiResponse = await geminiService.extractText(
                            quote.text,
                            EXTRACTION_PROMPT
                        );
                        
                        parsed = await quoteParser.parse(geminiResponse);
                        console.log(`   ✅ Fallback parsing: ${parsed.insurerName}, ${parsed.coverages.length} coverages, confidence: ${parsed.parseConfidence}%`);
                    }
                    
                    parsedQuotes.push(parsed);
                } catch (error) {
                    console.error(`   ❌ Error processing quote ${i + 1}:`, error);
                    parsedQuotes.push({
                        insurerName: quote.filename || 'Unknown',
                        policyName: 'Error en procesamiento',
                        priceAnnual: 0,
                        currency: 'COP',
                        coverages: [],
                        specialConditions: [`Error: ${(error as Error).message}`],
                        rawText: quote.text.substring(0, 500),
                        parseConfidence: 0
                    });
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

            // Phase 4: Cross-reference with RAG clause library
            console.log('🔍 Phase 4/5: Cross-referencing with clause library...');
            const crossRefResults: Map<number, CrossReferenceResult[]> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                console.log(`   Cross-referencing ${quote.insurerName}...`);
                
                try {
                    if (quote.coverages.length > 0) {
                        const results = await crossReferenceEngine.crossReferenceQuote(quote);
                        crossRefResults.set(i, results);
                        
                        const alertCounts = results.reduce((acc, r) => {
                            acc.critical += r.alerts.filter(a => a.level === 'CRITICAL').length;
                            acc.warning += r.alerts.filter(a => a.level === 'WARNING').length;
                            return acc;
                        }, { critical: 0, warning: 0 });
                        
                        console.log(`   ✅ Found ${results.length} coverage matches, ${alertCounts.critical} critical, ${alertCounts.warning} warnings`);
                    } else {
                        crossRefResults.set(i, []);
                        console.log(`   ⚠️ No coverages to cross-reference`);
                    }
                } catch (error) {
                    console.error(`   ❌ Cross-reference error for ${quote.insurerName}:`, error);
                    crossRefResults.set(i, []);
                }
            }

            // Phase 4b: Validate coverages against clause documents
            console.log('🔍 Phase 4b/5: Validating coverages against clause documents...');
            const clauseValidationResults: Map<number, any> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                console.log(`   Validating clause coverage for ${quote.insurerName}...`);
                
                try {
                    const validation = await clauseCoverageValidator.validate(quote, quote.insurerName);
                    clauseValidationResults.set(i, validation);
                    
                    if (!validation.hasClauseDocument) {
                        console.log(`   ⚠️ No clause document for ${quote.insurerName}, score penalized`);
                    } else {
                        console.log(`   ✅ ${validation.verifiedCount} verified, ${validation.phantomCount} phantom, ${validation.mandatoryMissingCount} mandatory missing`);
                    }
                } catch (error) {
                    console.error(`   ❌ Clause validation error for ${quote.insurerName}:`, error);
                    clauseValidationResults.set(i, null);
                }
            }

            // Phase 4: Calculate scores
            console.log('📊 Phase 4/5: Calculating scores...');
            const scoringResults: Map<number, ScoringResult> = new Map();
            
            for (let i = 0; i < parsedQuotes.length; i++) {
                const quote = parsedQuotes[i];
                const crossRefs = crossRefResults.get(i) || [];
                const clauseValidation = clauseValidationResults.get(i)?.results;
                
                try {
                    const scoring = quoteScorer.calculateScore(quote, crossRefs, parsedQuotes, undefined, clauseValidation);
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
                    fs.unlinkSync(f.path);
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
                advancedAnalysisResults
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
                
                const { error } = await supabase
                    .from('analysis_history' as any)
                    .insert(insertData as any)
                    .select();

                if (error) {
                    console.error("❌ [Supabase] Failed to save analysis:", error);
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

            const { data: history, error } = await supabase
                .from('analysis_history' as any)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching history from Supabase:", error);
                res.status(500).json({ error: "Failed to fetch history" });
                return;
            }

            res.json(history || []);
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
    advancedAnalysisResults?: Map<number, any>
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
            parseConfidence: quote.parseConfidence,
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
            legalOpinion: advancedAnalysis?.legalOpinion
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

function createDefaultScoringResult(quote: ParsedQuote): ScoringResult {
    return {
        totalScore: 0,
        breakdown: {
            coverage: 0,
            deductibles: 0,
            exclusions: 0,
            priceRatio: 0,
            sublimits: 0,
            warranties: 0
        },
        weights: quoteScorer.getDefaultWeights(),
        quotePriceRank: 0,
        marketPriceAverage: 0,
        coverageCount: quote.coverages.length,
        expectedCoverageCount: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        infoAlerts: 0
    };
}
