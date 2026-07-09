# Proposal: Corregir Reporte Comparativo (V2 Engine Fixes)

## Intent

The unified comparison engine (V2) currently operates in an isolated path, bypassing core architectural systems (auth, thesaurus, normalization, scoring, audit) and hardcoding critical metrics. This proposal integrates the unified engine back into the main architecture to deliver authenticated, accurate, and complete comparison reports with real scoring and proper decimal premium parsing.

## Target Users & Business Outcome

- **Target Users**: Insurance brokers performing complex commercial policy comparisons.
- **Business Outcome**: Provide brokers with high-confidence, authenticated reports featuring accurate pricing, canonical coverage alignment, and actionable risk audits.

## Current-State Gap

The V2 path ignores auth middleware, hardcodes confidence and radar ratings to 85, fails to parse Colombian decimal premiums, bypasses the semantic ontology mapping, omits risk audits, and leaves the Client/Técnico toggle non-functional.

## Scope

### In Scope
- **PR 1 (Auth & Sync)**: Secure `/api/comparison/unified` with auth middleware and sync clients/companies under `user_id` to Supabase.
- **PR 2 (Premium Parsing)**: Implement decimal-aware parser to support local Colombian currencies (e.g., `$1.134.400,00`).
- **PR 3 (Ontology Integration)**: Map row labels through `thesaurusMapper` and `coverageNormalizer` for canonical grouping.
- **PR 4 (Scoring & Audit)**: Integrate dynamic `quoteScorer` and `quoteBasedAuditor` calls.
- **PR 5 (UI/UX Toggle)**: Populate `technicalAnalysis`, citations, and activate the Client/Técnico toggle.

### Out of Scope
- Complete redesign of the multimodal extraction pipeline.
- Modifying extraction rules for non-quote PDF files.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `unified-coverage-matrix`: Render real confidence score badges and format deductible texts.
- `unified-comparison-extraction`: Integrate currency parser and semantic normalizers into LLM output parser.
- `row-grouped-comparison-matrix`: Populate technical analysis and toggle data.
- `extraction-quality-evaluation`: Update test suite assertions to handle dynamic scoring rather than mock 85s.

## Approach

- **Strategy**: Feature Branch Chain with 5 small, reviewable PRs (<150 lines each).
- **Architecture**: Feed parsed LLM rows into existing backend domain services instead of bypassing them.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/routes/comparisonRoutes.ts` | Modified | Secure routes with `authMiddleware`. |
| `server/src/services/unifiedComparison/` | Modified | Integrate thesaurus, scoring, and audit services. |
| `components/UnifiedCoverageMatrix.tsx` | Modified | Format deductibles and bind Client/Tech toggle. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auth breaks guest flow | Low | Verify JWT optional handling fallback. |
| Parse failure on custom formats | Medium | Unit tests for various decimal formats. |

## Rollback Plan

Toggle feature flag `granularComparisonSchema` to `false` to instantly fallback to legacy V1.

## Dependencies

- Supabase table access and schema sync.

## Assumptions & Edge Cases

- **Assumptions**: Auth user has a valid Supabase `user_id`; Client/Tech toggle operates client-side.
- **Edge Cases**: Unmapped categories gracefully fall to `extraRows` with a "not_found" or manual review flag.

## Success Criteria

- [ ] 5 PRs merged cleanly under 400-line budget.
- [ ] No hardcoded confidence 85 values.
- [ ] Decimal premiums parse correctly.
- [ ] Client/Técnico toggle is functional.
