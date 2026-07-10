# Design: Auditoría Pachito — Deducibles y Dashboard

## Technical Approach

This change is a surgical fix on top of the V2 unified comparison pipeline. It addresses two root causes:

1. **Financial rows from the LLM are not reaching the financial section** because the V2 transformer only applies the financial label heuristic to canonical rows, not to `extraRows`. This breaks premium extraction and causes the semantic matcher to treat billing labels as coverages.
2. **The deductible presentation is noisy** because the matrix shows unspecified rows and the tab includes a fallback full-text block.

The design follows the existing patterns in the codebase: keep the V2 engine as the default, make the transformer and prompt more deterministic, and make the frontend components data-driven.

## Files to Change

### Backend

| File | Change |
|------|--------|
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Apply `isFinancialRowLabel` / `FINANCIAL` → `PRIMAS Y COSTOS` mapping to `extraRows` before grouping; ensure all financial rows get `sectionId: 100`. |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Align the DEDUCIBLES business rule with the granular list; instruct the model to include all deductibles present in the quotes. |
| `server/src/controllers/analysisController.ts` | No logic change required; once section IDs are correct, the existing premium extraction and financial-row skip will work. Add/update a unit test to protect against regression. |

### Frontend

| File | Change |
|------|--------|
| `components/DeductibleMatrix.tsx` | Filter rows: only render if at least one quote has a specified deductible. |
| `components/ComparisonReport.tsx` | Remove the "Texto Completo de Deducibles" collapsible block from the Deducibles tab. |
| `components/UnifiedCoverageMatrix.tsx` | Move all deductible rows (by label or category) into the `DEDUCIBLES` business section. |
| `src/components/__tests__/DeductibleMatrix.test.tsx` | Update tests to match the new filtering behavior. |
| `server/src/services/unifiedComparison/__tests__/matrixTransformer.test.ts` | Add tests for financial `extraRows` mapping. |

### Deployment

- Merge the PR and trigger a Railway deployment. The client/technical toggle is already removed in source; a new deployment is sufficient.

## Data Flow

1. `unifiedComparisonEngine.compare()` calls `flatTableParser.parseV2()` → returns `FlatComparisonResultV2` with rows/extraRows and sections.
2. `matrixTransformer.flatResultToMatrixRowsV2()` groups rows into sections. After the fix, all rows with financial labels or `section: FINANCIAL` are mapped to `PRIMAS Y COSTOS` and `sectionId: 100`.
3. `analysisController.matrixRowsToComparisonReport()` skips section 100 rows for coverage matching and extracts `priceAnnual` from them.
4. `quoteScorer.calculateScore()` computes price-based and differentiated scores now that `priceAnnual > 0`.
5. Frontend components receive `report.quotes` with correct prices and deductibles, then render filtered rows and grouped sections.

## Edge Cases

- **Financial row with no parseable value:** `priceAnnual` remains 0; dashboard shows "No disponible" for savings. This is the existing behavior and is acceptable.
- **Deductible row where all quotes are unspecified:** row is filtered out. This is intentional.
- **Deductible row where one quote is specified and another is not:** row is shown, with the unspecified cell rendered as "No especificado".
- **LLM returns a financial row as an extraRow with ambiguous label:** `isFinancialRowLabel` heuristic must catch it. The current keyword list is broad enough to cover `prima`, `iva`, `pago`, `gastos`, `subtotal`, etc.
- **LLM omits a deductible row despite the prompt:** frontend filtering will not create a row for it; this is a data-quality issue, not a UI bug. The prompt change is the mitigation.

## Test Strategy

- **Unit tests:**
  - `matrixTransformer.test.ts`: add a V2 fixture with a financial row in `extraRows` and assert it receives `sectionId: 100`.
  - `comparisonPromptBuilder.test.ts`: assert the DEDUCIBLES business rule includes the full granular list and does not contain the "omit" instruction.
  - `DeductibleMatrix.test.tsx`: assert that a coverage with only unspecified deductibles is not rendered; assert that a coverage with at least one specified deductible is rendered.

- **Integration / end-to-end:**
  - Run the Pachito el Chef example locally and confirm that both quotes receive a non-zero `priceAnnual`, the savings card shows a real value, and the DeductibleMatrix shows all extracted deductibles.

- **Regression:**
  - Run the full backend and frontend test suites before merging.

## Rollback

- If V2 extraction degrades, disable `granularComparisonSchema` via the feature-flag system to fall back to the legacy per-quote pipeline.
- If frontend changes cause issues, revert the specific commits touching `DeductibleMatrix.tsx`, `ComparisonReport.tsx`, and `UnifiedCoverageMatrix.tsx`.

## Next Steps

Break this design into implementation tasks.
