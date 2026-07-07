# Tasks: Granular Comparison Schema

> **Status**: Archived — 2026-07-07. All 20/20 tasks complete.

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

- [x] 2.1 Add `buildV2ComparisonPrompt()` in `comparisonPromptBuilder.ts` with granular template; keep `buildV1ComparisonPrompt()`.
- [x] 2.2 Implement alias dictionary, `normalizeAlias()`, and section assignment in `flatTableParser.ts`.
- [x] 2.3 Implement `computeCellConfidence()` with signal-based scoring in `flatTableParser.ts`.
- [x] 2.4 Update `matrixTransformer.ts` to group rows by `section` and emit `type: 'header'` rows.
- [x] 2.5 Update `unifiedComparisonEngine.ts` to pass flag context to builder and parser.
- [x] 2.6 Write integration tests for parser alias matching, ambiguity, and section grouping.

## Phase 3: Frontend & Integration

- [x] 3.1 Update `UnifiedCoverageMatrix.tsx` to render section headers and confidence badges (green/yellow/red).
- [x] 3.2 Update `VirtualizedCoverageMatrix.tsx` to render section headers spanning all columns.
- [x] 3.3 Preserve section grouping and confidence in matrix export logic.
- [x] 3.4 Update `analysisController.ts` to preserve `section` and `confidence` in report conversion.
- [x] 3.5 Add smoke tests for header rows and badge rendering.

## Phase 4: Evaluation & Tests

- [x] 4.1 Update `extractionQualityEval.ts` to use variable row counts, label-based matching, and regenerate baseline.
- [x] 4.2 Create Vitest harness for 3-quote baseline match-rate >= 90%.
- [x] 4.3 Add fallback-rate guard (<= 10%) to CI test.
- [x] 4.4 Verify v1 cached objects render through legacy matrix path.

## Phase 5: Structured Deductible Extraction (post-verification follow-up)

- [x] 5.1 Add optional `deductible` object to `FlatComparisonCellSchemaV2` in `comparisonSchema.ts`.
- [x] 5.2 Implement `parseDeductible()` in `flatTableParser.ts` with percentage, minimum, currency, and type parsing plus fallback handling.
- [x] 5.3 Extend `buildV2Cell()` to parse deductibles for `DEDUCIBLES` rows and apply `isAmbiguous` + `Ver condiciones` fallback.
- [x] 5.4 Add per-coverage deductible aliases to `ALIAS_MAP` in `flatTableParser.ts`.
- [x] 5.5 Add covering tests in `flatTableParser.test.ts` for the structured deductible scenarios.
- [x] 5.6 Re-run verification and update `verify-report.md`.
