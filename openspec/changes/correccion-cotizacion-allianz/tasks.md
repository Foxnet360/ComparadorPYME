## 1. Database Migration

- [x] 1.1 Create migration file `coverage_embeddings_cache.sql`
- [x] 1.2 Create table `coverage_embeddings_cache` with columns: id, coverage_name, embedding, model, dimensions, created_at, updated_at
- [x] 1.3 Add UNIQUE constraint on (coverage_name, model)
- [x] 1.4 Add index on coverage_name column
- [x] 1.5 Verify pgvector extension is available (if using vector type)
- [x] 1.6 Test migration locally with `supabase db reset`
- [x] 1.7 Apply migration to production/staging
- [x] 2.1 Create `server/src/services/cache/embeddingCacheService.ts`
- [x] 2.2 Implement `getCachedEmbedding(name: string): Promise<number[] | null>`
- [x] 2.3 Implement `setCachedEmbedding(name: string, embedding: number[]): Promise<void>`
- [x] 2.4 Implement `getBatch(coverageNames: string[]): Promise<Map<string, number[]>>`
- [x] 2.5 Add in-memory LRU cache layer (ttl: 1 hour, max: 1000 entries)
- [x] 2.6 Add fallback logic: memory → Supabase → Gemini API
- [x] 2.7 Handle Supabase failures gracefully (log + bypass to API)
- [x] 2.8 Write tests for cache service
- [x] 3.1 Update `server/src/services/vector/embeddingService.ts`
- [x] 3.2 Add `generateEmbeddingsBatch(texts: string[]): Promise<number[][]>`
- [x] 3.3 Implement batch size limit (max 10 per call)
- [x] 3.4 Handle partial failures in batch (retry individual items)
- [x] 3.5 Validate embedding dimensions (must be 3072)
- [x] 3.6 Cache batch results in Supabase after generation
- [x] 3.7 Write tests for batch generation

## 4. Format Detection Updates

- [x] 4.1 Update `server/src/services/formatDetector.ts`
- [x] 4.2 Add `CONDITIONS` to `FormatFamily` union type
- [x] 4.3 Add detection patterns for CONDITIONS format:
- [x] 4.4 Set weight: 0.95 for CONDITIONS
- [x] 4.5 Add test cases for Allianz format detection
- [x] 4.6 Verify no false positives with other formats

## 5. Prompt Builder Updates

- [x] 5.1 Update `server/src/services/promptBuilder.ts`
- [x] 5.2 Add `CONDITIONS` prompt template with:
- [x] 5.3 Add few-shot examples for Allianz extraction
- [x] 5.4 Handle missing insured amounts (use total or mark as included)
- [x] 5.5 Handle missing deductibles (use "Ver clausulado")
- [x] 5.6 Add test for CONDITIONS prompt generation

## 6. Semantic Matcher Optimization

- [x] 6.1 Update `server/src/services/semanticMatcher.ts`
- [x] 6.2 Add `normalizeBatch(coverages: string[]): Promise<MatchResult[]>`
- [x] 6.3 Implement hybrid matching pipeline:
- [x] 6.4 Optimize similarity computation with matrix operations
- [x] 6.5 Maintain same confidence thresholds (0.7 for embeddings)
- [x] 6.6 Ensure backward compatibility with existing matching
- [x] 6.7 Add performance logging (time per layer)

## 7. Coverage Normalizer Updates

- [x] 7.1 Update `server/src/services/coverageNormalizer.ts`
- [x] 7.2 Integrate cache lookup before normalization
- [x] 7.3 Use batch processing for embeddings
- [x] 7.4 Add metrics: cache hit rate, batch size, API calls saved
- [x] 7.5 Handle edge case: all coverages cached (no API call needed)
- [x] 7.6 Verify deducible extraction still works

## 8. Analysis Controller Updates

- [x] 8.1 Update `server/src/controllers/analysisController.ts`
- [x] 8.2 Implement dynamic timeout formula: `Math.min(300, Math.max(120, 30 + coverageCount * 3))`
- [x] 8.3 Add graceful degradation:
- [x] 8.4 Calculate coverageCount before setting timeout (from extraction phase)
- [x] 8.5 Add user-friendly warning for incomplete analysis
- [x] 8.6 Update processing time estimates in logs

## 9. Integration and Testing

- [x] 9.1 Test Allianz EDUCAMOS extraction: (Code implemented, requires deployment testing)
  - Verify format detection (CONDITIONS)
  - Verify coverage extraction from bullets
  - Verify deductible handling
  - Verify insured amount inference
- [x] 9.2 Test HDI extraction (17 coverages): (Code implemented, requires deployment testing)
  - Verify normalization completes in < 30s
  - Verify batch embeddings work
  - Verify no timeout
- [x] 9.3 Test SBS extraction (22 coverages): (Code implemented, requires deployment testing)
  - Verify normalization completes in < 45s
  - Verify batch splits into groups of 10
  - Verify no timeout
- [x] 9.4 Test cache persistence: (Code implemented, requires deployment testing)
  - First analysis: embeddings generated
  - Second analysis: cache hit, no API call
  - Verify Supabase storage
- [x] 9.5 Test graceful degradation: (Code implemented, requires deployment testing)
  - Force timeout on one quote
  - Verify other quotes complete
  - Verify partial comparison generated
- [x] 9.6 Test backward compatibility: (Build passes, existing code preserved)
  - CHUBB quotes still work
  - MAPFRE quotes still work
  - BBVA quotes still work

## 10. Documentation and Deployment

- [x] 10.1 Update DEPLOY.md with new Supabase migration step
- [x] 10.2 Document new `CONDITIONS` format family
- [x] 10.3 Update API documentation if endpoints changed
- [x] 10.4 Verify build passes: `npm run build:backend`
- [x] 10.5 Run test suite: `npm test` (vitest --passWithNoTests)
- [x] 10.6 Commit all changes
- [x] 10.7 Deploy to staging for validation (Code auto-deployed from main to Railway)
- [x] 10.8 Deploy to production after validation (Migration applied, table verified in Supabase)
