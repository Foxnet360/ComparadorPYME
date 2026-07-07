# Apply Progress: Granular Comparison Schema

## Change

**Name**: granular-comparison-schema  
**Current PR**: PR 2 of 4 (Core Backend)  
**Mode**: Strict TDD  
**Chain Strategy**: stacked-to-main

## Completed Tasks

### Phase 1: Foundation (PR 1 — completed in prior batch)

- [x] 1.1 Add `schemaVersion`, `section`, `confidence`, `isAmbiguous` to `FlatComparisonSchema` in `server/src/services/unifiedComparison/comparisonSchema.ts`; keep `FlatComparisonSchemaV1`.
- [x] 1.2 Add `granularComparisonSchema` to `FeatureFlags` and `UnifiedComparisonFeatureFlag` in `server/src/config/featureFlags.ts` with env mapping.
- [x] 1.3 Add `granularComparisonFlag` helpers in `server/src/services/unifiedComparison/featureFlagService.ts`.
- [x] 1.4 Update `comparisonEngineAdapter.ts` to route v2/v1 by flag and cached `schemaVersion`.
- [x] 1.5 Write unit tests for v2 schema validation and v1 backward compatibility.

### Phase 2: Core Backend (PR 2 — this batch)

- [x] 2.1 Add `buildV2ComparisonPrompt()` in `comparisonPromptBuilder.ts` with granular template; keep `buildV1ComparisonPrompt()`.
- [x] 2.2 Implement alias dictionary, `normalizeAlias()`, and section assignment in `flatTableParser.ts`.
- [x] 2.3 Implement `computeCellConfidence()` with signal-based scoring in `flatTableParser.ts`.
- [x] 2.4 Update `matrixTransformer.ts` to group rows by `section` and emit `type: 'header'` rows.
- [x] 2.5 Update `unifiedComparisonEngine.ts` to pass flag context to builder and parser.
- [x] 2.6 Write integration tests for parser alias matching, ambiguity, and section grouping.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modified | Added `buildV2ComparisonPrompt()` with section-aware granular template and `buildV2CorrectionPrompt()`. Kept v1 prompt methods. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Added v2 alias dictionary, exported `normalizeAlias()` and `computeCellConfidence()`, added `parseV2()` for JSON granular input, set `schemaVersion: 1` on v1 and `schemaVersion: 2` on v2 results. |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modified | Added `flatResultToMatrixRowsV2()` that groups rows by section, emits header rows, preserves per-cell confidence, and places extras in an `OTROS` section. |
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | Modified | Added `CompareOptions` interface, reads `granularComparisonSchema` from options or feature flag, routes to v2 prompt/parser when enabled, v1 otherwise. |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modified | Routes to `flatResultToMatrixRowsV2` when `schemaVersion` is 2, otherwise uses `flatResultToMatrixRows`. |
| `server/src/services/unifiedComparison/__tests__/comparisonPromptBuilder.test.ts` | Modified | Added v2 prompt tests (sub-rows, section-aware schema, LLM flexibility, insurer count). |
| `server/src/services/unifiedComparison/__tests__/flatTableParser.test.ts` | Modified | Added tests for `normalizeAlias`, `computeCellConfidence`, and `parseV2` (alias normalization, ambiguity, section assignment, derived confidence). |
| `server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts` | Modified | Added v2 transformer tests for section headers, data row ordering, confidence preservation, and extra-row section. |
| `server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts` | Modified | Added v2 wiring tests (prompt/parser selection and schemaVersion output). |
| `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | Modified | Added v2 result transformation test for section-aware matrix. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `comparisonPromptBuilder.test.ts` | Unit | 5/5 passing | Written | Passed | 6 cases (sub-rows, section-aware, flexibility, deductible, count, no four-row enforcement) | Clean |
| 2.2 | `flatTableParser.test.ts` | Unit | 14/14 passing | Written | Passed | 5 cases (canonical, EEE alias, specificity, ambiguity, case/accent) | Clean |
| 2.3 | `flatTableParser.test.ts` | Unit | 14/14 passing | Written | Passed | 5 cases (high score, notFound, missing rawText, ambiguous, alias quality) | Clean |
| 2.4 | `matrixTransformer.test.ts` | Unit | 12/12 passing | Written | Passed | 5 cases (headers, section count, ordering, confidence, extras) | Clean |
| 2.5 | `unifiedComparisonEngine.test.ts` | Unit | 6/6 passing | Written | Passed | 2 cases (v2 enabled, v1 disabled) | Clean |
| 2.6 | `flatTableParser.test.ts` | Integration | 14/14 passing | Written | Passed | 4 cases (canonical labels, ambiguous → extraRows, confidence, unmapped) | Clean |

### Test Summary
- **Total tests written**: 27 new tests across 5 test files
- **Total tests passing**: 1,059 unit-backend tests passed, 8 skipped
- **Layers used**: Unit + integration (no E2E in this work unit)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: `normalizeAlias`, `computeCellConfidence`, `sectionSortIndex`, `cellFromFlatValueV2`, `buildV2Cell`, `parseJsonV2`

## Deviations from Design

1. The v2 parser only supports JSON input (`parseV2` throws for Markdown/CSV). The v2 prompt explicitly requests JSON, so this is acceptable for the first slice. Markdown/CSV v2 parsing can be added in PR 4 if the evaluation harness needs it.
2. The alias ambiguity rule uses exact-match-of-best-alias as a disambiguation gate rather than a simple longest-match. This matches the spec's "Equipo" example and keeps the implementation deterministic and testable.
3. The matrix v2 transformer groups all extra rows under a single `OTROS` section rather than leaving them inline. This keeps the UI section model consistent and is forward-compatible with the export changes planned in PR 3.

## Issues Found

- None.

## Remaining Tasks

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
- **Current work unit**: PR 2 — Core backend (v2 prompt, parser, transformer, engine wiring)
- **Boundary**: Starts from PR 1 Foundation (schema v2, feature flag, adapter routing). Ends with backend-only Core Backend artifacts and tests passing.
- **Estimated review budget impact**: ~1,032 changed lines (1,032 insertions + 33 deletions). This exceeds the 400-line soft target and the ~250–350 line goal stated in the instructions. The overrun is driven by the new v2 parser logic (~305 lines) and co-located tests (~450 lines). The PR remains focused on the scoped work unit and is reviewable as a stacked PR slice, but the next agent/author should consider whether to split the parser into its own slice or accept the exception for this core backend unit.

## Status

11/11 Phase 1 + Phase 2 tasks complete. PR 2 is ready for verify. Next step: PR 3 Frontend + export.

## Verification

- `npm run typecheck:backend`: PASS
- `npm run test:unit:backend`: PASS (114 files, 1,059 tests passed, 8 skipped)
- Affected unified-comparison tests: PASS

## Chain Context

```
PR 1 Foundation ──► PR 2 Core backend ──► PR 3 Frontend + export ──► PR 4 Evaluation harness
                        📍
```

- **PR 1**: Already merged to main (Foundation: schema v2, feature flag, adapter routing).
- **PR 2** (📍 current): Core backend — v2 prompt, parser, transformer, engine wiring.
- **PR 3**: Frontend + export — section headers, confidence badges, virtualized matrix, export preservation.
- **PR 4**: Evaluation harness — baseline, match-rate >= 90%, fallback-rate guard.