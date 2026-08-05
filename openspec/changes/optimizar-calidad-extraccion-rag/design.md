# Design Document: Optimización de Calidad y Rendimiento de Extracción RAG

## Architectural Overview

This design outlines the technical implementation for upgrading extraction accuracy, composite deductible parsing, Gemini Context Caching, and graph canonicalization across four risk-controlled phases.

## Component Strategy

### 1. Snippet Window Adjustment
- Modify `QuoteExtractionSchemaV2` description for `rawTextSnippet` from `50-150 chars` to `50-300 chars`.
- Update prompt instructions in `ComparisonPromptBuilder` to request full contextual snippets for clauses and sub-limits.

### 2. Composite Deductible Parsing & Defensiveness
- Enhance `DeductibleSchema` to capture UVT, SMMLV, and composite min/max rules.
- Wrap `hybridDeductibleParser.ts` in a defensive try/catch that preserves raw string `deductibleText` as fallback when parsing returns empty components.

### 3. Gemini Context Caching Helper
- Create `getOrCreateGeminiContextCache()` in `server/src/services/gemini.ts`.
- Check `featureFlags.enableGeminiContextCaching`.
- If document size > 32,000 tokens, invoke `ai.caches.create()` with a 1-hour TTL.
- Fallback gracefully to direct `ai.models.generateContent()` on any error or cache miss.

### 4. Semantic Graph Fallback Strategy
- In `server/src/services/coverageNormalizer.ts`, evaluate `matchConfidence`.
- If `useUnifiedGraphCanonicalization` is active and `matchConfidence < 0.7`, fall back to `thesaurusMapper.ts`.

## Risk & Rollback Plan

- **Feature Flags**: Controlled by `ENABLE_GEMINI_CONTEXT_CACHING` and `USE_UNIFIED_GRAPH_CANONICALIZATION`.
- **Zero-Downtime Rollback**: Disabling feature flags in environment configuration restores traditional baseline behavior instantly.
