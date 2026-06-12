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

### Phase 5: Pipeline Integration (partial, started in this slice)
- [x] 5.1 Modify `formatDetector.ts` to return `templateId`/`templateConfidence`.

## Remaining Tasks

### Phase 3: Layout Parser (TDD)
- [ ] 3.1 RED: Write unit tests for row/column clustering with mocked `pdfjs` items.
- [ ] 3.2 GREEN: Implement `server/src/services/layoutParser.ts`.
- [ ] 3.3 REFACTOR: Add rotated-page detection and `layout_parse_failed` logging.

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

## Files Changed in Slice 2

| File | Action | Notes |
|------|--------|-------|
| `server/src/services/templateRegistryService.ts` | Created | Fingerprint scoring, schema validation (AJV), cache, CRUD |
| `server/src/services/__tests__/templateRegistryService.test.ts` | Created | 16 unit tests covering detection, validation, cache, CRUD |
| `server/src/services/insurerProfileService.ts` | Modified | Added `getRegistrySeed` / `getAllRegistrySeeds` |
| `server/src/services/__tests__/insurerProfileService.test.ts` | Created | Registry seed exposure tests |
| `server/src/services/formatDetector.ts` | Modified | Added `templateId`/`templateConfidence` and `detectFormatWithRegistry` |
| `server/src/services/__tests__/formatDetector.test.ts` | Modified | Added registry integration tests |
| `server/src/routes/templateRegistry.ts` | Created | Admin/ops CRUD + cache refresh + seed-graph endpoints |
| `server/src/routes/__tests__/templateRegistry.test.ts` | Created | Route authorization and CRUD tests |
| `server/src/index.ts` | Modified | Wired `/api/templates/registry` and startup `seedCoverageGraph` bootstrap |
| `server/src/services/templateRegistryService.ts` | Modified | Added `TemplateRegistryService` interface for typed consumers |
| `package.json` / `package-lock.json` | Modified | Added `ajv` dependency for JSON Schema enforcement |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1/2.2 | `server/src/services/__tests__/templateRegistryService.test.ts` | Unit | N/A (new) | Written | Passed | 5 match cases + 3 schema/cache/CRUD cases | Clean |
| 2.3 | `server/src/services/__tests__/templateRegistryService.test.ts` | Unit | N/A (new) | Written | Passed | Cache hit/miss, refresh, invalidate | Clean |
| 2.4 | `server/src/services/__tests__/insurerProfileService.test.ts` | Unit | N/A (new) | Written | Passed | 4 insurer/seed cases | Clean |
| 5.1 | `server/src/services/__tests__/formatDetector.test.ts` | Unit | 18/18 passed | Written | Passed | 5 registry/fallback cases | Clean |
| Routes | `server/src/routes/__tests__/templateRegistry.test.ts` | Integration | N/A (new) | Written | Passed | 8 admin/CRUD/auth cases | Clean |

### Test Summary
- **Total tests written**: 51 (slice 2 only)
- **Total tests passing**: 51 (slice 2 only)
- **Layers used**: Unit (43), Integration (8)
- **Approval tests**: None — no refactoring-only tasks
- **Pure functions created**: `scoreEntry`, `layoutMarkerMatches`, `regionPredicate`, `validatePayload`, `isInsurerTemplateEnabled`

## Deviations from Design

- The service file is named `templateRegistryService.ts` instead of the design's `templateRegistry.ts` to match the project's `*Service` naming convention.
- `detectFormatFamily` remains synchronous and backwards-compatible; registry consultation is provided by the new async `detectFormatWithRegistry`. This avoids breaking existing callers (`quoteProcessingService`, `compareController`) in this slice.
- Layout region thresholds (top/bottom/left/right/center) use heuristic coordinate bands because real PDF page dimensions are not available from plain text items. The thresholds can be refined during golden-set validation.

## Issues Found

- Existing full test suite has unrelated pre-existing failures due to missing `GEMINI_API_KEY`, `SUPABASE_*` credentials, and other environment requirements. Slice 2 tests pass independently.
- `ajv` was not previously a dependency; added to enforce JSON Schema validation per the design.

## Risks

- Layout marker scoring relies on arbitrary coordinate bands; real PDFs may need dimension-aware region mapping.
- `seedCoverageGraph` is now wired into the startup bootstrap but only runs when `useTemplateGraphPipeline` is enabled. If the flag is toggled on without a reachable Supabase instance, the server will log an error but still start.
- The default `templateRegistryService` instance has no `db` unless created with `supabase`. The route uses the instance with `supabase`, but callers that use the no-`db` default will get errors on upsert/delete.
- Feature flags are global mutable state; `detectFormatWithRegistry` tests mutate them and could affect other tests if run concurrently. The tests reset flags per case, but this is a known fragility.

## Next Recommended Phase

`sdd-apply` slice 3 — Phase 3: Layout Parser (row/column clustering with mocked `pdfjs` items).

## Branch / PR Boundary

- Slice 2 PR branch: `feature/mejora-extraccion-coberturas-slice-2`
- Target (stacked-to-main): `feature/mejora-extraccion-coberturas-slice-1`
- Estimated review budget impact: ~550 changed lines (slightly above the 400-line soft budget, but consistent with the auto-forecast chained PR plan).
