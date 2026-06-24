/**
 * Structured extraction telemetry event types.
 *
 * These types are intentionally decoupled from any transport so they can be
 * emitted to stdout, a metrics table, or an in-memory collector in tests.
 */

export type ExtractionResult =
  | 'success'
  | 'success_after_repair'
  | 'raw_extraction_fallback'
  | 'legacy_fallback'
  | 'failed';

export type MatchLayer =
  | 'thesaurus'
  | 'fuzzy'
  | 'embedding'
  | 'llm'
  | 'graph'
  | 'ontology'
  | 'none';

export type InsurerDetectionSource =
  | 'content'
  | 'alias'
  | 'filename'
  | 'unknown';

export type GroundingStatus =
  | 'verified'
  | 'snippet_missing'
  | 'page_out_of_range'
  | 'native_text_unavailable'
  | 'not_required';

export interface ExtractionMetrics {
  /** UUID v4 generated per quote at controller entry */
  quoteId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Quote index in the batch */
  index: number;
  /** Total quotes in the request */
  total: number;
  /** Final detected insurer canonical key */
  insurer?: string;
  /** Source used for insurer detection */
  insurerDetectionSource: InsurerDetectionSource;
  /** Detected format family (e.g. TABLE-DOUBLE, SECTIONS) */
  formatFamily: string;
  /** Extraction path taken */
  path: 'v2' | 'legacy' | 'raw';
  /** High-level result */
  result: ExtractionResult;
  /** Duration in milliseconds from quote start to extraction complete */
  durationMs: number;
  /** Gemini model used (when applicable) */
  model?: string;
  /** Number of raw coverages extracted */
  rawCoverageCount: number;
  /** Number of canonical coverages produced */
  canonicalCoverageCount: number;
  /** Count of repair attempts before success/failure */
  repairAttempts: number;
  /** Whether legacy path was used as fallback */
  legacyFallback: boolean;
  /** Per-layer matcher hit counts */
  matcherLayerHits: Record<MatchLayer, number>;
  /** Normalization confidence distribution */
  normalizationConfidence: {
    min: number;
    max: number;
    avg: number;
    below75: number;
  };
  /** Deductible parse outcomes */
  deductibleParseFailures: number;
  deductibleParseTotal: number;
  /** Grounding validation outcomes */
  grounding: {
    checked: number;
    verified: number;
    failed: number;
    failuresByReason: Record<GroundingStatus, number>;
  };
  /** Human-readable error category if result === 'failed' */
  errorCategory?: string;
  /** Machine error code if result === 'failed' */
  errorCode?: string;

  // Optional stage-only fields used for intermediate events
  filename?: string;
  pageCount?: number;
  isScanned?: boolean;
  repairType?: string;
}
