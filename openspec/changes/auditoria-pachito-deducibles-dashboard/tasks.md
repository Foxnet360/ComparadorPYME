# Tasks: Auditoría Pachito — Deducibles y Dashboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~230 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | feature-branch-chain (single PR because change is under budget) |
| Decision needed before apply | No |

## Phase 1: Backend Extraction Fix

- [x] 1.1 Fix V2 transformer financial-section mapping for extraRows
  - **File:** `server/src/services/unifiedComparison/matrixTransformer.ts`
  - **What:** Apply the same `isFinancialRowLabel` / `FINANCIAL` → `PRIMAS Y COSTOS` mapping used for canonical rows to the `extraRows` before grouping.
  - **Acceptance:** A V2 fixture with a financial row in `extraRows` produces `sectionId: 100`.
  - **Tests:** Add/update `matrixTransformer.test.ts`.

- [x] 1.2 Align V2 deductible prompt with granular list
  - **File:** `server/src/services/unifiedComparison/comparisonPromptBuilder.ts`
  - **What:** Update the DEDUCIBLES business rule to list all 13 granular deductible rows and remove the instruction that allows the model to omit rows.
  - **Acceptance:** The prompt text contains the full list and explicitly asks to include every deductible present in the quotes.
  - **Tests:** Update `comparisonPromptBuilder.test.ts` if it asserts prompt text.

## Phase 2: Frontend Presentation Fix

- [x] 2.1 Filter DeductibleMatrix to show only specified rows
  - **File:** `components/DeductibleMatrix.tsx`
  - **What:** Before rendering rows, filter so that a row is only kept if at least one quote has a deductible that is not empty, "No especificado", "No aplica", or "N/A".
  - **Acceptance:** A coverage with only unspecified deductibles for all quotes does not render a row.
  - **Tests:** Update `src/components/__tests__/DeductibleMatrix.test.tsx`.

- [x] 2.2 Remove full-text deductible section from Deducibles tab
  - **File:** `components/ComparisonReport.tsx`
  - **What:** Delete the "Texto Completo de Deducibles" collapsible block inside the `activeTab === 'deducibles'` branch.
  - **Acceptance:** The Deducibles tab only renders `DeductibleMatrix`.
  - **Tests:** Update `ComparisonReport.test.tsx` if it checks for the full-text section.

- [x] 2.3 Group all deductible rows under DEDUCIBLES section in coverage matrix
  - **File:** `components/UnifiedCoverageMatrix.tsx` (specifically `transformQuotesToMatrix`)
  - **What:** Move all rows that are deductible rows (e.g., labels matching deductible categories or categories that have deductible rows) into the `DEDUCIBLES` business section instead of spreading them across `BIENES ASEGURADOS` and `COBERTURAS`.
  - **Acceptance:** The coverage matrix shows a single `DEDUCIBLES` section containing all deductible rows.
  - **Tests:** Update `UnifiedCoverageMatrix.test.tsx` or add a test.

## Phase 3: Verification

- [x] 3.1 Run unit tests
  - **Command:** Backend: `npm run test:backend -- matrixTransformer` and `npm run test:backend -- comparisonPromptBuilder`. Frontend: `npm run test:frontend -- DeductibleMatrix`.
  - **Acceptance:** All targeted tests pass.

- [x] 3.2 Run full test suites
  - **Command:** `npm run test:backend` and `npm run test:frontend`.
  - **Acceptance:** No regressions.

- [x] 3.3 Validate with Pachito example
  - **Command:** Run a local analysis with the Pachito el Chef PDFs.
  - **Acceptance:** Both quotes show non-zero `priceAnnual`, savings card shows a real value, and all extracted deductibles appear in the matrix.

## Phase 4: Delivery

- [x] 4.1 Create feature branch and commit
  - **Branch:** `feature/auditoria-pachito-deducibles-dashboard`
  - **Commit:** Work-unit commits for backend fix, frontend fix, and tests.

- [x] 4.2 Open PR and merge
  - **Base:** `main`
  - **Acceptance:** PR review passes and CI is green.

- [x] 4.3 Deploy to Railway
  - **Action:** Trigger Railway deployment after merge.
  - **Acceptance:** Production no longer shows the client/technical toggle, and dashboard shows correct prices/savings.
