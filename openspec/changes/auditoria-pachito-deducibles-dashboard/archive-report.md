# Archive Report: Auditoría Pachito — Deducibles y Dashboard

## Change

- **Name:** auditoria-pachito-deducibles-dashboard
- **Status:** archived
- **Archived at:** 2026-07-10

## Summary

Resolved the four dashboard/deductible issues detected during the Pachito el Chef audit:

1. V2 financial rows landing in `extraRows` were rendered under the coverages tab instead of "Primas y Costos".
2. The DEDUCIBLES prompt allowed the model to omit rows, causing incomplete deductible matrices.
3. `DeductibleMatrix` rendered a row for every coverage even when all deductibles were unspecified.
4. `ComparisonReport` duplicated deductible information with a full-text collapsible block.

In addition, `UnifiedCoverageMatrix` now groups all deductible rows under a dedicated `DEDUCIBLES` section, and `ExecutiveSummary` handles missing prices gracefully.

## Deliverables

- Code changes committed to `feature/auditoria-pachito-ui-extraccion`.
- Delta specs synced to:
  - `openspec/specs/unified-comparison-extraction/spec.md`
  - `openspec/specs/unified-coverage-matrix/spec.md`
- PR opened against `main`.
- Deployed to Railway production.

## Verification

- Full unit suite: 1184 passed, 8 skipped, 0 failed.
- Targeted backend tests for `matrixTransformer` and `analysisController` pass.
- Targeted frontend tests for `DeductibleMatrix` and `UnifiedCoverageMatrix` pass.

## Notes

- No destructive deltas were merged.
- No feature flags were changed.
- Pre-existing `tsc --noEmit` errors remain in unrelated test files and scripts; the changed files and tests compile successfully.
