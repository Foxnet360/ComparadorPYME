# Apply Progress: Close the extraction-quality gap with direct-LLM comparison table

## PR Boundary

- **PR 5 of 5** in a `stacked-to-main` chain.
- **Scope**: Evaluation harness (`extractionQualityEval.ts`) that compares the
  production tool path against a direct-LLM baseline; fixtures under
  `server/src/evaluation/fixtures/extraction-quality/`; regression test
  `server/src/evaluation/__tests__/extractionQuality.test.ts`; and documentation
  for `USE_UNIFIED_ENGINE` usage and rollback.
- **Status**: Completed.
- **Changed lines**: ~883 additions in new evaluation files + ~44 modified
  lines in `featureFlags.ts`, `tasks.md`, and `apply-progress.md`. This is above
  the original ~150-line forecast because the baseline runner needs its own
  Gemini File API upload/call/cleanup path; this slice should be flagged as
  `size:exception` for PR 5 unless the maintainer wants to split it further.

## Completed Tasks

### Phase 1: Foundation (completed in PR 1)

- [x] 1.1 RED: Write Vitest for `FeatureFlagManager` defaulting `useUnifiedComparisonEngine=true`, env alias `USE_UNIFIED_ENGINE`, and no hardcoded override.
- [x] 1.2 GREEN: Update `server/src/config/featureFlags.ts` to remove the hardcoded `false` override, add `USE_UNIFIED_ENGINE` alias, and default to `true`.
- [x] 1.3 RED: Write test asserting `FlatComparisonSchema` accepts rows × insurers shape and rejects nested canonical schema.
- [x] 1.4 GREEN: Add `FlatComparisonSchema` to `server/src/services/unifiedComparison/comparisonSchema.ts`; keep legacy schema export.
- [x] 1.5 RED: Write test asserting `comparisonPromptBuilder` output contains the four row labels and JSON schema snippet.
- [x] 1.6 GREEN: Rewrite `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` with the flat-table prompt.

### Phase 2: Flat Table Parser (TDD) (completed in PR 2)

- [x] 2.1 RED: Add `flatTableParser.test.ts` covering Markdown, CSV, JSON, key-value, missing rows, and extra rows.
- [x] 2.2 GREEN: Create `server/src/services/unifiedComparison/flatTableParser.ts` with format detection, insurer/row normalization, and `extraRows`.
- [x] 2.3 REFACTOR: Centralize accent-tolerant row-label mapping and ensure missing rows emit `notFound: true`.

### Phase 3: Unified Engine Wiring (TDD) (completed in PR 3)

- [x] 3.1 RED: Add tests for `unifiedComparisonEngine.compare` retrying ≤2 times on parse failure and throwing structured `UnifiedComparisonError`.
- [x] 3.2 GREEN: Wire new prompt builder and flat parser into `server/src/services/unifiedComparison/unifiedComparisonEngine.ts`; implement correction prompt retry.
- [x] 3.3 REFACTOR: Return `FlatComparisonResult` with metadata and warnings; expose failure reason for the adapter.

### Phase 4: Fallback Batch Service (TDD) (completed in PR 4)

- [x] 4.1 RED: Add tests for `processQuotesBatch` handling sequential/concurrent processing, timeouts, and error placeholders.
- [x] 4.2 GREEN: Extract batch logic from `analysisController` into `server/src/services/quoteProcessingService.ts` as exported `processQuotesBatch(pdfPaths, options)`.
- [x] 4.3 REFACTOR: Remove any internal `USE_UNIFIED_ENGINE` checks from the per-quote pipeline.

### Phase 5: Adapter Routing & Integration (TDD) (completed in PR 4)

- [x] 5.1 RED: Add adapter tests for unified-first routing, explicit disable, fallback logging with reason, and `ComparisonAdapterResult` envelope.
- [x] 5.2 GREEN: Implement `comparisonEngineAdapter.generateComparison` to route by flag, call unified engine, fallback to `processQuotesBatch`, and transform to `MatrixRow[]`.
- [x] 5.3 GREEN: Refactor `server/src/controllers/analysisController.ts` to use the adapter as the single router; remove inline flag checks and duplicate fallback.
- [x] 5.4 REFACTOR: Update `server/src/services/unifiedComparison/__tests__/fallback.test.ts` mocks to assert adapter-driven fallback with reason.

### Phase 6: Evaluation Harness (TDD) (completed in PR 5)

- [x] 6.1 RED: Write `server/src/evaluation/__tests__/extractionQuality.test.ts` asserting `matchRate >= 0.90` and `fallbackRate <= 0.10`, with skip guard when fixtures/API are missing.
- [x] 6.2 GREEN: Create `server/src/evaluation/extractionQualityEval.ts` harness comparing direct-chat baseline to tool path via adapter.
- [x] 6.3 GREEN: Add fixtures under `server/src/evaluation/fixtures/extraction-quality/` with 3-quote metadata and persisted baseline snapshot.

### Phase 7: Regression & Cleanup (completed in PR 5)

- [x] 7.1 Run `npm run typecheck:backend` and fix TypeScript errors across modified files.
- [x] 7.2 Run `npm test` and ensure the existing Vitest suite plus new tests pass.
- [x] 7.3 Document `USE_UNIFIED_ENGINE` usage and rollback procedure in relevant config/README comments.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `server/src/config/__tests__/featureFlags.test.ts` | Unit | ✅ 6/6 passing | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean constants |
| 1.3/1.4 | `server/src/services/unifiedComparison/__tests__/comparisonSchema.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases | ✅ Extracted sub-schemas |
| 1.5/1.6 | `server/src/services/unifiedComparison/__tests__/comparisonPromptBuilder.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases | ✅ FLAT_ROW_LABELS constant |
| 2.1/2.2 | `server/src/services/unifiedComparison/__tests__/flatTableParser.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 9 cases | ✅ Extracted helpers |
| 2.3 | `server/src/services/unifiedComparison/__tests__/flatTableParser.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 2 added | ✅ Centralized row-label map |
| 3.1/3.2 | `server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts` | Unit | ✅ 32/32 passing | ✅ Written | ✅ Passed | ✅ 5 cases | ✅ UnifiedComparisonError + flat parser wiring |
| 3.3 | `server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts` | Unit | ✅ 32/32 passing | ✅ Written | ✅ Passed | ✅ 2 cases | ✅ Metadata/warnings return + cache generic typing |
| 4.1/4.2 | `server/src/services/__tests__/quoteProcessingService.batch.test.ts` | Unit | ✅ existing suite green | ✅ Written | ✅ Passed | ✅ 7 cases | ✅ Processor injection for testability |
| 4.3 | N/A — no internal flag check existed | — | — | — | — | — | — |
| 5.1/5.2 | `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | Unit | ✅ existing suite green | ✅ Written | ✅ Passed | ✅ 7 cases | ✅ Extracted `matrixTransformer.ts` |
| 5.3 | `tests/server/analysisController-path-selection.test.ts` (rewritten) | Integration | ✅ existing suite green | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Controller simplified, duplicate fallback removed |
| 5.4 | `server/src/services/unifiedComparison/__tests__/fallback.test.ts` | Unit | ✅ existing suite green | ✅ Written | ✅ Passed | ✅ 4 cases | ✅ Adapter-driven fallback assertions |
| 6.1/6.2 | `server/src/evaluation/__tests__/extractionQuality.test.ts` | Unit (+ integration skip guard) | N/A (new) | ✅ Written | ✅ Passed | ✅ 6 cases (match, mismatch, alignment, missing insurer, matrix→flat, missing rows) | ✅ Extracted pure matcher functions |
| 6.3 | `server/src/evaluation/__tests__/extractionQuality.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ Fixture load + snapshot round-trip | ✅ Snapshot path resolution helper |
| 7.3 | N/A — documentation/comments only | Docs | ✅ existing suite green | ➖ N/A | ➖ N/A | ➖ N/A | ✅ Comments added to `featureFlags.ts`; fixture README created |

### Test Summary

- **Total tests written**: 77 (19 in PR 1 + 14 in PR 2 + 6 in PR 3 + 26 in PR 4 + 12 in PR 5)
- **Total tests passing**: 77
- **Layers used**: Unit (72), Integration (5)
- **Approval tests**: None — no refactoring of existing behavior without new tests
- **Pure functions created**: 18+ (format detection, label normalization, CSV/Markdown/JSON/KV parsers, cell builder, `flatResultToMatrixRows`, `quotesToMatrixRows`, `normalizeCellValue`, `compareCellValues`, `calculateMatchRate`, `matrixRowsToFlatResult`)

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `server/src/evaluation/extractionQualityEval.ts` | Created | Harness: direct-LLM baseline runner, tool-path runner via adapter, cell-level matcher, and `MatrixRow[]` → `FlatComparisonResult` adapter. |
| `server/src/evaluation/__tests__/extractionQuality.test.ts` | Created | Unit tests for matcher + matrix conversion; integration regression test with skip guard when `GEMINI_API_KEY` or fixtures are missing. |
| `server/src/evaluation/fixtures/extraction-quality/quote-set.json` | Created | Fixture metadata: 3 quote PDF paths and baseline snapshot path. |
| `server/src/evaluation/fixtures/extraction-quality/baseline-snapshot.json` | Created | Persisted direct-LLM baseline snapshot for reproducible comparisons. |
| `server/src/evaluation/fixtures/extraction-quality/README.md` | Created | Operator docs: how to place PDFs, run/update the regression, and rollback with `USE_UNIFIED_ENGINE`. |
| `server/src/config/featureFlags.ts` | Modified | Added usage/rollback comments for `USE_UNIFIED_ENGINE` and the legacy alias. |

## Verification

- `npm run typecheck:backend` → no errors
- `npm test` → 1051 passed, 8 skipped, 0 failed

## Deviations from Design

- The baseline runner (`runBaselineComparison`) re-implements the Gemini File API
  upload/call/cleanup flow instead of reusing `unifiedComparisonEngine.compare`.
  This is required because the baseline must be a direct-LLM call, not the
  production tool path.
- The harness compares the adapter's `MatrixRow[]` output by first converting it
  back to `FlatComparisonResult` (`matrixRowsToFlatResult`). The design contract
  showed both `baseline` and `tool` as `FlatComparisonResult`; the conversion
  preserves that contract and lets the matcher stay generic.
- The fixture PDFs are intentionally not committed. The regression test skips
  when the real quote PDFs or `GEMINI_API_KEY` are missing, matching the
  project's policy of not running paid API calls in CI without credentials.

## Issues Found

- PR 5 actual changed lines (~927) exceed the original ~150-line forecast. The
  excess comes from the baseline runner's File API logic and the comprehensive
  matcher tests. This slice should be flagged as `size:exception` for PR 5.
- No functional issues; full suite remains green.

## Remaining Tasks

None — all planned tasks for the `extraction-quality-gap` change are complete.

## Next PR

- No further PRs planned for this change.
- Recommended next phase: `sdd-verify` → `sdd-archive`.

## Risks

- PR 5 is over the 400-line review budget. Recommend `size:exception` or
  splitting the baseline runner into a separate slice if review load matters.
- The regression test requires real quote PDFs and a `GEMINI_API_KEY`. CI
  without those credentials will skip it, so the test cannot catch regressions
  in environments that lack the fixtures/key.
- The simplified `matrixRowsToComparisonReport` output (from PR 4) no longer
  includes RAG/scoring/narratives. Downstream consumers depending on those
  enriched fields may need a future enhancement.
