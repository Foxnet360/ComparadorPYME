/**
 * Quote Processing Service (Facade & Orchestrator)
 *
 * Orchestrates quote extraction using multimodal (V2) and legacy (V1) pipelines.
 * Extracted from analysisController.ts to separate processing logic from HTTP handling.
 *
 * Modular architecture overview:
 * - `quoteProcessing/types.ts`: Core data structures and interface contracts.
 * - `quoteProcessing/promptSelection.ts`: Domain and layout-aware extraction prompt selection.
 * - `quoteProcessing/graphEnrichment.ts`: Coverage graph knowledge base enrichment.
 * - `quoteProcessing/legacyPipeline.ts`: Text-based V1 extraction with insurer profiles and fallback JSON parsing.
 * - `quoteProcessing/multimodalPipeline.ts`: PDF vision V2 extraction, layout parsing, and clause reconciliation.
 * - `quoteProcessing/batchProcessor.ts`: Concurrent multi-quote batch processing, timeout handling, and error mapping.
 * - `quoteProcessing/utils.ts`: Dynamic timeouts, validation retries, error placeholders, and feature flags.
 */

import { ParsedQuote } from './quoteParser';
import { ScoringResult } from './quoteScorer';
import { FormatDetectionResult } from './formatDetector';
import { TemplateRegistryEntry } from '../schemas/templateRegistrySchema';
import { LayoutParserResult } from './layoutParser';
import { RawCoverage } from './coverageNormalizer';

// Types and contracts
import {
  NativeTextResult,
  ExtractionPromptSelection,
  ExtractionPromptContext,
  GraphEnrichedCoverage,
  LegacyQuoteInput,
  ProcessQuoteOptions,
  ProcessQuotesBatchOptions,
  QuoteFileRef,
  ZodValidator,
} from './quoteProcessing/types';

// Implementations from sub-modules
import { selectExtractionPrompt as selectExtractionPromptSub } from './quoteProcessing/promptSelection';
import { enrichRawCoveragesWithGraph as enrichRawCoveragesWithGraphSub } from './quoteProcessing/graphEnrichment';
import {
  processQuoteMultimodal as processQuoteMultimodalSub,
  isClientNameLeak as isClientNameLeakSub,
} from './quoteProcessing/multimodalPipeline';
import {
  processQuoteLegacy as processQuoteLegacySub,
  STRUCTURED_EXTRACTION_PROMPT as STRUCTURED_EXTRACTION_PROMPT_SUB,
} from './quoteProcessing/legacyPipeline';
import { processQuotesBatch as processQuotesBatchSub } from './quoteProcessing/batchProcessor';
import {
  calculateDynamicTimeout as calculateDynamicTimeoutSub,
  withTimeout as withTimeoutSub,
  extractWithZodValidation as extractWithZodValidationSub,
  createFailedPlaceholder as createFailedPlaceholderSub,
  createDefaultScoringResult as createDefaultScoringResultSub,
  isMultimodalEnabled as isMultimodalEnabledSub,
  shouldUseV2 as shouldUseV2Sub,
  buildFileRef as buildFileRefSub,
  buildErrorPlaceholder as buildErrorPlaceholderSub,
} from './quoteProcessing/utils';

// ============================================================================
// Type Re-Exports
// ============================================================================

export type {
  NativeTextResult,
  ExtractionPromptSelection,
  ExtractionPromptContext,
  GraphEnrichedCoverage,
  ProcessQuoteOptions,
  ProcessQuotesBatchOptions,
  LegacyQuoteInput,
  QuoteFileRef,
  ZodValidator,
};

// ============================================================================
// Prompt Selection
// ============================================================================

/**
 * Select the appropriate extraction prompt based on format detection and template matching.
 * Delegated to `quoteProcessing/promptSelection`.
 *
 * @param detection Format detection result with family and optional template ID.
 * @param template Matched template registry entry if available.
 * @param layoutResult Layout parsing result containing extracted tables and regions.
 * @param context Context including page count, logger, metrics, and insurance domain.
 */
export function selectExtractionPrompt(
  detection: FormatDetectionResult,
  template: TemplateRegistryEntry | undefined,
  layoutResult: LayoutParserResult,
  context: ExtractionPromptContext
): ExtractionPromptSelection {
  return selectExtractionPromptSub(detection, template, layoutResult, context);
}

// ============================================================================
// Knowledge Graph Coverage Enrichment
// ============================================================================

/**
 * Enriches extracted raw coverages with coverage graph query results.
 * Delegated to `quoteProcessing/graphEnrichment`.
 *
 * @param rawCoverages Extracted raw coverages to enrich.
 * @param insurer Optional detected or extracted insurer name.
 * @param domain Active insurance domain (defaults to 'pyme').
 */
export async function enrichRawCoveragesWithGraph(
  rawCoverages: RawCoverage[],
  insurer?: string,
  domain: string = 'pyme'
): Promise<GraphEnrichedCoverage[]> {
  return enrichRawCoveragesWithGraphSub(rawCoverages, insurer, domain);
}

// ============================================================================
// Pipeline Runners (V2 Multimodal & V1 Legacy)
// ============================================================================

/**
 * Process a single quote using multimodal extraction (V2).
 * Delegated to `quoteProcessing/multimodalPipeline`.
 *
 * @param quoteFile Uploaded quote file reference from multer.
 * @param index Zero-based index of this quote in the current batch.
 * @param total Total number of quotes in the batch.
 * @param options Processing options including domain, metrics emitter, and native text.
 */
export async function processQuoteMultimodal(
  quoteFile: Express.Multer.File,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  return processQuoteMultimodalSub(quoteFile, index, total, options);
}

/**
 * Process a single quote using legacy text-based extraction (V1).
 * Delegated to `quoteProcessing/legacyPipeline`.
 *
 * @param quote Raw quote input containing extracted text and metadata.
 * @param index Zero-based index of this quote in the current batch.
 * @param total Total number of quotes in the batch.
 * @param options Processing options including domain and metrics emitter.
 */
export async function processQuoteLegacy(
  quote: LegacyQuoteInput,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  return processQuoteLegacySub(quote, index, total, options);
}

// ============================================================================
// Batch Orchestrator
// ============================================================================

/**
 * Process a batch of quote PDFs using the V2 multimodal pipeline by default,
 * falling back to legacy text extraction for scanned PDFs or when V2 is disabled.
 * Delegated to `quoteProcessing/batchProcessor`.
 *
 * @param pdfPaths File paths of PDF quotes to process.
 * @param options Batch options including concurrency limit, timeout, and metrics.
 */
export async function processQuotesBatch(
  pdfPaths: string[],
  options: ProcessQuotesBatchOptions = {}
): Promise<ParsedQuote[]> {
  return processQuotesBatchSub(pdfPaths, options);
}

// ============================================================================
// Utility and Fallback Functions
// ============================================================================

/**
 * Create a failed placeholder quote when all extraction paths fail.
 * Keeps the /api/analyze response shape stable.
 * Delegated to `quoteProcessing/utils`.
 */
export function createFailedPlaceholder(
  quoteFile: Express.Multer.File,
  error: unknown
): ParsedQuote {
  return createFailedPlaceholderSub(quoteFile, error);
}

/**
 * Create a default scoring result for error cases.
 * Delegated to `quoteProcessing/utils`.
 */
export function createDefaultScoringResult(quote: ParsedQuote): ScoringResult {
  return createDefaultScoringResultSub(quote);
}

/**
 * Determines whether multimodal extraction is enabled via feature flags.
 * Delegated to `quoteProcessing/utils`.
 */
export function isMultimodalEnabled(): boolean {
  return isMultimodalEnabledSub();
}

/**
 * Decide whether a given PDF should use the V2 multimodal extraction path.
 * V2 is the default for every non-scanned PDF. Legacy is used when V2 is
 * explicitly disabled or the PDF appears to be image-only.
 * Delegated to `quoteProcessing/utils`.
 */
export function shouldUseV2(
  _file: Express.Multer.File,
  nativeTextResult: NativeTextResult
): boolean {
  return shouldUseV2Sub(_file, nativeTextResult);
}

/**
 * Calculates a dynamic timeout based on the number of coverages to extract.
 * Delegated to `quoteProcessing/utils`.
 */
export function calculateDynamicTimeout(coverageCount: number): number {
  return calculateDynamicTimeoutSub(coverageCount);
}

/**
 * Timeout wrapper for quote processing promises.
 * Delegated to `quoteProcessing/utils`.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return withTimeoutSub(promise, timeoutMs, errorMessage);
}

// Export additional helper utilities from sub-modules
export {
  STRUCTURED_EXTRACTION_PROMPT_SUB as STRUCTURED_EXTRACTION_PROMPT,
  isClientNameLeakSub as isClientNameLeak,
  extractWithZodValidationSub as extractWithZodValidation,
  buildFileRefSub as buildFileRef,
  buildErrorPlaceholderSub as buildErrorPlaceholder,
};
