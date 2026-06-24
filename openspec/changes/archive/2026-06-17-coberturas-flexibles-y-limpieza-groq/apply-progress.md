# Progress: Coberturas Flexibles y Limpieza Groq

This file tracks progress during the implementation of the flexible coverages and Groq cleanup changes.

## Phase 1: Foundation / Dependency cleanup / Configs
- [x] Remove `groq` and `groq-sdk` dependencies in `package.json` and run `npm install`.

## Phase 2: Core Backend: Normalizer, Ontology, Learning Engine
- [x] In `server/src/services/coverageNormalizer.ts`, implement controlled concurrency pool (max 5) in `buildOntologyBasedCoverages`.
- [x] In `server/src/services/semanticMatcher.ts`, modify `matchProbabilistic` to align category ID formats and remove default `0` fallback.
- [x] In `server/src/services/coverageOntology.ts`, define strict JSON schemas and pass them as `responseSchema` to Gemini.
- [x] In `server/src/services/learningEngine.ts`, update `getSimilarCorrections` to retrieve pre-calculated DB embeddings and compute cosine similarity in-memory.
- [x] In `server/src/services/learningEngine.ts`, implement a local Sørensen-Dice string similarity fallback when embeddings are not found.
- [x] In `server/src/services/learningEngine.ts`, ensure `saveCorrection` generates and stores the embedding for new corrections in the DB.

## Phase 3: Frontend Matrix: Dynamic loading, grouping
- [x] In `components/UnifiedCoverageMatrix.tsx`, load categories dynamically from `taxonomy.json`.
- [x] In `components/UnifiedCoverageMatrix.tsx`, implement semantic exclusive grouping with a `0.70` similarity threshold.

## Phase 4: Testing: Backend tests, frontend tests
- [x] In `server/src/services/__tests__/coverageNormalizer.test.ts`, write unit tests verifying Promise pool concurrency limit of 5.
- [x] In `server/src/services/__tests__/semanticMatcher.test.ts`, write unit tests verifying ID alignment and preventing `0` fallback.
- [x] Create `server/src/services/__tests__/learningEngine.test.ts` (or add to `learningEngine.graph.test.ts`) to test DB embedding retrieval and local Sørensen-Dice fallback.
- [x] In `src/components/__tests__/UnifiedCoverageMatrix.test.ts`, verify dynamic category rendering and semantic grouping with a mock taxonomy.

## Phase 5: Cleanup / Verification
- [x] Run backend typecheck (`npm run typecheck:backend`) and code linting (`npm run lint`).
- [x] Run all test suites via `npm run test` and check system sanity with `npm run test:smoke`.
