# Apply Progress: Granular Comparison Schema

## Change

**Name**: granular-comparison-schema  
**Current PR**: PR 3 of 4 (Frontend + export)  
**Mode**: Strict TDD  
**Chain Strategy**: stacked-to-main

## Completed Tasks

### Phase 1: Foundation (PR 1 — completed in prior batch)

- [x] 1.1 Add `schemaVersion`, `section`, `confidence`, `isAmbiguous` to `FlatComparisonSchema` in `server/src/services/unifiedComparison/comparisonSchema.ts`; keep `FlatComparisonSchemaV1`.
- [x] 1.2 Add `granularComparisonSchema` to `FeatureFlags` and `UnifiedComparisonFeatureFlag` in `server/src/config/featureFlags.ts` with env mapping.
- [x] 1.3 Add `granularComparisonFlag` helpers in `server/src/services/unifiedComparison/featureFlagService.ts`.
- [x] 1.4 Update `comparisonEngineAdapter.ts` to route v2/v1 by flag and cached `schemaVersion`.
- [x] 1.5 Write unit tests for v2 schema validation and v1 backward compatibility.

### Phase 2: Core Backend (PR 2 — completed in prior batch)

- [x] 2.1 Add `buildV2ComparisonPrompt()` in `comparisonPromptBuilder.ts` with granular template; keep `buildV1ComparisonPrompt()`.
- [x] 2.2 Implement alias dictionary, `normalizeAlias()`, and section assignment in `flatTableParser.ts`.
- [x] 2.3 Implement `computeCellConfidence()` with signal-based scoring in `flatTableParser.ts`.
- [x] 2.4 Update `matrixTransformer.ts` to group rows by `section` and emit `type: 'header'` rows.
- [x] 2.5 Update `unifiedComparisonEngine.ts` to pass flag context to builder and parser.
- [x] 2.6 Write integration tests for parser alias matching, ambiguity, and section grouping.

### Phase 3: Frontend & Export (PR 3 — this batch)

- [x] 3.1 Update `UnifiedCoverageMatrix.tsx` to render section headers and confidence badges (green/yellow/red).
- [x] 3.2 Update `VirtualizedCoverageMatrix.tsx` to render section headers spanning all columns.
- [x] 3.3 Preserve section grouping and confidence in matrix export logic.
- [x] 3.4 Update `analysisController.ts` to preserve `section` and `confidence` in report conversion.
- [x] 3.5 Add smoke tests for header rows and badge rendering.

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
| `components/UnifiedCoverageMatrix.tsx` | Modified | Added optional `rows?: MatrixRow[]` prop so v2 section-aware matrices can be rendered directly; falls back to `transformQuotesToMatrix(quotes)` for v1 backward compatibility. Existing section header and confidence badge rendering now supports both paths. |
| `components/VirtualizedCoverageMatrix.tsx` | Modified | Made section header rows span all columns with `w-full` on the header label cell; no insurer cells are rendered for header rows. |
| `server/src/services/excelGenerator.ts` | Modified | Added per-cell confidence to Excel cell notes when `cell.confidence` is present; merged with existing page-number note. |
| `server/src/controllers/analysisController.ts` | Modified | Exported `matrixRowsToComparisonReport()` and extended `UnifiedQuote['coverages']` to carry `confidence` and `section`; conversion tracks the current section header and attaches it to each coverage row. |
| `package.json` / `package-lock.json` | Modified | Added missing `@tanstack/react-virtual` dependency required by `VirtualizedCoverageMatrix`. |
| `src/components/__tests__/UnifiedCoverageMatrix.test.tsx` | Created | Smoke tests for v2 section header rendering, confidence badge text (Exacto/Aproximado/Revisar), and v1 fallback without `rows` prop. |
| `src/components/__tests__/VirtualizedCoverageMatrix.test.tsx` | Created | Smoke tests for section header rendering and data row/cell rendering with mocked `useVirtualizer`. |
| `server/src/services/__tests__/excelGenerator.test.ts` | Modified | Added tests for section header preservation in Excel and confidence note on data cells. |
| `server/src/controllers/__tests__/analysisController.test.ts` | Created | Tests that `matrixRowsToComparisonReport` preserves `confidence` and `section` from v2 MatrixRow cells. |

## TDD Cycle Evidence

### Phase 2 (carried forward from previous batch)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `comparisonPromptBuilder.test.ts` | Unit | 5/5 passing | Written | Passed | 6 cases (sub-rows, section-aware, flexibility, deductible, count, no four-row enforcement) | Clean |
| 2.2 | `flatTableParser.test.ts` | Unit | 14/14 passing | Written | Passed | 5 cases (canonical, EEE alias, specificity, ambiguity, case/accent) | Clean |
| 2.3 | `flatTableParser.test.ts` | Unit | 14/14 passing | Written | Passed | 5 cases (high score, notFound, missing rawText, ambiguous, alias quality) | Clean |
| 2.4 | `matrixTransformer.test.ts` | Unit | 12/12 passing | Written | Passed | 5 cases (headers, section count, ordering, confidence, extras) | Clean |
| 2.5 | `unifiedComparisonEngine.test.ts` | Unit | 6/6 passing | Written | Passed | 2 cases (v2 enabled, v1 disabled) | Clean |
| 2.6 | `flatTableParser.test.ts` | Integration | 14/14 passing | Written | Passed | 4 cases (canonical labels, ambiguous → extraRows, confidence, unmapped) | Clean |

### Phase 3 (this batch)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | `UnifiedCoverageMatrix.test.tsx` | Unit | 16/16 passing | Written | Passed | 3 cases (v2 header, confidence badges, v1 fallback) | Clean |
| 3.2 | `VirtualizedCoverageMatrix.test.tsx` | Unit | N/A (new file) | Written | Passed | 2 cases (header span, data row cells) | Clean |
| 3.3 | `excelGenerator.test.ts` | Unit | 14/14 passing | Written | Passed | 2 cases (section header, confidence note) | Clean |
| 3.4 | `analysisController.test.ts` | Unit | N/A (new file) | Written | Passed | 2 cases (confidence + section preserved, fallback without header) | Clean |
| 3.5 | `UnifiedCoverageMatrix.test.tsx`, `VirtualizedCoverageMatrix.test.tsx` | Unit | see above | Written | Passed | 5 cases across both files | Clean |

### Test Summary
- **Total tests written**: 7 new tests in this batch (3 frontend + 2 frontend + 2 backend)
- **Total tests passing**: 1,061 unit-backend tests passed, 8 skipped; 38 unit-frontend tests passed
- **Layers used**: Unit (frontend + backend); no integration/E2E in this work unit
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: None — all changes are component/export/conversion wiring

## Deviations from Design

1. The v2 parser only supports JSON input (`parseV2` throws for Markdown/CSV). The v2 prompt explicitly requests JSON, so this is acceptable for the first slice. Markdown/CSV v2 parsing can be added in PR 4 if the evaluation harness needs it.
2. The alias ambiguity rule uses exact-match-of-best-alias as a disambiguation gate rather than a simple longest-match. This matches the spec's "Equipo" example and keeps the implementation deterministic and testable.
3. The matrix v2 transformer groups all extra rows under a single `OTROS` section rather than leaving them inline. This keeps the UI section model consistent and is forward-compatible with the export changes planned in PR 3.
4. The tooltip with canonical name, match method, and value source was not implemented because `MatrixCell` does not currently carry those fields. The existing tooltip shows confidence, page evidence, raw text snippet, and justification. This is a UI gap to revisit if the backend transformer is updated to populate those fields.

## Issues Found

- Pre-existing TypeScript errors in `tsconfig.json` (frontend type-check) are unrelated to this PR; backend `tsc --noEmit` passes cleanly. The new/modified files do not introduce new type errors.
- Pre-existing unit-backend failures in `server/src/scripts/__tests__/runEvaluation.test.ts` (timeout and insurer-name mismatch) are evaluation harness issues and are out of scope for PR 3 (PR 4 will address the evaluation harness).

## Remaining Tasks

### Phase 4: Evaluation & Tests (PR 4)

- [ ] 4.1 Update `extractionQualityEval.ts` to use variable row counts, label-based matching, and regenerate baseline.
- [ ] 4.2 Create Vitest harness for 3-quote baseline match-rate >= 90%.
- [ ] 4.3 Add fallback-rate guard (<= 10%) to CI test.
- [ ] 4.4 Verify v1 cached objects render through legacy matrix path.

## Workload / PR Boundary

- **Mode**: stacked-to-main
- **Current work unit**: PR 3 — Frontend + export (section headers, confidence badges, virtualized matrix, export preservation)
- **Boundary**: Starts from PR 2 Core Backend (v2 prompt, parser, transformer, engine wiring). Ends with frontend/export integration and tests passing.
- **Estimated review budget impact**: ~280 changed lines (implementation + tests + dependency fix). This stays within the 400-line soft target for this focused slice.

## Status

16/16 Phase 1 + Phase 2 + Phase 3 tasks complete. PR 3 is ready for verify. Next step: PR 4 Evaluation harness.

## Verification

- `npm run typecheck:backend`: PASS
- `npm run typecheck:frontend`: Pre-existing errors (not introduced by this PR); affected files compile successfully
- `npm run test:unit:backend`: PASS for affected areas (2 pre-existing failures in `runEvaluation.test.ts`, PR 4 scope)
- `npm run test:unit:frontend`: PASS (38 tests passed)
- Affected unified-comparison tests: PASS

## Chain Context

```
PR 1 Foundation ──► PR 2 Core backend ──► PR 3 Frontend + export ──► PR 4 Evaluation harness
                                                             📍
```

- **PR 1**: Already merged to main (Foundation: schema v2, feature flag, adapter routing).
- **PR 2**: Core backend — v2 prompt, parser, transformer, engine wiring.
- **PR 3** (📍 current): Frontend + export — section headers, confidence badges, virtualized matrix, export preservation.
- **PR 4**: Evaluation harness — baseline, match-rate >= 90%, fallback-rate guard.
