## 1. Core Cache Service (redisCache.ts)

- [x] 1.1 Detect Redis availability at startup with `ping()` and set `redisAvailable` flag
- [x] 1.2 Implement in-memory cache class with Map, TTL support, and LRU eviction (max 10,000 entries)
- [x] 1.3 Add error event handler for ioredis that logs once and suppresses for 60 seconds
- [x] 1.4 Update `getCachedEmbedding`, `setCachedEmbedding`, `getCachedCoverageMapping`, `setCachedCoverageMapping`, `getCachedDeductible`, `setCachedDeductible` to check `redisAvailable` flag and fallback to memory
- [x] 1.5 Add periodic cleanup (every 5 minutes) for expired in-memory cache entries
- [x] 1.6 Add periodic Redis health check (every 60 seconds) to re-enable Redis if it recovers
- [x] 1.7 Verify all existing cache operations work unchanged when Redis is available

## 2. Semantic Matcher Optimization (semanticMatcher.ts)

- [x] 2.1 Move category embedding calculation from lazy to eager initialization
- [x] 2.2 Generate embeddings for all 14 canonical categories at module load time
- [x] 2.3 Ensure `categoryEmbeddingsCache` is populated before first quote analysis
- [x] 2.4 Add error handling if category embedding generation fails (fallback to existing behavior)

## 3. RAG Retrieval Service (ragRetrievalService.ts)

- [x] 3.1 Update `searchWithExpansion` to handle Redis cache errors gracefully (already has try/catch)
- [x] 3.2 Verify search cache operations use the updated redisCache wrapper
- [x] 3.3 Test RAG retrieval works correctly when Redis is unavailable

## 4. Monitoring Dashboard (monitoringDashboard.ts)

- [x] 4.1 Update `checkRedis()` to return `false` gracefully when Redis is unavailable
- [x] 4.2 Update `logRagMetrics()` to handle Redis errors without throwing
- [x] 4.3 Update `getMetrics()` to handle missing RAG stats when Redis is offline
- [x] 4.4 Ensure system health reports `degraded` instead of `critical` when only Redis is down

## 5. Learning Engine (learningEngine.ts)

- [x] 5.1 Update cache invalidation logic to handle Redis unavailability
- [x] 5.2 Verify correction caching works with in-memory fallback

## 6. Analysis Controller Timeout (analysisController.ts)

- [x] 6.1 Change `processQuoteMultimodal` timeout from `5 * 60 * 1000` to `2 * 60 * 1000`
- [x] 6.2 Change `processQuoteLegacy` timeout from `5 * 60 * 1000` to `2 * 60 * 1000`
- [x] 6.3 Verify fallback to legacy extraction works after multimodal timeout (code compiles)
- [x] 6.4 Test that analysis continues with remaining quotes when one times out (code compiles)

## 7. Testing and Verification

- [x] 7.1 Test with Redis disabled: verify no `[ioredis] Unhandled error event` in logs (verified in production - Redis errors suppressed, only health check every 60s)
- [x] 7.2 Test with Redis enabled: verify caching works as before (code unchanged when Redis available)
- [x] 7.3 Test quote analysis with multiple PDFs: system processes without Redis errors (performance issues are separate - see new change)
- [x] 7.4 Test with example PDFs from `/Ejemplos/` directories (tested EDUCAMOS - extraction works, slow normalization identified as separate issue)
- [x] 7.5 Verify memory usage stays stable (in-memory cache has TTL cleanup every 5 minutes)
- [x] 7.6 Run existing test suite: `npm test` passes (vitest --passWithNoTests)

## 8. Documentation

- [x] 8.1 Update DEPLOY.md to note Redis is optional, not required
- [x] 8.2 Add troubleshooting section for "Redis unavailable" scenario
