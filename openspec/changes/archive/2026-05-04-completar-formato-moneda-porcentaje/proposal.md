## Why

The previous change (`formato-moneda-porcentaje-colombiano`) standardized currency and percentage formatting in the dashboard summary but left multiple UI components and PDF generation unformatted. Users currently see raw numeric values like "500000000" instead of "$500.000.000", and percentages like "10" instead of "10%" in critical sections of the application.

## What Changes

- Apply `formatCOP` to coverage values in `UnifiedCoverageMatrix` component
- Apply `formatPercentage` and `formatCOP` to deductible values in `DeductiblesComparisonTable` component
- Apply formatting functions to PDF report generation (`pdfService.ts`)
- Add helper function `formatCOPWithDecimals` for values that need decimal precision
- Ensure consistent formatting across all uncategorized coverage displays

## Capabilities

### New Capabilities
- `coverage-value-formatting`: Standardized formatting for coverage monetary values across all UI components
- `deductible-formatting`: Standardized formatting for deductible percentages and minimum amounts
- `pdf-report-formatting`: Standardized formatting in generated PDF reports

### Modified Capabilities
- None (this is purely formatting enhancement, not behavior change)

## Impact

- Components: `UnifiedCoverageMatrix.tsx`, `DeductiblesComparisonTable.tsx`, `AuditSection.tsx`
- Services: `pdfService.ts`
- Utilities: May need to extend `utils/formatCurrency.ts` with additional helpers
- User-facing: All coverage values, deductibles, and PDF outputs will display with consistent Colombian formatting
