# Tasks: Integrate Template Graph into Unified Comparison

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Flags + adapter rollout | PR 1 | `npm test -- comparisonEngineAdapter` | `USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT=50` request | `featureFlags.ts`, `featureFlagService.ts`, `comparisonEngineAdapter.ts` |
| 2 | Graph canonicalization | PR 2 | `npm test -- flatTableParser` | `USE_UNIFIED_GRAPH_CANONICALIZATION=1` request | `coverageGraphService.ts`, `flatTableParser.ts`, `comparisonSchema.ts`, `matrixTransformer.ts` |
| 3 | Template-aware prompts | PR 3 | `npm test -- templateHintMeasurement` | `USE_UNIFIED_TEMPLATE_HINTS_BBVA=1` request | `templateHintMeasurement.ts`, `templateRegistryService.ts`, `comparisonPromptBuilder.ts`, `unifiedComparisonEngine.ts` |
| 4 | Learning loop | PR 4 | `npm test -- learningEngine` | Correction save flow | `learningEngine.ts`, `coverageGraphService.ts` cache invalidation |

## Phase 1: Foundation

- [x] 1.1 RED: Add `comparisonEngineAdapter.test.ts` cases for V1 guard, `hashUserId` reuse, rollout threshold, flag propagation.
- [x] 1.2 GREEN: Add `useUnifiedGraphCanonicalization`, `useUnifiedTemplateHints`, and per-insurer flags to `server/src/config/featureFlags.ts` with `_ROLLOUT` env parsing.
- [x] 1.3 GREEN: Export `hashUserId` from `server/src/services/unifiedComparison/featureFlagService.ts`.
- [x] 1.4 GREEN: Implement rollout evaluation, V1 schema guard, and flag propagation in `server/src/services/unifiedComparison/comparisonEngineAdapter.ts`.

## Phase 2: Slice 1 — Graph Canonicalization

- [x] 2.1 RED: Add `flatTableParser.test.ts` cases for canonical metadata, raw label preservation, alias fallback, deductible `appliesTo`.
- [x] 2.2 GREEN: Add `canonicalName`, `canonicalId`, `canonicalSource`, `matchConfidence` to `FlatComparisonRowSchemaV2` and `appliesTo` to `StructuredDeductibleSchema` in `server/src/services/unifiedComparison/comparisonSchema.ts`.
- [x] 2.3 GREEN: Add `rawName` to `coverageGraphService.query`, rank `queryDeductible` by insurer, and invalidate cache on `learnCorrection`/`addEdge` in `server/src/services/coverageGraphService.ts`.
- [x] 2.4 GREEN: Hook `coverageGraphService.query`/`queryDeductible` into `flatTableParser.buildV2Result` after `normalizeAlias`.
- [x] 2.5 GREEN: Sort rows by `canonicalId` in `server/src/services/unifiedComparison/matrixTransformer.ts`.

## Phase 3: Slice 2 — Template-Aware Prompts

- [x] 3.1 RED: Add `templateHintMeasurement.test.ts` cases for p95 >15% token/latency disable trigger.
- [x] 3.2 RED: Add `comparisonPromptBuilder.test.ts` and `unifiedComparisonEngine.test.ts` cases for addon injection and generic fallback.
- [x] 3.3 GREEN: Create `server/src/services/unifiedComparison/templateHintMeasurement.ts` with Redis-backed p95 harness.
- [x] 3.4 GREEN: Ensure `templateRegistryService.matchTemplate` returns `insurer` and non-undefined `promptAddon`.
- [x] 3.5 GREEN: Add `templateAddons?: string[]` to `comparisonPromptBuilder.buildV2ComparisonPrompt`.
- [x] 3.6 GREEN: Match templates and inject insurer addons in `server/src/services/unifiedComparison/unifiedComparisonEngine.ts`.

## Phase 4: Slice 3 — Learning Loop

- [ ] 4.1 RED: Add `learningEngine.test.ts` and `coverageGraphService.test.ts` cases for correction routing and edge weight >=0.7.
- [ ] 4.2 GREEN: Route `learningEngine.applyCorrection` to `coverageGraphService.learnCorrection` for `coverage_mapping` corrections.
- [ ] 4.3 GREEN: Implement cache invalidation in `coverageGraphService` after `learnCorrection`/`addEdge`.

## Phase 5: Cross-Cutting Integration

- [ ] 5.1 RED: Add `integration.test.ts` case for `/api/analyze` returning `canonicalName` with raw labels preserved.
- [ ] 5.2 GREEN: Pass `graphEnabled`/`templateHintsEnabled` through `server/src/controllers/analysisController.ts` to `matrixRowsToComparisonReport`.
- [ ] 5.3 GREEN: Extend golden-set evaluation to segment by `graphEnabled`/`templateHintsEnabled`.
- [ ] 5.4 REFACTOR: Verify `npm test` and `npm run build` without running tests (disk full).
