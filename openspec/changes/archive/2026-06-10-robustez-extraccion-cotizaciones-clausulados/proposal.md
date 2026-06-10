# Proposal: Robust Extraction for Quoted Clauses

## Intent

Insurance quote extraction suffers from hallucination-prone LLM outputs, brittle insurer-name-based format detection, and no systematic validation of extracted values against source clauses. This change hardens the extraction pipeline with structured validation, deterministic parsing, and quote-to-clause reconciliation.

## Scope

### In Scope
- Add Zod runtime validation to all LLM extraction outputs with currency normalization
- Replace insurer-name string matching with layout/feature-based format detection (align implementation with existing specs)
- Build hybrid deductible parser: regex + benchmark tables first, LLM fallback, with Redis caching
- Create quote-clause reconciliation service comparing deductibles and values
- Harden CI: remove continue-on-error, enforce 70% coverage, add Supabase schema diff, ESLint + Prettier

### Out of Scope
- Multi-insurer clause RAG improvements (semantic search, reranking)
- LLM provider fallback (Groq as backup to Gemini)
- Coverage ontology human-review queue
- Batch embedding optimization
- Environment secret rotation (.env cleanup deferred)

## Capabilities

### New Capabilities
- `zod-extraction-validation`: Runtime Zod schema validation for LLM outputs with currency/SMMLV/UVT normalization
- `quote-clause-reconciliation`: Deep comparison of quote vs clause deductible structures and values, flagging discrepancies for broker review
- `strict-ci-pipeline`: CI requirements for lint, 70% coverage, and Supabase schema diff with no continue-on-error

### Modified Capabilities
- `deductible-semantic-parser`: Add requirement for regex+benchmark-first parsing with LLM fallback and Redis caching
- `code-quality-standards`: Add CI pipeline strictness requirements

## Approach

Layer Zod schemas on top of existing Gemini `responseSchema` outputs. Implement deterministic deductible parsing with regex patterns and benchmark lookup tables before falling back to LLM. Cache parsed deductible results in Redis. Build reconciliation service using existing clause RAG indexing and semantic coverage matching. Align CI with Husky pre-commit + GitHub Actions strict mode.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/quoteExtraction/` | Modified | Add Zod validation and normalization |
| `server/src/services/deductibleParser.ts` | Modified | Hybrid regex → benchmark → LLM strategy |
| `server/src/services/quoteClauseReconciler.ts` | New | Reconciliation logic |
| `.github/workflows/` | Modified | Remove continue-on-error, add lint/coverage/diff |
| `server/src/utils/formatDetector.ts` | Modified | Remove insurer name matching |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| Regex patterns miss edge-case deductible formats | Med | Maintain LLM fallback with clear fallback telemetry |
| Zod schemas reject valid but unusual LLM outputs | Low | Start with permissive schemas, tighten incrementally |
| CI strictness blocks urgent hotfixes | Low | Allow admin override via labeled PRs |

## Rollback Plan

All changes are additive or behind existing feature flags. Revert individual PRs. Redis cache keys use version prefix for invalidation. If Zod validation causes regressions, disable via `SKIP_ZOD_VALIDATION` env var.

## Dependencies

- Existing `clause-rag-indexing` and `semantic-coverage-matching` specs
- Redis instance for deductible cache

## Success Criteria

- [ ] All extraction endpoints validate outputs with Zod before persisting
- [ ] Format detection uses zero insurer-name string matching
- [ ] Deductible parser hits regex+benchmark path for >80% of inputs
- [ ] Quote-clause reconciliation flags discrepancies in the UI
- [ ] CI fails on TypeScript errors, coverage <70%, or schema drift
