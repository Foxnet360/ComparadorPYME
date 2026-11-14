/**
 * Multimodal Pipeline Module (V2)
 * PDF vision-based quote extraction, layout-aware prompting, coverage normalization,
 * premium breakdown, and clause reconciliation.
 */

import { randomUUID } from 'crypto';
import { geminiService } from '../gemini';
import { twoStageExtractionOrchestrator } from '../twoStageExtraction/twoStageExtractionOrchestrator';
import { pdfExtractor, PDFExtractionResult } from '../pdfExtractor';
import { ParsedQuote } from '../quoteParser';
import { insurerProfileService } from '../insurerProfileService';
import {
  detectFormatFamily,
  detectFormatWithRegistry,
  extractForDetection,
  FormatDetectionResult,
} from '../formatDetector';
import { buildPromptForFamily } from '../promptBuilder';
import { buildCanonicalCoverages } from '../coverageNormalizer';
import {
  extractPremiumBreakdown,
  extractPerCoveragePremiums,
  validatePremiumBreakdown,
  normalizeCurrency,
} from '../premiumExtractor';
import { getDeductibleFallback } from '../deductibleResolver';
import { validateQuoteExtractionV2, QuoteExtractionV2 } from '../../schemas/extractionSchemas';
import { reconciliationService } from '../reconciliationService';
import { featureFlags } from '../../config/featureFlags';
import { templateRegistryService } from '../templateRegistryService';
import { TemplateRegistryEntry } from '../../schemas/templateRegistrySchema';
import { extractTables, LayoutParserResult } from '../layoutParser';
import { createExtractionMetricsEmitter } from '../extractionMetrics';
import { ProcessQuoteOptions } from './types';
import { withTimeout, extractWithZodValidation, createFailedPlaceholder } from './utils';
import { selectExtractionPrompt } from './promptSelection';
import { enrichRawCoveragesWithGraph } from './graphEnrichment';
import { processQuoteLegacy } from './legacyPipeline';

/**
 * Generic token overlap helper to detect client name leaks in coverage items.
 */
export const isClientNameLeak = (covName: string, cliName: string): boolean => {
  if (!covName || !cliName || cliName.length < 5) return false;
  const covNorm = covName.toLowerCase().trim();
  const cliNorm = cliName.toLowerCase().trim();

  if (covNorm === cliNorm) return true;

  const stopWords = new Set([
    'de',
    'del',
    'las',
    'los',
    'san',
    'santa',
    'edificio',
    'conjunto',
    'y',
    'la',
    'el',
  ]);
  const clientTokens = cliNorm.split(/\s+/).filter((t) => t.length >= 3 && !stopWords.has(t));
  const covTokens = new Set(covNorm.split(/\s+/).filter((t) => t.length >= 3));

  if (clientTokens.length < 2) return false;

  const matchCount = clientTokens.filter((t) => covTokens.has(t)).length;
  return matchCount / clientTokens.length >= 0.7;
};

/**
 * Process a single quote using multimodal extraction.
 * Timeout: 5 minutes per quote.
 */
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

export async function processQuoteMultimodalInternal(
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
      {
        pageCount: extractionResult.metadata?.pageCount ?? 1,
        formatFamily: family,
        domain,
      }
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
          featureFlags.isEnabled('enableTwoStageExtraction')
            ? twoStageExtractionOrchestrator.extractTwoStage(
                quoteFile.path,
                extractionPrompt,
                quoteFile.originalname,
                nativeText,
                {
                  skipValidation: true,
                  domain,
                  onRepairUsed: (category) => {
                    repairUsed = true;
                    repairType = category;
                    repairAttempts++;
                  },
                }
              )
            : geminiService.extractFromPdfWithVision(
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
          domain,
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

    // Filter rawCoverages: remove items matching the client's name or pure numbers/page numbers
    const clientNameNorm = ((extracted as any).clientInfo?.name || (extracted as any).cliente || '')
      .toLowerCase()
      .trim();
    if (extracted.rawCoverages && Array.isArray(extracted.rawCoverages)) {
      extracted.rawCoverages = extracted.rawCoverages.filter((cov: any) => {
        const nameNorm = (cov.rawName || cov.name || '').toLowerCase().trim();
        if (!nameNorm) return false;
        // Generic token overlap check (eliminates client name leaks without hardcoded strings)
        if (clientNameNorm && isClientNameLeak(nameNorm, clientNameNorm)) {
          console.log(
            `   🛡️ [Sanitizer] Filtered out client name from coverages: "${cov.rawName || cov.name}"`
          );
          return false;
        }
        // Filter out if coverage name is just a page number like "Pag. 202" or number "101"
        if (/^(pag|pág|página|\d+)\s*\d*$/i.test(nameNorm)) {
          console.log(
            `   🛡️ [Sanitizer] Filtered out page number label: "${cov.rawName || cov.name}"`
          );
          return false;
        }
        return true;
      });
    }

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
    let reconciliationResults: import('../../schemas/extractionSchemas').ReconciliationResult[] =
      [];
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
