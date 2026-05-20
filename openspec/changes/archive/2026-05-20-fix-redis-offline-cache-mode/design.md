## Context

The Comparador CSA backend uses Redis for caching embeddings, coverage mappings, and search results. In production (Railway), Redis is not configured, causing `ECONNREFUSED` errors every 2 seconds. The `ioredis` client emits unhandled error events that fill logs and can crash the Node.js process.

Without Redis:
- Every coverage embedding is recalculated (Gemini API call)
- Every search result is recalculated (Supabase vector search)
- Rate limits are hit quickly with multiple quotes
- Quote analysis times out after 5 minutes, returning empty results

Current cache usage:
- `redisCache.ts`: Exports a singleton Redis client used by embeddingService, ragRetrievalService, monitoringDashboard, and learningEngine
- `semanticMatcher.ts`: Already has local `Map` caches but category embeddings are calculated lazily
- `analysisController.ts`: 5-minute timeout per quote, no fallback for multimodal extraction failure

## Goals / Non-Goals

**Goals:**
- Make the system work correctly without Redis (zero infrastructure changes)
- Eliminate `[ioredis] Unhandled error event` log spam
- Reduce Gemini API calls by caching embeddings in memory
- Keep Redis support intact (opt-in when available)
- Reduce quote processing timeout to prevent hung requests

**Non-Goals:**
- Implement distributed caching (no Redis, no Memcached, no external cache)
- Change the 14 canonical categories
- Modify frontend code
- Add new features beyond cache reliability
- Persistent disk-based cache

## Decisions

### Decision 1: Dual-Mode Cache (Redis + In-Memory)
**Rationale:** The simplest approach that preserves existing Redis functionality while adding offline support.

**Implementation:**
- Detect Redis availability at startup with a single `ping()` attempt
- If Redis fails: suppress error events, set `redisAvailable = false`
- All cache operations check `redisAvailable` flag first
- Fallback: Node.js `Map()` with manual TTL cleanup via `setInterval`

**Alternative considered:** Always use in-memory, ignore Redis completely. Rejected because existing deployments with Redis would lose caching benefits.

### Decision 2: Precalculate Category Embeddings at Startup
**Rationale:** The 14 canonical categories never change. Their embeddings should be calculated once and reused.

**Implementation:**
- In `semanticMatcher.ts`: Generate embeddings for all 14 categories during module initialization
- Store in the existing `categoryEmbeddingsCache` Map
- Lazy initialization is acceptable (first call triggers it) but eager is better

**Alternative considered:** Hardcode embedding vectors. Rejected because model changes would invalidate them.

### Decision 3: Silence ioredis Errors Without try/catch
**Rationale:** ioredis emits `error` events on the EventEmitter. Unhandled events crash Node.js in some configurations.

**Implementation:**
- Attach an `error` event handler that logs once, then suppresses subsequent errors
- Use a debounce: log first error, then silence for 60 seconds
- Never throw from the error handler

**Alternative considered:** Remove ioredis entirely. Rejected because we'd need to rewrite all imports and lose Redis support.

### Decision 4: Reduce Timeout from 5 to 2 Minutes
**Rationale:** 5 minutes is too generous for a single quote. If Gemini hasn't responded in 2 minutes, it's likely rate-limited or stalled.

**Implementation:**
- Change `processQuoteMultimodal` timeout from `5 * 60 * 1000` to `2 * 60 * 1000`
- Keep retry logic (3 retries with exponential backoff)
- After timeout, try legacy text extraction as fallback

**Alternative considered:** Remove timeout entirely. Rejected because hung requests would accumulate and crash the server.

## Risks / Trade-offs

**[Risk] Memory leak from in-memory cache** → Mitigation: TTL cleanup every 5 minutes, max cache size limit (10,000 entries), LRU eviction

**[Risk] Cache inconsistency across server restarts** → Mitigation: Acceptable trade-off. In-memory cache is ephemeral by design. Cache warm-up happens naturally as quotes are processed.

**[Risk] Two-minute timeout still too long for user experience** → Mitigation: Frontend already shows progress indicators. User can cancel and retry. Future improvement: streaming responses.

**[Risk] Circuit breaker may not recover if Redis comes back online** → Mitigation: Check Redis availability every 60 seconds. If it recovers, re-enable Redis path.

## Migration Plan

1. **Deploy new `redisCache.ts`** (backward compatible)
   - Existing Redis users: no change in behavior
   - Non-Redis users: automatic fallback to memory

2. **Deploy `semanticMatcher.ts` changes**
   - No breaking changes, just eager initialization

3. **Deploy `analysisController.ts` timeout reduction**
   - Faster failure = better user experience

4. **Rollback:** Revert to previous commit. No database migrations needed.

## Open Questions

- Should we add a `/health` endpoint that reports cache mode (Redis vs Memory)?
- Should we expose cache hit/miss metrics for monitoring?
