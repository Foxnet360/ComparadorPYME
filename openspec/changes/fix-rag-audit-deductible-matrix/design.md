## Context

The audit section is the primary differentiator of the Comparador PYME tool. However, production logs show it's completely broken due to a schema mismatch: `ragRetrievalService.checkInsurerHasClauses()` queries the `chunks` table which lacks the `insurer_name` column, while the actual clause data is in `clause_chunks` (which is currently empty, but the code must use the correct schema).

Additionally, the DeductibleGauge component (60px SVG circle) creates visual clutter in the coverage matrix, overlapping with text and making the interface unusable for uncategorized coverages (28+ items).

The uncategorized coverage "matrix" view is actually a single-column list showing only the first insurer's data.

Current analysis time is 170s for 2 quotes, primarily due to excessive LLM calls during semantic matching.

## Goals / Non-Goals

**Goals:**
1. Fix RAG schema to make audit section functional
2. Replace DeductibleGauge with compact DeductibleBadge
3. Fix uncategorized coverage matrix to show all insurers
4. Add quote-based audit analysis that works without RAG
5. Create structured deductible matrix with risk comparison
6. Extract special conditions from quote raw text
7. Reduce analysis time from 170s to under 60s

**Non-Goals:**
- Reindexing clause documents (out of scope - assumes chunks exist or we fix the query)
- Redesigning the entire UI (focus on fixes, not redesign)
- Adding new AI models (use existing Gemini integration)
- Mobile app development

## Decisions

### Decision 1: Use `clause_chunks` table with fallback to documents table
**Rationale**: The `chunks` table is a generic document store without `insurer_name`. The `clause_chunks` table has the proper schema but may be empty. We'll query `clause_chunks` first, and if empty, check `documents` table for clause documents.
**Alternative**: Create a migration to add `insurer_name` to `chunks` - rejected because it would require data migration and testing.

### Decision 2: Inline badges instead of circular gauges for deductibles
**Rationale**: A 60px SVG circle is too large for table cells. An 8px colored dot with text is cleaner and scales better.
**Alternative**: Make gauge smaller (20px) - rejected because text becomes illegible and it still adds unnecessary complexity.

### Decision 3: Quote-based audit as primary, RAG as enrichment
**Rationale**: RAG depends on indexed clauses which may not always be available. Quote-based analysis uses data we already have (coverages, deductibles, raw text) and can run 100% of the time.
**Alternative**: Only use RAG - rejected because it makes the tool unreliable.

### Decision 4: Batch embedding generation for semantic matching
**Rationale**: Current code calls LLM for each coverage individually (15-25s each). Generating embeddings in batch reduces API calls from N to 1.
**Alternative**: Cache all matches permanently - rejected because coverage names may vary.

## Risks / Trade-offs

- **[Risk]** `clause_chunks` table is empty in production → [Mitigation] Add fallback to check `documents` table for clause documents
- **[Risk]** Quote-based audit may miss nuances that RAG would catch → [Mitigation] Clearly label audit sources ("Análisis de cotización" vs "Enriquecido con clausulados")
- **[Risk]** Special condition extraction via regex may be brittle → [Mitigation] Use multiple pattern variations and mark confidence levels
- **[Risk]** Performance optimization may reduce match accuracy → [Mitigation] Only skip LLM when fuzzy/embedding confidence > 0.8

## Migration Plan

1. Deploy backend fixes (RAG schema, quote-based auditor)
2. Deploy frontend fixes (badges, matrix, deductible tab)
3. Monitor logs for 24h to verify RAG queries succeed
4. If `clause_chunks` remains empty, run indexing script for clause documents

## Open Questions

1. Should we add a migration script to populate `clause_chunks` from existing `chunks` data?
2. What's the performance impact of batch embedding on memory usage?
3. Should quote-based audit and RAG audit be merged or kept as separate analysis layers?
