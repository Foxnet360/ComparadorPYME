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

## Slice 4 — Coverage Semantic Graph

**Status**: success  
**Mode**: Strict TDD (Vitest)  
**Branch**: `feature/mejora-extraccion-coberturas-slice-4`  
**Chain strategy**: `stacked-to-main` — this PR targets `feature/mejora-extraccion-coberturas-slice-3`

## Slice 5 — Pipeline Integration (Remaining)

**Status**: success  
**Mode**: Strict TDD (Vitest)  
**Branch**: `feature/mejora-extraccion-coberturas-slice-5`  
**Chain strategy**: `stacked-to-main` — this PR targets `feature/mejora-extraccion-coberturas-slice-4`

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

### Phase 4: Coverage Semantic Graph (TDD)
- [x] 4.1 RED: Write unit tests for graph query, propagation, learning, and edge CRUD.
- [x] 4.2 GREEN: Implement `server/src/services/coverageGraphService.ts`.
- [x] 4.3 REFACTOR: Add Redis cache, cache invalidation, and confidence propagation.

### Phase 5: Pipeline Integration
- [x] 5.1 Modify `formatDetector.ts` to return `templateId`/`templateConfidence`.
- [x] 5.2 Modify `promptBuilder.ts` to add `buildTemplatePrompt`.
- [x] 5.3 Modify `quoteProcessingService.ts` to route known templates.
- [x] 5.4 Modify `coverageNormalizer.ts` to use graph probabilities and decompositions.
- [x] 5.5 Modify `coverageOntology.ts` to use graph consensus scoring.
- [x] 5.6 Modify `semanticMatcher.ts` to rank with graph probabilities.
- [x] 5.7 Modify `hybridDeductibleParser.ts` with template hints and `appliesTo` rules.
- [x] 5.8 Modify `thesaurusMapper.ts` and `learningEngine.ts` to write graph edges.

## Remaining Tasks

### Phase 6: Evaluation & Rollout
- [ ] 6.1 Create `server/src/services/goldenSetEvaluation.ts`.
- [ ] 6.2 Build 30-quote annotated golden-set fixtures.
- [ ] 6.3 Add integration tests for template and graph paths.
- [ ] 6.4 Run golden-set evaluation and set thresholds before enabling flags.

### Phase 7: Documentation
- [ ] 7.1 Document template schemas and graph edge semantics.
- [ ] 7.2 Add metrics/logging for matches, layout failures, and cold-start misses.

## Files Changed in Slice 5

| File | Action | Notes |
|------|--------|-------|
| `server/src/services/promptBuilder.ts` | Modified | Added `buildTemplatePrompt` wrapper re-exporting `layoutAwarePromptBuilder.buildTemplatePrompt` |
| `server/src/services/__tests__/promptBuilder.test.ts` | Modified | Added tests for `buildTemplatePrompt` wrapper |
| `server/src/services/quoteProcessingService.ts` | Modified | Added `selectExtractionPrompt` and `enrichRawCoveragesWithGraph`; wired template/graph routing into `processQuoteMultimodalInternal` |
| `server/src/services/__tests__/quoteProcessingService.test.ts` | Modified | Added tests for template prompt selection and graph enrichment |
| `server/src/services/coverageOntology.ts` | Modified | Added `queryGraphForMapping`; delegates to graph before LLM consensus; uses `env.GEMINI_API_KEY` consistently |
| `server/src/services/__tests__/coverageOntology.test.ts` | Modified | Mocked `env.ts` to prevent `process.exit` in test environment |
| `server/src/services/__tests__/coverageOntology.graph.test.ts` | Created | 5 tests for graph delegation, composite components, low-confidence fallback, no-match fallback, insurer passthrough |
| `server/src/services/hybridDeductibleParser.ts` | Modified | Added `DeductibleParseOptions`, `appliesTo` result field; resolves applicable coverage from explicit arg or graph `deductible_for`/`applies_to` edges; backward-compatible legacy signature |
| `server/src/services/__tests__/hybridDeductibleParser.test.ts` | Modified | Mocked `env.ts` and full `redisCache` to support new transitive dependencies |
| `server/src/services/__tests__/hybridDeductibleParser.graph.test.ts` | Created | 7 tests for graph appliesTo resolution, explicit coverage precedence, low-confidence ignore, flag disable, error fallback, legacy signature, template hints |
| `server/src/services/learningEngine.ts` | Modified | Added `updateGraph`; writes `learned` (coverage), `deductible_for` (deductible), and `excludes` (exclusion) edges when `graphLearningEnabled` flag is on |
| `server/src/services/__tests__/learningEngine.graph.test.ts` | Created | 6 tests for coverage mapping, deductible, exclusion, flag disable, value skip, and normalization |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.2 | `server/src/services/__tests__/promptBuilder.test.ts` | Unit | layoutAwarePromptBuilder mocked | Written | Passed | wrapper delegates, passes templateId/schema/tables | Clean |
| 5.3 | `server/src/services/__tests__/quoteProcessingService.test.ts` | Unit | templateRegistry/coverageGraphService mocked | Written | Passed | known template selects template prompt, unknown uses generic, graph enriches coverages, errors swallowed | Clean |
| 5.5 | `server/src/services/__tests__/coverageOntology.graph.test.ts` | Unit | coverageGraphService mocked | Written | Passed | 5 cases (graph hit, composite, low-confidence, no match, insurer passthrough) | Clean |
| 5.7 | `server/src/services/__tests__/hybridDeductibleParser.graph.test.ts` | Unit | coverageGraphService/featureFlags mocked | Written | Passed | 7 cases (appliesTo, explicit precedence, low-confidence ignore, flag off, error fallback, legacy signature, template hints) | Clean |
| 5.8 | `server/src/services/__tests__/learningEngine.graph.test.ts` | Unit | coverageGraphService/featureFlags mocked | Written | Passed | 6 cases (coverage mapping, deductible, exclusion, flag disabled, value skip, normalization) | Clean |

### Test Summary
- **Total tests written**: 31 (slice 5 only)
- **Total tests passing**: 31 (slice 5 only)
- **Layers used**: Unit
- **Approval tests**: None
- **Pure functions created**: None (behavior added to existing services)

## Deviations from Design

- `coverageOntology.ts` uses `env.GEMINI_API_KEY` instead of `process.env.GEMINI_API_KEY` so tests can mock the env module deterministically.
- `hybridDeductibleParser.parse` accepts either the legacy `(text, coverageName?)` signature or a new options object `(text, options?)` to keep existing callers unchanged.
- Graph deductible lookup in `hybridDeductibleParser` happens before parsing so the resolved coverage can feed benchmark evaluation; appliesTo is not cached because the text-only cache key cannot distinguish insurers.
- `learningEngine.updateGraph` normalizes raw names with whitespace collapse and strips non-alphanumeric characters to match `coverageGraphService` node normalization.

## Issues Found

- Existing `coverageOntology.test.ts` and `hybridDeductibleParser.test.ts` required `env.ts` mocks after new transitive imports pulled in `env.ts`; fixed by adding mocks.
- `hybridDeductibleParser.test.ts` required additional `redisCache` cache function mocks after `coverageGraphService` became a transitive dependency.
- vi.mock paths must match the resolved module specifier used by the module under test; relative paths resolving to the same file are treated as distinct mocks.

## Risks

- `hybridDeductibleParser` graph lookup adds a network/cache call on every parse when `useTemplateGraphPipeline` is enabled; the call is wrapped in try/catch and falls back gracefully.
- `learningEngine.updateGraph` runs inside `applyCorrection`; graph service failures are logged but do not fail the correction save.
- `coverageOntology.queryGraphForMapping` references `coverageOntology` before its declaration; it is only invoked asynchronously after module initialization, so the singleton is available.

## Next Recommended Phase

Continue `sdd-apply` slice 6 — Phase 6 evaluation & rollout (`goldenSetEvaluation.ts`, golden-set fixtures, integration tests, threshold tuning) if required by delivery plan.

## Branch / PR Boundary

- Slice 5 PR branch: `feature/mejora-extraccion-coberturas-slice-5`
- Target (stacked-to-main): `feature/mejora-extraccion-coberturas-slice-4`
- Estimated review budget impact: ~700 changed lines (above the 400-line soft budget, consistent with the auto-forecast chained PR plan).

| File | Action | Notes |
|------|--------|-------|
| `server/src/services/layoutParser.ts` | Created | Row/column clustering, table reconstruction, region detection, rotation detection |
| `server/src/services/__tests__/layoutParser.test.ts` | Created | 9 unit tests covering clustering, headers, merged cells, rotation, regions |
| `server/src/services/layoutAwarePromptBuilder.ts` | Created | Combines template schema + reconstructed tables into LLM prompt |
| `server/src/services/__tests__/layoutAwarePromptBuilder.test.ts` | Created | 5 unit tests for prompt content |
| `server/src/services/pdfExtractor.ts` | Modified | Optional `pageTextItems` layout path gated by `useTemplateGraphPipeline`; added `extractLayoutFromPdf` |
| `server/src/services/__tests__/pdfExtractor.layout.test.ts` | Created | 3 unit tests mocking `pdfjs` items and feature flags |
| `server/src/services/templateRegistryService.ts` | Modified | Added optional `rotation` to `TextItem` to carry pdfjs rotation angle |

## Files Changed in Slice 4

| File | Action | Notes |
|------|--------|-------|
| `server/src/services/coverageGraphService.ts` | Created | Probabilistic graph service: query, queryDeductible, addEdge/addEdges, learnCorrection, propagate, listEdges, updateEdge, deleteEdge, cache |
| `server/src/services/__tests__/coverageGraphService.test.ts` | Created | 16 unit tests for graph query, propagation, learning, and edge CRUD |
| `server/src/schemas/templateRegistrySchema.ts` | Modified | Extended `GraphEdgeTypeSchema` with `alias_of`, `deductible_for`, `excludes` |
| `server/src/services/coverageNormalizer.ts` | Modified | Graph fallback in `mapRawToCanonical`/`mapRawToCanonicalBatch`, `graphConfidence` field, async `detectImplicitCoverages` with graph composite decomposition |
| `server/src/services/__tests__/coverageNormalizer.graph.test.ts` | Created | 7 graph integration tests for normalizer fallback and decomposition |
| `server/src/services/semanticMatcher.ts` | Modified | Added coverage graph as fifth matching layer; `SemanticMatchResult.method` includes `'graph'` |
| `server/src/services/quoteParser.ts` | Modified | Updated `ParsedCoverage.matchMethod` union to include `'graph'` |
| `server/src/services/__tests__/semanticMatcher.graph.test.ts` | Created | 5 graph integration tests for semanticMatcher |
| `server/src/services/thesaurusMapper.ts` | Modified | Added `seedGraphFromEntries` and `seedGraphFromThesaurus` to write `alias_of` edges |
| `server/src/services/__tests__/thesaurusMapper.graph.test.ts` | Created | 5 tests for thesaurus-to-graph seeding |
| `server/src/routes/templateRegistry.ts` | Modified | Added admin graph endpoints; reordered admin routes before `/:templateId` |
| `server/src/routes/__tests__/templateRegistry.graph.test.ts` | Created | 6 admin graph route tests |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1/3.2 | `server/src/services/__tests__/layoutParser.test.ts` | Unit | N/A (new) | Written | Passed | 9 cases (simple table, two tables, single column, empty, regions, merged cells, rotation) | Clean |
| 3.3 | `server/src/services/__tests__/layoutParser.test.ts` | Unit | N/A (new) | Written | Passed | rotated page detection + failure logging | Clean |
| Prompt builder | `server/src/services/__tests__/layoutAwarePromptBuilder.test.ts` | Unit | N/A (new) | Written | Passed | 5 cases (schema, markdown, hints, empty tables, merged cells) | Clean |
| pdfExtractor layout path | `server/src/services/__tests__/pdfExtractor.layout.test.ts` | Unit | 6/6 passed | Written | Passed | 3 cases (layout extraction, flag on, flag off) | Clean |
| 4.1/4.2 | `server/src/services/__tests__/coverageGraphService.test.ts` | Unit | N/A (new) | Written | Passed | 16 cases (query, composite, deductible, learn, propagate, list, update, delete, cache) | Clean |
| 5.4 | `server/src/services/__tests__/coverageNormalizer.graph.test.ts` | Unit | semanticMatcher mocked | Written | Passed | 7 cases (fallback, flag disabled, standard match, graphConfidence, implicit injection, uncategorized) | Clean |
| 5.6 | `server/src/services/__tests__/semanticMatcher.graph.test.ts` | Unit | embeddingService/LLM mocked | Written | Passed | 5 cases (graph match, string id, flag disabled, earlier layer wins, low confidence ignored) | Clean |
| 5.8 | `server/src/services/__tests__/thesaurusMapper.graph.test.ts` | Unit | coverageGraphService mocked | Written | Passed | 5 cases (alias edges, options, empty entries, thesaurus load) | Clean |
| Admin endpoints | `server/src/routes/__tests__/templateRegistry.graph.test.ts` | Route | auth mocked | Written | Passed | 6 cases (list, add, delete, correction, seed-thesaurus, 403) | Clean |

### Test Summary
- **Total tests written**: 39 (slice 4 only)
- **Total tests passing**: 39 (slice 4 only)
- **Layers used**: Unit (33), Route (6)
- **Approval tests**: None — no refactoring-only tasks
- **Pure functions created**: `normalizeNodeName`, `stripPrefix`, `edgeConfidence`, `correctionBoost`, `rankMappings` (within `coverageGraphService`)

## Deviations from Design

- `layoutParser.ts` uses gap-based column clustering instead of full DBSCAN/k-means; this keeps the service dependency-free while still producing stable column boundaries for typical insurer tables.
- Region detection uses y-coordinate bands relative to the page’s item bounds because real page dimensions are not always available from `pdfjs` text items alone.
- `extractLayoutFromPdf` is exposed as a standalone function rather than only through `extractTextFromPdf`, so callers can request layout reconstruction without forcing the master pipeline flag on.
- `coverageGraphService` accepts injected `db` and `cache` dependencies for testability; the default singleton uses `supabase` and Redis cache.
- Confidence scoring = edge weight + 0.02 per correction, capped at 0.99, with a 5% embedding-similarity blend.
- `coverageNormalizer` resolves numeric graph `canonicalId` to canonical category name via `semanticMatcher.getCategoryName`.
- `detectImplicitCoverages` is now async and queries the graph for composite decomposition when `useTemplateGraphPipeline` is enabled.
- `semanticMatcher` uses the graph as a fifth layer after the LLM fallback.
- Admin graph routes were moved before `/:templateId` to prevent Express parameter shadowing.

## Issues Found

- Existing full test suite has unrelated pre-existing failures due to missing `GEMINI_API_KEY`, `SUPABASE_*` credentials, and other environment requirements. Slice 4 tests pass independently with dummy env vars.
- `TextItem` needed an optional `rotation` field to propagate pdfjs rotation angles to the layout parser; this is a backward-compatible type extension.
- `quoteParser.ts` needed `ParsedCoverage.matchMethod` updated to include `'graph'` after extending `SemanticMatchResult.method`.
- Test mock state leak: `featureFlags.isEnabled` return value persisted across tests in `coverageNormalizer.graph.test.ts`; fixed by resetting the mock implementation in `beforeEach`.

## Risks

- Column clustering relies on a fixed x-tolerance default (12 pts); tables with very narrow or irregular columns may need per-template tuning.
- Layout region detection is heuristic (15% top/bottom bands); it may misclassify pages with unusual margins.
- `extractTextFromPdf` now imports `featureFlags`, so any test that mutates the global flag can affect concurrent tests. Tests reset the flag in `beforeEach`.
- The `layoutAwarePromptBuilder` prompt is in Spanish because the existing extraction prompts are Spanish; this matches project conventions.
- `coverageGraphService.query` currently loads all edges for a domain into memory; acceptable for MVP but a scalability note.
- `embeddingService` is mocked in graph/normalizer tests to avoid real API calls and retries.

## Next Recommended Phase

Continue `sdd-apply` slice 5 — Phase 5 remaining pipeline integrations (`promptBuilder.ts`, `quoteProcessingService.ts`, `coverageOntology.ts`, `hybridDeductibleParser.ts`, `learningEngine.ts`).

## Branch / PR Boundary

- Slice 3 PR branch: `feature/mejora-extraccion-coberturas-slice-3`
- Slice 4 PR branch: `feature/mejora-extraccion-coberturas-slice-4`
- Target (stacked-to-main): `feature/mejora-extraccion-coberturas-slice-3`
- Estimated review budget impact: ~700 changed lines (above the 400-line soft budget, consistent with the auto-forecast chained PR plan).
