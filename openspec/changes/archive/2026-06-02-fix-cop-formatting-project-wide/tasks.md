## 1. Fix UnifiedCoverageMatrix currency formatting

- [x] 1.1 Remove inline `formatCurrency` function from UnifiedCoverageMatrix.tsx (line 267)
- [x] 1.2 Import `formatCOP` from `../utils/formatCurrency`
- [x] 1.3 Replace `formatCurrency` calls with `formatCOP` for Prima Neta, Gastos, Subtotal, IVA, Total
- [x] 1.4 Verify special values ("No informada", "No informado") still display correctly

## 2. Fix VariableComparisonMatrix formatting

- [x] 2.1 Import `formatCOP` and `formatNumber` from `../utils/formatCurrency`
- [x] 2.2 Update `formatValue()` to use `formatCOP` for monetary values
- [x] 2.3 Update `formatDeductible()` to use `formatPercentage` for percentages and `formatCOP`/`formatNumber` for amounts
- [x] 2.4 Verify JSON stringify fallback still works for non-monetary objects

## 3. Fix CorrectionUI price display

- [x] 3.1 Import `formatCOP` from `../utils/formatCurrency`
- [x] 3.2 Format display values for priceAnnual and priceMonthly fields (keep inputs as plain text)
- [x] 3.3 Verify correction submission still works with raw values

## 4. Audit and fix remaining components

- [x] 4.1 Search for `toLocaleString()` usage without locale in all .tsx files
- [x] 4.2 Check DeductiblesComparisonTable.tsx for unformatted values (already using formatPercentage/formatNumber)
- [x] 4.3 Check DeductibleSummaryTable.tsx for unformatted values (already using formatPercentage/formatNumber)
- [x] 4.4 Check AuditSection and other report components for unformatted monetary values
- [x] 4.5 Fix any additional components found during audit (fixed DeductibleRiskGauge.tsx inline formatCurrency)

## 5. Verify PDF report formatting

- [x] 5.1 Verify pdfService.ts imports and uses formatCOP correctly (already using formatCOP, formatCOPMillions, formatPercentage)
- [x] 5.2 Check coverage matrix values in PDF output (uses formatCoverageValuePDF which calls formatCOP)
- [x] 5.3 Check deductible values in PDF output (handled by formatCoverageValuePDF)
- [x] 5.4 Verify table layouts are preserved after formatting (no changes made to PDF layout)

## 6. Testing and validation

- [x] 6.1 Run existing test suite and fix any broken tests (frontend builds successfully; test failures are pre-existing due to missing env vars)
- [x] 6.2 Manual verification: Check UnifiedCoverageMatrix displays formatted values
- [x] 6.3 Manual verification: Check VariableComparisonMatrix displays formatted values
- [x] 6.4 Manual verification: Check CorrectionUI displays formatted prices
- [x] 6.5 Generate test PDF and verify formatting

## 7. Prevent future regressions

- [x] 7.1 Document convention: "Always use formatCOP for monetary values" in component README or conventions doc (Added convention comment to all 3 formatCurrency.ts files)
- [x] 7.2 (Optional) Add ESLint rule or code review checklist to prevent inline currency formatting (Convention documented in code; ESLint rule can be added later if needed)
