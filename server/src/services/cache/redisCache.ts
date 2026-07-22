import Redis from 'ioredis';
import type { CoverageMapping } from '../coverageOntology';
import type { DeductibleStructure } from '../../schemas/extractionSchemas';
import type { UnifiedComparisonResult } from '../../types/unifiedComparison';

/**
 * Shape stored by the V2 deductible cache. The canonical DeductibleStructure
 * requires rawText, but the cache stores a stripped payload and re-hydrates
 * the full shape on read.
 */
type CachedDeductibleV2 = Omit<DeductibleStructure, 'rawText'>;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ====== Redis Connection with Error Suppression ======
export const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

// Suppress ioredis error events after first log
let errorLogged = false;
let errorSuppressedUntil = 0;
redis.on('error', (err) => {
  const now = Date.now();
  if (!errorLogged) {
    console.warn(`⚠️  [Redis] Connection error (suppressing for 60s): ${err.message}`);
    errorLogged = true;
    errorSuppressedUntil = now + 60000;
  } else if (now > errorSuppressedUntil) {
    console.warn(`⚠️  [Redis] Still unavailable, suppressing for another 60s`);
    errorSuppressedUntil = now + 60000;
  }
  // Do NOT throw or crash
});

// ====== Redis Availability Detection ======
let redisAvailable = false;

async function checkRedisAvailability(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

// Initial check
(async () => {
  redisAvailable = await checkRedisAvailability();
  if (redisAvailable) {
    console.log('✅ [Redis] Connected and available');
  } else {
    console.log('⚠️  [Redis] Unavailable - using in-memory cache fallback');
  }
})();

// Periodic health check every 60 seconds
setInterval(async () => {
  const wasAvailable = redisAvailable;
  redisAvailable = await checkRedisAvailability();
  if (!wasAvailable && redisAvailable) {
    console.log('✅ [Redis] Recovered - switching to Redis cache');
  } else if (wasAvailable && !redisAvailable) {
    console.log('⚠️  [Redis] Lost connection - switching to in-memory cache');
  }
}, 60000);

// ====== In-Memory Cache with TTL and LRU ======
class MemoryCache {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private zsets = new Map<string, Array<{ score: number; member: string }>>();
  private keyExpiresAt = new Map<string, number>();
  private maxSize = 10000;
  private accessOrder = new Map<string, number>(); // For LRU tracking
  private accessCounter = 0;

  get(key: string): string | null {
    this.checkExpired(key);
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.keyExpiresAt.delete(key);
      return null;
    }

    // Update access order for LRU
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
    return item.value;
  }

  setex(key: string, ttlSeconds: number, value: string): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
  }

  del(key: string): void {
    this.cache.delete(key);
    this.hashes.delete(key);
    this.zsets.delete(key);
    this.accessOrder.delete(key);
    this.keyExpiresAt.delete(key);
  }

  keys(pattern: string): string[] {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter((k) => regex.test(k));
  }

  hset(key: string, fields: Record<string, string | number>): number {
    this.checkExpired(key);
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const h = this.hashes.get(key)!;
    let added = 0;
    for (const [field, value] of Object.entries(fields)) {
      const strValue = String(value);
      if (!h.has(field)) added++;
      h.set(field, strValue);
    }
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
    return added;
  }

  hgetall(key: string): Record<string, string> {
    this.checkExpired(key);
    const h = this.hashes.get(key);
    if (!h) return {};
    const result: Record<string, string> = {};
    for (const [field, value] of h.entries()) {
      result[field] = value;
    }
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
    return result;
  }

  zadd(key: string, score: number, member: string): number {
    this.checkExpired(key);
    if (!this.zsets.has(key)) this.zsets.set(key, []);
    const list = this.zsets.get(key)!;
    const existing = list.find((item) => item.member === member);
    if (existing) {
      existing.score = score;
      return 0;
    }
    list.push({ score, member });
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
    return 1;
  }

  zrangebyscore(key: string, min: number | string, max: number | string): string[] {
    this.checkExpired(key);
    const list = this.zsets.get(key) ?? [];
    const minNum = Number(min);
    const maxNum = Number(max);
    return list
      .filter((item) => item.score >= minNum && item.score <= maxNum)
      .map((item) => item.member);
  }

  pexpire(key: string, milliseconds: number): number {
    this.checkExpired(key);
    this.keyExpiresAt.set(key, Date.now() + milliseconds);
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
    return 1;
  }

  private checkExpired(key: string): boolean {
    const expiresAt = this.keyExpiresAt.get(key);
    if (expiresAt && Date.now() > expiresAt) {
      this.cache.delete(key);
      this.hashes.delete(key);
      this.zsets.delete(key);
      this.accessOrder.delete(key);
      this.keyExpiresAt.delete(key);
      return true;
    }
    return false;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      console.warn(`⚠️  [MemoryCache] Evicted LRU entry: ${oldestKey}`);
    }
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.keyExpiresAt.delete(key);
        cleaned++;
      }
    }
    for (const [key, expiresAt] of this.keyExpiresAt.entries()) {
      if (now > expiresAt) {
        this.cache.delete(key);
        this.hashes.delete(key);
        this.zsets.delete(key);
        this.accessOrder.delete(key);
        this.keyExpiresAt.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 [MemoryCache] Cleaned ${cleaned} expired entries`);
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

const memoryCache = new MemoryCache();

// Periodic cleanup every 5 minutes
setInterval(
  () => {
    memoryCache.cleanup();
  },
  5 * 60 * 1000
);

// ====== Cache Keys ======
export const cacheKeys = {
  embedding: (text: string) => `emb:${Buffer.from(text).toString('base64').substring(0, 32)}`,
  coverageMapping: (rawName: string, insurer?: string) =>
    `map:${insurer || 'global'}:${Buffer.from(rawName).toString('base64').substring(0, 32)}`,
  clauseStructured: (insurer: string, product?: string) =>
    `clause:${insurer}:${product || 'default'}`,
  searchResults: (query: string) =>
    `search:${Buffer.from(query).toString('base64').substring(0, 32)}`,
  deductibleParsed: (text: string) =>
    `deductible:${Buffer.from(text).toString('base64').substring(0, 32)}`,
  deductibleV2: (text: string) =>
    `deductible:v2:${Buffer.from(text).toString('base64').substring(0, 32)}`,
  comparisonResult: (fileHash: string) => `comparison:${fileHash}`,
  unifiedResult: (fileHash: string) => `unified:${fileHash}`,
};

export const cacheTTL = {
  embedding: 60 * 60 * 24 * 7, // 7 days
  coverageMapping: 60 * 60 * 24 * 30, // 30 days
  clauseStructured: 60 * 60 * 24, // 1 day
  searchResults: 60 * 60, // 1 hour
  deductibleParsed: 60 * 60 * 24 * 30, // 30 days
  comparisonResult: 60 * 60 * 24, // 1 day
  unifiedResult: 60 * 60 * 24, // 1 day
};

// ====== Dual-Mode Cache Operations ======
export async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const key = cacheKeys.embedding(text);

  if (redisAvailable) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_error) {
      // Redis failed, try memory
    }
  }

  // Fallback to memory
  const cached = memoryCache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedEmbedding(text: string, embedding: number[]): Promise<void> {
  const key = cacheKeys.embedding(text);
  const value = JSON.stringify(embedding);

  if (redisAvailable) {
    try {
      await redis.setex(key, cacheTTL.embedding, value);
      return;
    } catch (_error) {
      // Redis failed, store in memory
    }
  }

  memoryCache.setex(key, cacheTTL.embedding, value);
}

export async function getCachedCoverageMapping(
  rawName: string,
  insurer?: string
): Promise<CoverageMapping | null> {
  const key = cacheKeys.coverageMapping(rawName, insurer);

  if (redisAvailable) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_error) {
      // Redis failed, try memory
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedCoverageMapping(
  rawName: string,
  mapping: CoverageMapping,
  insurer?: string
): Promise<void> {
  const key = cacheKeys.coverageMapping(rawName, insurer);
  const value = JSON.stringify(mapping);

  if (redisAvailable) {
    try {
      await redis.setex(key, cacheTTL.coverageMapping, value);
      return;
    } catch (_error) {
      // Redis failed, store in memory
    }
  }

  memoryCache.setex(key, cacheTTL.coverageMapping, value);
}

export async function getCachedDeductible<T>(text: string): Promise<T | null> {
  const key = cacheKeys.deductibleParsed(text);

  if (redisAvailable) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (_error) {
      // Redis failed, try memory
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }
  return null;
}

export async function setCachedDeductible<T>(text: string, parsed: T): Promise<void> {
  const key = cacheKeys.deductibleParsed(text);
  const value = JSON.stringify(parsed);

  if (redisAvailable) {
    try {
      await redis.setex(key, cacheTTL.deductibleParsed, value);
      return;
    } catch (_error) {
      // Redis failed, store in memory
    }
  }

  memoryCache.setex(key, cacheTTL.deductibleParsed, value);
}

export async function getCachedDeductibleV2(text: string): Promise<CachedDeductibleV2 | null> {
  const key = cacheKeys.deductibleV2(text);

  if (redisAvailable) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_error) {
      // Redis failed, try memory
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedDeductibleV2(
  text: string,
  parsed: CachedDeductibleV2
): Promise<void> {
  const key = cacheKeys.deductibleV2(text);
  const value = JSON.stringify(parsed);

  if (redisAvailable) {
    try {
      await redis.setex(key, cacheTTL.deductibleParsed, value);
      return;
    } catch (_error) {
      // Redis failed, store in memory
    }
  }

  memoryCache.setex(key, cacheTTL.deductibleParsed, value);
}

// Generic cache operations for other services
export async function getCacheValue(key: string): Promise<string | null> {
  if (redisAvailable) {
    try {
      return await redis.get(key);
    } catch {
      // Redis failed
    }
  }
  return memoryCache.get(key);
}

export async function setCacheValue(key: string, ttl: number, value: string): Promise<void> {
  if (redisAvailable) {
    try {
      await redis.setex(key, ttl, value);
      return;
    } catch {
      // Redis failed
    }
  }
  memoryCache.setex(key, ttl, value);
}

export async function deleteCacheValue(key: string): Promise<void> {
  if (redisAvailable) {
    try {
      await redis.del(key);
    } catch {
      // Redis failed
    }
  }
  memoryCache.del(key);
}

export async function getCacheKeys(pattern: string): Promise<string[]> {
  if (redisAvailable) {
    try {
      return await redis.keys(pattern);
    } catch {
      // Redis failed
    }
  }
  return memoryCache.keys(pattern);
}

// ====== Template Hint Measurement Cache Operations ======
export async function hsetRedisCache(
  key: string,
  fields: Record<string, string | number>
): Promise<number> {
  if (redisAvailable) {
    try {
      return await redis.hset(key, fields);
    } catch {
      // Redis failed, fall back to memory
    }
  }
  return memoryCache.hset(key, fields);
}

export async function hgetallRedisCache(key: string): Promise<Record<string, string>> {
  if (redisAvailable) {
    try {
      return await redis.hgetall(key);
    } catch {
      // Redis failed, fall back to memory
    }
  }
  return memoryCache.hgetall(key);
}

export async function zaddRedisCache(key: string, score: number, member: string): Promise<number> {
  if (redisAvailable) {
    try {
      return await redis.zadd(key, score, member);
    } catch {
      // Redis failed, fall back to memory
    }
  }
  return memoryCache.zadd(key, score, member);
}

export async function zrangebyscoreRedisCache(
  key: string,
  min: number | string,
  max: number | string
): Promise<string[]> {
  if (redisAvailable) {
    try {
      return await redis.zrangebyscore(key, min, max);
    } catch {
      // Redis failed, fall back to memory
    }
  }
  return memoryCache.zrangebyscore(key, min, max);
}

export async function pexpireRedisCache(key: string, milliseconds: number): Promise<number> {
  if (redisAvailable) {
    try {
      return await redis.pexpire(key, milliseconds);
    } catch {
      // Redis failed, fall back to memory
    }
  }
  return memoryCache.pexpire(key, milliseconds);
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

// ====== Comparison Result Caching ======
export async function getCachedComparisonResult<T>(fileHash: string): Promise<T | null> {
  const key = cacheKeys.comparisonResult(fileHash);

  if (redisAvailable) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (_error) {
      // Redis failed, try memory
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }
  return null;
}

export async function setCachedComparisonResult<T>(fileHash: string, result: T): Promise<void> {
  const key = cacheKeys.comparisonResult(fileHash);
  const value = JSON.stringify(result);

  if (redisAvailable) {
    try {
      await redis.setex(key, cacheTTL.comparisonResult, value);
      return;
    } catch (_error) {
      // Redis failed, store in memory
    }
  }

  memoryCache.setex(key, cacheTTL.comparisonResult, value);
}

export async function getCachedUnifiedResult<T = UnifiedComparisonResult>(
  fileHash: string
): Promise<T | null> {
  const key = cacheKeys.unifiedResult(fileHash);

  if (redisAvailable) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (_error) {
      // Redis failed, try memory
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }
  return null;
}

export async function setCachedUnifiedResult<T = UnifiedComparisonResult>(
  fileHash: string,
  result: T
): Promise<void> {
  const key = cacheKeys.unifiedResult(fileHash);
  const value = JSON.stringify(result);

  if (redisAvailable) {
    try {
      await redis.setex(key, cacheTTL.unifiedResult, value);
      return;
    } catch (_error) {
      // Redis failed, store in memory
    }
  }

  memoryCache.setex(key, cacheTTL.unifiedResult, value);
}

export default redis;
