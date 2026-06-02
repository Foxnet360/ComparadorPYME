## Why

The application has inconsistent currency formatting across components. While `formatCOP` utility exists and is used in some places (ComparisonReport, ExecutiveSummary, backend services), critical components like UnifiedCoverageMatrix and VariableComparisonMatrix display raw numeric values like "500000000" instead of "$500.000.000". Previous attempts to fix this were archived but the implementation is incomplete in the current codebase, creating a broken user experience where monetary values appear without proper Colombian formatting.

## What Changes

- Replace inline currency formatting in `UnifiedCoverageMatrix.tsx` with centralized `formatCOP` utility
- Update `VariableComparisonMatrix.tsx` to use `formatCOP` and `formatNumber` for all monetary values  
- Apply `formatCOP` to price fields in `CorrectionUI.tsx`
- Audit and fix remaining components with unformatted monetary values (DeductiblesComparisonTable, DeductibleSummaryTable, etc.)
- Ensure all new code uses centralized formatting utilities instead of inline `toLocaleString()` calls
- Add linting/documentation to prevent future regressions

## Capabilities

### New Capabilities
- `currency-formatting-audit`: Systematic audit process to identify and fix unformatted monetary values across the entire frontend codebase

### Modified Capabilities
- `coverage-value-formatting`: Update requirements to cover all matrix components, not just UnifiedCoverageMatrix
- `deductible-formatting`: Expand scope to include VariableComparisonMatrix and other deductible display components
- `pdf-report-formatting`: Verify PDF generation uses updated formatting consistently

## Impact

- Components: `UnifiedCoverageMatrix.tsx`, `VariableComparisonMatrix.tsx`, `CorrectionUI.tsx`, `DeductiblesComparisonTable.tsx`, `DeductibleSummaryTable.tsx`, and potentially others
- Services: `pdfService.ts` (verification needed)
- Utilities: `utils/formatCurrency.ts` (no changes needed, already complete)
- User-facing: All monetary values (prices, coverage amounts, deductibles, sublimits) will display consistently with Colombian format
