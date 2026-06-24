# SDD Spec: Extraction Pipeline Improvements

## Document Control

| Field | Value |
|-------|-------|
| **Project** | comparadorpyme |
| **Change** | extraction-pipeline |
| **Phase** | sdd-spec |
| **Mode** | Automatic — assumptions stated explicitly in Section 12. |
| **Artifact store** | openspec + engram (hybrid) |
| **Based on** | `openspec/changes/extraction-pipeline/proposal.md`, `openspec/changes/extraction-pipeline/explore.md` |

---

## 1. Tech Stack & Constraints

### Stack
- **Runtime:** Node.js 20+, TypeScript 5.x
- **Backend framework:** Express 4.x
- **AI provider:** Google Gemini (`@google/genai`) — model versions remain env-driven (`GEMINI_MODEL`, `GEMINI_CHAT_MODEL`, etc.)
- **PDF parsing:** `pdfjs-dist/legacy/build/pdf.js` for native text + positional items
- **Vector store:** Supabase/pgvector
- **Optional cache:** Redis (only learning engine / embedding cache depend on it)
- **Schema validation:** Zod
- **Frontend:** React + TypeScript

### Hard constraints carried forward
1. **No new infrastructure** — no new databases, message queues, or persistent caches beyond Redis (already optional).
2. **Gemini model versions stay env-driven** — this spec hardens prompts and schemas but does not pin a model version.
3. **`/api/analyze` response shape** must remain compatible with `ComparisonReport` and `AuditDashboard`.
4. **`ParsedQuote` downstream contract** must remain stable for RAG, audit, clause reconciliation, scoring, and the learning engine.
5. **Colombian domain rules:**
   - Currency is COP unless explicitly marked otherwise.
   - SMMLV and UVT references are resolved using authoritative values.
   - The 14 canonical PYME categories listed in `data/domains/pyme/taxonomy.json` are invariant.
   - Annual premium must fall in 100,000 COP – 500,000,000 COP unless explicitly marked as partial/sub-limit.
6. **OCR for scanned PDFs remains out of scope** — legacy V1 path or graceful failure is the only fallback.
7. **Controller refactor remains out of scope** — `analysisController.ts` is touched only for path selection, insurer detection, and metrics emission.

### Assumptions
1. V2 multimodal is technically ready to become the default; it only needs hardening and stricter schema/prompt contracts.
2. `semanticMatcher.ts` is the best canonical matcher foundation and should absorb `thesaurusMapper.ts` and `coverageNormalizer.ts` orchestration.
3. `hybridDeductibleParser.ts` is the best canonical deductible parser foundation.
4. The 14 canonical PYME categories in `data/domains/pyme/taxonomy.json` will not change during this work.
5. A single authoritative SMMLV/UVT value pair can be chosen and documented.

---

## 2. Work Package 1 — Telemetry & Domain Constants

### 2.1 Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| WP1-FR1 | Every quote processed by `/api/analyze` emits a structured `ExtractionMetrics` event. | At least one event per quote is observable in logs/metrics sink with `quoteId`, `insurer`, `formatFamily`, and `result` fields. |
| WP1-FR2 | Success, repair, fallback, and per-layer matching rates are measurable. | Metrics include `extraction.success`, `extraction.repair`, `extraction.legacy_fallback`, `extraction.raw_fallback`, `matcher.layer_hit`, and `deductible.parse_failure`. |
| WP1-FR3 | SMMLV, UVT, and the canonical coverage list exist in a single source of truth. | Grep for `1300000`, `1423500`, or any hardcoded canonical coverage literal outside config/data files returns zero results. |
| WP1-FR4 | Zod strictness is increased behind `ZOD_SCHEMA_VERSION=v2`. | When `ZOD_SCHEMA_VERSION=v2`, V2 schema rejects unknown keys; V1 schema no longer uses `.passthrough()` by default. |
| WP1-FR5 | JSON repair usage is observable. | Every invocation of `jsonRepair.ts` increments `extraction.repair` with the failure category. |

### 2.2 Interface Contracts

#### `ExtractionMetrics` event type

```typescript
// server/src/types/extractionMetrics.ts

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
}
```

#### `ExtractionMetricsEmitter` interface

```typescript
// server/src/services/extractionMetricsEmitter.ts

export interface ExtractionMetricsEmitter {
  emit(event: Partial<ExtractionMetrics> & { quoteId: string }): void;
  snapshot(): ExtractionMetrics[];
}

export function createExtractionMetricsEmitter(
  sink?: (event: ExtractionMetrics) => void
): ExtractionMetricsEmitter;
```

Default sink writes a JSON line to stdout using `createStructuredLogger('extraction.metrics')`.

#### Domain constants module

```typescript
// server/src/config/domainConstants.ts

export interface DomainConstants {
  smmlv: number;
  uvt: number;
  currency: 'COP';
  canonicalCoverageNames: readonly string[];
  premiumRange: { min: number; max: number };
}

export function getDomainConstants(domain?: string): DomainConstants;
export function resolveValueToCOP(
  value: number,
  unit?: 'SMMLV' | 'UVT' | 'COP' | null,
  constants?: DomainConstants
): number;
```

`getDomainConstants` loads `data/domains/{domain}/taxonomy.json` and falls back to `pyme`. SMMLV/UVT are taken from `env.SMMLV_VALUE` / `env.UVT_VALUE` with the taxonomy metadata used only as documentation/fallback.

### 2.3 Data Model Changes

1. **New file:** `server/src/types/extractionMetrics.ts` — `ExtractionMetrics`, result/layer enums.
2. **New file:** `server/src/services/extractionMetricsEmitter.ts` — emitter implementation.
3. **New file:** `server/src/config/domainConstants.ts` — single source of truth for SMMLV/UVT/canonical coverages.
4. **Modify:** `server/src/config/env.ts` — keep `SMMLV_VALUE` / `UVT_VALUE` as authoritative env values; log a warning if they differ from `taxonomy.json` metadata by more than 1%.
5. **Modify:** `data/domains/pyme/taxonomy.json` — ensure `metadata.salaryValue2024` and `metadata.uvtValue2024` match the chosen authoritative values. If they do not, update them and add a `metadata.source` field documenting the official source URL/date.
6. **Modify:** `server/src/schemas/extractionSchemas.ts` —
   - Change default strictness logic:
     ```ts
     const isStrict = (process.env.ZOD_SCHEMA_VERSION || 'v1') === 'v2';
     ```
   - For V1, remove `.passthrough()` and use plain `z.object(...)` unless `ZOD_SCHEMA_VERSION=v1` explicitly.
   - Keep V2 opt-in strict with `.catchall(z.never())` when `isStrict` is true.
7. **Modify:** `server/src/services/jsonRepair.ts` — accept an optional `onRepairUsed(category: string)` callback and call it after every repair.

### 2.4 Behavioral Specification

#### Metric emission points

1. **Quote start** — `analysisController.uploadAndAnalyze` creates `quoteId` and emits `extraction.started` with `index`, `total`, `filename`.
2. **Native text ready** — after `pdfExtractor.extractTextFromPdf`, emit `extraction.native_text_ready` with `pageCount`, `isScanned`.
3. **Insurer detected** — after insurer resolution, emit `extraction.insurer_detected` with `insurer`, `insurerDetectionSource`.
4. **Format detected** — after `detectFormatFamily`, emit `extraction.format_detected` with `formatFamily`.
5. **Extraction path chosen** — emit `extraction.path_chosen` with `path: 'v2' | 'legacy' | 'raw'`.
6. **V2 success / repair / fallback** — inside `quoteProcessingService`:
   - On clean V2 parse: `extraction.v2.success`.
   - On JSON repair used: `extraction.v2.repair` with `repairAttempts`.
   - On raw extraction fallback: `extraction.v2.raw_fallback`.
   - On legacy fallback: `extraction.v2.legacy_fallback`.
7. **Normalization complete** — after `coverageMatcher.normalizeBatch`, emit `extraction.normalization_complete` with `matcherLayerHits` and `normalizationConfidence`.
8. **Deductible parse** — after each call to `hybridDeductibleParser.parse`, emit `deductible.parsed` or `deductible.parse_failed`.
9. **Grounding validation** — after `validateGrounding`, emit `extraction.grounding_checked` with counts.
10. **Quote final** — emit `extraction.completed` with `result`, `durationMs`, `errorCategory` (if any).

#### Domain constants resolution order

1. `env.SMMLV_VALUE` / `env.UVT_VALUE` are authoritative at runtime.
2. `domainConstants.getDomainConstants(domain)` loads `taxonomy.json` and overrides with env values.
3. Any module needing SMMLV/UVT imports from `domainConstants.ts` (or `env.ts`) — never hardcodes.
4. `taxonomy.json` metadata is updated to match the env defaults and serves as documentation + offline reference.

#### Canonical coverage list consumption

1. `quoteValidator.ts`, `quoteScorer.ts`, `clauseCoverageValidator.ts`, `inverseCoverageChecker.ts`, and frontend constants import `getCanonicalCoverageNames(domain)` from `domainConstants.ts`.
2. The existing `CANONICAL_COVERAGES` object in `insurerProfileService.ts` is removed; the service reads from `domainConstants.ts`.
3. The matcher (`semanticMatcher.ts`) continues to load categories via `loadDomainJson(domain, 'taxonomy.json')` but verifies the list matches `domainConstants.getDomainConstants(domain).canonicalCoverageNames` at module load; if mismatch, it logs a warning and uses the taxonomy file.

#### Zod strictness rollout

1. Default `ZOD_SCHEMA_VERSION` remains `v1` until Slice 6.
2. In `v1` mode, V1 schema does **not** use `.passthrough()`; it uses plain `z.object(...)` to surface drift while still allowing extra keys at runtime (Zod default strips unknown keys, which is acceptable).
3. In `v2` mode, V2 schema uses `.strict()` / `.catchall(z.never())` so unknown keys fail validation.
4. `jsonRepair.ts` emits a metric with category: `trailing_comma`, `unterminated_string`, `truncated_object`, `invalid_escape`, `partial_extraction`, or `unknown`.

### 2.5 Error Handling

| Error | Handling |
|-------|----------|
| Metrics sink throws | Catch and log to `console.error`; never fail the quote. |
| `taxonomy.json` missing or invalid | Throw at startup so the issue is caught immediately; fallback to a hardcoded minimal taxonomy only in tests. |
| Env SMMLV/UVT missing | Use `taxonomy.json` metadata values and log a warning. If both missing, throw at startup. |
| `ZOD_SCHEMA_VERSION` invalid | Treat any value other than `v2` as `v1` and log a warning. |

### 2.6 Testing Requirements

| Test | Type | Criteria |
|------|------|----------|
| `extractionMetricsEmitter.test.ts` | Unit | Emitter collects events; custom sink receives them; duplicate `quoteId` events merge correctly. |
| `domainConstants.test.ts` | Unit | Returns correct SMMLV/UVT; loads canonical names; resolves SMMLV/UVT to COP. |
| `env-taxonomy-consistency.test.ts` | Integration | Env values and `taxonomy.json` metadata are within 1% or a documented reason exists. |
| `jsonRepair-telemetry.test.ts` | Unit | Each repair strategy emits the correct category. |
| `zod-strictness.test.ts` | Unit | `v2` rejects unknown keys; `v1` strips unknown keys without error. |

### 2.7 Dependencies

- None within this change; WP1 is the foundation.
- Blocks WP2, WP4, WP5 because they rely on metric emission and constants.

### 2.8 Files to Create / Modify / Delete

| Action | Path | Notes |
|--------|------|-------|
| Create | `server/src/types/extractionMetrics.ts` | Enums and `ExtractionMetrics` interface. |
| Create | `server/src/services/extractionMetricsEmitter.ts` | Emitter + default JSON sink. |
| Create | `server/src/config/domainConstants.ts` | Constants + resolver. |
| Modify | `server/src/config/env.ts` | Add consistency check against taxonomy. |
| Modify | `server/src/schemas/extractionSchemas.ts` | Strictness logic. |
| Modify | `server/src/services/jsonRepair.ts` | Repair telemetry callback. |
| Modify | `server/src/controllers/analysisController.ts` | Create `quoteId`, pass emitter through pipeline, emit final event. |
| Modify | `data/domains/pyme/taxonomy.json` | Update metadata to authoritative values; add `metadata.source`. |
| Modify | `server/src/services/quoteValidator.ts` | Use `domainConstants` for premium range and canonical list. |
| Modify | `server/src/services/quoteScorer.ts` | Use `domainConstants` for canonical list. |
| Modify | `server/src/services/clauseCoverageValidator.ts` | Use `domainConstants` for canonical list. |
| Modify | `server/src/services/inverseCoverageChecker.ts` | Use `domainConstants` for canonical list. |
| Modify | `server/src/services/insurerProfileService.ts` | Remove hardcoded `CANONICAL_COVERAGES`. |
| Delete | N/A | No deletions. |

---

## 3. Work Package 2 — V2 Stabilization

### 3.1 Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| WP2-FR1 | V2 is the default extraction path for every non-scanned PDF. | `isMultimodalEnabled()` returns true when `ENABLE_MULTIMODAL_EXTRACTION` is not explicitly `false` **and** the PDF is not scanned. |
| WP2-FR2 | Legacy path is an explicit degraded fallback. | Legacy is invoked only when `isScanned=true`, V2 throws after retries, or V2 returns an empty/invalid result. |
| WP2-FR3 | V2 prompts include anti-hallucination and grounding rules. | `promptBuilder.ts` / `layoutAwarePromptBuilder.ts` templates contain the required grounding clauses. |
| WP2-FR4 | V2 schema requires `rawTextSnippet` and `pageNumber` on coverage rows. | `QuoteExtractionSchemaV2.rawCoverages.items` has `rawTextSnippet` and `pageNumber` in `required`. |
| WP2-FR5 | V2 output includes a `formatFamily` field. | Schema includes `formatFamily: string` at top level, populated from `detectFormatFamily`. |
| WP2-FR6 | Premium breakdown fields are explicit and validated. | `premium` object requires `totalPayable` and `currency`; validation ensures `totalPayable > 0` for non-failed quotes. |
| WP2-FR7 | A lightweight per-format-family evaluation harness exists. | `scripts/evaluateFormatFamily.ts` runs against labeled fixtures and prints accuracy/fallback/confidence per family. |

### 3.2 Interface Contracts

#### Updated V2 schema (Gemini JSON schema)

```typescript
// server/src/services/gemini.ts

export const QuoteExtractionSchemaV2: any = {
  // ... existing shape with these changes:
  properties: {
    // ... insurerName, policyName, validityPeriod unchanged
    formatFamily: {
      type: SchemaType.STRING,
      description: "Detected format family of the quote (e.g. TABLE-DOUBLE, SECTIONS)",
      nullable: false,
    },
    premium: {
      // ... netPremium, fees, taxes, otherCharges, totalPayable, currency, periodicity
      required: ["totalPayable", "currency"],
    },
    rawCoverages: {
      items: {
        properties: {
          // ... section, rawName, insuredAmount, deductible, premium, notes unchanged
          rawTextSnippet: {
            type: SchemaType.STRING,
            description: "Exact contiguous text snippet (50-150 chars) from the PDF where this coverage appears. Must be verifiable in the native text.",
            nullable: false,
          },
          pageNumber: {
            type: SchemaType.NUMBER,
            description: "1-based PDF page number where rawTextSnippet appears.",
            nullable: false,
          },
        },
        required: ["rawName", "rawTextSnippet", "pageNumber"],
      },
    },
    // ... subLimits, generalDeductibles, specialConditions, exclusions, warranties unchanged
  },
  required: ["insurerName", "policyName", "formatFamily", "premium", "rawCoverages"],
};
```

Corresponding Zod schema in `server/src/schemas/extractionSchemas.ts`:

```typescript
export const RawCoverageSchema = passthrough({
  section: z.string().nullish(),
  rawName: z.string().min(1),
  insuredAmount: z.number().min(0).nullish(),
  deductible: z.string().nullish(),
  rawTextSnippet: z.string().min(10).max(500),
  pageNumber: z.number().int().min(1),
  premium: z.number().min(0).nullish(),
  notes: z.string().nullish(),
});

export const QuoteExtractionSchemaV2 = passthrough({
  insurerName: z.string().min(1),
  policyName: z.string().min(1),
  validityPeriod: z.string().nullish(),
  formatFamily: z.string().min(1),
  premium: PremiumSchema,
  insuredAssets: z.array(InsuredAssetSchema).nullish(),
  rawCoverages: z.array(RawCoverageSchema).min(1),
  subLimits: z.array(SubLimitSchema).nullish(),
  generalDeductibles: z.array(GeneralDeductibleSchema).nullish(),
  specialConditions: z.array(z.string()).nullish(),
  exclusions: z.array(z.string()).nullish(),
  warranties: z.array(z.string()).nullish(),
});
```

#### `processQuoteMultimodal` signature update

```typescript
// server/src/services/quoteProcessingService.ts

export interface ProcessQuoteOptions {
  domain?: string;
  forceLegacy?: boolean;
  metrics?: ExtractionMetricsEmitter;
  quoteId: string;
}

export async function processQuoteMultimodal(
  file: Express.Multer.File,
  index: number,
  total: number,
  options: ProcessQuoteOptions
): Promise<ParsedQuote>;
```

`quoteId` and `metrics` are now required so every call can emit telemetry.

### 3.3 Data Model Changes

1. **Modify:** `server/src/services/gemini.ts` — add `formatFamily`, make `rawTextSnippet`/`pageNumber` required in V2 Gemini schema.
2. **Modify:** `server/src/schemas/extractionSchemas.ts` — update `RawCoverageSchema` and `QuoteExtractionSchemaV2`.
3. **Modify:** `server/src/services/quoteProcessingService.ts` — accept `quoteId` and metrics; populate `formatFamily` from detection; pass `quoteId` to emitter.
4. **Modify:** `server/src/controllers/analysisController.ts` — decide V2 vs legacy based on `isScanned` + feature flag, not flag alone.
5. **Create:** `server/scripts/evaluateFormatFamily.ts` — evaluation harness.
6. **Create:** `tests/fixtures/format-family/` — labeled fixture directory structure (see below).

### 3.4 Behavioral Specification

#### V2 vs legacy decision

```typescript
function shouldUseV2(file: Express.Multer.File, nativeTextResult: NativeTextResult): boolean {
  if (process.env.ENABLE_MULTIMODAL_EXTRACTION === 'false') return false;
  if (nativeTextResult.isScanned) return false;
  return true;
}
```

In `analysisController.ts`:

1. Extract native text first for all files (page map + scanned flag).
2. For each file, decide path with `shouldUseV2`.
3. If V2 is chosen and fails after retries, fallback to legacy and emit `extraction.v2.legacy_fallback`.
4. If legacy also fails, create a failed placeholder `ParsedQuote`.

#### Hardened V2 prompt rules

Append the following block to every V2 prompt built by `promptBuilder.ts` and `layoutAwarePromptBuilder.ts`:

```text
### GROUNDING RULES (REQUIRED)

For every coverage row you emit:
1. rawTextSnippet MUST be a contiguous substring of 50-150 characters copied verbatim from the PDF.
2. pageNumber MUST be the 1-based page number where that substring appears.
3. If you cannot locate the coverage in the PDF, set the coverage value to "NO ESPECIFICADO" and still provide your best snippet + page.
4. Do NOT invent snippet text. If the exact wording is unclear, copy the nearest relevant clause text.

### ANTI-HALLUCINATION RULES

- If a field is not present in the document, use "NO ESPECIFICADO" (for text) or 0/null (for numbers) — never invent a value.
- Do NOT list coverages you believe "should" be in a PYME policy unless they appear in the document.
- Premium totalPayable must match a visible total in the PDF.
```

#### formatFamily population

1. `detectFormatFamily(nativeTextPreview)` returns a `FormatDetectionResult` with `family`.
2. `processQuoteMultimodal` injects `formatFamily` into the V2 prompt (e.g., "Format family: TABLE-DOUBLE").
3. The V2 schema requires `formatFamily` in the output; the value must match the detected family.
4. If the model returns a different family, log a warning but accept the output; do not fail validation.

#### Evaluation harness

`server/scripts/evaluateFormatFamily.ts`:

```typescript
interface Fixture {
  path: string;
  family: string;
  insurer: string;
  expected: {
    rawCoverageCount: number;
    canonicalCoverageCount: number;
    coverages: Array<{ canonicalName: string; insuredAmount?: number; deductibleText?: string }>;
  };
}

interface FamilyReport {
  family: string;
  total: number;
  success: number;
  repairUsed: number;
  legacyFallback: number;
  avgConfidence: number;
  coverageAccuracy: number;
  premiumAccuracy: number;
}

async function evaluateFamily(fixtures: Fixture[]): Promise<FamilyReport>;
async function main(): Promise<void>; // prints markdown table to stdout
```

Fixture layout:

```
tests/fixtures/format-family/
  TABLE-DOUBLE/
    bbva-sample-1/
      quote.pdf
      expected.json
    sbs-sample-1/
      quote.pdf
      expected.json
  SECTIONS/
    ...
```

The harness runs V2 against each fixture, compares extracted canonical coverages against `expected.json`, and reports per-family metrics.

### 3.5 Error Handling

| Error | Handling |
|-------|----------|
| V2 schema strictness rejects valid output | In `v1` mode, use Zod default behavior (strip unknown). In `v2` mode, retry up to 2 times with stricter prompt, then fallback to raw extraction. |
| V2 Gemini 503 / rate limit | Retry with exponential backoff up to 120s; if still failing, fallback to legacy. |
| V2 returns empty `rawCoverages` | Treat as failure; fallback to legacy. |
| V2 `formatFamily` mismatch | Log warning; accept output. Metric includes `formatFamilyDetected` and `formatFamilyReported`. |
| Evaluation harness fixture missing `expected.json` | Skip fixture with warning. |

### 3.6 Testing Requirements

| Test | Type | Criteria |
|------|------|----------|
| `analysisController-path-selection.test.ts` | Integration | Non-scanned PDF uses V2; scanned PDF uses legacy; V2 failure falls back to legacy. |
| `promptBuilder-grounding.test.ts` | Unit | V2 prompts contain grounding and anti-hallucination clauses. |
| `gemini-schema-v2.test.ts` | Unit | Gemini JSON schema requires `rawTextSnippet`, `pageNumber`, `formatFamily`. |
| `quoteProcessingService-v2.test.ts` | Integration | `processQuoteMultimodal` emits metrics and populates `formatFamily`. |
| `evaluateFormatFamily.test.ts` | Integration | Harness runs on at least 2 fixtures per top-4 families and produces a report. |

### 3.7 Dependencies

- WP1 for metrics emitter and constants.
- WP6 for grounding validation consuming `rawTextSnippet`/`pageNumber`.

### 3.8 Files to Create / Modify / Delete

| Action | Path | Notes |
|--------|------|-------|
| Modify | `server/src/services/gemini.ts` | V2 schema additions. |
| Modify | `server/src/schemas/extractionSchemas.ts` | Zod schema additions. |
| Modify | `server/src/services/quoteProcessingService.ts` | Accept quoteId/metrics; populate formatFamily. |
| Modify | `server/src/services/promptBuilder.ts` | Add grounding/anti-hallucination block. |
| Modify | `server/src/services/layoutAwarePromptBuilder.ts` | Add grounding/anti-hallucination block. |
| Modify | `server/src/controllers/analysisController.ts` | V2 default logic; fallback orchestration. |
| Modify | `server/src/config/featureFlags.ts` | Remove or deprecate `ENABLE_MULTIMODAL_EXTRACTION` runtime opt-out behavior documentation. |
| Create | `server/scripts/evaluateFormatFamily.ts` | Harness. |
| Create | `tests/fixtures/format-family/README.md` | Fixture labeling conventions. |
| Create | `tests/fixtures/format-family/TABLE-DOUBLE/...` | At least 2 labeled PDFs. |
| Create | `tests/fixtures/format-family/SECTIONS/...` | At least 2 labeled PDFs. |
| Create | `tests/fixtures/format-family/DESCRIPTIVE/...` | At least 2 labeled PDFs. |
| Create | `tests/fixtures/format-family/PRICE-TABLE/...` | At least 2 labeled PDFs. |
| Delete | N/A | No deletions. |

---

## 4. Work Package 3 — Deductible Unification

### 4.1 Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| WP3-FR1 | `hybridDeductibleParser.ts` is the single canonical deductible parser. | All deductible regexes outside the parser are thin wrappers or removed. |
| WP3-FR2 | `DeductibleStructure` supports compound, reference-unit, and percentage forms. | Schema includes `components`, `compoundOperator`, `rawText`, and normalized amounts. |
| WP3-FR3 | All consumers call the canonical parser. | `deductibleAnalyzer.ts`, `quoteValidator.ts`, and `thesaurusMapper.ts` no longer contain deductible regex logic. |
| WP3-FR4 | Cross-reference engine compares structured deductibles. | `crossReferenceEngine.ts` and `reconciliationService.ts` use `DeductibleStructure` instead of raw strings. |
| WP3-FR5 | Compound and reference-unit deductibles parse correctly. | Unit tests pass for "mayor entre 10% y 5 SMMLV", "10% / mín. 2 SMMLV", "NO APLICA", "$500.000", etc. |

### 4.2 Interface Contracts

#### Extended `DeductibleStructure`

```typescript
// server/src/schemas/extractionSchemas.ts

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
  currency: z.string().nullish(), // 'COP', 'USD', 'SMMLV', 'UVT', or null
});

export const DeductibleStructureSchema = passthrough({
  components: z.array(DeductibleComponentSchema),
  compoundOperator: z.enum(['none', 'greater_of', 'lesser_of', 'sum', 'and']).default('none'),
  isZero: z.boolean(),
  hasMinimum: z.boolean(),
  hasMaximum: z.boolean(),
  isComposite: z.boolean(),
  rawText: z.string(),
});
```

#### Canonical parser API

```typescript
// server/src/services/hybridDeductibleParser.ts

export interface HybridDeductibleResult extends DeductibleStructure {
  normalized: {
    minAmountCOP: number;
    maxAmountCOP: number;
    percentage: number;
    isPercentageBased: boolean;
  };
  benchmark?: {
    benchmark: string;
    assessment: string;
    notes: string;
  };
  appliesTo?: {
    coverageName: string;
    confidence: number;
  };
  parseMethod: 'cache' | 'regex' | 'llm' | 'empty';
}

export const hybridDeductibleParser = {
  async parse(
    deductibleText: string,
    coverageNameOrOptions?: string | DeductibleParseOptions,
    maybeOptions?: DeductibleParseOptions
  ): Promise<HybridDeductibleResult>;

  getStats(): TelemetryCounters;
  resetStats(): void;
};
```

#### New helper for consumers

```typescript
// server/src/services/deductibleFormatter.ts

export function formatDeductibleForDisplay(structure: DeductibleStructure): string;
export function deductibleEquals(a: DeductibleStructure, b: DeductibleStructure): boolean;
```

### 4.3 Data Model Changes

1. **Modify:** `server/src/schemas/extractionSchemas.ts` — add `compoundOperator` and `rawText` to `DeductibleStructureSchema`.
2. **Modify:** `server/src/services/hybridDeductibleParser.ts` —
   - Promote to canonical parser.
   - Extend regex to detect compound operators: `mayor entre`, `mayor de`, `menor entre`, `menor de`, `y`, `+`.
   - Add `compoundOperator` inference.
   - Add `parseMethod` to result.
   - Remove duplicate `DEFAULT_RATES`; import from `domainConstants.ts`.
3. **Create:** `server/src/services/deductibleFormatter.ts` — display/equality helpers.
4. **Modify:** `server/src/services/deductibleAnalyzer.ts` — replace inline regex with calls to `hybridDeductibleParser.parse`.
5. **Modify:** `server/src/services/quoteValidator.ts` — replace deductible regex validation with `DeductibleStructure` validation.
6. **Modify:** `server/src/services/thesaurusMapper.ts` — remove deductible normalization regex; call parser.
7. **Modify:** `server/src/services/deductibleParser.ts` — if fully superseded, delete; otherwise mark `@deprecated` and proxy to `hybridDeductibleParser`.
8. **Modify:** `server/src/services/crossReferenceEngine.ts` — compare `DeductibleStructure` objects.
9. **Modify:** `server/src/services/reconciliationService.ts` — compare `DeductibleStructure` objects.

### 4.4 Behavioral Specification

#### Deterministic parse order

1. **Empty/null text** → return `unknown` structure with `parseMethod: 'empty'`.
2. **Cache lookup** (Redis if available, in-memory fallback) → return cached structure with `parseMethod: 'cache'`.
3. **Regex path** → try `parseSimple` extended with compound detection.
4. **Benchmark evaluation** → if coverage resolved and regex succeeded.
5. **LLM fallback** → if regex fails; cache result.

#### Compound deductible rules

| Input pattern | compoundOperator | Components |
|---------------|------------------|------------|
| "10% y 5 SMMLV" | `greater_of` | `[{percentage,10}, {smmlv,5}]` |
| "mayor entre 10% y 5 SMMLV" | `greater_of` | `[{percentage,10}, {smmlv,5}]` |
| "menor entre 10% y $500.000" | `lesser_of` | `[{percentage,10}, {fixed,500000}]` |
| "10% / mín. 2 SMMLV" | `greater_of` | `[{percentage,10}, {minimum,2,SMMLV}]` |
| "10% / máx. $1.000.000" | `lesser_of` | `[{percentage,10}, {maximum,1000000}]` |
| "NO APLICA" / "SIN DEDUCIBLE" | `none` | `[{na,0}]`, `isZero: true` |

#### Normalized amount calculation

- `minAmountCOP` is the smallest non-zero component resolved to COP.
- `maxAmountCOP` is the largest non-zero component resolved to COP.
- For `greater_of` compounds, `minAmountCOP` = the larger of the two resolved values.
- For `lesser_of` compounds, `maxAmountCOP` = the smaller of the two resolved values.
- Percentage-only deductibles have `percentage > 0`, `minAmountCOP = 0`, `maxAmountCOP = 0`.

#### Consumer refactor rules

1. `deductibleAnalyzer.ts` receives `DeductibleStructure[]` and produces narrative/analysis.
2. `quoteValidator.ts` validates that `DeductibleStructure` is not `unknown` when a deductible is expected; validates premium range using `domainConstants`.
3. `thesaurusMapper.ts` no longer normalizes deductibles; it only maps coverage names.
4. `crossReferenceEngine.ts` uses `deductibleEquals` to flag discrepancies; if either side is `unknown`, status is `PENDING`.

### 4.5 Error Handling

| Error | Handling |
|-------|----------|
| Parser returns `unknown` | Consumers treat as `PENDING` / `needsReview`; metric `deductible.parse_failed` emitted. |
| LLM fallback fails | Return `unknown` structure; log error; do not crash. |
| Cache write fails | Log warning; continue with parsed result. |
| Component currency unrecognized | Treat as COP; log warning. |

### 4.6 Testing Requirements

| Test | Type | Criteria |
|------|------|----------|
| `hybridDeductibleParser.test.ts` | Unit | All documented compound/reference/percentage forms parse correctly; `normalized` values are accurate. |
| `deductibleFormatter.test.ts` | Unit | Display formatting and equality logic correct. |
| `deductibleAnalyzer-integration.test.ts` | Integration | Analyzer uses parser output, not raw strings. |
| `quoteValidator-deductible.test.ts` | Unit | Validator flags `unknown` deductibles and accepts valid structures. |
| `crossReference-deductible.test.ts` | Integration | Discrepancy detected when structured deductibles differ. |

### 4.7 Dependencies

- WP1 for constants and metrics.
- WP2 is independent but V2 outputs feed the parser.

### 4.8 Files to Create / Modify / Delete

| Action | Path | Notes |
|--------|------|-------|
| Modify | `server/src/schemas/extractionSchemas.ts` | Add `compoundOperator`, `rawText`. |
| Modify | `server/src/services/hybridDeductibleParser.ts` | Canonical parser; compound detection; constants import. |
| Create | `server/src/services/deductibleFormatter.ts` | Display/equality helpers. |
| Modify | `server/src/services/deductibleAnalyzer.ts` | Use parser. |
| Modify | `server/src/services/quoteValidator.ts` | Use parser. |
| Modify | `server/src/services/thesaurusMapper.ts` | Remove deductible regex. |
| Modify | `server/src/services/crossReferenceEngine.ts` | Structured deductible comparison. |
| Modify | `server/src/services/reconciliationService.ts` | Structured deductible comparison. |
| Delete or deprecate | `server/src/services/deductibleParser.ts` | Proxy or delete. |

---

## 5. Work Package 4 — Coverage Normalization Unification

### 5.1 Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| WP4-FR1 | A single `CoverageMatcher` interface is used by both V2 and legacy paths. | Both paths call `coverageMatcher.normalizeBatch`. |
| WP4-FR2 | Matcher implements pluggable layers in fixed order. | Layer order: thesaurus → fuzzy → embeddings → LLM → ontology/graph. |
| WP4-FR3 | Confidence thresholds are explicit and configurable. | Thresholds live in `server/src/config/featureFlags.ts` or `domainConstants.ts` and are consumed by all layers. |
| WP4-FR4 | Layer hit-rate metrics are emitted. | `matcherLayerHits` is populated in `ExtractionMetrics`. |
| WP4-FR5 | Existing normalization tests pass without changing expected outputs. | Characterization tests from `coverageNormalizer.test.ts` / `semanticMatcher.test.ts` remain green. |
| WP4-FR6 | Learning engine contract is preserved. | User corrections still feed `coverage_mappings` and the matcher cache/ontology/graph. |

### 5.2 Interface Contracts

#### `CoverageMatcher` interface

```typescript
// server/src/services/coverageMatcher/coverageMatcher.ts

export interface CoverageMatcherInput {
  rawName: string;
  rawTextSnippet?: string;
  pageNumber?: number | null;
  insurer?: string;
  domain?: string;
}

export interface CoverageMatcherResult {
  categoryId: number | null;
  canonicalName: string | null;
  confidence: number; // 0-100
  method: MatchLayer;
  needsReview: boolean;
  rawName: string;
}

export interface CoverageMatcher {
  normalizeBatch(
    inputs: CoverageMatcherInput[],
    options?: { domain?: string; insurer?: string }
  ): Promise<CoverageMatcherResult[]>;

  getLayerHits(): Record<MatchLayer, number>;
  resetLayerHits(): void;
}
```

#### Configuration

```typescript
// server/src/config/matcherThresholds.ts

export interface MatcherThresholds {
  thesaurusExact: number;
  thesaurusPartial: number;
  fuzzyMin: number;
  embeddingMin: number;
  llmMin: number;
  graphMin: number;
  overallMin: number;
  needsReviewBelow: number;
}

export const DEFAULT_MATCHER_THRESHOLDS: MatcherThresholds = {
  thesaurusExact: 100,
  thesaurusPartial: 95,
  fuzzyMin: 60,
  embeddingMin: 70,
  llmMin: 60,
  graphMin: 50,
  overallMin: 60,
  needsReviewBelow: 75,
};

export function getMatcherThresholds(): MatcherThresholds;
```

### 5.3 Data Model Changes

1. **Create directory:** `server/src/services/coverageMatcher/`.
2. **Create:** `server/src/services/coverageMatcher/coverageMatcher.ts` — main implementation.
3. **Create:** `server/src/services/coverageMatcher/layers/` — one file per layer:
   - `thesaurusLayer.ts`
   - `fuzzyLayer.ts`
   - `embeddingLayer.ts`
   - `llmLayer.ts`
   - `graphLayer.ts`
4. **Create:** `server/src/config/matcherThresholds.ts` — thresholds.
5. **Modify:** `server/src/services/semanticMatcher.ts` — deprecate public methods; keep internal embedding/LLM logic and delegate to layers. Eventually becomes a thin wrapper around `coverageMatcher`.
6. **Modify:** `server/src/services/thesaurusMapper.ts` — deprecate public `normalizeCoverages`; keep thesaurus loading logic and move it into `thesaurusLayer.ts`.
7. **Modify:** `server/src/services/coverageNormalizer.ts` — replace `mapRawToCanonicalBatch` with a call to `coverageMatcher.normalizeBatch`; keep deductible resolution, insured amount derivation, and implicit coverage detection as a thin coordinator.
8. **Modify:** `server/src/services/learningEngine.ts` — ensure it writes corrections to the matcher cache in the format expected by `embeddingLayer.ts`.

### 5.4 Behavioral Specification

#### Layer execution order

```
for each input:
  1. thesaurusLayer.match(input)
     → if confidence >= threshold, return { method: 'thesaurus', ... }

  2. fuzzyLayer.match(input)
     → if confidence >= threshold, return { method: 'fuzzy', ... }

  3. embeddingLayer.matchBatch(pendingInputs)
     → if confidence >= threshold, return { method: 'embedding', ... }

  4. llmLayer.matchBatch(pendingInputs)
     → if confidence >= threshold, return { method: 'llm', ... }

  5. graphLayer.matchBatch(pendingInputs) (only if useTemplateGraphPipeline enabled)
     → if confidence >= threshold, return { method: 'graph', ... }

  6. No match → { method: 'none', canonicalName: null, confidence: 0 }
```

#### Batch optimization

1. Thesaurus and fuzzy are evaluated synchronously per input.
2. All inputs that fail fast layers are collected into a single `embeddingLayer.matchBatch` call.
3. Inputs that fail embeddings are collected into a single `llmLayer.matchBatch` call.
4. Graph layer is evaluated only for remaining inputs and only if the feature flag is enabled.

#### Threshold application

- Results are returned as confidence 0-100.
- `needsReview = confidence < DEFAULT_MATCHER_THRESHOLDS.needsReviewBelow`.
- If `overallMin` is not met, `canonicalName` is set to `null`.

#### Metric emission

After `normalizeBatch` completes, increment `matcherLayerHits` for each result based on its `method`. Emit `extraction.normalization_complete` with the counts and confidence distribution.

#### Preserving learning engine feedback

1. `learningEngine.saveCorrection` writes to `coverage_mappings` table with columns: `raw_name`, `canonical_name`, `domain`, `confidence`, `source`.
2. `embeddingLayer.ts` reads from `coverage_mappings` before calling the embedding service: if an exact raw name exists with `confidence >= 0.9`, return it as `method: 'thesaurus'` (cache hit).
3. `graphLayer.ts` reads from `coverage_mappings` to refresh graph edges on startup.

### 5.5 Error Handling

| Error | Handling |
|-------|----------|
| Embedding service fails | Fall back to LLM layer for pending inputs; emit `matcher.embedding_failed`. |
| LLM layer fails | Fall back to graph layer if enabled; otherwise return no match. |
| Graph layer fails | Log warning; return no match. |
| Thesaurus file missing | Use built-in fallback thesaurus (moved from `thesaurusMapper.ts` to `thesaurusLayer.ts`). |

### 5.6 Testing Requirements

| Test | Type | Criteria |
|------|------|----------|
| `coverageMatcher.test.ts` | Unit | Layer order correct; thresholds respected; batching works. |
| `coverageMatcher-characterization.test.ts` | Integration | Same inputs produce same canonical names as before refactor. |
| `thesaurusLayer.test.ts` | Unit | Exact/partial matches work; fallback thesaurus works. |
| `embeddingLayer.test.ts` | Unit | Cache hit bypasses API; batching works. |
| `learningEngine-correction.test.ts` | Integration | Correction is read back by matcher. |

### 5.7 Dependencies

- WP1 for metrics, constants, and taxonomy.
- WP3 is independent but deductible parsing results feed `coverageNormalizer` coordinator.

### 5.8 Files to Create / Modify / Delete

| Action | Path | Notes |
|--------|------|-------|
| Create | `server/src/services/coverageMatcher/coverageMatcher.ts` | Main matcher. |
| Create | `server/src/services/coverageMatcher/layers/thesaurusLayer.ts` | Thesaurus layer. |
| Create | `server/src/services/coverageMatcher/layers/fuzzyLayer.ts` | Fuzzy layer. |
| Create | `server/src/services/coverageMatcher/layers/embeddingLayer.ts` | Embedding layer. |
| Create | `server/src/services/coverageMatcher/layers/llmLayer.ts` | LLM layer. |
| Create | `server/src/services/coverageMatcher/layers/graphLayer.ts` | Graph layer. |
| Create | `server/src/config/matcherThresholds.ts` | Thresholds. |
| Modify | `server/src/services/semanticMatcher.ts` | Deprecate; delegate. |
| Modify | `server/src/services/thesaurusMapper.ts` | Deprecate; delegate. |
| Modify | `server/src/services/coverageNormalizer.ts` | Coordinator only. |
| Modify | `server/src/services/learningEngine.ts` | Ensure correction format matches matcher cache. |
| Delete | N/A | No deletions in this slice. |

---

## 6. Work Package 5 — Insurer Name Robustness

### 6.1 Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| WP5-FR1 | Insurer is detected from PDF content when possible. | Content search covers first page, metadata, and known header regions. |
| WP5-FR2 | Alias mapping normalizes insurer variations. | `data/domains/insurerAliases.json` maps common names to canonical keys. |
| WP5-FR3 | Resolution uses ranked fallback. | Order: content match → alias mapping → filename regex fallback. |
| WP5-FR4 | Canonical key + display name are returned. | `detectInsurer` returns `{ key: string; displayName: string; source: InsurerDetectionSource; confidence: number }`. |
| WP5-FR5 | A metric records detection source. | `ExtractionMetrics.insurerDetectionSource` is populated. |
| WP5-FR6 | Top 5 Colombian insurers have aliases. | Alias file covers Bolívar, SBS, MAPFRE, BBVA, AXA/Chubb/HDI (at least 5). |

### 6.2 Interface Contracts

#### Alias file schema

```json
// data/domains/insurerAliases.json
{
  "version": "1.0.0",
  "aliases": [
    {
      "canonicalKey": "BOLIVAR",
      "displayName": "Seguros Bolívar",
      "patterns": [
        "Seguros Bolívar",
        "Bolivar",
        "Bolívar S.A.",
        "NIT 860.XXX.XXX"
      ]
    },
    {
      "canonicalKey": "SBS",
      "displayName": "SBS Seguros",
      "patterns": [
        "SBS SEGUROS",
        "SBS Seguros Colombia",
        "SBS COLOMBIA"
      ]
    }
  ]
}
```

Corresponding Zod schema:

```typescript
// server/src/schemas/insurerAliasesSchema.ts

export const InsurerAliasSchema = z.object({
  canonicalKey: z.string().min(1),
  displayName: z.string().min(1),
  patterns: z.array(z.string().min(1)).min(1),
});

export const InsurerAliasesBundleSchema = z.object({
  version: z.string(),
  aliases: z.array(InsurerAliasSchema),
});
```

#### Insurer detection result

```typescript
// server/src/services/insurerProfileService.ts

export interface InsurerDetectionResult {
  key: string;
  displayName: string;
  source: InsurerDetectionSource;
  confidence: number; // 0-1
  matchedPattern?: string;
}

export interface InsurerProfileService {
  detectInsurer(context: {
    nativeText: string;
    firstPageText: string;
    metadata?: Record<string, unknown>;
    filename?: string;
  }): InsurerDetectionResult;

  getProfile(key: string): InsurerExtractionProfile;
  getDisplayName(key: string): string;
  getSupportedInsurers(): string[];
}
```

### 6.3 Data Model Changes

1. **Create:** `data/domains/insurerAliases.json` — alias mapping.
2. **Create:** `server/src/schemas/insurerAliasesSchema.ts` — Zod schema for alias file.
3. **Modify:** `server/src/services/insurerProfileService.ts` — implement ranked resolver.
4. **Modify:** `server/src/controllers/analysisController.ts` — use new `detectInsurer` signature; pass result downstream.
5. **Modify:** `server/src/services/quoteProcessingService.ts` — accept `InsurerDetectionResult` instead of raw string.

### 6.4 Behavioral Specification

#### Content search

1. Build a search text from:
   - First 2000 characters of `firstPageText`.
   - PDF metadata `Title`, `Author`, `Subject`, `Producer`, `Creator` joined with spaces.
   - All text occurrences of known insurer patterns anywhere in the document (to catch logos/headers on non-first pages).
2. For each alias entry, test every pattern against the search text (case-insensitive).
3. A match is accepted if a pattern appears as a whole word or bounded phrase (use `\b` or normalized whitespace).
4. Return the alias with the longest matched pattern length; confidence = `matchedPattern.length / alias.displayName.length` capped at 1.0.

#### Filename fallback

1. If no content match, apply the existing regex `COTIZACION.*?-\s*` and strip extension.
2. Normalize the filename-derived string against alias patterns.
3. If still unmatched, return `GENERIC` with source `filename` and confidence 0.3.

#### Ranked resolver

```typescript
function detectInsurer(context): InsurerDetectionResult {
  const content = resolveContentMatch(context);
  if (content) return { ...content, source: 'content' };

  const alias = resolveAliasFromFilename(context.filename);
  if (alias) return { ...alias, source: 'alias' };

  const filename = resolveFilenameHeuristic(context.filename);
  if (filename) return { ...filename, source: 'filename' };

  return { key: 'GENERIC', displayName: 'Genérico', source: 'unknown', confidence: 0 };
}
```

#### Metrics

- Emit `extraction.insurer_detected` with `source` and `confidence`.
- If source differs from `filename`, log at `info` level for audit.

### 6.5 Error Handling

| Error | Handling |
|-------|----------|
| Alias file missing or invalid | Throw at startup in production; in development, fall back to hardcoded minimal aliases. |
| No patterns match | Return `GENERIC` / `unknown`. |
| Multiple aliases match | Pick the one with the longest matched pattern; log warning listing tied aliases. |

### 6.6 Testing Requirements

| Test | Type | Criteria |
|------|------|----------|
| `insurerProfileService.test.ts` | Unit | Content match, alias match, filename fallback, generic fallback all work. |
| `insurerAliasesSchema.test.ts` | Unit | Alias file validates against schema. |
| `analysisController-insurer.test.ts` | Integration | Generic filename with known PDF content resolves to correct insurer. |

### 6.7 Dependencies

- WP1 for metrics and constants.
- WP2 passes insurer to extraction prompt.

### 6.8 Files to Create / Modify / Delete

| Action | Path | Notes |
|--------|------|-------|
| Create | `data/domains/insurerAliases.json` | Alias mapping for top insurers. |
| Create | `server/src/schemas/insurerAliasesSchema.ts` | Zod schema. |
| Modify | `server/src/services/insurerProfileService.ts` | Ranked resolver. |
| Modify | `server/src/controllers/analysisController.ts` | Use new resolver. |
| Modify | `server/src/services/quoteProcessingService.ts` | Accept detection result. |
| Delete | N/A | No deletions. |

---

## 7. Work Package 6 — Deterministic Grounding

### 7.1 Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| WP6-FR1 | V2 schema requires `rawTextSnippet` and `pageNumber` for every coverage row. | See WP2-FR4. |
| WP6-FR2 | Legacy V1 backfills grounding fields when possible. | `quoteProcessingService.ts` searches native text for V1-extracted coverages and adds snippet/page. |
| WP6-FR3 | Grounding validation checks snippet existence and page range. | `validateGrounding()` returns `verified` or a failure reason. |
| WP6-FR4 | Grounding failures reduce confidence and flag for review. | `confidenceScorer.ts` applies a -10 to -25 point penalty; `needsReview` is set. |
| WP6-FR5 | Grounding status surfaces in UI. | `AuditDashboard.tsx` and `ComparisonReport.tsx` show grounding indicator per coverage. |
| WP6-FR6 | Values are never silently dropped for grounding failures. | Only clearly hallucinated values (snippet completely unrelated + high suspicion) may be omitted. |

### 7.2 Interface Contracts

#### Grounding validation

```typescript
// server/src/services/groundingService.ts

export interface GroundingInput {
  rawTextSnippet: string;
  pageNumber: number;
  coverageName: string;
  insuredAmount?: number | null;
  deductibleText?: string | null;
}

export interface GroundingResult {
  status: GroundingStatus;
  confidence: number; // 0-1
  reason: string;
  matchedText?: string;
  matchedPage?: number;
}

export interface GroundingContext {
  pageTextMap: Record<number, string>;
  totalPages: number;
  filename?: string;
}

export function validateGrounding(
  input: GroundingInput,
  context: GroundingContext
): GroundingResult;

export function validateGroundingBatch(
  inputs: GroundingInput[],
  context: GroundingContext
): GroundingResult[];
```

#### Snippet search algorithm

```typescript
function findSnippetInPage(
  snippet: string,
  pageText: string,
  options: { tolerance?: number; minTokenOverlap?: number }
): { found: boolean; matchedText: string; confidence: number };
```

- Normalize both texts: lowercase, collapse whitespace, remove punctuation except numbers and `%`/`$`/`SMMLV`/`UVT`.
- Use a sliding window of snippet length ±20%.
- Accept if token overlap >= `minTokenOverlap` (default 0.7) or Levenshtein similarity >= `tolerance` (default 0.75).

### 7.3 Data Model Changes

1. **Create:** `server/src/services/groundingService.ts` — validation logic.
2. **Modify:** `server/src/services/valueValidationService.ts` — integrate grounding results; rename `validateCoverageValues` overload to accept `GroundingContext`.
3. **Modify:** `server/src/services/confidenceScorer.ts` — apply grounding penalty.
4. **Modify:** `server/src/services/quoteValidator.ts` — set `needsReview` when grounding fails.
5. **Modify:** `server/src/services/quoteParser.ts` — ensure `ParsedQuote` carries `groundingStatus` on coverages.
6. **Modify:** `types/analysis.ts` — add optional `groundingStatus?: GroundingStatus` to coverage type.
7. **Modify:** `components/AuditDashboard.tsx` — show grounding indicator.
8. **Modify:** `components/ComparisonReport.tsx` — show grounding indicator.

### 7.4 Behavioral Specification

#### V2 path

1. V2 output already contains `rawTextSnippet` and `pageNumber`.
2. After extraction, call `validateGroundingBatch` for all raw coverages.
3. Attach `groundingStatus` to each `CanonicalCoverage` produced by `coverageNormalizer`.
4. Emit `extraction.grounding_checked` with counts.

#### Legacy V1 path

1. After V1 extraction, for each coverage:
   - Search native text for the coverage name.
   - If found, extract a 50-150 character snippet centered on the match and record the page number.
   - If not found, set `rawTextSnippet = coverage.name` and `pageNumber = 1` with `groundingStatus = 'native_text_unavailable'`.
2. Then run `validateGroundingBatch`.

#### Confidence penalty

| Grounding status | Penalty | needsReview |
|------------------|---------|-------------|
| `verified` | 0 | false |
| `snippet_missing` | -25 | true |
| `page_out_of_range` | -15 | true |
| `native_text_unavailable` | -10 | false (if value is otherwise plausible) |

#### UI indicator

- Add a small icon next to each coverage in `AuditDashboard.tsx` and `ComparisonReport.tsx`:
  - ✅ green check for `verified`
  - ⚠️ yellow warning for `native_text_unavailable`
  - ❌ red cross for `snippet_missing` / `page_out_of_range`
- Hover tooltip shows the snippet and page number when available.

### 7.5 Error Handling

| Error | Handling |
|-------|----------|
| Native text empty | Set `native_text_unavailable`; apply -10 penalty. |
| Page number > totalPages | Return `page_out_of_range`; apply -15 penalty. |
| Snippet too short (< 10 chars) | Return `snippet_missing`; apply -25 penalty. |
| Grounding service throws | Log error; treat all as `native_text_unavailable`; do not fail quote. |

### 7.6 Testing Requirements

| Test | Type | Criteria |
|------|------|----------|
| `groundingService.test.ts` | Unit | Snippet found, snippet missing, page out of range all detected. |
| `confidenceScorer-grounding.test.ts` | Unit | Penalties applied correctly. |
| `quoteProcessingService-grounding.test.ts` | Integration | V2 and legacy paths produce grounding statuses. |
| `AuditDashboard-grounding.test.tsx` | Component | Icons render for each status. |

### 7.7 Dependencies

- WP1 for metrics.
- WP2 for V2 schema requiring grounding fields.
- WP4 because `CanonicalCoverage` carries grounding status.

### 7.8 Files to Create / Modify / Delete

| Action | Path | Notes |
|--------|------|-------|
| Create | `server/src/services/groundingService.ts` | Validation logic. |
| Modify | `server/src/services/valueValidationService.ts` | Integrate grounding. |
| Modify | `server/src/services/confidenceScorer.ts` | Grounding penalty. |
| Modify | `server/src/services/quoteValidator.ts` | Set `needsReview`. |
| Modify | `server/src/services/quoteParser.ts` | Carry grounding status. |
| Modify | `types/analysis.ts` | Add `groundingStatus`. |
| Modify | `components/AuditDashboard.tsx` | Grounding UI. |
| Modify | `components/ComparisonReport.tsx` | Grounding UI. |
| Delete | N/A | No deletions. |

---

## 8. Security & Compliance

1. **No PII in metrics.** `ExtractionMetrics` must not contain filenames with personal data, full PDF text, or user IDs. Use hashed/derived identifiers only.
2. **Prompt injection resistance.** Hardened V2 prompts must not include user-controlled text verbatim. Only extracted PDF text and static instructions are sent to Gemini.
3. **Audit trace.** `rawTextSnippet` + `pageNumber` + `quoteId` form an auditable link from extracted value to source PDF page.
4. **Data retention.** Metrics events are logs only; no new database tables are created. If logs are retained, ensure they align with existing retention policies.
5. **Alias file integrity.** `insurerAliases.json` is loaded at startup and validated with Zod; malformed files fail fast to prevent silent mis-detection.

---

## 9. Performance & Scalability

1. **Grounding validation is local.** Fuzzy search over in-memory page text; cap snippet length at 500 chars; skip if native text is empty.
2. **Matcher batching preserved.** Embeddings and LLM fallback remain batched; layer hits are counted in-memory.
3. **No additional Gemini calls.** WP1-WP6 do not introduce new LLM calls except the existing LLM fallback paths.
4. **Concurrency unchanged.** Quote processing remains batched with `CONCURRENCY_LIMIT = 2` for Gemini calls.
5. **Memory.** `ExtractionMetrics` events are emitted and not retained in process memory except during a single request.
6. **Cache usage.** Deductible parser cache and embedding cache continue to use Redis if available; in-memory fallback otherwise.

---

## 10. Migration / Backwards Compatibility

### API compatibility
- `/api/analyze` response shape remains unchanged.
- New optional fields (`groundingStatus`, `detectedInsurerSource`) may appear in `ParsedQuote` / coverage objects but must be ignored by older clients.

### Database compatibility
- No schema migrations required.
- `coverage_mappings` table continues to be read/written by the learning engine; the matcher cache format remains compatible.

### Feature flag compatibility
- `ENABLE_MULTIMODAL_EXTRACTION` is still honored when explicitly `false` (e.g., emergency rollback).
- `ZOD_SCHEMA_VERSION` defaults to `v1` until Slice 6.
- `useLegacyCoverageMatcher` and `useLegacyDeductibleParser` remain available for emergency fallback.

### Frontend compatibility
- `AuditDashboard.tsx` and `ComparisonReport.tsx` add grounding indicators but degrade gracefully if `groundingStatus` is absent.

### Rollout order
1. **Slice 1 (WP1):** Telemetry + constants. No behavior change.
2. **Slice 2 (WP2 + WP6 schema):** V2 default + grounding schema. Monitor fallback rate.
3. **Slice 3 (WP3):** Deductible unification. Compare deductible parse failure rate before/after.
4. **Slice 4 (WP4):** Coverage matcher unification. Compare normalization confidence distribution.
5. **Slice 5 (WP5 + WP6 validation):** Insurer robustness + grounding validation.
6. **Slice 6 (Cleanup):** Remove dead code, enable `ZOD_SCHEMA_VERSION=v2`, evaluation harness.

---

## 11. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Regression in legacy path | Medium | High | Keep legacy path untouched except for matcher/deductible calls; add characterization tests before changes. |
| R2 | Prompt instability after hardening | Medium | High | Roll out hardened prompts behind `ZOD_SCHEMA_VERSION=v2`; A/B with evaluation harness; monitor fallback rate. |
| R3 | Backwards incompatibility in `ParsedQuote` shape | Low | High | Keep output contract stable; only add optional fields. |
| R4 | Zod strictness causes avoidable failures | Medium | Medium | Enable strict mode only after repair logic improved; emit metric on every strict failure; allow passthrough fallback for one release cycle. |
| R5 | Coverage matcher unification changes thresholds | Medium | Medium | Preserve existing default thresholds as starting point; expose configuration; measure confidence delta on fixture set. |
| R6 | Insurer alias map becomes stale | Low | Medium | Store aliases in JSON with simple update process; log unknown insurer names for manual review. |
| R7 | Feature-flag cleanup removes a needed path | Low | High | Only retire flags documented as always true and covered by tests; keep experimental/template/graph flags. |
| R8 | Performance degradation from grounding validation | Low | Medium | Grounding is local fuzzy search; cap snippet length; skip if native text empty. |
| R9 | Team disruption from large refactor | Medium | Medium | Slice delivery; merge each slice independently; keep PRs under 400 changed lines where possible. |
| R10 | V2 default increases model cost | Medium | Medium | Monitor per-quote cost via metrics; legacy fallback remains available. |
| R11 | Canonical constants diverge from official values | Low | High | Document source in `taxonomy.json`; add env-taxonomy consistency check at startup. |

---

## 12. Assumptions

1. V2 multimodal is technically ready to become the default; only hardening is needed.
2. The 14 canonical PYME categories will not change during this work.
3. A single authoritative SMMLV/UVT value pair can be chosen and documented.
4. `hybridDeductibleParser.ts` is the best canonical deductible parser foundation.
5. `semanticMatcher.ts` is the best canonical matcher foundation.
6. OCR for scanned PDFs remains out of scope.
7. Controller refactor remains out of scope.
8. Golden-set evaluation remains out of scope; the lightweight per-format-family harness is sufficient.
9. Backwards compatibility with existing RAG/audit/learning flows is mandatory.
10. No new infrastructure will be added.

---

## 13. Related Files

| File | Role in this spec |
|------|-------------------|
| `openspec/changes/extraction-pipeline/proposal.md` | Source proposal |
| `openspec/changes/extraction-pipeline/explore.md` | Exploration context |
| `server/src/controllers/analysisController.ts` | Path selection, metrics emission, insurer resolution |
| `server/src/services/quoteProcessingService.ts` | V2/legacy processing, prompt selection |
| `server/src/services/gemini.ts` | Gemini schemas and V2 schema definition |
| `server/src/schemas/extractionSchemas.ts` | Zod schemas |
| `server/src/services/hybridDeductibleParser.ts` | Canonical deductible parser |
| `server/src/services/semanticMatcher.ts` | Matcher foundation |
| `server/src/services/thesaurusMapper.ts` | Thesaurus loading legacy |
| `server/src/services/coverageNormalizer.ts` | Normalization orchestration legacy |
| `server/src/services/insurerProfileService.ts` | Insurer detection |
| `server/src/services/valueValidationService.ts` | Value-source validation |
| `server/src/services/confidenceScorer.ts` | Confidence scoring |
| `server/src/services/quoteValidator.ts` | Business-rule validation |
| `server/src/services/crossReferenceEngine.ts` | Deductible/coverage cross-reference |
| `server/src/services/reconciliationService.ts` | Clause reconciliation |
| `server/src/config/env.ts` | Environment constants |
| `server/src/config/featureFlags.ts` | Feature flags |
| `server/src/utils/structuredLogger.ts` | Structured logging and metrics sink |
| `data/domains/pyme/taxonomy.json` | Canonical coverage source |
| `data/domains/insurerAliases.json` | Insurer alias source (new) |

---

*Spec generated during SDD Spec phase for project `comparadorpyme`.*
