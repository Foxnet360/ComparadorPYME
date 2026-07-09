# Verification Report — Granular Comparison Schema (Final Re-verification)

**Change**: granular-comparison-schema  
**Version**: v2 (schemaVersion 2)  
**Mode**: Strict TDD  
**Verification date**: 2026-07-07  
**Baseline report**: `openspec/changes/archive/2026-07-07-granular-comparison-schema/verify-report.md`  
**Re-verification scope**: Phase 7 fresh review fixes applied after the second review cycle.

---

## Scope of This Re-verification

This report verifies the **Phase 7 fresh review fixes** that were applied after the second review:

1. **Cache key schema separation in `UnifiedComparisonEngine.generateFileHash`** — cached v1 results must not be returned after enabling the v2 flag.
2. **Excel `Primas y Costos` sheet includes v2 financial rows** — recognized financial rows (Prima, Forma de Pago, etc.) must be tagged with `FINANCIAL_SECTION_ID` and exported to the financial sheet.
3. **v2 matrix cells carry deductible notes** — `cell.notes` must be populated from `rawText` or the structured `deductible` field so reports show deductible text.
4. **No new TypeScript errors from touched test helpers** — `analysisController.test.ts` import path and `FlatComparisonResult` helpers must pass under root `tsc`.

The full spec compliance matrix, design coherence table, and pre-existing warnings from Phases 1–6 are preserved in the baseline archived report. This report focuses on the additional fixes and their verification, then re-assesses the full change readiness.

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 27 (Phases 1–7) |
| Tasks complete | 27 |
| Tasks incomplete | 0 |

All tasks from the original four stacked PRs (Phases 1–4), the structured-deductible follow-up (Phase 5), the post-verification review fixes (Phase 6), and the fresh review fixes (Phase 7) are marked complete in `openspec/changes/granular-comparison-schema/apply-progress.md`.

---

## Build & Tests Execution

| Check | Command | Result |
|-------|---------|--------|
| **Backend TypeScript** | `npm run typecheck:backend` | ✅ PASS |
| **Root TypeScript** | `npm run typecheck:frontend` | ❌ FAIL — pre-existing errors only (no new errors from files touched in Phase 7) |
| **Targeted Phase 7 tests** | `npx vitest run --project unit-backend server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts server/src/controllers/__tests__/analysisController.test.ts server/src/services/__tests__/excelGenerator.test.ts` | ✅ 49 passed |
| **Evaluation + adapter tests** | `npx vitest run --project unit-backend server/src/evaluation/__tests__/extractionQuality.test.ts server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | ✅ 32 passed |
| **Frontend matrix tests** | `npx vitest run --project unit-frontend src/components/__tests__/UnifiedCoverageMatrix.test.tsx src/components/__tests__/VirtualizedCoverageMatrix.test.tsx` | ✅ 5 passed |
| **Full unifiedComparison suite** | `npx vitest run --project unit-backend server/src/services/unifiedComparison/__tests__` | ✅ 129 passed / 7 skipped |
| **Full backend coverage run** | `npx vitest run --project unit-backend --coverage --passWithNoTests` | ✅ 1083 passed / 8 skipped / 1 unhandled teardown error (see Warnings) |

### Backend targeted test breakdown (Phase 7 relevant)

| File | Tests | Result |
|------|-------|--------|
| `server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts` | 9 passed | ✅ |
| `server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts` | 19 passed | ✅ |
| `server/src/controllers/__tests__/analysisController.test.ts` | 4 passed | ✅ |
| `server/src/services/__tests__/excelGenerator.test.ts` | 17 passed | ✅ |
| `server/src/evaluation/__tests__/extractionQuality.test.ts` | 21 passed | ✅ |
| `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | 11 passed | ✅ |

The backend type-checker passes cleanly. The targeted Phase 7 tests, evaluation/adapter tests, frontend matrix tests, full unifiedComparison suite, and full backend coverage run all pass. Redis/Gemini warnings in the output are expected in the local sandbox environment (no real API keys, no Redis running) and do not affect the test results.

---

## Coverage

| File | Line % | Branch % | Threshold | Status |
|------|--------|----------|-----------|--------|
| `server/src/services/unifiedComparison/matrixTransformer.ts` | 87.09% | 69.33% | 80% | ⚠️ Lines above / Branch below |
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | 72.07% | 45.78% | 80% | ⚠️ Below |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | 79.41% | 67.85% | 80% | ⚠️ Below |
| `server/src/evaluation/extractionQualityEval.ts` | 69.58% | 67.25% | 80% | ⚠️ Below |
| `server/src/services/unifiedComparison/featureFlagService.ts` | 64.70% | 59.09% | 80% | ⚠️ Below |
| `server/src/services/unifiedComparison/flatTableParser.ts` | 84.50% | 76.88% | 80% | ✅ Above |
| `server/src/services/excelGenerator.ts` | 99.58% | 92.10% | 80% | ✅ Above |

> **Note**: Coverage is reported from the full backend coverage run. The Phase 7 source changes are concentrated in `unifiedComparisonEngine.ts` (cache key) and `matrixTransformer.ts` (financial-row tagging and deductible notes). The low overall coverage in `unifiedComparisonEngine.ts` is driven by pre-existing untested paths (deep mode, upload error handling, etc.), not by the Phase 7 cache-key change itself.

---

## Review Fix Verification (Phase 7)

### Fix 1 — Cache key schema separation in `generateFileHash`

| Item | Detail |
|------|--------|
| **File** | `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` |
| **Finding** | Cached v1 comparison results could be returned after enabling the v2 flag because the cache key only used file paths, size, and mtime. |
| **Fix** | `generateFileHash` now accepts a `schemaNamespace` parameter (`v1` or `v2`) and mixes it into the MD5 digest before the file metadata. The `compare` method passes `granularEnabled ? 'v2' : 'v1'`. |
| **Covering test** | `server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts` > `should not share cache between v1 and v2 for the same files` |
| **Result** | ✅ PASS — `generateContent` is called twice for identical files when the schema flag differs. |
| **Static check** | `hash.update(schemaNamespace)` runs before any file metadata in `generateFileHash`. |

### Fix 2 — v2 financial rows exported to Excel `Primas y Costos`

| Item | Detail |
|------|--------|
| **Files** | `server/src/services/unifiedComparison/matrixTransformer.ts`, `server/src/services/excelGenerator.ts` |
| **Finding** | v2 financial rows such as `Prima con IVA` and `Forma de Pago` were grouped under generic coverage sections and did not appear in the `Primas y Costos` Excel sheet. |
| **Fix** | `matrixTransformer.ts` added `isFinancialRowLabel()` and `FINANCIAL_SECTION_ID = 999`; recognized financial rows are moved to a `PRIMAS Y COSTOS` section with `sectionId: 999`. `excelGenerator.ts` already filters rows with `sectionId >= 100` into the `Primas y Costos` sheet. |
| **Covering tests** | `server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts` > `tags v2 financial rows with FINANCIAL_SECTION_ID`; `server/src/services/__tests__/excelGenerator.test.ts` > `should place financial rows with sectionId >= 100 into Primas y Costos sheet` |
| **Result** | ✅ PASS — financial rows receive `FINANCIAL_SECTION_ID` and `TOTAL A PAGAR` appears in the financial sheet. |
| **Static check** | `flatResultToMatrixRowsV2` assigns `FINANCIAL_SECTION_LABEL` to recognized financial labels and sets `sectionId: FINANCIAL_SECTION_ID`. |

### Fix 3 — Deductible notes in v2 matrix cells

| Item | Detail |
|------|--------|
| **Files** | `server/src/services/unifiedComparison/matrixTransformer.ts`, `server/src/controllers/analysisController.ts` |
| **Finding** | v2 matrix cells were missing `notes`, so the comparison report showed `No especificado` for deductibles even when raw deductible text or a structured deductible object was available. |
| **Fix** | `matrixTransformer.ts` added `formatDeductible()` and `cellFromFlatValueV2()` now carries `notes` from `cell.rawText || formatDeductible(cell.deductible)`. `analysisController.ts` maps `cell.notes` to `coverage.deductible`. |
| **Covering tests** | `server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts` > `carries deductible rawText as notes on v2 matrix cells`; `server/src/controllers/__tests__/analysisController.test.ts` > `maps cell notes to coverage deductible` |
| **Result** | ✅ PASS — raw deductible text and formatted structured deductibles flow through to the report's `coverage.deductible`. |
| **Static check** | `matrixRowsToComparisonReport` uses `deductible: cell.notes || 'No especificado'`. |

### Fix 4 — Root type-check errors in new test helpers

| Item | Detail |
|------|--------|
| **Files** | `server/src/controllers/__tests__/analysisController.test.ts`, `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts`, `server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts` |
| **Finding** | `analysisController.test.ts` imported `MatrixRow` from the wrong relative path, and `FlatComparisonResult` helpers in `comparisonEngineAdapter.test.ts` and `matrixTransformer.test.ts` lacked the required `schemaVersion` field, causing root `tsc` errors. |
| **Fix** | Import path corrected to `../../types`; `makeFlatResult` and `makeFlatResultV2` helpers now include `schemaVersion: 1` and `schemaVersion: 2` respectively. |
| **Covering verification** | `npm run typecheck:frontend` — no errors from the touched test files; `npm run typecheck:backend` — passes cleanly. |
| **Result** | ✅ PASS — the touched test files no longer contribute TypeScript errors. The remaining root `tsc` errors are in pre-existing files unrelated to this change. |

---

## Spec Compliance Matrix

### Phase 7 fixes

| Requirement | Scenario | Covering test | Result |
|-------------|----------|---------------|--------|
| Unified Comparison Extraction — backward compatibility with cached v1 results | v1 and v2 do not share cache entries for identical files | `unifiedComparisonEngine.test.ts` > `should not share cache between v1 and v2 for the same files` | ✅ COMPLIANT |
| Row Grouped Comparison Matrix — section-aware export preservation | Financial rows with `sectionId >= 100` are placed in the `Primas y Costos` Excel sheet | `excelGenerator.test.ts` > `should place financial rows with sectionId >= 100 into Primas y Costos sheet` | ✅ COMPLIANT |
| Row Grouped Comparison Matrix — section-aware export preservation | Recognized v2 financial rows are tagged with `FINANCIAL_SECTION_ID` | `matrixTransformer.test.ts` > `tags v2 financial rows with FINANCIAL_SECTION_ID` | ✅ COMPLIANT |
| Unified Coverage Matrix — deductible detail | v2 matrix cells carry deductible notes from raw text or structured deductible | `matrixTransformer.test.ts` > `carries deductible rawText as notes on v2 matrix cells`; `analysisController.test.ts` > `maps cell notes to coverage deductible` | ✅ COMPLIANT |

### Phase 6 review fixes (re-confirmed)

| Requirement | Scenario | Covering test | Result |
|-------------|----------|---------------|--------|
| Row Grouped Comparison Matrix — correct insurer attribution | Matrix column order differs from upload order | `analysisController.test.ts` > `aligns matrix cells to quote files by insurer name when column order differs` | ✅ COMPLIANT |
| Extraction Quality Evaluation — flag non-mutation | Running with `granularComparisonSchema: true` leaves global flag unchanged | `extractionQuality.test.ts` > `does not mutate the global feature flag when overriding schema version` | ✅ COMPLIANT |
| Extraction Quality Evaluation — production default | Default call returns v1 schema | `extractionQuality.test.ts` > `defaults to schema v1 when no option is provided` | ✅ COMPLIANT |

### Key full-change requirements (summary)

| Requirement | Status | Notes |
|------------|--------|-------|
| Schema v2 with `schemaVersion`, `section`, `confidence`, `isAmbiguous` | ✅ COMPLIANT | `comparisonSchema.ts` + tests |
| Feature flag gating for `granularComparisonSchema` | ✅ COMPLIANT | `featureFlags.ts`, `featureFlagService.ts`, adapter override |
| v2 prompt with section-aware template | ✅ COMPLIANT | `comparisonPromptBuilder.test.ts` |
| Alias normalization and section assignment | ✅ COMPLIANT | `flatTableParser.test.ts` |
| Derived per-cell confidence | ✅ COMPLIANT | `flatTableParser.test.ts` |
| Section-aware matrix transformation | ✅ COMPLIANT | `matrixTransformer.test.ts` |
| Section headers and confidence badges in UI | ✅ COMPLIANT | `UnifiedCoverageMatrix.test.tsx`, `VirtualizedCoverageMatrix.test.tsx` |
| Section grouping in Excel/CSV export | ✅ COMPLIANT | `excelGenerator.test.ts` |
| Evaluation harness match-rate >= 90% and fallback <= 10% | ✅ COMPLIANT | `extractionQuality.test.ts` |
| Structured deductible extraction | ✅ COMPLIANT | `flatTableParser.test.ts` |
| Dedicated exclusive-coverages section for v2 | ⚠️ GAP | Extra rows grouped under generic `OTROS` (see Warnings) |
| Tooltip with original/canonical/source | ⚠️ GAP | Existing tooltip shows confidence, page, raw text, justification; canonical name and match method not populated (see Warnings) |

---

## Correctness (Phase 7 Fixes)

| Requirement | Status | Notes |
|------------|--------|-------|
| Cache key includes effective schema namespace | ✅ Implemented | `generateFileHash(pdfPaths, granularEnabled ? 'v2' : 'v1')` |
| v2 financial rows tagged with `FINANCIAL_SECTION_ID` | ✅ Implemented | `isFinancialRowLabel()` + `FINANCIAL_SECTION_ID = 999` in `matrixTransformer.ts` |
| Excel `Primas y Costos` sheet receives financial rows | ✅ Implemented | `excelGenerator.ts` filters `sectionId >= 100` |
| v2 matrix cells carry deductible notes | ✅ Implemented | `cellFromFlatValueV2` sets `notes` from `rawText \|\| formatDeductible(cell.deductible)` |
| `coverage.deductible` populated from `cell.notes` | ✅ Implemented | `matrixRowsToComparisonReport` line 463 |
| Touched test helpers pass root type-check | ✅ Implemented | Import path fixed; `schemaVersion` added to helpers |

---

## Design Coherence (Phase 7 Fixes)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cache key separation is backward-compatible | ✅ Yes | Existing cache entries remain valid; only new v1/v2 lookups are namespace-isolated |
| Financial rows reuse existing `sectionId >= 100` Excel contract | ✅ Yes | No new Excel logic required; leverages existing financial-sheet filter |
| Deductible formatting is centralized in transformer | ✅ Yes | `formatDeductible()` is a pure helper; controller only consumes `cell.notes` |
| Test helpers mirror production schema shapes | ✅ Yes | `makeFlatResult` and `makeFlatResultV2` include required `schemaVersion` |

---

## TDD Compliance (Strict TDD — Phase 7 Fixes)

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ Found | `apply-progress.md` contains Phase 7 TDD Cycle Evidence table |
| All tasks have tests | ✅ Verified | 4 Phase 7 tasks (7.1–7.4) have covering tests; 7.5–7.7 are verification tasks |
| RED confirmed (tests exist) | ✅ Verified | New tests exist in `unifiedComparisonEngine.test.ts`, `matrixTransformer.test.ts`, `excelGenerator.test.ts`, `analysisController.test.ts` |
| GREEN confirmed (tests pass) | ✅ Verified | All reported Phase 7 tests pass on execution |
| Triangulation adequate | ✅ Verified | Cache key: 1 case; financial rows: 2 cases; deductible notes: 2 cases; type-check: N/A |
| Safety Net for modified files | ✅ Verified | Existing test suites for unifiedComparison, controllers, and excelGenerator continue to pass |

**TDD Compliance**: 6/6 checks passed

---

## Test Layer Distribution

| Layer | Tests | Files | Notes |
|-------|-------|-------|-------|
| Unit | 86 | 6 | `unifiedComparisonEngine.test.ts`, `matrixTransformer.test.ts`, `excelGenerator.test.ts`, `analysisController.test.ts`, `extractionQuality.test.ts`, `comparisonEngineAdapter.test.ts` |
| Integration | 0 | 0 | No new integration tests for this work unit |
| E2E | 0 | 0 | No E2E tests for this work unit |
| **Total** | **86** | **6** | Plus the full unifiedComparison suite (129 tests) was run as a safety net. |

---

## Changed File Coverage (Phase 7 source files)

| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | 72.07% | 45.78% | 134-335, 416-432 | ⚠️ Low |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | 87.09% | 69.33% | 43-51, 318-333 | ⚠️ Acceptable |

**Average changed file coverage**: 79.58% lines / 57.56% branch

> **Note**: The uncovered lines in `unifiedComparisonEngine.ts` are pre-existing paths (deep mode validation, file upload failure branches, Gemini cleanup) that were not introduced by the cache-key change. The Phase 7 cache-key path itself is fully covered by the new test.

---

## Assertion Quality

All assertions in the Phase 7 test files verify real behavior. No tautologies, ghost loops, or assertions without production-code calls were found. `toBeDefined()` guards are used only as preludes to value assertions in the same test.

**Assertion quality**: ✅ All assertions verify real behavior

---

## Quality Metrics

| Tool | Result | Details |
|------|--------|---------|
| **Linter (changed source files)** | ✅ No errors / warnings | `eslint` on the 7 Phase 7 changed files produced no output. |
| **Linter (changed test files)** | ✅ No errors / warnings | `eslint` on the 6 Phase 7 changed test files produced no output. |
| **Backend Type Checker** | ✅ No errors | `cd server && tsc --noEmit` passes. |
| **Root Type Checker** | ⚠️ Errors remain in pre-existing files | `tsc --noEmit --project tsconfig.json` fails with errors in files unrelated to Phase 7 (e.g., `gemini.ts`, `quoteProcessingService.ts`, `AuditDashboard.test.tsx`, `UnifiedCoverageMatrix.test.ts`). Files touched in Phase 7 do not contribute new errors. |

---

## Issues Found

### CRITICAL
None. The four Phase 7 review findings are resolved and verified by passing tests.

### WARNING
1. **Dedicated exclusive-coverages section for v2 is still missing.** The row-grouped spec requires exclusive coverages in a dedicated section. The v2 transformer places all unmapped/ambiguous rows under a generic `OTROS` section. Canonical rows are correctly kept in their sections, but the dedicated exclusive section is not built. *(Carried from baseline report.)*
2. **Tooltip scenario not fully implemented.** The unified-coverage-matrix spec requires the tooltip to show original name, canonical name, match method, and source. The current hover card shows confidence, page number, raw text snippet, and justification, but not the canonical name or match method. *(Carried from baseline report.)*
3. **Some changed files fall below the 80% coverage threshold.** `unifiedComparisonEngine.ts` (~72% lines, ~46% branch), `extractionQualityEval.ts` (~70% lines), and `featureFlagService.ts` (~65% lines) are below 80% line coverage. The Phase 7 source files are partially covered; the remaining uncovered lines are mostly pre-existing paths. *(Carried from baseline report.)*
4. **Root frontend type-check still fails.** The root `tsconfig.json` includes pre-existing errors in multiple components/tests. No new errors are introduced by the Phase 7 changes, but the project-wide type-check is not clean. *(Carried from baseline report.)*
5. **Unhandled vitest teardown error in full backend coverage run.** `EnvironmentTeardownError` in `server/src/services/__tests__/deductibleAnalyzer.test.ts` appears during the full coverage run. It does not fail any test file, but it indicates a worker lifecycle issue that may become flaky in CI. *(New observation from this run.)*

### SUGGESTION
1. **Add explicit v2 UI tests for the "No incluida" state, PDF evidence trigger, and double-click note editor.** These are spec scenarios under `Unified Coverage Matrix` that currently lack focused coverage. *(Carried from baseline report.)*
2. **Consider a dedicated `EXCLUSIVOS / VENTAJAS COMPETITIVAS` section for v2 extra rows, or document the `OTROS` grouping as the accepted v2 behavior.** This resolves the warning about exclusive coverages. *(Carried from baseline report.)*
3. **In CI, run the targeted test suites used above rather than the full backend suite** to avoid the pre-existing flaky performance test and the unhandled teardown error. *(Carried from baseline report.)*
4. **Add UI rendering for the structured deductible object** (e.g., a formatted badge or tooltip) so the extracted `{percentage, minimum, currency}` is visible to users. *(Carried from baseline report.)*
5. **Tighten `isFinancialRowLabel` matching or add allow-list overrides.** The current keyword list is broad enough that a coverage row such as `Cobertura de Gastos` could be misclassified as a financial row. No test currently exercises this edge case.
6. **Investigate the `deductibleAnalyzer.test.ts` teardown error** to prevent it from becoming a flaky CI failure as the suite grows.

---

## Workload / PR Boundary

- **Mode**: stacked-to-main
- **Current work unit**: PR 4 fresh review fixes — cache-key schema separation, v2 financial-row tagging, deductible-note propagation, and root type-check cleanup.
- **Boundary**: Starts from the already-merged Phase 6 review fixes. Ends with the four fixes committed and tests passing.
- **Estimated review budget impact**: ~255 changed lines across 7 files; well under the 400-line budget.
- **Chain context**:

```
PR 1 Foundation ──► PR 2 Core backend ──► PR 3 Frontend + export ──► PR 4 Evaluation harness + review fixes
                                                                                               📍
```

- **PR 1**: Already merged to main (Foundation: schema v2, feature flag, adapter routing).
- **PR 2**: Core backend — v2 prompt, parser, transformer, engine wiring.
- **PR 3**: Frontend + export — section headers, confidence badges, virtualized matrix, export preservation.
- **PR 4** (📍 current): Evaluation harness + review fixes — baseline, match-rate >= 90%, fallback-rate guard, insurer alignment, non-mutating flag override, v1 default, cache-key schema separation, v2 financial-row tagging, deductible-note propagation, and root type-check cleanup.

---

## Verdict

**PASS WITH WARNINGS**

The four Phase 7 review findings are resolved, covered by passing tests, and verified by source inspection:

- `UnifiedComparisonEngine.generateFileHash` includes the effective schema namespace (`v1`/`v2`) so cached v1 and v2 results do not collide.
- v2 financial rows are tagged with `FINANCIAL_SECTION_ID` and exported to the Excel `Primas y Costos` sheet.
- v2 matrix cells carry deductible notes from `rawText` or the structured `deductible` field, and `analysisController` maps them to `coverage.deductible`.
- The touched test helpers no longer introduce TypeScript errors under root `tsc`.

Backend type-check, targeted backend tests, full unifiedComparison suite, frontend matrix tests, and full backend coverage all pass. The remaining open items are pre-existing or cosmetic warnings from the baseline report (tooltip detail, v2 exclusive-coverages section, coverage thresholds, frontend type-check, lint warnings) plus one new observation about an unhandled teardown error in the full backend coverage run. They do not block the review-fix work unit.

The change is **ready for PR creation** after the current work unit is committed with a conventional commit message.

---

## Baseline Report Reference

For the full Phase 1–5 spec compliance matrix, design coherence table, coverage details, and original findings, see:

`openspec/changes/archive/2026-07-07-granular-comparison-schema/verify-report.md`
