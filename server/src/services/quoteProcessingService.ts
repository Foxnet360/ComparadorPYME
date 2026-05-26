/**
 * Quote Processing Service
 * Orchestrates quote extraction using multimodal (V2) and legacy (V1) pipelines.
 * Extracted from analysisController.ts to separate processing logic from HTTP handling.
 */

import { geminiService } from './gemini';
import { pdfExtractor } from './pdfExtractor';
import { quoteParser, ParsedQuote } from './quoteParser';
import { quoteScorer, ScoringResult } from './quoteScorer';
import { normalizeCoverages } from './thesaurusMapper';
import { insurerProfileService } from './insurerProfileService';
import { validateCoverageValues } from './coverageValueValidator';
import { validateCoverageValues as validateValueSources } from './valueValidationService';
import { dualExtractionService } from './dualExtractionService';
import { detectFormatFamily, extractForDetection } from './formatDetector';
import { buildPromptForFamily } from './promptBuilder';
import { buildCanonicalCoverages } from './coverageNormalizer';
import { extractPremiumBreakdown, extractPerCoveragePremiums, validatePremiumBreakdown, normalizeCurrency } from './premiumExtractor';
import { getDeductibleFallback } from './deductibleResolver';

// Feature flag for multimodal extraction
const USE_MULTIMODAL = process.env.ENABLE_MULTIMODAL_EXTRACTION !== 'false';

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

- Si un campo NO aparece en el documento, usa: "NO ESPECIFICADO"
- Si la prima NO está clara, usa: 0
- NO inventes coberturas, deducibles, ni condiciones especiales
- Si hay ambigüedad, reporta la información cruda sin interpretar

Extrae la información de forma estructurada:`;

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
export async function processQuoteMultimodal(
  quoteFile: Express.Multer.File,
  index: number,
  total: number
): Promise<ParsedQuote> {
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
export async function processQuoteLegacy(
  quote: any,
  index: number,
  total: number
): Promise<ParsedQuote> {
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
          confidence: c.confidence,
        })),
        specialConditions: structuredResult.specialConditions || [],
        rawText: quote.text,
        parseConfidence: normalizedCoverages.needsReview ? 75 : 95,
        expectedCoverages: (structuredResult.expectedCoverages || []).map((c: any) => ({
          name: c.name,
          status: c.status,
          value: c.value,
          deductible: c.deductible,
        })),
      };
      
    } catch (jsonError: any) {
      // Fallback to text-based parsing
      console.log(`   📝 JSON extraction failed, falling back to text parsing...`);
      parsed = await quoteParser.parse(quote.text);
    }
    
    console.log(`   ✅ Legacy extraction: ${parsed.insurerName}, ${parsed.coverages.length} coverages, premium: ${parsed.priceAnnual}`);
    return parsed;
    
  } catch (error: any) {
    console.error(`   ❌ Legacy extraction failed:`, error.message);
    throw error;
  }
}

/**
 * Create a default scoring result for error cases
 */
export function createDefaultScoringResult(quote: ParsedQuote): ScoringResult {
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

/**
 * Determines whether to use multimodal extraction
 */
export function isMultimodalEnabled(): boolean {
  return USE_MULTIMODAL;
}

export { calculateDynamicTimeout, withTimeout };
