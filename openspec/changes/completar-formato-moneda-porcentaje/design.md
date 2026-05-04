## Context

The previous formatting change (`formato-moneda-porcentaje-colombiano`) successfully applied Colombian number formatting (dot for thousands, comma for decimals) to the dashboard summary view, scoring cards, and tooltips. However, a gap analysis revealed that several critical user-facing areas still display raw, unformatted numeric values.

Currently unformatted areas:
- `UnifiedCoverageMatrix`: Coverage values (e.g., "500000000" instead of "$500.000.000")
- `DeductiblesComparisonTable`: Deductible percentages and SMMLV minimums
- `pdfService.ts`: All monetary values in generated PDF reports
- Uncategorized coverages section: Raw values without formatting

## Goals / Non-Goals

**Goals:**
- Standardize all monetary values to use `formatCOP` with Colombian separators
- Standardize all percentages to use `formatPercentage` with comma decimal separator
- Ensure PDF reports match the web UI formatting
- Maintain backward compatibility with existing data structures

**Non-Goals:**
- No changes to data models or API contracts
- No changes to calculation logic
- No new formatting for dates or other non-numeric fields

## Decisions

1. **Re-use existing `formatCOP` and `formatPercentage` functions**
   - Rationale: These are already tested and use `toLocaleString('es-CO')` correctly
   - Alternative: Create new component-specific formatters → Rejected to avoid duplication

2. **Add `formatCOPWithDecimals` utility function**
   - Rationale: Some coverage values need 2 decimal places (e.g., $500.000.000,00)
   - Implementation: Extend `formatCOP` to accept decimals parameter

3. **Format values at render time, not at data ingestion**
   - Rationale: Keeps raw data intact for calculations and comparisons
   - Risk: Slightly more render overhead → Mitigation: Negligible for typical data sizes

## Risks / Trade-offs

- [Risk] PDF formatting may differ slightly from web due to jsPDF limitations → [Mitigation] Test PDF output after implementation
- [Risk] Very long formatted numbers may break table layouts → [Mitigation] Use appropriate column widths and truncation

## Migration Plan

No migration needed. This is a pure UI formatting enhancement with no data or schema changes.

## Open Questions

None. Scope is well-defined.
