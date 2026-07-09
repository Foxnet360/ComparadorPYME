# Tasks: Mejorar Matriz Coberturas

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-650 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Backend) → PR 2 (Frontend) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend Extraction Expansion | PR 1 | Base: feature/tracker. Extends prompt, schema, types, parser, matrix, and tests. |
| 2 | Frontend Synchronization | PR 2 | Base: PR 1 branch. Binds backend rows, adds metadata card, fixes tab mapping, and tests. |

## Phase 1: Backend Foundations & Schemas (PR 1)

- [x] 1.1 Add `QuoteMetadata` interface to `server/src/types.ts` and `types.ts`.
- [x] 1.2 Extend `ComparisonReport` interface with `matrix?: MatrixRow[]` and `quoteMetadata?: QuoteMetadata[]` in both type files.
- [x] 1.3 Update `comparisonSchema.ts` with `QuoteMetadataSchema` and define `FlatComparisonSchemaV2` to validate metadata and business sections.

## Phase 2: Backend Logic & Parsing (PR 1)

- [x] 2.1 Update `comparisonPromptBuilder.ts` to instruct Gemini 3.5 Flash to request 9 `quoteMetadata` fields and granular business rows.
- [x] 2.2 Extend `ALIAS_MAP` and section heuristics in `flatTableParser.ts` to map new business coverages and extract client metadata.
- [x] 2.3 Align `FINANCIAL_SECTION_ID = 100` and map `SchemaSection.FINANCIAL` rows in `matrixTransformer.ts`.
- [x] 2.4 Update `analysisController.ts` to populate and return pre-aligned `matrix` rows and `quoteMetadata` in `/api/comparison/unified`.

## Phase 3: Backend Verification (PR 1)

- [x] 3.1 Write unit tests in `flatTableParser.test.ts` for metadata extraction and section mappings.
- [x] 3.2 Write integration tests in `matrixTransformer.test.ts` to verify financials have `sectionId: 100`.

## Phase 4: Frontend Integration & Fallback (PR 2)

- [ ] 4.1 Update `ComparisonReport.tsx` to pass backend `matrix` and `quoteMetadata` to `<UnifiedCoverageMatrix>`.
- [ ] 4.2 Fix tab/section filtering in `UnifiedCoverageMatrix.tsx` to use backend section IDs (financial = 100).
- [ ] 4.3 Refactor client-side fallback in `UnifiedCoverageMatrix.tsx` to mirror backend grouping logic when backend `matrix` is absent.

## Phase 5: UI & Frontend Verification (PR 2)

- [ ] 5.1 Implement a responsive Header Metadata Card in `UnifiedCoverageMatrix.tsx` to display the 9 extracted metadata fields.
- [ ] 5.2 Write unit tests in `UnifiedCoverageMatrix.test.tsx` for the metadata card rendering and financials tab filtering.
