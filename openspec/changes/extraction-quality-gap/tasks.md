# Tasks: Close the extraction-quality gap with direct-LLM comparison table

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1,050 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Est. lines | Notes |
|------|------|-----------|------------|-------|
| 1 | Feature flags + flat schema + prompt builder | PR 1 | ~200 | Foundation; no runtime deps |
| 2 | Flat table parser + unit tests | PR 2 | ~350 | Markdown/CSV/JSON/KV parsing |
| 3 | Unified engine wiring + retry + tests | PR 3 | ~250 | Depends on PR 2 |
| 4 | Batch service + adapter + controller + tests | PR 4 | ~300 | Depends on PR 1, PR 3 |
| 5 | Evaluation harness + fixtures + regression test | PR 5 | ~150 | Depends on PR 4 |

## Phase 1: Foundation

- [x] 1.1 RED: Write Vitest for `FeatureFlagManager` defaulting `useUnifiedComparisonEngine=true`, env alias `USE_UNIFIED_ENGINE`, and no hardcoded override.
- [x] 1.2 GREEN: Update `server/src/config/featureFlags.ts` to remove the hardcoded `false` override, add `USE_UNIFIED_ENGINE` alias, and default to `true`.
- [x] 1.3 RED: Write test asserting `FlatComparisonSchema` accepts rows × insurers shape and rejects nested canonical schema.
- [x] 1.4 GREEN: Add `FlatComparisonSchema` to `server/src/services/unifiedComparison/comparisonSchema.ts`; keep legacy schema export.
- [x] 1.5 RED: Write test asserting `comparisonPromptBuilder` output contains the four row labels and JSON schema snippet.
- [x] 1.6 GREEN: Rewrite `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` with the flat-table prompt.

## Phase 2: Flat Table Parser (TDD)

- [x] 2.1 RED: Add `flatTableParser.test.ts` covering Markdown, CSV, JSON, key-value, missing rows, and extra rows.
- [x] 2.2 GREEN: Create `server/src/services/unifiedComparison/flatTableParser.ts` with format detection, insurer/row normalization, and `extraRows`.
- [x] 2.3 REFACTOR: Centralize accent-tolerant row-label mapping and ensure missing rows emit `notFound: true`.

## Phase 3: Unified Engine Wiring (TDD)

- [ ] 3.1 RED: Add tests for `unifiedComparisonEngine.compare` retrying ≤2 times on parse failure and throwing structured `UnifiedComparisonError`.
- [ ] 3.2 GREEN: Wire new prompt builder and flat parser into `server/src/services/unifiedComparison/unifiedComparisonEngine.ts`; implement correction prompt retry.
- [ ] 3.3 REFACTOR: Return `FlatComparisonResult` with metadata and warnings; expose failure reason for the adapter.

## Phase 4: Fallback Batch Service (TDD)

- [ ] 4.1 RED: Add tests for `processQuotesBatch` handling sequential/concurrent processing, timeouts, and error placeholders.
- [ ] 4.2 GREEN: Extract batch logic from `analysisController` into `server/src/services/quoteProcessingService.ts` as exported `processQuotesBatch(pdfPaths, options)`.
- [ ] 4.3 REFACTOR: Remove any internal `USE_UNIFIED_ENGINE` checks from the per-quote pipeline.

## Phase 5: Adapter Routing & Integration (TDD)

- [ ] 5.1 RED: Add adapter tests for unified-first routing, explicit disable, fallback logging with reason, and `ComparisonAdapterResult` envelope.
- [ ] 5.2 GREEN: Implement `comparisonEngineAdapter.generateComparison` to route by flag, call unified engine, fallback to `processQuotesBatch`, and transform to `MatrixRow[]`.
- [ ] 5.3 GREEN: Refactor `server/src/controllers/analysisController.ts` to use the adapter as the single router; remove inline flag checks and duplicate fallback.
- [ ] 5.4 REFACTOR: Update `server/src/services/unifiedComparison/__tests__/fallback.test.ts` mocks to assert adapter-driven fallback with reason.

## Phase 6: Evaluation Harness (TDD)

- [ ] 6.1 RED: Write `server/src/evaluation/__tests__/extractionQuality.test.ts` asserting `matchRate >= 0.90` and `fallbackRate <= 0.10`, with skip guard when fixtures/API are missing.
- [ ] 6.2 GREEN: Create `server/src/evaluation/extractionQualityEval.ts` harness comparing direct-chat baseline to tool path via adapter.
- [ ] 6.3 GREEN: Add fixtures under `server/src/evaluation/fixtures/extraction-quality/` with 3-quote metadata and persisted baseline snapshot.

## Phase 7: Regression & Cleanup

- [ ] 7.1 Run `npm run typecheck:backend` and fix TypeScript errors across modified files.
- [ ] 7.2 Run `npm test` and ensure the existing Vitest suite plus new tests pass.
- [ ] 7.3 Document `USE_UNIFIED_ENGINE` usage and rollback procedure in relevant config/README comments.
