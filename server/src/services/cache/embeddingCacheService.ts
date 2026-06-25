import { supabase } from '../../config/database';
import { env } from '../../config/env';

const EMBEDDING_MODEL_NAME = env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

interface CoverageEmbeddingRecord {
  coverage_name: string;
  embedding: number[];
  model: string;
  dimensions: number;
}

// In-memory LRU cache with TTL
class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): number[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.embedding;
  }

  set(key: string, embedding: number[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const memoryCache = new MemoryCache(1000, 60);

function normalizeCoverageName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Get cached embedding for a coverage name
 * Checks: Memory → Supabase
 */
export async function getCachedEmbedding(name: string): Promise<number[] | null> {
  const normalizedName = normalizeCoverageName(name);

  // 1. Check memory cache
  const memoryHit = memoryCache.get(normalizedName);
  if (memoryHit) {
    return memoryHit;
  }

  // 2. Check Supabase
  try {
    const { data, error } = await supabase
      .from('coverage_embeddings_cache')
      .select('embedding')
      .eq('coverage_name', normalizedName)
      .eq('model', EMBEDDING_MODEL_NAME)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Not found is OK
        console.warn(`⚠️ [EmbeddingCache] Supabase error: ${error.message}`);
      }
      return null;
    }

    if (data && (data as CoverageEmbeddingRecord).embedding) {
      const embedding = (data as CoverageEmbeddingRecord).embedding;
      // Store in memory cache
      memoryCache.set(normalizedName, embedding);
      return embedding;
    }
  } catch (err) {
    console.warn(`⚠️ [EmbeddingCache] Supabase query failed: ${err}`);
  }

  return null;
}

/**
 * Store embedding in cache (memory + Supabase)
 */
export async function setCachedEmbedding(name: string, embedding: number[]): Promise<void> {
  const normalizedName = normalizeCoverageName(name);

  // 1. Store in memory
  memoryCache.set(normalizedName, embedding);

  // 2. Store in Supabase
  try {
    const { error } = await supabase
      .from('coverage_embeddings_cache')
      .upsert({
        coverage_name: normalizedName,
        embedding,
        model: EMBEDDING_MODEL_NAME,
        dimensions: embedding.length
      } as unknown as never, {
        onConflict: 'coverage_name,model'
      });

    if (error) {
      console.warn(`⚠️ [EmbeddingCache] Failed to store in Supabase: ${error.message}`);
    }
  } catch (err) {
    console.warn(`⚠️ [EmbeddingCache] Supabase upsert failed: ${err}`);
  }
}

/**
 * Get batch of cached embeddings
 * Returns Map of coverageName → embedding
 */
export async function getBatch(coverageNames: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const normalizedNames = coverageNames.map(normalizeCoverageName);

  // 1. Check memory cache
  const missingFromMemory: string[] = [];
  for (const name of normalizedNames) {
    const memoryHit = memoryCache.get(name);
    if (memoryHit) {
      result.set(name, memoryHit);
    } else {
      missingFromMemory.push(name);
    }
  }

  if (missingFromMemory.length === 0) {
    return result;
  }

  // 2. Check Supabase for missing
  try {
    const { data, error } = await supabase
      .from('coverage_embeddings_cache')
      .select('coverage_name, embedding')
      .in('coverage_name', missingFromMemory)
      .eq('model', EMBEDDING_MODEL_NAME);

    if (error) {
      console.warn(`⚠️ [EmbeddingCache] Batch Supabase error: ${error.message}`);
      return result;
    }

    if (data) {
      for (const row of data as CoverageEmbeddingRecord[]) {
        const embedding = row.embedding;
        result.set(row.coverage_name, embedding);
        memoryCache.set(row.coverage_name, embedding);
      }
    }
  } catch (err) {
    console.warn(`⚠️ [EmbeddingCache] Batch query failed: ${err}`);
  }

  return result;
}

/**
 * Store batch of embeddings
 */
export async function setBatch(coverageNames: string[], embeddings: number[][]): Promise<void> {
  const normalizedNames = coverageNames.map(normalizeCoverageName);

  // 1. Store in memory
  for (let i = 0; i < normalizedNames.length; i++) {
    memoryCache.set(normalizedNames[i], embeddings[i]);
  }

  // 2. Store in Supabase
  try {
    const rows = normalizedNames.map((name, i) => ({
      coverage_name: name,
      embedding: embeddings[i],
      model: EMBEDDING_MODEL_NAME,
      dimensions: embeddings[i].length
    }));

    const { error } = await supabase
      .from('coverage_embeddings_cache')
      .upsert(rows as unknown as never[], {
        onConflict: 'coverage_name,model'
      });

    if (error) {
      console.warn(`⚠️ [EmbeddingCache] Batch store failed: ${error.message}`);
    }
  } catch (err) {
    console.warn(`⚠️ [EmbeddingCache] Batch upsert failed: ${err}`);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { memorySize: number } {
  return {
    memorySize: memoryCache.size()
  };
}
