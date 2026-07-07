/**
 * ExtractionMetrics emitter
 *
 * Provides in-process collection of structured extraction telemetry and an
 * optional sink. The default sink writes JSON-lines events to stdout using the
 * existing structured logger so log aggregation systems can index them.
 */

import {
  ExtractionMetrics,
  ExtractionResult,
  GroundingStatus,
  InsurerDetectionSource,
  MatchLayer,
} from '../types/extractionMetrics';
import { createStructuredLogger, StructuredLogger } from '../utils/structuredLogger';

export interface ExtractionMetricsEmitter {
  emit(event: Partial<ExtractionMetrics> & { quoteId: string }): void;
  snapshot(): ExtractionMetrics[];
}

const defaultLogger: StructuredLogger = createStructuredLogger('extraction.metrics');

function defaultSink(event: ExtractionMetrics): void {
  defaultLogger.info(
    'extraction.metrics',
    'ExtractionMetrics event',
    event as unknown as Record<string, unknown>
  );
}

function createEmptyLayerHits(): Record<MatchLayer, number> {
  return {
    thesaurus: 0,
    fuzzy: 0,
    embedding: 0,
    llm: 0,
    graph: 0,
    ontology: 0,
    none: 0,
  };
}

function createEmptyGrounding(): ExtractionMetrics['grounding'] {
  return {
    checked: 0,
    verified: 0,
    failed: 0,
    failuresByReason: {
      verified: 0,
      snippet_missing: 0,
      page_out_of_range: 0,
      native_text_unavailable: 0,
      not_required: 0,
    },
  };
}

function createEmptyNormalizationConfidence(): ExtractionMetrics['normalizationConfidence'] {
  return {
    min: 0,
    max: 0,
    avg: 0,
    below75: 0,
  };
}

function mergeGrounding(
  base: ExtractionMetrics['grounding'],
  update: Partial<ExtractionMetrics['grounding']> | undefined
): ExtractionMetrics['grounding'] {
  if (!update) return base;

  const failuresByReason = { ...base.failuresByReason };
  if (update.failuresByReason) {
    for (const key of Object.keys(update.failuresByReason) as GroundingStatus[]) {
      failuresByReason[key] = (failuresByReason[key] || 0) + (update.failuresByReason[key] || 0);
    }
  }

  return {
    checked: base.checked + (update.checked || 0),
    verified: base.verified + (update.verified || 0),
    failed: base.failed + (update.failed || 0),
    failuresByReason,
  };
}

function mergeLayerHits(
  base: Record<MatchLayer, number>,
  update: Partial<Record<MatchLayer, number>> | undefined
): Record<MatchLayer, number> {
  if (!update) return base;

  const merged = { ...base };
  for (const key of Object.keys(update) as MatchLayer[]) {
    if (update[key] !== undefined) {
      merged[key] = (merged[key] || 0) + update[key];
    }
  }
  return merged;
}

function mergeNormalizationConfidence(
  base: ExtractionMetrics['normalizationConfidence'],
  update: Partial<ExtractionMetrics['normalizationConfidence']> | undefined
): ExtractionMetrics['normalizationConfidence'] {
  if (!update) return base;

  return {
    min:
      update.min !== undefined
        ? base.min === 0
          ? update.min
          : Math.min(base.min, update.min)
        : base.min,
    max: update.max !== undefined ? Math.max(base.max, update.max) : base.max,
    avg: update.avg !== undefined ? update.avg : base.avg,
    below75: base.below75 + (update.below75 || 0),
  };
}

function createDefaultMetrics(quoteId: string): ExtractionMetrics {
  return {
    quoteId,
    timestamp: new Date().toISOString(),
    index: 0,
    total: 1,
    insurerDetectionSource: 'unknown',
    formatFamily: 'UNKNOWN',
    path: 'v2',
    result: 'success',
    durationMs: 0,
    rawCoverageCount: 0,
    canonicalCoverageCount: 0,
    repairAttempts: 0,
    legacyFallback: false,
    matcherLayerHits: createEmptyLayerHits(),
    normalizationConfidence: createEmptyNormalizationConfidence(),
    deductibleParseFailures: 0,
    deductibleParseTotal: 0,
    grounding: createEmptyGrounding(),
  };
}

export function createExtractionMetricsEmitter(
  sink?: (event: ExtractionMetrics) => void
): ExtractionMetricsEmitter {
  const events = new Map<string, ExtractionMetrics>();
  const finalSink = sink ?? defaultSink;

  return {
    emit(event) {
      try {
        const existing = events.get(event.quoteId);
        const merged: ExtractionMetrics = existing
          ? {
              ...existing,
              ...event,
              matcherLayerHits: mergeLayerHits(existing.matcherLayerHits, event.matcherLayerHits),
              normalizationConfidence: mergeNormalizationConfidence(
                existing.normalizationConfidence,
                event.normalizationConfidence
              ),
              grounding: mergeGrounding(existing.grounding, event.grounding),
            }
          : { ...createDefaultMetrics(event.quoteId), ...event };

        events.set(event.quoteId, merged);
        finalSink(merged);
      } catch (err) {
        // Metrics must never fail the quote. Log to stderr as a last resort.
        console.error('ExtractionMetrics sink failed:', err);
      }
    },

    snapshot() {
      return Array.from(events.values());
    },
  };
}

export function createEmptyExtractionMetrics(quoteId: string): ExtractionMetrics {
  return createDefaultMetrics(quoteId);
}

export type { ExtractionResult, GroundingStatus, InsurerDetectionSource, MatchLayer };
