# Tasks: Mejorar Presentación de Coberturas y Deducibles

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~320 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Backend) → PR 2 (Frontend) |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend Extractors & Parsers | PR 1 | Base: main. Includes expanded taxonomy and parser normalizations with tests. |
| 2 | Frontend Grid & Metrics UI | PR 2 | Base: PR 1. Grid rendering refinements, metrics card casing fix, and tests. |

## Phase 1: Foundation (PR 1)
- [x] 1.1 Enable granular V2 default in `server/src/config/featureFlags.ts`.
- [x] 1.2 Expand `GRANULAR_SECTIONS` in `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` to 14 categories.
- [x] 1.3 Add standard category mappings to `ALIAS_MAP` in `server/src/services/unifiedComparison/flatTableParser.ts`.

## Phase 2: Core Parsers (PR 1)
- [x] 2.1 Add SMMLV normalization in `server/src/services/unifiedComparison/flatTableParser.ts` `normalizeDeductibleText`.
- [x] 2.2 Update regex patterns in `server/src/services/hybridDeductibleParser.ts` for SMMLV dots.
- [x] 2.3 Create tests in `server/src/services/__tests__/parsers.test.ts` for SMMLV normalization.

## Phase 3: Integration & Fallback (PR 1)
- [x] 3.1 Verify LLM JSON response routing and V1 legacy fallback via `comparisonEngineAdapter.ts` tests.
- [x] 3.2 Ensure backend `npm run build` and `npm test` pass successfully.

## Phase 4: Frontend UI Grid (PR 2)
- [ ] 4.1 Update `components/UnifiedCoverageMatrix.tsx` to render the 14 standard categories side-by-side.
- [ ] 4.2 Fix casing check for unspecified deductibles in `components/DeductibleMatrix.tsx`.
- [ ] 4.3 Add legacy V1 layout fallback logic in `components/UnifiedCoverageMatrix.tsx`.

## Phase 5: Verification & Cleanup (PR 2)
- [ ] 5.1 Create / update component tests for `DeductibleMatrix` and `UnifiedCoverageMatrix`.
- [ ] 5.2 Validate frontend accessibility and rendering performance under 100ms.
- [ ] 5.3 Verify final integration and ensure overall `npm run build` and `npm test` are green.
