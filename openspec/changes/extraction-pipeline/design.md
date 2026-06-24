# SDD Design: Extraction Pipeline Improvements

## Document Control

| Field | Value |
|-------|-------|
| **Project** | comparadorpyme |
| **Change** | extraction-pipeline |
| **Phase** | sdd-design |
| **Artifact store** | openspec + engram (hybrid) |
| **Based on** | `openspec/changes/extraction-pipeline/proposal.md` |
| **Mode** | Automatic — assumptions are stated explicitly in Section 12. |

---

## 1. Design Overview

This design consolidates the dual extraction pipeline around the **V2 multimodal path**, replaces scattered normalization/deductible code with canonical modules, adds deterministic grounding, and exposes structured telemetry for every quote. The existing orchestration boundary (`analysisController.ts` and `quoteProcessingService.ts`) is preserved; only the internal extraction/normalization/validation services change.

### Key architectural decisions

1. **V2 becomes the default for every non-scanned PDF.** The legacy V1 path remains as an explicit degraded fallback for scanned PDFs or V2 failures. The `ENABLE_MULTIMODAL_EXTRACTION` runtime opt-out is retired.
2. **A single `CoverageMatcher` service owns normalization.** `semanticMatcher.ts`, `thesaurusMapper.ts`, and `coverageNormalizer.ts` are folded into one matcher with a configurable layer pipeline and a single confidence threshold source.
3. **`hybridDeductibleParser.ts` is promoted to the canonical deductible parser.** All other deductible regex paths (`deductibleAnalyzer.ts`, `quoteValidator.ts`, `thesaurusMapper.ts`) become thin consumers of its `DeductibleStructure` output.
4. **Grounding is a first-class contract.** V2 coverages and deductibles must include `rawTextSnippet` and `pageNumber`. A new `validateGrounding()` step verifies the snippet against the native page text and penalizes confidence when validation fails.
5. **Domain constants and the canonical coverage list are centralized.** `SMMLV`, `UVT`, and the 14 PYME categories move to `data/domains/pyme/taxonomy.json` and `server/src/config/domainConstants.ts`.
6. **Insurer detection reads PDF content first.** A new `data/domains/insurerAliases.json` map plus a ranked resolver reduce dependence on the filename regex.
7. **Telemetry is emitted as structured `ExtractionMetrics` events.** Every quote reports success/repair/fallback, normalization layer hits, grounding status, insurer source, and deductible parse outcome.
8. **Backwards compatibility is mandatory.** Existing consumers (`ComparisonReport`, `AuditDashboard`, RAG, clause reconciliation, learning engine) continue to receive the same `ParsedQuote` shape; new fields are optional.

---

## 2. Component Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend upload                                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ POST /api/analyze
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  server/src/controllers/analysisController.ts (orchestrator, unchanged shape) │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│ pdfExtractor  │      │ insurerProfileService│      │ formatDetector      │
│ native text   │      │ ranked resolver      │      │ format family       │
│ + page map    │      │ + alias map          │      │ + template match    │
└───────┬───────┘      └──────────┬───────────┘      └──────────┬──────────┘
        │                         │                             │
        └─────────────────────────┼─────────────────────────────┘
                                  ▼
              ┌─────────────────────────────────────┐
              │   quoteProcessingService.ts          │
              │   extraction path selection          │
              │   V2 default / legacy fallback       │
              └──────────────────┬──────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
    ┌─────────────────────┐            ┌─────────────────────┐
    │ gemini.ts + prompts │            │ legacy V1 pipeline  │
    │ QuoteExtractionV2   │            │ (kept as fallback)  │
    └──────────┬──────────┘            └──────────┬──────────┘
               │                                  │
               └──────────────────┬───────────────┘
                                  ▼
              ┌─────────────────────────────────────┐
              │  hybridDeductibleParser.ts          │
              │  canonical DeductibleStructure      │
              └──────────────┬──────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────────────┐
              │  coverageMatcher/ (unified)         │
              │  thesaurus → fuzzy → embedding      │
              │  → LLM → ontology/graph             │
              └──────────────┬──────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────────────┐
              │  valueValidationService.ts          │
              │  validateGrounding()                │
              └──────────────┬──────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────────────┐
              │  quoteValidator.ts                  │
              │  confidenceScorer.ts                │
              └──────────────┬──────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ RAG / clause │  │ learning engine │  │ ComparisonReport │
│ reconciliation│  │ (corrections)   │  │ / AuditDashboard │
└──────────────┘  └─────────────────┘  └──────────────────┘
```

### New/modified components

| Component | Type | Path |
|-----------|------|------|
| `CoverageMatcher` | new module | `server/src/services/coverageMatcher/` |
| `hybridDeductibleParser` | heavily modified | `server/src/services/hybridDeductibleParser.ts` |
| `insurerProfileService` | heavily modified | `server/src/services/insurerProfileService.ts` |
| `valueValidationService` | extended | `server/src/services/valueValidationService.ts` |
| `ExtractionMetrics` | new event type + emitter | `server/src/services/extractionMetrics.ts` |
| `domainConstants` | new config | `server/src/config/domainConstants.ts` |
| `taxonomy.json` | canonical source | `data/domains/pyme/taxonomy.json` |
| `insurerAliases.json` | new data file | `data/domains/insurerAliases.json` |
| `QuoteExtractionSchemaV2` | updated | `server/src/schemas/extractionSchemas.ts` |
| `evaluateFormatFamily` | new script | `server/scripts/evaluateFormatFamily.ts` |

---

## 3. Data Flow

### End-to-end flow for a single uploaded PDF

1. **Upload & ingest.** `analysisController.ts` receives the file, validates size/pages, and calls `pdfExtractor.extractTextFromPdf()` to obtain native text, `pageTextMap`, `pageTextItems`, metadata, and the `isScanned` flag.
2. **Insurer detection.** `insurerProfileService.resolveInsurer({ nativeText, metadata, filename })` returns a canonical insurer key, display name, confidence, and source (`content`, `alias`, `filename`, `generic`).
3. **Format family detection.** `formatDetector.detectFormatFamily(nativeText)` returns a `FormatFamily` (e.g., `TABLE-DOUBLE`, `SECTIONS`) and a `formatFamily` string that is later added to the extraction output.
4. **Extraction path selection.** `quoteProcessingService` selects V2 unless `isScanned=true` or V2 fails after retries. Legacy V1 is invoked only as a fallback.
5. **V2 structured extraction.** `geminiService.extractFromPdfWithVision()` uploads the PDF, calls Gemini with the hardened prompt and `QuoteExtractionSchemaV2`, and returns raw JSON. `jsonRepair.ts` repairs malformed JSON and emits a metric when repair is used.
6. **Deductible parsing.** Every deductible string is passed to `hybridDeductibleParser.parse(text, options)` to produce a `DeductibleStructure` with normalized COP amounts.
7. **Coverage normalization.** Raw coverages are passed to `coverageMatcher.normalizeBatch(rawNames, { domain, insurer })`. The matcher runs the layer pipeline and emits per-layer hit metrics.
8. **Grounding validation.** `valueValidationService.validateGrounding()` checks that each coverage/deductible `rawTextSnippet` exists in `pageTextMap[pageNumber]` (fuzzy token match). Failures downgrade confidence and emit a `grounding_failed` metric.
9. **Business validation & confidence scoring.** `quoteValidator.validateQuote()` and `confidenceScorer.calculateConfidence()` consume the validated, grounded quote.
10. **Downstream consumers.** The final `ParsedQuote` is passed to RAG/clause reconciliation, the learning engine, scoring, persistence, and the frontend unchanged except for optional new fields.

---

## 4. Module Design

### 4.1 `CoverageMatcher` (`server/src/services/coverageMatcher/`)

#### Responsibilities

- Own the single source of truth for coverage normalization.
- Run raw coverage names through a deterministic layer order.
- Cache category embeddings and persistent embedding mappings.
- Emit per-layer hit metrics.
- Preserve the learning-engine contract by saving unresolved/new mappings via `coverageOntology.saveMapping()` when appropriate.

#### Public interface

```typescript
// server/src/services/coverageMatcher/types.ts
export interface CoverageMatcherOptions {
  domain?: string;
  insurer?: string;
  thresholds?: Partial<CoverageMatcherThresholds>;
}

export interface CoverageMatcherThresholds {
  thesaurusExact: number;      // 1.0
  fuzzyMin: number;            // 0.6
  embeddingMin: number;        // 0.7
  llmMin: number;              // 0.6
  graphMin: number;            // 0.5
  overallMin: number;          // 0.6
}

export interface CoverageMatchResult {
  categoryId: number | null;
  canonicalName: string | null;
  confidence: number;          // 0..1
  method: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | 'graph' | 'ontology' | null;
}

// server/src/services/coverageMatcher/index.ts
export interface CoverageMatcher {
  normalizeBatch(
    rawNames: string[],
    options?: CoverageMatcherOptions
  ): Promise<CoverageMatchResult[]>;

  matchSingle(
    rawName: string,
    options?: CoverageMatcherOptions
  ): Promise<CoverageMatchResult>;

  getAllCategories(domain?: string): Array<{ id: number; name: string }>;
  clearCache(domain?: string): void;
}

export const coverageMatcher: CoverageMatcher;
```

#### Internal structure

```text
server/src/services/coverageMatcher/
├── index.ts              # public CoverageMatcher implementation
├── types.ts              # interfaces and thresholds
├── thresholds.ts         # default thresholds + env override
└── layers/
    ├── thesaurusLayer.ts # exact/partial match against taxonomy.json + thesaurus
    ├── fuzzyLayer.ts     # Levenshtein against canonical names and synonyms
    ├── embeddingLayer.ts # batch embedding similarity
    ├── llmLayer.ts       # single-shot LLM classification
    └── graphLayer.ts     # coverageGraphService fallback
```

#### Interaction with other modules

- Reads `data/domains/pyme/taxonomy.json` via `domainBundleLoader.loadDomainJson()`.
- Reads thesaurus markdown via `thesaurusService` for extended synonyms.
- Generates embeddings via `embeddingService` and caches them via `embeddingCacheService`.
- Falls back to `coverageGraphService.query()` when the graph pipeline flag is enabled.
- Writes probabilistic mappings to `coverageOntology.saveMapping()` when ontology mode is active.
- Is called by both V2 (`quoteProcessingService.buildCanonicalCoverages` replacement) and the legacy path.

---

### 4.2 `hybridDeductibleParser` (`server/src/services/hybridDeductibleParser.ts`)

#### Responsibilities

- Parse any deductible string into a stable `DeductibleStructure`.
- Resolve SMMLV/UVT references to COP using centralized rates.
- Support compound deductibles (`mayor entre 10% y 5 SMMLV`), percentage-of-sum-insured, zero/NA, and unknown.
- Provide a benchmark assessment when a coverage name is known.
- Cache parsed structures in Redis/memory.

#### Public interface (evolved)

```typescript
export interface DeductibleParseOptions {
  coverageName?: string;
  insurer?: string;
  domain?: string;
  templateHints?: TemplateExtractionHints;
  useGraph?: boolean;
}

export interface HybridDeductibleResult extends DeductibleStructure {
  rawText: string;
  normalized: {
    minAmount: number;          // COP
    maxAmount: number;          // COP
    percentage: number;
    isPercentageBased: boolean;
  };
  benchmark?: DeductibleBenchmarkAssessment;
  appliesTo?: { coverageName: string; confidence: number };
}

export const hybridDeductibleParser: {
  parse(
    deductibleText: string,
    coverageNameOrOptions?: string | DeductibleParseOptions,
    maybeOptions?: DeductibleParseOptions
  ): Promise<HybridDeductibleResult>;
  getStats(): TelemetryCounters;
  resetStats(): void;
};
```

#### Internal structure

- `parseSimple(text)` — deterministic regex path (percentage, SMMLV, UVT, fixed, compound, zero/NA).
- `computeNormalized(structure)` — converts every component to COP and derives `minAmount`/`maxAmount`/`percentage`.
- `evaluateBenchmark(coverageName, normalized)` — consults `deductibleBenchmarks`.
- `parseWithLLM(text)` — structured Gemini fallback returning `DeductibleStructure`.
- Redis cache via `getCachedDeductibleV2` / `setCachedDeductibleV2`.

#### Interaction with other modules

- Called by `quoteProcessingService` immediately after V2 extraction.
- Replaces inline regex in `deductibleAnalyzer.ts`, `quoteValidator.ts`, and `thesaurusMapper.ts`.
- `crossReferenceEngine.ts` and `reconciliationService.ts` compare `DeductibleStructure` objects instead of raw strings.
- Uses `domainConstants.SMMLV_VALUE` / `UVT_VALUE` instead of local defaults.

---

### 4.3 `ExtractionMetrics` (`server/src/services/extractionMetrics.ts`)

#### Responsibilities

- Define a single structured event type for the whole extraction pipeline.
- Emit events at key stages so logs/metrics can be aggregated by quote, format family, insurer, and domain.
- Provide helper functions so callers do not construct events by hand.

#### Public interface

```typescript
// server/src/services/extractionMetrics.ts
export type ExtractionOutcome =
  | 'success'
  | 'repaired'
  | 'raw_fallback'
  | 'legacy_fallback'
  | 'failed';

export type InsurerDetectionSource = 'content' | 'alias' | 'filename' | 'generic';

export interface ExtractionMetrics {
  // Identity
  quoteId: string;
  requestId: string;
  timestamp: string;
  domain: string;
  insurerCanonical: string;
  insurerDetectedSource: InsurerDetectionSource;

  // Format / path
  formatFamily: string;
  isScanned: boolean;
  extractionPath: 'v2' | 'v1' | 'raw' | 'failed';
  outcome: ExtractionOutcome;

  // Timing
  durationMs: {
    nativeText: number;
    extraction: number;
    normalization: number;
    grounding: number;
    validation: number;
  };

  // Normalization
  coverageCount: number;
  normalizationLayerHits: {
    thesaurus: number;
    fuzzy: number;
    embedding: number;
    llm: number;
    graph: number;
  };
  normalizationConfidence: {
    below75: number;
    between75And90: number;
    above90: number;
  };

  // Deductibles
  deductibleParseCount: number;
  deductibleParseFailures: number;

  // Grounding
  groundingCheckCount: number;
  groundingFailures: number;

  // Confidence / validation
  finalConfidence: number;
  validationFlags: number;
  criticalFlags: number;
}

export function emitExtractionMetrics(
  metrics: Partial<ExtractionMetrics>,
  logger?: StructuredLogger
): void;

export function createExtractionMetricsCollector(
  requestId: string,
  quoteId: string
): {
  record(event: keyof ExtractionMetrics['durationMs'], ms: number): void;
  recordLayerHit(method: keyof ExtractionMetrics['normalizationLayerHits']): void;
  recordConfidenceBucket(confidence: number): void;
  recordGroundingFailure(): void;
  recordDeductibleParseFailure(): void;
  finalize(outcome: ExtractionOutcome): ExtractionMetrics;
};
```

#### Interaction with other modules

- Used by `quoteProcessingService`, `coverageMatcher`, `hybridDeductibleParser`, `insurerProfileService`, and `valueValidationService`.
- Writes to the existing `structuredLogger` sink and the existing `globalMetrics` collector.
- Optional future sink to a Supabase `extraction_metrics` table; not required for this phase.

---

### 4.4 `valueValidationService` / Grounding (`server/src/services/valueValidationService.ts`)

#### Responsibilities

- Validate that an extracted coverage value or deductible `rawTextSnippet` actually appears in the source PDF.
- Resolve a missing or wrong `pageNumber` by searching the page map.
- Classify values as `extracted`, `calculated`, or `inferred`.
- Penalize confidence when grounding fails without dropping the value.

#### Public interface (extended)

```typescript
export interface GroundingOptions {
  pageTextMap: Record<number, string>;
  snippet: string;
  declaredPageNumber?: number | null;
  coverageName?: string;
  fuzzyTolerance?: number;   // default 0.8 (Jaccard token overlap)
}

export interface GroundingResult {
  isGrounded: boolean;
  resolvedPageNumber: number | null;
  matchType: 'exact' | 'fuzzy' | 'none';
  reason: string;
}

export function validateGrounding(options: GroundingOptions): GroundingResult;

export interface GroundedCoverageValue {
  value: string;
  rawTextSnippet: string;
  pageNumber: number | null;
  grounding: GroundingResult;
}

export function validateCoverageValues(
  coverages: Array<{ name: string; value: string; rawTextSnippet?: string; pageNumber?: number | null }>,
  pageTextMap: Record<number, string>
): Array<{ coverageName: string; value: string; validation: ValueValidationResult; grounding: GroundingResult }>;
```

#### Internal structure

- `normalizeForSearch(text)` — lowercases, removes punctuation/spaces, normalizes Colombian separators.
- `findSnippetPage(pageTextMap, snippet)` — exact substring scan across all pages.
- `fuzzySnippetMatch(pageText, snippet, tolerance)` — token-set Jaccard match.
- `resolvePageNumber()` — uses declared page if valid, otherwise searches all pages.

#### Interaction with other modules

- Called by `quoteProcessingService` after normalization.
- Penalty applied by `confidenceScorer.calculateConfidence()` (new `groundingPenalty` input).
- Failure metric emitted via `ExtractionMetrics`.

---

### 4.5 `insurerProfileService` (`server/src/services/insurerProfileService.ts`)

#### Responsibilities

- Return a canonical insurer key and display name from PDF content, alias map, or filename.
- Provide coverage mappings and prompt templates per insurer profile.
- Emit the insurer detection source and confidence.

#### Public interface (evolved)

```typescript
export interface InsurerResolutionResult {
  canonicalKey: string;        // e.g., "SBS"
  displayName: string;         // e.g., "SBS Seguros Colombia S.A."
  source: InsurerDetectionSource;
  confidence: number;          // 0..1
  matchedAlias?: string;
}

export const insurerProfileService: {
  resolveInsurer(input: {
    nativeText: string;
    metadata?: Record<string, string>;
    filename?: string;
  }): InsurerResolutionResult;

  detectInsurer(text: string): string; // legacy key-only helper
  getProfile(insurerName: string): InsurerExtractionProfile;
  mapCoverage(coverageName: string, profile: InsurerExtractionProfile): string;
  getSupportedInsurers(): string[];
  getRegistrySeed(insurerName: string): TemplateRegistryEntry | undefined;
  registerProfile(profile: InsurerExtractionProfile): void;
};
```

#### Internal structure

- `searchContentMatch(nativeText, metadata)` — scans first two pages and metadata for known insurer names and NITs.
- `resolveAlias(rawName)` — maps raw detected text to canonical key using `data/domains/insurerAliases.json`.
- `extractFromFilename(filename)` — fallback regex `COTIZACION.*?-\s*` and known patterns.
- `rankCandidates()` — returns highest-confidence match; ties broken by content > alias > filename.

#### Interaction with other modules

- Called by `quoteProcessingService` before prompt selection.
- The canonical key feeds RAG lookups (`ragRetrievalService`, `crossReferenceEngine`) unchanged.
- The display name is used in the final report.

---

## 5. Schema Design

### 5.1 `QuoteExtractionSchemaV2`

The V2 schema is tightened to require grounding fields and to include the detected format family.

```typescript
export const RawCoverageSchema = passthrough({
  section: z.string().nullish(),
  rawName: z.string().min(1),
  insuredAmount: z.number().min(0).nullish(),
  deductible: z.string().nullish(),
  premium: z.number().min(0).nullish(),
  notes: z.string().nullish(),
  rawTextSnippet: z.string().min(1),   // REQUIRED
  pageNumber: z.number().int().min(1), // REQUIRED
});

export const QuoteExtractionSchemaV2 = passthrough({
  insurerName: z.string().min(1),
  policyName: z.string().min(1),
  validityPeriod: z.string().nullish(),
  premium: PremiumSchema,
  insuredAssets: z.array(InsuredAssetSchema).nullish(),
  rawCoverages: z.array(RawCoverageSchema).min(1),
  subLimits: z.array(SubLimitSchema).nullish(),
  generalDeductibles: z.array(GeneralDeductibleSchema).nullish(),
  specialConditions: z.array(z.string()).nullish(),
  exclusions: z.array(z.string()).nullish(),
  warranties: z.array(z.string()).nullish(),
  formatFamily: z.string().min(1).default('UNKNOWN'), // ADDED
});
```

When `ZOD_SCHEMA_VERSION=v2` is enabled, the schema switches to `.strict()` and rejects unknown keys. Until then, `passthrough()` remains the default to avoid breaking legacy paths.

### 5.2 `DeductibleStructure`

```typescript
export const DeductibleComponentSchema = passthrough({
  type: z.enum([
    'percentage',
    'fixed',
    'smmlv',
    'uvt',
    'minimum',
    'maximum',
    'na',
    'unknown',
  ]),
  value: z.number(),
  currency: z.string().nullish(), // 'COP', 'USD', 'SMMLV', 'UVT'
});

export const DeductibleStructureSchema = passthrough({
  components: z.array(DeductibleComponentSchema),
  isZero: z.boolean(),
  hasMinimum: z.boolean(),
  hasMaximum: z.boolean(),
  isComposite: z.boolean(),
});
```

Example parsed values:

| Input | `components` | `isZero` | `isComposite` |
|-------|--------------|----------|---------------|
| `Sin deducible` | `[{type:'na',value:0}]` | `true` | `false` |
| `10%` | `[{type:'percentage',value:10}]` | `false` | `false` |
| `5 SMMLV` | `[{type:'smmlv',value:5}]` | `false` | `false` |
| `10% mínimo 5 SMMLV` | `[{type:'percentage',value:10},{type:'minimum',value:5,currency:'SMMLV'}]` | `false` | `true` |
| unparseable | `[{type:'unknown',value:0}]` | `false` | `false` |

### 5.3 `ExtractionMetrics`

See Section 4.3 for the full TypeScript interface. At runtime it serializes to a JSON-lines log entry and increments counters in `globalMetrics`.

### 5.4 Taxonomy JSON (`data/domains/pyme/taxonomy.json`)

Already exists and is consumed by `semanticMatcher` and `coverageNormalizer`. It becomes the single source of truth for the 14 canonical PYME categories.

Responsibilities of the file:
- `categories[].id` and `categories[].name` are the canonical IDs/names.
- `categories[].aliases` are loaded by the matcher as thesaurus synonyms.
- `metadata.salaryValue*` and `metadata.uvtValue*` are kept for documentation but runtime values come from `env.ts` / `domainConstants.ts`.

A thin loader (`server/src/services/taxonomyService.ts` or reuse of `domainBundleLoader.loadDomainJson`) is the only code allowed to import the literal list; all other modules import from the loader.

### 5.5 Insurer alias JSON (`data/domains/insurerAliases.json`)

```json
{
  "version": "1.0.0",
  "region": "Colombia",
  "insurers": [
    {
      "canonicalKey": "BOLIVAR",
      "displayName": "Seguros Bolívar S.A.",
      "aliases": [
        "Seguros Bolívar",
        "Bolivar",
        "Bolívar S.A.",
        "SEGUROS BOLIVAR"
      ],
      "nits": ["860002300"],
      "contentPatterns": [
        "Seguros Bolívar",
        "Bolívar S.A.",
        "www.segurosbolivar.com"
      ],
      "filenamePatterns": [
        "Bolivar",
        "COT-.*Bolivar"
      ]
    }
  ]
}
```

The file is loaded once at startup and reloaded on every deploy. Profile-specific mappings (coverage mappings, prompt templates) remain in `insurerProfileService.ts` but may later reference the canonical key.

---

## 6. Algorithm Design

### 6.1 Coverage matcher layer order

For each raw coverage name:

1. **Thesaurus exact/partial** (cheapest, no API).
   - Exact match against canonical name or alias → confidence `1.0`.
   - Partial match (stop-words removed) → confidence `0.95`.
   - Threshold: `>= thresholds.thesaurusExact` (effectively `1.0`).
2. **Fuzzy similarity** (Levenshtein over canonical names + thesaurus synonyms).
   - Threshold: `>= thresholds.fuzzyMin`.
3. **Embedding similarity** (batch over all pending names).
   - Use precomputed category embeddings.
   - Threshold: `>= thresholds.embeddingMin`.
4. **LLM fallback** (single-shot classification).
   - Prompt contains the numbered canonical list.
   - Threshold: `>= thresholds.llmMin`.
5. **Ontology / graph fallback** (when feature flags enabled).
   - `coverageOntology.mapCoverage()` or `coverageGraphService.query()`.
   - Threshold: `>= thresholds.graphMin`.

Batch processing (used by V2):
- Resolve all names through layers 1–2 first.
- Query persistent embedding cache for remaining names.
- Generate embeddings in one batch for names not in cache.
- Run LLM only for names that remain unresolved.
- Emit `normalizationLayerHits.{layer}` for every resolved name.

### 6.2 Grounding validation

For each extracted value with `rawTextSnippet` and declared `pageNumber`:

1. Normalize snippet and page text (`normalizeForSearch`).
2. If declared `pageNumber` is in range and exact substring match exists → `isGrounded=true`, `matchType=exact`.
3. Else if fuzzy token overlap >= `fuzzyTolerance` on declared page → `isGrounded=true`, `matchType=fuzzy`.
4. Else search all pages; if found on another page → `isGrounded=true`, `resolvedPageNumber=<found>`, `matchType=fuzzy`.
5. Else → `isGrounded=false`; confidence is penalized by 15 points (fuzzy) or 25 points (none), capped at 0.

If `rawTextSnippet` is missing and the extraction path is V2, the row is marked as `needsReview=true` because the schema requires it.

### 6.3 Insurer resolution ranking

For a given PDF, build candidate matches from three sources:

1. **Content search** — scan the first two pages of native text and PDF metadata for insurer names, NITs, and domain patterns from `insurerAliases.json`.
   - Score: `1.0` for exact display name or NIT, `0.9` for alias/pattern.
2. **Alias mapping** — apply `insurerAliases.json` to any raw string extracted from content or filename.
   - Score: `0.9`.
3. **Filename fallback** — apply the existing `COTIZACION.*?-\s*` regex and known patterns.
   - Score: `0.7`.

Select the highest-confidence candidate. If no candidate is found, return `GENERIC` with confidence `0.0`. Emit `insurerDetectedSource` and confidence in `ExtractionMetrics`.

---

## 7. State & Persistence

### Cached / in-memory

| State | Owner | Key | TTL / lifecycle |
|-------|-------|-----|-----------------|
| Category embeddings | `coverageMatcher` | `categoryEmbeddingsCache.get(domain)` | Process lifetime; regenerated on deploy. |
| Raw coverage embeddings | `coverageMatcher` | `embeddingCacheService` | Persistent (Redis-backed if `REDIS_URL` configured). |
| Deductible parse results | `hybridDeductibleParser` | `deductible:v2:<hash>` | Redis-backed or in-memory fallback. |
| Thesaurus markdown | `thesaurusService` | domain key | Process lifetime. |
| Insurer aliases | `insurerProfileService` | `insurerAliasesCache` | Process lifetime; reload on deploy. |

### Persisted to Supabase

| Data | Table | Notes |
|------|-------|-------|
| Analysis history | `analysis_history` | Unchanged; final `ParsedQuote` is stored as JSON. |
| User corrections | `coverage_mappings` | Unchanged; continue to feed the matcher cache and ontology/graph. |
| (Optional future) extraction metrics | `extraction_metrics` | Not required for this phase; can be added later from the same `ExtractionMetrics` events. |

### File-based configuration

- `data/domains/pyme/taxonomy.json` — canonical categories and aliases.
- `data/domains/insurerAliases.json` — insurer aliases, NITs, patterns.
- `server/src/config/domainConstants.ts` — runtime SMMLV/UVT constants loaded from `env.ts`.

---

## 8. Error Handling & Resilience

### Extraction retry/fallback ladder

```
V2 vision extraction
  ├─ Zod parse error → retry up to 2 times with same prompt
  ├─ JSON repair → emit 'repaired' metric
  ├─ Raw extraction fallback → emit 'raw_fallback' metric
  └─ Unrecoverable error → legacy V1 fallback → emit 'legacy_fallback' metric
        └─ Legacy also fails → failed placeholder ParsedQuote
```

### Module-specific resilience

| Module | Failure mode | Strategy |
|--------|--------------|----------|
| `coverageMatcher` | Embedding service down | Skip to LLM; if LLM fails, skip to graph; if all fail, return null match. |
| `coverageMatcher` | Thesaurus file missing | Use built-in thesaurus fallback and log warning. |
| `hybridDeductibleParser` | LLM fallback fails | Return `unknown` component; downstream treats as review. |
| `hybridDeductibleParser` | Redis unavailable | Cache writes fail silently; parser continues in memory. |
| `valueValidationService` | Empty `pageTextMap` | Skip grounding check; do not penalize confidence; emit metric. |
| `insurerProfileService` | No content/filename match | Return `GENERIC` profile; downstream RAG uses generic retrieval. |

### Degradation rules

- Grounding failure → confidence penalty, not value removal.
- Deductible parse failure → value kept as raw string, flag added, `DeductibleStructure` with `unknown` component.
- Matcher failure → coverage added as uncategorized, `needsReview=true`.
- Legacy path → does not require `rawTextSnippet`/`pageNumber`; grounding is skipped for V1 rows.

---

## 9. Observability

### Structured logging

Every pipeline stage emits JSON-lines events via `structuredLogger`. Example events:

- `extraction_started`, `extraction_completed`, `extraction_failed`
- `deductible_parsed`, `deductible_parse_failed`
- `coverage_normalized`, `coverage_match_layer`
- `grounding_passed`, `grounding_failed`
- `insurer_resolved`

### Metrics

The `ExtractionMetrics` event is the primary telemetry artifact. It is aggregated by:

- `extractionPath` and `outcome`
- `formatFamily`
- `insurerDetectedSource`
- `normalizationLayerHits.*`
- `groundingFailures`
- `deductibleParseFailures`

A lightweight dashboard query can be built from log aggregation (e.g., Loki, Datadog, CloudWatch) without a new database table.

### Tracing

Each quote carries a `quoteId` and `requestId`. Stage durations are recorded in `ExtractionMetrics.durationMs`.

---

## 10. Testing Strategy

### Unit tests

- `hybridDeductibleParser.test.ts` — compound deductibles, SMMLV/UVT, zero, malformed percentages, fallback.
- `coverageMatcher.test.ts` — each layer in isolation, batch ordering, threshold behavior.
- `valueValidationService.test.ts` — exact/fuzzy grounding, page resolution, confidence penalty.
- `insurerProfileService.test.ts` — content match, alias map, filename fallback, generic fallback.
- `domainConstants.test.ts` — SMMLV/UVT loaded from env, no hardcoded duplicates elsewhere.

### Integration tests

- `quoteProcessingService.test.ts` — V2 default selection, legacy fallback when `isScanned=true`, repair metric emission.
- `analysisController.test.ts` — `/api/analyze` returns compatible `ParsedQuote` shape.
- `crossReferenceEngine.test.ts` — compares `DeductibleStructure` objects, not raw strings.

### Evaluation harness

- `server/scripts/evaluateFormatFamily.ts` runs V2 against labeled fixture PDFs and prints:
  - Accuracy per format family
  - Fallback rate
  - Average confidence
  - Deductible parse failure rate
  - Insurer mismatch rate
- Fixtures live in `tests/fixtures/format-family/{family}/`.
- The harness is intended for ad-hoc evaluation and PR validation; it is not a CI golden-set framework.

### Characterization tests

Before modifying legacy modules, capture current outputs for a representative fixture set. These tests guard against accidental threshold changes during matcher unification.

---

## 11. Deployment & Rollout

### Implementation slices (same as proposal)

1. **WP1 Telemetry & constants** — add `ExtractionMetrics`, `domainConstants.ts`, centralize taxonomy imports.
2. **WP2 V2 default + WP6 schema** — retire `ENABLE_MULTIMODAL_EXTRACTION`, harden prompts, require `rawTextSnippet`/`pageNumber`.
3. **WP3 Deductible unification** — promote `hybridDeductibleParser`, refactor consumers.
4. **WP4 Coverage matcher unification** — introduce `coverageMatcher/` and migrate callers.
5. **WP5 Insurer robustness + grounding validation** — alias map, `validateGrounding()`, confidence penalty.
6. **WP6 Cleanup + evaluation harness** — remove dead code, enable `ZOD_SCHEMA_VERSION=v2` by default, add `evaluateFormatFamily.ts`.

### Feature flags

| Flag | Purpose | Default |
|------|---------|---------|
| `ENABLE_MULTIMODAL_EXTRACTION` | Retired. V2 is always the default for non-scanned PDFs. | — |
| `ZOD_SCHEMA_VERSION` | `v1` (passthrough) during rollout; `v2` (strict) after stabilization. | `v1` → `v2` |
| `ENABLE_DETERMINISTIC_GROUNDING` | Enable grounding validation and confidence penalty. | `true` |
| `useLegacyCoverageMatcher` | Force old normalization path for emergency rollback. | `false` |
| `useLegacyDeductibleParser` | Force old deductible path for emergency rollback. | `false` |
| `semanticCoverageOntology` | Ontology-based grouping. | `true` (existing) |
| `useTemplateGraphPipeline` | Graph fallback in matcher. | `false` (existing) |

### Gradual rollout

1. Deploy WP1 behind no behavior change; confirm metrics appear.
2. Deploy WP2 with V2 default in a staging environment; run evaluation harness.
3. Enable `ENABLE_DETERMINISTIC_GROUNDING` for 10% of traffic, compare fallback/repair rates.
4. Roll forward to 100% when targets are met.
5. Enable `ZOD_SCHEMA_VERSION=v2` only after repair/fallback rate is stable below 8%.

### Rollback plan

- If V2 default causes a regression, set `ENABLE_MULTIMODAL_EXTRACTION=false` is **not** restored; instead, use the legacy fallback logic already in `quoteProcessingService` by throwing a temporary guard clause, or set `useLegacyCoverageMatcher=true` / `useLegacyDeductibleParser=true` to narrow the problem.
- If grounding validation causes excessive confidence penalties, disable `ENABLE_DETERMINISTIC_GROUNDING` without reverting schema changes.
- Database schema is unchanged, so rolling back the service binary is sufficient.

---

## 12. Backwards Compatibility

### API contract

- `/api/analyze` response shape remains the same. New optional fields (`detectedInsurerSource`, `groundingStatus`, `formatFamily`) are added to `ParsedQuote` but are not required by existing consumers.

### ParsedQuote shape

- Existing fields (`insurerName`, `policyName`, `priceAnnual`, `coverages[]`, etc.) keep the same names and types.
- Coverage rows inside `ParsedQuote` may gain `rawTextSnippet` and `pageNumber` but these are optional for legacy consumers.

### RAG / audit / clause reconciliation

- `crossReferenceEngine.ts` and `reconciliationService.ts` continue to receive `ParsedQuote`. Internally they compare `DeductibleStructure` objects; the external contract does not change.
- `AuditDashboard.tsx` and `ComparisonReport.tsx` can optionally display grounding indicators.

### Learning engine

- User corrections still write to `coverage_mappings`.
- `coverageMatcher` continues to read from the same cache/ontology/graph feeds.

### Database

- No schema migrations are required.

---

## 13. Assumptions

Because this design is produced in **automatic mode**, the following assumptions are explicitly stated:

1. V2 multimodal is technically ready to be the production default; only hardening and observability are needed.
2. The 14 canonical PYME categories are stable and already represented in `data/domains/pyme/taxonomy.json`.
3. `hybridDeductibleParser.ts` is the best foundation for the canonical deductible parser; it is extended, not replaced.
4. `semanticMatcher.ts` is the best foundation for the unified matcher; it absorbs thesaurus and normalizer logic.
5. Scanned/image PDFs remain out of scope; they continue to use the legacy path or fail gracefully.
6. No new infrastructure (databases, queues, caches) is added beyond the existing Redis/Supabase setup.
7. Controller refactoring remains out of scope; `analysisController.ts` is touched only for path selection and metrics emission.
8. A full golden-set evaluation framework remains out of scope; the per-format-family harness uses existing labeled fixtures.
9. All new code uses English identifiers and comments per project conventions.
10. Backwards compatibility is mandatory; existing RAG/audit/comparison flows must not break.

---

## 14. Related Files

| File | Role in this design |
|------|---------------------|
| `openspec/changes/extraction-pipeline/proposal.md` | Source proposal |
| `openspec/changes/extraction-pipeline/explore.md` | Source exploration report |
| `server/src/controllers/analysisController.ts` | Orchestrator (minimal changes) |
| `server/src/services/quoteProcessingService.ts` | Extraction path selection, metrics emission |
| `server/src/services/gemini.ts` | V2 schema and Gemini calls |
| `server/src/services/pdfExtractor.ts` | Native text and page map |
| `server/src/services/formatDetector.ts` | Format family detection |
| `server/src/services/promptBuilder.ts` | Hardened V2 prompts |
| `server/src/services/coverageMatcher/` | New unified matcher |
| `server/src/services/hybridDeductibleParser.ts` | Canonical deductible parser |
| `server/src/services/deductibleAnalyzer.ts` | Consumer of canonical parser |
| `server/src/services/quoteValidator.ts` | Consumer of canonical parser and constants |
| `server/src/services/confidenceScorer.ts` | Applies grounding penalty |
| `server/src/services/insurerProfileService.ts` | Robust insurer resolver |
| `server/src/services/valueValidationService.ts` | Grounding validation |
| `server/src/services/extractionMetrics.ts` | New telemetry module |
| `server/src/config/env.ts` | Source of SMMLV/UVT env vars |
| `server/src/config/domainConstants.ts` | New centralized constants |
| `server/src/config/featureFlags.ts` | Feature flags |
| `server/src/schemas/extractionSchemas.ts` | `QuoteExtractionSchemaV2` updates |
| `data/domains/pyme/taxonomy.json` | Canonical coverage source |
| `data/domains/insurerAliases.json` | New insurer alias source |
| `server/scripts/evaluateFormatFamily.ts` | New evaluation harness |

---

*Design generated during SDD Design phase for project `comparadorpyme`.*
