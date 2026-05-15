## Why

The RAG system is producing hallucinated coverage values (e.g., BBVA $119.6M, AXA $10M for Incendio not present in PDFs), all quotes score artificially below 50/100 due to aggressive RAG-dependent penalties, and the clause_chunks table is empty despite uploaded documents. These issues critically undermine the broker's trust in the comparison tool and require immediate correction to restore analytical reliability.

## What Changes

- **Fix clause indexing pipeline**: Debug and repair why clausulados uploaded via ClauseLibrary UI are not being chunked into `clause_chunks` table (currently 0 rows despite 9 documents in `documents` table)
- **Implement reranking in RAG retrieval**: Add cross-encoder reranking (bge-reranker-v2-m3 or Cohere) to improve chunk relevance by 40-60%, reducing hallucinations
- **Eliminate cross-insurer fallback**: Remove automatic fallback to other insurers' clauses when no chunks found; explicitly report "Sin cláusulas disponibles" to prevent cross-contamination
- **Add value validation layer**: Compare extracted coverage values against raw PDF text; flag values as 'calculated' vs 'extracted' when not found literally in source
- **Fix quote scoring without RAG**: Adjust scoring algorithm to not penalize aggressively when clause documents are unavailable; separate "data quality score" from "verification confidence"
- **Extract sublimits and caps**: Detect patterns like "tope por evento", "máximo por ítem", "límite agregado" during extraction and display in coverage matrix
- **Fix uncategorized coverage matrix N×M bug**: Reimplement matrix view to show all insurers as columns, not just one column per row
- **Enrich audit with business context**: Add negotiation opportunities, competitive advantages per insurer, and profile-based recommendations (e.g., restaurant → prioritize RC and Incendio)
- **Fix radar chart label overlap**: Reduce font size, truncate insurer names, add interactive tooltips
- **Fix premium chart**: Handle missing values (BBVA), add IVA toggle (before/after 19%)
- **Create DeductibleMatrix component**: Structured matrix showing 14 canonical coverages × N insurers with sum insured, deductible, and sublimit columns (migrated from `fix-rag-audit-deductible-matrix`)
- **Extract special conditions from quotes**: Parse raw text for patterns like "Condición especial:", "Nota:", "Excluye:", "Sujeto a:" and classify by impact level (migrated from `fix-rag-audit-deductible-matrix`)
- **Optimize semantic matching performance**: Batch embedding generation, fuzzy matching first, 24h cache to reduce analysis time from 170s to <60s (migrated from `fix-rag-audit-deductible-matrix`)
- **Fix charts in hidden tabs**: Resolve Recharts errors when containers have 0 dimensions using conditional rendering or ResizeObserver (migrated from `fix-rag-audit-deductible-matrix`)

> **Continuidad**: Este cambio absorbe y extiende el trabajo parcial de `fix-rag-audit-deductible-matrix` (commit 183bdfc). Las tareas pendientes de ese cambio han sido re-scopedadas aquí.

## Capabilities

### New Capabilities
- `rag-reranking`: Cross-encoder reranking layer for retrieved clause chunks to improve relevance and reduce hallucinations
- `value-validation`: Validation of extracted coverage values against raw source text with metadata tracking (extracted vs calculated vs inferred)
- `sublimit-extraction`: Detection and extraction of sublimits, caps, and aggregate limits from clause documents and quotes
- `special-conditions-extraction`: Extract special conditions and exclusions from quote PDF raw text with impact classification (CRITICAL/WARNING/INFO)
- `deductible-matrix`: Structured deductible comparison matrix across insurers with risk indicators and negotiation recommendations
- `audit-business-context`: Business context enrichment for audit section including negotiation points, competitive advantages, and client-profile-based recommendations

### Modified Capabilities
- `rag-retrieval`: Remove cross-insurer fallback behavior; add reranking integration; add score thresholds for minimum relevance
- `rule-based-scoring`: Adjust scoring weights and penalties when RAG data is unavailable; separate coverage quality score from verification confidence
- `unified-coverage-matrix`: Fix N×M matrix bug for uncategorized coverages; add sublimit indicators and value-source badges
- `rag-audit-enrichment`: Integrate business context analysis into audit alerts; add cross-insurer competitive analysis
- `deductible-risk-analysis`: Include cap/sublimit analysis in deductible risk calculation

## Impact

**Backend:**
- `server/src/services/ragRetrievalService.ts` - Add reranking, remove fallback
- `server/src/services/crossReferenceEngine.ts` - Add value validation, remove fallback dependency
- `server/src/services/quoteScorer.ts` - Adjust scoring algorithm
- `server/src/services/deductibleAnalyzer.ts` - Add sublimit/cap detection
- `server/src/services/quoteParser.ts` - Add special conditions extraction from raw text
- `server/src/services/semanticMatcher.ts` - Optimize with batch embeddings, fuzzy matching, caching
- `server/src/controllers/analysisController.ts` - Integrate new validation layer
- Supabase `clause_chunks` indexing pipeline - Debug and fix chunk generation

**Frontend:**
- `components/UnifiedCoverageMatrix.tsx` - Fix N×M matrix, add sublimit UI
- `components/InsurerRadar.tsx` - Fix label overlap
- `components/AuditSection.tsx` - Add business context section
- `components/DeductibleBadge.tsx` - Add cap/sublimit indicators
- `components/DeductibleMatrix.tsx` - New structured deductible comparison matrix (14 rows × N insurers)
- `components/PremiumChart.tsx` / chart components - Fix hidden tabs rendering issues

**Dependencies:**
- New: `@xenova/transformers` or `cohere-ai` for reranking
- Existing: Supabase vector search, Gemini API, current embedding service

**Breaking Changes:**
- **BREAKING**: `searchWithFallback` behavior removed - callers must handle empty results explicitly
- **BREAKING**: Quote scoring algorithm changes - scores will increase when RAG is unavailable (more realistic representation)
