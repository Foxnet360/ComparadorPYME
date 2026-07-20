# Apply Progress: Mejorar Presentación de Coberturas y Deducibles (PR 1)

**Change**: `mejorar-presentacion-coberturas-deducibles`
**Mode**: Standard
**Status**: 8/14 tasks complete (PR 1 complete). Ready for PR 2.

## Goal
Implement backend extractors, V2 default configurations, and dots-tolerant SMMLV normalization.

## Completed Tasks
- [x] 1.1 Enable granular V2 default in `server/src/config/featureFlags.ts`.
- [x] 1.2 Expand `GRANULAR_SECTIONS` in `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` to 14 categories.
- [x] 1.3 Add standard category mappings to `ALIAS_MAP` in `server/src/services/unifiedComparison/flatTableParser.ts`.
- [x] 2.1 Add SMMLV normalization in `server/src/services/unifiedComparison/flatTableParser.ts` `normalizeDeductibleText`.
- [x] 2.2 Update regex patterns in `server/src/services/hybridDeductibleParser.ts` for SMMLV dots.
- [x] 2.3 Create tests in `server/src/services/__tests__/parsers.test.ts` for SMMLV normalization.
- [x] 3.1 Verify LLM JSON response routing and V1 legacy fallback via `comparisonEngineAdapter.ts` tests.
- [x] 3.2 Ensure backend `npm run build` and `npm test` pass successfully.

## Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `server/src/config/featureFlags.ts` | Modified | Enabled `granularComparisonSchema` by default in all default/env config blocks. |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modified | Expanded granular prompt sections and business rules to include 14 canonical coverages. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Mapped standard canonical coverage aliases to appropriate sections and added dot-tolerant SMMLV normalization. |
| `server/src/services/hybridDeductibleParser.ts` | Modified | Added dot-tolerant SMMLV normalization and regex support. |
| `server/src/services/__tests__/deductibleParser.unit.test.ts` | Modified | Added unit tests asserting dotted SMMLV formats (`S.M.M.L.V.`, etc.). |
| `server/src/services/unifiedComparison/__tests__/comparisonPromptBuilder.test.ts` | Modified | Added prompt schema verification for new `COBERTURAS` categories. |
| `server/src/services/unifiedComparison/__tests__/flatTableParser.test.ts` | Modified | Added alias classification assertions for `COBERTURAS`. |
| `server/src/services/unifiedComparison/__tests__/unifiedComparisonEngine.test.ts` | Modified | Explicitly isolated legacy flat-table suite to keep expectations consistent. |

## Verification Results
- `npm run typecheck:backend` - Passed (0 errors)
- `npm run build:backend` - Passed (0 errors)
- `npm run test:unit:backend` - Passed (1105/1105 tests green)

## Workload / PR Boundary
- Mode: chained PR slice
- Current branch: `feature/mejorar-presentacion-coberturas-deducibles-pr1-backend`
- Target branch: `main`
- PR URL: `https://github.com/Foxnet360/ComparadorPYME/pull/34`
- Changed line count: 251 changed lines.
