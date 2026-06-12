# Apply Progress: Improve Coverage, Deductible, and Condition Extraction

## Slice 1 — Foundation

**Status**: success  
**Mode**: Strict TDD (Vitest)  
**Branch**: `feature/mejora-extraccion-coberturas-slice-1`  
**Chain strategy**: `stacked-to-main` — this PR targets `main`

## Completed Tasks

- [x] 1.1 Create `server/supabase/migrations/019_template_registry_and_graph.sql`.
- [x] 1.2 Add feature flags to `server/src/config/featureFlags.ts`.
- [x] 1.3 Create `data/domains/pyme/template-seeds.json` for BBVA, SBS, MAPFRE.
- [x] 1.4 Seed graph edges from `taxonomy.json`/`ontology.json` on startup.
- [x] 1.5 Define core domain types/interfaces (`TemplateRegistryEntry`, `LayoutTable`, `GraphEdge`, etc.).

## Remaining Tasks

### Phase 2: Template Registry (TDD)
- [ ] 2.1 RED: Write unit tests for fingerprint scoring and schema validation.
- [ ] 2.2 GREEN: Implement `server/src/services/templateRegistry.ts`.
- [ ] 2.3 REFACTOR: Add cache refresh and `TemplateRegistryEntry` interfaces.
- [ ] 2.4 Modify `server/src/services/insurerProfileService.ts` to expose registry seeds.

### Phase 3: Layout Parser (TDD)
- [ ] 3.1 RED: Write unit tests for row/column clustering with mocked `pdfjs` items.
- [ ] 3.2 GREEN: Implement `server/src/services/layoutParser.ts`.
- [ ] 3.3 REFACTOR: Add rotated-page detection and `layout_parse_failed` logging.

### Phase 4: Coverage Semantic Graph (TDD)
- [ ] 4.1 RED: Write unit tests for graph query, propagation, and learning.
- [ ] 4.2 GREEN: Implement `server/src/services/coverageGraph.ts`.
- [ ] 4.3 REFACTOR: Add Redis cache and periodic propagation.

### Phase 5: Pipeline Integration
- [ ] 5.1 Modify `formatDetector.ts` to return `templateId`/`templateConfidence`.
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

## Files Changed in Slice 1

| File | Action | Notes |
|------|--------|-------|
| `server/supabase/migrations/019_template_registry_and_graph.sql` | Created | `template_registry` + `coverage_graph_edges` tables + indexes |
| `server/src/config/featureFlags.ts` | Modified | Added `useTemplateGraphPipeline`, per-template toggles, `graphLearningEnabled` |
| `server/src/config/__tests__/featureFlags.test.ts` | Created | Env override + default flag tests |
| `server/src/types/templateGraph.ts` | Created | Re-exported domain types |
| `server/src/schemas/templateRegistrySchema.ts` | Created | Zod schemas + validators for all new domain types |
| `server/src/services/__tests__/templateGraphTypes.test.ts` | Created | Domain type validation tests |
| `data/domains/pyme/template-seeds.json` | Created | BBVA, SBS, MAPFRE template seeds |
| `data/domains/pyme/bundle.json` | Modified | Includes `template-seeds.json` |
| `server/src/services/__tests__/templateSeeds.test.ts` | Created | Seed loading + validation tests |
| `server/src/services/__tests__/domainBundleLoader.test.ts` | Modified | Updated manifest length/assertions |
| `server/src/services/graphSeeder.ts` | Created | Builds `maps_to`/`decomposes_to` edges; `seedCoverageGraph` upsert helper |
| `server/src/services/__tests__/graphSeeder.test.ts` | Created | Edge generation + upsert tests |
| `server/src/services/__tests__/migration019.test.ts` | Created | Migration content assertions |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `server/src/services/__tests__/migration019.test.ts` | Unit | N/A (new) | Written | Passed | 4 assertions | Clean |
| 1.2 | `server/src/config/__tests__/featureFlags.test.ts` | Unit | N/A (new) | Written | Passed | 6 env/JSON cases | Clean |
| 1.3 | `server/src/services/__tests__/templateSeeds.test.ts` | Unit | N/A (new) | Written | Passed | 5 insurer/schema cases | Clean |
| 1.4 | `server/src/services/__tests__/graphSeeder.test.ts` | Unit | N/A (new) | Written | Passed | 7 edge/upsert cases | Clean |
| 1.5 | `server/src/services/__tests__/templateGraphTypes.test.ts` | Unit | N/A (new) | Written | Passed | 6 type/validation cases | Clean |

## Deviations from Design

None — implementation matches the design. The `seedCoverageGraph` helper is provided but not yet wired into `server/src/index.ts` startup to keep this slice self-contained and avoid accidental side effects before the rest of the pipeline is ready.

## Issues Found

- The previous env-var mapping in `featureFlags.ts` derived camelCase keys incorrectly (`structuredclauseextraction` instead of `structuredClauseExtraction`). Fixed by introducing an explicit `ENV_FLAG_MAP`.
- `bundle.json` previously listed 3 files; updated to 4 with `template-seeds.json` and adjusted the existing bundle test.

## Risks

- Composite pattern slugs are derived from the first alternative of the regex. If patterns are reordered, composite node ids change and learned edges could orphan. A stable composite id registry may be needed later.
- `seedCoverageGraph` is not yet invoked at server startup; slice 2/3 must decide the right lifecycle hook (bootstrap script vs. explicit admin endpoint).
- Template schemas are minimal; real PDF column layouts may require more precise `extractionHints` after golden-set validation.

## Next Recommended Phase

`sdd-apply` slice 2 — Phase 2: Template Registry (fingerprint scoring, schema validation, cache refresh).
