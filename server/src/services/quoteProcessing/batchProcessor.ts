/**
 * Batch Processor Module
 * Concurrency control, batching, timeouts, and error handling for multi-quote extraction.
 */

import { randomUUID } from 'crypto';
import { pdfExtractor, PDFExtractionResult } from '../pdfExtractor';
import { ParsedQuote } from '../quoteParser';
import { createExtractionMetricsEmitter, ExtractionResult } from '../extractionMetrics';
import { ProcessQuotesBatchOptions, NativeTextResult, QuoteFileRef } from './types';
import { buildFileRef, buildErrorPlaceholder, shouldUseV2, withTimeout } from './utils';
import { processQuoteMultimodal } from './multimodalPipeline';
import { processQuoteLegacy } from './legacyPipeline';

/**
 * Process a batch of quote PDFs using the V2 multimodal pipeline by default
 * (including scanned/image-only PDFs), falling back to legacy text extraction
 * only when V2 is disabled.
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
          console.log(
            `   🤖 Quote ${index + 1}: using V2 multimodal path${nativeTextResult.isScanned ? ' (scanned PDF)' : ''}`
          );
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
