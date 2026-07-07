# Tasks: Granular Comparison Schema

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~720 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation: schema v2, feature flag, adapter routing | PR 1 | main; includes schema + flag tests |
| 2 | Core backend: v2 prompt, alias parser, confidence, transformer | PR 2 | depends on PR 1; includes parser/transformer tests |
| 3 | Frontend + export: section headers, confidence badges, virtualized matrix | PR 3 | depends on PR 2; includes UI smoke tests |
| 4 | Evaluation harness: baseline, match rate >= 90%, fallback guard | PR 4 | depends on PR 2; includes CI eval tests |

## Phase 1: Foundation

- [x] 1.1 Add `schemaVersion`, `section`, `confidence`, `isAmbiguous` to `FlatComparisonSchema` in `server/src/services/unifiedComparison/comparisonSchema.ts`; keep `FlatComparisonSchemaV1`.
- [x] 1.2 Add `granularComparisonSchema` to `FeatureFlags` and `UnifiedComparisonFeatureFlag` in `server/src/config/featureFlags.ts` with env mapping.
- [x] 1.3 Add `granularComparisonFlag` helpers in `server/src/services/unifiedComparison/featureFlagService.ts`.
- [x] 1.4 Update `comparisonEngineAdapter.ts` to route v2/v1 by flag and cached `schemaVersion`.
- [x] 1.5 Write unit tests for v2 schema validation and v1 backward compatibility.

## Phase 2: Core Backend

- [ ] 2.1 Add `buildV2ComparisonPrompt()` in `comparisonPromptBuilder.ts` with granular template; keep `buildV1ComparisonPrompt()`.
- [ ] 2.2 Implement alias dictionary, `normalizeAlias()`, and section assignment in `flatTableParser.ts`.
- [ ] 2.3 Implement `computeCellConfidence()` with signal-based scoring in `flatTableParser.ts`.
- [ ] 2.4 Update `matrixTransformer.ts` to group rows by `section` and emit `type: 'header'` rows.
- [ ] 2.5 Update `unifiedComparisonEngine.ts` to pass flag context to builder and parser.
- [ ] 2.6 Write integration tests for parser alias matching, ambiguity, and section grouping.

## Phase 3: Frontend & Integration

- [ ] 3.1 Update `UnifiedCoverageMatrix.tsx` to render section headers and confidence badges (green/yellow/red).
- [ ] 3.2 Update `VirtualizedCoverageMatrix.tsx` to render section headers spanning all columns.
- [ ] 3.3 Preserve section grouping and confidence in matrix export logic.
- [ ] 3.4 Update `analysisController.ts` to preserve `section` and `confidence` in report conversion.
- [ ] 3.5 Add smoke tests for header rows and badge rendering.

## Phase 4: Evaluation & Tests

- [ ] 4.1 Update `extractionQualityEval.ts` to use variable row counts, label-based matching, and regenerate baseline.
- [ ] 4.2 Create Vitest harness for 3-quote baseline match-rate >= 90%.
- [ ] 4.3 Add fallback-rate guard (<= 10%) to CI test.
- [ ] 4.4 Verify v1 cached objects render through legacy matrix path.
