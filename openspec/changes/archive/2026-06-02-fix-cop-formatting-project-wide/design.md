## Context

The application has three identical `formatCurrency.ts` utility files (client, shared, server) providing `formatCOP`, `formatCOPMillions`, `formatNumber`, and `formatPercentage`. These utilities correctly format Colombian Pesos with dot as thousands separator and comma as decimal separator.

However, several critical UI components do not use these utilities:
- `UnifiedCoverageMatrix.tsx` has its own `formatCurrency` function (line 267) that doesn't handle edge cases consistently
- `VariableComparisonMatrix.tsx` uses `toLocaleString()` without locale specification
- `CorrectionUI.tsx` displays raw numeric strings for price fields
- Other deductible-related components may have similar issues

Previous change (`2026-05-04-completar-formato-moneda-porcentaje`) created specs for this but the implementation was incomplete or reverted.

## Goals / Non-Goals

**Goals:**
- Ensure ALL monetary values display with consistent Colombian formatting
- Eliminate duplicate/inline formatting logic in favor of centralized utilities
- Fix all known components with formatting issues
- Prevent future regressions

**Non-Goals:**
- Modifying the formatCurrency utility functions (they already work correctly)
- Changing the Colombian format standard (dot thousands, comma decimal)
- Adding new features or changing business logic
- Backend/API changes (backend already uses formatCOP correctly)

## Decisions

### Decision 1: Remove inline formatCurrency from UnifiedCoverageMatrix
- **Rationale**: The component's local `formatCurrency` (line 267) is redundant and inconsistent with the centralized utility. It also lacks null/undefined handling present in `formatCOP`.
- **Approach**: Delete local function, import `formatCOP` from `../utils/formatCurrency`, replace all usages.

### Decision 2: Update VariableComparisonMatrix formatValue function  
- **Rationale**: Current `formatValue` uses `value.toLocaleString()` without locale, producing inconsistent results across browsers.
- **Approach**: Import `formatCOP` and `formatNumber`, apply to monetary values. Keep JSON stringify for non-monetary objects.

### Decision 3: Apply formatting to CorrectionUI display values
- **Rationale**: Price fields show raw numeric strings, confusing users.
- **Approach**: Format display values with `formatCOP` while keeping input fields as plain text for editing.

### Decision 4: Audit remaining components systematically
- **Rationale**: There may be other components with similar issues.
- **Approach**: Search for `toLocaleString`, raw numeric displays, and inline currency formatting across all .tsx files. Fix any found issues.

## Risks / Trade-offs

- [Risk] Changing display format may break existing tests that assert on exact string values → Mitigation: Update test expectations as part of this change
- [Risk] PDF generation may have different layout constraints → Mitigation: Test PDF output after formatting changes
- [Risk] Input fields (CorrectionUI) should remain editable with raw values → Mitigation: Only format display, not input state

## Migration Plan

1. Update components (no deployment risk - pure UI formatting)
2. Run existing tests, update any that assert on raw numeric strings
3. Manual verification of key user flows
4. No rollback needed (changes are additive/improvements)

## Open Questions

- Should we add an ESLint rule to enforce usage of formatCOP over inline formatting?
- Are there edge cases in PDF generation that need special handling?
