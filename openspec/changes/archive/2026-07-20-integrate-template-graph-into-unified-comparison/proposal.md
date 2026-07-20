# Proposal: Integrate Template Registry and Coverage Graph into Unified Comparison

## Intent

The default `/api/analyze` path uses the unified comparison engine, but `flatTableParser` lacks canonical mapping. The template registry and coverage semantic graph from `mejora-extraccion-coberturas` are dormant. This change integrates them into the unified engine to improve precision and comparability while preserving raw LLM output as user-visible truth.

## Scope

### In Scope
- **Slice 1 — Graph canonicalization**: Use `coverageGraphService` to canonicalize rows and link deductibles.
- **Slice 2 — Template-aware prompts**: Inject hints from `templateRegistryService` for BBVA, SBS, MAPFRE.
- **Slice 3 — Learning loop**: Feed corrections into the graph via `learningEngine`.
- Minimal UI for canonical coverage name.
- Uncovered insurers fall back to generic prompt, preserving raw labels.

### Out of Scope
- Legacy per-quote pipeline stays as fallback.
- New storage; reuse tables.
- Large UI redesign.

## Capabilities

### New Capabilities
- `unified-graph-canonicalization`: Canonicalize rows and deductibles via graph.
- `template-aware-unified-prompt`: Inject template hints into unified prompt.
- `unified-learning-loop`: Capture corrections as learned edges.

### Modified Capabilities
- `unified-comparison-extraction`: Add graph post-processing.
- `comparison-engine-adapter`: Add rollout.
- `coverage-semantic-graph`: Extend query for raw labels.
- `feature-flags`: Add `useUnifiedGraphCanonicalization`, `useUnifiedTemplateHints`, per-insurer flags.

## Approach

Slice 1 first: it uses infrastructure without changing the LLM call. Hook parser and transformer into `coverageGraphService.query()` for canonical labels, deductible links. For recognized insurers, match template and append hints to `comparisonPromptBuilder.buildV2ComparisonPrompt()`. Keep single-call LLM: template/graph inform prompts and canonicalize output, never overwrite raw text. Add env flags with percentage rollout. Route corrections through `learningEngine` and `coverageGraphService.learnCorrection`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modified | Adds rollout |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Queries graph |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modified | Renders canonical rows |
| `server/src/services/coverageGraphService.ts` | Modified | Queried by engine |
| `server/src/config/featureFlags.ts` | Modified | New flags |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Graph mis-canonicalization | Med | Rollout; raw labels preserved |
| Template hints increase cost | Med | Measure tokens; disable if >15% |
| Divergent unified vs legacy | Med | Golden-set evaluation |

## Rollback Plan

Set `USE_UNIFIED_GRAPH_CANONICALIZATION=0` and `USE_UNIFIED_TEMPLATE_HINTS=0`. No migration required; cached results remain valid.

## Dependencies

- Existing `coverage_graph_edges` and `template_registry` Supabase tables.
- Redis for cache and rollout.
- Golden-set evaluation extended.

## Success Criteria

- [ ] Slice 1: Canonical coverage accuracy +15% over alias baseline on golden set.
- [ ] Slice 2: Template-hint insurers reduce missing-row rate by 20% on golden set.
- [ ] Slice 3: Corrections create graph edges within 24 hours.
- [ ] Latency p95 increase ≤25%.
- [ ] Flags support 0-100% rollout without deploy.
