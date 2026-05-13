## Context

The Comparador CSA system uses RAG (Retrieval-Augmented Generation) to cross-reference insurance quotes against clause documents. However, production logs reveal critical failures:

- **clause_chunks table is empty** (0 rows) despite 9 documents uploaded to `documents` table
- **Hallucinated values** appear in the coverage matrix (e.g., BBVA $119.6M, AXA $10M for Incendio not present in PDFs)
- **All quotes score <50/100** because scoring heavily penalizes absence of RAG data
- **Cross-insurer fallback** contaminates analysis by using other insurers' clauses
- **N×M matrix bug** in uncategorized coverages shows only one column instead of all insurers
- **Sublimits not extracted** despite being critical for risk assessment
- **Radar chart labels overlap** with multiple insurers
- **Audit lacks business context** (negotiation points, competitive advantages)

Current RAG pipeline: `embedding query → hybrid search (vector + full-text) → return top 5 chunks → LLM cross-reference`

## Goals / Non-Goals

**Goals:**
- Restore RAG reliability by fixing clause indexing and adding reranking
- Eliminate hallucinated coverage values through validation against source text
- Make scoring reflect actual quote quality regardless of RAG availability
- Extract and visualize sublimits/caps from documents
- Fix all reported UI bugs (matrix, radar, premium chart)
- Enrich audit with business-relevant insights (negotiation, competition)

**Non-Goals:**
- Rebuilding the entire clause upload UI (focus on backend indexing)
- Implementing GraphRAG or Self-RAG (out of scope for this change)
- Changing the 14 canonical coverage categories
- Adding new insurer profiles or format detection

## Decisions

### Decision 1: Use lightweight reranking instead of full cross-encoder
**Choice**: Implement score-based filtering + metadata boosting instead of external cross-encoder model
**Rationale**: Adding `@xenova/transformers` or `cohere-ai` increases bundle size and adds API dependency. Current Supabase RPC already returns similarity scores. We can:
- Increase initial retrieval from 5 to 15 chunks
- Filter by minimum similarity threshold (0.7)
- Boost chunks matching exact coverage tags
- Return top 5 after filtering

**Alternative**: Cohere rerank API (better quality but adds latency + cost)

### Decision 2: Separate "Data Quality Score" from "Verification Confidence"
**Choice**: Calculate two distinct metrics
**Rationale**: Current system conflates "how good is this quote" with "how well can we verify it". This causes all scores to be <50 when RAG fails. Solution:
- **Data Quality Score** (0-100): Based on coverage completeness, price competitiveness, deductible levels (always calculable)
- **Verification Confidence** (0-100): Based on RAG availability, cross-reference success, clause validation

### Decision 3: Remove cross-insurer fallback entirely
**Choice**: Delete `searchWithFallback` auto-fallback behavior
**Rationale**: Using another insurer's clauses to validate a quote is misleading. Better to be explicit about missing data than to provide false confidence. The fallback has caused hallucinations by feeding irrelevant clause content to the LLM.

**Migration**: Replace with explicit `isRagAvailable` flag per insurer. UI shows "Sin cláusulas para verificar" instead of generic references.

### Decision 4: Value validation via raw text search
**Choice**: After Gemini extracts a value, search the raw PDF text for that value string
**Rationale**: If "$10.000.000" is extracted but doesn't appear in the raw text, it's likely hallucinated. We can:
- Store raw extracted text alongside parsed data
- Before accepting a value, check if it (or a normalized variant) exists in rawText
- Mark values as `source: 'extracted' | 'calculated' | 'inferred'`

### Decision 5: Sublimit extraction via regex patterns instead of LLM
**Choice**: Use deterministic pattern matching for sublimits
**Rationale**: Sublimits follow predictable patterns ("tope por evento", "máximo por ítem", "límite agregado"). Regex is faster and more reliable than LLM for this structured data. LLM can be fallback for ambiguous cases.

### Decision 6: DeductibleMatrix as separate tab vs inline in coverage matrix
**Choice**: Create separate `DeductibleMatrix` component in dedicated "Deducibles" tab
**Rationale**: The coverage matrix already shows deductibles as badges, but a dedicated matrix provides:
- Side-by-side comparison of all 14 coverages × N insurers
- Integration with sublimit data and effective deductible calculation
- Space for negotiation recommendations and summary panels
**Alternative**: Add columns to existing matrix - rejected because it would make the table too wide and complex

### Decision 7: Special conditions extraction via regex with LLM fallback
**Choice**: Use regex patterns for common markers ("Condición especial:", "Excluye:", etc.) with LLM fallback
**Rationale**: Similar to sublimits, special conditions have predictable markers. Regex is fast and works on raw text. LLM fallback handles edge cases where markers are implicit.
**Integration**: Results feed into both audit section and value validation layer

### Decision 8: Batch embedding generation + fuzzy matching for semantic performance
**Choice**: Implement batch embedding generation and fuzzy matching as first pass
**Rationale**: Current semantic matcher calls LLM for each coverage individually (15-25s each). Optimizations:
- Generate embeddings in batch (1 API call for N coverages)
- Use fuzzy string matching first (fuse.js or similar) - skip LLM if confidence > 0.8
- Cache embeddings for 24h to avoid regeneration
**Target**: Reduce analysis time from 170s to <60s for 2 quotes

## Risks / Trade-offs

- **[Risk] Removing fallback reduces coverage** → When no clauses exist, analysis has less data. **Mitigation**: Improve quote-only analysis (auditQuote) to compensate; clearly communicate limitation to users.
- **[Risk] Score increase without RAG may seem like grade inflation** → Brokers might think quotes improved when actually just scoring changed. **Mitigation**: Show both scores (quality + verification) separately in UI.
- **[Risk] Value validation may flag legitimate calculated values** → Some values require calculation (e.g., "10% de $500M"). **Mitigation**: Allow calculated values but mark them explicitly; don't reject them.
- **[Risk] Fixing clause indexing may require manual intervention** → If chunking pipeline has bug, may need to re-upload all clausulados. **Mitigation**: Build diagnostic endpoint first to identify root cause.

## Migration Plan

1. **Phase 1** (Backend): Fix scoring algorithm, remove fallback, add value validation
2. **Phase 2** (Backend): Debug clause indexing, add reranking, optimize semantic matching
3. **Phase 3** (Backend): Add sublimit extraction, special conditions extraction
4. **Phase 4** (Frontend): Fix matrix N×M, radar labels, premium chart, charts in hidden tabs
5. **Phase 5** (Frontend): Add audit business context, sublimit UI, DeductibleMatrix component

**Rollback**: All changes are additive or behind feature flags. Scoring changes can be reverted by restoring old weights.

## Open Questions

1. What is the root cause of empty `clause_chunks`? Is it chunking failure, embedding failure, or Supabase write failure?
2. Should we add a "Recalcular Score" button for historical analyses after scoring changes?
3. Do we need user-configurable scoring weights, or are defaults sufficient?
4. How should the DeductibleMatrix component handle cases where sublimit data is missing but deductible-risk-analysis suggests a cap should exist?
5. Should special conditions from quotes be merged with conditions extracted from clause documents, or kept separate?
6. What is the memory impact of batch embedding generation for large quote sets (10+ coverages)?
