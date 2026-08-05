# Tasks: Optimización de Calidad y Rendimiento de Extracción RAG

## Phase 1: Snippet Window Expansion (Low Risk)
- [x] 1.1 Update `QuoteExtractionSchemaV2` description for `rawTextSnippet` to `50-300` characters in `server/src/services/gemini.ts`.
- [x] 1.2 Update `ComparisonPromptBuilder` instructions to allow 300-char context snippets for nested sub-limits in `server/src/services/unifiedComparison/comparisonPromptBuilder.ts`.
- [x] 1.3 Add unit tests verifying schema validation and prompt generation.

## Phase 2: Composite Deductible Parsing & Fallbacks (Low Risk)
- [x] 2.1 Update `DeductibleSchema` to parse UVT and SMMLV composite rules.
- [x] 2.2 Add defensive fallback in `server/src/services/hybridDeductibleParser.ts` returning raw string if structural parsing fails.
- [x] 2.3 Add unit tests covering composite deductibles ("10% PERD MIN 2 SMMLV").

## Phase 3: Graph Canonicalization & Fallback (Medium Risk)
- [x] 3.1 Verify confidence threshold logic in `server/src/services/coverageNormalizer.ts`.
- [x] 3.2 Add fallback to static `thesaurusMapper` when graph confidence is < 0.7.
- [x] 3.3 Add regression tests for ontology normalization.

## Phase 4: Gemini Context Caching Integration (Medium Risk)
- [x] 4.1 Add `enableGeminiContextCaching` feature flag in `server/src/config/featureFlags.ts`.
- [x] 4.2 Implement `getOrCreateGeminiContextCache()` in `server/src/services/gemini.ts`.
- [x] 4.3 Add defensive try/catch fallback to standard `generateContent`.
- [x] 4.4 Run full extraction quality evaluation harness (`extractionQualityEval.ts`).
