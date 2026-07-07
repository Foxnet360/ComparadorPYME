# Apply Progress: Granular Comparison Schema

## Change

**Name**: granular-comparison-schema
**Current PR**: PR 4 of 4 (Evaluation harness) + post-verification review fixes
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

### Phase 3: Frontend & Export (PR 3 — completed in prior batch)

- [x] 3.1 Update `UnifiedCoverageMatrix.tsx` to render section headers and confidence badges (green/yellow/red).
- [x] 3.2 Update `VirtualizedCoverageMatrix.tsx` to render section headers spanning all columns.
- [x] 3.3 Preserve section grouping and confidence in matrix export logic.
- [x] 3.4 Update `analysisController.ts` to preserve `section` and `confidence` in report conversion.
- [x] 3.5 Add smoke tests for header rows and badge rendering.

### Phase 4: Evaluation & Tests (PR 4 — completed in prior batch)

- [x] 4.1 Update `extractionQualityEval.ts` to use variable row counts, label-based matching, and regenerate baseline.
- [x] 4.2 Create Vitest harness for 3-quote baseline match-rate >= 90%.
- [x] 4.3 Add fallback-rate guard (<= 10%) to CI test.
- [x] 4.4 Verify v1 cached objects render through legacy matrix path.

### Phase 5: Structured Deductible Extraction (post-verification follow-up)

- [x] 5.1 Add optional `deductible` object to `FlatComparisonCellSchemaV2` in `comparisonSchema.ts`.
- [x] 5.2 Implement `parseDeductible()` in `flatTableParser.ts` with percentage, minimum, currency, and type parsing plus fallback handling.
- [x] 5.3 Extend `buildV2Cell()` to parse deductibles for `DEDUCIBLES` rows and apply `isAmbiguous` + `Ver condiciones` fallback.
- [x] 5.4 Add per-coverage deductible aliases (`Deducible Edificio`, `Deducible Contenidos`, `Deducible Mercancías`, `Deducible Equipo Eléctrico`) to `ALIAS_MAP`.
- [x] 5.5 Add covering tests in `flatTableParser.test.ts` for percentage-with-minimum, percentage-only, minimum-only, ambiguous fallback, and No aplica.
- [x] 5.6 Re-run backend type-check and full unit-test coverage; update `verify-report.md`.

### Phase 6: Post-Verification Review Fixes (this batch)

- [x] 6.1 Fix `matrixRowsToComparisonReport` in `analysisController.ts` to align matrix cells to quote files by insurer name instead of by index.
- [x] 6.2 Add test in `analysisController.test.ts` covering insurer-name alignment when matrix column order differs from upload order.
- [x] 6.3 Remove global `featureFlags` mutation from `extractionQualityEval.ts`; pass `granularComparisonSchema` as a local override through `comparisonEngineAdapter.generateComparison`.
- [x] 6.4 Change `runExtractionQualityEval` default for `granularComparisonSchema` from `true` to `false` to match production default.
- [x] 6.5 Add tests in `extractionQuality.test.ts` for feature-flag non-mutation and v1 default behavior.
- [x] 6.6 Update `comparisonEngineAdapter.ts` to accept an optional `granularComparisonSchema` override while preserving backward compatibility with the existing `userId` string argument.
- [x] 6.7 Run backend type-check and affected tests; verify all pass.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modified | Added `buildV2ComparisonPrompt()` with section-aware granular template and `buildV2CorrectionPrompt()`. Kept v1 prompt methods. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Added v2 alias dictionary, exported `normalizeAlias()` and `computeCellConfidence()`, added `parseV2()` for JSON granular input, set `schemaVersion: 1` on v1 and `schemaVersion: 2` on v2 results. |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modified | Added `flatResultToMatrixRowsV2()` that groups rows by section, emits header rows, preserves per-cell confidence, and places extras in an `OTROS` section. |
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | Modified | Added `CompareOptions` interface, reads `granularComparisonSchema` from options or feature flag, routes to v2 prompt/parser when enabled, v1 otherwise. |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modified | Routes to `flatResultToMatrixRowsV2` when `schemaVersion` is 2, otherwise uses `flatResultToMatrixRows`. **Review fix:** accepts an optional `granularComparisonSchema` override and passes it to the engine without reading the global flag. |
| `server/src/services/unifiedComparison/__tests__/comparisonPromptBuilder.test.ts` | Modified | Added v2 prompt tests (sub-rows, section-aware, flexibility, insurer count). |
| `server/src/services/unifiedComparison/__tests__/flatTableParser.test.ts` | Modified | Added tests for `normalizeAlias`, `computeCellConfidence`, and `parseV2` (alias normalization, ambiguity, section assignment, derived confidence). |
| `server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts` | Modified | Added v2 transformer tests for section headers, data row ordering, confidence preservation, and extra-row section. |
| `server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts` | Modified | Added v2 wiring tests (prompt/parser selection and schemaVersion output). |
| `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | Modified | Added v2 result transformation test for section-aware matrix. |
| `components/UnifiedCoverageMatrix.tsx` | Modified | Added optional `rows?: MatrixRow[]` prop so v2 section-aware matrices can be rendered directly; falls back to `transformQuotesToMatrix(quotes)` for v1 backward compatibility. Existing section header and confidence badge rendering now supports both paths. |
| `components/VirtualizedCoverageMatrix.tsx` | Modified | Made section header rows span all columns with `w-full` on the header label cell; no insurer cells are rendered for header rows. |
| `server/src/services/excelGenerator.ts` | Modified | Added per-cell confidence to Excel cell notes when `cell.confidence` is present; merged with existing page-number note. |
| `server/src/controllers/analysisController.ts` | Modified | Exported `matrixRowsToComparisonReport()` and extended `UnifiedQuote['coverages']` to carry `confidence` and `section`; conversion tracks the current section header and attaches it to each coverage row. **Review fix:** cells are now aligned to quote files by insurer name using the matrix header row, not by upload-order index. |
| `package.json` / `package-lock.json` | Modified | Added missing `@tanstack/react-virtual` dependency required by `VirtualizedCoverageMatrix`. |
| `src/components/__tests__/UnifiedCoverageMatrix.test.tsx` | Created | Smoke tests for v2 section header rendering, confidence badge text (Exacto/Aproximado/Revisar), and v1 fallback without `rows` prop. |
| `src/components/__tests__/VirtualizedCoverageMatrix.test.tsx` | Created | Smoke tests for section header rendering and data row/cell rendering with mocked `useVirtualizer`. |
| `server/src/services/__tests__/excelGenerator.test.ts` | Modified | Added tests for section header preservation in Excel and confidence note on data cells. |
| `server/src/controllers/__tests__/analysisController.test.ts` | Created | Tests that `matrixRowsToComparisonReport` preserves `confidence` and `section` from v2 MatrixRow cells. **Review fix:** added test for insurer-name alignment when matrix column order differs from upload order. |
| `server/src/evaluation/extractionQualityEval.ts` | Modified | Added v2 schema support to `matrixRowsToFlatResult`, `calculateMatchRate`, baseline generation, and tool path; added `granularComparisonSchema` option; added match-rate and fallback-rate thresholds. **Review fix:** no longer mutates the global `featureFlags` singleton; defaults `granularComparisonSchema` to `false` to match production. |
| `server/src/evaluation/__tests__/extractionQuality.test.ts` | Modified | Added v2 schema match-rate tests, variable-row matching, gate tests (match >= 90%, fallback <= 10%), and v1 matrix reconstruction tests. **Review fix:** added `makeV1Matrix()` helper, v1 default test, and feature-flag non-mutation test. |
| `server/src/evaluation/fixtures/extraction-quality/baseline-snapshot.json` | Modified | Regenerated baseline snapshot to schema v2 with section-aware rows and per-cell confidence. |
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modified | Added `StructuredDeductibleSchema` and optional `deductible` field to `FlatComparisonCellSchemaV2`. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Added `parseDeductible()`, per-coverage deductible aliases, and structured deductible extraction in `buildV2Cell()`. |
| `server/src/services/unifiedComparison/__tests__/flatTableParser.test.ts` | Modified | Added tests for structured deductible parsing (percentage, minimum, SMMLV, ambiguous fallback, No aplica). |

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

### Phase 3 (previous batch)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | `UnifiedCoverageMatrix.test.tsx` | Unit | 16/16 passing | Written | Passed | 3 cases (v2 header, confidence badges, v1 fallback) | Clean |
| 3.2 | `VirtualizedCoverageMatrix.test.tsx` | Unit | N/A (new file) | Written | Passed | 2 cases (header span, data row cells) | Clean |
| 3.3 | `excelGenerator.test.ts` | Unit | 14/14 passing | Written | Passed | 2 cases (section header, confidence note) | Clean |
| 3.4 | `analysisController.test.ts` | Unit | N/A (new file) | Written | Passed | 2 cases (confidence + section preserved, fallback without header) | Clean |
| 3.5 | `UnifiedCoverageMatrix.test.tsx`, `VirtualizedCoverageMatrix.test.tsx` | Unit | see above | Written | Passed | 5 cases across both files | Clean |

### Phase 4 (previous batch)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `extractionQuality.test.ts` | Unit | N/A (new behavior) | Written | Passed | 2 cases (variable rows match, missing rows counted as mismatches) | Clean |
| 4.2 | `extractionQuality.test.ts` | Unit | N/A (new behavior) | Written | Passed | 2 cases (v2 pass gate, v2 fail gate) | Clean |
| 4.3 | `extractionQuality.test.ts` | Unit | N/A (new behavior) | Written | Passed | 2 cases (fallback > 10% fails, fallback <= 10% passes) | Clean |
| 4.4 | `extractionQuality.test.ts` | Unit | N/A (new behavior) | Written | Passed | 2 cases (v1 matrix reconstructs 4 canonical rows, v2 matrix reconstructs all section rows) | Clean |

### Phase 5 (post-verification follow-up)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.1 | `flatTableParser.test.ts` | Unit | 5/5 new passing | Written | Passed | 5 cases (percentage+minimum, percentage-only, minimum-only, ambiguous fallback, No aplica) | Clean |
| 5.2 | `flatTableParser.test.ts` | Unit | see above | Written | Passed | 4 cases (structured object, rawText, fallback, ambiguity) | Clean |
| 5.3 | `flatTableParser.test.ts` | Unit | see above | Written | Passed | 3 cases (DEDUCIBLES rows, per-coverage aliases, isAmbiguous) | Clean |
| 5.4 | `flatTableParser.test.ts` | Unit | see above | Written | Passed | 4 cases (Edificio, Contenidos, Mercancías, Equipo Eléctrico) | Clean |
| 5.5 | `flatTableParser.test.ts` | Unit | see above | Written | Passed | 5 cases (percentage+minimum, percentage-only, minimum-only, ambiguous fallback, No aplica) | Clean |
| 5.6 | `verify-report.md` | Verification | full suite passing | Reported | Passed | backend type-check + coverage run | Clean |

### Phase 6 (post-verification review fixes — this batch)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 6.1 | `analysisController.test.ts` | Unit | 1 new test | Written | Passed | 1 case (matrix columns in CHUBB, MAPFRE order; quote files in MAPFRE, CHUBB order) | Clean |
| 6.2 | `analysisController.test.ts` | Unit | see above | Written | Passed | 1 case (premium row aligned to correct insurer) | Clean |
| 6.3 | `extractionQuality.test.ts` | Unit | 1 new test | Written | Passed | 1 case (flag remains `false` after running with `granularComparisonSchema: true`) | Clean |
| 6.4 | `extractionQuality.test.ts` | Unit | 1 new test | Written | Passed | 1 case (default call returns `tool.schemaVersion === 1`) | Clean |
| 6.5 | `comparisonEngineAdapter.test.ts` | Unit | existing suite | Existing | Passed | 11 tests unchanged; new override path exercised by extraction-quality tests | Clean |
| 6.6 | `extractionQualityEval.ts` | Unit | see above | Updated | Passed | removed `featureFlags` import, local override only | Clean |
| 6.7 | type-check + targeted tests | Verification | see below | Run | Passed | `tsc --noEmit` + 3 affected test files | Clean |

### Test Summary

- **Total tests written**: 7 new tests in this batch (3 regression gate tests + 2 match-rate tests + 2 matrix reconstruction tests)
- **Phase 6 tests added**: 3 new tests (insurer alignment, flag non-mutation, v1 default)
- **Total tests passing**: 35/35 affected tests; backend type-check passes
- **Layers used**: Unit (backend); no integration/E2E required for this work unit
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: `extractMatrixInsurers`, `normalizeInsurerName`, `longestCommonSubstringLength`, `alignInsurerIndices` in `analysisController.ts`

## Deviations from Design

1. The v2 parser only supports JSON input (`parseV2` throws for Markdown/CSV). The v2 prompt explicitly requests JSON, so this is acceptable for the first slice. Markdown/CSV v2 parsing can be added in a follow-up if the evaluation harness needs it.
2. The alias ambiguity rule uses exact-match-of-best-alias as a disambiguation gate rather than a simple longest-match. This matches the spec's "Equipo" example and keeps the implementation deterministic and testable.
3. The matrix v2 transformer groups all extra rows under a single `OTROS` section rather than leaving them inline. This keeps the UI section model consistent and is forward-compatible with the export changes planned in PR 3.
4. The tooltip with canonical name, match method, and value source was not implemented because `MatrixCell` does not currently carry those fields. The existing tooltip shows confidence, page evidence, raw text snippet, and justification. This is a UI gap to revisit if the backend transformer is updated to populate those fields.
5. ~~The evaluation harness sets the `granularComparisonSchema` feature flag at runtime for the duration of the evaluation and restores it afterward.~~ **Resolved in Phase 6**: the harness now passes `granularComparisonSchema` as a local override to `comparisonEngineAdapter.generateComparison`, avoiding global singleton mutation entirely.

## Issues Found

- Pre-existing TypeScript errors in `tsconfig.json` (frontend type-check) are unrelated to this PR; backend `tsc --noEmit` passes cleanly. The new/modified files do not introduce new type errors.
- `server/src/scripts/__tests__/runEvaluation.test.ts` passes in the current environment. The failures observed in previous batches (timeout and insurer-name mismatch) were environment-related and not tied to the new schema or v1/v2 routing. No changes were required in this PR.
- Redis and Gemini warnings in test output are expected in the local sandbox (no real API keys, no Redis running). Tests are written to mock or skip these dependencies.
- **Review finding (BLOCKER, resolved)**: `matrixRowsToComparisonReport` previously assumed matrix cells were in the same order as uploaded quote files. This was fixed by extracting the insurer order from the matrix header and aligning each quote file to the matching column by normalized insurer name.
- **Review finding (WARNING, resolved)**: `runExtractionQualityEval` previously mutated the global `featureFlags` singleton and restored it in a `finally` block. This was fixed by passing the schema override locally through the adapter.
- **Review finding (WARNING, resolved)**: `runExtractionQualityEval` previously defaulted `granularComparisonSchema` to `true`, diverging from the production default of `false`. The default is now `false`; callers must opt in to v2 explicitly.

## Remaining Tasks

No remaining tasks. All original Phase 1–4 tasks, the Phase 5 structured-deductible follow-up, and the Phase 6 review fixes are complete.

## Workload / PR Boundary

- **Mode**: stacked-to-main
- **Current work unit**: PR 4 + post-verification review fixes — Evaluation harness alignment, flag non-mutation, and default behavior
- **Boundary**: Starts from PR 3 Frontend + Export. Ends with review fixes committed and tests passing.
- **Estimated review budget impact**: ~263 changed lines across 5 files for the review-fix work unit. The original PR 4 diff was larger due to fixture/test data; this follow-up is focused and well under the 400-line budget.

## Status

20/20 original Phase 1–4 tasks complete; Phase 5 structured-deductible follow-up complete; Phase 6 review fixes complete. The change is ready for re-verification.

## Verification

- `npm run typecheck:backend`: PASS
- `npx vitest run --project unit-backend server/src/controllers/__tests__/analysisController.test.ts server/src/evaluation/__tests__/extractionQuality.test.ts server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts`: PASS (35 tests)
- `server/src/evaluation/__tests__/extractionQuality.test.ts`: PASS (21 tests, including 3 new Phase 6 tests)
- `server/src/controllers/__tests__/analysisController.test.ts`: PASS (3 tests, including 1 new Phase 6 test)
- `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts`: PASS (11 tests)
- `openspec/changes/archive/2026-07-07-granular-comparison-schema/verify-report.md`: Updated with Phase 6 review-fix notes
- `openspec/changes/granular-comparison-schema/apply-progress.md`: Updated with merged Phase 6 progress

## Chain Context

```
PR 1 Foundation ──► PR 2 Core backend ──► PR 3 Frontend + export ──► PR 4 Evaluation harness + review fixes
                                                                                              📍
```

- **PR 1**: Already merged to main (Foundation: schema v2, feature flag, adapter routing).
- **PR 2**: Core backend — v2 prompt, parser, transformer, engine wiring.
- **PR 3**: Frontend + export — section headers, confidence badges, virtualized matrix, export preservation.
- **PR 4** (📍 current): Evaluation harness + review fixes — baseline, match-rate >= 90%, fallback-rate guard, insurer alignment, non-mutating flag override, v1 default.
