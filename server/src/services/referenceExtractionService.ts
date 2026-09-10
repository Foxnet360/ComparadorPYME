/**
 * Reference Extraction Service (renewal mode, spec R2.1)
 *
 * The incumbent policy PDF goes through the EXISTING multimodal extraction
 * pipeline unchanged and becomes the `referenceQuote` — the baseline the
 * candidates are compared against. The reference is NEVER ranked as a
 * candidate.
 *
 * When extraction or validation fails, the broker gets a manual-edit
 * fallback payload (partial draft + validation flags) so the baseline can be
 * keyed in by hand instead of blocking the renewal analysis.
 *
 * Heavy pipeline modules (quoteProcessingService / quoteValidator) pull
 * env-validated config at import time, so they are loaded lazily — unit
 * tests inject the dependencies and never touch env.
 */

import type { ParsedQuote } from './quoteParser';
import type { ValidationResult, ValidationFlag } from './quoteValidator';
import type { InsuranceDomain } from '../types/domain';

export interface ReferenceExtractionOk {
  status: 'ok';
  referenceQuote: ParsedQuote;
  validation: ValidationResult;
}

export interface ReferenceManualEditFallback {
  status: 'manual_edit_required';
  referenceQuote: null;
  fallback: {
    reason: 'extraction_failed' | 'validation_failed';
    /** Partial extraction the broker can edit instead of retyping from scratch. */
    draft: ParsedQuote | null;
    validationFlags: ValidationFlag[];
  };
}

export type ReferenceExtractionResult = ReferenceExtractionOk | ReferenceManualEditFallback;

export interface ReferenceExtractionOptions {
  domain?: InsuranceDomain;
  /** Injectable pipeline (defaults to the existing multimodal batch service). */
  processBatch?: (
    pdfPaths: string[],
    options: { domain?: InsuranceDomain; concurrencyLimit: number }
  ) => Promise<ParsedQuote[]>;
  /** Injectable validator (defaults to the existing quote validator). */
  validate?: (quote: ParsedQuote) => ValidationResult;
}

export async function extractReferenceQuote(
  pdfPath: string,
  options: ReferenceExtractionOptions = {}
): Promise<ReferenceExtractionResult> {
  const domain = options.domain ?? 'pyme';
  const processBatch =
    options.processBatch ??
    (await import('./quoteProcessingService')).processQuotesBatch;
  const validate = options.validate ?? (await import('./quoteValidator')).validateQuote;

  // Existing multimodal pipeline, unchanged: the incumbent PDF is processed
  // on its own so it can never be mixed into (or ranked with) candidates.
  const quotes = await processBatch([pdfPath], { domain, concurrencyLimit: 1 });
  const quote = quotes[0] ?? null;

  if (!quote || quote.isFailed) {
    return {
      status: 'manual_edit_required',
      referenceQuote: null,
      fallback: {
        reason: 'extraction_failed',
        draft: quote,
        validationFlags: [],
      },
    };
  }

  const validation = validate(quote);
  if (!validation.isValid) {
    return {
      status: 'manual_edit_required',
      referenceQuote: null,
      fallback: {
        reason: 'validation_failed',
        draft: quote,
        validationFlags: validation.flags,
      },
    };
  }

  return { status: 'ok', referenceQuote: quote, validation };
}
