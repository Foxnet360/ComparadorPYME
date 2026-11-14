/**
 * Utility functions for quote processing: timeouts, validation retries, placeholders, and feature checks.
 */

import path from 'path';
import { z } from 'zod';
import { quoteScorer, ScoringResult } from '../quoteScorer';
import { ParsedQuote } from '../quoteParser';
import { formatZodError } from '../../schemas/extractionSchemas';
import { featureFlags } from '../../config/featureFlags';
import { NativeTextResult, QuoteFileRef, ZodValidator } from './types';

/**
 * Calculates a dynamic timeout based on the number of coverages to extract.
 */
export function calculateDynamicTimeout(coverageCount: number): number {
  const baseTimeout = 30 + coverageCount * 3;
  return Math.min(300, Math.max(120, baseTimeout)) * 1000; // Convert to ms
}

/**
 * Timeout wrapper for quote processing promises.
 */
export async function withTimeout<T>(
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
 * Retry wrapper for Gemini calls whose outputs must pass Zod validation.
 * Validation failures are retried up to maxRetries times before falling back
 * to the raw (unvalidated) output so the pipeline degrades gracefully.
 */
export async function extractWithZodValidation<T>(
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
 * Create a default scoring result for error cases.
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
 * Determines whether multimodal extraction is enabled via feature flags.
 */
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

/**
 * Build file reference with path and originalname.
 */
export function buildFileRef(pdfPath: string): QuoteFileRef {
  return {
    path: pdfPath,
    originalname: path.basename(pdfPath),
  };
}

/**
 * Build error placeholder quote for batch processing.
 */
export function buildErrorPlaceholder(fileRef: QuoteFileRef, error: unknown): ParsedQuote {
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
