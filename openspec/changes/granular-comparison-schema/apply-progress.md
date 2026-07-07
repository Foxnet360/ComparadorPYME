# Apply Progress: Granular Comparison Schema

## Change

**Name**: granular-comparison-schema  
**Current PR**: PR 1 of 4 (Foundation)  
**Mode**: Strict TDD  
**Chain Strategy**: stacked-to-main

## Completed Tasks (Phase 1: Foundation)

- [x] 1.1 Add `schemaVersion`, `section`, `confidence`, `isAmbiguous` to `FlatComparisonSchema` in `server/src/services/unifiedComparison/comparisonSchema.ts`; keep `FlatComparisonSchemaV1`.
- [x] 1.2 Add `granularComparisonSchema` to `FeatureFlags` and `UnifiedComparisonFeatureFlag` in `server/src/config/featureFlags.ts` with env mapping.
- [x] 1.3 Add `granularComparisonFlag` helpers in `server/src/services/unifiedComparison/featureFlagService.ts`.
- [x] 1.4 Update `comparisonEngineAdapter.ts` to route v2/v1 by flag and cached `schemaVersion`.
- [x] 1.5 Write unit tests for v2 schema validation and v1 backward compatibility.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modified | Added `SchemaSection` enum, v2 schemas (`FlatComparisonCellSchemaV2`, `FlatComparisonRowSchemaV2`, `FlatComparisonSchemaV2`), kept v1 schemas, aliased `FlatComparisonSchema` to v2, added `resolveComparisonSchemaVersion` helper. |
| `server/src/config/featureFlags.ts` | Modified | Added `granularComparisonSchema` flag to interface, defaults, rollout config, and env mapping. |
| `server/src/services/unifiedComparison/featureFlagService.ts` | Modified | Added `isGranularComparisonSchemaEnabled()` helper. |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modified | Added `schemaVersion` to result envelope; routes unified result version using `resolveComparisonSchemaVersion` and flag. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Added `schemaVersion: 1` to manual result construction to satisfy updated type. |
| `server/src/evaluation/extractionQualityEval.ts` | Modified | Added `schemaVersion: 1` to manual result construction to satisfy updated type. |
| `server/src/services/unifiedComparison/__tests__/comparisonSchema.test.ts` | Modified | Rewrote to cover v2 schema validation, v1 backward compatibility, `SchemaSection`, and `resolveComparisonSchemaVersion`. |
| `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | Modified | Added tests for schema version tagging in the adapter result envelope. |
| `server/src/services/unifiedComparison/__tests__/featureFlagService.test.ts` | Created | Added tests for the granular comparison flag helper. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `comparisonSchema.test.ts` | Unit | 5/5 passing (existing) | Written | Passed | 4 cases (v2 granular, default schemaVersion, open rows, invalid confidence) | Clean |
| 1.1 | `comparisonSchema.test.ts` | Unit | 5/5 passing (existing) | Written | Passed | 2 cases (V1 accepts 4 rows, rejects missing rows) | Clean |
| 1.1 | `comparisonSchema.test.ts` | Unit | 5/5 passing (existing) | Written | Passed | 1 case (SchemaSection enum values) | Single-value (no logic) |
| 1.1 | `comparisonSchema.test.ts` | Unit | 5/5 passing (existing) | Written | Passed | 4 cases (flag + v2, flag off, missing version, v1 version) | Clean |
| 1.2 | `featureFlagService.test.ts` | Unit | N/A (new file) | Written | Passed | 2 cases (default false, true when flag on) | Clean |
| 1.3 | `featureFlagService.test.ts` | Unit | N/A (new file) | Written | Passed | 2 cases (default false, true when flag on) | Clean |
| 1.4 | `comparisonEngineAdapter.test.ts` | Unit | 7/7 passing (existing) | Written | Passed | 4 cases (v2 tagged, v1 fallback, missing version, legacy batch) | Clean |
| 1.5 | `comparisonSchema.test.ts` | Unit | 5/5 passing (existing) | Written | Passed | See 1.1 evidence | Clean |

### Test Summary
- **Total tests written**: 28
- **Total tests passing**: 28
- **Layers used**: Unit (28)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: `resolveComparisonSchemaVersion`

## Deviations from Design

1. The v2 schema defaults `schemaVersion` to `2`. This means the existing parser (still using `FlatComparisonSchema` until PR 2) will produce `schemaVersion: 2` even for v1-shaped results. The adapter's `resolveComparisonSchemaVersion` correctly handles this for now, but the parser will be updated in PR 2 to explicitly set the version based on the flag.
2. Two files outside the strict Foundation PR scope (`flatTableParser.ts` and `extractionQualityEval.ts`) received a single-line `schemaVersion: 1` addition to satisfy the updated `FlatComparisonResult` type. This is a type-compatibility fix, not a parser/eval logic change.
3. The adapter currently uses the existing `flatResultToMatrixRows` transform for both v1 and v2 results. The v2 section-aware transformer will be implemented in PR 2.

## Issues Found

- None.

## Remaining Tasks

### Phase 2: Core Backend (PR 2)

- [ ] 2.1 Add `buildV2ComparisonPrompt()` in `comparisonPromptBuilder.ts` with granular template; keep `buildV1ComparisonPrompt()`.
- [ ] 2.2 Implement alias dictionary, `normalizeAlias()`, and section assignment in `flatTableParser.ts`.
- [ ] 2.3 Implement `computeCellConfidence()` with signal-based scoring in `flatTableParser.ts`.
- [ ] 2.4 Update `matrixTransformer.ts` to group rows by `section` and emit `type: 'header'` rows.
- [ ] 2.5 Update `unifiedComparisonEngine.ts` to pass flag context to builder and parser.
- [ ] 2.6 Write integration tests for parser alias matching, ambiguity, and section grouping.

### Phase 3: Frontend & Integration (PR 3)

- [ ] 3.1 Update `UnifiedCoverageMatrix.tsx` to render section headers and confidence badges (green/yellow/red).
- [ ] 3.2 Update `VirtualizedCoverageMatrix.tsx` to render section headers spanning all columns.
- [ ] 3.3 Preserve section grouping and confidence in matrix export logic.
- [ ] 3.4 Update `analysisController.ts` to preserve `section` and `confidence` in report conversion.
- [ ] 3.5 Add smoke tests for header rows and badge rendering.

### Phase 4: Evaluation & Tests (PR 4)

- [ ] 4.1 Update `extractionQualityEval.ts` to use variable row counts, label-based matching, and regenerate baseline.
- [ ] 4.2 Create Vitest harness for 3-quote baseline match-rate >= 90%.
- [ ] 4.3 Add fallback-rate guard (<= 10%) to CI test.
- [ ] 4.4 Verify v1 cached objects render through legacy matrix path.

## Workload / PR Boundary

- **Mode**: stacked-to-main
- **Current work unit**: PR 1 — Foundation (schema v2, feature flag, adapter routing)
- **Boundary**: Starts from clean `main`; ends with Foundation artifacts and tests passing.
- **Estimated review budget impact**: ~602 changed lines (481 insertions + 121 deletions). Production code changes are ~105 lines; the remainder is tests (~336) and OpenSpec artifacts (~161). Slightly above the 200-line soft target because the test rewrite preserves original coverage while adding v2 and backward-compatibility cases. The PR remains focused and reviewable.

## Status

5/5 Phase 1 tasks complete. PR 1 is ready for verify. Next step: PR 2 Core backend.

## Verification

- `npm run typecheck:backend`: PASS
- `npm run test:unit:backend`: PASS (114 files, 1032 tests passed, 8 skipped)
- Affected unified-comparison tests: PASS
