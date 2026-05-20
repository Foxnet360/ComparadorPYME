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
import { supabase } from '../config/database';
import { formatCOP } from '../utils/formatCurrency';
import { validateCoverageValues } from '../services/coverageValueValidator';
import { validateCoverageValues as validateValueSources } from '../services/valueValidationService';
import { dualExtractionService, DualExtractionResult } from '../services/dualExtractionService';
import fs from 'fs';

// NEW: Multimodal extraction imports
import { detectFormatFamily, extractForDetection } from '../services/formatDetector';
import { buildPromptForFamily } from '../services/promptBuilder';
import { buildCanonicalCoverages } from '../services/coverageNormalizer';
import { extractPremiumBreakdown, extractPerCoveragePremiums, validatePremiumBreakdown, normalizeCurrency, normalizePeriodicity } from '../services/premiumExtractor';
import { getDeductibleFallback } from '../services/deductibleResolver';
import quoteBasedAuditor from '../services/quoteBasedAuditor';

// Feature flag for multimodal extraction
// Deploy al 100% - V2 activo por defecto
const USE_MULTIMODAL = process.env.ENABLE_MULTIMODAL_EXTRACTION !== 'false';

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

5. SEPARACIÓN CRÍTICA - Valor vs Deducible:
   - El campo "value" DEBE contener SOLO el monto asegurado (ej: "$500.000.000", "500M", "Incluido")
   - El campo "deductible" DEBE contener SOLO la cuota de participación (ej: "10%", "5 SMMLV", "No aplica")
   - NUNCA mezcles ambos campos. Si ves "RC: $300M (ded 10%)", value="$300M", deductible="10%"
   - Valores sospechosos para verificación: RC o Incendio menores a $100M

6. Formato de valores de cobertura:
   - Usa el formato exacto del documento: "$500.000.000" o "500M"
   - NO inventes valores. Si no está claro, usa "NO ESPECIFICADO"
   - Para RC e Incendio, valores menores a $100M son sospechosos - verifica

7. Prima anual: Extrae solo el número entero (ej: 8500000), sin símbolos ni puntos.

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

### REGLAS ANTI-ALUCINACIÓN

8. SI NO ENCUENTRAS el valor literal en el documento:
   - Usa EXACTAMENTE "NO ESPECIFICADO" para el campo "value"
   - NO calcules, infieras ni inventes valores
   - Ejemplo: Si el documento dice "Incendio: A consultar" → value="NO ESPECIFICADO", NO inventes un número

9. Verificación de valores numéricos:
   - Si el documento NO muestra un número específico (ej: "A convenir", "Según valor declarado", "Variable"), usa "NO ESPECIFICADO"
   - NO conviertas textos descriptivos en números

10. Consistencia obligatoria:
   - Revisa que los valores que extraigas aparezcan literalmente en el documento
   - Si un valor parece "demasiado redondo" (ej: exactamente $10.000.000, $100.000.000) y no está explícito, verifica y marca como "NO ESPECIFICADO" si no está claro

11. Devuelve SOLO el JSON, sin texto adicional.`;

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

/**
 * Calcula timeout dinámico basado en número de coberturas
 * Fórmula: min(300, max(120, 30 + coverageCount * 3))
 */
function calculateDynamicTimeout(coverageCount: number): number {
  const baseTimeout = 30 + coverageCount * 3;
  return Math.min(300, Math.max(120, baseTimeout)) * 1000; // Convertir a ms
}

/**
 * Timeout wrapper for quote processing
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Process a single quote using multimodal extraction
 * Timeout: 5 minutes per quote
 */
async function processQuoteMultimodal(
  quoteFile: Express.Multer.File,
  index: number,
  total: number
): Promise<ParsedQuote> {
  // Use generous timeout for multimodal extraction
  // Individual quote timeout is handled internally with dynamic calculation
  return withTimeout(
    processQuoteMultimodalInternal(quoteFile, index, total),
    5 * 60 * 1000, // 5 minutes max per quote
    `Quote processing timeout (${quoteFile.originalname})`
  );
}

async function processQuoteMultimodalInternal(
  quoteFile: Express.Multer.File,
  index: number,
  total: number
): Promise<ParsedQuote> {
  console.log(`   Quote ${index + 1}/${total}: ${quoteFile.originalname}`);
  
  try {
    // Phase 1: Detect format family (quick text extraction)
    console.log(`   📋 Phase 1: Detecting format...`);
    const quickText = extractForDetection(
      await pdfExtractor.extractTextFromPdf(quoteFile.path).then(r => r.text),
      2000
    );
    const formatResult = detectFormatFamily(quickText);
    console.log(`   ✅ Format detected: ${formatResult.family} (${formatResult.confidence}% confidence)`);
    
    // Phase 2: Build specialized prompt
    console.log(`   📝 Phase 2: Building specialized prompt...`);
    const prompt = buildPromptForFamily(formatResult.family, {
      pageCount: formatResult.pageCount,
      hasTables: formatResult.hasTables,
    });
    
    // Phase 3: Extract using multimodal vision
    console.log(`   🔍 Phase 3: Extracting with multimodal vision...`);
    const extracted = await geminiService.extractFromPdfWithVision(
      quoteFile.path,
      prompt,
      quoteFile.originalname
    );
    
    // Phase 4: Normalize coverages
    console.log(`   🔄 Phase 4: Normalizing coverages...`);
    const normalizationResult = await buildCanonicalCoverages(
      extracted.rawCoverages || [],
      extracted.insuredAssets || [],
      extracted.generalDeductibles || []
    );
    
    // Phase 5: Extract premium breakdown
    console.log(`   💰 Phase 5: Extracting premium breakdown...`);
    const premiumBreakdown = extractPremiumBreakdown(extracted);
    const perCoveragePremiums = extractPerCoveragePremiums(extracted.rawCoverages || []);
    const premiumValidation = validatePremiumBreakdown(premiumBreakdown, perCoveragePremiums);
    
    if (premiumValidation.warnings.length > 0) {
      console.log(`   ⚠️ Premium warnings: ${premiumValidation.warnings.join(', ')}`);
    }
    
    // Build ParsedQuote from normalized data
    const parsed: ParsedQuote = {
      insurerName: extracted.insurerName || 'NO ESPECIFICADO',
      policyName: extracted.policyName || 'NO ESPECIFICADO',
      priceAnnual: premiumBreakdown.totalPayable || 0,
      currency: normalizeCurrency(premiumBreakdown.currency),
      coverages: normalizationResult.canonicalCoverages.map(c => ({
        name: c.name,
        canonicalName: c.name,
        value: c.insuredAmount ? c.insuredAmount.toString() : 'NO ESPECIFICADO',
        deductible: c.deductible || getDeductibleFallback(c.name, normalizationResult.generalDeductibles),
        confidence: c.confidence,
      })),
      uncategorizedCoverages: normalizationResult.uncategorizedCoverages?.map(c => ({
        name: c.name,
        canonicalName: c.name,
        value: c.insuredAmount ? c.insuredAmount.toString() : 'NO ESPECIFICADO',
        deductible: c.deductible || 'NO ESPECIFICADO',
        confidence: c.confidence,
      })),
      validityPeriod: extracted.validityPeriod,
      specialConditions: [
        ...(extracted.specialConditions || []),
        ...(premiumValidation.warnings),
        ...(normalizationResult.needsReview ? ['Algunas coberturas necesitan revisión'] : []),
      ],
      rawText: JSON.stringify(extracted),
      parseConfidence: normalizationResult.totalConfidence,
      expectedCoverages: normalizationResult.canonicalCoverages.map(c => ({
        name: c.name,
        status: c.status,
        value: c.insuredAmount ? c.insuredAmount.toString() : null,
        deductible: c.deductible,
      })),
    };
    
    console.log(`   ✅ Multimodal extraction: ${parsed.insurerName}, ${parsed.coverages.length} coverages, premium: ${parsed.priceAnnual}`);
    return parsed;
    
  } catch (error: any) {
    console.error(`   ❌ Multimodal extraction failed:`, error.message);
    throw error;
  }
}

/**
 * Process a single quote using legacy text-based extraction
 * Timeout: 5 minutes per quote
 */
async function processQuoteLegacy(
  quote: any,
  index: number,
  total: number
): Promise<ParsedQuote> {
  // Use generous timeout for legacy extraction as well
  return withTimeout(
    processQuoteLegacyInternal(quote, index, total),
    5 * 60 * 1000, // 5 minutes max per quote
    `Quote processing timeout (legacy) (${quote.filename || 'unknown'})`
  );
}

async function processQuoteLegacyInternal(
  quote: any,
  index: number,
  total: number
): Promise<ParsedQuote> {
  console.log(`   Quote ${index + 1}/${total}: ${quote.filename}`);
  
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
    
    return parsed;
  } catch (error) {
    console.error(`   ❌ Error processing quote ${index + 1}:`, error);
    return {
      insurerName: quote.filename || 'Unknown',
      policyName: 'Error en procesamiento',
      priceAnnual: 0,
      currency: 'COP',
      coverages: [],
      specialConditions: [`Error: ${(error as Error).message}`],
      rawText: quote.text?.substring(0, 500) || '',
      parseConfidence: 0
    };
  }
}

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
            console.log(`🔧 Pipeline: ${USE_MULTIMODAL ? 'Multimodal (V2)' : 'Legacy (V1)'}`);

            let parsedQuotes: ParsedQuote[] = [];

            if (USE_MULTIMODAL) {
                // NEW: Multimodal extraction pipeline (PARALLEL)
                console.log('🤖 Using multimodal extraction with Gemini 2.5 Pro (PARALLEL)...');
                
                // Process all quotes in parallel with concurrency limit
                const CONCURRENCY_LIMIT = 2; // Limit to 2 simultaneous Gemini calls
                const processQuote = async (file: Express.Multer.File, index: number) => {
                    try {
                        const parsed = await processQuoteMultimodal(file, index, quoteFiles.length);
                        return { index, parsed, error: null };
                    } catch (error: any) {
                        console.error(`   ❌ Error processing quote ${index + 1}:`, error);
                        // Fallback to legacy pipeline
                        console.log(`   🔄 Falling back to legacy pipeline...`);
                        try {
                            const fallback = await processQuoteLegacy(file, index, quoteFiles.length);
                            return { index, parsed: fallback, error: null };
                        } catch (fallbackError: any) {
                            return { index, parsed: null, error: fallbackError };
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
                            parsedQuotes[result.index] = {
                                insurerName: quoteFiles[result.index]?.originalname || 'Unknown',
                                policyName: 'Error en procesamiento',
                                priceAnnual: 0,
                                currency: 'COP',
                                coverages: [],
                                specialConditions: [`Error: ${result.error?.message || 'Unknown error'}`],
                                rawText: '',
                                parseConfidence: 0
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
                insurersWithClauses,
                clauseValidationResults,
                advancedAnalysisResults,
                dualExtractionResults
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
    insurersWithClauses: Map<string, boolean>,
    clauseValidationResults?: Map<number, any>,
    advancedAnalysisResults?: Map<number, any>,
    dualExtractionResults?: Map<number, DualExtractionResult[]>
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
            isRagAvailable: insurersWithClauses.get(quote.insurerName) || false,
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

function createDefaultScoringResult(quote: ParsedQuote): ScoringResult {
    return {
        totalScore: 0,
        dataQualityScore: 0,
        verificationConfidence: 0,
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
