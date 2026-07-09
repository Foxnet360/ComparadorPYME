# Tasks: Corregir Reporte Comparativo

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

## Review Workload Forecast

| PR | Goal | Est. Lines | Risk |
|---|---|---|---|
| PR 1 | Auth & client/company sync with RLS security | 120 | Low |
| PR 2 | Colombian premium decimal parser & utility | 60 | Low |
| PR 3 | Semantic ontology thesaurus mapping | 90 | Low |
| PR 4 | Dynamic quote scoring & auditor logic | 80 | Low |
| PR 5 | UI/UX viewMode toggle & deductible lists | 110 | Low |

- **Total Estimate**: ~460 lines
- **Chain Strategy Justification**: `feature-branch-chain` (or stacked-to-branch) is recommended to isolate V2 engine integrations inside a feature tracker branch before merging the whole tested package to `main`, maintaining clean individual PR reviews (<150 lines each).

## Phase 1: Auth, Security & Sync (PR 1)
- [x] 1.1 Secure `/api/comparison/unified` using `optionalAuthMiddleware`.
  - **Files**: `server/src/routes/comparisonRoutes.ts`
  - **Done**: Route decodes optional JWT. (~25 lines)
- [x] 1.2 Enable RLS on `client_profiles` and matching tables, adding policies for `user_id = auth.uid()::text`.
  - **Files**: `supabase/migrations/20260709_enable_rls.sql`
  - **Done**: RLS is enabled and active in dev DB. (~40 lines)
- [x] 1.3 Sync comparison companies and client profiles to the database when `req.user.id` is present.
  - **Files**: `server/src/controllers/analysisController.ts`
  - **Done**: Extraction triggers DB inserts for user. (~55 lines)

## Phase 2: Premium Decimal Parsing (PR 2)
- [x] 2.1 Write es-CO decimal-aware helper `parseColombianCurrency` to process local currency strings.
  - **Files**: `server/src/utils/currencyParser.ts`
  - **Done**: `$1.134.400,00` correctly parsed to `1134400.00`. (~30 lines)
- [x] 2.2 Wire parser inside the `matrixRowsToComparisonReport` V2 premium extraction pipeline.
  - **Files**: `server/src/controllers/analysisController.ts`
  - **Done**: Numeric premiums output without truncation. (~30 lines)

## Phase 3: Semantic Ontology Integration (PR 3)
- [ ] 3.1 Pipe parsed unified engine rows through `coverageNormalizer` and `thesaurusMapper`.
  - **Files**: `server/src/controllers/analysisController.ts`
  - **Done**: Raw cells map to valid `categoryId` and `canonicalName`. (~45 lines)
- [ ] 3.2 Display canonical coverage rows in top matrix and group unmapped rows under "unmapped".
  - **Files**: `components/UnifiedCoverageMatrix.tsx`
  - **Done**: Top matrix shows mapped, bottom shows extra rows. (~45 lines)

## Phase 4: Dynamic Scoring & Risk Audit (PR 4)
- [ ] 4.1 Convert parsed matrix rows to backend `ParsedQuote[]` format inside controller.
  - **Files**: `server/src/controllers/analysisController.ts`
  - **Done**: Matrix cells match standard quote structures. (~30 lines)
- [ ] 4.2 Invoke `quoteScorer` and `quoteBasedAuditor` to calculate dynamic scores and audits.
  - **Files**: `server/src/controllers/analysisController.ts`
  - **Done**: Overall ratings and risk audit replace static 85s. (~50 lines)

## Phase 5: UI/UX & Toggle (PR 5)
- [ ] 5.1 Parse semicolon-delimited deductibles and format them as clean stacked list items.
  - **Files**: `components/DeductibleBadge.tsx`, `components/UnifiedCoverageMatrix.tsx`
  - **Done**: Semi-colon cell content renders as list badges. (~45 lines)
- [ ] 5.2 Bind client/técnico viewMode toggle to hide confidence scores and technical citations for clients.
  - **Files**: `components/UnifiedCoverageMatrix.tsx`
  - **Done**: Visual elements toggle smoothly on click. (~65 lines)
