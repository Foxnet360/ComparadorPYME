/**
 * Types and interfaces for the quote processing pipeline.
 */

import { z } from 'zod';
import { PageTextItems } from '../templateRegistryService';
import { StructuredLogger, MetricCollector } from '../../utils/structuredLogger';
import { ExtractionMetricsEmitter } from '../extractionMetrics';
import { ParsedQuote } from '../quoteParser';

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
  /** Active insurance domain for domain-aware prompt selection. */
  domain?: string;
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

export interface LegacyQuoteInput {
  text: string;
  filename?: string;
  isScanned?: boolean;
  metadata?: { pageCount?: number };
}

export interface ProcessQuoteOptions {
  domain?: string;
  quoteId: string;
  metrics: ExtractionMetricsEmitter;
  nativeTextResult?: NativeTextResult;
}

export interface ProcessQuotesBatchOptions {
  domain?: string;
  concurrencyLimit?: number;
  quoteTimeoutMs?: number;
  metrics?: ExtractionMetricsEmitter;
  /** Optional processor overrides for testability. */
  processQuoteMultimodal?: (
    quoteFile: Express.Multer.File,
    index: number,
    total: number,
    options?: ProcessQuoteOptions
  ) => Promise<ParsedQuote>;
  processQuoteLegacy?: (
    quote: LegacyQuoteInput,
    index: number,
    total: number,
    options?: ProcessQuoteOptions
  ) => Promise<ParsedQuote>;
}

export interface QuoteFileRef {
  path: string;
  originalname: string;
}

export interface ZodValidator<T> {
  (data: unknown): { success: true; data: T } | { success: false; error: z.ZodError };
}
