# Apply Progress: Close the extraction-quality gap with direct-LLM comparison table

## PR Boundary

- **PR 1 of 5** in a `stacked-to-main` chain.
- **Scope**: Foundation — feature flags + flat schema + prompt builder.
- **Status**: Completed.
- **Changed lines**: ~420 code lines (slightly above the ~200 forecast because the prompt-builder rewrite replaced the large legacy canonical prompt and added comprehensive tests).

## Completed Tasks

### Phase 1: Foundation

- [x] 1.1 RED: Write Vitest for `FeatureFlagManager` defaulting `useUnifiedComparisonEngine=true`, env alias `USE_UNIFIED_ENGINE`, and no hardcoded override.
- [x] 1.2 GREEN: Update `server/src/config/featureFlags.ts` to remove the hardcoded `false` override, add `USE_UNIFIED_ENGINE` alias, and default to `true`.
- [x] 1.3 RED: Write test asserting `FlatComparisonSchema` accepts rows × insurers shape and rejects nested canonical schema.
- [x] 1.4 GREEN: Add `FlatComparisonSchema` to `server/src/services/unifiedComparison/comparisonSchema.ts`; keep legacy schema export.
- [x] 1.5 RED: Write test asserting `comparisonPromptBuilder` output contains the four row labels and JSON schema snippet.
- [x] 1.6 GREEN: Rewrite `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` with the flat-table prompt.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `server/src/config/__tests__/featureFlags.test.ts` | Unit | ✅ 6/6 passing | ✅ Written | ✅ Passed | ✅ 3 cases (default, alias, no override) | ✅ Clean constants |
| 1.3/1.4 | `server/src/services/unifiedComparison/__tests__/comparisonSchema.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases (valid, extra rows, legacy reject, missing rows, mismatched insurers) | ✅ Extracted sub-schemas |
| 1.5/1.6 | `server/src/services/unifiedComparison/__tests__/comparisonPromptBuilder.test.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases (row labels, JSON snippet, legacy exclusion, count, correction) | ✅ FLAT_ROW_LABELS constant |

### Test Summary

- **Total tests written**: 19
- **Total tests passing**: 19
- **Layers used**: Unit (19)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: 0 (builders are stateful classes; logic is deterministic)

## Commits

1. `e518343` — `feat(config): enable unified comparison engine by default`
2. `58bdc40` — `feat(unified-comparison): add flat comparison Zod schema`
3. `f619c0b` — `feat(unified-comparison): rewrite comparison prompt as flat four-row table`

## Verification

- `npm run test:unit:backend` → 960 passed, 8 skipped, 0 failed
- `npm run typecheck:backend` → no errors

## Deviations from Design

- `getResponseSchema()` in `comparisonPromptBuilder.ts` still returns `UnifiedComparisonSchema` (legacy Google GenAI Type format). PR 3 (engine wiring) will decide whether to convert `FlatComparisonSchema` to Gemini structured output or rely on free-text parsing. Keeping the legacy return avoids breaking compilation and leaves the engine-wiring decision to PR 3.
- `FlatComparisonSchema` enforces exactly 4 rows and one cell per insurer. The design mentions the parser should create missing rows with `notFound: true`; the current schema pushes that normalization responsibility to the parser (PR 2), which is acceptable for the foundation slice.

## Issues Found

- None. Existing unit-backend suite remains green.

## Remaining Tasks

### Phase 2: Flat Table Parser (TDD)

- [ ] 2.1 RED: Add `flatTableParser.test.ts` covering Markdown, CSV, JSON, key-value, missing rows, and extra rows.
- [ ] 2.2 GREEN: Create `server/src/services/unifiedComparison/flatTableParser.ts` with format detection, insurer/row normalization, and `extraRows`.
- [ ] 2.3 REFACTOR: Centralize accent-tolerant row-label mapping and ensure missing rows emit `notFound: true`.

### Phase 3: Unified Engine Wiring (TDD)

- [ ] 3.1 RED: Add tests for `unifiedComparisonEngine.compare` retrying ≤2 times on parse failure and throwing structured `UnifiedComparisonError`.
- [ ] 3.2 GREEN: Wire new prompt builder and flat parser into `server/src/services/unifiedComparison/unifiedComparisonEngine.ts`; implement correction prompt retry.
- [ ] 3.3 REFACTOR: Return `FlatComparisonResult` with metadata and warnings; expose failure reason for the adapter.

### Phase 4: Fallback Batch Service (TDD)

- [ ] 4.1 RED: Add tests for `processQuotesBatch` handling sequential/concurrent processing, timeouts, and error placeholders.
- [ ] 4.2 GREEN: Extract batch logic from `analysisController` into `server/src/services/quoteProcessingService.ts` as exported `processQuotesBatch(pdfPaths, options)`.
- [ ] 4.3 REFACTOR: Remove any internal `USE_UNIFIED_ENGINE` checks from the per-quote pipeline.

### Phase 5: Adapter Routing & Integration (TDD)

- [ ] 5.1 RED: Add adapter tests for unified-first routing, explicit disable, fallback logging with reason, and `ComparisonAdapterResult` envelope.
- [ ] 5.2 GREEN: Implement `comparisonEngineAdapter.generateComparison` to route by flag, call unified engine, fallback to `processQuotesBatch`, and transform to `MatrixRow[]`.
- [ ] 5.3 GREEN: Refactor `server/src/controllers/analysisController.ts` to use the adapter as the single router; remove inline flag checks and duplicate fallback.
- [ ] 5.4 REFACTOR: Update `server/src/services/unifiedComparison/__tests__/fallback.test.ts` mocks to assert adapter-driven fallback with reason.

### Phase 6: Evaluation Harness (TDD)

- [ ] 6.1 RED: Write `server/src/evaluation/__tests__/extractionQuality.test.ts` asserting `matchRate >= 0.90` and `fallbackRate <= 0.10`, with skip guard when fixtures/API are missing.
- [ ] 6.2 GREEN: Create `server/src/evaluation/extractionQualityEval.ts` harness comparing direct-chat baseline to tool path via adapter.
- [ ] 6.3 GREEN: Add fixtures under `server/src/evaluation/fixtures/extraction-quality/` with 3-quote metadata and persisted baseline snapshot.

### Phase 7: Regression & Cleanup

- [ ] 7.1 Run `npm run typecheck:backend` and fix TypeScript errors across modified files.
- [ ] 7.2 Run `npm test` and ensure the existing Vitest suite plus new tests pass.
- [ ] 7.3 Document `USE_UNIFIED_ENGINE` usage and rollback procedure in relevant config/README comments.

## Next PR

- **PR 2**: Flat table parser (`flatTableParser.ts` + unit tests). Targets the branch of PR 1 in the `stacked-to-main` chain.
- No runtime dependencies on PR 1; can be developed in parallel if needed, but the chain order keeps review focused.

## Risks

- Actual code diff (~420 lines) exceeded the ~200-line forecast for PR 1, mainly due to the prompt-builder rewrite and test coverage. The slice is still reviewable but is close to the 400-line budget.
- `FlatComparisonSchema` currently requires exactly 4 rows. If the parser in PR 2 needs a looser schema for intermediate normalization, we may need to relax this constraint.
- `getResponseSchema()` returning the legacy schema is technical debt intentionally left for PR 3.
