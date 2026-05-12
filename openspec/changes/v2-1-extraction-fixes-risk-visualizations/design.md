## Context

The Comparador CSA V2 multimodal extraction pipeline was deployed to production (commit 6880dee) but exhibits critical issues in real-world usage. Testing with 4 quotes from `Ejemplos/laser-home` (MAPFRE, CHUBB, BBVA, AXA) revealed:

1. **Deductible extraction failure**: All deducibles extracted as "NO ESPECIFICADO" despite existing in PDFs
2. **Coverage visibility gap**: Only MAPFRE appears in "Coberturas No Categorizadas" (56 items), others empty because V2 pipeline discards non-canonical coverages
3. **RAG timeout cascade**: 30+ RAG timeout errors per analysis, causing 374s (6.2min) total time vs <5min target
4. **Missing visual risk indicators**: Audit section shows only text and counters, no visual heatmap/gauge
5. **Manual enrichment friction**: Users must click "Enriquecer con Clausulados" button manually
6. **Broken UI element**: "Referencias RAG" toggle exists but does nothing

Current architecture uses sequential quote processing, per-insurer RAG queries, and aggressive "NO ESPECIFICADO" fallback without attempting recovery.

## Goals / Non-Goals

**Goals:**
- Extract deducibles correctly for >80% of coverages across all 6 format families
- Display ALL coverages (canonical + uncategorized grouped by type) in unified matrix
- Reduce analysis time to <3min for 4 quotes through parallelization and batch RAG
- Add heatmap, radar chart, and deductible gauges to audit section
- Automate clause enrichment when clausulados are available
- Remove non-functional UI elements

**Non-Goals:**
- Rebuild the entire extraction pipeline from scratch
- Add new AI models beyond Gemini 2.5 Pro
- Modify the 14 canonical coverage schema
- Change the comparison scoring algorithm
- Implement real-time collaborative editing

## Decisions

### 1. Schema V2: Force Deductible Extraction
**Decision:** Change `deductible` field from `nullable: true` to mandatory with explicit instruction.
**Rationale:** Current schema allows Gemini to skip deductibles. Making it mandatory with "No aplica" as valid value forces extraction.
**Alternative considered:** Post-process text extraction to find missing deductibles - rejected because multimodal vision already sees all pages.

### 2. Prompt Enhancement: Multi-Page Deductible Awareness
**Decision:** Add explicit instruction to ALL format family prompts: "Revisar TODAS las páginas para deducibles."
**Rationale:** HDI format (TABLE-DOUBLE) already has this instruction and works better. Other formats lack it.
**Alternative considered:** Single generic prompt - rejected because format-specific examples improve accuracy.

### 3. Intelligent Fallback: "No aplica" vs "NO ESPECIFICADO"
**Decision:** Implement coverage-type aware fallback instead of blanket "NO ESPECIFICADO".
**Rationale:** Asistencia PYME, Asistencia Legal, and similar services typically have no deductible. Using "No aplica" for these reduces noise.
**Implementation:** Check canonical name against known no-deductible list before falling back.

### 4. Preserve Uncategorized Coverages with Semantic Grouping
**Decision:** Add `uncategorizedCoverages` array to extraction result, grouped by semantic similarity into business types.
**Rationale:** Current pipeline discards non-canonical coverages silently. Users need to see all coverages for accurate comparison.
**Grouping strategy:** Use embedding similarity to cluster into "Asistencias", "Servicios", "Amparos Adicionales", "Otros".

### 5. Parallel Quote Processing
**Decision:** Process all quotes simultaneously using `Promise.all()` with individual 5min timeouts.
**Rationale:** Current sequential processing adds latency linearly. Quotes are independent until cross-reference phase.
**Risk:** Memory pressure with 4 simultaneous Gemini vision calls. Mitigation: Limit concurrency to 2 if memory issues arise.

### 6. Batch RAG: One Query Per Coverage, Not Per Insurer
**Decision:** Query RAG once per canonical coverage name, then distribute results to all insurers.
**Rationale:** Current approach queries "clauses for Incendio + MAPFRE", "clauses for Incendio + CHUBB", etc. Clause content is insurer-agnostic for most coverages.
**Exception:** Keep per-insurer queries for insurer-specific clauses (detected by document metadata).

### 7. Insurer-Aware RAG: Skip Non-Indexed Insurers
**Decision:** Check clausulado index before RAG query; skip if none exist for insurer.
**Rationale:** Logs show repeated "No clauses found" errors. Skipping saves ~10s per insurer.
**Implementation:** Pre-flight check using `checkClausesAvailability()` before batch query.

### 8. Risk Visualizations: Recharts + Tailwind
**Decision:** Use existing Recharts dependency for radar chart, custom SVG/Tailwind for heatmap and gauges.
**Rationale:** Recharts already in project. Heatmap and gauges are simple enough for custom implementation without new dependencies.
**Alternative considered:** D3.js - rejected to avoid new dependency.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini still misses deductibles despite schema change | Medium | Add post-extraction validation that checks if deductible is missing for coverage types that should have one |
| Parallel processing memory exhaustion | Medium | Limit concurrency to 2 quotes at a time if memory >80% |
| Batch RAG returns generic clauses | Low | Tag clauses with insurer metadata; filter by insurer name if specific clauses exist |
| Heatmap becomes unreadable with many insurers | Low | Cap at 6 insurers visible, add scroll or insurer selector |
| "No aplica" misclassification | Low | Maintain override list; log misclassifications for review |

## Migration Plan

1. **Deploy with feature flag** (`ENABLE_V2_1_FIXES=true`) - default false
2. **Test with laser-home examples** - verify deductibles, coverage visibility, timing
3. **Enable for 1 user** - monitor logs for 24h
4. **Gradual rollout** - 25% → 50% → 100% over 3 days
5. **Rollback** - set `ENABLE_V2_1_FIXES=false` to revert to previous behavior

## Open Questions

1. Should uncategorized coverages contribute to scoring algorithm?
2. What's the maximum number of uncategorized coverages to display before collapsing?
3. Should gauge colors be configurable per client preference?
