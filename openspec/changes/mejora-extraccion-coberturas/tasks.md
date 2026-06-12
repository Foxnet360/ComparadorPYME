# Tasks: Improve Coverage, Deductible, and Condition Extraction

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,000–2,500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Base |
|------|------|----|------|
| 1 | Foundation: migration, flags, template seeds, graph seeding, domain types | PR 1 | `main` |
| 2 | Core services: template registry, layout parser, coverage graph | PR 2 | PR 1 |
| 3 | Extraction routing: detection, prompts, quote processor, normalizer | PR 3 | PR 2 |
| 4 | Deductible/learning/tests: parser, learning, golden set, evaluation | PR 4 | PR 3 |

## Phase 1: Foundation

- [x] 1.1 Create `server/supabase/migrations/019_template_registry_and_graph.sql`.
- [x] 1.2 Add feature flags to `server/src/config/featureFlags.ts`.
- [x] 1.3 Create `data/domains/pyme/template-seeds.json` for BBVA, SBS, MAPFRE.
- [x] 1.4 Seed graph edges from `taxonomy.json`/`ontology.json` on startup.
- [x] 1.5 Define core domain types/interfaces (`TemplateRegistryEntry`, `LayoutTable`, `GraphEdge`, etc.).

## Phase 2: Template Registry (TDD)

- [x] 2.1 RED: Write unit tests for fingerprint scoring and schema validation.
- [x] 2.2 GREEN: Implement `server/src/services/templateRegistry.ts`.
- [x] 2.3 REFACTOR: Add cache refresh and `TemplateRegistryEntry` interfaces.
- [x] 2.4 Modify `server/src/services/insurerProfileService.ts` to expose registry seeds.

## Phase 3: Layout Parser (TDD)

- [ ] 3.1 RED: Write unit tests for row/column clustering with mocked `pdfjs` items.
- [ ] 3.2 GREEN: Implement `server/src/services/layoutParser.ts`.
- [ ] 3.3 REFACTOR: Add rotated-page detection and `layout_parse_failed` logging.

## Phase 4: Coverage Semantic Graph (TDD)

- [ ] 4.1 RED: Write unit tests for graph query, propagation, and learning.
- [ ] 4.2 GREEN: Implement `server/src/services/coverageGraph.ts`.
- [ ] 4.3 REFACTOR: Add Redis cache and periodic propagation.

## Phase 5: Pipeline Integration

- [x] 5.1 Modify `formatDetector.ts` to return `templateId`/`templateConfidence`.
- [ ] 5.2 Modify `promptBuilder.ts` to add `buildTemplatePrompt`.
- [ ] 5.3 Modify `quoteProcessingService.ts` to route known templates.
- [ ] 5.4 Modify `coverageNormalizer.ts` to use graph probabilities and decompositions.
- [ ] 5.5 Modify `coverageOntology.ts` to use graph consensus scoring.
- [ ] 5.6 Modify `semanticMatcher.ts` to rank with graph probabilities.
- [ ] 5.7 Modify `hybridDeductibleParser.ts` with template hints and `appliesTo` rules.
- [ ] 5.8 Modify `thesaurusMapper.ts` and `learningEngine.ts` to write graph edges.

## Phase 6: Evaluation & Rollout

- [ ] 6.1 Create `server/src/services/goldenSetEvaluation.ts`.
- [ ] 6.2 Build 30-quote annotated golden-set fixtures.
- [ ] 6.3 Add integration tests for template and graph paths.
- [ ] 6.4 Run golden-set evaluation and set thresholds before enabling flags.

## Phase 7: Documentation

- [ ] 7.1 Document template schemas and graph edge semantics.
- [ ] 7.2 Add metrics/logging for matches, layout failures, and cold-start misses.
