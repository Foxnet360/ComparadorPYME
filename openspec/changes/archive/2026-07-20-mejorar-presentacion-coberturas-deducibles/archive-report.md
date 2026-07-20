# Archive Report: Mejorar Presentación de Coberturas y Deducibles

## Status

Completed and merged.

## PR Chain

| PR | Scope | Merge Commit | URL |
|----|-------|--------------|-----|
| PR 1 | Backend extractors, parsers, V2 default flag, expanded taxonomy, dots-tolerant SMMLV normalization | 54032a5 | https://github.com/Foxnet360/ComparadorPYME/pull/34 |
| PR 2 | Frontend grid presentation, schemaVersion routing, case-insensitive deductible checks, SMMLV display normalization | fef6726 | https://github.com/Foxnet360/ComparadorPYME/pull/35 |

## What was delivered

- **V2 granular schema is now the default** backend extraction path via `granularComparisonSchema`.
- **14 canonical coverage taxonomy** is enforced in the V2 prompt builder and parser alias map.
- **Dots-tolerant SMMLV normalization** in `hybridDeductibleParser` and `flatTableParser`.
- **`schemaVersion` routing**: the backend now forwards `schemaVersion` (1 or 2) in the comparison response; the frontend uses it to choose between backend V2 `MatrixRow[]` and legacy V1 client-side reconstruction.
- **Case-insensitive unspecified deductible detection** in `DeductibleMatrix`.
- **SMMLV display normalization** in `DeductibleMatrix` and `DeductibleBadge` so dotted variants like `S.M.M.L.V.` render as `SMMLV`.
- **Tests** added for `DeductibleMatrix`, `DeductibleBadge` SMMLV normalization, and `UnifiedCoverageMatrix` legacy fallback.

## Verification

- `npm run test:unit:frontend` — 75 tests passed.
- `npm run build:frontend` — succeeded.
- `npm run typecheck:backend` — succeeded.
- CI on PR #35 — all checks passed (ESLint, Prettier, Backend Type Check, Frontend Build, Supabase Schema Diff, Test Coverage).

## Files changed

- `components/ComparisonReport.tsx`
- `components/DeductibleBadge.tsx`
- `components/DeductibleMatrix.tsx`
- `components/UnifiedCoverageMatrix.tsx`
- `server/src/controllers/analysisController.ts`
- `server/src/types.ts`
- `src/components/__tests__/DeductibleBadge.test.tsx`
- `src/components/__tests__/DeductibleMatrix.test.tsx`
- `src/components/__tests__/UnifiedCoverageMatrix.test.tsx`
- `types.ts`

## Follow-up notes

- The project-wide `typecheck:frontend` (`tsc --noEmit --project tsconfig.json`) still reports many pre-existing errors in server test files and scripts. These were not introduced by this change and are unrelated to the delivered functionality.
- The `DeductibleMatrix` still derives its grid rows from `PLANTILLA_ITEMS` and `quote.coverages`. A future improvement could consume the backend V2 deductible rows directly from `report.matrix`, now that `schemaVersion` routing is in place.

## Archival action

- Marked all Phase 1–5 tasks as completed in `openspec/changes/mejorar-presentacion-coberturas-deducibles/tasks.md`.
- This archive report is stored at `openspec/changes/mejorar-presentacion-coberturas-deducibles/archive-report.md`.
