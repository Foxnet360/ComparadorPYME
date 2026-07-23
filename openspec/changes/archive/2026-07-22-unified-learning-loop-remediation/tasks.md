# Tasks: Unified Learning Loop Remediation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Fix template-hint measurement 4R issues | PR 1 | `npm run test:unit:backend -- templateHintMeasurement` | `USE_UNIFIED_TEMPLATE_HINTS_ROLLOUT=100` request | `templateHintMeasurement.ts` + its tests |
| 2 | Anonymous guard + controller flag plumbing | PR 2 | `npm run test:unit:backend -- analysisController` | `POST /api/analyze` unauthenticated | `analysisController.ts` + adapter tests |
| 3 | Learning loop wiring + golden-set segmentation | PR 3 | `npm run test:unit:backend -- learningEngine` | Correction save flow + `evaluate:golden` | `learningEngine.ts`, `runEvaluation.ts` |

## Phase 1: Measurement Harness Resilience

- [x] 1.1 RED: Add `templateHintMeasurement.test.ts` case that one outlier with N=1 does NOT disable hints.
- [x] 1.2 GREEN: Enforce minimum sample size (e.g., 10) in `shouldDisable` before evaluating p95.
- [x] 1.3 RED: Add test that `setBaseline` clears an existing in-memory disable decision.
- [x] 1.4 GREEN: Invalidate the per-insurer disable cache entry inside `setBaseline`.
- [x] 1.5 RED: Add test asserting p95 for small N below threshold is not the maximum value.
- [x] 1.6 GREEN: Fix `percentile` off-by-one so p95 does not collapse to max for small N.
- [x] 1.7 GREEN: Replace raw ioredis usage in `templateHintMeasurement.ts` with resilient `redisCache` wrapper operations.
- [x] 1.8 REFACTOR: Run focused tests and `npm run format:check`.

## Phase 2: Anonymous Routing Fix

- [x] 2.1 RED: Add regression test proving unauthenticated traffic is not all bucketed to `hashUserId('anonymous')=75`.
- [x] 2.2 GREEN: Pass `undefined` from `analysisController.ts:134` when no user is authenticated.
- [x] 2.3 GREEN: Verify `comparisonEngineAdapter.isSliceEnabled` excludes `undefined` userIds from rollouts.
- [x] 2.4 REFACTOR: Run focused tests and `npm run format:check`.

## Phase 3: Learning Loop Wiring (Archived Phase 4)

- [x] 3.1 RED: Add `learningEngine.test.ts` case: `coverage_mapping` correction writes a graph edge even when `graphLearningEnabled` is false.
- [x] 3.2 GREEN: Route `coverage_mapping` corrections directly to `coverageGraphService.learnCorrection` in `applyCorrection`, bypassing the legacy flag gate.
- [x] 3.3 RED: Add test asserting first human correction produces `learned` edge weight >= 0.7.
- [x] 3.4 GREEN: Confirm `LEARNED_BASE_WEIGHT` yields weight >= 0.7; adjust if needed.
- [x] 3.5 RED: Add `coverageGraphService.test.ts` regression test for cache invalidation after `learnCorrection`.
- [x] 3.6 GREEN: Ensure `learnCorrection` and `addEdge` invalidate affected `graph:query:*` and `graph:deductible:*` cache keys.
- [x] 3.7 REFACTOR: Run focused tests and `npm run format:check`.

## Phase 4: Cross-Cutting Integration (Archived Phase 5)

- [x] 4.1 RED: Add integration test asserting `/api/analyze` returns `canonicalName` and preserves raw labels when graphEnabled is true.
- [x] 4.2 GREEN: Pass `graphEnabled`/`templateHintsEnabled` from `adapterResult` into `matrixRowsToComparisonReport`.
- [x] 4.3 GREEN: Surface `canonicalName`, `matchConfidence`, and `matchMethod` from matrix rows into the report `coverages`.
- [x] 4.4 RED: Add test for `runEvaluation.ts` segmenting accuracy by `graphEnabled`/`templateHintsEnabled`.
- [x] 4.5 GREEN: Extend `server/src/scripts/runEvaluation.ts` to segment golden-set results by the two slice flags.
- [x] 4.6 REFACTOR: Run focused tests and `npm run format:check`.

## Phase 5: Verification

- [x] 5.1 Run `npm run test:unit:backend` for changed services.
- [x] 5.2 Run `npm run test:integration`.
- [x] 5.3 Run `npm run typecheck:backend`.
- [x] 5.4 Run `npm run format:check`.
