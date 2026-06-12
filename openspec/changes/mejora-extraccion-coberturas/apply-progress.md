# Apply Progress: Improve Coverage, Deductible, and Condition Extraction

## Slice 1 — Foundation

**Status**: success  
**Mode**: Strict TDD (Vitest)  
**Branch**: `feature/mejora-extraccion-coberturas-slice-1`  
**Chain strategy**: `stacked-to-main` — this PR targets `main`

## Slice 2 — Template Registry

**Status**: success  
**Mode**: Strict TDD (Vitest)  
**Branch**: `feature/mejora-extraccion-coberturas-slice-2`  
**Chain strategy**: `stacked-to-main` — this PR targets `feature/mejora-extraccion-coberturas-slice-1`

## Slice 3 — Layout Parser

**Status**: success  
**Mode**: Strict TDD (Vitest)  
**Branch**: `feature/mejora-extraccion-coberturas-slice-3`  
**Chain strategy**: `stacked-to-main` — this PR targets `feature/mejora-extraccion-coberturas-slice-2`

## Completed Tasks

### Phase 1: Foundation
- [x] 1.1 Create `server/supabase/migrations/019_template_registry_and_graph.sql`.
- [x] 1.2 Add feature flags to `server/src/config/featureFlags.ts`.
- [x] 1.3 Create `data/domains/pyme/template-seeds.json` for BBVA, SBS, MAPFRE.
- [x] 1.4 Seed graph edges from `taxonomy.json`/`ontology.json` on startup.
- [x] 1.5 Define core domain types/interfaces (`TemplateRegistryEntry`, `LayoutTable`, `GraphEdge`, etc.).

### Phase 2: Template Registry (TDD)
- [x] 2.1 RED: Write unit tests for fingerprint scoring and schema validation.
- [x] 2.2 GREEN: Implement `server/src/services/templateRegistryService.ts`.
- [x] 2.3 REFACTOR: Add cache refresh and `TemplateRegistryEntry` interfaces.
- [x] 2.4 Modify `server/src/services/insurerProfileService.ts` to expose registry seeds.

### Phase 3: Layout Parser (TDD)
- [x] 3.1 RED: Write unit tests for row/column clustering with mocked `pdfjs` items.
- [x] 3.2 GREEN: Implement `server/src/services/layoutParser.ts`.
- [x] 3.3 REFACTOR: Add rotated-page detection and `layout_parse_failed` logging.

### Phase 5: Pipeline Integration (partial)
- [x] 5.1 Modify `formatDetector.ts` to return `templateId`/`templateConfidence`.

## Remaining Tasks

### Phase 4: Coverage Semantic Graph (TDD)
- [ ] 4.1 RED: Write unit tests for graph query, propagation, and learning.
- [ ] 4.2 GREEN: Implement `server/src/services/coverageGraph.ts`.
- [ ] 4.3 REFACTOR: Add Redis cache and periodic propagation.

### Phase 5: Pipeline Integration (remaining)
- [ ] 5.2 Modify `promptBuilder.ts` to add `buildTemplatePrompt`.
- [ ] 5.3 Modify `quoteProcessingService.ts` to route known templates.
- [ ] 5.4 Modify `coverageNormalizer.ts` to use graph probabilities and decompositions.
- [ ] 5.5 Modify `coverageOntology.ts` to use graph consensus scoring.
- [ ] 5.6 Modify `semanticMatcher.ts` to rank with graph probabilities.
- [ ] 5.7 Modify `hybridDeductibleParser.ts` with template hints and `appliesTo` rules.
- [ ] 5.8 Modify `thesaurusMapper.ts` and `learningEngine.ts` to write graph edges.

### Phase 6: Evaluation & Rollout
- [ ] 6.1 Create `server/src/services/goldenSetEvaluation.ts`.
- [ ] 6.2 Build 30-quote annotated golden-set fixtures.
- [ ] 6.3 Add integration tests for template and graph paths.
- [ ] 6.4 Run golden-set evaluation and set thresholds before enabling flags.

### Phase 7: Documentation
- [ ] 7.1 Document template schemas and graph edge semantics.
- [ ] 7.2 Add metrics/logging for matches, layout failures, and cold-start misses.

## Files Changed in Slice 3

| File | Action | Notes |
|------|--------|-------|
| `server/src/services/layoutParser.ts` | Created | Row/column clustering, table reconstruction, region detection, rotation detection |
| `server/src/services/__tests__/layoutParser.test.ts` | Created | 9 unit tests covering clustering, headers, merged cells, rotation, regions |
| `server/src/services/layoutAwarePromptBuilder.ts` | Created | Combines template schema + reconstructed tables into LLM prompt |
| `server/src/services/__tests__/layoutAwarePromptBuilder.test.ts` | Created | 5 unit tests for prompt content |
| `server/src/services/pdfExtractor.ts` | Modified | Optional `pageTextItems` layout path gated by `useTemplateGraphPipeline`; added `extractLayoutFromPdf` |
| `server/src/services/__tests__/pdfExtractor.layout.test.ts` | Created | 3 unit tests mocking `pdfjs` items and feature flags |
| `server/src/services/templateRegistryService.ts` | Modified | Added optional `rotation` to `TextItem` to carry pdfjs rotation angle |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1/3.2 | `server/src/services/__tests__/layoutParser.test.ts` | Unit | N/A (new) | Written | Passed | 9 cases (simple table, two tables, single column, empty, regions, merged cells, rotation) | Clean |
| 3.3 | `server/src/services/__tests__/layoutParser.test.ts` | Unit | N/A (new) | Written | Passed | rotated page detection + failure logging | Clean |
| Prompt builder | `server/src/services/__tests__/layoutAwarePromptBuilder.test.ts` | Unit | N/A (new) | Written | Passed | 5 cases (schema, markdown, hints, empty tables, merged cells) | Clean |
| pdfExtractor layout path | `server/src/services/__tests__/pdfExtractor.layout.test.ts` | Unit | 6/6 passed | Written | Passed | 3 cases (layout extraction, flag on, flag off) | Clean |

### Test Summary
- **Total tests written**: 17 (slice 3 only)
- **Total tests passing**: 17 (slice 3 only)
- **Layers used**: Unit (17)
- **Approval tests**: None — no refactoring-only tasks
- **Pure functions created**: `clusterRows`, `deriveColumnBoundaries`, `detectTableHeader`, `detectRotatedPages`, `extractTables`, `buildTemplatePrompt`, `parseTextItem`

## Deviations from Design

- `layoutParser.ts` uses gap-based column clustering instead of full DBSCAN/k-means; this keeps the service dependency-free while still producing stable column boundaries for typical insurer tables.
- Region detection uses y-coordinate bands relative to the page’s item bounds because real page dimensions are not always available from `pdfjs` text items alone.
- `extractLayoutFromPdf` is exposed as a standalone function rather than only through `extractTextFromPdf`, so callers can request layout reconstruction without forcing the master pipeline flag on.

## Issues Found

- Existing full test suite has unrelated pre-existing failures due to missing `GEMINI_API_KEY`, `SUPABASE_*` credentials, and other environment requirements. Slice 3 tests pass independently.
- `TextItem` needed an optional `rotation` field to propagate pdfjs rotation angles to the layout parser; this is a backward-compatible type extension.

## Risks

- Column clustering relies on a fixed x-tolerance default (12 pts); tables with very narrow or irregular columns may need per-template tuning.
- Layout region detection is heuristic (15% top/bottom bands); it may misclassify pages with unusual margins.
- `extractTextFromPdf` now imports `featureFlags`, so any test that mutates the global flag can affect concurrent tests. Tests reset the flag in `beforeEach`.
- The `layoutAwarePromptBuilder` prompt is in Spanish because the existing extraction prompts are Spanish; this matches project conventions.

## Next Recommended Phase

`sdd-apply` slice 4 — Phase 4: Coverage Semantic Graph (graph model, query, propagation, and learning).

## Branch / PR Boundary

- Slice 3 PR branch: `feature/mejora-extraccion-coberturas-slice-3`
- Target (stacked-to-main): `feature/mejora-extraccion-coberturas-slice-2`
- Estimated review budget impact: ~700 changed lines (above the 400-line soft budget, consistent with the auto-forecast chained PR plan).
