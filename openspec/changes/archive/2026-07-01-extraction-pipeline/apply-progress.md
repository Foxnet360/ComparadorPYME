# SDD Apply Progress: Extraction Pipeline Improvements

## PR1 — Telemetry & Domain Constants (COMPLETED)

### What was already in place
- `server/src/types/extractionMetrics.ts` with `ExtractionMetrics`, `ExtractionResult`, `MatchLayer`, `InsurerDetectionSource`, `GroundingStatus`.
- `server/src/services/extractionMetrics.ts` emitter with merging, default sink, and safe fallback.
- `server/src/config/domainConstants.ts` with `getDomainConstants`, `getCanonicalCoverageNames`, `getCanonicalCoverageName`, `resolveValueToCOP`, `getPremiumRange`.
- `data/domains/pyme/taxonomy.json` with SMMLV/UVT metadata and 14 canonical categories.
- `server/src/config/env.ts` consistency check between env and taxonomy.
- `server/src/schemas/extractionSchemas.ts` `ZOD_SCHEMA_VERSION` gating (`v1` strips, `v2` rejects unknown keys).
- `server/src/services/jsonRepair.ts` `onRepairUsed` callback.
- Metrics emission wired into `analysisController.ts` and `quoteProcessingService.ts`.
- Unit tests under `tests/server/` for metrics, constants, consistency, repair telemetry, and Zod strictness.

### Changes made in this PR
1. Centralized remaining hardcoded canonical coverage lists:
   - `server/src/utils/analysisValidator.ts` now imports `PLANTILLA_ITEMS` from `getCanonicalCoverageNames('pyme')`.
   - `server/src/services/matrixTransformer.ts` now imports `PLANTILLA_ITEMS` from `getCanonicalCoverageNames('pyme')`.
   - `components/UnifiedCoverageMatrix.tsx` now imports `PLANTILLA_ITEMS` from `../constants` (which reads `taxonomy.json`).
2. Centralized premium range validation:
   - `server/src/services/quoteValidator.ts` now uses `getPremiumRange()` from `domainConstants.ts` instead of hardcoded `PREMIUM_MIN` / `PREMIUM_MAX`.
3. Aligned inconsistent test defaults:
   - `server/src/routes/__tests__/reviewQueue.integration.test.ts`: SMMLV fallback from `1300000` to `1423500`.
   - `server/src/schemas/__tests__/domainBundleSchema.test.ts`: `salaryValue2024` from `1300000` to `1423500`.

### Verification
- `npx vitest run tests/server/extractionMetrics.test.ts tests/server/domainConstants.test.ts tests/server/env-taxonomy-consistency.test.ts tests/server/jsonRepair-telemetry.test.ts tests/server/zod-strictness.test.ts server/src/services/__tests__/quoteValidator.test.ts server/src/services/__tests__/matrixTransformer.test.ts server/src/schemas/__tests__/domainBundleSchema.test.ts` → **70 tests passed**.
- `cd server && npx tsc --noEmit` → **passed**.
- `npx vite build` → **passed**.

### Notes / follow-up
- `components/UnifiedCoverageMatrix.tsx` still has `CATEGORY_CONFIGS` with hardcoded canonical names and header labels; this is visual configuration and was left untouched to avoid UI regressions. It can be generated from taxonomy in a future UI-focused slice if desired.
- `server/src/constants/schemas.ts` still lists canonical names in a static LLM prompt description. Generating it dynamically would add a runtime dependency on taxonomy loading into a static schema object; left as-is for stability.

## PR2 — V2 Default & Grounding Schema (COMPLETED)

### What was already in place
- `server/src/config/featureFlags.ts`: `enableMultimodalExtraction` defaults to `true`; `ENABLE_MULTIMODAL_EXTRACTION=false` kept as emergency escape.
- `server/src/services/quoteProcessingService.ts`:
  - `ProcessQuoteOptions` already required `quoteId` and `metrics`.
  - `shouldUseV2(file, nativeTextResult)` already chose V2 for non-scanned PDFs and legacy for scanned/disabled.
  - Fallback ladder already implemented: strict validation → retry up to 2× → raw extraction → legacy V1 → failed placeholder.
  - Metrics for `success`, `success_after_repair`, `raw_extraction_fallback`, and `legacy_fallback` already emitted.
- `server/src/controllers/analysisController.ts` already extracted native text first and called `shouldUseV2` to pick the path.
- `server/src/services/promptBuilder.ts` and `server/src/services/layoutAwarePromptBuilder.ts` already appended `GROUNDING RULES` and `ANTI-HALLUCINATION RULES` blocks.
- `server/src/services/gemini.ts` and `server/src/schemas/extractionSchemas.ts` already required `rawTextSnippet` / `pageNumber` and included `formatFamily` in the V2 schema.

### Changes made in this PR
1. Added PR2-focused tests:
   - `tests/server/shouldUseV2.test.ts` — verifies V2 default, scanned PDF → legacy, disabled V2 → legacy.
   - `tests/server/promptBuilder-grounding.test.ts` — verifies grounding/anti-hallucination clauses in every format family and in template prompts.
   - `tests/server/gemini-schema-v2.test.ts` — verifies `rawTextSnippet` / `pageNumber` are required and `formatFamily` is present in strict mode.
2. Updated existing test expectation:
   - `server/src/services/__tests__/quoteProcessingService.test.ts`: `selectExtractionPrompt` now passes `formatFamily` to `buildPromptForFamily`, so the assertion was updated.

### Verification
- `npx vitest run tests/server/shouldUseV2.test.ts tests/server/promptBuilder-grounding.test.ts tests/server/gemini-schema-v2.test.ts server/src/services/__tests__/quoteProcessingService.metrics.test.ts server/src/services/__tests__/quoteProcessingService.test.ts` → **20 tests passed**.
- `cd server && npx tsc --noEmit` → **passed**.
- `npx vite build` → **passed**.

## PR3 — Deductible Unification (COMPLETED)

### What was already in place
- `server/src/services/hybridDeductibleParser.ts` already existed as the canonical parser with cache-first, regex-first, LLM-fallback flow and telemetry.
- `server/src/services/deductibleFormatter.ts` already provided display formatting, semantic equality, and clause-text extraction helpers.
- `server/src/services/deductibleParser.ts` was already a deprecated backward-compatible proxy to `hybridDeductibleParser`.
- `server/src/services/deductibleAnalyzer.ts`, `crossReferenceEngine.ts`, and `reconciliationService.ts` already consumed `hybridDeductibleParser` output.

### Changes made in this PR
1. Hardened the canonical deterministic parser (`hybridDeductibleParser.ts`):
   - Percentage regex now accepts comma decimal separator (`12,5%`).
   - Compound join parser now recognizes explicit qualifiers such as `mayor entre ...` / `menor entre ...` before the percentage.
   - Min/max clause parsing now defaults to `COP` when a `$` symbol is present and no unit is specified.
   - Normalized amount computation fixed so `fixed`/`SMMLV`/`UVT` components act as floors in `greater_of`/`sum` compounds and as caps in `lesser_of` compounds; standalone amounts remain min=max.
2. Added/aligned PR3-focused tests:
   - `tests/server/hybridDeductibleParser.test.ts` — 20 tests covering compound operators, reference units, percentage/NA forms, malformed inputs, and `parseSync`.
   - `tests/server/deductibleFormatter.test.ts` — display formatting, context extraction, clause snippet extraction, semantic equality.
   - `tests/server/quoteValidator-deductible.test.ts` — deductible validation in quote context.
   - `tests/server/deductibleAnalyzer-integration.test.ts` — end-to-end deductible amount calculation using the canonical parser.
   - `tests/server/crossReference-deductible.test.ts` — structured deductible comparison across quote and clause; added missing `ragRetrievalService` mock so the test suite runs.

### Verification
- `npx vitest run tests/server` → **95 tests passed**.
- `cd server && npx tsc --noEmit` → **passed**.
- `npx vite build` → **passed**.

### Notes / follow-up
- `server/src/services/reconciliationService.ts` still duplicates some normalization logic in `normalizeDeductible`. It is functionally aligned with the canonical parser, but could be refactored to reuse `computeNormalized` in a future cleanup slice.
- `deductibleParser.ts` remains as a deprecated proxy; safe to remove once all legacy callers are confirmed migrated.

## PR4 — Coverage Normalization Unification (COMPLETED)

### What was already in place
- `server/src/services/coverageNormalizer.ts` already unified raw-to-canonical mapping with a layered pipeline (thesaurus exact → fuzzy → embedding → LLM → graph → ontology).
- `server/src/services/thesaurusMapper.ts` already provided thesaurus loading from markdown and graph seeding.
- `server/src/services/semanticMatcher.ts` already provided embedding-based matching and category name resolution.
- `data/domains/pyme/taxonomy.json` and `server/src/config/domainConstants.ts` already supplied the canonical category list.

### Changes made in this PR
- No code changes required. The existing architecture already satisfies the unification goals: a single `coverageNormalizer` entry point, reusable `thesaurusService`, and centralized canonical names from `taxonomy.json`/`domainConstants.ts`.

### Verification
- `npx vitest run server/src/services/__tests__/coverageNormalizer.graph.test.ts server/src/services/__tests__/thesaurusMapper.test.ts server/src/services/__tests__/thesaurusMapper.graph.test.ts server/src/services/__tests__/thesaurusExtended.test.ts` → **45 tests passed**.
- `cd server && npx tsc --noEmit` → **passed**.

## PR5 — Insurer Detection & Grounding Validation (COMPLETED)

### What was already in place
- `server/src/services/insurerNameNormalizer.ts` already mapped raw insurer names to canonical insurers.
- `server/src/services/quoteProcessingService.ts` already emitted `insurerDetectionSource` in extraction metrics.
- V2 schema already required `rawTextSnippet` and `pageNumber` grounding fields.
- `analysisController.ts` already selected V2 vs legacy based on scan detection.

### Changes made in this PR
- No code changes required. The insurer normalization and grounding schema were already implemented and covered by tests.

### Verification
- `npx vitest run tests/server/analysisController-path-selection.test.ts server/src/services/__tests__/insurerNameNormalizer.test.ts` → passed.
- `cd server && npx tsc --noEmit` → **passed**.

## PR6 — Cleanup, Benchmarks & Evaluation Harness (COMPLETED)

### What was already in place
- `server/src/services/evaluationHarness.ts` and `server/src/scripts/runEvaluation.ts` already provided golden-set evaluation.
- `server/src/services/__tests__/quoteProcessingService.evaluation.test.ts` already wrapped the pipeline in a `PipelineRunner`.
- `deductibleBenchmarks.ts` already evaluated deductible structures against coverage-specific benchmarks.

### Changes made in this PR
- No code changes required. The evaluation harness and benchmarks were already wired and tested.

### Verification
- `npx vitest run server/src/services/__tests__/evaluationHarness.test.ts server/src/services/__tests__/runEvaluation.test.ts server/src/services/__tests__/quoteProcessingService.evaluation.test.ts` → **22 tests passed**.
- `cd server && npx tsc --noEmit` → **passed**.

## SDD Verify & Archive

### Verification summary
- **Core SDD tests (`tests/server`)**: **95 tests passed**.
- **Backend typecheck**: `cd server && npx tsc --noEmit` → **passed**.
- **Frontend production build**: `npx vite build` → **passed**.
- **Full test suite**: `npx vitest run` → 961 passed, 30 failed, 3 skipped. The 30 failures are environmental/infra-related (missing `GEMINI_API_KEY`, incomplete Supabase config, missing `./test-quotes` directory, broken `redisCache` require path in `unifiedComparison` tests) and are outside the scope of the extraction-pipeline SDD.

### Archived artifacts
- Proposal, spec, design, and task artifacts stored in `openspec/changes/extraction-pipeline/`.
- This progress log archived at `openspec/changes/extraction-pipeline/apply-progress.md`.
- Memory persisted in Engram under project `comparadorpyme`.
