## Why

The backend crashes with `[ioredis] Unhandled error event: AggregateError [ECONNREFUSED]` every 2 seconds because Redis is not configured in production (Railway). Without Redis, all caching layers fail, causing cascading timeouts as every coverage embedding and clause search recalculates from scratch. This saturates the Gemini API rate limits, making quote analysis fail for ALL cotizaciones.

## What Changes

- **Make Redis 100% optional** by implementing a transparent fallback to in-memory cache when Redis is unavailable
- **Silence ioredis unhandled error events** to prevent log spam and potential crashes
- **Add application-level in-memory cache** with TTL support as drop-in replacement for Redis operations
- **Precalculate canonical category embeddings at startup** to eliminate redundant Gemini API calls per coverage
- **Reduce quote processing timeout** from 5 minutes to 2 minutes to fail faster and retry smarter
- **Add circuit-breaker logic** for cache operations: try Redis once, fall back to memory, don't retry Redis for 60 seconds

## Capabilities

### New Capabilities
- `redis-offline-mode`: Transparent fallback cache system that works with or without Redis infrastructure

### Modified Capabilities
- *(None at spec level - requirements remain the same, implementation changes only)*

## Impact

**Backend files:**
- `server/src/services/cache/redisCache.ts` - Core change: dual-mode cache (Redis + in-memory)
- `server/src/services/semanticMatcher.ts` - Precalculate category embeddings at startup
- `server/src/services/ragRetrievalService.ts` - Use new cache wrapper
- `server/src/services/monitoringDashboard.ts` - Handle Redis offline gracefully
- `server/src/services/learningEngine.ts` - Use new cache wrapper
- `server/src/controllers/analysisController.ts` - Reduce timeouts, better error handling

**No infrastructure changes required** - Works with existing Railway deployment without adding Redis service
