# Tasks: Mejorar Visualización del Reporte

## Frontend Components

- [ ] Create `components/ExecutiveSummary.tsx`
  - [ ] Show best overall option with reasoning
  - [ ] Show highest risk alert
  - [ ] Show potential savings (price delta)
  - [ ] Action buttons: [Ver Matriz] [Ver Deducibles] [Ver Riesgos]
  - [ ] Navigate to tabs on click
- [ ] Create `components/CoverageMatrixEnhanced.tsx` OR modify `UnifiedCoverageMatrix.tsx`
  - [ ] Add 🏆 winner badge per category
    - [ ] Criteria: highest sum insured, lowest deductible, no exclusions, best score
    - [ ] Tooltip explaining why it's the winner
  - [ ] Add diff highlighting
    - [ ] Red background: value < 70% of average
    - [ ] Green background: value > 130% of average
    - [ ] Show delta badge (+15%, -20%)
  - [ ] Support Client/Technical toggle
    - [ ] Client view: show only values and deductibles
    - [ ] Technical view: show confidence scores, match methods
- [ ] Modify `components/DeductibleSummaryTable.tsx`
  - [ ] Add severity bars (horizontal colored bars)
    - [ ] 0-30%: Green (low)
    - [ ] 30-60%: Yellow (medium)
    - [ ] 60-100%: Red (high)
    - [ ] > insured value: +20% penalty, show warning
  - [ ] Add best option badge
  - [ ] Tooltips with technical details
- [ ] Modify `components/ComparisonReport.tsx`
  - [ ] Add ExecutiveSummary at top of Resumen tab
  - [ ] Add global Client/Technical toggle in header
  - [ ] Pass `viewMode` prop to all child components
  - [ ] Ensure toggle affects ALL tabs (Matriz, Deducibles, Auditoría, Dashboard)
- [ ] Create `components/ViewModeToggle.tsx` (or inline in header)
  - [ ] Toggle between "Vista Cliente" and "Vista Técnica"
  - [ ] Persist preference in localStorage
  - [ ] Apply viewMode to entire report

## Logic & Utilities

- [ ] Create `utils/winnerDetection.ts`
  - [ ] `findWinnerByCategory(coverageData, category)` function
  - [ ] Parse monetary values, deductibles, boolean exclusions
- [ ] Create `utils/diffHighlighting.ts`
  - [ ] `calculateDifferences(values)` function
  - [ ] Return avg, min, max, and deviation percentages
- [ ] Create `utils/severityCalculator.ts`
  - [ ] `calculateDeductibleSeverity(deductible, insuredValue)` function
  - [ ] Return severity level + percentage

## Integration & Testing

- [ ] Test winner detection with 2+ insurers
- [ ] Test diff highlighting thresholds
- [ ] Test severity bar calculations
- [ ] Test Client/Technical toggle across all tabs
- [ ] Test responsive design on mobile/tablet
- [ ] Run `npm run build` to verify no errors
