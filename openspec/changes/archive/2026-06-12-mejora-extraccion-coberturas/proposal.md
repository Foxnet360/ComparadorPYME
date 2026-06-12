# Proposal: Improve Coverage, Deductible, and Condition Extraction

## Intent

The current multimodal extraction delegates too much to a single vision LLM call. Format families are coarse, insurer-specific layouts are ignored, and normalization depends on flat thesaurus/embedding matching that fails on composite coverages and proprietary insurer names. Analysts still complete Excel manually. This change makes extraction layout-aware and insurer-aware, and gives normalization a probabilistic semantic backstop that learns from corrections.

## Scope

### In Scope
- Add an insurer-specific template registry on top of format-family detection.
- Use `pdfjs` layout coordinates to reconstruct table rows/columns before LLM extraction.
- Introduce a probabilistic semantic graph for coverage mapping, deductible linking, and composite-coverage decomposition.
- Feed human corrections into both the graph and the existing learning engine/thesaurus.
- Build a golden-set evaluation harness to measure accuracy before/after.

### Out of Scope
- Replacing the PDF text extraction engine or adding OCR/scanned-PDF support.
- Changing the 14 canonical PYME categories.
- Rewriting clause RAG or premium calculation.
- Activating `useUnifiedComparisonEngine`.
- Frontend redesign beyond new confidence flags.

## Capabilities

### New Capabilities
- `insurer-template-registry`: Detect insurer-specific PDF templates and enforce structured extraction schemas.
- `layout-aware-quote-extraction`: Reconstruct tables from `pdfjs` bounding boxes before asking the LLM to fill cells.
- `coverage-semantic-graph`: Probabilistic graph of raw terms, canonical categories, insurer aliases, sub-limits, deductibles, and decomposition rules.

### Modified Capabilities
- `format-family-detection`: Add insurer-template fingerprint detection alongside existing format families.
- `semantic-coverage-matching`: Consume graph probabilities and composite coverage decompositions.
- `coverage-post-normalization`: Accept decomposed coverages and graph-derived probabilities.
- `deductible-semantic-parser`: Use template-specific deductible locations and graph rules.
- `learning-engine`: Persist corrections as graph edges/aliases in addition to thesaurus/cache updates.

## Approach

**Primary:** combine both exploration alternatives.
1. **Template registry (Approach A)** for the most frequent insurers: fingerprint PDFs by insurer + layout markers, define strict JSON schemas per template, and let the LLM fill pre-located cells.
2. **Semantic graph (Approach B)** as the safety net: everything not matching a known template flows through a probabilistic graph that propagates coverage categories, splits composite names, links deductibles, and learns from corrections.

**Fallback:** if representative template samples are unavailable, start with the semantic graph alone and add templates incrementally as analysts correct cases.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/formatDetector.ts` | Modified | Add insurer-template fingerprint path. |
| `server/src/services/insurerProfileService.ts` | Modified | Convert profiles into template registry entries. |
| `server/src/services/promptBuilder.ts` | Modified | Add template-scoped prompts. |
| `server/src/services/quoteProcessingService.ts` | Modified | Route known templates to structured extraction. |
| `server/src/services/coverageNormalizer.ts` | Modified | Accept graph probabilities. |
| `server/src/services/coverageOntology.ts` | Modified | Use graph nodes for consensus scoring. |
| `server/src/services/learningEngine.ts` | Modified | Write corrections into graph edges. |
| `data/domains/pyme/` | Modified | Seed graph aliases and decomposition rules. |
| `server/src/services/templateRegistry.ts` | New | Registry + schema store. |
| `server/src/services/layoutParser.ts` | New | `pdfjs` row/column reconstruction. |
| `server/src/services/coverageGraph.ts` | New | Graph model, query, and learning update API. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No representative golden set exists | High | Build a 30-quote evaluation set in the first slice before changing code. |
| `pdfjs` layout parsing fails on some generated PDFs | Med | Keep legacy vision path as fallback; log parse failures. |
| Overfit to top insurers | Med | Force all unmatched quotes through the graph; review per-insurer accuracy. |
| Semantic graph cold-start quality | Med | Seed graph from existing thesaurus/ontology and validate against golden set. |
| Increased LLM latency from few-shot prompts | Low | Cache template schemas and graph lookups; batch embedding calls. |

## Rollback Plan

1. Feature-flag the new pipeline (`USE_TEMPLATE_GRAPH_PIPELINE`).
2. On failure, disable the flag to fall back to the current multimodal + flat normalizer path.
3. Revert the PR; the legacy thesaurus/cache remains untouched.

## Dependencies

- `pdfjs-dist` for layout extraction.
- Annotated golden set (30+ quotes across top insurers).
- Supabase/Redis storage for graph edges and template registry.
- Analyst validation time for template schemas.

## Success Criteria

- [ ] Coverage extraction accuracy on the golden set reaches >= 85% for the top 5 insurers.
- [ ] Deductible assignment accuracy reaches >= 80%.
- [ ] Manual analyst completion rate per quote drops by >= 30%.
- [ ] Average corrections per quote drop by >= 25%.
- [ ] Uncategorized/no-match rate stays below 10%.
- [ ] End-to-end latency increases by no more than 20%.
