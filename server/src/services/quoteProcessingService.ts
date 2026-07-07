/**
 * Quote Processing Service
 * Orchestrates quote extraction using multimodal (V2) and legacy (V1) pipelines.
 * Extracted from analysisController.ts to separate processing logic from HTTP handling.
 */

import { geminiService } from './gemini';
import { pdfExtractor, PDFExtractionResult } from './pdfExtractor';
import { quoteParser, ParsedQuote } from './quoteParser';
import { quoteScorer, ScoringResult } from './quoteScorer';
import { normalizeCoverages } from './thesaurusMapper';
import { insurerProfileService } from './insurerProfileService';

import {
  detectFormatFamily,
  detectFormatWithRegistry,
  extractForDetection,
  FormatDetectionResult,
} from './formatDetector';
import { buildPromptForFamily, buildTemplatePrompt } from './promptBuilder';
import { buildCanonicalCoverages, RawCoverage } from './coverageNormalizer';
import {
  extractPremiumBreakdown,
  extractPerCoveragePremiums,
  validatePremiumBreakdown,
  normalizeCurrency,
} from './premiumExtractor';
import { getDeductibleFallback } from './deductibleResolver';
import {
  validateQuoteExtractionV2,
  validateQuoteExtraction,
  formatZodError,
  QuoteExtractionV2,
  QuoteExtraction,
} from '../schemas/extractionSchemas';
import { z } from 'zod';
import { reconciliationService } from './reconciliationService';
import { featureFlags } from '../config/featureFlags';
import { templateRegistryService, PageTextItems } from './templateRegistryService';
import { TemplateRegistryEntry } from '../schemas/templateRegistrySchema';
import { extractTables, LayoutParserResult } from './layoutParser';
import { coverageGraphService } from './coverageGraphService';
import { GraphQueryResult } from '../types/templateGraph';
import {
  createStructuredLogger,
  globalMetrics,
  StructuredLogger,
  MetricCollector,
} from '../utils/structuredLogger';
import {
  createExtractionMetricsEmitter,
  ExtractionMetricsEmitter,
  ExtractionResult,
} from './extractionMetrics';
import { randomUUID } from 'crypto';
import path from 'path';

export interface NativeTextResult {
  text: string;
  pageTextMap: Record<number, string>;
  pageTextItems?: PageTextItems[];
  metadata?: { pageCount: number };
  isScanned: boolean;
}

export interface ExtractionPromptSelection {
  prompt: string;
  usedTemplate: boolean;
  templateId?: string | null;
}

export interface ExtractionPromptContext {
  pageCount?: number;
  formatFamily?: string;
  logger?: StructuredLogger;
  metrics?: MetricCollector;
}

export interface GraphEnrichedCoverage {
  rawName: string;
  insuredAmount?: number | null;
  deductible?: string | null;
  premium?: number | null;
  notes?: string | null;
  rawTextSnippet?: string;
  pageNumber?: number | null;
  graphConfidence?: number;
  graphProvenance?: string;
  isComposite?: boolean;
  graphComponents?: string[];
}

export function selectExtractionPrompt(
  detection: FormatDetectionResult,
  template: TemplateRegistryEntry | undefined,
  layoutResult: LayoutParserResult,
  context: ExtractionPromptContext
): ExtractionPromptSelection {
  const logger = context.logger ?? createStructuredLogger('quoteProcessingService');
  const metrics = context.metrics ?? globalMetrics;
  const pageCount = context.pageCount;

  const templateMatches =
    detection.templateId && template && !layoutResult.failed && layoutResult.tables.length > 0;

  if (templateMatches) {
    const prompt = buildTemplatePrompt(detection.templateId!, template, layoutResult.tables);
    logger.info('pipeline_path_taken', 'Selected template-aware extraction prompt', {
      path: 'template',
      templateId: detection.templateId,
      insurer: template.insurer,
      tableCount: layoutResult.tables.length,
    });
    metrics.increment('quoteProcessing.pipeline_path', { path: 'template' });
    return { prompt, usedTemplate: true, templateId: detection.templateId };
  }

  const fallbackReason = !detection.templateId
    ? 'no template matched'
    : layoutResult.failed
      ? `layout parsing failed: ${layoutResult.failureReason}`
      : 'template matched but no usable tables';

  const prompt = buildPromptForFamily(detection.family, {
    pageCount,
    hasTables: detection.hasTables,
    formatFamily: detection.family,
  });

  logger.info('pipeline_path_taken', 'Selected generic extraction prompt', {
    path: 'generic',
    family: detection.family,
    fallbackReason,
    templateId: detection.templateId ?? undefined,
  });
  metrics.increment('quoteProcessing.pipeline_path', { path: 'generic' });

  return { prompt, usedTemplate: false, templateId: null };
}

interface LegacyQuoteInput {
  text: string;
  filename?: string;
  isScanned?: boolean;
  metadata?: { pageCount?: number };
}

export async function enrichRawCoveragesWithGraph(
  rawCoverages: RawCoverage[],
  insurer?: string,
  domain: string = 'pyme'
): Promise<GraphEnrichedCoverage[]> {
  if (!featureFlags.isEnabled('useTemplateGraphPipeline')) {
    return rawCoverages as GraphEnrichedCoverage[];
  }

  return Promise.all(
    rawCoverages.map(async (coverage) => {
      try {
        const graphResult: GraphQueryResult = await coverageGraphService.query(coverage.rawName, {
          insurer,
          domain,
        });

        if (graphResult.mappings.length === 0) {
          return coverage as GraphEnrichedCoverage;
        }

        const best = graphResult.mappings[0];
        return {
          ...coverage,
          graphConfidence: Math.round(best.confidence * 100),
          graphProvenance: best.provenance,
          isComposite: graphResult.composite,
          graphComponents: graphResult.components,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `⚠️ [quoteProcessingService] Graph enrichment failed for "${coverage.rawName}": ${message}`
        );
        return coverage as GraphEnrichedCoverage;
      }
    })
  );
}

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

interface ZodValidator<T> {
  (data: unknown): { success: true; data: T } | { success: false; error: z.ZodError };
}

/**
 * Retry wrapper for Gemini calls whose outputs must pass Zod validation.
 * Validation failures are retried up to maxRetries times before falling back
 * to the raw (unvalidated) output so the pipeline degrades gracefully.
 */
async function extractWithZodValidation<T>(
  attempt: () => Promise<unknown>,
  validate: ZodValidator<T>,
  context: string,
  maxRetries = 2
): Promise<{ data: T; wasRawFallback: boolean }> {
  let lastRaw: unknown;
  let lastError: unknown;

  for (let i = 0; i <= maxRetries; i++) {
    lastRaw = await attempt();
    const validation = validate(lastRaw);
    if (validation.success) {
      return { data: validation.data, wasRawFallback: false };
    }
    lastError = validation.error;
    const issues = formatZodError(validation.error);
    console.warn(
      `   ⚠️ ${context} Zod validation failed (attempt ${i + 1}/${maxRetries + 1}): ${issues}`
    );
  }

  console.warn(
    `   ⚠️ ${context} exceeded validation retries; using raw extraction. Last issues: ${formatZodError(lastError as z.ZodError)}`
  );
  return { data: lastRaw as T, wasRawFallback: true };
}

/**
 * Process a single quote using multimodal extraction
 * Timeout: 5 minutes per quote
 */
export interface ProcessQuoteOptions {
  domain?: string;
  quoteId: string;
  metrics: ExtractionMetricsEmitter;
  nativeTextResult?: NativeTextResult;
}

export async function processQuoteMultimodal(
  quoteFile: Express.Multer.File,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  return withTimeout(
    processQuoteMultimodalInternal(quoteFile, index, total, options),
    5 * 60 * 1000, // 5 minutes max per quote
    `Quote processing timeout (${quoteFile.originalname})`
  );
}

async function processQuoteMultimodalInternal(
  quoteFile: Express.Multer.File,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  const domain = options?.domain ?? 'pyme';
  const quoteId = options?.quoteId ?? randomUUID();
  const metrics = options?.metrics ?? createExtractionMetricsEmitter();

  console.log(`   Quote ${index + 1}/${total}: ${quoteFile.originalname}`);

  try {
    // Phase 1: Extract native text for robust insurer/format detection.
    // If the controller already extracted it, reuse it to avoid double work.
    console.log(`   📄 Phase 1: Extracting native PDF text for detection...`);
    let nativeText = '';
    let pageTextMap: Record<number, string> = {};
    let extractionResult: Partial<PDFExtractionResult> = options?.nativeTextResult ?? {};

    if (options?.nativeTextResult) {
      nativeText = options.nativeTextResult.text || '';
      pageTextMap = options.nativeTextResult.pageTextMap || {};
      console.log(`   ✅ Reused native text: ${nativeText.length} characters.`);
    } else {
      try {
        extractionResult = await pdfExtractor.extractTextFromPdf(quoteFile.path);
        nativeText = extractionResult.text || '';
        pageTextMap = extractionResult.pageTextMap || {};
        console.log(`   ✅ Extracted ${nativeText.length} characters of native text.`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`   ⚠️ Native text extraction failed: ${message}.`);
      }
    }

    metrics.emit({
      quoteId,
      index,
      total,
      pageCount: extractionResult.metadata?.pageCount ?? 1,
      isScanned: extractionResult.isScanned ?? false,
    });

    // Phase 1.5: Detect format family and insurer-specific template.
    console.log(`   📋 Phase 1.5: Detecting format family and insurer template from content...`);
    const textPreview = extractForDetection(nativeText, 2000);
    const pageTextItems = extractionResult.pageTextItems;

    let detectionResult: FormatDetectionResult;
    let template: TemplateRegistryEntry | undefined;

    if (featureFlags.isEnabled('useTemplateGraphPipeline')) {
      detectionResult = await detectFormatWithRegistry(textPreview, templateRegistryService, {
        domain,
        pages: pageTextItems,
      });
      if (detectionResult.templateId) {
        template = await templateRegistryService.getTemplate(detectionResult.templateId, domain);
      }
    } else {
      detectionResult = detectFormatFamily(textPreview);
    }

    const family = detectionResult.family;
    const detectionSource = detectionResult.confidence > 0 ? 'nativeText' : 'default';

    console.log(
      `   ✅ Format family detected: ${family} (confidence: ${detectionResult.confidence}, source: ${detectionSource})` +
        (detectionResult.templateId
          ? `, template: ${detectionResult.templateId} (${detectionResult.templateConfidence}%)`
          : '')
    );

    const detectedInsurer = insurerProfileService.detectInsurer(nativeText);
    metrics.emit({
      quoteId,
      index,
      total,
      path: 'v2',
      insurer: detectedInsurer,
      insurerDetectionSource: 'unknown',
      formatFamily: family,
    });
    metrics.emit({
      quoteId,
      index,
      total,
      path: 'v2',
      formatFamily: family,
    });

    // Phase 2: Build specialized or template-aware prompt
    console.log(`   📝 Phase 2: Building extraction prompt...`);
    let layoutResult: LayoutParserResult = {
      tables: [],
      regions: [],
      rotatedPages: [],
      failed: false,
    };
    if (
      featureFlags.isEnabled('useTemplateGraphPipeline') &&
      detectionResult.templateId &&
      pageTextItems
    ) {
      layoutResult = extractTables(pageTextItems);
    }

    const { prompt: extractionPrompt, usedTemplate } = selectExtractionPrompt(
      detectionResult,
      template,
      layoutResult,
      { pageCount: extractionResult.metadata?.pageCount ?? 1, formatFamily: family }
    );

    if (usedTemplate && template) {
      console.log(`   📐 Using layout-aware template prompt for ${detectionResult.templateId}`);
    } else if (detectionResult.templateId) {
      console.log(
        `   ⚠️ Template ${detectionResult.templateId} matched but layout parsing failed or was disabled; falling back to generic prompt`
      );
    }

    // Phase 3: Extract using multimodal vision directly on File API.
    // Fallback ladder: strict validation → retry up to 2× → raw extraction → legacy V1 → failed placeholder.
    console.log(`   🔍 Phase 3: Extracting with multimodal vision + text reference...`);
    let extracted: QuoteExtractionV2 | null = null;
    let repairUsed = false;
    let repairType: string | undefined;
    let repairAttempts = 0;

    try {
      const result = await extractWithZodValidation<QuoteExtractionV2>(
        () =>
          geminiService.extractFromPdfWithVision(
            quoteFile.path,
            extractionPrompt,
            quoteFile.originalname,
            nativeText,
            {
              skipValidation: true,
              onRepairUsed: (category) => {
                repairUsed = true;
                repairType = category;
                repairAttempts++;
              },
            }
          ),
        validateQuoteExtractionV2,
        'Multimodal'
      );
      extracted = result.data;

      if (result.wasRawFallback) {
        metrics.emit({
          quoteId,
          index,
          total,
          result: 'raw_extraction_fallback',
          repairAttempts,
          repairType,
          path: 'v2',
        });
      } else if (repairUsed) {
        metrics.emit({
          quoteId,
          index,
          total,
          result: 'success_after_repair',
          repairAttempts,
          repairType,
          path: 'v2',
        });
      } else {
        metrics.emit({
          quoteId,
          index,
          total,
          result: 'success',
          repairAttempts,
          path: 'v2',
        });
      }
    } catch (v2Error: unknown) {
      const message = v2Error instanceof Error ? v2Error.message : String(v2Error);
      console.warn(`   ⚠️ V2 extraction failed after retries/repair: ${message}`);
    }

    // Validate template schema when a template was used.
    if (extracted && usedTemplate && template && detectionResult.templateId) {
      const validation = templateRegistryService.validatePayload(
        detectionResult.templateId,
        extracted,
        domain
      );
      if (!validation.valid) {
        console.warn(
          `   ⚠️ Template schema validation failed: ${validation.errors?.join('; ')}. Falling back to generic extraction.`
        );
        const genericPrompt = buildPromptForFamily(family, {
          pageCount: extractionResult.metadata?.pageCount ?? 1,
          hasTables: detectionResult.hasTables,
          formatFamily: family,
        });
        try {
          const genericResult = await extractWithZodValidation<QuoteExtractionV2>(
            () =>
              geminiService.extractFromPdfWithVision(
                quoteFile.path,
                genericPrompt,
                quoteFile.originalname,
                nativeText,
                { skipValidation: true }
              ),
            validateQuoteExtractionV2,
            'Multimodal'
          );
          extracted = genericResult.data;
        } catch (genericError: unknown) {
          const message =
            genericError instanceof Error ? genericError.message : String(genericError);
          console.warn(`   ⚠️ Generic extraction fallback failed: ${message}`);
          extracted = null;
        }
      }
    }

    // Legacy V1 fallback when V2 produced nothing usable.
    if (!extracted || !extracted.rawCoverages || extracted.rawCoverages.length === 0) {
      console.log(`   🔄 Falling back to legacy V1 extraction...`);
      metrics.emit({
        quoteId,
        index,
        total,
        result: 'legacy_fallback',
        path: 'legacy',
        legacyFallback: true,
        repairAttempts,
      });
      try {
        return await processQuoteLegacy(
          {
            text: nativeText,
            metadata: extractionResult.metadata,
            filename: quoteFile.originalname,
            isScanned: extractionResult.isScanned ?? false,
          },
          index,
          total,
          { domain, quoteId, metrics }
        );
      } catch (legacyError: unknown) {
        const message = legacyError instanceof Error ? legacyError.message : String(legacyError);
        console.error(`   ❌ Legacy fallback also failed:`, message);
        return createFailedPlaceholder(quoteFile, legacyError);
      }
    }

    // Detect and log format family mismatch, but accept the model output.
    if (extracted.formatFamily && extracted.formatFamily !== family) {
      console.warn(
        `   ⚠️ Format family mismatch: detected ${family}, model reported ${extracted.formatFamily}`
      );
    }

    // Phase 3.5: Enrich extracted raw coverages with graph metadata when enabled.
    if (featureFlags.isEnabled('useTemplateGraphPipeline')) {
      const insurerName =
        extracted.insurerName || detectionResult.templateId ? template?.insurer : undefined;
      extracted.rawCoverages = (await enrichRawCoveragesWithGraph(
        extracted.rawCoverages || [],
        insurerName,
        domain
      )) as QuoteExtractionV2['rawCoverages'];
    }

    // Phase 4: Normalize coverages
    console.log(`   🔄 Phase 4: Normalizing coverages... (domain: ${domain})`);
    const insurerName = extracted.insurerName || detectedInsurer;
    const normalizationResult = await buildCanonicalCoverages(
      extracted.rawCoverages || [],
      extracted.insuredAssets || [],
      extracted.generalDeductibles || [],
      pageTextMap,
      domain,
      insurerName
    );

    // Phase 5: Extract premium breakdown
    console.log(`   💰 Phase 5: Extracting premium breakdown...`);
    const premiumBreakdown = extractPremiumBreakdown(extracted);
    const perCoveragePremiums = extractPerCoveragePremiums(extracted.rawCoverages || []);
    const premiumValidation = validatePremiumBreakdown(premiumBreakdown, perCoveragePremiums);

    if (premiumValidation.warnings.length > 0) {
      console.log(`   ⚠️ Premium warnings: ${premiumValidation.warnings.join(', ')}`);
    }

    // Phase 6: Reconcile quote against clause data
    console.log(`   🔍 Phase 6: Reconciling quote against clause data...`);
    let reconciliationResults: import('../schemas/extractionSchemas').ReconciliationResult[] = [];
    try {
      const preParsed: ParsedQuote = {
        insurerName: extracted.insurerName || 'NO ESPECIFICADO',
        policyName: extracted.policyName || 'NO ESPECIFICADO',
        priceAnnual: premiumBreakdown.totalPayable || 0,
        currency: normalizeCurrency(premiumBreakdown.currency),
        coverages: normalizationResult.canonicalCoverages.map((c) => ({
          name: c.name,
          canonicalName: c.name,
          value: c.insuredAmount ? c.insuredAmount.toString() : 'NO ESPECIFICADO',
          deductible:
            c.deductible || getDeductibleFallback(c.name, normalizationResult.generalDeductibles),
          confidence: c.confidence,
          rawTextSnippet: c.rawTextSnippet,
          calculatedPage: c.pageNumber || undefined,
        })),
        specialConditions: [...(extracted.specialConditions || []), ...premiumValidation.warnings],
        rawText: JSON.stringify(extracted),
        parseConfidence: normalizationResult.totalConfidence,
      };
      reconciliationResults = await reconciliationService.reconcileQuote(preParsed, {
        insurerName: extracted.insurerName,
        productName: extracted.policyName,
        domain,
      });
      const mismatchCount = reconciliationResults.filter((r) => r.status === 'MISMATCH').length;
      if (mismatchCount > 0) {
        console.log(`   ⚠️ Found ${mismatchCount} deductible discrepancies vs clause data`);
      }
    } catch (reconError: unknown) {
      const message = reconError instanceof Error ? reconError.message : String(reconError);
      console.warn(`   ⚠️ Reconciliation failed (non-blocking): ${message}`);
    }

    // Build ParsedQuote from normalized data
    const parsed: ParsedQuote = {
      insurerName: extracted.insurerName || 'NO ESPECIFICADO',
      policyName: extracted.policyName || 'NO ESPECIFICADO',
      priceAnnual: premiumBreakdown.totalPayable || 0,
      currency: normalizeCurrency(premiumBreakdown.currency),
      coverages: normalizationResult.canonicalCoverages.map((c) => ({
        name: c.name,
        canonicalName: c.name,
        value: c.insuredAmount ? c.insuredAmount.toString() : 'NO ESPECIFICADO',
        deductible:
          c.deductible || getDeductibleFallback(c.name, normalizationResult.generalDeductibles),
        confidence: c.confidence,
        rawTextSnippet: c.rawTextSnippet,
        calculatedPage: c.pageNumber || undefined,
      })),
      uncategorizedCoverages: normalizationResult.uncategorizedCoverages?.map((c) => ({
        name: c.name,
        canonicalName: c.name,
        value: c.insuredAmount ? c.insuredAmount.toString() : 'NO ESPECIFICADO',
        deductible: c.deductible || 'NO ESPECIFICADO',
        confidence: c.confidence,
        rawTextSnippet: c.rawTextSnippet,
        calculatedPage: c.pageNumber || undefined,
      })),
      validityPeriod: extracted.validityPeriod ?? undefined,
      specialConditions: [
        ...(extracted.specialConditions || []),
        ...premiumValidation.warnings,
        ...(normalizationResult.needsReview ? ['Algunas coberturas necesitan revisión'] : []),
      ],
      rawText: JSON.stringify(extracted),
      parseConfidence: normalizationResult.totalConfidence,
      expectedCoverages: normalizationResult.canonicalCoverages.map((c) => ({
        name: c.name,
        status: c.status,
        value: c.insuredAmount ? c.insuredAmount.toString() : null,
        deductible: c.deductible,
      })),
      pageTextMap: pageTextMap,
      reconciliationResults: reconciliationResults.length > 0 ? reconciliationResults : undefined,
    };

    metrics.emit({
      quoteId,
      index,
      total,
      rawCoverageCount: extracted.rawCoverages?.length ?? 0,
      canonicalCoverageCount: normalizationResult.canonicalCoverages.length,
    });

    console.log(
      `   ✅ Multimodal extraction: ${parsed.insurerName}, ${parsed.coverages.length} coverages, premium: ${parsed.priceAnnual}`
    );
    return parsed;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Multimodal extraction failed:`, message);
    return createFailedPlaceholder(quoteFile, error);
  }
}

/**
 * Process a single quote using legacy text-based extraction
 * Timeout: 5 minutes per quote
 */
export async function processQuoteLegacy(
  quote: LegacyQuoteInput,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  return withTimeout(
    processQuoteLegacyInternal(quote, index, total, options),
    5 * 60 * 1000, // 5 minutes max per quote
    `Quote processing timeout (legacy) (${quote.filename || 'unknown'})`
  );
}

async function processQuoteLegacyInternal(
  quote: LegacyQuoteInput,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  const domain = options?.domain ?? 'pyme';
  const quoteId = options?.quoteId ?? randomUUID();
  const metrics = options?.metrics ?? createExtractionMetricsEmitter();

  console.log(`   Quote ${index + 1}/${total}: ${quote.filename}`);

  try {
    metrics.emit({
      quoteId,
      index,
      total,
      pageCount: quote.metadata?.pageCount ?? 1,
      isScanned: quote.isScanned ?? false,
    });

    // Detect insurer and get profile
    const detectedInsurer = insurerProfileService.detectInsurer(quote.text);
    metrics.emit({
      quoteId,
      index,
      total,
      insurer: detectedInsurer,
      insurerDetectionSource: 'unknown',
      formatFamily: 'legacy',
    });
    const profile = insurerProfileService.getProfile(detectedInsurer);
    console.log(`   🔍 Detected insurer: ${detectedInsurer} (${profile.displayName})`);

    // Build prompt with profile
    const extractionPrompt = `${STRUCTURED_EXTRACTION_PROMPT}\n\n${profile.promptTemplate}\n\n${profile.fewShotExamples.join('\n\n')}`;

    // Try structured extraction first (JSON mode)
    let parsed: ParsedQuote;
    try {
      const { data: structuredResult } = await extractWithZodValidation<QuoteExtraction>(
        () =>
          geminiService.extractStructured(
            quote.text,
            extractionPrompt,
            quote.metadata?.pageCount || 1
          ),
        validateQuoteExtraction,
        'Legacy'
      );

      // Normalize coverages using thesaurus
      const normalizedCoverages = normalizeCoverages(
        (structuredResult.coverages || []).map((c) => ({
          name: c.name,
          value: c.value ?? 'NO ESPECIFICADO',
          deductible: c.deductible ?? 'NO ESPECIFICADO',
        })),
        domain
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
        coverages: normalizedCoverages.normalized.map((c) => ({
          name: c.name,
          canonicalName: c.name,
          value: c.value,
          deductible: c.deductible,
          confidence: c.confidence,
        })),
        specialConditions: structuredResult.specialConditions || [],
        rawText: quote.text,
        parseConfidence: normalizedCoverages.needsReview ? 75 : 95,
        expectedCoverages: (structuredResult.expectedCoverages || []).map((c) => ({
          name: c.name,
          status: c.status,
          value: c.value ?? null,
          deductible: c.deductible ?? null,
        })),
      };
    } catch (_jsonError: unknown) {
      // Fallback to text-based parsing
      console.log(`   📝 JSON extraction failed, falling back to text parsing...`);
      parsed = await quoteParser.parse(quote.text);
    }

    // Reconcile legacy quote against clause data
    try {
      const reconResults = await reconciliationService.reconcileQuote(parsed, { domain });
      if (reconResults.length > 0) {
        parsed.reconciliationResults = reconResults;
        const mismatchCount = reconResults.filter((r) => r.status === 'MISMATCH').length;
        if (mismatchCount > 0) {
          console.log(
            `   ⚠️ Legacy: found ${mismatchCount} deductible discrepancies vs clause data`
          );
        }
      }
    } catch (reconError: unknown) {
      const message = reconError instanceof Error ? reconError.message : String(reconError);
      console.warn(`   ⚠️ Legacy reconciliation failed (non-blocking): ${message}`);
    }

    console.log(
      `   ✅ Legacy extraction: ${parsed.insurerName}, ${parsed.coverages.length} coverages, premium: ${parsed.priceAnnual}`
    );
    return parsed;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Legacy extraction failed:`, message);
    throw error;
  }
}

/**
 * Create a failed placeholder quote when all extraction paths fail.
 * Keeps the /api/analyze response shape stable.
 */
export function createFailedPlaceholder(
  quoteFile: Express.Multer.File,
  error: unknown
): ParsedQuote {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const isServiceError =
    errorMessage.includes('503') ||
    errorMessage.includes('Service Unavailable') ||
    errorMessage.includes('high demand');
  const displayError = isServiceError
    ? 'Servicio temporalmente no disponible. Intente nuevamente en unos momentos.'
    : errorMessage;

  return {
    insurerName:
      quoteFile.originalname.replace(/COTIZACION.*?-\s*/i, '').replace(/\.pdf$/i, '') ||
      'Desconocido',
    policyName: 'Error en procesamiento',
    priceAnnual: 0,
    currency: 'COP',
    coverages: [],
    specialConditions: [`Error: ${displayError}`],
    rawText: '',
    parseConfidence: 0,
    isFailed: true,
    errorCategory: isServiceError ? 'SERVICE_UNAVAILABLE' : 'EXTRACTION_FAILED',
    errorCode: isServiceError ? 'GEMINI_SERVICE_UNAVAILABLE' : 'EXTRACTION_ERROR',
  };
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
      warranties: 0,
    },
    weights: quoteScorer.getDefaultWeights(),
    quotePriceRank: 0,
    marketPriceAverage: 0,
    coverageCount: quote.coverages.length,
    expectedCoverageCount: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    infoAlerts: 0,
  };
}

/**
 * Determines whether to use multimodal extraction.
 * The ENABLE_MULTIMODAL_EXTRACTION=false env var is kept as an emergency escape hatch.
 */
export interface ProcessQuotesBatchOptions {
  domain?: string;
  concurrencyLimit?: number;
  quoteTimeoutMs?: number;
  metrics?: ExtractionMetricsEmitter;
  /** Optional processor overrides for testability. */
  processQuoteMultimodal?: typeof processQuoteMultimodal;
  processQuoteLegacy?: typeof processQuoteLegacy;
}

interface QuoteFileRef {
  path: string;
  originalname: string;
}

function buildFileRef(pdfPath: string): QuoteFileRef {
  return {
    path: pdfPath,
    originalname: path.basename(pdfPath),
  };
}

function buildErrorPlaceholder(fileRef: QuoteFileRef, error: unknown): ParsedQuote {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isTimeout = errorMessage.toLowerCase().includes('timeout');
  const isServiceError =
    errorMessage.includes('503') ||
    errorMessage.includes('Service Unavailable') ||
    errorMessage.includes('high demand');
  const displayError = isTimeout
    ? 'Tiempo de espera agotado procesando la cotización. Intente nuevamente.'
    : isServiceError
      ? 'Servicio temporalmente no disponible. Intente nuevamente en unos momentos.'
      : errorMessage;

  return {
    insurerName:
      fileRef.originalname.replace(/COTIZACION.*?-\s*/i, '').replace(/\.pdf$/i, '') ||
      'Desconocido',
    policyName: 'Error en procesamiento',
    priceAnnual: 0,
    currency: 'COP',
    coverages: [],
    specialConditions: [`Error: ${displayError}`],
    rawText: '',
    parseConfidence: 0,
    isFailed: true,
    errorCategory: isServiceError ? 'SERVICE_UNAVAILABLE' : 'EXTRACTION_FAILED',
    errorCode: isServiceError ? 'GEMINI_SERVICE_UNAVAILABLE' : 'EXTRACTION_ERROR',
  };
}

/**
 * Process a batch of quote PDFs using the V2 multimodal pipeline by default,
 * falling back to legacy text extraction for scanned PDFs or when V2 is disabled.
 *
 * The function preserves the original order of pdfPaths, limits concurrent
 * Gemini calls, and returns error placeholders for individual quote failures
 * so the overall comparison can still be built.
 */
export async function processQuotesBatch(
  pdfPaths: string[],
  options: ProcessQuotesBatchOptions = {}
): Promise<ParsedQuote[]> {
  const domain = options.domain ?? 'pyme';
  const concurrencyLimit = Math.max(1, options.concurrencyLimit ?? 2);
  const quoteTimeoutMs = options.quoteTimeoutMs ?? 5 * 60 * 1000;
  const sharedMetrics = options.metrics ?? createExtractionMetricsEmitter();
  const processMultimodal = options.processQuoteMultimodal ?? processQuoteMultimodal;
  const processLegacy = options.processQuoteLegacy ?? processQuoteLegacy;

  console.log(`🤖 Batch processing ${pdfPaths.length} quotes with concurrency=${concurrencyLimit}`);

  // Extract native text once per file to decide V2 vs legacy path.
  const nativeTextResults: { fileRef: QuoteFileRef; result: PDFExtractionResult }[] = [];
  for (const pdfPath of pdfPaths) {
    const fileRef = buildFileRef(pdfPath);
    try {
      const result = await pdfExtractor.extractTextFromPdf(pdfPath);
      nativeTextResults.push({ fileRef, result });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`⚠️ Native text extraction failed for ${fileRef.originalname}: ${errMessage}`);
      nativeTextResults.push({
        fileRef,
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

  const results: ParsedQuote[] = [];

  for (let i = 0; i < nativeTextResults.length; i += concurrencyLimit) {
    const batch = nativeTextResults.slice(i, i + concurrencyLimit);
    const batchPromises = batch.map(async ({ fileRef, result }, batchIdx) => {
      const index = i + batchIdx;
      const quoteId = randomUUID();
      const quoteStartTime = Date.now();

      sharedMetrics.emit({
        quoteId,
        index,
        total: pdfPaths.length,
        filename: fileRef.originalname,
      });

      try {
        const nativeTextResult: NativeTextResult = {
          text: result.text,
          pageTextMap: result.pageTextMap || {},
          pageTextItems: result.pageTextItems,
          metadata: result.metadata,
          isScanned: result.isScanned ?? false,
        };

        const timeoutMessage = `Quote processing timeout (${fileRef.originalname})`;

        if (shouldUseV2(fileRef as Express.Multer.File, nativeTextResult)) {
          console.log(`   🤖 Quote ${index + 1}: using V2 multimodal path`);
          const parsed = await withTimeout(
            processMultimodal(fileRef as Express.Multer.File, index, pdfPaths.length, {
              domain,
              quoteId,
              metrics: sharedMetrics,
              nativeTextResult,
            }),
            quoteTimeoutMs,
            timeoutMessage
          );
          sharedMetrics.emit({
            quoteId,
            index,
            total: pdfPaths.length,
            result: 'success' as ExtractionResult,
            durationMs: Date.now() - quoteStartTime,
            path: 'v2',
          });
          return { index, parsed };
        }

        console.log(
          `   📑 Quote ${index + 1}: using legacy path (${nativeTextResult.isScanned ? 'scanned PDF' : 'V2 disabled'})`
        );
        const parsed = await withTimeout(
          processLegacy(
            {
              text: result.text,
              metadata: result.metadata,
              filename: fileRef.originalname,
              isScanned: result.isScanned ?? false,
            },
            index,
            pdfPaths.length,
            { domain, quoteId, metrics: sharedMetrics }
          ),
          quoteTimeoutMs,
          timeoutMessage
        );
        sharedMetrics.emit({
          quoteId,
          index,
          total: pdfPaths.length,
          result: 'success' as ExtractionResult,
          durationMs: Date.now() - quoteStartTime,
          path: 'legacy',
        });
        return { index, parsed };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Error processing quote ${index + 1}:`, errorMessage);

        sharedMetrics.emit({
          quoteId,
          index,
          total: pdfPaths.length,
          result: 'failed' as ExtractionResult,
          durationMs: Date.now() - quoteStartTime,
          path: 'legacy',
          errorCategory:
            error instanceof Error && error.message.includes('timeout')
              ? 'TIMEOUT'
              : 'EXTRACTION_FAILED',
          errorCode:
            error instanceof Error && error.message.includes('timeout')
              ? 'QUOTE_TIMEOUT'
              : 'EXTRACTION_ERROR',
        });

        return { index, parsed: buildErrorPlaceholder(fileRef, error) };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (const { index, parsed } of batchResults) {
      results[index] = parsed;
    }
  }

  return results;
}

export function isMultimodalEnabled(): boolean {
  return featureFlags.isEnabled('enableMultimodalExtraction');
}

/**
 * Decide whether a given PDF should use the V2 multimodal extraction path.
 * V2 is the default for every non-scanned PDF. Legacy is used when V2 is
 * explicitly disabled or the PDF appears to be image-only.
 */
export function shouldUseV2(
  _file: Express.Multer.File,
  nativeTextResult: NativeTextResult
): boolean {
  if (!isMultimodalEnabled()) return false;
  if (nativeTextResult.isScanned) return false;
  return true;
}

export { calculateDynamicTimeout, withTimeout };
