## 1. Update UnifiedCoverageMatrix component

- [x] 1.1 Import `formatCOP` from `../utils/formatCurrency`
- [x] 1.2 Apply `formatCOP` to coverage values in main matrix (line 121)
- [x] 1.3 Apply `formatCOP` to deductible values in main matrix (line 125)
- [x] 1.4 Apply `formatCOP` to uncategorized coverage values (line 180)
- [x] 1.5 Handle special cases: "EXCLUIDO", "NO CUBRE", "NO APLICA", "NO ESPECIFICADO"

## 2. Update DeductiblesComparisonTable component

- [x] 2.1 Import `formatPercentage` and `formatCOP` from `../utils/formatCurrency`
- [x] 2.2 Update `parseDeductible` to return numeric values instead of strings
- [x] 2.3 Apply `formatPercentage` to deductible percentages (line 152)
- [x] 2.4 Apply `formatCOP` or `formatNumber` to SMMLV minimums (line 155)
- [x] 2.5 Ensure severity calculation still works with numeric values

## 3. Update PDF Service

- [x] 3.1 Import `formatCOP` and `formatPercentage` in `pdfService.ts`
- [x] 3.2 Apply formatting to coverage matrix values (page 2, line 124)
- [x] 3.3 Apply formatting to deductible values (page 3)
- [x] 3.4 Verify PDF table layout is preserved after formatting

## 4. Extend formatCurrency utilities (if needed)

- [x] 4.1 Add `formatCOPWithDecimals` function if not already available
- [x] 4.2 Ensure `formatNumber` handles SMMLV values correctly
- [x] 4.3 Verify all format functions handle null/undefined gracefully

## 5. Verification

- [x] 5.1 Run `npm run build` to verify no TypeScript errors
- [x] 5.2 Verify coverage values display correctly in UnifiedCoverageMatrix
- [x] 5.3 Verify deductible percentages use comma decimal separator
- [x] 5.4 Generate test PDF and verify formatting
- [x] 5.5 Check that special values (EXCLUIDO, NO ESPECIFICADO) display correctly
