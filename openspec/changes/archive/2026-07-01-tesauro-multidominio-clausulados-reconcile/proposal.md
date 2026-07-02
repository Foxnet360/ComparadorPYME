# Proposal: Tesauro Multidominio + Clausulados Reconcile

## Intent

The quote-vs-clause reconciliation pipeline is broken in production: `structured_clauses` is never populated from uploaded documents, and insurer name mismatches cause `MISSING_CLAUSE` errors. This change fixes those critical gaps and introduces domain-scoped taxonomy bundles so the system can evolve beyond the hardcoded PYME insurance line.

## Scope

### In Scope
- **P0 — Reconciliation fix**: Wire `DocumentIndexingService` to auto-extract structured clauses after chunking and persist to `structured_clauses`.
- **P0 — Insurer name normalization**: Apply `insurerNameNormalizer` in `ReconciliationService` before `searchClause()`.
- **P1 — Domain taxonomy bundles**: Extract hardcoded category lists, ontology seed, thesaurus JSON, and markdown files into per-domain bundles (`data/domains/pyme/`, `data/domains/vivienda/`, `data/domains/auto/`).
- **P1 — Human review queue**: Expose `coverage_mappings.needs_human_review = true` via a dedicated API endpoint/view for operations staff.

### Out of Scope
- Full dynamic DB-driven taxonomy (admin UI, live editing, migration of JSON/markdown data).
- Vivienda/Auto taxonomy content creation (only bundle structure + PYME migration).
- Frontend UI for the review queue (backend API only).
- LLM prompt versioning per domain (deferred to P2).

## Capabilities

### New Capabilities
- `domain-configurable-taxonomy`: Per-domain bundle loading for thesaurus, ontology, and canonical categories.

### Modified Capabilities
- `quote-clause-reconciliation`: Add insurer name normalization; enable clause lookup from auto-populated `structured_clauses`.
- `structured-clause-extraction`: Trigger extraction automatically on document upload.
- `coverage-post-normalization`: Thread `domain` parameter through mapping pipeline; expose unmapped-coverage review endpoint.

## Approach

**Phase 1 (immediate)**: Hook `structuredClauseExtractor.extractFromText()` into `DocumentIndexingService.indexDocument()` after chunking completes. Wrap in a feature flag (`AUTO_EXTRACT_STRUCTURED_CLAUSES`). Normalize insurer names in `ReconciliationService` using the existing `insurerNameNormalizer` mapping.

**Phase 2 (strategic)**: Move `CANONICAL_CATEGORIES`, `ONTOLOGY_SEED`, `thesaurus.json`, and markdown thesaurus files into `data/domains/{domain}/` bundles with a shared JSON schema. Thread a `domain` parameter through `quoteProcessingService`, `coverageNormalizer`, `semanticMatcher`, `coverageOntology`, and `thesaurusService`. Add `domain` columns to `coverage_mappings` and `structured_clauses`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/documentIndexingService.ts` | Modified | Calls `structuredClauseExtractor.extractFromText()` after upload |
| `server/src/services/reconciliationService.ts` | Modified | Normalizes insurer names before clause search |
| `server/src/services/structuredClauseExtractor.ts` | Modified | Made callable from upload pipeline |
| `server/src/services/thesaurusService.ts` | Modified | Accepts `domain` parameter, loads per-domain bundle |
| `server/src/services/coverageOntology.ts` | Modified | Accepts `domain` parameter |
| `server/src/services/semanticMatcher.ts` | Modified | Accepts `domain` parameter |
| `server/src/services/coverageNormalizer.ts` | Modified | Accepts `domain` parameter |
| `server/src/services/quoteProcessingService.ts` | Modified | Prompts parameterized by `domain` |
| `server/src/config/featureFlags.ts` | Modified | Add `AUTO_EXTRACT_STRUCTURED_CLAUSES` flag |
| `data/domains/` | New | Per-domain taxonomy bundles |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auto-extraction slows large PDF uploads | Medium | Async background job + feature flag to disable |
| Insurer normalizer false positives | Low | Hardcoded mapping is conservative; add telemetry |
| Domain parameter threading breaks existing PYME flows | Medium | Default to `"pyme"` when domain omitted; full regression test |
| LLM prompts still reference 14 PYME categories | High | Scope only bundle structure; prompt rewrite is P2 |

## Rollback Plan

1. Disable `AUTO_EXTRACT_STRUCTURED_CLAUSES` feature flag — stops auto-extraction without data loss.
2. Revert `ReconciliationService` insurer normalization — reverts to raw name matching.
3. Revert domain parameter changes — default `"pyme"` fallback keeps existing behavior.

## Dependencies

- `structured-clause-extraction` spec already defines extraction and storage requirements.
- `clause-storage` spec already defines `documents` + `chunks` table structure.

## Success Criteria

- [ ] Uploading a clause PDF populates `structured_clauses` within 30 seconds.
- [ ] `ReconciliationService` finds clauses for all 6 mapped insurers.
- [ ] `coverage_mappings` with `needs_human_review = true` are queryable via API.
- [ ] `domain="pyme"` produces identical results to current hardcoded behavior.
- [ ] All changes pass existing Vitest suite + new unit tests.
