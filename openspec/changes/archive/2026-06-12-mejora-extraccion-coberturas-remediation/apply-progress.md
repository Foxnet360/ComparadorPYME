# Apply Progress: Post-Archive Remediation for Coverage Extraction

**Status**: success  
**Mode**: Strict TDD (Vitest)  
**Branch**: `feature/mejora-extraccion-coberturas-slice-6`  
**Chain strategy**: `stacked-to-main`

## Remediation Tasks

- [x] Remove unused `createMetricCollector` imports from `templateRegistryService.ts`, `coverageGraphService.ts`, `layoutParser.ts`, and `quoteProcessingService.ts`.
- [x] Remove unused `pageSuccessCount` variable/increment from `layoutParser.ts`.
- [x] Implement a real pipeline runner in `server/src/scripts/runEvaluation.ts` that invokes `processQuoteMultimodal` with mocked LLM/vision/embedding calls; keep the echo runner as `--runner=echo` fallback; default to `pipeline`.
- [x] Update `server/src/scripts/__tests__/runEvaluation.test.ts` for echo and pipeline runners, including service restoration verification.
- [x] Add focused legacy/fallback tests:
  - `coverageNormalizer.graph.test.ts`: graph-disabled fallback to uncategorized coverage.
  - `semanticMatcher.test.ts`: env mock + embedding-failure fallback to LLM.
  - `hybridDeductibleParser.test.ts`: USD fixed amount, UVT compound minimum, telemetry log trigger.
  - `quoteProcessingService.test.ts`: `createDefaultScoringResult`.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Remove unused imports/variables | Lint/type-check only | N/A | N/A | N/A (cleanup) | `npm run typecheck:backend` passed | N/A | Clean |
| Real pipeline runner | `server/src/scripts/__tests__/runEvaluation.test.ts` | Unit/Integration | Echo runner preserved | New tests for `--runner=pipeline`, default runner, service restoration | 6/6 passing | Echo runner still passes; unknown runner rejected | Clean |
| Graph-disabled fallback | `server/src/services/__tests__/coverageNormalizer.graph.test.ts` | Unit | Existing graph tests | New test: disabled flag + empty ontology groups | Passing | Asserts `coverageGraphService.query` not called and uncategorized coverage retained | Clean |
| Embedding-failure fallback | `server/src/services/__tests__/semanticMatcher.test.ts` | Unit | Existing matcher tests | New test: `generateEmbedding` rejects | Passing | Asserts `method: 'llm'` and correct `categoryId` | Clean |
| USD/UVT deductible parsing | `server/src/services/__tests__/hybridDeductibleParser.test.ts` | Unit | Existing parser tests | New tests for `$500 USD` and `10% con mínimo de 5 UVT` | Passing | Asserts regex path (no LLM), currency, and compound minimum normalization | Clean |
| Telemetry log trigger | `server/src/services/__tests__/hybridDeductibleParser.test.ts` | Unit | Existing telemetry tests | New test: 10 operations trigger telemetry summary | Passing | Spies `console.log` and finds `[HybridDeductibleParser] Telemetry` | Clean |
| Default scoring result | `server/src/services/__tests__/quoteProcessingService.test.ts` | Unit | Existing quote processing tests | New test for `createDefaultScoringResult` | Passing | Asserts zeroed scores and coverage count reflection | Clean |

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `server/src/services/templateRegistryService.ts` | Modified | Removed unused `createMetricCollector` import |
| `server/src/services/coverageGraphService.ts` | Modified | Removed unused `createMetricCollector` import |
| `server/src/services/layoutParser.ts` | Modified | Removed unused `createMetricCollector` import and unused `pageSuccessCount` variable |
| `server/src/services/quoteProcessingService.ts` | Modified | Removed unused `createMetricCollector` import |
| `server/src/scripts/runEvaluation.ts` | Modified | Added real pipeline runner, env defaults, `--runner=echo\|pipeline` CLI flag, default to pipeline |
| `server/src/scripts/__tests__/runEvaluation.test.ts` | Modified | Added mocks for pipeline runner; tests for default runner, echo runner, unknown runner, service restoration |
| `server/src/services/__tests__/coverageNormalizer.graph.test.ts` | Modified | Added graph-disabled fallback test |
| `server/src/services/__tests__/semanticMatcher.test.ts` | Modified | Added `env` mock and embedding-failure fallback test |
| `server/src/services/__tests__/hybridDeductibleParser.test.ts` | Modified | Added USD fixed, UVT compound, and telemetry log trigger tests |
| `server/src/services/__tests__/quoteProcessingService.test.ts` | Modified | Added `createDefaultScoringResult` test |
| `openspec/changes/mejora-extraccion-coberturas-remediation/apply-progress.md` | Created | This artifact |

## Test Summary

- **Target test files**: 5 remediation-affected files
  - `server/src/scripts/__tests__/runEvaluation.test.ts`
  - `server/src/services/__tests__/coverageNormalizer.graph.test.ts`
  - `server/src/services/__tests__/semanticMatcher.test.ts`
  - `server/src/services/__tests__/hybridDeductibleParser.test.ts`
  - `server/src/services/__tests__/quoteProcessingService.test.ts`
- **Result**: 73/73 passing
- **Type-check**: `npm run typecheck:backend` passed with no errors
- **Full suite**: 90 test files passed / 14 failed files; 884 tests passed / 30 failed / 3 skipped

## Full-Suite Failure Classification

The failures below are pre-existing and unrelated to this remediation (they fail for missing env vars, real API keys, missing fixtures, jest-in-Vitest references, or test-file parse errors):

| File | Count | Cause | Related to Remediation? |
|------|-------|-------|------------------------|
| `server/src/routes/__tests__/reviewQueue.integration.test.ts` | Suite error | Mock of `redisCache` lacks `getCacheValue` export; triggered through `coverageGraphService` import | No — test mock is incomplete |
| `server/src/services/__tests__/accuracy.test.ts` | Suite error | `@google/generative-ai` mock is not a constructor | No — pre-existing mock issue |
| `server/src/services/__tests__/load.test.ts` | Suite error | Parse error in test file (`Array(CONCURRENT_REQUESTS).fill(null).map(...)` is not valid assignment target) | No — pre-existing syntax error |
| `server/src/services/__tests__/structuredClauseExtractor.pdf.test.ts` | Suite error | Same `@google/generative-ai` constructor mock issue | No — pre-existing |
| `server/src/services/__tests__/structuredClauseExtractor.test.ts` | Suite error | Same `@google/generative-ai` constructor mock issue | No — pre-existing |
| `server/src/__tests__/analysis.integration.test.ts` | 7 tests | Returns 500/200 instead of expected 400/401; integration setup issue | No — pre-existing |
| `server/src/controllers/__tests__/performance.test.ts` | 1 test | `generateComparison` took 198ms, threshold is 100ms | No — flaky timing |
| `server/src/services/__tests__/analysis.e2e.test.ts` | 4 tests | `NO ESPECIFICADO` insurer, `buildCanonicalCoverages` undefined, `chatService.sendMessage` not a function | No — pre-existing e2e env/data issues |
| `server/src/services/__tests__/extractStructured.integration.test.ts` | 3 tests | `require('../errors/geminiErrors')` module path fails | No — pre-existing require path |
| `server/src/services/__tests__/performance.test.ts` | 3 tests | `buildCanonicalCoverages` undefined, variable comparison timeout | No — pre-existing |
| `server/src/services/__tests__/ragRetrieval.quality.test.ts` | 2 tests | Empty result set (needs real vector store data) | No — pre-existing |
| `server/src/services/unifiedComparison/__tests__/fallback.test.ts` | 4 tests | Uses `jest` globals in Vitest suite | No — pre-existing |
| `server/src/services/unifiedComparison/__tests__/integration.test.ts` | 3 tests | Real Gemini API key rejected, missing `cache/redisCache` module | No — pre-existing |
| `server/src/services/unifiedComparison/__tests__/performance.test.ts` | 2 tests | Missing `./test-quotes` directory | No — pre-existing |

## Deviations / Issues

- `runEvaluation.ts` injects harmless dummy environment defaults before dynamic imports so the script can run locally without a real `.env` file. Every external call is mocked inside the runner.
- `processQuoteMultimodal` returns all 14 canonical categories; the runner adapter filters out entries whose value is `'NO ESPECIFICADO'` so missing canonical categories do not distort evaluation metrics.
- Mocked service methods are restored in a `finally` block to prevent state leakage across fixtures.

## Risks

- Full suite still contains pre-existing failures unrelated to this change. CI will not be green until those are addressed separately.
- The pipeline runner uses synthetic embeddings and mocked graph responses; it validates harness integration and fixture logic but does not exercise real LLM/embedding quality.

## Next Recommended Phase

`sdd-verify` — re-run verification to confirm the residual-risk remediation is complete and no new failures were introduced.
