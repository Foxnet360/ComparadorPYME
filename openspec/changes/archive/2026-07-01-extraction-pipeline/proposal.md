# SDD Proposal: Extraction Pipeline Improvements

## Document Control

| Field | Value |
|-------|-------|
| **Project** | comparadorpyme |
| **Change** | extraction-pipeline |
| **Phase** | sdd-propose |
| **Mode** | Automatic — assumptions are stated explicitly in Section 11. |
| **Artifact store** | openspec + engram (hybrid) |
| **Based on** | `openspec/changes/extraction-pipeline/explore.md` |

---

## 1. Problem Statement

The Comparador PYME extraction pipeline has two parallel implementations: a **V2 multimodal vision path** and a **V1 legacy text path**. The V2 path is more accurate and produces richer per-coverage data, but it is still guarded by the `ENABLE_MULTIMODAL_EXTRACTION` feature flag and shares the controller with the legacy path. As a result, the production default extraction mode is environment-dependent and the system cannot be fully optimized for the V2 path.

Beyond the dual-path uncertainty, the normalization and parsing layers suffer from duplication and inconsistency:

- **Coverage normalization is split** across `thesaurusMapper.ts`, `semanticMatcher.ts`, and `coverageNormalizer.ts`. Each file has its own thresholds, caching strategy, and fallback order, making it hard to tune confidence or debug mismatches.
- **Deductible parsing is regex-heavy** and scattered across `thesaurusMapper.ts`, `deductibleAnalyzer.ts`, `quoteValidator.ts`, `deductibleParser.ts`, and `hybridDeductibleParser.ts`. The partially structured `DeductibleStructure` from `hybridDeductibleParser.ts` is not consumed by all downstream components.
- **Business constants are duplicated and inconsistent.** `SMMLV_VALUE` defaults differ between `env.ts` (1,423,500 COP), `deductibleAnalyzer.ts` (1,300,000 COP), and the README (1,300,000 COP). The 14 canonical PYME coverage categories are repeated in `quoteValidator.ts`, `quoteScorer.ts`, `clauseCoverageValidator.ts`, `inverseCoverageChecker.ts`, and frontend constants.
- **Insurer name detection is brittle.** `analysisController.ts` derives the insurer from the filename via `COTIZACION.*?-\s*`, so any deviation in naming convention causes RAG clause lookups to fail silently.
- **No deterministic grounding.** Extracted values may include `rawTextSnippet`, but there is no enforced contract that the snippet exists in the native text or page map, and `pageNumber` is optional.
- **No structured telemetry.** Success, repair, fallback, and per-format-family failure rates are inferred from ad-hoc logs. We cannot reliably identify which format family or coverage class causes the most manual corrections.

The Explore report concluded that stabilizing V2, unifying normalization and deductible parsing, centralizing constants, and adding telemetry are the highest-impact, feasible improvements. This proposal adopts that scope.

---

## 2. Goals

After this change, the extraction pipeline should:

1. **Default to V2 multimodal extraction** for every non-scanned PDF, with the legacy path kept only as an explicit degraded fallback.
2. **Provide observable extraction health** via structured metrics: success rate, repair/fallback rate, confidence distribution, manual correction rate, and per-format-family accuracy.
3. **Centralize Colombian insurance domain constants** (SMMLV, UVT, canonical coverage list) in a single source of truth consumed by all validation, scoring, and matching modules.
4. **Unify deductible parsing** around a single structured parser (`hybridDeductibleParser.ts`) that supports compound deductibles, SMMLV/UVT references, and percentage-of-sum-insured forms.
5. **Unify coverage normalization** into one matcher with pluggable layers (thesaurus → fuzzy → embeddings → LLM → ontology/graph) and explicit confidence thresholds.
6. **Make insurer name extraction robust** by reading insurer hints from PDF content and maintaining an alias mapping, while keeping filename detection as a fallback.
7. **Enforce deterministic grounding** by validating `rawTextSnippet` and `pageNumber` against the native text/page map before accepting extracted coverage values.
8. **Maintain backwards compatibility** with existing RAG/audit flows, clause reconciliation, learning engine, and comparison report output contracts.

### Measurable targets (assumed baselines)

> These targets assume the current baseline is unmeasured. The first slice (WP1 telemetry) is required to establish the true baseline.

| Metric | Current (assumed) | Target |
|--------|-------------------|--------|
| V2 extraction success rate (non-scanned PDFs) | Unknown, but V2 is feature-flagged | ≥ 92% |
| JSON repair / raw-extraction fallback rate | Unknown | ≤ 8% |
| Manual correction rate per quote | Unknown | ≤ 15% |
| Coverage normalization confidence ≥ 75 | Unknown | ≥ 90% of normalized coverages |
| Insurer name mismatch causing skipped RAG | Unknown | ≤ 5% |
| Deductible parse failure rate | Unknown | ≤ 5% |
| Per-format-family accuracy variance | Unknown | ≤ 10 pp across top 4 families |

---

## 3. Non-Goals / Out of Scope

The following items are explicitly excluded from this proposal, per the user's scope decision:

| Item | Reason | Future trigger |
|------|--------|--------------|
| **OCR for scanned/image PDFs** | Large effort; requires vision OCR path and likely new model integration. README already marks this as non-goal. | When ≥ 20% of uploaded quotes are scanned and business accepts the model cost. |
| **Controller refactor (`analysisController.ts`)** | Large effort; mixing orchestration, routing, and business logic is technical debt but not extraction-specific. | When controller exceeds 1,200 lines or unit-test coverage drops below threshold. |
| **Full golden-set evaluation framework** | Large effort; building ground-truth dataset and CI wiring is out of scope. A lightweight per-format-family harness is included instead. | When telemetry shows a stable baseline and manual labeling budget is approved. |
| **Retiring all feature flags** | Some flags guard experimental/template/graph paths that are not fully validated. We will retire only flags that are always true and safe. | After V2 default is stable for 2+ release cycles. |
| **New LLM provider** | Gemini is the established provider; switching or adding providers is out of scope. | Cost/availability forcing function. |
| **Changes to the comparison/scoring algorithm** | `quoteScorer.ts` and `variableComparisonEngine` are consumers of extraction output, not extraction itself. | Separate SDD if scoring rules need to change. |

---

## 4. Target Users & Situations

| User / Stakeholder | Situation | Benefit |
|--------------------|-----------|---------|
| **Insurance broker (end user)** | Uploads 3–5 PDF quotes from different Colombian insurers to compare coverages. | Faster, more accurate extraction; fewer invented values; fewer manual corrections before presenting to a client. |
| **Operations / QA team** | Reviews why a quote failed or produced low confidence. | Structured metrics and deterministic grounding show exactly which value came from which page. |
| **Engineering team** | Tunes prompts or adds a new insurer format family. | Single matcher and single deductible parser reduce the number of files to touch; telemetry shows impact immediately. |
| **Compliance / audit reviewer** | Traces a coverage value back to the source PDF. | `rawTextSnippet` + `pageNumber` validation creates an auditable link. |
| **Product team** | Decides whether to invest in OCR or new format families. | Per-format-family accuracy metrics inform prioritization with data. |

---

## 5. Business Rules & Constraints

### Colombian insurance domain rules

1. **Currency.** All monetary values are Colombian Pesos (COP) unless explicitly marked otherwise.
2. **SMMLV and UVT references.** Deductibles and insured amounts may be expressed as multiples of SMMLV (Salario Mínimo Mensual Legal Vigente) or UVT (Unidad de Valor Tributario). The parser must resolve these to absolute COP using the current official values.
3. **14 canonical PYME coverage categories.** The system normalizes insurer-specific wording into a fixed canonical list. The list itself is a domain invariant and must be shared by validator, scorer, clause validators, and matchers.
4. **Premium range validation.** Annual premium must fall between 100,000 COP and 500,000,000 COP unless marked as a partial value or sub-limit.
5. **Deductible forms.** Deductibles may be absolute (COP), percentage of sum insured, percentage of claim, N SMMLV/UVT, or a compound expression (e.g., "mayor entre 10% y 5 SMMLV").
6. **Anti-hallucination defaults.** When a value is not present in the PDF, extraction must return `NO ESPECIFICADO` or omit the field, never invent a value.

### Technical constraints

1. **Preserve existing RAG/audit flow.** Clause reconciliation, cross-reference engine, and audit enrichment must continue to receive the same `ParsedQuote` shape.
2. **Preserve learning engine contract.** User corrections saved to `coverage_mappings` must still feed the matcher cache and ontology/graph.
3. **Gemini model configuration remains environment-driven.** We do not hardcode a model version; we only tighten the V2 prompt templates and schema.
4. **Backwards-compatible API.** `/api/analyze` response shape must remain compatible with `ComparisonReport` and `AuditDashboard`.
5. **No new infrastructure.** Redis remains optional; no new databases or queues are introduced.
6. **Zod strictness increase is gradual.** `ZOD_SCHEMA_VERSION=v2` is the target, but strict mode is enabled only after V2 prompts and repair logic prove stable.

---

## 6. In-Scope Work

### WP1: Telemetry & Constants

**Purpose:** Make extraction observable and remove hardcoded domain constants.

| # | Task | Files likely affected |
|---|------|----------------------|
| 1.1 | Add a structured `ExtractionMetrics` event type and emit it at key stages: native text ready, format detected, V2 success/repair/fallback, normalization complete, validation complete, RAG complete. | `server/src/services/quoteProcessingService.ts`, `server/src/controllers/analysisController.ts` |
| 1.2 | Centralize SMMLV and UVT values in `server/src/config/env.ts` (or a new `server/src/config/domainConstants.ts`) and import them in `deductibleAnalyzer.ts`, `hybridDeductibleParser.ts`, `quoteValidator.ts`, and any matcher that resolves SMMLV/UVT. | `server/src/config/env.ts`, `server/src/services/deductibleAnalyzer.ts`, `server/src/services/hybridDeductibleParser.ts`, `server/src/services/quoteValidator.ts` |
| 1.3 | Define the 14 canonical coverage categories in a single JSON file (e.g., `data/domains/pyme/taxonomy.json`) and consume it from `quoteValidator.ts`, `quoteScorer.ts`, `clauseCoverageValidator.ts`, `inverseCoverageChecker.ts`, and coverage normalization. | `data/domains/pyme/taxonomy.json`, `server/src/services/quoteValidator.ts`, `server/src/services/quoteScorer.ts`, `server/src/services/clauseCoverageValidator.ts`, `server/src/services/inverseCoverageChecker.ts`, frontend constants |
| 1.4 | Gradually tighten Zod schemas: remove `passthrough()` from V1 schema, add `.strict()` or explicit `.catchall()` to V2 schema behind `ZOD_SCHEMA_VERSION=v2`, and update `jsonRepair.ts` to emit a metric when repair is used. | `server/src/services/gemini.ts`, `server/src/schemas/extractionSchemas.ts`, `server/src/services/jsonRepair.ts` |

**Verification criteria:**
- Every `/api/analyze` call emits one `ExtractionMetrics` event per quote.
- A grep for hardcoded `1300000` or `1423500` outside `env.ts` / `domainConstants.ts` returns zero results.
- A grep for the canonical coverage list literals returns only the taxonomy file and one loader.

### WP2: V2 Stabilization

**Purpose:** Make V2 multimodal the default extraction path for non-scanned PDFs and harden it.

| # | Task | Files likely affected |
|---|------|----------------------|
| 2.1 | Remove the runtime opt-out for `ENABLE_MULTIMODAL_EXTRACTION` in production: when a PDF is non-scanned and V2 is available, always use V2. Keep the legacy path as an explicit fallback when V2 throws or the PDF is scanned. | `server/src/controllers/analysisController.ts`, `server/src/config/featureFlags.ts` |
| 2.2 | Harden V2 prompt templates: add stronger anti-hallucination instructions, enforce `rawTextSnippet` and `pageNumber` for every coverage and deductible, and add per-format-family negative examples. | `server/src/services/promptBuilder.ts`, `server/src/services/layoutAwarePromptBuilder.ts` |
| 2.3 | Improve `QuoteExtractionSchemaV2`: require `rawTextSnippet` and `pageNumber` on coverage rows, make premium breakdown fields explicit, and add a `formatFamily` field populated from detection. | `server/src/services/gemini.ts`, `server/src/schemas/extractionSchemas.ts` |
| 2.4 | Build a lightweight per-format-family evaluation harness: a script that runs V2 against a folder of labeled fixture PDFs and reports accuracy, fallback rate, and confidence per family. | `server/scripts/evaluateFormatFamily.ts` (new), `tests/fixtures/` |

**Verification criteria:**
- Legacy path is invoked only when `isScanned=true` or V2 throws after retries.
- V2 prompts include the anti-hallucination and grounding rules.
- Evaluation harness runs against at least 2 PDFs per top-4 format family and prints a report.

### WP3: Deductible Unification

**Purpose:** Replace scattered deductible regexes with a single structured parser.

| # | Task | Files likely affected |
|---|------|----------------------|
| 3.1 | Promote `hybridDeductibleParser.ts` to the single canonical deductible parser. Extend it to output a stable `DeductibleStructure` (type, amount, currency, percentage, referenceUnit, referenceMultiplier, compound operator, raw text). | `server/src/services/hybridDeductibleParser.ts` |
| 3.2 | Refactor `deductibleAnalyzer.ts`, `quoteValidator.ts`, and `thesaurusMapper.ts` to call the canonical parser instead of inline regex. Delete or deprecate `deductibleParser.ts` if it is fully superseded. | `server/src/services/deductibleAnalyzer.ts`, `server/src/services/quoteValidator.ts`, `server/src/services/thesaurusMapper.ts`, `server/src/services/deductibleParser.ts` |
| 3.3 | Update cross-reference engine and clause reconciliation to compare parsed `DeductibleStructure` objects instead of raw strings. | `server/src/services/crossReferenceEngine.ts`, `server/src/services/reconciliationService.ts` |
| 3.4 | Add unit tests for edge cases: compound deductibles, SMMLV/UVT references, "NO APLICA", missing values, malformed percentages. | `tests/` |

**Verification criteria:**
- A grep for deductible-related regexes outside `hybridDeductibleParser.ts` returns only thin wrapper calls.
- All existing deductible unit tests pass; new compound-deductible tests pass.
- Cross-reference engine no longer compares deductible strings directly.

### WP4: Coverage Normalization Unification

**Purpose:** Consolidate `thesaurusMapper.ts`, `semanticMatcher.ts`, and `coverageNormalizer.ts` into one matcher.

| # | Task | Files likely affected |
|---|------|----------------------|
| 4.1 | Define a `CoverageMatcher` interface with a single `normalizeBatch(rawCoverages, context)` method and explicit layer order: thesaurus → fuzzy → embeddings → LLM → ontology/graph. | `server/src/services/coverageMatcher/` (new directory) |
| 4.2 | Migrate `semanticMatcher.ts` logic into the new matcher as the primary implementation. Keep thesaurus loading as the fast path, fuzzy matching as the second layer, embeddings as the third, and LLM/ontology as the final fallback. | `server/src/services/semanticMatcher.ts`, `server/src/services/coverageMatcher/` |
| 4.3 | Port any unique behavior from `thesaurusMapper.ts` (built-in fallback thesaurus, deductible normalization, coverage graph seeding) into the matcher or adjacent helpers. | `server/src/services/thesaurusMapper.ts` |
| 4.4 | Port `coverageNormalizer.ts` orchestration (deductible resolution, insured amount derivation, implicit coverage detection) into the matcher pipeline or a thin coordinator. | `server/src/services/coverageNormalizer.ts` |
| 4.5 | Expose a single confidence threshold configuration consumed by all layers. Emit a metric per layer hit. | `server/src/services/coverageMatcher/`, `server/src/config/featureFlags.ts` |

**Verification criteria:**
- Only one `normalizeBatch` implementation is invoked by both V2 and legacy paths.
- The matcher emits metrics showing the hit rate of each layer.
- Existing coverage normalization tests pass without changing expected outputs.

### WP5: Insurer Name Robustness

**Purpose:** Reduce RAG lookup failures caused by brittle filename-based insurer detection.

| # | Task | Files likely affected |
|---|------|----------------------|
| 5.1 | Extract insurer hints from native PDF text: search first page and metadata for known insurer names, NITs, and logos/headers. | `server/src/services/insurerProfileService.ts` |
| 5.2 | Create an alias mapping table (`data/domains/insurerAliases.json`) mapping common variations (e.g., "Seguros Bolívar", "Bolivar", "Bolívar S.A.") to a canonical insurer key. | `data/domains/insurerAliases.json` (new) |
| 5.3 | Use a ranked resolver: (1) explicit content match, (2) alias mapping, (3) filename regex fallback. Return canonical key + display name. | `server/src/services/insurerProfileService.ts`, `server/src/controllers/analysisController.ts` |
| 5.4 | Add a metric for insurer detection source and confidence. | `server/src/services/insurerProfileService.ts` |

**Verification criteria:**
- Insurer detection works when the filename is `quote.pdf` but the PDF content contains a known insurer name.
- Alias mapping covers at least the top 5 Colombian insurers used by PYME clients.
- A metric records `source=content|alias|filename` for each quote.

### WP6: Deterministic Grounding

**Purpose:** Ensure every extracted value can be traced back to the source PDF.

| # | Task | Files likely affected |
|---|------|----------------------|
| 6.1 | Require `rawTextSnippet` and `pageNumber` on all coverage rows and deductibles in V2 schema. For legacy V1, backfill by searching native text when possible. | `server/src/services/gemini.ts`, `server/src/schemas/extractionSchemas.ts`, `server/src/services/quoteProcessingService.ts` |
| 6.2 | Build a `validateGrounding()` function that checks whether the snippet exists in the native page text (fuzzy match within tolerance) and whether the page number is in range. | `server/src/services/valueValidationService.ts` (new helper) |
| 6.3 | Downgrade confidence and flag for manual review when grounding validation fails. Never silently drop the value unless it is clearly hallucinated. | `server/src/services/confidenceScorer.ts`, `server/src/services/quoteValidator.ts` |
| 6.4 | Surface grounding status in the audit dashboard and comparison report so users can click to the relevant page. | `components/AuditDashboard.tsx`, `components/ComparisonReport.tsx` |

**Verification criteria:**
- All V2-extracted coverages include `rawTextSnippet` and `pageNumber`.
- Grounding validation runs for every quote.
- Confidence is penalized when grounding fails; metric is emitted.

---

## 7. High-Level Approach

### Architecture

The pipeline keeps its current shape, but the normalization and parsing internals are consolidated:

```
Frontend upload
  │
  ▼
/api/analyze → analysisController.ts
  │
  ├── 1. Native text extraction + scanned detection (pdfExtractor.ts)
  │
  ├── 2. Insurer detection (insurerProfileService.ts)
  │      Content match → alias map → filename fallback
  │
  ├── 3. Format family detection (formatDetector.ts)
  │
  ├── 4. Extraction
  │      V2 multimodal (default, non-scanned)
  │      └── hardened prompt + strict schema + required grounding fields
  │      Legacy V1 (scanned or V2 failure)
  │
  ├── 5. Deductible parsing (hybridDeductibleParser.ts — canonical)
  │
  ├── 6. Coverage normalization (coverageMatcher — unified)
  │      thesaurus → fuzzy → embeddings → LLM → ontology/graph
  │
  ├── 7. Grounding validation (valueValidationService.ts)
  │      rawTextSnippet + pageNumber verified against native text
  │
  ├── 8. Validation + confidence scoring (quoteValidator.ts, confidenceScorer.ts)
  │
  └── 9. RAG/audit/scoring/persist (unchanged contracts)
```

### Sequence of changes

1. **WP1 first** — telemetry and constants. We cannot set accurate targets without metrics, and other work packages rely on centralized constants.
2. **WP2 and WP6 in parallel** — V2 stabilization and deterministic grounding are tightly coupled (strict schema requires grounding fields; grounding requires V2 output).
3. **WP3 and WP4 in parallel** — deductible unification and coverage normalization unification are independent once constants are centralized.
4. **WP5 after WP1** — insurer alias mapping can be built once the canonical insurer list is stable.
5. **Integration and cleanup** — retire redundant services, remove dead code paths, and run the per-format-family evaluation harness.

### Interaction between work packages

- WP1 telemetry is consumed by WP2, WP4, and WP5 to measure impact.
- WP2's stricter schema feeds WP6's grounding validation.
- WP3's `DeductibleStructure` feeds WP4's coverage normalization and the cross-reference engine.
- WP5's canonical insurer key feeds the RAG cross-reference engine unchanged.
- WP4's unified matcher must still feed the learning engine (`coverage_mappings`) so user corrections continue to improve matching.

---

## 8. Success Metrics

### Primary outcome metrics

| Metric | Definition | Measurement |
|--------|------------|-------------|
| **Extraction success rate** | % of non-scanned PDFs that produce a valid `ParsedQuote` without falling back to raw/repair/legacy | `ExtractionMetrics` event |
| **Repair/fallback rate** | % of quotes that required JSON repair, raw extraction, or legacy fallback | `ExtractionMetrics` event |
| **Manual correction rate** | % of quotes where the user edits at least one extracted field before saving | Frontend correction event or `coverage_mappings` writes |
| **Coverage normalization confidence ≥ 75** | % of normalized coverages whose matcher confidence is ≥ 75 | `ExtractionMetrics` event |
| **Per-format-family accuracy** | % of correctly extracted coverages per format family from the evaluation harness | `scripts/evaluateFormatFamily.ts` |

### Secondary health metrics

| Metric | Definition |
|--------|------------|
| **Deductible parse failure rate** | % of deductible strings that fail to produce a `DeductibleStructure` |
| **Insurer name mismatch rate** | % of quotes where detected insurer differs from filename-derived insurer |
| **Grounding validation failure rate** | % of extracted values that fail snippet/page validation |
| **Confidence score distribution** | Histogram of final confidence scores per quote |
| **V2 adoption rate** | % of non-scanned quotes processed by V2 vs legacy |

### Targets after full implementation

| Metric | Target |
|--------|--------|
| Extraction success rate | ≥ 92% |
| Repair/fallback rate | ≤ 8% |
| Manual correction rate | ≤ 15% |
| Coverage normalization confidence ≥ 75 | ≥ 90% of coverages |
| Deductible parse failure rate | ≤ 5% |
| Insurer name mismatch rate | ≤ 5% |
| Grounding validation failure rate | ≤ 5% |
| V2 adoption rate | ≥ 95% of non-scanned PDFs |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Regression in legacy path** | Medium | High | Keep legacy path untouched except for the matcher/deductible calls; add characterization tests before changes. |
| **Prompt instability after hardening** | Medium | High | Roll out hardened prompts behind a feature flag first; A/B with the evaluation harness; monitor fallback rate. |
| **Backwards incompatibility in `ParsedQuote` shape** | Low | High | Keep output contract stable; only add optional fields (`groundingStatus`, `detectedInsurerSource`). |
| **Zod strictness causes avoidable failures** | Medium | Medium | Enable strict mode only after repair logic is improved; emit metric on every strict failure; allow passthrough fallback for one release cycle. |
| **Coverage matcher unification changes thresholds** | Medium | Medium | Preserve existing default thresholds as starting point; expose configuration; measure confidence delta on fixture set. |
| **Insurer alias map becomes stale** | Low | Medium | Store aliases in a JSON file with a simple update process; log unknown insurer names for manual review. |
| **Feature-flag cleanup removes a needed path** | Low | High | Only retire flags that are documented as always true and covered by tests; keep flags that guard experimental/template/graph paths. |
| **Performance degradation from grounding validation** | Low | Medium | Grounding check is a local fuzzy search over in-memory page text; cap snippet length; skip if native text is empty. |
| **Team disruption from large refactor** | Medium | Medium | Slice delivery (see Section 10); merge each slice independently; keep PRs under 400 changed lines where possible. |

---

## 10. Suggested Slices / Phases for Implementation

Each slice is designed to be deployable independently and to provide value before the next slice begins.

### Slice 1: Telemetry & Domain Constants (WP1)

**Boundary:** Add metrics emission and centralize SMMLV/UVT/canonical categories. No behavior changes.

**Deliverables:**
- `ExtractionMetrics` event type and emission points.
- `server/src/config/domainConstants.ts`.
- `data/domains/pyme/taxonomy.json`.
- Updated imports in `deductibleAnalyzer.ts`, `quoteValidator.ts`, `quoteScorer.ts`, `clauseCoverageValidator.ts`, `inverseCoverageChecker.ts`.

**Verification:**
- Metrics appear in logs for every quote.
- No hardcoded SMMLV/UVT/canonical literals outside config files.

### Slice 2: V2 Default & Grounding Schema (WP2 + WP6 schema)

**Boundary:** Make V2 the default for non-scanned PDFs; require `rawTextSnippet` and `pageNumber` in V2 schema.

**Deliverables:**
- `ENABLE_MULTIMODAL_EXTRACTION` opt-out removed from production path; legacy path remains fallback.
- Hardened V2 prompts with anti-hallucination and grounding rules.
- `QuoteExtractionSchemaV2` requires `rawTextSnippet` and `pageNumber`.

**Verification:**
- Non-scanned PDFs use V2.
- V2 outputs include grounding fields.
- Fallback rate is measured and reported.

### Slice 3: Deductible Unification (WP3)

**Boundary:** Single canonical deductible parser used everywhere.

**Deliverables:**
- Extended `DeductibleStructure` and canonical parser.
- Refactored consumers in `deductibleAnalyzer.ts`, `quoteValidator.ts`, `thesaurusMapper.ts`.
- Deleted or deprecated `deductibleParser.ts`.
- Unit tests for compound and reference-unit deductibles.

**Verification:**
- All deductible regexes live in the canonical parser.
- Cross-reference engine compares structured deductibles.
- Tests pass.

### Slice 4: Coverage Normalization Unification (WP4)

**Boundary:** Single matcher invoked by both V2 and legacy paths.

**Deliverables:**
- `CoverageMatcher` interface and implementation.
- Migrated logic from `semanticMatcher.ts`, `thesaurusMapper.ts`, `coverageNormalizer.ts`.
- Layer hit-rate metrics.
- Unified confidence thresholds.

**Verification:**
- Only one matcher is called.
- Existing normalization tests pass with the same expected outputs.
- Layer metrics appear in logs.

### Slice 5: Insurer Robustness & Grounding Validation (WP5 + WP6 validation)

**Boundary:** Robust insurer detection and snippet/page validation.

**Deliverables:**
- Insurer content extraction and alias mapping.
- `validateGrounding()` function.
- Confidence penalty for grounding failures.
- Audit dashboard grounding indicator.

**Verification:**
- Insurer detected from content when filename is generic.
- Grounding validation runs per quote.
- Confidence is penalized appropriately.

### Slice 6: Cleanup, Evaluation Harness & Zod Strictness (WP2 evaluation + WP1 strictness)

**Boundary:** Remove dead code, enable strict Zod, and add per-format-family evaluation.

**Deliverables:**
- Retire redundant services and always-true flags.
- `ZOD_SCHEMA_VERSION=v2` enabled by default.
- `scripts/evaluateFormatFamily.ts`.
- Updated documentation.

**Verification:**
- No references to deprecated `deductibleParser.ts` or redundant matchers.
- Evaluation harness runs on fixture set.
- All tests pass.

---

## 11. Open Questions / Assumptions

Because this proposal was generated in **automatic mode**, the following assumptions are explicitly stated:

1. **V2 multimodal is technically ready to be the default.** We assume the existing V2 path is already more accurate than V1 and only needs hardening, not a rewrite.
2. **The 14 canonical PYME categories are stable.** We assume the canonical list will not change during this work; if it does, only the taxonomy file needs updating.
3. **Current SMMLV/UVT values can be sourced once and reused.** We assume a single authoritative value can be chosen for each constant and documented.
4. **`hybridDeductibleParser.ts` is the best foundation.** We assume this parser already handles the most deductible forms and only needs extension, not replacement.
5. **`semanticMatcher.ts` is the best foundation for normalization.** We assume the 4-layer semantic matcher is the most capable implementation and should absorb the thesaurus and normalizer logic.
6. **OCR remains out of scope.** Scanned PDFs will continue to use the legacy path or fail gracefully; no OCR model is added.
7. **Controller refactor remains out of scope.** We will touch `analysisController.ts` only to change extraction path selection and metrics emission, not to restructure it.
8. **Golden-set evaluation remains out of scope.** The per-format-family harness will use whatever labeled fixtures exist; building a large labeled dataset is not part of this proposal.
9. **Backwards compatibility is mandatory.** The public API and downstream RAG/audit flows must not break.
10. **No new infrastructure.** We will not add databases, queues, or caching services beyond what already exists.

---

## 12. Related Files

| File | Relevance |
|------|-----------|
| `openspec/changes/extraction-pipeline/explore.md` | Source exploration report |
| `server/src/controllers/analysisController.ts` | Orchestrator; path selection and metrics emission |
| `server/src/services/quoteProcessingService.ts` | Multimodal + legacy processing |
| `server/src/services/gemini.ts` | Gemini interactions and schemas |
| `server/src/services/pdfExtractor.ts` | Native text and scanned detection |
| `server/src/services/formatDetector.ts` | Format family detection |
| `server/src/services/promptBuilder.ts` | V2 prompt templates |
| `server/src/services/coverageNormalizer.ts` | Coverage normalization orchestration |
| `server/src/services/thesaurusMapper.ts` | Thesaurus-based matching |
| `server/src/services/semanticMatcher.ts` | 4-layer semantic matcher |
| `server/src/services/hybridDeductibleParser.ts` | Structured deductible parser |
| `server/src/services/deductibleAnalyzer.ts` | Deductible analysis |
| `server/src/services/quoteValidator.ts` | Business-rule validation |
| `server/src/services/confidenceScorer.ts` | Confidence scoring |
| `server/src/services/insurerProfileService.ts` | Insurer detection |
| `server/src/services/valueValidationService.ts` | Value-source validation |
| `server/src/config/env.ts` | Environment constants |
| `server/src/config/featureFlags.ts` | Feature flags |
| `data/domains/pyme/taxonomy.json` | Proposed canonical coverage source |
| `data/domains/insurerAliases.json` | Proposed insurer alias source |

---

*Proposal generated during SDD Propose phase for project `comparadorpyme`.*
